#!/usr/bin/env python3
"""Cut the couple illustrations for the e-invite's event pages.

Each function's invitation artwork (video/assets/invites/) has a cream text card
printed in its upper half. The e-invite sets its own text, so this cuts the
couple from below the card, at full resolution for print. Where a crop reaches
into the card, only the card itself is erased (filled from its surroundings) and
the page fades the top of the picture into the paper anyway.

    python3 invite/prep_art.py        # writes invite/assets/art/<event>.jpg

Needs Pillow and numpy (reuses video/prep.py).
"""
import importlib.util
import os

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("prep", os.path.join(HERE, "..", "video", "prep.py"))
prep = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prep)

# crop windows in pixels of a 900x1600 frame (left, top, right, bottom), 4:5 portrait
CROPS = {
    "mehndi": (60, 700, 640, 1425),
    "dev-darshan": (0, 690, 580, 1415),
    "haldi": (150, 760, 750, 1510),
    "sangeet": (170, 750, 750, 1475),
    "reception": (80, 780, 680, 1530),
    "shaadi": (130, 800, 750, 1575),
}


# where the scenery behind a printed card is soft bokeh, a patch of it (900x1600 pixels) to fill the card's gap
BOKEH = {
    "dev-darshan": (455, 770, 560, 880),
}


def main():
    poly = prep.silhouette()
    out = os.path.join(HERE, "assets", "art")
    os.makedirs(out, exist_ok=True)
    for name, (l, t, r, b) in CROPS.items():
        src = Image.open(os.path.join(prep.INV, name + ".jpg")).convert("RGB")
        W, H = src.size
        sx, sy = W / 900, H / 1600
        cl, ct, cr, cb = prep.CARDS[name]
        box = (cl * sx, ct * sy, cr * sx, cb * sy)
        bw, bh = box[2] - box[0], box[3] - box[1]
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).polygon([(box[0] + x * bw, box[1] + y * bh) for x, y in prep.grow(poly, 1.03)], fill=255)
        hole = np.asarray(mask) > 0
        arr = np.asarray(src).astype(np.float64)
        # Behind the card the artwork is soft foliage and sky; take the fill colour from that, not
        # from the couple's dark hair just below the card (which would smear brown into the gap).
        lum = arr @ np.array([0.299, 0.587, 0.114])
        near = np.asarray(mask.filter(ImageFilter.MaxFilter(2 * round(30 * sx) + 1))) > 0
        known = ~hole & ~(near & (lum < 95))
        filled = prep.push_pull(arr, known.astype(np.float64))
        arr[hole] = filled[hole]
        if name in BOKEH:
            # out-of-focus scenery behind the card: stretch a sample of the real background over the
            # gap and blur it like the rest of the bokeh
            bl, bt, br, bb = [round(v * s) for v, s in zip(BOKEH[name], (sx, sy, sx, sy))]
            ys, xs = np.where(hole)
            hx0, hy0, hx1, hy1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
            sample = src.crop((bl, bt, br, bb)).resize((hx1 - hx0, hy1 - hy0), Image.BICUBIC).filter(ImageFilter.GaussianBlur(9 * sx))
            patch = np.asarray(sample).astype(np.float64)
            # blend from the surrounding colour (the push-pull fill) at the gap's edge to the bokeh inside it
            depth = np.zeros(hole.shape)
            m = mask
            for _ in range(8):
                m = m.filter(ImageFilter.MinFilter(5))
                depth += np.asarray(m) > 0
            w = np.clip(depth / 8, 0, 1)[hy0:hy1, hx0:hx1, None]
            region = arr[hy0:hy1, hx0:hx1]
            sel = hole[hy0:hy1, hx0:hx1]
            region[sel] = (region * (1 - w) + patch * w)[sel]
            arr[hy0:hy1, hx0:hx1] = region
        clean = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        soft = clean.filter(ImageFilter.GaussianBlur(10 * sx))
        # soften only inside the erased area, so the hair at its edge stays sharp
        inner = mask.filter(ImageFilter.MinFilter(2 * round(3 * sx) + 1)).filter(ImageFilter.GaussianBlur(3 * sx))
        clean = Image.composite(soft, clean, inner)
        crop = clean.crop((round(l * sx), round(t * sy), round(r * sx), round(b * sy)))
        crop.save(os.path.join(out, name + ".jpg"), quality=92)
        print(name, crop.size)


