#!/usr/bin/env python3
"""Remix-layer tests — the score, the grants, the signatures.

Runs with no audio, no numpy and no network, because that is the machine CI
runs on and the whole licence/lineage gate has to work there. The receipt path
(which genuinely needs audio and Demucs) is tested only for its DEGRADATION:
it must report "unproven", never "ok".

  python3 -m pytest tests/test_remix.py -q     (or)
  python3 tests/test_remix.py
"""

import copy
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import remix
import signing


def _secret(tag=b"test"):
    return hashlib.sha256(b"remix tests " + tag).digest()


def _pub(secret):
    return signing.enc(signing.public_from_secret(secret))


class Selftests(unittest.TestCase):
    """The modules' own selftests are the specification; run them here too so
    a `pytest` run covers them and a red one shows up on the pull request."""

    def test_signing_selftest(self):
        self.assertTrue(signing.selftest(verbose=False))

    def test_remix_selftest(self):
        self.assertTrue(remix.selftest(verbose=False))


class Ed25519(unittest.TestCase):
    def test_rfc8032_vector(self):
        v = signing._RFC8032_1
        secret = bytes.fromhex(v["secret"])
        self.assertEqual(signing.public_from_secret(secret).hex(), v["public"])
        self.assertEqual(signing.raw_sign(secret, b"").hex(), v["sig"])

    def test_verification_never_needs_the_accelerator(self):
        """The point of the pure-Python path: force the accelerator off and
        everything still verifies. A signature nobody can check offline is not
        a signature."""
        saved = signing._ACCEL
        try:
            signing._ACCEL = False
            s = _secret(b"noaccel")
            obj = {"a": 1}
            obj["sig"] = signing.sign_obj(obj, s)
            self.assertTrue(signing.verify_obj(obj, _pub(s)))
        finally:
            signing._ACCEL = saved

    def test_canonicalisation_ignores_formatting_but_not_content(self):
        s = _secret(b"canon")
        obj = {"z": 1, "a": {"n": 0.5, "m": "é"}, "list": [1, 2, {"k": True}]}
        obj["sig"] = signing.sign_obj(obj, s)
        rewritten = json.loads(json.dumps(obj, indent=7, sort_keys=True))
        self.assertTrue(signing.verify_obj(rewritten, _pub(s)))
        self.assertFalse(signing.verify_obj(dict(obj, z=2), _pub(s)))

    def test_underscore_keys_are_scratch(self):
        """`_`-prefixed keys are excluded from the signature, so a tool may
        annotate a document in place without invalidating it."""
        s = _secret(b"scratch")
        obj = {"a": 1}
        obj["sig"] = signing.sign_obj(obj, s)
        obj["_note"] = "added by some tool afterwards"
        self.assertTrue(signing.verify_obj(obj, _pub(s)))


class Grants(unittest.TestCase):
    def setUp(self):
        self.secret = _secret(b"issuer")
        self.pub = _pub(self.secret)
        self.trust = {self.pub: "test issuer"}
        self.work = "ab" * 32
        self.grant = remix.make_grant(self.work, "T", self.pub,
                                      ["excerpt", "publish-score"], "terms")
        self.grant["sig"] = signing.sign_obj(self.grant, self.secret)

    def test_permits_what_it_says(self):
        self.assertEqual(remix.check_grant(self.grant, self.work, {"excerpt"}, self.trust), [])

    def test_refuses_verbs_not_granted(self):
        self.assertTrue(remix.check_grant(self.grant, self.work, {"separate"}, self.trust))

    def test_refuses_a_different_work(self):
        self.assertTrue(remix.check_grant(self.grant, "cd" * 32, {"excerpt"}, self.trust))

    def test_refuses_an_untrusted_issuer(self):
        self.assertTrue(remix.check_grant(self.grant, self.work, {"excerpt"}, {}))

    def test_unsigned_grant_is_worthless(self):
        g = dict(self.grant)
        g.pop("sig")
        self.assertTrue(remix.check_grant(g, self.work, {"excerpt"}, self.trust))

    def test_self_widened_permits_break_the_signature(self):
        """The attack a grant must survive: someone edits `permits` upward."""
        g = dict(self.grant, permits=["excerpt", "publish-score", "commercial"])
        self.assertTrue(remix.check_grant(g, self.work, {"commercial"}, self.trust))

    def test_expiry_is_judged_against_a_supplied_date(self):
        """Verification must be reproducible: re-verifying an old commit must
        not start failing merely because time passed."""
        g = remix.make_grant(self.work, "T", self.pub, ["excerpt"], "t",
                             expires="2030-01-01")
        g["sig"] = signing.sign_obj(g, self.secret)
        self.assertEqual(remix.check_grant(g, self.work, {"excerpt"}, self.trust,
                                           as_of="2029-01-01"), [])
        self.assertTrue(remix.check_grant(g, self.work, {"excerpt"}, self.trust,
                                          as_of="2031-01-01"))

    def test_wildcard_covers_the_catalog(self):
        g = remix.make_grant("*", "all", self.pub, ["excerpt"], "t")
        g["sig"] = signing.sign_obj(g, self.secret)
        self.assertEqual(remix.check_grant(g, "ff" * 32, {"excerpt"}, self.trust), [])


