"""Generate the extension icons (16/48/128): the popup's eye-with-slash glyph,
white on a black rounded square. Needs Pillow (python3 -m pip install Pillow).

    python3 scripts/gen_icons.py
"""
import os
from PIL import Image, ImageDraw

BLACK = (29, 29, 31, 255)     # --ink in the popup
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")

# The popup glyph, in its 16x16 viewBox: an eye outline made of four cubic
# curves, and a slash from bottom-left to top-right.
EYE = [
    ((2, 8), (3.6, 5.3), (5.6, 4), (8, 4)),
    ((8, 4), (10.4, 4), (12.4, 5.3), (14, 8)),
    ((14, 8), (12.4, 10.7), (10.4, 12), (8, 12)),
    ((8, 12), (5.6, 12), (3.6, 10.7), (2, 8)),
]
SLASH = ((3, 13), (13, 3))


def cubic(p0, p1, p2, p3, steps=48):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0]
        y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def make(size):
    s = size * 4  # supersample for crisp edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.24), fill=BLACK)

    # Small icons get a slightly larger, bolder glyph so it stays readable.
    glyph = s * (0.72 if size <= 16 else 0.62)
    stroke = glyph / 16 * (2.2 if size <= 16 else 1.6)
    off = (s - glyph) / 2

    def tr(p):
        return (off + p[0] / 16 * glyph, off + p[1] / 16 * glyph)

    # A round brush: stamp a disc every half pixel along the path.
    def brush(points):
        r = stroke / 2
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            n = max(1, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 * 2))
            for i in range(n + 1):
                x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
                d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)

    outline = []
    for seg in EYE:
        outline += cubic(*seg)
    brush([tr(p) for p in outline])
    brush([tr(SLASH[0]), tr(SLASH[1])])
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
for size in (16, 48, 128):
    make(size).save(os.path.join(OUT, f"icon{size}.png"))
    print("wrote", f"icons/icon{size}.png")
