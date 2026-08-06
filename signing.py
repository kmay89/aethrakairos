#!/usr/bin/env python3
"""signing.py — the notary: Ed25519 in pure Python, plus the canonical JSON
serialisation everything in the remix layer signs over.

Why pure Python. A signature is only as durable as the thing that checks it.
`pip install` is not a durability story: a grant issued today has to still
verify in 2040, on a machine with no network, from a clone of this repo. So
the verifier is ~150 lines of stdlib arithmetic (RFC 8032, §5.1) that will
run on any Python 3 that still exists. `cryptography`/`libsodium` are faster
and constant-time; when one is importable we use it for SIGNING (see
`_fast_sign`), because the secret half is the half that leaks through timing.
The VERIFYING path stays dependency-free by design — verification handles no
secrets, so the slow honest loop costs nothing but microseconds.

Formats, all ASCII, all diffable:

  key        ed25519:<base64 32 bytes>          — public, and how keys are
                                                  named everywhere else
  secret     a .key file, 0600, two lines: a comment and ed25519-secret:<b64 32>
  signature  ed25519:<base64 64 bytes>

  canon(obj) RFC 8785-flavoured JSON: keys sorted, no insignificant space,
             UTF-8, `sig` (and any key starting with `_`) removed. Signing a
             CANONICAL FORM rather than a byte-for-byte file is what lets a
             manifest be reformatted, re-indented, or round-tripped through a
             tool without breaking its signature. A remix is a document people
             hand-edit; a signature that a stray newline invalidates is a
             signature nobody keeps.

CLI:
  signing.py keygen --out keys/label [--name "ERRERlabs"]
  signing.py sign FILE.json --key keys/label.key      (writes `sig` in place)
  signing.py verify FILE.json [--key ed25519:... | --trust TRUST]
  signing.py selftest                                 (RFC 8032 vectors)
"""

import argparse
import base64
import contextlib
import hashlib
import json
import os
import stat
import sys
from pathlib import Path

# ------------------------------------------------------------------ ed25519
# RFC 8032 §5.1, extended homogeneous coordinates (X:Y:Z:T), x*y = T/Z.