class RequiredPermits(unittest.TestCase):
    """Permits are COMPUTED from the manifest, never declared by it."""

    def base(self):
        return {"dna": 1, "id": "t", "title": "t", "author": {"name": "a", "key": "k"},
                "grid": {"bpm": 120}, "sources": {"a": {}, "b": {}},
                "lanes": [{"id": "l1", "source": "a", "stem": "vocals"},
                          {"id": "l2", "source": "b", "stem": "full"}],
                "clips": [{"lane": "l1", "beats": 16}, {"lane": "l2", "beats": 16}]}

    def test_stem_lane_implies_separate(self):
        self.assertIn("separate", remix.required_permits(self.base()))

    def test_two_sources_imply_layer(self):
        self.assertIn("layer", remix.required_permits(self.base()))

    def test_single_source_does_not_imply_layer(self):
        m = self.base()
        m["sources"] = {"a": {}}
        m["lanes"] = [{"id": "l1", "source": "a", "stem": "full"}]
        m["clips"] = [{"lane": "l1", "beats": 16}]
        self.assertNotIn("layer", remix.required_permits(m))
        self.assertNotIn("separate", remix.required_permits(m))

    def test_warp_implies_timestretch(self):
        m = self.base()
        m["clips"][0]["warp"] = True
        self.assertIn("timestretch", remix.required_permits(m))

    def test_publishing_audio_implies_render_public(self):
        m = self.base()
        self.assertNotIn("render-public", remix.required_permits(m))
        m["publish"] = {"audio": True}
        self.assertIn("render-public", remix.required_permits(m))

    def test_permits_are_attributed_to_the_right_source(self):
        m = self.base()
        m["clips"][1]["semitones"] = 2
        per = remix.per_source_permits(m)
        self.assertIn("separate", per["a"])
        self.assertNotIn("separate", per["b"])
        self.assertIn("pitchshift", per["b"])
        self.assertNotIn("pitchshift", per["a"])


class Timing(unittest.TestCase):
    def test_bar_one_is_the_downbeat(self):
        self.assertAlmostEqual(remix.bar_to_seconds(120.0, 2.5, 1), 2.5)

    def test_bars_are_four_beats(self):
        self.assertAlmostEqual(remix.bar_to_seconds(120.0, 0.0, 2), 2.0)

    def test_round_trip(self):
        for bpm in (90.0, 120.0, 128.007, 174.0):
            t = remix.bar_to_seconds(bpm, 0.31, 17)
            self.assertAlmostEqual(remix.seconds_to_bar(bpm, 0.31, t), 17.0)

    def test_half_time_is_family(self):
        self.assertAlmostEqual(remix.tempo_ratio(140.0, 70.0), 1.0)
        self.assertAlmostEqual(remix.tempo_ratio(128.0, 256.0), 1.0)

    def test_incompatible_tempos_return_none(self):
        self.assertIsNone(remix.tempo_ratio(128.0, 0))

    def test_camelot_wheel_wraps(self):
        self.assertTrue(remix.camelot_compatible("12A", "1A"))
        self.assertTrue(remix.camelot_compatible("1A", "12A"))
        self.assertFalse(remix.camelot_compatible("1A", "6A"))

    def test_ungridded_material_cannot_be_addressed_in_bars(self):
        """The piano rule: rubato is never forced onto a grid, so bar
        addressing must fail loudly rather than invent a tempo."""
        track = {"duration": 100.0, "mix": {}}
        with self.assertRaises(remix.Fail):
            remix.resolve_position(track, {"bar": 4})
        self.assertAlmostEqual(remix.resolve_position(track, {"t": 12.5}), 12.5)

    def test_sections_are_fractions_of_duration(self):
        track = {"duration": 200.0,
                 "mix": {"structure": {"sections": [{"s": 0.0}, {"s": 0.25}],
                                       "apex": 0.5}}}
        self.assertAlmostEqual(remix.resolve_position(track, {"section": 2}), 50.0)
        self.assertAlmostEqual(remix.resolve_position(track, {"section": "apex"}), 100.0)
        with self.assertRaises(remix.Fail):
            remix.resolve_position(track, {"section": 9})


