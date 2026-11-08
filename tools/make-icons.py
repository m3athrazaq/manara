"""Renders the Android launcher icons and the Android TV banner from web/src/logo.svg.

Run from anywhere after `npm ci` in web/ (for the fonts):  python3 tools/make-icons.py
Needs Python Playwright with Chromium. Writes into android/app/src/main/res.
"""
import os
import re
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
NM = os.path.join(ROOT, 'web', 'node_modules')
NAVY, NAVY_2, BRASS, INK = '#0A1530', '#16306A', '#D6B26E', '#F4EFE1'

src = open(os.path.join(ROOT, 'web', 'src', 'logo.svg'), encoding='utf8').read()
LOGO = re.search(r'<g[\s\S]*</g>', re.sub(r'<!--[\s\S]*?-->', '', src)).group(0)

FONTS = f"""
@font-face{{font-family:'El Messiri';font-weight:700;src:url(file://{NM}/@fontsource/el-messiri/files/el-messiri-arabic-700-normal.woff2) format('woff2')}}
@font-face{{font-family:'Cairo';font-weight:200 1000;src:url(file://{NM}/@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2) format('woff2')}}
"""
# The screen's eight-pointed-star tiling, faint, behind the banner.
PATTERN = ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E"
           "%3Cg fill='none' stroke='%23D6B26E' stroke-width='1.3' opacity='.12'%3E%3Crect x='32' y='32' width='56' height='56'/%3E"
           "%3Crect x='32' y='32' width='56' height='56' transform='rotate(45 60 60)'/%3E"
           "%3Cpath d='M0 0L32 32M120 0L88 32M0 120L32 88M120 120L88 88M60 0V20M60 100V120M0 60H20M100 60H120'/%3E%3C/g%3E%3C/svg%3E\")")


def logo(px, crop=False):
    """The minaret, px tall; crop trims the empty sides of the square drawing (x 20–44 of 64)."""
    w, vb = (round(px * 24 / 64), '20 0 24 64') if crop else (px, '0 0 64 64')
    return f"<svg width='{w}' height='{px}' viewBox='{vb}' style='display:block;color:{BRASS}'>{LOGO}</svg>"


def page(body, w, h, bg='transparent'):
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{FONTS}"
            f"html,body{{margin:0;width:{w}px;height:{h}px;background:{bg};overflow:hidden}}</style></head><body>{body}</body></html>")


def shot(pg, html, w, h, path, transparent):
    pg.set_viewport_size({'width': w, 'height': h})
    pg.set_content(html)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(150)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pg.screenshot(path=path, omit_background=transparent, clip={'x': 0, 'y': 0, 'width': w, 'height': h})


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    for d, f in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        # Legacy icon (before Android 8): a rounded navy tile with the minaret.
        s = round(48 * f)
        legacy = (f"<div style='width:{s}px;height:{s}px;border-radius:{s * 0.22}px;background:radial-gradient(circle at 50% 30%,{NAVY_2},{NAVY} 72%);"
                  f"display:grid;place-items:center'>{logo(round(s * 0.8))}</div>")
        shot(pg, page(legacy, s, s), s, s, f'{RES}/mipmap-{d}/ic_launcher.png', True)
        # Adaptive icon foreground (108dp canvas, launchers mask it to about 72dp): the whole minaret stays well inside the 66dp safe circle.
        fs = round(108 * f)
        fg = f"<div style='width:{fs}px;height:{fs}px;display:grid;place-items:center'>{logo(round(fs * 0.56))}</div>"
        shot(pg, page(fg, fs, fs), fs, fs, f'{RES}/mipmap-{d}/ic_launcher_foreground.png', True)
    # Android TV banner, 320x180dp at xhdpi. The text is the app's label, never a brand name.
    banner = f"""<style>.bn{{width:640px;height:360px;box-sizing:border-box;background-color:{NAVY};
      background-image:radial-gradient(ellipse at 72% 45%,{NAVY_2} 0%,rgba(0,0,0,0) 62%),{PATTERN};background-size:auto,96px 96px;
      display:grid;grid-template-columns:auto auto;align-items:center;justify-content:center;column-gap:30px;direction:rtl}}
      .t1{{font-family:'El Messiri';font-weight:700;font-size:70px;line-height:1.2;color:{BRASS};white-space:nowrap}}
      .t2{{font-family:'Cairo';font-weight:600;font-size:30px;line-height:1.4;color:{INK};margin-top:4px;white-space:nowrap}}</style>
      <div class="bn">{logo(250, crop=True)}<div><div class="t1">شاشة المسجد</div><div class="t2">مواقيت الصلاة والأذكار</div></div></div>"""
    shot(pg, page(banner, 640, 360, NAVY), 640, 360, f'{RES}/drawable-xhdpi/banner.png', False)
    b.close()
print('icons written to', RES)
