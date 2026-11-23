"""Make the Chrome Web Store small promo tile (440x280): the app icon and the
name, white on black. Needs Pillow; uses the macOS system font.

    python3 scripts/promo_tile.py   # writes dist/promo-small-440x280.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 440, 280
BLACK = (29, 29, 31)
WHITE = (255, 255, 255)
GREY = (161, 161, 166)
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "dist", "promo-small-440x280.png")
FONT = "/System/Library/Fonts/SFNS.ttf"


def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(weight)  # SF's named weights, e.g. b'Semibold'
    except Exception:
        pass  # older Pillow or a static font: regular weight is fine
    return f


S = 4  # supersample
img = Image.new("RGB", (W * S, H * S), BLACK)
d = ImageDraw.Draw(img)

icon = Image.open(os.path.join(ROOT, "icons", "icon128.png")).convert("RGBA")
size = 72 * S
icon = icon.resize((size, size), Image.LANCZOS)
# The icon is black on black here, so give it a thin light ring to stand out.
x, y = (W * S - size) // 2, 62 * S
d.rounded_rectangle([x - 2 * S, y - 2 * S, x + size + 2 * S, y + size + 2 * S], radius=int(size * 0.26), fill=(58, 58, 61))
img.paste(icon, (x, y), icon)

title = font(34 * S, b'Semibold')
sub = font(15 * S, b'Regular')
for text, f, color, top in (("Hide Metrics", title, WHITE, 160), ("Make things without checking the numbers", sub, GREY, 208)):
    w = d.textlength(text, font=f)
    d.text(((W * S - w) / 2, top * S), text, font=f, fill=color)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.resize((W, H), Image.LANCZOS).save(OUT)
print("wrote", os.path.relpath(OUT, ROOT), (W, H))
