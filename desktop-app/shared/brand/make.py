#!/usr/bin/env python3
"""Renders every Lexari desktop brand asset from the real mark (brand/mark.svg = shared/components/Logo.tsx LogoMark:
the grape tile with the eyes and smile, same art as the web favicon and the Android/iOS icon) and the Bricolage
Grotesque 'lexari' wordmark. Needs google-chrome (headless) and Pillow.
Run from desktop-app/shared: python3 brand/make.py"""
import os, subprocess, tempfile, shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); A = os.path.join(ROOT, "assets")
FONT = "file://" + os.path.join(A, "fonts", "bricolage.woff2")
MARK = open(os.path.join(HERE, "mark.svg")).read()
CHROME = shutil.which("google-chrome") or shutil.which("chromium")
BASE = f"""<style>@font-face{{font-family:B;src:url({FONT})}}*{{margin:0;box-sizing:border-box}}html,body{{background:transparent;overflow:hidden}}
.w{{font-family:B;font-weight:800;letter-spacing:-.045em;font-variation-settings:"wdth" 88;color:#fff;line-height:.9}}</style>"""

def shot(html, w, h, out):
    d = tempfile.mkdtemp(); p = os.path.join(d, "a.html"); open(p, "w").write("<!doctype html><meta charset=utf-8>" + BASE + html)
    subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--default-background-color=00000000", f"--window-size={w},{h}", f"--screenshot={out}", "--virtual-time-budget=1500", "file://" + p],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(out); assert im.size == (w, h), im.size

def tile(size):
    # macOS app icon grid: the tile is 824/1024 of the canvas (100px margin at 1024) with a soft drop shadow, so the
    # Dock and Finder show it the same size as other apps. The face is the mark's own art, scaled to the tile.
    pad = size * 100 / 1024; t = size - 2 * pad
    face = MARK.replace('<rect width="64" height="64" rx="16" fill="#5b2bff"/>', '').replace("<svg ", '<svg width="100%" height="100%" ')
    return f"""<div style="position:absolute;left:{pad}px;top:{pad}px;width:{t}px;height:{t}px;border-radius:{t*0.225}px;
      background:linear-gradient(160deg,#6a3dff 0%,#5b2bff 55%,#4f22ec 100%);box-shadow:0 {t*0.012}px {t*0.03}px rgba(0,0,0,.28),inset 0 {t*0.006}px 0 rgba(255,255,255,.18)">{face}</div>"""

os.makedirs(os.path.join(A, "icons"), exist_ok=True)
big = os.path.join(A, "icon.png"); shot(tile(1024), 1024, 1024, big)
src = Image.open(big).convert("RGBA")
for s in (16, 24, 32, 48, 64, 128, 256, 512, 1024):
    src.resize((s, s), Image.LANCZOS).save(os.path.join(A, "icons", f"{s}x{s}.png"))
