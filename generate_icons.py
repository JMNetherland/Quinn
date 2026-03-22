"""
Quinn PWA Icon Generator
Generates all PWA icons and splash screens from a source image.
Run: python generate_icons.py
"""
from PIL import Image
import os

SOURCE  = "C:/Dev/personal/web-apps/Quinn/IMG_5033.PNG"
ICONS_DIR = "C:/Dev/personal/web-apps/Quinn/icons"
SPLASH_BG = (13, 13, 26, 255)   # #0d0d1a — matches Quinn's dark UI

os.makedirs(ICONS_DIR, exist_ok=True)

src = Image.open(SOURCE).convert("RGBA")

def make_icon(px, filename):
    """Resize source image to square px×px."""
    img = src.resize((px, px), Image.LANCZOS)
    # Flatten onto dark background (handles any transparent edges)
    bg = Image.new("RGBA", (px, px), (26, 16, 53, 255))
    bg.paste(img, (0, 0), img)
    out = os.path.join(ICONS_DIR, filename)
    bg.convert("RGB").save(out, "PNG")
    print(f"  ok {filename} ({px}x{px})")

def make_splash(width, height, filename):
    """Center the icon on a dark splash background."""
    # Icon takes up ~40% of the shorter dimension
    icon_size = int(min(width, height) * 0.40)
    icon = src.resize((icon_size, icon_size), Image.LANCZOS)

    bg = Image.new("RGBA", (width, height), SPLASH_BG)
    x = (width  - icon_size) // 2
    y = (height - icon_size) // 2
    bg.paste(icon, (x, y), icon)

    out = os.path.join(ICONS_DIR, filename)
    bg.convert("RGB").save(out, "PNG")
    print(f"  ok {filename} ({width}x{height})")


print("Generating Quinn PWA icons from IMG_5033.PNG...")

for size in [72, 96, 128, 144, 152, 192, 384, 512]:
    make_icon(size, f"icon-{size}x{size}.png")

make_icon(180, "apple-touch-icon.png")

splashes = [
    (1170, 2532, "splash-1170x2532.png"),
    (1284, 2778, "splash-1284x2778.png"),
    (750,  1334, "splash-750x1334.png"),
]
for w, h, name in splashes:
    make_splash(w, h, name)

print(f"\nDone! {8 + 1 + 3} files written to {ICONS_DIR}")
