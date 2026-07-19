#!/usr/bin/env python3
"""Pipeline tests — §10 acceptance items 2 and the fingerprint behaviour.

Runs with no network and no ffmpeg: the synthetic "MP3s" are RIFF/WAVE
payloads (decode dispatch is by content magic), which exercises every gate
identically to real encodes.

  python3 -m pytest tests/test_pipeline.py -q     (or)
  python3 tests/test_pipeline.py
"""

import hashlib
import json
import os
import shutil
import struct
import sys
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np

import fingerprint as fp
import features as ft
import make_catalog as mc


# ---------------------------------------------------------------- synth

def write_wav(path, samples, sr=44100):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(samples, -1, 1)
    pcm = (x * 32767).astype("<i2").tobytes()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm)


def synth_track(seed, dur=14.0, sr=44100, bpm=120.0):
    """A distinctive little techno-ish loop: kick pattern + seeded melody."""
    rng = np.random.default_rng(seed)
    n = int(dur * sr)
    t = np.arange(n) / sr
    x = np.zeros(n)
    # seeded melody of sine notes; note changes land on the beat grid so the
    # melody reinforces the tempo instead of fighting it
    seg = int((60.0 / bpm) * 2 * sr) if bpm > 0 else n // 16
    n_notes = max(1, n // seg + 1)
    notes = 200 + rng.integers(0, 14, size=n_notes) * 55.0
    for i, f0 in enumerate(notes):
        s = slice(i * seg, min((i + 1) * seg, n))
        x[s] += 0.35 * np.sin(2 * np.pi * f0 * t[s] + rng.uniform(0, np.pi))
        x[s] += 0.15 * np.sin(2 * np.pi * f0 * 2.01 * t[s])
    if bpm > 0:
        beat = 60.0 / bpm
        for b in np.arange(0, dur, beat):
            i0 = int(b * sr)
            env = np.exp(-np.arange(min(int(0.09 * sr), n - i0)) / (0.014 * sr))
            x[i0:i0 + len(env)] += 0.9 * env * np.sin(
                2 * np.pi * 90 * np.exp(-np.arange(len(env)) / (0.03 * sr))
                * np.arange(len(env)) / sr)
    # a seeded broadband bed (filtered noise) — real music is not a line
    # spectrum, and the fingerprint's band bits need energy to carry signal
    bed = rng.standard_normal(n)
    kernel = np.exp(-np.arange(64) / 12.0)
    bed = np.convolve(bed, kernel / kernel.sum(), mode="same")
    x += 0.12 * bed
    return 0.8 * x / (np.abs(x).max() + 1e-9)


class TmpRepo(unittest.TestCase):
    """Each test runs inside a throwaway repo-shaped directory."""

    def setUp(self):
        self.dir = Path(__file__).parent / f"_tmp_{self._testMethodName}"
        if self.dir.exists():
            shutil.rmtree(self.dir)
        self.dir.mkdir(parents=True)
        self._cwd = os.getcwd()
        os.chdir(self.dir)

    def tearDown(self):
        os.chdir(self._cwd)
        shutil.rmtree(self.dir, ignore_errors=True)

    def masters(self, layout):
        """layout: {album_folder: {filename: seed_or_samples}}"""
        for album, files in layout.items():
            for name, spec in files.items():
                samples = synth_track(spec) if isinstance(spec, int) else spec
                write_wav(Path("masters") / album / name, samples)

    def build(self, force=False):
        argv = ["masters", "--artist", "Aethra Kairos", "--label", "ERRERlabs",
                "--base", "audio"]
        if force:
            argv.append("--force")
        return mc.main(argv)

    def catalog(self):
        return json.loads(Path("docs/catalog.json").read_text())

    def flat(self, cat=None):
        cat = cat or self.catalog()
        return [(al["tag"], tr) for al in cat["albums"] for tr in al["tracks"]]


# ---------------------------------------------------------------- fingerprint

class TestFingerprint(unittest.TestCase):
    def test_self_is_zero(self):
        x = synth_track(1)
        a = fp.fingerprint(fp.resample_poly(x, 44100, fp.FP_SR))
        r = fp.compare(a, a)
        self.assertEqual(r["window_ber"], 0.0)
        self.assertEqual(r["verdict"], "CLONE")

    def test_clone_with_offset_and_gain(self):
        x = synth_track(2)
        # 0.31 s of lead-in — deliberately a FRACTIONAL number of 23 ms hops,
        # the case the sub-hop alignment search exists for
        clone = np.concatenate([np.zeros(int(0.31 * 44100)), 0.7 * x])
        clone += 0.003 * np.random.default_rng(0).standard_normal(len(clone))
        a = fp.fingerprint_multi(fp.resample_poly(clone, 44100, fp.FP_SR))
        b = fp.fingerprint(fp.resample_poly(x, 44100, fp.FP_SR))
        r = fp.compare_best(a, b)
        self.assertEqual(r["verdict"], "CLONE", r)

    def test_unrelated_reads_unrelated(self):
        a = fp.fingerprint(fp.resample_poly(synth_track(3), 44100, fp.FP_SR))
        b = fp.fingerprint(fp.resample_poly(synth_track(99), 44100, fp.FP_SR))
        r = fp.compare(a, b)
        self.assertEqual(r["verdict"], "UNRELATED", r)


# ---------------------------------------------------------------- features

class TestFeatures(unittest.TestCase):
    def test_beatless_reads_bpm_zero(self):
        pad = 0.2 * np.sin(2 * np.pi * 110 * np.arange(12 * 44100) / 44100)
        pad *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * np.arange(len(pad)) / 44100)
        p = Path(__file__).parent / "_tmp_pad.wav"
        write_wav(p, pad)
        try:
            raw = ft.extract(p)
            self.assertEqual(raw["bpm"], 0.0)
        finally:
            p.unlink()

    def test_beat_material_reads_tempo(self):
        p = Path(__file__).parent / "_tmp_beat.wav"
        write_wav(p, synth_track(5, dur=16.0, bpm=124.0))
        try:
            raw = ft.extract(p)
            self.assertGreater(raw["bpm"], 0.0)
            # fold-equivalence: accept 124 or an octave of it inside 70–180
            ratio = raw["bpm"] / 124.0
            self.assertTrue(any(abs(ratio - r) < 0.08 for r in (0.5, 1.0, 2.0)),
                            f"bpm {raw['bpm']}")
        finally:
            p.unlink()

    def test_normalization_spans_catalog(self):
        raws = [{"lufs": -20 + i, "dynamics": 5, "centroid": 500 * (i + 1),
                 "entropy": 0.5, "onset_rate": i, "bpm": 0} for i in range(5)]
        normd = ft.normalize_catalog(raws)
        self.assertLess(normd[0]["energy"], normd[-1]["energy"])
        self.assertLess(normd[0]["brightness"], normd[-1]["brightness"])
        self.assertTrue(all(0 <= f["energy"] <= 1 for f in normd))


