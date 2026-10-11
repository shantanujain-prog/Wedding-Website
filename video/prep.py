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
    "shaadi": (208, 102, 692, 835),
}


# Couple close-ups for the floating photo frames in the Save the Date scene,
# cut from the clean plates,
# in pixels of a 900x1600 frame (left, top, right, bottom), 5:6 portrait.
CROPS = {
    "mehndi": (70, 690, 670, 1410),
    "dev-darshan": (0, 680, 600, 1400),
    "sangeet": (170, 740, 770, 1460),
    "reception": (90, 770, 690, 1490),
    "shaadi": (120, 780, 760, 1548),
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


# ---------- the opening doors ----------
# The closed-door panel of the supplied triptych (doors-triptych.jpg, three
# 509x1024 panels). Coordinates below are measured on the panel enlarged 2x.
DOOR_PANEL = (0, 0, 509, 1024)
DOOR_W = 1080  # output width; the height follows the panel
# arch of the door opening, from the apex down to the left jamb (mirrored for the right)
DOOR_ARCH = [(512, 228), (450, 244), (380, 266), (300, 298), (232, 336), (180, 374), (156, 404), (150, 420)]
DOOR_MIRROR_X, DOOR_LEFT_X, DOOR_RIGHT_X, DOOR_SEAM_X, DOOR_BOTTOM = 518, 150, 886, 512, 1695
# brass bells hanging in front of the doors, traced in OUTPUT pixels (1080-wide panel):
# chain top (the pivot), chain width, and the bell's outline including its clapper
BELLS = [
    {"id": "inner-left", "pivot": (346, 110), "chain": 8, "body": [
        (343, 327), (353, 327), (358, 338), (363, 352), (366, 370), (372, 382), (386, 392), (380, 398), (353, 400), (353, 423),
        (341, 423), (341, 400), (316, 398), (311, 392), (324, 382), (330, 370), (333, 352), (338, 338)]},
    {"id": "inner-right", "pivot": (745, 110), "chain": 8, "body": [
        (741, 336), (751, 336), (755, 346), (758, 360), (760, 378), (766, 386), (786, 394), (782, 401), (751, 402), (751, 423),
        (740, 423), (740, 402), (714, 401), (711, 394), (728, 386), (733, 378), (735, 360), (737, 346)]},
    {"id": "outer-left", "pivot": (160, 134), "chain": 11, "body": [
        (147, 520), (163, 520), (171, 528), (180, 540), (184, 560), (186, 585), (196, 597), (210, 607), (206, 616), (163, 620),
        (163, 643), (148, 643), (148, 620), (104, 616), (100, 607), (112, 597), (124, 585), (126, 560), (130, 540), (139, 528)]},
    {"id": "outer-right", "pivot": (934, 134), "chain": 11, "body": [
        (926, 512), (942, 512), (950, 522), (958, 535), (962, 560), (964, 585), (976, 596), (992, 606), (988, 616), (942, 620),
        (942, 642), (925, 642), (925, 620), (882, 616), (878, 606), (892, 596), (906, 585), (908, 560), (912, 535), (918, 522)]},
]
DOOR_LAMPS = [(90, 1428, 220, 1700), (804, 1428, 950, 1700)]  # oil lamps in front of the door corners
DOOR_PLANTS = (0, 840, 1024, 1335)  # rows where banana leaves overlap the door edges


def doors(debug):
    src = Image.open(os.path.join(INV, "doors-triptych.jpg")).convert("RGB").crop(DOOR_PANEL)
    S = DOOR_W / src.size[0]
    H = round(src.size[1] * S)
    big = src.resize((DOOR_W, H), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 70, 2))
    k = S / 2  # 2x-grid coordinates -> output pixels
    P = lambda pts: [(x * k, y * k) for x, y in pts]
    arr = np.asarray(big).astype(np.float64)
    R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]
    lum = 0.299 * R + 0.587 * G + 0.114 * B

    def poly_mask(pts):
        m = Image.new("L", (DOOR_W, H), 0)
        ImageDraw.Draw(m).polygon(P(pts), fill=255)
        return np.asarray(m) > 0

    apex = DOOR_ARCH[0]
    arch_r = [(2 * DOOR_MIRROR_X - x, y) for x, y in DOOR_ARCH[1:]]
    arch_l_up = list(reversed(DOOR_ARCH[1:]))
    left_leaf = poly_mask([apex, (DOOR_SEAM_X, DOOR_BOTTOM), (DOOR_LEFT_X, DOOR_BOTTOM)] + arch_l_up)
    right_leaf = poly_mask([apex] + arch_r + [(DOOR_RIGHT_X, DOOR_BOTTOM), (DOOR_SEAM_X, DOOR_BOTTOM)])
    door = left_leaf | right_leaf

    # things in front of the doors stay in the front layer: banana leaves (green) and the lamps (bright brass)
    yy = np.arange(H)[:, None] * np.ones((1, DOOR_W))
    xx = np.ones((H, 1)) * np.arange(DOOR_W)[None, :]
    band = (yy >= DOOR_PLANTS[1] * k) & (yy <= DOOR_PLANTS[3] * k)
    plants = band & (G > R - 4) & (G > B + 18) & (G > 40)
    lamps = np.zeros_like(plants)
    for l, t, r, b in DOOR_LAMPS:
        inbox = (xx >= l * k) & (xx <= r * k) & (yy >= t * k) & (yy <= b * k)
        lamps |= inbox & (lum > 118)
    fg = Image.fromarray(((plants | lamps) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(3))
    fg = np.asarray(fg) > 0

    # bells: traced outline plus a straight chain up to the pivot
    bells_meta, bell_any = [], np.zeros((H, DOOR_W), bool)
    sprites = []
    for bl in BELLS:
        px, py = bl["pivot"]
        body = bl["body"]
        top = min(y for _, y in body)
        cx = sum(x for x, _ in body) / len(body)
        m = Image.new("L", (DOOR_W, H), 0)
        d = ImageDraw.Draw(m)
        d.polygon(body, fill=255)
        hw = bl["chain"] / 2
        d.polygon([(px - hw, py), (px + hw, py), (cx + hw, top + 3), (cx - hw, top + 3)], fill=255)
        bm = np.asarray(m) > 0
        bell_any |= bm
        alpha = m.filter(ImageFilter.GaussianBlur(0.9))
        xs = [x for x, _ in body] + [px - hw, px + hw]
        bx0, by0 = int(min(xs)) - 3, int(py) - 3
        bx1, by1 = int(max(xs)) + 4, int(max(y for _, y in body)) + 4
        sprites.append((bl["id"], bx0, by0, bx1, by1, alpha))
        bells_meta.append({"id": bl["id"], "x": bx0, "y": by0, "w": bx1 - bx0, "h": by1 - by0,
                           "px": round(px - bx0, 1), "py": round(py - by0, 1)})

    # clean picture without the bells (they swing as separate sprites)
    hole = np.asarray(Image.fromarray((bell_any * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    filled = push_pull(arr, (~hole).astype(np.float64))
    clean = arr.copy()
    clean[hole] = filled[hole]
    clean_img = Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8))
    soft = clean_img.filter(ImageFilter.GaussianBlur(3))
    clean_img = Image.composite(soft, clean_img, Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)))

    out_dir = os.path.join(OUT, "doors")
    os.makedirs(out_dir, exist_ok=True)
    for bid, x0, y0, x1, y1, alpha in sprites:
        spr = big.convert("RGBA").crop((x0, y0, x1, y1))
        spr.putalpha(alpha.crop((x0, y0, x1, y1)))
        spr.save(os.path.join(out_dir, "bell-" + bid + ".webp"), quality=95)

    leaves = {}
    for name, lm in (("left", left_leaf), ("right", right_leaf)):
        mask = lm & ~fg
        ys, xs = np.where(lm)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        a = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
        leaf = clean_img.convert("RGBA")
        leaf.putalpha(a)
        leaf.crop((x0, y0, x1, y1)).save(os.path.join(out_dir, "leaf-" + name + ".webp"), quality=92)
        leaves[name] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}

    # the front layer: everything except the two leaves
    front_alpha = Image.fromarray((~(door & ~fg) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    front = clean_img.convert("RGBA")
    front.putalpha(front_alpha)
    front.save(os.path.join(out_dir, "frame.webp"), quality=92)

    ys, xs = np.where(door)
    meta = {"size": [DOOR_W, H], "leaves": leaves, "bells": bells_meta,
            "doorway": [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]}
    with open(os.path.join(out_dir, "doors.json"), "w") as f:
        json.dump(meta, f, indent=1)
    if debug:
        dbg = big.copy().convert("RGB")
        ov = np.asarray(dbg).astype(np.float64)
        ov[left_leaf & ~fg] = ov[left_leaf & ~fg] * 0.5 + np.array([255, 0, 0]) * 0.5
        ov[right_leaf & ~fg] = ov[right_leaf & ~fg] * 0.5 + np.array([0, 0, 255]) * 0.5
        ov[bell_any] = ov[bell_any] * 0.3 + np.array([0, 255, 0]) * 0.7
        ov[fg & door] = ov[fg & door] * 0.3 + np.array([255, 255, 0]) * 0.7
        Image.fromarray(ov.astype(np.uint8)).save(os.path.join(out_dir, "debug.jpg"), quality=85)
    print("doors", (DOOR_W, H), "doorway", meta["doorway"], "bells", len(bells_meta))


def logo():
    """Key the black background out of the monogram (alpha from the brightest channel)."""
    im = np.asarray(Image.open(os.path.join(HERE, "assets", "brand", "logo-original.jpg")).convert("RGB")).astype(np.float64)
    m = im.max(axis=2)
    a = np.clip((m - 8) / 52, 0, 1)
    a = a * a * (3 - 2 * a)
    rgb = np.clip(im / np.maximum(a[..., None], 1e-3), 0, 255)
    rgb[a < 0.004] = 0
    out = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), "RGBA")
    ys, xs = np.where(a > 0.02)
    out = out.crop((max(0, xs.min() - 12), max(0, ys.min() - 12), xs.max() + 12, ys.max() + 12))
    out.save(os.path.join(HERE, "assets", "brand", "logo.webp"), quality=94)
    print("logo", out.size)


def main():
    debug = "--debug" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    doors(debug)
    logo()
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