class Splits(unittest.TestCase):
    def manifest(self, clips):
        return {"grid": {"bpm": 120}, "author": {"name": "arr", "key": "k"},
                "sources": {"x": {"title": "X"}, "y": {"title": "Y"}},
                "lanes": [{"id": "x1", "source": "x"}, {"id": "x2", "source": "x"},
                          {"id": "y1", "source": "y"}],
                "clips": clips}

    def test_more_lanes_do_not_earn_more_credit(self):
        m = self.manifest([{"lane": "x1", "at": {"bar": 1}, "beats": 64},
                           {"lane": "x2", "at": {"bar": 1}, "beats": 64},
                           {"lane": "y1", "at": {"bar": 1}, "beats": 64}])
        rows = remix.splits(m, None, 0.5)
        by = {r["title"]: r["share"] for r in rows}
        self.assertAlmostEqual(by["X"], by["Y"])

    def test_more_time_does_earn_more_credit(self):
        m = self.manifest([{"lane": "x1", "at": {"bar": 1}, "beats": 128},
                           {"lane": "y1", "at": {"bar": 33}, "beats": 64}])
        by = {r["title"]: r["share"] for r in remix.splits(m, None, 0.5)}
        self.assertGreater(by["X"], by["Y"])

    def test_shares_sum_to_one(self):
        m = self.manifest([{"lane": "x1", "at": {"bar": 1}, "beats": 37},
                           {"lane": "y1", "at": {"bar": 5}, "beats": 91}])
        for arranger in (0.0, 0.25, 0.5, 1.0):
            rows = remix.splits(m, None, arranger)
            self.assertAlmostEqual(sum(r["share"] for r in rows), 1.0)

    def test_union_arithmetic(self):
        self.assertEqual(remix._union_length([(0, 4), (2, 6)]), 6)
        self.assertEqual(remix._union_length([(0, 4), (4, 8)]), 8)
        self.assertEqual(remix._union_length([(5, 6), (0, 1)]), 2)
        self.assertEqual(remix._union_length([]), 0.0)


class Envelopes(unittest.TestCase):
    def test_finds_the_hole_and_the_voice(self):
        env = [0.0] * 24 + [0.9] * 60 + [0.0] * 24
        quiet = remix.envelope_windows(env, 0.12, 1.0, want="quiet")
        loud = remix.envelope_windows(env, 0.45, 1.0, want="loud")
        self.assertEqual(len(quiet), 2)
        self.assertEqual(len(loud), 1)
        self.assertAlmostEqual(loud[0][0], 2.0)
        self.assertAlmostEqual(loud[0][1], 7.0)

    def test_minimum_length_is_respected(self):
        env = [0.9] * 12
        self.assertEqual(remix.envelope_windows(env, 0.45, 5.0, want="loud"), [])

    def test_a_window_running_to_the_end_is_closed(self):
        env = [0.0] * 6 + [0.9] * 60
        self.assertEqual(len(remix.envelope_windows(env, 0.45, 1.0, want="loud")), 1)

    def test_missing_envelope_is_not_a_crash(self):
        self.assertEqual(remix.envelope_windows(None, 0.5, 1.0), [])
        self.assertIsNone(remix.stem_envelope({"mix": {}}, "vocals"))