# ---------------------------------------------------------------- mix analysis

def synth_beat_track(bpm, dur=20.0, sr=44100, offset=0.5, key_pcs=None):
    """A four-on-the-floor click/kick track with a known grid, plus an
    optional sustained chord (pitch classes) for key detection."""
    n = int(dur * sr)
    t = np.arange(n) / sr
    x = np.zeros(n)
    spb = 60.0 / bpm
    beat = 0
    tt = offset
    while tt < dur - 0.1:
        i0 = int(tt * sr)
        ln = min(int(0.1 * sr), n - i0)
        env = np.exp(-np.arange(ln) / (0.012 * sr))
        x[i0:i0 + ln] += (1.0 if beat % 4 == 0 else 0.55) * env * np.sin(
            2 * np.pi * 70 * np.arange(ln) / sr)
        # a hat on the beat keeps the onset envelope honest up high
        x[i0:i0 + ln // 4] += 0.2 * env[:ln // 4] * np.random.default_rng(beat).standard_normal(ln // 4)
        tt += spb
        beat += 1
    if key_pcs:
        for pc in key_pcs:
            f0 = 220.0 * 2 ** (pc / 12)
            x += 0.12 * np.sin(2 * np.pi * f0 * t)
            x += 0.05 * np.sin(2 * np.pi * f0 * 2 * t)
    return 0.85 * x / (np.abs(x).max() + 1e-9)


class TestMixAnalysis(unittest.TestCase):
    def _mix(self, samples):
        p = Path(__file__).parent / "_tmp_mix.wav"
        write_wav(p, samples)
        try:
            return ft.extract(p)["mix"]
        finally:
            p.unlink()

    def test_beat_grid_bpm_and_offset(self):
        for bpm in (124.0, 128.0, 140.0):
            mix = self._mix(synth_beat_track(bpm, offset=0.5))
            self.assertGreater(mix["mixable"], 0.5, f"{bpm}: mixable {mix['mixable']}")
            self.assertLess(abs(mix["bpm"] - bpm) / bpm, 0.02,
                            f"{bpm}: read {mix['bpm']}")
            spb = 60.0 / bpm
            # grid must land on SOME beat of the true grid (phase-accurate)
            err = (mix["grid"] - 0.5) % spb
            err = min(err, spb - err)
            self.assertLess(err, 0.030, f"{bpm}: grid {mix['grid']} err {err * 1000:.0f} ms")

    def test_downbeat_prefers_the_accented_beat(self):
        mix = self._mix(synth_beat_track(126.0, offset=0.5))
        spb = 60.0 / 126.0
        bar = 4 * spb
        err = (mix["grid"] - 0.5) % bar
        err = min(err, bar - err)
        self.assertLess(err, 0.045, f"downbeat off by {err * 1000:.0f} ms")

    def test_key_detection_major_and_minor(self):
        # A minor: A C E → Camelot 8A. C major: C E G → 8B.
        a_minor = self._mix(synth_beat_track(124.0, key_pcs=[0, 3, 7]))     # A, C, E from A3
        self.assertEqual(a_minor["key"], "8A", a_minor)
        c_major = self._mix(synth_beat_track(124.0, key_pcs=[3, 7, 10]))    # C, E, G
        self.assertEqual(c_major["key"], "8B", c_major)

    def test_the_piano_rule_beatless_is_unmixable(self):
        t = np.arange(int(16 * 44100)) / 44100
        pad = 0.3 * np.sin(2 * np.pi * 220 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t))
        mix = self._mix(pad)
        self.assertLess(mix["mixable"], 0.5, mix)

    def test_the_score_band_envelopes(self):
        """env: four quantized voices at 4 Hz, sized to the track, with the
        kick landing in the bass voice and hits in the punch voice."""
        p = Path(__file__).parent / "_tmp_env.wav"
        write_wav(p, synth_beat_track(124.0))
        try:
            raw = ft.extract(p)
        finally:
            p.unlink()
        env = raw.get("env")
        self.assertIsInstance(env, dict)
        dur = raw["duration"]
        for k in ("b", "m", "t", "o"):
            self.assertIn(k, env)
            self.assertGreaterEqual(len(env[k]), int(dur * env["hz"]) - 2)
            self.assertTrue(all(c.isdigit() for c in env[k]))
        self.assertEqual(max(env["b"]), "9")      # the kick maxes the bass voice
        self.assertEqual(max(env["o"]), "9")      # and the punch voice sees hits

    def test_regions_sit_inside_the_track(self):
        mix = self._mix(synth_beat_track(128.0, dur=30.0))
        spb = 60.0 / mix["bpm"]
        self.assertGreaterEqual(mix["in"]["start"], 0)
        self.assertLessEqual(mix["out"]["start"] + mix["out"]["beats"] * spb, 30.5)
        self.assertEqual(mix["in"]["beats"] % 4, 0, "bar-aligned regions")