def band(src, box, fade, out_jpg, out_mask, quality=86):
    """A strip of a transparent picture for print: colour as JPEG, and a mask (its own transparency,
    faded at the top) that the page applies, so it blends into the paper's gradient."""
    im = Image.open(src).convert("RGBA").crop(box)
    w, h = im.size
    paper = Image.new("RGBA", (w, h), (0xF8, 0xE1, 0xC6, 255))
    paper.alpha_composite(im)
    paper.convert("RGB").save(out_jpg, quality=quality)
    # fade depth per column: `fade` may be a function of x (0..1) to fade deeper where the picture is busy
    fx = np.array([fade(x / w) if callable(fade) else fade for x in range(w)])
    ramp = np.clip(np.arange(h)[:, None] / (fx[None, :] * h), 0, 1)
    ramp = ramp * ramp * (3 - 2 * ramp)
    alpha = np.asarray(im)[..., 3].astype(np.float64) / 255 * ramp
    # CSS masks use the alpha channel: black, with the mask as its transparency
    a8 = (alpha * 255).astype(np.uint8)
    Image.fromarray(np.dstack([np.zeros_like(a8)] * 3 + [a8]), "RGBA").save(out_mask, optimize=True)


def medal(out, mm=(86, 92), dpi_px_per_mm=11.8):
    """The closing page's deep brown arch with the monogram, as one picture (the page rounds its top)."""
    w, h = round(mm[0] * dpi_px_per_mm), round(mm[1] * dpi_px_per_mm)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w * 0.5) / (w * 0.5)) ** 2 + ((yy - h * 0.4) / (h * 0.6)) ** 2)
    stops = [(0, (0x50, 0x21, 0x0D)), (0.6, (0x2E, 0x11, 0x07)), (1.0, (0x1A, 0x09, 0x04))]
    rgb = np.zeros((h, w, 3))
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        t = np.clip((d - a) / (b - a), 0, 1)[..., None]
        sel = ((d >= a) & (d <= b)) | ((d > 1) & (b == 1.0))
        rgb[sel] = (np.array(ca) * (1 - t) + np.array(cb) * t)[sel]
    base = Image.fromarray(rgb.astype(np.uint8)).convert("RGBA")
    logo = Image.open(os.path.join(HERE, "..", "video", "assets", "brand", "logo.webp")).convert("RGBA")
    lw = round(72 * dpi_px_per_mm)
    logo = logo.resize((lw, round(lw * logo.size[1] / logo.size[0])), Image.LANCZOS)
    base.alpha_composite(logo, (round(7 * dpi_px_per_mm), round(16 * dpi_px_per_mm)))
    base.convert("RGB").save(out, quality=90)


def pages_art():
    site = os.path.join(HERE, "..", "video", "assets", "site")
    a = os.path.join(HERE, "assets")
    # cover: the elephant with its raised trunk and the lotus pond
    # (shallow fade over the raised trunk near x = 0.57, deep over the trees at both sides)
    trunk = lambda x: 0.10 + 0.32 * min(1, (abs(x - 0.57) / 0.3) ** 2)
    band(os.path.join(site, "elephant-pond.webp"), (0, 760, 1515, 1440), trunk, os.path.join(a, "cover-art.jpg"), os.path.join(a, "cover-mask.png"))
    # closing: the chhatri garden
    band(os.path.join(site, "garden-chhatris.webp"), (0, 100, 1515, 649), 0.45, os.path.join(a, "closing-art.jpg"), os.path.join(a, "closing-mask.png"))
    medal(os.path.join(a, "medal.jpg"))
    print("cover-art, closing-art, medal")


if __name__ == "__main__":
    main()
    pages_art()