class TheShippedExample(unittest.TestCase):
    """The example in remixes/ must verify against the real catalog, or the
    documentation is lying."""

    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / "remixes" / "137-x-runners-club" / "remix.json"
        if not cls.path.exists():
            raise unittest.SkipTest("example remix not present")
        cls.manifest = json.loads(cls.path.read_text())
        cls.catalog = remix.load_catalog()
        cls.trust = signing.load_trust(ROOT / "TRUST")

    def verify(self, manifest, **kw):
        return remix.verify(manifest, self.catalog, self.trust, **kw)

    def test_it_verifies(self):
        ok, log = self.verify(self.manifest)
        self.assertTrue(ok, "\n".join(m for l, m in log if l == "fail"))

    def test_receipts_are_reported_unproven_not_ok(self):
        """Without audio, an unverifiable claim must never read as verified."""
        ok, log = self.verify(self.manifest, check_receipts=True)
        self.assertTrue(ok)
        self.assertTrue(any(l == "warn" for l, _ in log))

    def test_the_burned_demo_key_is_announced(self):
        _, log = self.verify(self.manifest)
        self.assertTrue(any("BURNED" in m for _, m in log),
                        "a key with a public secret must be called out every time")

    def test_tampering_breaks_it(self):
        m = copy.deepcopy(self.manifest)
        m["title"] = "Stolen"
        ok, _ = self.verify(m)
        self.assertFalse(ok)

    def test_exceeding_the_grant_fails_even_when_correctly_re_signed(self):
        """The property the whole design rests on: a valid trusted signature
        does not buy you permissions the grant never gave."""
        secret = signing.read_secret(ROOT / "tests" / "fixtures" / "demo-label.key")
        for mutate, expect in [
            (lambda m: m.update(publish={"audio": True, "commercial": True}), "grant"),
            (lambda m: m["clips"][3].update(semitones=3), "grant"),
            (lambda m: m.update(parents=m["parents"][:1]), "parents"),
            (lambda m: m["clips"][0].update(beats=999999), "past the"),
        ]:
            m = copy.deepcopy(self.manifest)
            mutate(m)
            m["sig"] = signing.sign_obj(m, secret)      # correctly re-signed
            ok, log = self.verify(m)
            self.assertFalse(ok, f"should have been rejected: {expect}")
            self.assertTrue(any(expect in msg for lvl, msg in log if lvl == "fail"),
                            f"expected a failure mentioning {expect!r}, got "
                            + "; ".join(m2 for l, m2 in log if l == "fail"))

    def test_compiles_to_a_sane_timeline(self):
        tl = remix.compile_timeline(self.manifest, self.catalog)
        self.assertEqual(len(tl["events"]), len(self.manifest["clips"]))
        self.assertGreater(tl["duration"], 0)
        for e in tl["events"]:
            self.assertGreaterEqual(e["at"], 0)
            self.assertGreater(e["dur"], 0)
            self.assertGreater(e["src"], -0.001)
        self.assertEqual(tl["events"], sorted(tl["events"], key=lambda e: (e["at"], e["lane"])))

    def test_render_plan_is_relative_and_readable(self):
        script = remix.render_plan(self.manifest, self.catalog, "build")
        self.assertTrue(script.startswith("#!/bin/sh"))
        self.assertNotIn(str(ROOT), script,
                         "absolute paths make a build script that only runs once")
        self.assertIn("demucs", script)
        self.assertIn("fingerprint.py check", script)

    def test_grid_matches_the_catalog(self):
        """The draft's tempo must be the bed's measured tempo, not a guess."""
        bed = self.manifest["sources"]["bed"]["sha256"]
        track = next(t for _, t in remix.tracks(self.catalog) if t["sha256"] == bed)
        self.assertAlmostEqual(self.manifest["grid"]["bpm"],
                               track["mix"]["bpm"], places=2)