_P = 2 ** 255 - 19
_L = 2 ** 252 + 27742317777372353535851937790883648493
_D = -121665 * pow(121666, _P - 2, _P) % _P
_SQRT_M1 = pow(2, (_P - 1) // 4, _P)


def _sha512(b):
    return hashlib.sha512(b).digest()


def _inv(x):
    return pow(x, _P - 2, _P)


def _add(P, Q):
    A = (P[1] - P[0]) * (Q[1] - Q[0]) % _P
    B = (P[1] + P[0]) * (Q[1] + Q[0]) % _P
    C = 2 * P[3] * Q[3] * _D % _P
    D = 2 * P[2] * Q[2] % _P
    E, F, G, H = B - A, D - C, D + C, B + A
    return (E * F % _P, G * H % _P, F * G % _P, E * H % _P)


def _mul(s, P):
    Q = (0, 1, 1, 0)  # neutral
    while s > 0:
        if s & 1:
            Q = _add(Q, P)
        P = _add(P, P)
        s >>= 1
    return Q


def _equal(P, Q):
    return (P[0] * Q[2] - Q[0] * P[2]) % _P == 0 and (P[1] * Q[2] - Q[1] * P[2]) % _P == 0


def _recover_x(y, sign):
    if y >= _P:
        return None
    x2 = (y * y - 1) * _inv(_D * y * y + 1) % _P
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (_P + 3) // 8, _P)
    if (x * x - x2) % _P != 0:
        x = x * _SQRT_M1 % _P
    if (x * x - x2) % _P != 0:
        return None
    if (x & 1) != sign:
        x = _P - x
    return x


_GY = 4 * _inv(5) % _P
_GX = _recover_x(_GY, 0)
_B = (_GX, _GY, 1, _GX * _GY % _P)


def _compress(P):
    zi = _inv(P[2])
    x, y = P[0] * zi % _P, P[1] * zi % _P
    return int.to_bytes(y | ((x & 1) << 255), 32, "little")


def _decompress(s):
    if len(s) != 32:
        return None
    y = int.from_bytes(s, "little")
    sign = y >> 255
    y &= (1 << 255) - 1
    x = _recover_x(y, sign)
    return None if x is None else (x, y, 1, x * y % _P)


def _clamp(h32):
    a = int.from_bytes(h32, "little")
    a &= (1 << 254) - 8      # clear the low 3 bits (cofactor)
    a |= 1 << 254            # set bit 254 (fixed leading bit)
    return a


def public_from_secret(secret):
    """32-byte seed -> 32-byte public key."""
    h = _sha512(secret)
    return _compress(_mul(_clamp(h[:32]), _B))


def raw_sign(secret, msg):
    h = _sha512(secret)
    a, prefix = _clamp(h[:32]), h[32:]
    A = _compress(_mul(a, _B))
    r = int.from_bytes(_sha512(prefix + msg), "little") % _L
    R = _compress(_mul(r, _B))
    k = int.from_bytes(_sha512(R + A + msg), "little") % _L
    return R + int.to_bytes((r + k * a) % _L, 32, "little")


def raw_verify(public, msg, sig):
    if len(sig) != 64 or len(public) != 32:
        return False
    A = _decompress(public)
    R = _decompress(sig[:32])
    if A is None or R is None:
        return False
    s = int.from_bytes(sig[32:], "little")
    if s >= _L:                     # reject malleable / non-canonical S
        return False
    k = int.from_bytes(_sha512(sig[:32] + public + msg), "little") % _L
    return _equal(_mul(s, _B), _add(R, _mul(k, A)))


_ACCEL = None  # None = not yet probed, False = unavailable, else the class


@contextlib.contextmanager
def _quiet_fd(fd):
    """Silence a raw file descriptor for the duration of the block.

    Python's redirect_stderr only moves sys.stderr; a native extension writes
    to fd 2 directly and would still spray a Rust backtrace over the output of
    every tool that imports this module."""
    try:
        saved = os.dup(fd)
    except OSError:                     # no such fd (embedded, pythonw, tests)
        yield
        return
    try:
        with open(os.devnull, "w") as null:
            os.dup2(null.fileno(), fd)
        yield
    finally:
        os.dup2(saved, fd)
        os.close(saved)


def _accel():
    """Find a constant-time Ed25519, or settle for not having one.

    The probe catches BaseException, which is normally a sin — but a broken
    native extension does not fail politely. `cryptography` built against a
    missing cffi backend raises pyo3's PanicException, which inherits from
    BaseException and sails straight through `except Exception`. An optional
    accelerator that can take the process down with it is worse than no
    accelerator, so the probe is total, runs once, and remembers."""
    global _ACCEL
    if _ACCEL is None:
        with _quiet_fd(2):  # a panicking extension writes its backtrace to fd 2
            try:
                from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
                Ed25519PrivateKey.from_private_bytes(b"\0" * 32).sign(b"probe")
                _ACCEL = Ed25519PrivateKey
            except (KeyboardInterrupt, SystemExit):
                raise
            except BaseException:
                _ACCEL = False
    return _ACCEL


def _fast_sign(secret, msg):
    """Constant-time signing when a real crypto library is present.

    Verification deliberately does NOT take this path: it must behave
    identically everywhere, forever, with nothing installed."""
    cls = _accel()
    if not cls:
        return None
    try:
        return cls.from_private_bytes(secret).sign(msg)
    except (KeyboardInterrupt, SystemExit):
        raise
    except BaseException:
        return None


# ------------------------------------------------------------------ wire format

def enc(raw, kind="ed25519"):
    return f"{kind}:{base64.b64encode(raw).decode('ascii')}"


def dec(text, kind="ed25519", length=None):
    if not isinstance(text, str) or not text.startswith(kind + ":"):
        raise ValueError(f"expected a {kind}: value, got {text!r:.40}")
    raw = base64.b64decode(text[len(kind) + 1:], validate=True)
    if length is not None and len(raw) != length:
        raise ValueError(f"{kind} value is {len(raw)} bytes, expected {length}")
    return raw


def keyid(public_text):
    """A short, stable, human-quotable name for a key: 16 hex of SHA-256."""
    return hashlib.sha256(dec(public_text, length=32)).hexdigest()[:16]


# ------------------------------------------------------------------ canonical JSON

def _strip(obj):
    if isinstance(obj, dict):
        return {k: _strip(v) for k, v in obj.items() if k != "sig" and not k.startswith("_")}
    if isinstance(obj, list):
        return [_strip(v) for v in obj]
    return obj


def canon(obj):
    """The exact bytes a signature covers.

    Sorted keys, minimal separators, UTF-8, `sig` and `_`-prefixed keys
    removed. Floats use Python's shortest-round-trip repr, which is the same
    string JavaScript's JSON.stringify produces — so a browser and this script
    agree on the bytes, which matters because the player reads these files."""
    return json.dumps(_strip(obj), sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False).encode("utf-8")


def sign_obj(obj, secret):
    msg = canon(obj)
    sig = _fast_sign(secret, msg) or raw_sign(secret, msg)
    return enc(sig)


def verify_obj(obj, public_text, sig_text=None):
    sig_text = sig_text or obj.get("sig")
    if not sig_text:
        return False
    try:
        return raw_verify(dec(public_text, length=32), canon(obj), dec(sig_text, length=64))
    except (ValueError, TypeError):
        return False


# ------------------------------------------------------------------ key files

def write_keypair(out_prefix, name=""):
    """Writes <prefix>.key (secret, 0600) and <prefix>.pub. Never overwrites."""
    out = Path(out_prefix)
    secret_path, public_path = out.with_suffix(".key"), out.with_suffix(".pub")
    for p in (secret_path, public_path):
        if p.exists():
            raise SystemExit(f"refusing to overwrite {p} — a lost key cannot be regenerated")
    out.parent.mkdir(parents=True, exist_ok=True)
    secret = os.urandom(32)
    public = enc(public_from_secret(secret))
    label = name or out.name
    secret_path.write_text(
        f"# SECRET signing key for {label} — never commit this file\n"
        f"ed25519-secret:{base64.b64encode(secret).decode('ascii')}\n")
    os.chmod(secret_path, stat.S_IRUSR | stat.S_IWUSR)
    public_path.write_text(f"# public key for {label} · id {keyid(public)}\n{public}\n")
    return public, secret_path, public_path


def read_secret(path):
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line.startswith("ed25519-secret:"):
            return dec(line, kind="ed25519-secret", length=32)
    raise SystemExit(f"{path} holds no ed25519-secret: line")


def read_public(path):
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if line.startswith("ed25519:"):
            return line
    raise SystemExit(f"{path} holds no ed25519: line")


# Keys whose secret half is public knowledge, and can therefore never mean
# anything. The demo key is committed on purpose — it is what makes the example
# remix in this repo verify out of the box, and what the test suite signs with.
# Precisely because it is convenient, it is the thing most likely to be left in
# a real deployment by accident, so the tools name it out loud every time they
# see it rather than trusting anyone to remember.
BURNED = {
    "ed25519:S1w2ori4x0g7wuL5OnOFkyry9Ti457N5/H4rrJiYsCU=":
        "the demo key — its secret is committed at tests/fixtures/demo-label.key, "
        "so anyone can forge its signatures",
}


def load_trust(path="TRUST"):
    """TRUST maps keys to who they are. Format, one per line:

        ed25519:<b64>  <name>   [# free-text note]

    Blank lines and #-comments ignored. The whole trust model of the label is
    this file plus git blame: a key is trusted because a human merged the pull
    request that added it, and that decision is in the history forever."""
    trust = {}
    p = Path(path)
    if not p.exists():
        return trust
    for n, line in enumerate(p.read_text().splitlines(), 1):
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split(None, 1)
        if not parts[0].startswith("ed25519:"):
            raise SystemExit(f"{path}:{n}: expected an ed25519: key, got {parts[0]!r:.30}")
        trust[parts[0]] = parts[1].strip() if len(parts) > 1 else "(unnamed)"
    return trust


# ------------------------------------------------------------------ selftest

_RFC8032_1 = dict(  # RFC 8032 §7.1, TEST 1 — the empty message
    secret="9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
    public="d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    msg="",
    sig="e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a"
        "33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b")


def selftest(verbose=True):
    ok = True

    def check(name, cond):
        nonlocal ok
        ok = ok and bool(cond)
        if verbose:
            print(f"  {'ok  ' if cond else 'FAIL'}  {name}")

    v = _RFC8032_1
    secret, msg = bytes.fromhex(v["secret"]), bytes.fromhex(v["msg"])
    check("RFC 8032 test 1 · public key", public_from_secret(secret).hex() == v["public"])
    check("RFC 8032 test 1 · signature", raw_sign(secret, msg).hex() == v["sig"])
    check("RFC 8032 test 1 · verify", raw_verify(bytes.fromhex(v["public"]), msg,
                                                 bytes.fromhex(v["sig"])))

    s2 = hashlib.sha256(b"aethra selftest").digest()
    p2, m2 = public_from_secret(s2), b"the score, not the sound"
    sg = raw_sign(s2, m2)
    check("round trip", raw_verify(p2, m2, sg))
    check("tampered message rejected", not raw_verify(p2, m2 + b"!", sg))
    check("tampered signature rejected",
          not raw_verify(p2, m2, sg[:63] + bytes([sg[63] ^ 1])))
    check("wrong key rejected", not raw_verify(public_from_secret(b"\x01" * 32), m2, sg))
    check("non-canonical S rejected", not raw_verify(p2, m2, sg[:32] + b"\xff" * 32))

    obj = {"b": 2, "a": [1, {"z": "é", "y": 0.1}], "sig": "ed25519:GARBAGE"}
    check("canon sorts keys and drops sig",
          canon(obj) == '{"a":[1,{"y":0.1,"z":"é"}],"b":2}'.encode("utf-8"))
    signed = dict(obj)
    signed["sig"] = sign_obj(signed, s2)
    check("object signature verifies", verify_obj(signed, enc(p2)))
    reformatted = json.loads(json.dumps(signed, indent=4))
    check("survives reformatting", verify_obj(reformatted, enc(p2)))
    check("mutation breaks the signature", not verify_obj(dict(signed, b=3), enc(p2)))
    check("keyid is stable", len(keyid(enc(p2))) == 16)

    if _accel():  # cross-check against a real implementation, when one works
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
        try:
            Ed25519PublicKey.from_public_bytes(p2).verify(sg, m2)
            check("agrees with `cryptography`", True)
        except Exception:
            check("agrees with `cryptography`", False)
    elif verbose:
        print("  skip  agrees with `cryptography` (not usable here)")

    return ok


# ------------------------------------------------------------------ CLI

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("keygen", help="make a new signing keypair")
    g.add_argument("--out", required=True, help="path prefix; writes .key and .pub")
    g.add_argument("--name", default="", help="human name recorded in the files")

    s = sub.add_parser("sign", help="sign a JSON document in place")
    s.add_argument("file")
    s.add_argument("--key", required=True, help="path to a .key secret file")

    v = sub.add_parser("verify", help="verify a signed JSON document")
    v.add_argument("file")
    v.add_argument("--key", help="ed25519:... or a path to a .pub")
    v.add_argument("--trust", default="TRUST")

    sub.add_parser("selftest", help="RFC 8032 vectors and canonicalisation")
    a = ap.parse_args(argv)

    if a.cmd == "keygen":
        public, sk, pk = write_keypair(a.out, a.name)
        print(f"{public}\n  id      {keyid(public)}\n  secret  {sk}  (0600 — never commit)"
              f"\n  public  {pk}\n\nAdd this line to TRUST to make the label accept it:\n"
              f"  {public}  {a.name or Path(a.out).name}")
        return 0

    if a.cmd == "selftest":
        print("signing.py selftest")
        ok = selftest()
        print("\n" + ("all good" if ok else "FAILURES — do not ship"))
        return 0 if ok else 1

    doc = json.loads(Path(a.file).read_text())

    if a.cmd == "sign":
        secret = read_secret(a.key)
        doc["sig"] = sign_obj(doc, secret)
        signer = enc(public_from_secret(secret))
        Path(a.file).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        print(f"signed {a.file}\n  by {signer}  (id {keyid(signer)})")
        return 0

    if a.cmd == "verify":
        keys = {}
        if a.key:
            k = read_public(a.key) if Path(a.key).exists() else a.key
            keys[k] = "(given on the command line)"
        else:
            keys = load_trust(a.trust)
            who = doc.get("issuer") or (doc.get("author") or {}).get("key")
            if who and who not in keys:
                print(f"note: document names {who} ({keyid(who)}), which TRUST does not list")
        for k, who in keys.items():
            if verify_obj(doc, k):
                print(f"OK — signed by {who}  {keyid(k)}")
                return 0
        print("BAD — no trusted key verifies this document")
        return 1


if __name__ == "__main__":
    sys.exit(main())
