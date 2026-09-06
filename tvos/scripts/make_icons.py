#!/usr/bin/env python3
"""Derive every tvOS brand asset from the one true mark.

The Apple TV wants a *layered* icon — parallax slabs the focus engine tilts —
plus a top-shelf banner and a launch image. Rather than invent a second brand,
this script slices docs/icons/icon-512.png (the luminous spiral) into depth
layers by its own luminance: the darkness stays at the back, the swirl floats
in the middle, the hot core rides in front. Run it once on any machine with
Pillow and the asset catalog is rebuilt byte-for-byte:

    python3 tvos/scripts/make_icons.py

Everything it writes is committed, so nobody needs to run it to build the app —
it exists so the assets are *derived*, never hand-painted drift.
"""

import json
import math
import os
import shutil

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(REPO, "docs", "icons", "icon-512.png")
XCASSETS = os.path.join(REPO, "tvos", "AethraKairosTV", "Assets.xcassets")
BRAND = os.path.join(XCASSETS, "App Icon & Top Shelf Image.brandassets")

INFO = {"author": "xcode", "version": 1}

# The palette sampled from the mark itself: deep space floor, steel-blue air.
FLOOR = (5, 7, 12)
CEIL = (13, 24, 36)


def contents(path, payload):
    os.makedirs(path, exist_ok=True)
    with open(os.path.join(path, "Contents.json"), "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")


def gradient(w, h):
    """The opaque back plate: a vertical deep-space gradient with a breath of
    vignette, so even the rear parallax layer has somewhere to stand."""
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = FLOOR[0] + (CEIL[0] - FLOOR[0]) * t
        g = FLOOR[1] + (CEIL[1] - FLOOR[1]) * t
        b = FLOOR[2] + (CEIL[2] - FLOOR[2]) * t
        for x in range(w):
            # gentle radial darkening toward the corners
            dx = (x / w - 0.5) * 2.0
            dy = (y / h - 0.5) * 2.0
            v = 1.0 - 0.28 * min(1.0, dx * dx + dy * dy)
            px[x, y] = (int(r * v), int(g * v), int(b * v))
    return im


def spiral_rgba():
    im = Image.open(SRC).convert("RGB")
    return im


def luminance_alpha(im, lo, hi, gamma=1.0):
    """Turn an RGB image into RGBA where alpha ramps from 0 at luminance `lo`
    to 255 at `hi` — the knife that slices the mark into depth layers."""
    gray = im.convert("L")
    lut = []
    for v in range(256):
        t = (v - lo) / max(1, hi - lo)
        t = min(1.0, max(0.0, t))
        lut.append(int(255 * (t ** gamma)))
    alpha = gray.point(lut)
    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out


def fit_center(im, w, h, scale=1.0):
    """Scale the (square) mark to cover a w×h canvas center-out, honouring an
    extra zoom, and return an RGBA canvas of exactly w×h."""
    side = int(max(w, h) * scale)
    scaled = im.resize((side, side), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(scaled, ((w - side) // 2, (h - side) // 2), scaled)
    return canvas


def compose_flat(w, h, zoom=1.15):
    """A single flattened rendition (top shelf, launch, App Store icon back)."""
    base = gradient(w, h).convert("RGBA")
    mark = spiral_rgba()
    mid = luminance_alpha(mark, 18, 200, gamma=0.9)
    base.alpha_composite(fit_center(mid, w, h, zoom))
    hot = luminance_alpha(mark, 150, 245, gamma=0.8)
    hot = hot.filter(ImageFilter.GaussianBlur(1.2))
    base.alpha_composite(fit_center(hot, w, h, zoom))
    return base.convert("RGB")


def layer_back(w, h):
    return gradient(w, h).convert("RGB")


def layer_middle(w, h):
    mark = spiral_rgba()
    mid = luminance_alpha(mark, 18, 210, gamma=1.0)
    mid = ImageEnhance.Brightness(mid).enhance(0.92)
    return fit_center(mid, w, h, 1.30)


def layer_front(w, h):
    mark = spiral_rgba()
    hot = luminance_alpha(mark, 160, 250, gamma=0.75)
    hot = hot.filter(ImageFilter.GaussianBlur(1.0))
    return fit_center(hot, w, h, 1.30)


def write_imageset(path, images, idiom="tv"):
    entries = []
    for filename, scale in images:
        entries.append({"filename": filename, "idiom": idiom, "scale": scale})
    contents(path, {"images": entries, "info": INFO})


def write_stack(path, size, scales):
    """One imagestack: Back / Middle / Front, each an imagestacklayer holding a
    Content.imageset at the given scales. `size` is the 1x (w, h)."""
    if os.path.isdir(path):
        shutil.rmtree(path)
    layers = ["Front", "Middle", "Back"]  # front first — that is stack order
    contents(path, {"layers": [{"filename": f"{n}.imagestacklayer"} for n in layers], "info": INFO})
    makers = {"Back": layer_back, "Middle": layer_middle, "Front": layer_front}
    for name in layers:
        lpath = os.path.join(path, f"{name}.imagestacklayer")
        contents(lpath, {"info": INFO})
        ipath = os.path.join(lpath, "Content.imageset")
        os.makedirs(ipath, exist_ok=True)
        files = []
        for scale in scales:
            n = int(scale[0])
            w, h = size[0] * n, size[1] * n
            img = makers[name](w, h)
            fname = f"{name.lower()}{'' if n == 1 else '@' + scale}.png"
            if img.mode == "RGBA" and name == "Back":
                img = img.convert("RGB")
            img.save(os.path.join(ipath, fname), optimize=True)
            files.append((fname, scale))
        write_imageset(ipath, files)


def write_flat_imageset(path, size, scales, zoom=1.15, stem="image"):
    if os.path.isdir(path):
        shutil.rmtree(path)
    files = []
    os.makedirs(path, exist_ok=True)
    for scale in scales:
        n = int(scale[0])
        w, h = size[0] * n, size[1] * n
        img = compose_flat(w, h, zoom)
        fname = f"{stem}{'' if n == 1 else '@' + scale}.png"
        img.save(os.path.join(path, fname), optimize=True)
        files.append((fname, scale))
    write_imageset(path, files)


def main():
    # ---- the brand assets folder --------------------------------------
    contents(XCASSETS, {"info": INFO})
    contents(
        BRAND,
        {
            "assets": [
                {"filename": "App Icon - App Store.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "1280x768"},
                {"filename": "App Icon.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "400x240"},
                {"filename": "Top Shelf Image Wide.imageset", "idiom": "tv", "role": "top-shelf-image-wide", "size": "2320x720"},
                {"filename": "Top Shelf Image.imageset", "idiom": "tv", "role": "top-shelf-image", "size": "1920x720"},
            ],
            "info": INFO,
        },
    )

    write_stack(os.path.join(BRAND, "App Icon.imagestack"), (400, 240), ["1x", "2x"])
    write_stack(os.path.join(BRAND, "App Icon - App Store.imagestack"), (1280, 768), ["1x"])
    write_flat_imageset(os.path.join(BRAND, "Top Shelf Image Wide.imageset"), (2320, 720), ["1x", "2x"], zoom=0.95, stem="shelf-wide")
    write_flat_imageset(os.path.join(BRAND, "Top Shelf Image.imageset"), (1920, 720), ["1x", "2x"], zoom=0.95, stem="shelf")

    print("tvOS brand assets rebuilt under", XCASSETS)


if __name__ == "__main__":
    main()