class Drafting(unittest.TestCase):
    """`pair` must produce something that passes `verify` — a drafter that
    emits invalid manifests is worse than no drafter."""

    def test_a_draft_verifies(self):
        catalog = remix.load_catalog()
        trust = signing.load_trust(ROOT / "TRUST")
        secret = signing.read_secret(ROOT / "tests" / "fixtures" / "demo-label.key")
        pub = _pub(secret)
        m = remix.pair(catalog, "74a4f4553b", "84dee9ec39", "test", pub, 16)
        m["sig"] = signing.sign_obj(m, secret)
        ok, log = remix.verify(m, catalog, trust)
        self.assertTrue(ok, "\n".join(msg for l, msg in log if l == "fail"))

    def test_draft_snaps_to_whole_bars(self):
        catalog = remix.load_catalog()
        m = remix.pair(catalog, "74a4f4553b", "84dee9ec39", "t", "k", 16)
        for c in m["clips"]:
            self.assertEqual(c["beats"] % remix.BEATS_PER_BAR, 0)
            self.assertEqual(float(c["from"]["bar"]), int(c["from"]["bar"]))


class Intake(unittest.TestCase):
    def test_declaration_hashes_the_prompt_rather_than_storing_it(self):
        catalog = remix.load_catalog()
        secret = _secret(b"declarer")
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "generated.mp3"
            p.write_bytes(b"ID3\x03\x00\x00\x00 not really audio")
            decl, sha = remix.intake_declaration(
                p, "generated", _pub(secret), catalog,
                generator="suno-v4.5", prompt="a secret prompt")
            self.assertEqual(sha, hashlib.sha256(p.read_bytes()).hexdigest())
            self.assertNotIn("a secret prompt", json.dumps(decl))
            self.assertEqual(decl["prompt_sha256"],
                             hashlib.sha256(b"a secret prompt").hexdigest())
            self.assertFalse(decl["screened"]["exact_duplicate"])
            decl["sig"] = signing.sign_obj(decl, secret)
            self.assertTrue(signing.verify_obj(decl, _pub(secret)))

    def test_a_re_upload_of_our_own_catalog_is_caught(self):
        catalog = remix.load_catalog()
        known = next(t for _, t in remix.tracks(catalog) if t.get("sha256"))
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.mp3"
            p.write_bytes(b"whatever")
            decl, _ = remix.intake_declaration(p, "generated", "k", catalog)
            self.assertFalse(decl["screened"]["exact_duplicate"])
            # and now force the collision to prove the screen actually looks
            decl2, _ = remix.intake_declaration(p, "generated", "k",
                                                {"albums": [{"tracks": [
                                                    dict(known, sha256=hashlib.sha256(
                                                        b"whatever").hexdigest())]}]})
            self.assertTrue(decl2["screened"]["exact_duplicate"])


class TrustFile(unittest.TestCase):
    def test_the_repo_trust_file_parses(self):
        trust = signing.load_trust(ROOT / "TRUST")
        self.assertTrue(trust)
        for key in trust:
            self.assertEqual(len(signing.dec(key, length=32)), 32)

    def test_burned_keys_are_known_to_the_tooling(self):
        trust = signing.load_trust(ROOT / "TRUST")
        self.assertTrue(set(trust) & set(signing.BURNED),
                        "the shipped TRUST uses the demo key; it must be listed "
                        "as burned so every verify warns about it")

    def test_a_malformed_trust_line_is_a_hard_error(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "TRUST"
            p.write_text("not-a-key   somebody\n")
            with self.assertRaises(SystemExit):
                signing.load_trust(p)

    def test_comments_and_blanks_are_ignored(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "TRUST"
            p.write_text("# a comment\n\n   \ned25519:" + "A" * 43 + "=  Someone  # note\n")
            self.assertEqual(len(signing.load_trust(p)), 1)


class Keys(unittest.TestCase):
    def test_keygen_writes_a_private_key_and_refuses_to_clobber(self):
        with tempfile.TemporaryDirectory() as d:
            pub, sk, pk = signing.write_keypair(Path(d) / "k", "Test")
            self.assertEqual(oct(os.stat(sk).st_mode)[-3:], "600")
            self.assertEqual(signing.read_public(pk), pub)
            self.assertEqual(len(signing.read_secret(sk)), 32)
            with self.assertRaises(SystemExit):
                signing.write_keypair(Path(d) / "k", "Test")

    def test_the_demo_secret_really_does_produce_the_demo_public_key(self):
        """If this drifts, the shipped example stops verifying."""
        secret = signing.read_secret(ROOT / "tests" / "fixtures" / "demo-label.key")
        self.assertIn(_pub(secret), signing.BURNED)


if __name__ == "__main__":
    unittest.main(verbosity=2)
