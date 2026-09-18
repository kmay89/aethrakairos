#!/usr/bin/env python3
"""Register every .swift / .metal file under tvos/AethraKairosTV in the Xcode
project — deterministic, idempotent, no Xcode required.

The project file is hand-maintained (no Xcode on the machines that write most
of this code), so a new source file is easy to forget, and a forgotten file is
a link error on the CI Mac twenty minutes later. This script closes that gap:

    python3 tvos/scripts/register_sources.py          # add what is missing
    python3 tvos/scripts/register_sources.py --check  # exit 1 if anything is missing

Object IDs are derived from the file's project-relative path (sha1, prefixed
so they can never collide with the hand-written AEC0FFEE… block), so two
people registering the same file on two branches produce byte-identical
pbxproj lines — a merge that both sides made is not a conflict.

Groups mirror the directory tree: a file in AethraKairosTV/UI/Foo.swift joins
the UI group; a new subdirectory becomes a new group under AethraKairosTV.
Only Sources are handled (Swift + Metal); resources stay a hand job.
"""
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TVOS = os.path.dirname(HERE)
PBX = os.path.join(TVOS, "AethraKairos.xcodeproj", "project.pbxproj")
SRC_ROOT = os.path.join(TVOS, "AethraKairosTV")
ROOT_GROUP_ID = "AEC0FFEE0000000000000040"      # the AethraKairosTV group
SOURCES_PHASE_ID = "AEC0FFEE0000000000000041"   # PBXSourcesBuildPhase
EXTS = {".swift": "sourcecode.swift", ".metal": "sourcecode.metal"}


def oid(kind, rel):
    """24-hex object id: kind prefix + sha1 of the project-relative path."""
    h = hashlib.sha1(rel.encode("utf-8")).hexdigest().upper()
    return {"ref": "AEC1", "build": "AEC2", "group": "AEC3"}[kind] + h[:20]


def main():
    check = "--check" in sys.argv
    with open(PBX, "r", encoding="utf-8") as f:
        text = f.read()

    # every source on disk, as AethraKairosTV-relative paths
    wanted = []
    for dirpath, _dirs, files in os.walk(SRC_ROOT):
        for name in sorted(files):
            ext = os.path.splitext(name)[1]
            if ext in EXTS:
                rel = os.path.relpath(os.path.join(dirpath, name), SRC_ROOT)
                wanted.append(rel.replace(os.sep, "/"))
    wanted.sort()

    # what the project already references (by file name inside its group)
    registered = set(re.findall(r'isa = PBXFileReference;[^\n]*?path = "?([^";]+)"?;', text))
    missing = [rel for rel in wanted if os.path.basename(rel) not in registered]

    if check:
        if missing:
            print("unregistered sources:\n  " + "\n  ".join(missing))
            return 1
        print("all %d sources registered" % len(wanted))
        return 0
    if not missing:
        print("nothing to do — all %d sources registered" % len(wanted))
        return 0

    build_lines, ref_lines, phase_lines = [], [], []
    group_children = {}   # group id -> [child lines]
    new_groups = []       # (id, name) to create under the root group

    def group_id_for(dirname):
        """The PBXGroup whose path = <dirname> under the root group, creating one."""
        if not dirname:
            return ROOT_GROUP_ID
        m = re.search(r'(AEC[0-9A-F]{21}) /\* %s \*/ = \{\n\t\t\tisa = PBXGroup;' % re.escape(dirname), text)
        if m:
            return m.group(1)
        gid = oid("group", "group:" + dirname)
        if gid not in [g for g, _ in new_groups]:
            new_groups.append((gid, dirname))
        return gid

    for rel in missing:
        dirname, name = os.path.split(rel)
        if "/" in dirname:
            print("nested subdirectories are not supported: %s" % rel)
            return 1
        ref = oid("ref", rel)
        bld = oid("build", rel)
        ftype = EXTS[os.path.splitext(name)[1]]
        ref_lines.append('\t\t%s /* %s */ = {isa = PBXFileReference; fileEncoding = 4; '
                         'lastKnownFileType = %s; path = %s; sourceTree = "<group>"; };\n'
                         % (ref, name, ftype, name))
        build_lines.append('\t\t%s /* %s in Sources */ = {isa = PBXBuildFile; fileRef = %s /* %s */; };\n'
                           % (bld, name, ref, name))
        phase_lines.append('\t\t\t\t%s /* %s in Sources */,\n' % (bld, name))
        group_children.setdefault(group_id_for(dirname), []).append('\t\t\t\t%s /* %s */,\n' % (ref, name))

    def insert_before(marker, lines):
        nonlocal text
        i = text.index(marker)
        text = text[:i] + "".join(lines) + text[i:]

    insert_before("/* End PBXBuildFile section */", build_lines)
    insert_before("/* End PBXFileReference section */", ref_lines)

    # new groups: declared in the group section and listed under the root group
    for gid, dirname in new_groups:
        block = ('\t\t%s /* %s */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n'
                 '\t\t\t);\n\t\t\tpath = %s;\n\t\t\tsourceTree = "<group>";\n\t\t};\n' % (gid, dirname, dirname))
        insert_before("/* End PBXGroup section */", [block])
        group_children.setdefault(ROOT_GROUP_ID, []).append('\t\t\t\t%s /* %s */,\n' % (gid, dirname))

    # children go at the end of each group's children list
    for gid, lines in group_children.items():
        m = re.search(r'%s /\* [^*]+ \*/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n' % gid, text)
        if not m:
            print("group %s not found" % gid)
            return 1
        end = text.index("\t\t\t);", m.end())
        text = text[:end] + "".join(lines) + text[end:]

    # the Sources phase
    m = re.search(r'%s /\* Sources \*/ = \{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = \d+;\n\t\t\tfiles = \(\n' % SOURCES_PHASE_ID, text)
    if not m:
        print("Sources phase not found")
        return 1
    end = text.index("\t\t\t);", m.end())
    text = text[:end] + "".join(phase_lines) + text[end:]

    with open(PBX, "w", encoding="utf-8") as f:
        f.write(text)
    print("registered %d source(s):\n  " % len(missing) + "\n  ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
