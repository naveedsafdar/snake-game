#!/usr/bin/env python3
"""
Pack the web game for the iPhone app: ios/Snake/game.html + ios/Snake/supabase.js

The game lives in the repository root (index.html, css/, js/). This script
copies it into a single HTML file with the CSS and JavaScript inside, next to
a local copy of the Supabase library (which has to stay a separate file), so
the app works without downloading anything when it starts.

Run it after changing the game, then build the app again in Xcode:
    python3 ios/build_web.py
"""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
IOS = ROOT / "ios"
OUT = IOS / "Snake" / "game.html"
OUT_SUPABASE = IOS / "Snake" / "supabase.js"
SUPABASE = IOS / "vendor" / "supabase-2.45.4.js"


def script(code):
    # "</script" inside the code would end the <script> tag early
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


html = (ROOT / "index.html").read_text(encoding="utf-8")

# The stylesheet, inlined
css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
html, n = re.subn(r'<link rel="stylesheet" href="css/style\.css[^"]*">',
                  lambda m: "<style>\n" + css + "\n</style>", html)
assert n == 1, "stylesheet link not found in index.html"

# The Supabase library from the CDN, replaced with the local copy next to
# game.html (it can't be inlined: it looks up its own file name when it starts)
shutil.copyfile(SUPABASE, OUT_SUPABASE)
html, n = re.subn(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/[^"]*"></script>',
                  '<script src="supabase.js"></script>', html)
assert n == 1, "Supabase script tag not found in index.html"

# Our own scripts, inlined in the same order
for name in ("config", "db", "game"):
    code = (ROOT / "js" / f"{name}.js").read_text(encoding="utf-8")
    html, n = re.subn(rf'<script src="js/{name}\.js[^"]*"></script>',
                      lambda m, code=code: script(code), html)
    assert n == 1, f"js/{name}.js script tag not found in index.html"

OUT.write_text(html, encoding="utf-8")
print(f"Wrote {OUT.relative_to(ROOT)} ({len(html) // 1024} KB)")