src.save(os.path.join(A, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
src.save(os.path.join(A, "icon.icns"))
shutil.copy(os.path.join(HERE, "mark.svg"), os.path.join(A, "mark.svg"))  # the shell's in-app mark

# Tray: the bare mark. Colour for Windows/Linux, black template (alpha only) for the macOS menu bar.
markpng = os.path.join(A, "mark-512.png"); shot(f'<div style="width:512px;height:512px">{MARK.replace("<svg ", "<svg width=\"100%\" height=\"100%\" ")}</div>', 512, 512, markpng)
mk = Image.open(markpng).convert("RGBA")
for s, n in ((16, "tray.png"), (32, "tray@2x.png")):
    mk.resize((s, s), Image.LANCZOS).save(os.path.join(A, n))
    a = mk.resize((s, s), Image.LANCZOS)
    # template: opaque square with the dot punched out, black only
    r, g, b, al = a.split(); lum = Image.eval(g, lambda v: 0 if v > 150 else 255)  # grape tile (keep), white eyes and smile (hole)
    alpha = Image.composite(lum, Image.new("L", (s, s), 0), al)
    t = Image.new("RGBA", (s, s), (0, 0, 0, 0)); t.putalpha(alpha); t.save(os.path.join(A, n.replace("tray", "trayTemplate")))

# Logo lockup (mark + wordmark) used in docs and the About window.
shot(f'<div style="display:flex;align-items:center;gap:22px;height:120px;padding:0 10px"><div style="width:84px;height:84px">{MARK.replace("<svg ", "<svg width=\"100%\" height=\"100%\" ")}</div><span class="w" style="font-size:104px;margin-top:-10px">lexari</span></div>', 420, 120, os.path.join(A, "lockup.png"))

# DMG background 540x360 (+@2x): aurora, lockup, drag hint.
def dmg(scale):
    w, h = 540 * scale, 360 * scale; s = scale
    return f"""<div style="position:relative;width:{w}px;height:{h}px;background:#000;overflow:hidden">
      <div style="position:absolute;inset:0;background:radial-gradient(60% 70% at 15% 10%,rgba(91,43,255,.55),transparent 70%),radial-gradient(50% 60% at 95% 100%,rgba(53,20,176,.7),transparent 70%)"></div>
      <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.12) {1*s}px,transparent {1.2*s}px);background-size:{18*s}px {18*s}px;opacity:.6"></div>
      <div style="position:absolute;left:{28*s}px;top:{24*s}px;display:flex;align-items:center;gap:{8*s}px"><div style="width:{24*s}px;height:{24*s}px">{MARK.replace("<svg ", "<svg width=\"100%\" height=\"100%\" ")}</div><span class="w" style="font-size:{30*s}px;margin-top:-{3*s}px">lexari</span></div>
      <div style="position:absolute;left:0;right:0;top:{176*s}px;text-align:center;color:#c9b8ff;font:600 {30*s}px/1 sans-serif;opacity:.9">&#10230;</div>
      <div style="position:absolute;left:0;right:0;bottom:{22*s}px;text-align:center;color:rgba(255,255,255,.6);font:{12*s}px/1 sans-serif">Drag Lexari to Applications</div></div>"""
shot(dmg(1), 540, 360, os.path.join(A, "dmg-background.png")); shot(dmg(2), 1080, 720, os.path.join(A, "dmg-background@2x.png"))

# NSIS installer art (BMP, 164x314 sidebar, 150x57 header).
side = os.path.join(A, "nsis-sidebar.png")
shot(f"""<div style="position:relative;width:164px;height:314px;background:radial-gradient(120% 70% at 20% 0%,#8f6bff,#5b2bff 45%,#1a0a5e 100%);overflow:hidden">
  <div style="position:absolute;left:22px;top:30px;width:44px;height:44px">{MARK.replace("<svg ", "<svg width=\"100%\" height=\"100%\" ")}</div>
  <div class="w" style="position:absolute;left:20px;top:92px;font-size:44px">lexari</div>
  <div style="position:absolute;left:22px;bottom:24px;right:16px;color:rgba(255,255,255,.75);font:12px/1.35 sans-serif">Your onchain AI agents, on your desktop.</div></div>""", 164, 314, side)
Image.open(side).convert("RGB").save(os.path.join(A, "nsis-sidebar.bmp"))
head = os.path.join(A, "nsis-header.png")
shot(f"""<div style="position:relative;width:150px;height:57px;background:#fff;display:flex;align-items:center;justify-content:flex-end;padding-right:12px;gap:7px">
  <div style="width:22px;height:22px">{MARK.replace("<svg ", "<svg width=\"100%\" height=\"100%\" ")}</div><span class="w" style="font-size:26px;color:#0a0a0a;margin-top:-3px">lexari</span></div>""", 150, 57, head)
Image.open(head).convert("RGB").save(os.path.join(A, "nsis-header.bmp"))
for f in (side, head): os.remove(f)
print("brand assets written to", A)