# ---------------------------------------------------------------- catalog build

class TestCatalogBuild(TmpRepo):
    def test_v2_with_mandatory_fields(self):
        self.masters({"Album One": {"01-alpha.mp3": 11, "02-beta.mp3": 12}})
        self.assertEqual(self.build(), 0)
        cat = self.catalog()
        self.assertEqual(cat["version"], 2)
        self.assertIn("license", cat)
        for _, tr in self.flat(cat):
            for field in ("duration", "sha256", "published", "features"):
                self.assertIn(field, tr)
            for k in ("bpm", "energy", "brightness", "entropy", "onsets"):
                self.assertIn(k, tr["features"])

    def test_noop_rerun_is_stable(self):
        self.masters({"Album One": {"01-alpha.mp3": 11}})
        self.build()
        first = Path("docs/catalog.json").read_text()
        self.build()
        self.assertEqual(first, Path("docs/catalog.json").read_text())

    def test_move_keeps_published_date(self):
        self.masters({"Album One": {"01-alpha.mp3": 11}})
        self.build()
        (_, tr) = self.flat()[0]
        published = tr["published"]
        # stamp an old date to prove the move preserves it
        cat = self.catalog()
        cat["albums"][0]["tracks"][0]["published"] = "2020-01-01"
        Path("docs/catalog.json").write_text(json.dumps(cat))
        shutil.move("masters/Album One", "masters/Album Two")
        self.build()
        cat = self.catalog()
        self.assertEqual(len(self.flat(cat)), 1)
        tag, tr = self.flat(cat)[0]
        self.assertEqual(tag, "album-two")
        self.assertEqual(tr["published"], "2020-01-01")
        self.assertTrue(Path("docs/audio/album-two", tr["file"]).exists())

    def test_duplicate_hash_impossible(self):
        x = synth_track(21)
        self.masters({"A": {"01-one.mp3": x}, "B": {"01-one-again.mp3": x}})
        self.build()
        shas = [tr["sha256"] for _, tr in self.flat()]
        self.assertEqual(len(shas), len(set(shas)))
        self.assertEqual(len(shas), 1)

    def test_clone_refused_then_forced_with_stamp(self):
        x = synth_track(31)
        self.masters({"A": {"01-original.mp3": x}})
        self.build()
        # a different-hash re-encode-alike: gain change + noise + offset
        clone = np.concatenate([np.zeros(int(0.2 * 44100)), 0.7 * x])
        clone += 0.002 * np.random.default_rng(1).standard_normal(len(clone))
        write_wav("masters/B/01-sneaky.mp3", clone)
        self.build()
        cat = self.catalog()
        files = [tr["file"] for _, tr in self.flat(cat)]
        self.assertNotIn("01-sneaky.mp3", files, "clone must be refused")
        self.build(force=True)
        cat = self.catalog()
        sneaky = [tr for _, tr in self.flat(cat) if "sneaky" in tr["file"]]
        self.assertEqual(len(sneaky), 1)
        self.assertIn("fingerprint_override", sneaky[0])
        self.assertIn("matched", sneaky[0]["fingerprint_override"])

    def test_features_cache_hit_on_rerun(self):
        self.masters({"A": {"01-x.mp3": 41}})
        self.build()
        calls = []
        orig = ft.extract
        ft.extract = lambda p: calls.append(p) or orig(p)
        try:
            self.build()
        finally:
            ft.extract = orig
        self.assertEqual(calls, [], "re-run must recompute nothing")

    def test_wav_in_audio_fails_build(self):
        self.masters({"A": {"01-x.mp3": 51}})
        self.build()
        write_wav("docs/audio/a/leaked-master.wav", synth_track(52))
        with self.assertRaises(SystemExit):
            self.build()


