import os
import numpy as np
from PIL import Image

# ============================== CONFIG ==============================

SIZE = 700              # canvas size in px (square)
SUPERSAMPLE = 4          # render at SIZE*this then box-downsample (antialiasing)
OUTER_RADIUS = 339.0     # wedge outer radius fallback if RINGS is empty
CENTER_GAP = 5.0        # empty px between the smallest ring and wedge start

# colors reused across RING_STOPS / WEDGES
WHITE = (255,255,255)
PALE_YELLOW = (255,255,153)
SKY_BLUE = (37,187,242)
AZURE = (29,156,212)
SCARLET = (220,12,40)
PURPLE = (113,48,159)
BERRY = (169,29,97)
VERMILION = (232,5,28)
PEACH = (255,200,100)

# hue legend shared by conic rings: angle(deg) -> RGB. Points are joined with
# a smooth curve (not straight lines), so you only need a point where the
# color actually changes direction -- long flat stretches (e.g. 280->350
# below) just need their two end angles, the curve stays flat between them.
# angles must be ascending and the list must start at 0 and end at 360 (same
# color = seamless wrap). optional 3rd element per stop is a bleed 0-1: how
# far its color holds flat into the adjacent gaps before transitioning.
RING_STOPS = [
    (0, AZURE),
    (10, SKY_BLUE),
    (80, WHITE),
    (100, BERRY),
    (115, SCARLET),
    (155, SCARLET),
    (195, BERRY),
    (250, WHITE),
    (359, AZURE),
]

# concentric conic-gradient rings. add/remove/edit entries freely.
#   radius        : px from canvas center
#   width         : ring thickness in px
#   rotate        : deg offset applied to the hue legend lookup (spins the ring)
#   tint          : 0=full color, 1=full white (blend toward white)
#   alpha         : 0-255 opacity
#   stops         : hue legend to use, defaults to RING_STOPS
#   color_source  : "stops" (default) uses RING_STOPS/stops, or "wedges" to
#                   derive the ring's color from the wedges' own edge colors
#                   -- matches the wedges where they meet the ring and
#                   interpolates smoothly across the gaps between them
RINGS = [
    dict(radius=40.0, width=8.0, rotate=20, tint=0.0, alpha=255),
    dict(radius=340.0, width=8.0, color_source="wedges", tint=0.0, alpha=235),
]

# pie-slice wedges: constant-angle spans with a radial gradient + hue skew.
#   a0/a1     : start/end angle in deg, ccw from +x axis
#   r0/r1     : radius range, defaults to (smallest ring's edge + CENTER_GAP,
#               OUTER_RADIUS) -- override per-wedge if needed
#   stops     : radial gradient control points, (r_frac 0-1, RGB[, bleed]).
#               smooth curve like RING_STOPS above -- must start at 0.0, end
#               at 1.0. optional bleed 0-1 holds a stop's color flat into its
#               neighboring gaps (see _bleed)
#   hue_skew  : deg of hue rotation applied across the wedge, a0->a1. keep the
#               sign consistent (don't cross 0) or the HSV hue wraps and
#               produces a stray color band
#   alpha     : 0-255 opacity
WEDGES = [
    dict(a0=123, a1=166, hue_skew=-40, alpha=255,
         stops=[
             (0.00, WHITE, 0.5),
             (0.43, PURPLE),
             (0.77, BERRY),
             (1.00, VERMILION)
             ]
    ),
    dict(a0=116, a1=118, hue_skew=-20, alpha=255,
         stops=[
             (0.00, WHITE, 0.5),
             (0.47, PURPLE, 0.05),
             (0.90, PEACH, 0.005),
             (1.00, PEACH)
             ]
    ),
    dict(a0=321, a1=336, hue_skew=-15, alpha=255,
         stops=[
             (0.00, WHITE, 0.5),
             (0.37, SKY_BLUE),
             (0.77, VERMILION),
             (1.00, SCARLET)
             ]
    ),
    dict(a0=311, a1=314, hue_skew=-22, alpha=255,
         stops=[
             (0.00, WHITE, 0.4),
             (0.37, SKY_BLUE),
             (0.87, PALE_YELLOW, 0.2),
             (1.00, PEACH)
             ]
    )
]

OUTPUT = "logo_generated.png"

# ============================== ENGINE ==============================

