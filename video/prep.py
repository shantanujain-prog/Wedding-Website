#!/usr/bin/env python3
"""Make "clean plates" of the invitation artworks for the Save the Date video.

Each invitation in assets/invites/ has a cream text card printed on it. Some of
the printed details differ from the final schedule (venue names, wording), so
the video draws its own card with the exact text. This script removes the
printed card: it masks the card's silhouette (slightly enlarged) and fills the
hole from the surrounding picture (push-pull diffusion, then a soft blur), so
nothing of the old text or frame can peek out from behind the new card.

It also writes assets/plates/cards.json with, per invitation, the card's box in
the picture (as fractions of width/height) and the silhouette polygon that the
video uses for its own card.

    python3 video/prep.py            # writes assets/plates/*.jpg + cards.json
    python3 video/prep.py --debug    # also writes *-debug.jpg overlays

Needs Pillow and numpy only.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
INV = os.path.join(HERE, "assets", "invites")
OUT = os.path.join(HERE, "assets", "plates")

# Printed card box in each picture, in pixels of a 900x1600 frame
# (left, top, right, bottom), measured on the supplied artworks.
CARDS = {
    "mehndi": (217, 77, 687, 737),
    "dev-darshan": (210, 100, 690, 790),
    "haldi": (210, 100, 690, 790),
    "sangeet": (210, 105, 690, 785),
    "reception": (210, 80, 683, 810),
}


# Couple close-ups for the floating photo frames in the Save the Date scene,
# cut from the clean plates,
# in pixels of a 900x1600 frame (left, top, right, bottom), 5:6 portrait.
CROPS = {
    "mehndi": (70, 690, 670, 1410),
    "dev-darshan": (0, 680, 600, 1400),
    "sangeet": (170, 740, 770, 1460),
    "reception": (90, 770, 690, 1490),
}


def bez(p0, p1, p2, p3, n=10):
    out = []
    for i in range(1, n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


def silhouette():
    """Ogee-arch card outline in a unit box, clockwise from the top point."""
    q = [(0.5, 0.0)]
    # top-right: finial shoulder, scallop, then a small notch into the side
    q += bez(q[-1], (0.56, 0.030), (0.66, 0.036), (0.75, 0.048))
    q += bez(q[-1], (0.85, 0.060), (0.93, 0.064), (0.955, 0.095))
    q += bez(q[-1], (0.965, 0.110), (1.0, 0.112), (1.0, 0.135))
    q.append((1.0, 0.865))
    # bottom-right: mirror of the top
    q += bez(q[-1], (1.0, 0.888), (0.965, 0.890), (0.955, 0.905))
    q += bez(q[-1], (0.93, 0.936), (0.85, 0.940), (0.75, 0.952))
    q += bez(q[-1], (0.66, 0.964), (0.56, 0.970), (0.5, 1.0))
    left = [(1 - x, y) for x, y in reversed(q[1:-1])]
    return q + left


def grow(poly, k):
    """Scale a unit-box polygon about its centre by k."""
    return [(0.5 + (x - 0.5) * k, 0.5 + (y - 0.5) * k) for x, y in poly]


def push_pull(img, known):
    """Fill pixels where known==0 from their surroundings (push-pull pyramid)."""
    levels = [(img * known[..., None], known.astype(np.float64))]
    while min(levels[-1][1].shape) > 4:
        c, w = levels[-1]
        h2, w2 = (c.shape[0] // 2) * 2, (c.shape[1] // 2) * 2
        c, w = c[:h2, :w2], w[:h2, :w2]
        cs = c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2]
        ws = w[0::2, 0::2] + w[1::2, 0::2] + w[0::2, 1::2] + w[1::2, 1::2]
        levels.append((cs, ws))
    c, w = levels[-1]
    filled = c / np.maximum(w, 1e-6)[..., None]
    for c, w in reversed(levels[:-1]):
        h, wd = w.shape
        up = np.asarray(Image.fromarray(filled.astype(np.float32)[..., 0]).resize((wd, h), Image.BILINEAR))
        ups = [np.asarray(Image.fromarray(filled.astype(np.float32)[..., k]).resize((wd, h), Image.BILINEAR))
               for k in range(3)]
        up = np.stack(ups, -1)
        a = np.clip(w, 0, 1)[..., None]
        own = c / np.maximum(w, 1e-6)[..., None]
        filled = a * own + (1 - a) * up
    return filled


def main():
    debug = "--debug" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    poly = silhouette()
    meta = {"silhouette": [[round(x, 4), round(y, 4)] for x, y in poly], "cards": {}}
    for name, (l, t, r, b) in CARDS.items():
        src = Image.open(os.path.join(INV, name + ".jpg")).convert("RGB")
        W, H = src.size
        sx, sy = W / 900, H / 1600
        box = (l * sx, t * sy, r * sx, b * sy)
        bw, bh = box[2] - box[0], box[3] - box[1]
        pts = [(box[0] + x * bw, box[1] + y * bh) for x, y in grow(poly, 1.05)]
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).polygon(pts, fill=255)
        hole = np.asarray(mask) > 0
        arr = np.asarray(src).astype(np.float64)
        filled = push_pull(arr, (~hole).astype(np.float64))
        out = arr.copy()
        out[hole] = filled[hole]
        plate = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
        # soften the filled area so it reads as depth-of-field, not a smear
        soft = plate.filter(ImageFilter.GaussianBlur(18 * sx))
        feather = mask.filter(ImageFilter.GaussianBlur(10 * sx))
        plate = Image.composite(soft, plate, feather)
        plate.save(os.path.join(OUT, name + ".jpg"), quality=93)
        meta["cards"][name] = {
            "size": [W, H],
            "box": [round(box[0] / W, 4), round(box[1] / H, 4), round(box[2] / W, 4), round(box[3] / H, 4)],
        }
        if debug:
            dbg = src.copy()
            d = ImageDraw.Draw(dbg)
            d.polygon([(box[0] + x * bw, box[1] + y * bh) for x, y in poly], outline=(255, 0, 255), width=3)
            d.polygon(pts, outline=(0, 255, 255), width=2)
            both = Image.new("RGB", (W * 2, H))
            both.paste(dbg, (0, 0))
            both.paste(plate, (W, 0))
            both.save(os.path.join(OUT, name + "-debug.jpg"), quality=80)
        print(name, (W, H), "card", [round(v) for v in box])
    for name, (l, t, r, b) in CROPS.items():
        # from the clean plate, so no part of the printed card shows
        src = Image.open(os.path.join(OUT, name + ".jpg")).convert("RGB")
        sx, sy = src.size[0] / 900, src.size[1] / 1600
        crop = src.crop((round(l * sx), round(t * sy), round(r * sx), round(b * sy))).resize((500, 600), Image.LANCZOS)
        crop.save(os.path.join(OUT, "couple-" + name + ".jpg"), quality=90)
    with open(os.path.join(OUT, "cards.json"), "w") as f:
        json.dump(meta, f, indent=1)


if __name__ == "__main__":
    main()