class TestCatalogMix(TmpRepo):
    def test_tracks_carry_mix_blocks(self):
        self.masters({"A": {"01-x.mp3": synth_beat_track(126.0), "02-y.mp3": 12}})
        self.build()
        for _, tr in self.flat():
            self.assertIn("mix", tr)
            self.assertIn("mixable", tr["mix"])
        beaty = [tr for _, tr in self.flat() if "01-x" in tr["file"]][0]
        self.assertGreater(beaty["mix"]["mixable"], 0.5)
        self.assertLess(abs(beaty["mix"]["bpm"] - 126.0) / 126.0, 0.02)

    def test_mixfix_grid_delta_and_pairs_graduate_to_canon(self):
        self.masters({"A": {"01-x.mp3": synth_beat_track(124.0)}})
        self.build()
        tag, tr = self.flat()[0]
        sha, grid0 = tr["sha256"], tr["mix"]["grid"]
        Path("mixfix.json").write_text(json.dumps({
            "grids": {sha: 0.02},
            "pairs": {f"{sha}|deadbeef": {"type": "fade"}},
        }))
        self.build()
        tag, tr = self.flat()[0]
        self.assertAlmostEqual(tr["mix"]["grid"], round(grid0 + 0.02, 3), places=3)
        self.assertTrue(tr["mix"].get("gridFixed"))
        cat = self.catalog()
        self.assertIn(f"{sha}|deadbeef", cat["mixfix"]["pairs"])

    def test_cache_upgrade_adds_mix_without_refeaturing(self):
        self.masters({"A": {"01-x.mp3": synth_beat_track(124.0)}})
        self.build()
        # simulate a pre-mix-engine cache: strip mix from the cached raw
        cache = json.loads(Path("features-cache.json").read_text())
        for k in cache["by_sha"]:
            cache["by_sha"][k].pop("mix", None)
        Path("features-cache.json").write_text(json.dumps(cache))
        calls = []
        orig = ft.extract
        ft.extract = lambda p: calls.append(p) or orig(p)
        try:
            self.build()
        finally:
            ft.extract = orig
        self.assertEqual(calls, [], "full re-extraction must not happen")
        _, tr = self.flat()[0]
        self.assertIn("bpm", tr["mix"], "mix block was upgraded in place")