def _catmull_rom(t, ts, rgb):
    """evaluate a cubic (Catmull-Rom) spline through (ts, rgb) at t.
    ts/rgb must already include one ghost point past each end."""
    i = np.clip(np.searchsorted(ts, t, side="right") - 1, 1, len(ts) - 3)
    t0, t1, t2, t3 = ts[i - 1], ts[i], ts[i + 1], ts[i + 2]
    p0, p1, p2, p3 = rgb[i - 1], rgb[i], rgb[i + 1], rgb[i + 2]
    s = ((t - t1) / (t2 - t1))[..., None]
    m1 = (p2 - p0) / (t2 - t0)[..., None] * (t2 - t1)[..., None]
    m2 = (p3 - p1) / (t3 - t1)[..., None] * (t2 - t1)[..., None]
    h00, h10 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s
    h01, h11 = -2 * s**3 + 3 * s**2, s**3 - s**2
    return h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2


def _bleed(ts, rgb, bl):
    """expand each stop into flat-color anchors that hold its color across a
    `bleed` fraction (0-1) of the adjacent gaps before the transition starts.
    adjacent bleeds are scaled so a gap always keeps >=2% for the transition."""
    out_t, out_c = [], []
    n = len(ts)
    for i in range(n):
        if i > 0 and bl[i] > 0:
            g = ts[i] - ts[i - 1]
            s = bl[i - 1] + bl[i]
            f = min(1.0, 0.98 / s) if s > 0 else 1.0
            out_t.append(ts[i] - bl[i] * f * g); out_c.append(rgb[i])
        out_t.append(ts[i]); out_c.append(rgb[i])
        if i < n - 1 and bl[i] > 0:
            g = ts[i + 1] - ts[i]
            s = bl[i] + bl[i + 1]
            f = min(1.0, 0.98 / s) if s > 0 else 1.0
            out_t.append(ts[i] + bl[i] * f * g); out_c.append(rgb[i])
    return np.array(out_t), np.array(out_c)


def _lut(t, stops, periodic=False, period=360.0):
    """color at t, smoothly interpolated through `stops` (t, RGB[, bleed]).
    optional per-stop `bleed` (0-1) holds that stop's color flat across that
    fraction of each neighboring gap (see _bleed). periodic=True wraps around
    (angle rings); otherwise the ends clamp flat (radius-fraction wedges 0-1)."""
    ts = np.array([s[0] for s in stops], dtype=float)
    rgb = np.array([s[1] for s in stops], dtype=float)
    bl = np.array([s[2] if len(s) > 2 else 0.0 for s in stops], dtype=float)
    if periodic:
        ts = np.concatenate([ts[:-1] - period, ts, ts[1:] + period])
        rgb = np.concatenate([rgb[:-1], rgb, rgb[1:]])
        bl = np.concatenate([bl[:-1], bl, bl[1:]])
        ts, rgb = _bleed(ts, rgb, bl)
    else:
        ts, rgb = _bleed(ts, rgb, bl)
        ts = np.concatenate([[ts[0] - (ts[1] - ts[0])], ts, [ts[-1] + (ts[-1] - ts[-2])]])
        rgb = np.concatenate([rgb[:1], rgb, rgb[-1:]])
    return _catmull_rom(t, ts, rgb)


def _rgb_to_hsv(r, g, b):
    maxc, minc = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    delta = maxc - minc
    safe_delta = np.where(delta == 0, 1, delta)
    rc, gc, bc = (maxc - r) / safe_delta, (maxc - g) / safe_delta, (maxc - b) / safe_delta
    h = np.select([maxc == r, maxc == g], [bc - gc, 2.0 + rc - bc], default=4.0 + gc - rc)
    h = np.where(delta == 0, 0, (h / 6.0) % 1.0)
    s = np.where(maxc == 0, 0, delta / np.where(maxc == 0, 1, maxc))
    return h, s, maxc


def _hsv_to_rgb(h, s, v):
    i = (h * 6.0).astype(int) % 6
    f = h * 6.0 - np.floor(h * 6.0)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    conds = [i == k for k in range(6)]
    r = np.select(conds, [v, q, p, p, t, v])
    g = np.select(conds, [t, v, v, q, p, p])
    b = np.select(conds, [p, p, t, v, v, q])
    return r, g, b


