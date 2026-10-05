"""Rebuild every logo asset in public/ from the two sources in design/.

    python scripts/generate-icons.py

  design/app-icon.png   the finished app icon (glowing rounded square with the F) ->
                        home-screen icons, favicons, install banner, offline page
  design/app-logo.png   the bare transparent F mark -> in-app logo next to the wordmark

Needs Pillow (pip install pillow). After changing a source, run this, bump VERSION in
public/sw.js and the ?v= on the icon URLs (manifest + index.html) so installed apps and
browsers fetch the new files.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")


def save(img, name, **kw):
    path = os.path.join(PUBLIC, name)
    img.save(path, optimize=True, **kw)
    print(f"{name:24s} {img.size[0]}x{img.size[1]:<5d} {os.path.getsize(path) // 1024} KB")


def sq(img, size):
    return img.resize((size, size), Image.LANCZOS)


# ---- app icon (opaque square artwork) ----
icon = Image.open(os.path.join(ROOT, "design", "app-icon.png")).convert("RGB")
W = icon.width

# Home-screen icons: trim a little of the outer glow so the tile fills the icon.
app = icon.crop((30, 30, W - 30, W - 30))
save(sq(app, 512), "icon-512.png")
save(sq(app, 192), "icon-192.png")
save(sq(app, 180), "apple-touch-icon.png")

# Android adaptive ("maskable") icon: the launcher may crop to a circle, so the art is
# shrunk into the safe zone. The surround is a flat colour sampled from the artwork's own
# border, and the shrunk copy is feathered into it so no seam shows.
border = [icon.getpixel((x, y)) for x in range(0, W, 20) for y in (0, W - 1)] +          [icon.getpixel((x, y)) for y in range(0, W, 20) for x in (0, W - 1)]
flat = tuple(round(sum(c[i] for c in border) / len(border)) for i in range(3))
canvas = Image.new("RGB", (W, W), flat)
side = round(W * 0.80)
inner = icon.resize((side, side), Image.LANCZOS)
feather = Image.new("L", (side, side), 0)
ImageDraw.Draw(feather).rectangle((side * 0.06, side * 0.06, side * 0.94, side * 0.94), fill=255)
feather = feather.filter(ImageFilter.GaussianBlur(side * 0.035))
canvas.paste(inner, ((W - side) // 2, (W - side) // 2), feather)
save(sq(canvas, 512), "icon-maskable-512.png")

# Favicons: Google shows them in a circle and asks for multiples of 48px, so crop tight
# to the tile - it fills the circle and stays readable at 32px.
fav = icon.crop((60, 60, W - 60, W - 60))
for s in (48, 96, 192):
    save(sq(fav, s), f"favicon-{s}.png")
save(sq(fav, 32), "favicon-32.png")
save(sq(fav, 96), "favicon.png")  # replaces an old 848 KB wide image that Google had cached
sq(fav, 256).save(os.path.join(PUBLIC, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print(f"{'favicon.ico':24s} 16/32/48    {os.path.getsize(os.path.join(PUBLIC, 'favicon.ico')) // 1024} KB")

# ---- bare transparent mark: in-app logo (navbar, auth pages, home) ----
mark_src = Image.open(os.path.join(ROOT, "design", "app-logo.png")).convert("RGBA")
l, t, r, b = mark_src.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
pad = 8
mark = mark_src.crop((max(0, l - pad), max(0, t - pad), min(mark_src.width, r + pad), min(mark_src.height, b + pad)))
save(mark.resize((round(mark.width * 256 / mark.height), 256), Image.LANCZOS), "logo-mark.png")