# ---------------------------------------------------------------- doctor

class TestDoctor(TmpRepo):
    def seed(self):
        self.masters({"Album One": {"01-alpha.mp3": 61, "02-beta.mp3": 62}})
        write_wav("masters/Album One/cover_src.wav", synth_track(1, dur=1.0))
        # give the album explicit art so doctor's art check passes
        Path("masters/Album One/cover.png").write_bytes(
            b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)
        self.build()

    def doctor(self):
        return mc.main(["doctor", "--no-net"])

    def test_clean_pass(self):
        self.seed()
        self.assertEqual(self.doctor(), 0)

    def test_fails_on_missing_field(self):
        self.seed()
        cat = json.loads(Path("docs/catalog.json").read_text())
        del cat["albums"][0]["tracks"][0]["sha256"]
        Path("docs/catalog.json").write_text(json.dumps(cat))
        self.assertEqual(self.doctor(), 1)

    def test_fails_on_duplicate_hash(self):
        self.seed()
        cat = json.loads(Path("docs/catalog.json").read_text())
        trs = cat["albums"][0]["tracks"]
        trs[1]["sha256"] = trs[0]["sha256"]
        Path("docs/catalog.json").write_text(json.dumps(cat))
        self.assertEqual(self.doctor(), 1)

    def test_fails_on_master_in_tree(self):
        self.seed()
        write_wav("docs/audio/album-one/oops.wav", synth_track(1, dur=1.0))
        self.assertEqual(self.doctor(), 1)

    def test_fails_on_stale_fingerprint(self):
        self.seed()
        for f in Path("dna").rglob("*.fp"):
            f.unlink()
        self.assertEqual(self.doctor(), 1)

    def test_fails_on_missing_file(self):
        self.seed()
        cat = json.loads(Path("docs/catalog.json").read_text())
        first = Path("docs/audio/album-one") / cat["albums"][0]["tracks"][0]["file"]
        first.unlink()
        self.assertEqual(self.doctor(), 1)


class TestShippedCatalog(unittest.TestCase):
    """The catalog the repo actually ships (docs/catalog.json) must be a
    valid v2 album catalog whose hashes match the audio on disk — the
    label's word is checked, not assumed."""

    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parent.parent
        cls.cat = json.loads((cls.root / "docs/catalog.json").read_text("utf-8"))

    def test_schema_and_hashes(self):
        cat = self.cat
        self.assertEqual(cat["version"], 2)
        self.assertTrue(cat["albums"], "ships at least one record")
        base = self.root / "docs" / cat.get("base", "audio")
        for al in cat["albums"]:
            for k in ("title", "tag", "art", "tracks"):
                self.assertIn(k, al)
            self.assertTrue((base / al["tag"] / al["art"]).exists(),
                            al["tag"] + " cover art exists")
            for t in al["tracks"]:
                f = base / al["tag"] / t["file"]
                self.assertTrue(f.exists(), str(f))
                self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(),
                                 t["sha256"], t["title"] + " hash matches disk")
                self.assertGreater(t["mix"]["bpm"], 0)
                self.assertRegex(t["mix"]["key"], r"^\d{1,2}[AB]$")
                for k in ("energy", "brightness", "entropy", "onsets"):
                    self.assertIn(k, t["features"])

    def test_the_first_three_mix_together(self):
        # the whole point of shipping three: they are one harmonic family
        keys = set(); bpms = []
        for al in self.cat["albums"]:
            for t in al["tracks"]:
                keys.add(t["mix"]["key"]); bpms.append(t["mix"]["bpm"])
        self.assertEqual(len(keys), 1, "one key family: " + str(keys))
        self.assertLess(max(bpms) / min(bpms), 1.08, "inside the 8%% tempo gate")


if __name__ == "__main__":
    unittest.main(verbosity=2)