def _hue_rotate(rgb, deg):
    h, s, v = _rgb_to_hsv(rgb[..., 0] / 255, rgb[..., 1] / 255, rgb[..., 2] / 255)
    r2, g2, b2 = _hsv_to_rgb((h + deg / 360.0) % 1.0, s, v)
    return np.stack([r2, g2, b2], axis=-1) * 255


def _wedge_ring_lut(theta_deg):
    """color at each angle = the touching wedge's own edge color, linearly
    interpolated across the gaps between wedges (wraps at 360)."""
    pts = []
    for w in WEDGES:
        base = np.array(w["stops"][-1][1], dtype=float)
        pts.append((w["a0"], base))
        pts.append((w["a1"], _hue_rotate(base, w.get("hue_skew", 0))))
    pts.sort(key=lambda p: p[0])

    angs = np.array([p[0] for p in pts])
    cols = np.array([p[1] for p in pts])
    angs = np.concatenate([angs - 360, angs, angs + 360])
    cols = np.concatenate([cols, cols, cols])
    return np.stack([np.interp(theta_deg, angs, cols[:, i]) for i in range(3)], axis=-1)


def _downsample(img, factor):
    """box downsample with premultiplied alpha (avoids dark/light edge fringing)."""
    if factor == 1:
        return img
    s = img.shape[0] // factor
    arr = img.astype(np.float32)
    premult = arr[..., :3] * (arr[..., 3:4] / 255.0)
    data = np.concatenate([premult, arr[..., 3:4]], axis=-1)
    data = data.reshape(s, factor, s, factor, 4).mean(axis=(1, 3))
    alpha = data[..., 3:4]
    rgb = np.where(alpha > 0, data[..., :3] / np.where(alpha == 0, 1, alpha / 255.0), 0)
    return np.clip(np.concatenate([rgb, alpha], axis=-1), 0, 255).astype(np.uint8)


def render():
    factor = SUPERSAMPLE
    n = SIZE * factor
    c = (SIZE - 1) / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(float)
    yy, xx = yy / factor, xx / factor
    dx, dy = xx - c, yy - c
    r = np.hypot(dx, dy)
    theta = np.degrees(np.arctan2(-dy, dx)) % 360

    img = np.zeros((n, n, 4), dtype=np.uint8)

    def blend(mask, rgb, alpha):
        a = (mask * alpha).astype(np.uint8)
        idx = a > 0
        img[idx, 0:3] = rgb[idx]
        img[idx, 3] = np.maximum(img[idx, 3], a[idx])

    for ring in RINGS:
        mask = np.abs(r - ring["radius"]) <= ring["width"] / 2
        rot_theta = (theta + ring.get("rotate", 0)) % 360
        if ring.get("color_source") == "wedges":
            col = _wedge_ring_lut(rot_theta)
        else:
            col = _lut(rot_theta, ring.get("stops", RING_STOPS), periodic=True)
        tint = ring.get("tint", 0.0)
        col = col * (1 - tint) + 255 * tint
        blend(mask, np.clip(col, 0, 255).astype(np.uint8), ring.get("alpha", 255))

    if RINGS:
        hub = min(RINGS, key=lambda ring: ring["radius"])
        rim = max(RINGS, key=lambda ring: ring["radius"])
        r_min_default = hub["radius"] + hub["width"] / 2 + CENTER_GAP
        r_max_default = rim["radius"] - rim["width"] / 2
    else:
        r_min_default, r_max_default = CENTER_GAP, OUTER_RADIUS

    for w in WEDGES:
        a0, a1 = w["a0"], w["a1"]
        r0 = w.get("r0", r_min_default)
        r1 = w.get("r1", r_max_default)
        in_wedge = (theta >= a0) & (theta <= a1) & (r >= r0) & (r <= r1)
        rfrac = np.clip((r - r0) / (r1 - r0), 0, 1)
        base = _lut(rfrac, w["stops"])
        skew = (theta - a0) / (a1 - a0) * w.get("hue_skew", 0)
        coloured = _hue_rotate(base, skew)
        blend(in_wedge, np.clip(coloured, 0, 255).astype(np.uint8), w.get("alpha", 255))

    return _downsample(img, factor)


def main():
    img = render()
    out_path = os.path.join(os.path.dirname(__file__), OUTPUT)
    Image.fromarray(img, "RGBA").save(out_path)
    print(f"saved {out_path}")


if __name__ == "__main__":
    main()
