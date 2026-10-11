#!/usr/bin/env python3
"""Assemble public/index.html from src/. Run from the repo root:  python3 tools/build.py"""
from pathlib import Path
R = Path(__file__).resolve().parent.parent
S = R / "src"
rd = lambda p: (S / p).read_text(encoding="utf-8")
style = rd("style.css").replace("</style>", rd("extra.css") + "\n" + rd("fonts/embedded.css") + "\n" + rd("fonts/extra_fonts.css") + "\n</style>")
html = (rd("head.html") + style + "\n</head>\n<body>\n" + rd("body.html").replace("<h1>Samadristi quote cards</h1>", "<h1>Daily quote cards</h1>")
        + "\n<script>\n" + rd("pre.js") + "\n" + rd("themes2.js") + "\n" + rd("draw.js") + "\n" + rd("post.js") + "\n</script>\n</body>\n</html>\n")
(R / "public" / "index.html").write_text(html, encoding="utf-8")
print(f"built public/index.html ({len(html.encode()):,} bytes)")
