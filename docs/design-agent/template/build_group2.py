#!/usr/bin/env python3
"""Build CDP report template, group 2 data pages (HTML, A4 in points).

Imports build_group1 for tokens, frame, opener, icons and tables.
Charts are inline SVG with viewBox in points, drawn in panel local
coordinates (origin = panel top left). Text in SVG uses baselines, as pdfkit
does after the offset in SPEC-group-1 section 0.1.
The header logo comes from logo.js (one shared data URI), so page files stay small.
"""
import json, os, sys, math, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_group1 as g1
from build_group1 import esc, box, section, chapter_opener, icon, ORDER, NAME, ML, MT, CW, RX, CB, PW, PH, Q, HALF, GUT, D, S, T
from PIL import ImageFont

OUT = g1.OUT
g1.TOTAL_PAGES = 40
wd = g1.wd
STORE = g1.STORE
FONT = {w: f"/usr/share/fonts/opentype/inter/Inter-{n}.otf" for w, n in ((400, "Regular"), (600, "SemiBold"), (700, "Bold"))}
_fc = {}
def tw(s, size=7, w=400):
    """Text width in pt (Inter, measured with the installed font)."""
    k = (size, w)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONT[w], 1000)
    return round(_fc[k].getlength(s) * size / 1000, 2)

INK, MUTED, WHITE, BRAND, SURF = "var(--color-ink)", "var(--color-muted)", "var(--color-white)", "var(--color-brand)", "var(--color-surface)"
GRID = "var(--chart-gridline)"
BAND_W, BAND_S, HATCH = T["chart"]["band.watch"], T["chart"]["band.significant"], T["chart"]["hatch.suppressed"]
NEG, POS = T["chart"]["diverging"]["negative"], T["chart"]["diverging"]["positive"]
def ser(o): return f"var(--data-{o.lower()})"
def tint(o): return f"var(--data-tint-{o.lower()})"
MINUS = "\u2212"
def f1(v): return f"{float(v):.1f}".replace("-", MINUS)
def f2(v): return f"{float(v):.2f}".replace("-", MINUS)
def s1(v): v = float(v); return ("+" if v > 0 else MINUS if v < 0 else "") + f"{abs(v):.1f}"
def s2(v): v = float(v); return ("+" if v > 0 else MINUS if v < 0 else "") + f"{abs(v):.2f}"
def s0(v): v = round(float(v)); return ("+" if v > 0 else MINUS if v < 0 else "") + f"{abs(v)}"
def n0(v): return f"{round(float(v))}"
def num(s): return f'<span class="tnum">{esc(s)}</span>'

# ---------------- data (all from report-sample-data.json) ----------------
NOW = {k: float(S["orientation_scores"]["now"][k]) for k in ORDER}
PREF = {k: float(S["orientation_scores"]["preferred"][k]) for k in ORDER}
GAP = {k: float(S["orientation_scores"]["gap"][k]) for k in ORDER}
DIMS = [f"D{i}" for i in range(1, 7)]
DNOW = {d: {k: float(S["dimension_now"][d][k]) for k in ORDER} for d in DIMS}
DPREF = {d: {k: float(S["dimension_preferred"][d][k]) for k in ORDER} for d in DIMS}
DGAP = {d: {k: round(DPREF[d][k] - DNOW[d][k], 2) for k in ORDER} for d in DIMS}
LENS = {l: {k: float(S["lenses_now"][l][k]) for k in ORDER} for l in ("PRACTICE", "STRATEGY", "LEADERSHIP")}
DISP = S["analytics"]["dispersion"]
COH = S["cohorts"]; EX = {k: float(COH["executive"]["now"][k]) for k in ORDER}; ST = {k: float(COH["staff"]["now"][k]) for k in ORDER}
EXN, STN = COH["executive"]["n"], COH["staff"]["n"]
PG = {k: float(S["perception_gap"][k]) for k in ORDER}; PFLAG = S["perception_flags"]
RD = S["readiness"]; RISK = S["analytics"]["risk"]
EOS = S["eos"]; EOSD = S["eos_detail"]; QS = [f"Q{i}" for i in range(1, 9)]
FIND = D["evaluation"]["findings"]; CHECKS = D["evaluation"]["checks"]; SCEN = D["evaluation"]["scenarios"]
FLAGGED_Q = {f["category"]: f["severity"] for f in FIND if f["type"] == "ENGAGEMENT_MISS" and f["blocks"]["cohort"] == "ORGANISATION"}
TH = D["themes"]; L360 = D["leadership_360"]
ORG_LEAD = max(NOW, key=NOW.get)
_sub = {f["segment_definition"].split(": ", 1)[1]: f for f in FIND if f["type"] == "SUBCULTURE"}
DEPTS = []
for r_ in D["departments"]["rows"]:
    f_ = _sub.get(r_["label"])
    DEPTS.append({"name": r_["label"], "n": r_["n"], "dominant": r_["dominant"], "scores": {o: float(r_["now"][o]) for o in ORDER},
                  "diff": {o: float(r_["diff"][o]) for o in ORDER}, "divergence": r_["dominant"] != ORG_LEAD,
                  "severity": f_["severity"] if f_ else None})
for f in FIND:
    if f["type"] == "ENGAGEMENT_MISS" and f["blocks"]["cohort"].startswith("department: "):
        nm = f["blocks"]["cohort"].split(": ", 1)[1]
        for d_ in DEPTS:
            if d_["name"] == nm: d_.setdefault("voice", []).append((f["category"], f["severity"]))
def lead(dct):
    s_ = sorted(dct.items(), key=lambda kv: -kv[1]); return s_[0][0], s_[1][0], round(s_[0][1] - s_[1][1], 2)
DIM_LABEL = dict(D["names"]["dimensions"])                 # platform names, D1 to D9
Q_LABEL = dict(D["names"]["voice"])                        # platform names, Q1 to Q8
def sc(x): return x.capitalize().replace("_", " ")

# ---------------- svg helpers ----------------
def svg(w, h, body, label):
    return f'<svg class="abs ch" style="left:0;top:0" width="{w}pt" height="{h}pt" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(label)}">{body}</svg>'
def tx(x, y, s, size=7, w=400, anchor="start", fill=None, cls=""):
    c = (' class="b' + (' ' + cls if cls else '') + '"') if w == 600 else (f' class="{cls}"' if cls else "")
    st = f' font-weight="{w}"' if w == 700 else ""
    fl = f' style="fill:{fill}"' if fill else ""
    return f'<text x="{round(x,2)}" y="{round(y,2)}" font-size="{size}" text-anchor="{anchor}"{c}{st}{fl}>{esc(s)}</text>'
def txk(x, y, s, anchor="start", size=7, w=400):
    """Label with a white knockout behind it, so it reads over gridlines and reference lines."""
    wd = tw(s, size, w) + 2; x0 = x - 1 if anchor == "start" else (x - wd + 1 if anchor == "end" else x - wd / 2)
    return rc(x0, y - size * 0.82, wd, size * 1.0, WHITE) + tx(x, y, s, size, w, anchor)
def ln(x1, y1, x2, y2, stroke=GRID, w=0.5, dash=None, cap=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""; c = f' stroke-linecap="{cap}"' if cap else ""
    return f'<line x1="{round(x1,2)}" y1="{round(y1,2)}" x2="{round(x2,2)}" y2="{round(y2,2)}" stroke="{stroke}" stroke-width="{w}"{d}{c}/>'
def rc(x, y, w, h, fill, stroke=None, sw=0.5, extra=""):
    s_ = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    if w < 0: x, w = x + w, -w
    return f'<rect x="{round(x,2)}" y="{round(y,2)}" width="{round(w,2)}" height="{round(h,2)}" fill="{fill}"{s_}{extra}/>'
def circ(cx, cy, r, fill, stroke=None, sw=0.5):
    s_ = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<circle cx="{round(cx,2)}" cy="{round(cy,2)}" r="{r}" fill="{fill}"{s_}/>'
def diamond(cx, cy, r, stroke, fill=WHITE, sw=1.25):
    p = f"{cx},{cy-r} {cx+r},{cy} {cx},{cy+r} {cx-r},{cy}"
    return f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'
def icon_at(kind, x, y, color=INK):
    """10 pt icon drawn inside an svg at x, y (top left)."""
    inner = re.sub(r'^<svg[^>]*>|</svg>$', '', icon(kind, color))
    return f'<g transform="translate({round(x,2)} {round(y,2)})">{inner}</g>'
def legend(x, y, items, gap=12):
    """items: (kind, label, colour). Baseline y. Returns svg string and end x."""
    out = []; cx = x
    for kind, lab, col in items:
        if kind == "tintbar": out.append(rc(cx, y - 6, 10, 7, BAND_W, INK, 1))
        elif kind == "solidbar": out.append(rc(cx, y - 6, 10, 7, MUTED, INK, 0.5))
        elif kind == "swatch": out.append(rc(cx, y - 6, 10, 7, col, INK, 0.5))
        elif kind == "band": out.append(rc(cx, y - 6, 10, 7, col))
        elif kind == "dash": out.append(ln(cx, y - 2.5, cx + 10, y - 2.5, col, 0.5 if col == INK else 1, "2 2"))
        elif kind == "dash1": out.append(ln(cx, y - 2.5, cx + 10, y - 2.5, col, 1, "3 2"))
        elif kind == "dot": out.append(circ(cx + 5, y - 2.5, 3, col, INK, 0.5))
        elif kind == "hollow": out.append(circ(cx + 5, y - 2.5, 3, WHITE, col, 1.25))
        elif kind == "diamond": out.append(diamond(cx + 5, y - 2.5, 3.5, col))
        elif kind == "arrow": out.append(ln(cx, y - 2.5, cx + 7, y - 2.5, INK, 1.5) + f'<polygon points="{cx+6},{y-5.5} {cx+10},{y-2.5} {cx+6},{y+0.5}" fill="{INK}"/>')
        elif kind == "hatch": out.append(rc(cx, y - 6, 10, 7, "url(#hatch)", GRID, 0.5))
        elif kind == "line": out.append(ln(cx, y - 2.5, cx + 10, y - 2.5, col, 1))
        out.append(tx(cx + 14, y, lab)); cx += 14 + tw(lab) + gap
    return "".join(out), cx - gap
HATCH_DEF = (f'<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
             f'<rect width="4" height="4" fill="{WHITE}"/><line x1="0" y1="0" x2="0" y2="4" stroke="{HATCH}" stroke-width="1"/></pattern></defs>')

def panel(title, w, h, body, block, label=None):
    t = f'<h3 class="abs t-panel-title c-ink" style="left:12pt;top:12pt;font:inherit;letter-spacing:inherit">{esc(title)}</h3>' if title else ""
    t = t.replace('style="left:12pt', 'style="left:12pt') .replace('font:inherit;', '') if title else ""
    if title: t = f'<div class="abs t-panel-title c-ink" style="left:12pt;top:12pt" role="heading" aria-level="3">{esc(title)}</div>'
    return f'<div class="panel rel" data-block="{block}" style="width:{w}pt;height:{h}pt">{t}{svg(w, h, body, label or title)}</div>'

def pair(a, b): return f'<div class="pair" data-block="panel-pair">{a}{b}</div>'

# ---------------- text blocks ----------------
def headline(html_): return f'<p class="t-headline c-ink" data-block="headline" style="width:{CW}pt">{html_}</p>'
def h1(no, title): return f'<h2 class="t-h1 c-ink" data-block="h1"><span class="tnum" style="display:inline-block;min-width:28pt">{esc(no)}</span>{esc(title)}</h2>'
def h2(title, block="h2"): return f'<h3 class="t-h2 c-ink" data-block="{block}">{esc(title)}</h3>'
def sowhat(text):
    return (f'<aside class="callout" data-block="so-what" style="padding:12pt"><div class="t-panel-title c-ink">So what</div>'
            f'<p class="t-body c-ink" style="margin-top:4pt">{text}</p></aside>')
def group(*parts, gap=8): return f'<div style="display:flex;flex-direction:column;gap:{gap}pt">{"".join(parts)}</div>'

def sig(kind, word):
    return (icon(kind) + " " if kind else "") + esc(word)
def star(v): return f'<span style="font-weight:600">{icon("star")} {esc(v)}</span>'

def table(cols, head, rows, block, right=(), first_bold=True):
    cg = "".join(f'<col style="width:{c}pt">' if c else "<col>" for c in cols)
    th = "".join(f'<th class="t-table-head{" r" if i in right else ""}">{h}</th>' for i, h in enumerate(head))
    tr = ""
    for r in rows:
        if isinstance(r, str): tr += r; continue
        tds = ""
        for i, c in enumerate(r):
            cl = []
            if i == 0 and first_bold: cl.append("first")
            if i in right: cl.append("r tnum")
            tds += f'<td class="{" ".join(cl)}">{c}</td>'
        tr += f"<tr>{tds}</tr>"
    return f'<table class="t t-table" data-block="{block}"><colgroup>{cg}</colgroup><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'

def empty_row(ncols, text):
    return f'<tr><td colspan="{ncols}" style="padding:12pt;font-weight:400"><span class="t-body">{esc(text)}</span></td></tr>'

def page(no, inner_flow, aria, opener=None, y0=None):
    s = [frame(no)]
    if opener:
        s.append(chapter_opener(MT, *opener)); y = 120
    else:
        y = MT
    s.append(box(ML, y0 or y, CW, None, "flow", inner_flow, attrs=f' id="flow-{no}"'))
    return section("".join(s), aria)

def frame(no):
    f = g1.frame(no, "")
    if no == 0: f = f.replace(f"Page 0 of {g1.TOTAL_PAGES}", "Review sheet")
    return re.sub(r'src="data:image/png;base64,[^"]+"', 'src="data:," data-logo="pac-logo-colour"', f)

def html_doc(title, pages):
    return g1.page_html(title, pages).replace("</body>", '<script src="logo.js"></script>\n</body>')

# =====================================================================
# Charts (local panel coordinates)
# =====================================================================
PW2 = HALF  # 241.64

def ch_profile(w=PW2, h=228):
    x0, x1, top, base = 36, w - 12, 40, 172
    k = (base - top) / 40
    b = []
    for v in (10, 20, 30, 40):
        y = base - v * k; b.append(ln(x0, y, x1, y)); b.append(tx(x0 - 4, y + 2.5, str(v), anchor="end"))
    b.append(tx(x0 - 4, base + 2.5, "0", anchor="end"))
    y25 = base - 25 * k; b.append(ln(x0, y25, x1, y25, INK, 0.5, "2 2"))
    gw = (x1 - x0) / 4; bw, gp = 16, 2; off = (gw - (2 * bw + gp)) / 2
    for i, o in enumerate(ORDER):
        gx = x0 + i * gw + off
        for j, (v, kind) in enumerate(((NOW[o], "now"), (PREF[o], "pref"))):
            bx = gx + j * (bw + gp); bh = v * k
            if kind == "now": b.append(rc(bx + 0.5, base - bh + 0.5, bw - 1, bh - 0.5, tint(o), ser(o), 1))
            else: b.append(rc(bx, base - bh, bw, bh, ser(o), INK, 0.5))
            b.append(txk(bx + bw / 2, base - bh - 3, f1(v), anchor="middle"))
        b.append(tx(x0 + i * gw + gw / 2, base + 12, NAME[o], w=600, anchor="middle"))
    b.append(ln(x0, base, x1, base, INK, 0.75))
    lg, _ = legend(12, h - 13.95, [("tintbar", "Now", None), ("solidbar", "Preferred", None), ("dash", "Even share, 25", INK)])
    b.append(lg)
    return "".join(b)

def arc_path(cx, cy, r, a0, a1):
    """Arc from angle a0 to a1 in degrees, 0 = 12 o'clock, clockwise."""
    p = lambda a: (cx + r * math.sin(math.radians(a)), cy - r * math.cos(math.radians(a)))
    (xa, ya), (xb, yb) = p(a0), p(a1); large = 1 if a1 - a0 > 180 else 0
    return xa, ya, xb, yb, large

def ch_ring(w=PW2, h=228):
    cx, cy, R, r = 80, 110, 62, 38
    b = []; a = 0.0; tot = sum(NOW.values())
    for o in ORDER:
        sweep = NOW[o] / tot * 360; a1 = a + sweep
        xa, ya, xb, yb, lg = arc_path(cx, cy, R, a, a1); xc, yc, xd, yd, _ = arc_path(cx, cy, r, a, a1)
        d = f"M{xa:.2f} {ya:.2f}A{R} {R} 0 {lg} 1 {xb:.2f} {yb:.2f}L{xd:.2f} {yd:.2f}A{r} {r} 0 {lg} 0 {xc:.2f} {yc:.2f}Z"
        b.append(f'<path d="{d}" fill="{ser(o)}" stroke="{INK}" stroke-width="0.5"/>'); a = a1
    top = max(NOW, key=NOW.get)
    b.append(tx(cx, cy - 4, NAME[top] + " leads", w=600, anchor="middle"))
    b.append(tx(cx, cy + 10, f2(NOW[top]), size=11, w=600, anchor="middle"))
    lx = 158; ly = 74
    for i, o in enumerate(ORDER):
        y = ly + i * 22
        b.append(rc(lx, y - 7, 8, 8, ser(o), INK, 0.5)); b.append(tx(lx + 12, y, NAME[o], w=600))
        b.append(tx(w - 12, y, f1(NOW[o]), anchor="end"))
    b.append(tx(12, h - 13.95, "Share of 100 points, now"))
    return "".join(b)

def ch_margin(rows, w=PW2, h=228, pitch=30):
    """Lead margin bars: rows = [(label, leader, second, margin)]. Ink bars, scale 0 to 20."""
    x0, x1 = 100, 205; k = (x1 - x0) / 20; top = 36; n = len(rows)
    bot = top + n * pitch - 6
    b = []
    for v in (5, 10, 15, 20):
        x = x0 + v * k; b.append(ln(x, top - 4, x, bot)); b.append(tx(x, bot + 10, str(v), anchor="middle"))
    b.append(tx(x0, bot + 10, "0", anchor="middle"))
    for i, (lab, l1, l2, m) in enumerate(rows):
        y = top + i * pitch
        b.append(tx(12, y + 7, lab, w=600)); b.append(tx(12, y + 16, f"{NAME[l1]} over {NAME[l2]}", fill=MUTED))
        b.append(rc(x0, y + 1, m * k, 12, INK)); b.append(tx(x0 + m * k + 4, y + 9.5, f2(m)))
    b.append(ln(x0, top - 4, x0, bot, INK, 0.75))
    b.append(tx(12, h - 13.95, "Points between the first and second orientation"))
    return "".join(b)

def ch_grouped(values, w=CW, h=236, signed=False, label_fn=None):
    """Six groups by four orientations, vertical bars, whole number labels."""
    x0, x1 = 44, w - 12; b = []
    if signed:
        top, bot = 36, 186; lo, hi = -25, 25
    else:
        top, bot = 36, 176; lo, hi = 0, 40
    k = (bot - top) / (hi - lo); y_of = lambda v: bot - (v - lo) * k; zero = y_of(0)
    step = 5 if signed else 10
    for v in range(lo, hi + 1, step):
        y = y_of(v)
        if v != 0: b.append(ln(x0, y, x1, y))
        b.append(tx(x0 - 4, y + 2.5, (s0(v) if signed else str(v)) if v else "0", anchor="end"))
    gw = (x1 - x0) / 6; bw, gp = 14, 2; blk = 4 * bw + 3 * gp; off = (gw - blk) / 2
    for gi, d in enumerate(DIMS):
        gx = x0 + gi * gw + off
        for oi, o in enumerate(ORDER):
            v = values[d][o]; bx = gx + oi * (bw + gp); y = y_of(v)
            b.append(rc(bx, min(y, zero), bw, abs(zero - y), ser(o), INK, 0.5))
            lab = s0(v) if signed else n0(v)
            ly = (y - 3) if v >= 0 else (y + 9)
            b.append(tx(bx + bw / 2, ly, lab, anchor="middle"))
        b.append(tx(x0 + gi * gw + gw / 2, bot + 13, DIM_LABEL[d], w=600, anchor="middle"))
    if not signed:
        y25 = y_of(25); b.append(ln(x0, y25, x1, y25, INK, 0.5, "2 2"))
    b.append(ln(x0, zero, x1, zero, INK, 0.75))
    items = [("swatch", NAME[o], ser(o)) for o in ORDER] + ([("dash", "Even share, 25", INK)] if not signed else [])
    lg, _ = legend(12, h - 13.95, items); b.append(lg)
    return "".join(b)

def ch_gapbands(w=PW2, h=200):
    x0, x1 = 58, 178; zero = (x0 + x1) / 2; k = (x1 - x0) / 40; top = 34; pitch = 30; bh = 12
    bot = top + 4 * pitch - 6
    b = []
    for s_ in (-1, 1):
        b.append(rc(zero + s_ * 4 * k, top - 4, s_ * 4 * k, bot - top + 4, BAND_W))
        b.append(rc(zero + s_ * 8 * k, top - 4, s_ * 12 * k, bot - top + 4, BAND_S))
    for v in (-8, -4, 4, 8):
        b.append(tx(zero + v * k, bot + 10, s0(v), anchor="middle"))
    b.append(tx(zero, bot + 10, "0", anchor="middle"))
    for i, o in enumerate(ORDER):
        y = top + i * pitch; v = GAP[o]
        b.append(tx(12, y + bh / 2 + 2.5, NAME[o], w=600))
        b.append(rc(zero, y, v * k, bh, ser(o), INK, 0.5))
        if v >= 0: b.append(tx(zero + v * k + 4, y + bh / 2 + 2.5, s1(v)))
        else: b.append(tx(zero + v * k - 4, y + bh / 2 + 2.5, s1(v), anchor="end"))
        b.append(tx(w - 12, y + bh / 2 + 2.5, sc(S["analytics"]["gap_bands"][o]), anchor="end"))
    b.append(ln(zero, top - 4, zero, bot, INK, 0.75))
    b.append(tx(x0, bot + 21, "Want less")); b.append(tx(x1, bot + 21, "Want more", anchor="end"))
    lg, _ = legend(12, h - 13.95, [("band", "Watch band, 4 to 8", BAND_W), ("band", "Significant, above 8", BAND_S)]); b.append(lg)
    return "".join(b)

def ch_arrows(w=PW2, h=200):
    x0, x1 = 62, w - 22; k = (x1 - x0) / 40; top = 34; pitch = 30
    bot = top + 4 * pitch - 6
    b = []
    for v in (10, 20, 30, 40):
        x = x0 + v * k; b.append(ln(x, top - 4, x, bot)); b.append(tx(x, bot + 10, str(v), anchor="middle"))
    b.append(tx(x0, bot + 10, "0", anchor="middle"))
    x25 = x0 + 25 * k; b.append(ln(x25, top - 4, x25, bot, INK, 0.5, "2 2"))
    for i, o in enumerate(ORDER):
        y = top + i * pitch + 6; a, c = x0 + NOW[o] * k, x0 + PREF[o] * k; dirn = 1 if c > a else -1
        b.append(tx(12, y + 2.5, NAME[o], w=600))
        b.append(ln(a + dirn * 3, y, c - dirn * 5, y, ser(o), 1.5))
        b.append(f'<polygon points="{c-dirn*6:.2f},{y-3.5} {c:.2f},{y} {c-dirn*6:.2f},{y+3.5}" fill="{ser(o)}" stroke="{INK}" stroke-width="0.5" stroke-linejoin="round"/>')
        b.append(circ(a, y, 3, WHITE, ser(o), 1.25))
        if dirn > 0:
            b.append(txk(a - 6, y + 2.5, f1(NOW[o]), anchor="end")); b.append(txk(c + 4, y + 2.5, f1(PREF[o])))
        else:
            b.append(txk(a + 6, y + 2.5, f1(NOW[o]))); b.append(txk(c - 4, y + 2.5, f1(PREF[o]), anchor="end"))
    b.append(ln(x0, top - 4, x0, bot, INK, 0.75))
    lg, _ = legend(12, h - 13.95, [("hollow", "Now", INK), ("arrow", "Preferred", INK), ("dash", "Even share, 25", INK)]); b.append(lg)
    return "".join(b)

def ch_tension(w=PW2, h=200):
    x0, x1 = 62, w - 34; zero = (x0 + x1) / 2; k = (x1 - x0) / 30
    b = []; y = 40
    for t in S["analytics"]["tensions"]:
        a, c = t["a"], t["b"]
        b.append(tx(12, y, f"{NAME[a]} and {NAME[c]}", w=600))
        b.append(tx(w - 12, y, f"{t['score']}, {sc(t['band'])}", anchor="end"))
        for j, o in enumerate((a, c)):
            yy = y + 8 + j * 16; v = GAP[o]
            b.append(tx(12, yy + 8.5, NAME[o]))
            b.append(rc(zero, yy, v * k, 12, ser(o), INK, 0.5))
            if v >= 0: b.append(tx(zero + v * k + 4, yy + 8.5, s1(v)))
            else: b.append(tx(zero + v * k - 4, yy + 8.5, s1(v), anchor="end"))
        b.append(ln(zero, y + 4, zero, y + 44, INK, 0.75))
        y += 66
    b.append(tx(x0, y - 8, "Want less")); b.append(tx(x1, y - 8, "Want more", anchor="end"))
    b.append(tx(12, h - 13.95, "Tension score and band; bars show the gap in points"))
    return "".join(b)

def disp_mean(o): return round(sum(float(DISP[d][o]) for d in DIMS) / 6, 2)

def ch_spread(w=PW2, h=200):
    x0, x1 = 62, w - 34; k = (x1 - x0) / 12; top = 44; pitch = 28
    bot = top + 4 * pitch - 8
    b = []
    for v in (3, 6, 9, 12):
        x = x0 + v * k; b.append(ln(x, top - 4, x, bot)); b.append(tx(x, bot + 10, str(v), anchor="middle"))
    b.append(tx(x0, bot + 10, "0", anchor="middle"))
    ov = float(DISP["overall"]); xo = x0 + ov * k
    b.append(ln(xo, top - 10, xo, bot, INK, 1, "3 2")); b.append(tx(xo, top - 13, f"All answers {f2(ov)}", anchor="middle"))
    for i, o in enumerate(ORDER):
        y = top + i * pitch; v = disp_mean(o)
        b.append(tx(12, y + 8.5, NAME[o], w=600)); b.append(rc(x0, y, v * k, 12, ser(o), INK, 0.5))
        b.append(txk(x0 + v * k + 4, y + 8.5, f2(v)))
    b.append(ln(x0, top - 4, x0, bot, INK, 0.75))
    b.append(tx(12, h - 13.95, "Average spread of answers across the six dimensions"))
    return "".join(b)

def ch_dumbbell(rows, lo, hi, w=PW2, h=200, ref=None, flag_fn=None, fmt=f1, ticks=None, legend_items=None, ref_style=(INK, 0.5, "2 2"), value_fmt=f2, gap_fn=None):
    """rows: [(label, a, b, colour)] a = filled circle, b = hollow diamond."""
    x0, x1 = 62, w - 50; k = (x1 - x0) / (hi - lo); top = 40; pitch = 30
    bot = top + len(rows) * pitch - 8
    b = []
    for v in (ticks or []):
        x = x0 + (v - lo) * k; b.append(ln(x, top - 8, x, bot)); b.append(tx(x, bot + 10, fmt(v) if fmt else str(v), anchor="middle"))
    if ref is not None:
        xr = x0 + (ref - lo) * k; b.append(ln(xr, top - 8, xr, bot, *ref_style))
    for i, (lab, a, c, col) in enumerate(rows):
        y = top + i * pitch
        b.append(tx(12, y + 2.5, lab, w=600))
        if a is not None and c is not None:
            xa, xc = x0 + (a - lo) * k, x0 + (c - lo) * k
            b.append(ln(xa, y, xc, y, MUTED, 1))
        if c is not None:
            xc = x0 + (c - lo) * k; b.append(diamond(xc, y, 4, col)); b.append(txk(xc, y + 13, f1(c), anchor="middle"))
        if a is not None:
            xa = x0 + (a - lo) * k; b.append(circ(xa, y, 3.5, col, INK, 0.5)); b.append(txk(xa, y - 7, f1(a), anchor="middle"))
        g = gap_fn(lab, a, c) if gap_fn else None
        if g:
            val, flagged = g
            b.append(tx(w - 12, y + 2.5, val, anchor="end"))
            if flagged: b.append(icon_at("watch", w - 12 - tw(val) - 14, y - 5))
    b.append(tx(w - 12, top - 14, "Gap", w=600, anchor="end"))
    if legend_items:
        lg, _ = legend(12, h - 13.95, legend_items); b.append(lg)
    return "".join(b)

def ch_diverge4(vals, lo, hi, left_lab, right_lab, w=PW2, h=200, caption=None):
    x0, x1 = 62, w - 34; zero = x0 + (0 - lo) / (hi - lo) * (x1 - x0); k = (x1 - x0) / (hi - lo); top = 40; pitch = 28
    bot = top + 4 * pitch - 8
    b = []
    for v in range(lo, hi + 1, 5):
        x = zero + v * k
        if v: b.append(ln(x, top - 4, x, bot))
        b.append(tx(x, bot + 10, s0(v) if v else "0", anchor="middle"))
    for i, o in enumerate(ORDER):
        y = top + i * pitch; v = vals[o]
        b.append(tx(12, y + 8.5, NAME[o], w=600)); b.append(rc(zero, y, v * k, 12, ser(o), INK, 0.5))
        if v >= 0: b.append(tx(zero + v * k + 4, y + 8.5, s2(v)))
        else: b.append(tx(zero + v * k - 4, y + 8.5, s2(v), anchor="end"))
    b.append(ln(zero, top - 4, zero, bot, INK, 0.75))
    b.append(tx(x0, bot + 21, left_lab)); b.append(tx(x1, bot + 21, right_lab, anchor="end"))
    if caption: b.append(tx(12, h - 13.95, caption))
    return "".join(b)

def gauge(cx, cy, r, sw, lo, hi, v, col, origin=None):
    """Half circle gauge, left (lo) to right (hi) over the top. No band segments (thresholds stay hidden)."""
    def p(val):
        a = math.pi * (1 - (val - lo) / (hi - lo)); return cx + r * math.cos(a), cy - r * math.sin(a)
    xa, ya = p(lo); xb, yb = p(hi); xv, yv = p(v)
    track = f'<path d="M{xa:.2f} {ya:.2f}A{r} {r} 0 0 1 {xb:.2f} {yb:.2f}" fill="none" stroke="{BAND_W}" stroke-width="{sw}"/>'
    if origin is not None:
        xo, yo = p(origin); (x_1, y_1), (x_2, y_2) = ((xo, yo), (xv, yv)) if v >= origin else ((xv, yv), (xo, yo))
        val = f'<path d="M{x_1:.2f} {y_1:.2f}A{r} {r} 0 0 1 {x_2:.2f} {y_2:.2f}" fill="none" stroke="{col}" stroke-width="{sw}"/>'
        tick = f'<line x1="{xo:.2f}" y1="{yo - sw/2 - 3:.2f}" x2="{xo:.2f}" y2="{yo + sw/2:.2f}" stroke="{INK}" stroke-width="0.75"/>'
        return track + val + tick
    val = f'<path d="M{xa:.2f} {ya:.2f}A{r} {r} 0 0 1 {xv:.2f} {yv:.2f}" fill="none" stroke="{col}" stroke-width="{sw}"/>'
    return track + val

def ch_gauges4(w=PW2, h=200):
    cells = [("Readiness overall", RD["tps"], sc(RD["tps_band"]), BRAND), (DIM_LABEL["D7"], RD["d7"], RD["d7_band"], INK),
             (DIM_LABEL["D8"], RD["d8"], RD["d8_band"], INK), (DIM_LABEL["D9"], RD["d9"], RD["d9_band"], INK)]
    b = []; cw = (w - 24) / 2
    for i, (lab, v, band, col) in enumerate(cells):
        cx = 12 + (i % 2) * cw + cw / 2; top = 30 + (i // 2) * 80; cy = top + 40; r = 30
        b.append(gauge(cx, cy, r, 7, 1, 5, float(v), col))
        b.append(tx(cx, cy - 4, f2(v), size=11, w=600, anchor="middle"))
        b.append(tx(cx - r, cy + 10, "1", anchor="middle")); b.append(tx(cx + r, cy + 10, "5", anchor="middle"))
        b.append(tx(cx, cy + 21, lab, w=600, anchor="middle")); b.append(tx(cx, cy + 30, band, anchor="middle"))
    return "".join(b)

def ch_items(w=PW2, h=200):
    lo, hi = 2.8, 3.6; x0, x1 = 50, w - 16; k = (x1 - x0) / (hi - lo); top = 50; pitch = 44
    bot = top + 2 * pitch + 16
    b = []
    for v in (2.8, 3.0, 3.2, 3.4, 3.6):
        x = x0 + (v - lo) * k; b.append(ln(x, top - 16, x, bot)); b.append(tx(x, bot + 10, f"{v:.1f}", anchor="middle"))
    for i, dk in enumerate(("D7", "D8", "D9")):
        y = top + i * pitch; items = [float(x) for x in S["readiness_items"][dk]]
        b.append(txk(12, y - 18, DIM_LABEL[dk], w=600))   # label above the row: platform names are too long for a 38 pt column
        seen = {}
        for v in items:
            n = seen.get(v, 0); seen[v] = n + 1
            b.append(circ(x0 + (v - lo) * k, y - n * 5, 2.2, WHITE, MUTED, 1))
        m = float(RD[dk.lower()]); xm = x0 + (m - lo) * k
        b.append(ln(xm, y - 12, xm, y + 7, INK, 1.5)); b.append(tx(xm, y + 15, f"Mean {f2(m)}", anchor="middle"))
        mn, mx = min(items), max(items)
        b.append(tx(x0 + (mn - lo) * k - 5, y + 2.5, f2(mn), anchor="end"))
    lg, _ = legend(12, h - 13.95, [("hollow", "One item", MUTED), ("line", "Mean", INK)]); b.append(lg)
    return "".join(b)

def ch_bigauge(v, lo, hi, band, note, w=PW2, h=200, col=BRAND, fmt=str, lo_lab=None, hi_lab=None, origin=None):
    cx, cy, r = w / 2, 118, 62
    b = [gauge(cx, cy, r, 14, lo, hi, float(v), col, origin)]
    if origin is not None: b.append(tx(cx, cy - r - 12, "0", anchor="middle"))
    b.append(tx(cx, cy - 8, fmt(v), size=24, w=700, anchor="middle"))
    b.append(f'<text x="{cx}" y="{cy+12}" font-size="8" text-anchor="middle" class="b" letter-spacing="0.5">{esc(band.upper())}</text>')
    b.append(tx(cx - r, cy + 14, lo_lab or str(lo), anchor="middle")); b.append(tx(cx + r, cy + 14, hi_lab or str(hi), anchor="middle"))
    b.append(tx(cx, cy + 36, note, size=8.5, anchor="middle", cls="c"))
    return "".join(b)

def ch_meters(rows, w=PW2, h=200):
    b = []; top = 40; x0, x1 = 12, w - 12; lead_v = max(r[1] for r in rows)
    for i, (lab, v, sub) in enumerate(rows):
        y = top + i * 40
        b.append(tx(x0, y, lab, w=600)); b.append(tx(x0, y + 9, sub, fill=MUTED))
        vs = str(v)
        b.append(tx(x1, y, vs, w=600, anchor="end"))
        if v == lead_v: b.append(icon_at("star", x1 - tw(vs, 7, 600) - 14, y - 8))
        b.append(rc(x0, y + 14, x1 - x0, 8, BAND_W)); b.append(rc(x0, y + 14, (x1 - x0) * v / 100, 8, INK))
    b.append(tx(x0, top + 3 * 40 + 6, "0", anchor="start")); b.append(tx(x1, top + 3 * 40 + 6, "100", anchor="end"))
    b.append(tx(12, h - 13.95, "Lower is better on every meter", size=8.5, cls="c"))
    return "".join(b)

def ch_voice(w=CW, h=258):
    lo, hi = -50, 50; x0, x1 = 96, w - 36; k = (x1 - x0) / (hi - lo); zero = x0 - lo * k; top = 48; pitch = 20
    bot = top + 8 * pitch - 6
    b = []
    for v in range(lo, hi + 1, 25):
        x = zero + v * k
        if v: b.append(ln(x, top - 4, x, bot))
        b.append(tx(x, bot + 10, s0(v) if v else "0", anchor="middle"))
    for i, q in enumerate(QS):
        y = top + i * pitch; v = EOS[q]; col = NEG if v < 0 else POS
        b.append(txk(12, y + 8.5, Q_LABEL[q], w=600))
        if v != 0: b.append(rc(zero, y, v * k, 12, col, INK, 0.5))
        if v >= 0: b.append(tx(zero + v * k + 4, y + 8.5, s0(v)))
        else: b.append(tx(zero + v * k - 4, y + 8.5, s0(v), anchor="end"))
    ix = float(EOS["index"]); xi = zero + ix * k
    b.append(ln(xi, top - 12, xi, bot, INK, 1, "3 2")); b.append(tx(xi + 4, top - 8, f"Index {s1(ix)}"))
    b.append(ln(zero, top - 4, zero, bot, INK, 0.75))
    b.append(tx(x0, bot + 21, "More detractors")); b.append(tx(x1, bot + 21, "More promoters", anchor="end"))
    lg, _ = legend(12, h - 13.95, [("swatch", "Below zero", NEG), ("swatch", "Above zero", POS), ("dash1", "Index", INK)]); b.append(lg)
    return "".join(b)

def ch_composition(w=PW2, h=228):
    # platform voice names run to 125 pt, so each label sits above its bar (pitch 22, bar 10)
    x0, x1 = 12, w - 12; top = 40; pitch = 22; b = []
    for i, q in enumerate(QS):
        y = top + i * pitch; d_ = EOSD[q]; n = d_["n"]; k = (x1 - x0) / n; x = x0
        b.append(tx(12, y - 2.5, Q_LABEL[q], w=600))
        for key, col, txt in (("detractors", NEG, WHITE), ("passives", BAND_S, INK), ("promoters", POS, INK)):
            wd = d_[key] * k; b.append(rc(x, y, wd, 10, col, INK, 0.5))
            if wd >= 12: b.append(tx(x + wd / 2, y + 7.5, str(d_[key]), anchor="middle", fill=txt))
            x += wd
    lg, _ = legend(12, h - 13.95, [("swatch", "Detractors", NEG), ("swatch", "Passives", BAND_S), ("swatch", "Promoters", POS)]); b.append(lg)
    return "".join(b)

# heat colours: pre mixed, no transparency
HEAT = [(-1e9, -8, NEG, WHITE, "Below \u22128"), (-8, -4, T["data"]["tint"]["perform"], INK, "\u22128 to \u22124"),
        (-4, 4, "#FFFFFF", INK, "\u22124 to +4"), (4, 8, T["data"]["tint"]["engage"], INK, "+4 to +8"), (8, 1e9, POS, INK, "Above +8")]
def heat(v):
    for a, b_, f, t, _ in HEAT:
        if a <= v < b_: return f, t
    return HEAT[-1][2], HEAT[-1][3]

def ch_heatmap(rows, w=CW, cell_h=24, show_legend=True, note=None):
    """rows: [(name, {o: value or None or 'S'})]; 'S' = suppressed."""
    name_w = 148; cw = 72; x0 = 12 + name_w; top = 34
    b = [HATCH_DEF]
    for i, o in enumerate(ORDER):
        b.append(tx(x0 + i * cw + cw / 2, top - 6, NAME[o], w=600, anchor="middle"))
    b.append(tx(x0 + 4 * cw + 12, top - 6, "Leads", w=600))
    for r, (nm, vals) in enumerate(rows):
        y = top + r * cell_h
        b.append(tx(12, y + cell_h / 2 + 2.5, nm, w=600))
        for i, o in enumerate(ORDER):
            x = x0 + i * cw; v = vals.get(o)
            if v == "S":
                b.append(rc(x, y, cw, cell_h, "url(#hatch)", GRID, 0.5))
                b.append(rc(x + 6, y + 7, cw - 12, 10, WHITE)); b.append(tx(x + cw / 2, y + 14.5, "Below threshold", anchor="middle"))
            elif v is None:
                b.append(rc(x, y, cw, cell_h, WHITE, GRID, 0.5)); b.append(tx(x + cw / 2, y + cell_h / 2 + 2.5, "No data", anchor="middle", fill=MUTED))
            else:
                f, t = heat(v); b.append(rc(x, y, cw, cell_h, f, GRID, 0.5))
                b.append(tx(x + cw / 2, y + cell_h / 2 + 3, s1(v), size=8.5, w=600 if abs(v) >= 8 else 400, anchor="middle", fill=t))
        b.append(tx(x0 + 4 * cw + 12, y + cell_h / 2 + 2.5, vals.get("_lead", "No data"), fill=None if vals.get("_lead") else MUTED))
    yb = top + len(rows) * cell_h
    if note: b.append(tx(12, yb + 14, note, size=8.5, cls="c"))
    if show_legend:
        ly = yb + (34 if note else 20)
        items = [("band", lab, f) for a, b_, f, t, lab in HEAT]
        x = 12
        for kind, lab, f in items:
            b.append(rc(x, ly - 7, 10, 8, f, INK if f == "#FFFFFF" else INK, 0.5)); b.append(tx(x + 14, ly, lab)); x += 14 + tw(lab) + 12
        b.append(rc(x, ly - 7, 10, 8, "url(#hatch)", INK, 0.5)); b.append(tx(x + 14, ly, "Below reporting threshold"))
        b.append(tx(12, ly + 13, "Difference from the organisation, in points", size=8.5, cls="c"))
    return "".join(b)

# =====================================================================
# Pages
# =====================================================================
def p_culture_now():
    pages = []
    top, sec, m = lead(NOW)
    # p9
    hl = headline(f'Perform leads the culture at <span class="c-brand" style="font-weight:700">{num(f2(NOW[top]))}</span> points, only {num(f2(m))} ahead of Engage, and people would cut it to {num(f2(PREF[top]))} if they could.')
    rows = []
    cols = {"ORG": NOW, **LENS}
    leaders = {c: max(v, key=v.get) for c, v in cols.items()}
    rank = {o: i + 1 for i, o in enumerate(sorted(ORDER, key=lambda o: -NOW[o]))}
    for o in ORDER:
        cells = [NAME[o]]
        for c in ("ORG", "PRACTICE", "STRATEGY", "LEADERSHIP"):
            v = f2(cols[c][o]); cells.append(star(v) if leaders[c] == o else v)
        cells.append(str(rank[o])); rows.append(cells)
    tbl = table([120, 76, 76, 76, 76, None], ["Orientation", "Now", "Practice", "Strategy", "Leadership", "Rank now"], rows, "table-lens", right=(1, 2, 3, 4, 5))
    flow = (hl + pair(panel("Orientation profile", HALF, 228, ch_profile(), "panel-profile"),
                      panel("Share of the culture now", HALF, 228, ch_ring(), "panel-ring"))
            + group(h2("Orientation scores by lens"), tbl)
            + sowhat(f"Delivery sets the tone today, yet the top two orientations sit {num(f2(m))} points apart. Leadership already leans Engage at {num(f2(LENS['LEADERSHIP']['ENGAGE']))}, the direction people want."))
    pages.append(page(9, flow, "The culture now, page 9", ("03", "The culture now")))
    # p10
    lead_counts = {}
    for d in DIMS: l_ = max(DNOW[d], key=DNOW[d].get); lead_counts[l_] = lead_counts.get(l_, 0) + 1
    peak_d = max(DIMS, key=lambda d: max(DNOW[d].values())); peak_o = max(DNOW[peak_d], key=DNOW[peak_d].get)
    hl2 = headline(f'Each orientation leads at least one of the six dimensions. Perform peaks at {num(f2(DNOW[peak_d][peak_o]))} in {DIM_LABEL[peak_d]}; Engage and Perform lead two each.')
    rows = []
    for d in DIMS:
        l_ = max(DNOW[d], key=DNOW[d].get)
        rows.append([DIM_LABEL[d]] + [star(f2(DNOW[d][o])) if o == l_ else f2(DNOW[d][o]) for o in ORDER] + [NAME[l_]])
    rows.append([ "Organisation"] + [star(f2(NOW[o])) if o == top else f2(NOW[o]) for o in ORDER] + [NAME[top]])
    tbl2 = table([120, 74, 74, 74, 74, None], ["Dimension", "Engage", "Innovate", "Perform", "Govern", "Leads"], rows, "table-dimensions", right=(1, 2, 3, 4))
    flow2 = (group(h1("3.2", "The six dimensions"), hl2)
             + panel("Six dimensions, now", CW, 236, ch_grouped(DNOW), "panel-dimensions")
             + group(h2("Dimension scores, now"), tbl2)
             + sowhat(f"With four different leaders across six dimensions, people meet a different culture depending on where they look. {DIM_LABEL['D4']} is the most Perform driven at {num(f2(DNOW['D4']['PERFORM']))}."))
    pages.append(page(10, flow2, "The culture now, page 10"))
    # p11
    lrows = [("Organisation",) + lead(NOW)] + [(l.capitalize(),) + lead(LENS[l]) for l in ("PRACTICE", "STRATEGY", "LEADERSHIP")]
    drows = [(DIM_LABEL[d],) + lead(DNOW[d]) for d in DIMS]
    hl3 = headline(f'Practice leans Perform at {num(f2(LENS["PRACTICE"]["PERFORM"]))}, strategy Govern at {num(f2(LENS["STRATEGY"]["GOVERN"]))} and leadership Engage at {num(f2(LENS["LEADERSHIP"]["ENGAGE"]))}: three lenses, three different leaders.')
    cong = S["congruence"]; strength = S["culture_strength"]; ent = S["analytics"]["entropy"]
    gov_peak = max(DIMS, key=lambda d: float(DISP[d]["GOVERN"]))
    rows3 = [
        ["Culture strength", strength, sc(S["strength_band"]), f"No orientation dominates; the lead is {f2(m)} points."],
        ["Strategy congruence", cong["dimension_pct"] + "%", sc(cong["band"]), "Practice, strategy and leadership each favour a different orientation."],
        ["Spread of answers", DISP["overall"], "Not banded", f"Govern answers vary most, up to {DISP[gov_peak]['GOVERN']} in {DIM_LABEL[gov_peak]}."],
        ["Culture entropy", ent["score"], sc(ent["band"]), "Answers are spread across orientations rather than settled on one."],
    ]
    tbl3 = table([120, 60, 100, None], ["Indicator", "Score", "Rating", f"What it means for {esc(g1.CLIENT)}"], rows3, "table-strength", right=(1,))
    flow3 = (group(h1("3.3", "Strength and consistency"), hl3)
             + pair(panel("Lead margin by lens", HALF, 228, ch_margin([(a, b_, c, d_) for a, b_, c, d_ in lrows], pitch=36), "panel-lens-margin"),
                    panel("Lead margin by dimension", HALF, 228, ch_margin([(a, b_, c, d_) for a, b_, c, d_ in drows], pitch=26), "panel-dim-margin"))
             + group(h2("Strength and consistency"), tbl3)
             + sowhat(f"A diffuse culture is easier to move than a settled one. The risk is mixed signals: strategy asks for Govern while daily practice rewards Perform."))
    pages.append(page(11, flow3, "The culture now, page 11"))
    return html_doc("CDP report: the culture now", pages)

def p_culture_gap():
    pages = []
    hl = headline(f'People want Engage up by {num(f2(GAP["ENGAGE"]))} points and Perform down by {num(f2(abs(GAP["PERFORM"])))}; all four gaps are in the significant band.')
    cls = S["classification"]
    rows = [[NAME[o], f2(NOW[o]), f2(PREF[o]), star(s2(GAP[o])) if o == max(GAP, key=lambda k: abs(GAP[k])) else s2(GAP[o]),
             sc(S["analytics"]["gap_bands"][o]), sc(cls[o])] for o in ORDER]
    tbl = table([120, 70, 70, 70, 84, None], ["Orientation", "Now", "Preferred", "Gap", "Class", "Direction"], rows, "table-gap", right=(1, 2, 3))
    flow = (hl + pair(panel("Gap by orientation", HALF, 200, ch_gapbands(), "panel-gap"),
                      panel("Now and Preferred", HALF, 200, ch_arrows(), "panel-now-pref"))
            + group(h2("Gap by orientation"), tbl)
            + sowhat(f"The wish is clear and shared: build Engage and Innovate, ease off Perform and Govern. A gap of {num(f2(GAP['ENGAGE']))} on Engage is the largest single move."))
    pages.append(page(12, flow, "The culture gap, page 12", ("04", "The culture gap")))
    # p13
    big_d, big_o = max(((d, o) for d in DIMS for o in ORDER), key=lambda t: abs(DGAP[t[0]][t[1]]))
    same = all(DGAP[d]["ENGAGE"] > 0 and DGAP[d]["INNOVATE"] > 0 and DGAP[d]["PERFORM"] < 0 and DGAP[d]["GOVERN"] < 0 for d in DIMS)
    hl2 = headline(("Every dimension wants more Engage and Innovate and less Perform and Govern; " if same else "")
                   + f'the largest shift is {NAME[big_o]} in {DIM_LABEL[big_d]}, {"down" if DGAP[big_d][big_o] < 0 else "up"} {num(f2(abs(DGAP[big_d][big_o])))}.')
    rows = []
    for d in DIMS:
        mo = max(ORDER, key=lambda o: abs(DGAP[d][o]))
        rows.append([DIM_LABEL[d]] + [star(s2(DGAP[d][o])) if o == mo else s2(DGAP[d][o]) for o in ORDER] + [f"{NAME[mo]}, {s2(DGAP[d][mo])}"])
    tbl2 = table([120, 70, 70, 70, 70, None], ["Dimension", "Engage", "Innovate", "Perform", "Govern", "Largest shift"], rows, "table-dim-gap", right=(1, 2, 3, 4))
    flow2 = (group(h1("4.2", "Gap by dimension"), hl2)
             + panel("Gap by dimension, Preferred minus Now", CW, 246, ch_grouped(DGAP, h=246, signed=True), "panel-dim-gap")
             + group(h2("Gap by dimension, in points"), tbl2)
             + sowhat(f"Because every dimension pulls the same way, one coherent programme can serve them all. {DIM_LABEL['D5']} needs the most care: Govern there falls {num(f2(abs(DGAP['D5']['GOVERN'])))} points."))
    pages.append(page(13, flow2, "The culture gap, page 13"))
    # p14
    tens = S["analytics"]["tensions"]
    hl3 = headline(f'Two tensions run high at {num(tens[0]["score"])}, Engage against Perform and Innovate against Govern, and Govern answers vary most.')
    rows = []
    for d in DIMS:
        mo = max(ORDER, key=lambda o: float(DISP[d][o]))
        rows.append([DIM_LABEL[d]] + [star(DISP[d][o]) if o == mo else DISP[d][o] for o in ORDER] + [DISP[d]["avg"]])
    rows.append(["All dimensions"] + [f2(disp_mean(o)) for o in ORDER] + [DISP["overall"]])
    tbl3 = table([120, 70, 70, 70, 70, None], ["Dimension", "Engage", "Innovate", "Perform", "Govern", "Average"], rows, "table-spread", right=(1, 2, 3, 4, 5))
    flow3 = (group(h1("4.3", "Tensions and spread"), hl3)
             + pair(panel("Tension pairs", HALF, 200, ch_tension(), "panel-tension"),
                    panel("Spread of answers", HALF, 200, ch_spread(), "panel-spread"))
             + group(h2("Spread of answers by dimension"), tbl3)
             + sowhat(f"Moving Engage up means asking Perform to give ground, and the two pull against each other at {num(tens[0]['score'])}. Govern carries the least agreement, so changes there need the clearest explanation."))
    pages.append(page(14, flow3, "The culture gap, page 14"))
    return html_doc("CDP report: the culture gap", pages)

VERD = {"HIT": ("hit", "Hit", "check"), "PARTIAL_HIT": ("partial", "Partial hit", "partial"), "MISS": ("miss", "Miss", "cross")}
CHECK_NAME = {"C1": "Strategy", "C2": "Leadership behaviour", "C3": "Systems", "C4": "Business model"}
def check_content():
    f = {x["type"][:2]: x for x in FIND if x["type"][:2] in ("C1", "C2", "C3", "C4")}
    c2p = f["C2"]["evidence"]["profile"]; off = f["C3"]["evidence"]["offending"][0]
    return {
        "C1": (f2(NOW["INNOVATE"]), "Innovate now, lowest of four",
               "The strategy relies on new business models, but Innovate is the weakest orientation in the culture today."),
        "C2": (f2(c2p["ENGAGE"]), "Engage in leadership, ranked first",
               "Leaders already show the Engage behaviour the strategy asks for; it ranks first in how leadership works."),
        "C3": (s2(GAP[off]), f"{NAME[off]}, the shift people want",
               "People want less Perform, the orientation the business runs on. Cutting it too far puts the identity at risk."),
        "C4": (f2(NOW["ENGAGE"]), "Engage now, the weaker of the pair",
               f"A consumer service model needs Engage and Perform together. Perform holds at {f2(NOW['PERFORM'])}; Engage trails."),
    }

def verdict_tile(v, w=100.82):
    kind, word, ic = VERD[v] if v in VERD else ("flag", v, "watch")
    bg = {"hit": "var(--verdict-hit)", "partial": "var(--verdict-partial)", "miss": "var(--verdict-miss)", "flag": INK}[kind]
    on = {"hit": "var(--verdict-hit-on)", "partial": "var(--verdict-partial-on)", "miss": "var(--verdict-miss-on)", "flag": WHITE}[kind]
    return (f'<div class="t-kpi-label" style="background:{bg};color:{on};border-radius:var(--radius-1);height:24pt;min-width:{w}pt;display:flex;align-items:center;gap:4pt;padding:0 8pt;flex:none;white-space:nowrap">'
            f'{icon(ic, on)}<span>{esc(word)}</span></div>')

def verdict_card(code, v, number, nlabel, evidence):
    return (f'<article class="panel" data-block="verdict-card" style="padding:12pt" aria-label="{code} {CHECK_NAME[code]}">'
            f'<div class="t-kpi-label c-ink">{code} \u00b7 {esc(CHECK_NAME[code])}</div>'
            f'<div style="display:flex;align-items:center;gap:12pt;margin-top:8pt">{verdict_tile(v)}'
            f'<div><div class="t-kpi-value c-ink">{num(number)}</div></div></div>'
            f'<div class="t-kpi-label c-ink" style="margin-top:4pt">{esc(nlabel)}</div>'
            f'<p class="t-body c-ink" style="margin-top:8pt">{esc(evidence)}</p></article>')

def finding_small(v, word, ic, number, nlabel, lines, w=HALF):
    kind = VERD[v][0] if v in VERD else "flag"
    tile = verdict_tile(v) if v in VERD else (f'<div class="t-kpi-label" style="background:{INK};color:{WHITE};border-radius:var(--radius-1);height:24pt;min-width:100.82pt;display:flex;align-items:center;gap:4pt;padding:0 8pt;flex:none;white-space:nowrap">{icon(ic, WHITE)}<span>{esc(word)}</span></div>')
    rows = "".join(f'<p class="t-body c-ink" style="margin-top:4pt"><b class="t-body-strong">{esc(a)}.</b> {b}</p>' for a, b in lines)
    return (f'<article class="card" data-block="finding-card-small" style="width:{w}pt;padding:12pt">'
            f'<div style="display:flex;align-items:center;gap:12pt">{tile}<div class="t-kpi-value c-ink">{num(number)}</div></div>'
            f'<div class="t-kpi-label c-ink" style="margin-top:4pt">{esc(nlabel)}</div>'
            f'<div style="margin-top:4pt">{rows}</div></article>')

def p_strategy():
    pages = []; cc = check_content()
    hits = sum(v == "HIT" for v in CHECKS.values())
    hl = headline(f'{hits} of {len(CHECKS)} strategy checks is a full hit: leadership behaviour. The innovation goal is a miss, with Innovate at <span class="c-brand" style="font-weight:700">{num(f2(NOW["INNOVATE"]))}</span>.')
    cards = "".join(verdict_card(c, CHECKS[c], *cc[c]) for c in ("C1", "C2", "C3", "C4"))
    grid = f'<div data-block="verdict-grid" style="display:grid;grid-template-columns:{HALF}pt {HALF}pt;gap:16pt">{cards}</div>'
    sev = {x["type"][:2]: x["severity"] for x in FIND if x["type"][:2] in CHECK_NAME}
    orient = {x["type"][:2]: x["orientation"] for x in FIND if x["type"][:2] in CHECK_NAME}
    rows = []
    for c in ("C1", "C2", "C3", "C4"):
        kind, word, ic = VERD[CHECKS[c]]
        os_ = orient[c]
        rows.append([f"{c} {CHECK_NAME[c]}", sig(ic, word), ", ".join(NAME[o] for o in os_),
                     " / ".join(f2(NOW[o]) for o in os_), " / ".join(f2(PREF[o]) for o in os_), sc(sev[c])])
    tbl = table([116, 78, 88, 82, 82, None], ["Check", "Verdict", "Rests on", "Now", "Preferred", "Severity"], rows, "table-checks", right=(3, 4))
    flow = (hl + grid + group(h2("The scores behind each check"), tbl)
            + sowhat(f"Leadership is the one full hit. The other three checks fall short on what the culture rewards today, with Perform at {num(f2(NOW['PERFORM']))} ahead of Engage and Innovate."))
    pages.append(page(15, flow, "Strategy checks, page 15", ("05", "Strategy checks")))
    # p16: evidence by check, small finding cards
    c2p = [x for x in FIND if x["type"].startswith("C2")][0]["evidence"]["profile"]
    cards = [
        ("MISS", "Miss", "cross", f2(NOW["INNOVATE"]), "Innovate now", [
            ("Finding", f"Innovate is last of four at {f2(NOW['INNOVATE'])}, while the strategy depends on new models."),
            ("Evidence", f"People would raise it to {f2(PREF['INNOVATE'])}, a shift of {s2(GAP['INNOVATE'])}."),
            ("Consequence", "New model work competes for time with targets that reward today\u2019s delivery."),
            ("Action", "Ring fence time and budget for a few pilots. <b>Owner:</b> executive team. <b>Timing:</b> first 90 days.")]),
        ("HIT", "Hit", "check", f2(c2p["ENGAGE"]), "Engage in leadership", [
            ("Finding", "Leadership behaviour already matches the Engage target the strategy sets."),
            ("Evidence", f"Engage ranks first in the leadership profile at {f2(c2p['ENGAGE'])}, ahead of Perform at {f2(c2p['PERFORM'])}."),
            ("Consequence", "Leaders can model the change, provided staff see the same behaviour."),
            ("Action", "Use leaders as visible sponsors of Engage work. <b>Owner:</b> chief executive. <b>Timing:</b> from launch.")]),
        ("PARTIAL_HIT", "Partial hit", "partial", s2(GAP["PERFORM"]), "Perform, the shift wanted", [
            ("Finding", "Systems would have to stop rewarding some Perform habits people no longer want."),
            ("Evidence", f"Perform would fall from {f2(NOW['PERFORM'])} to {f2(PREF['PERFORM'])}; it is the culture\u2019s current anchor."),
            ("Consequence", "Cutting too fast risks losing the delivery discipline clients rely on."),
            ("Action", "Review targets and rewards before changing them. <b>Owner:</b> finance and HR leads. <b>Timing:</b> first 120 days.")]),
        ("PARTIAL_HIT", "Partial hit", "partial", f2(NOW["ENGAGE"]), "Engage now", [
            ("Finding", "The consumer service model needs Engage and Perform together; only Perform is in place."),
            ("Evidence", f"Perform stands at {f2(NOW['PERFORM'])}, Engage at {f2(NOW['ENGAGE'])}, while people want Engage at {f2(PREF['ENGAGE'])}."),
            ("Consequence", "Service quality depends on goodwill that the culture does not yet build."),
            ("Action", "Make customer care part of team goals. <b>Owner:</b> operations lead. <b>Timing:</b> first 90 days.")]),
    ]
    grid2 = f'<div data-block="finding-grid" style="display:grid;grid-template-columns:{HALF}pt {HALF}pt;gap:16pt">{"".join(finding_small(*c) for c in cards)}</div>'
    hl2 = headline(f"Two checks are partial hits, and both turn on the same trade: building Engage without losing the Perform strength at {num(f2(NOW['PERFORM']))}.")
    flow2 = (group(h1("5.2", "Evidence by check"), hl2) + grid2
             + sowhat(f"The strategy is not blocked by leaders, who already lead with Engage. It is held back by a culture that rewards delivery over new ideas, with Innovate at {num(f2(NOW['INNOVATE']))}."))
    pages.append(page(16, flow2, "Strategy checks, page 16"))
    return html_doc("CDP report: strategy checks", pages)

def p_exec_staff():
    flagged = [o for o in ORDER if PFLAG[o] != "NONE"]
    o1 = flagged[0] if flagged else max(PG, key=PG.get)
    hl = headline(f'Executives rate Engage <span class="c-brand" style="font-weight:700">{num(f2(PG[o1]))}</span> points higher than staff do, the one gap wide enough to flag as a shadow culture.')
    rows_d = [(NAME[o], EX[o], ST[o], ser(o)) for o in ORDER]
    gapf = lambda lab, a, c: (f2(abs(a - c)), PFLAG[lab.upper()] != "NONE")
    dumb = ch_dumbbell(rows_d, 15, 35, ticks=[15, 20, 25, 30, 35], ref=25, fmt=lambda v: str(v), gap_fn=gapf,
                       legend_items=[("dot", "Executives", INK), ("diamond", "Staff", INK), ("dash", "Even share, 25", INK)])
    diffs = {o: round(EX[o] - ST[o], 2) for o in ORDER}
    div = ch_diverge4(diffs, -10, 10, "Staff higher", "Executives higher", caption="Executives minus staff, in points")
    rows = []
    for o in ORDER:
        fl = PFLAG[o]
        rows.append([NAME[o], f2(EX[o]), f2(ST[o]), f2(PG[o]), "Executives" if EX[o] > ST[o] else "Staff",
                     sig("watch", sc(fl)) if fl != "NONE" else "No flag"])
    tbl = table([104, 84, 70, 56, 84, None], [ "Orientation", f"Executives, {EXN}", f"Staff, {STN}", "Gap", "Higher group", "Flag"], rows, "table-cohorts", right=(1, 2, 3))
    sc5 = [s_ for s_ in SCEN if s_["scenario_id"] == "SC-05"][0]
    qs = "".join(f'<li style="display:flex;gap:8pt;align-items:flex-start;margin-top:{0 if i==0 else 8}pt"><span class="t-kpi-label" style="flex:none;width:16pt;height:16pt;border-radius:8pt;background:var(--color-brand);color:var(--color-ink);display:flex;align-items:center;justify-content:center;letter-spacing:0">{i+1}</span><span class="t-body c-ink" style="padding-top:1pt">{esc(q)}</span></li>' for i, q in enumerate(sc5["hypotheses"]))
    qblock = group(h2("Questions to test with the executive team", "h2-questions"), f'<ol data-block="numbered-list" style="list-style:none">{qs}</ol>')
    flow = (hl + pair(panel("Executives and staff, now", HALF, 200, dumb, "panel-dumbbell"),
                      panel("Who scores higher", HALF, 200, div, "panel-who-higher"))
            + group(h2("Executives and staff by orientation"), tbl) + qblock
            + sowhat(f"Executives see a warmer, more engaged organisation than staff describe: {num(f2(EX[o1]))} against {num(f2(ST[o1]))}. Messages from the top will land as out of touch until that gap is heard."))
    return html_doc("CDP report: executives and staff", [page(17, flow, "Executives and staff, page 17", ("06", "Executives and staff"))])

def p_readiness():
    pages = []
    hl = headline(f'Readiness for change stands at <span class="c-brand" style="font-weight:700">{num(RD["tps"])}</span>, in the enablement required band: people are open to change but need support before it is scaled.')
    rows = [["Readiness overall", RD["tps"], sc(RD["tps_band"]), "", ""]]
    for dk in ("D7", "D8", "D9"):
        it = [float(x) for x in S["readiness_items"][dk]]
        rows.append([DIM_LABEL[dk], f2(RD[dk.lower()]), RD[dk.lower() + "_band"], f2(min(it)), f2(max(it))])
    rows.append(["Leadership alignment", f2(RD["leadership_alignment"]), "Not banded", "", ""])
    lowest = min(((dk, float(v)) for dk in ("D7", "D8", "D9") for v in S["readiness_items"][dk]), key=lambda t: t[1])
    tbl = table([130, 60, 130, 90, None], ["Measure", "Score", "Band", "Lowest item", "Highest item"], rows, "table-readiness", right=(1, 3, 4))
    flow = (hl + pair(panel("Readiness gauges", HALF, 200, ch_gauges4(), "panel-gauges"),
                      panel("Readiness items", HALF, 200, ch_items(), "panel-items"))
            + group(h2("Readiness by dimension"), tbl)
            + sowhat(f"Willingness is there, but the floor is low: the weakest item sits at {num(f2(lowest[1]))} in {DIM_LABEL[lowest[0]].lower()}. Build skills and safety first, then scale."))
    pages.append(page(18, flow, "Readiness and risk, page 18", ("07", "Readiness and risk")))
    # p19
    meters = sorted([("Spread of answers", int(RISK["dispersion"]), "How far answers differ"), ("Culture gap", int(RISK["gap"]), "Distance from Now to Preferred"),
                     ("Misalignment", int(RISK["misalignment"]), "Source: " + sc(RISK["misalignment_source"]))], key=lambda r: -r[1])
    hl2 = headline(f'The Culture Risk Index stands at {num(RISK["index"])}, in the {RISK["band"].lower()} band; the spread of answers, at {num(RISK["dispersion"])}, is the largest driver.')
    drows = []
    gov_peak = max(DIMS, key=lambda d: float(DISP[d]["GOVERN"]))
    explain = {"Spread of answers": f"Govern answers vary most, up to {DISP[gov_peak]['GOVERN']} in {DIM_LABEL[gov_peak]}.",
               "Culture gap": "All four orientation gaps are in the significant band.",
               "Misalignment": f"Executives and staff see Engage {f2(PG['ENGAGE'])} points apart."}
    for lab, v, sub in meters:
        drows.append([lab, star(str(v)) if v == meters[0][1] else str(v), explain[lab]])
    tbl = table([140, 64, None], ["Driver", "Score", f"What drives it at {esc(g1.CLIENT)}"], drows, "table-drivers", right=(1,))
    sev_icon = {"CRITICAL": "watch", "HIGH": "watch", "MEDIUM": None, "LOW": None}
    srows = [[esc(s_["name"]), sig(sev_icon[s_["severity"]], sc(s_["severity"])), esc(s_["diagnosis"]), "<br>".join(esc(r_) for r_ in s_["risks"][:2])] for s_ in SCEN]
    stbl = table([120, 74, 140, None], ["Scenario", "Severity", "Diagnosis", "Main risks"], srows, "table-scenarios")
    flow2 = (group(h1("7.2", "Culture Risk Index"), hl2)
             + pair(panel("Culture Risk Index", HALF, 200, ch_bigauge(RISK["index"], 0, 100, RISK["band"], "Lower is better"), "panel-risk-gauge"),
                    panel("Health meters", HALF, 200, ch_meters(meters), "panel-meters"))
             + group(h2("Risk drivers"), tbl)
             + group(h2("Risk scenarios the platform found"), stbl)
             + sowhat(f"Disagreement drives the risk more than the gap itself. Govern answers range up to {DISP[gov_peak]['GOVERN']}, so agree what good Govern looks like before changing it."))
    pages.append(page(19, flow2, "Readiness and risk, page 19"))
    return html_doc("CDP report: readiness and risk", pages)

def p_voice():
    pages = []
    neg = [q for q in QS if EOS[q] < 0]; low = min(QS, key=lambda q: EOS[q]); hi = max(QS, key=lambda q: EOS[q])
    hl = headline(f'{wd(len(neg), True)} of the eight voice scores are below zero. {Q_LABEL[low]} is lowest at <span class="c-brand" style="font-weight:700">{num(s0(EOS[low]))}</span>; {Q_LABEL[hi].lower()} leads at {num(s0(EOS[hi]))}.')
    rows = []
    for q in QS:
        d_ = EOSD[q]; v = EOS[q]
        if q in FLAGGED_Q: sg = sig("watch", sc(FLAGGED_Q[q]))
        elif v > 0: sg = sig("check", "Positive")
        else: sg = sig(None, "Below zero")
        rows.append([Q_LABEL[q], star(s0(v)) if q == hi else s0(v), str(d_["promoters"]), str(d_["passives"]), str(d_["detractors"]), sg])
    tbl = table([170, 50, 66, 62, 70, None], ["Voice score", "Score", "Promoters", "Passives", "Detractors", "Signal"], rows, "table-voice", right=(1, 2, 3, 4))
    flow = (hl + panel("Employee voice scores", CW, 258, ch_voice(), "panel-voice")
            + group(h2("Voice scores in detail"), tbl)
            + sowhat(f"Critics outnumber supporters on half the scores. {Q_LABEL[hi]}, at {num(s0(EOS[hi]))}, shows what people value; start the listening there and on {Q_LABEL[low].lower()}."))
    pages.append(page(20, flow, "Employee voice, page 20", ("08", "Employee voice")))
    low = min(QS, key=lambda q: EOS[q]); hi = max(QS, key=lambda q: EOS[q])
    most_det = max(QS, key=lambda q: EOSD[q]["detractors"])
    hl2 = headline(f'On {Q_LABEL[most_det].lower()}, {num(EOSD[most_det]["detractors"])} of {num(EOSD[most_det]["n"])} people are detractors and only {wd(EOSD[most_det]["promoters"])} are promoters.')
    themes = table([150, 70, None], ["Theme", "Share", "What people said"], [[esc(r["theme"]), f'{r["share_pct"]}%', esc(r["what_people_say"])] for r in TH["rows"]] or [empty_row(3, "No comment themes in this data set. The platform supplies themes when written comments are collected.")], "table-themes", right=(1,))
    flow2 = (group(h1("8.2", "Who says what, and themes"), hl2)
             + pair(panel("Who says what", HALF, 240, ch_composition(h=240), "panel-composition"),
                    panel("Voice index", HALF, 240, ch_bigauge(EOS["index"], -100, 100, "Above zero" if float(EOS["index"]) > 0 else ("Below zero" if float(EOS["index"]) < 0 else "At zero"), f"Lowest {s0(EOS[low])}, highest {s0(EOS[hi])}", h=240, col=BRAND, fmt=lambda v: s1(v), lo_lab=MINUS + "100", hi_lab="+100", origin=0), "panel-voice-index"))
            + group(h2("Themes from written comments"), themes)
            + sowhat(f"The index sits just above zero at {num(s1(EOS['index']))}: strong scores mask {wd(len(neg))} weak ones. {TH['rows'][0]['theme']} leads the comments from {TH['commenters']} people, at {TH['rows'][0]['share_pct']}%."))
    pages.append(page(21, flow2, "Employee voice, page 21"))
    return html_doc("CDP report: employee voice", pages)

def p_departments():
    pages = []
    div = [d_ for d_ in DEPTS if d_["divergence"]]
    big = max(((d_, o) for d_ in DEPTS for o in ORDER), key=lambda t: abs(t[0]["diff"][t[1]]))
    hl = headline(f'{wd(len(div), True)} of {wd(len(DEPTS))} departments are led by a different orientation. The widest gap is {big[0]["name"]} on {NAME[big[1]]}, <span class="c-brand" style="font-weight:700">{num(s1(big[0]["diff"][big[1]]))}</span>.')
    rows = [(d_["name"], dict(d_["diff"], _lead=NAME[d_["dominant"]])) for d_ in DEPTS]
    hm = ch_heatmap(rows)
    ph = 34 + len(rows) * 24 + 36 + 12
    trows = []
    for d_ in DEPTS:
        v = ", ".join(f"{Q_LABEL[q]} ({sc(s_)})" for q, s_ in d_.get("voice", [])) or "None"
        lead_ = NAME[d_["dominant"]] + ("" if not d_["divergence"] else ", differs")
        fnd = f"Subculture ({sc(d_['severity'])})" if d_["severity"] else "None"
        trows.append([esc(d_["name"]), str(d_["n"]), lead_, fnd, v])
    tbl = table([110, 52, 112, 106, None], ["Department", "People", "Leading orientation", "Platform finding", "Voice flags"], trows, "table-departments", right=(1,))
    flow = (hl + panel("Departments by orientation", CW, ph, hm, "panel-heatmap")
            + group(h2("Department summary"), tbl)
            + sowhat(f"Programmes for the whole organisation will land unevenly. Plan separate conversations with {', '.join(d_['name'] for d_ in div[:-1])} and {div[-1]['name']} before launch."))
    pages.append(page(22, flow, "Departments, page 22", ("09", "Departments")))
    by = {d_["name"]: d_ for d_ in DEPTS}
    def hl_for(ds):
        parts = []
        for d_ in ds:
            o = d_["dominant"]
            if d_["divergence"]: parts.append(f"{d_['name']} leads with {NAME[o]} at {num(f1(d_['scores'][o]))}")
            else: parts.append(f"{d_['name']} follows the organisation on {NAME[o]}")
        return "; ".join(parts) + "."
    chunks = [DEPTS[i:i + 3] for i in range(0, len(DEPTS), 3)]
    for ci, ch in enumerate(chunks):
        no = 23 + ci
        flow2 = group(h1("9.2", "Department profiles" + (", continued" if ci else "")), headline(hl_for(ch))) + "".join(dept_card(d_) for d_ in ch)
        pages.append(page(no, flow2, f"Departments, page {no}"))
    return html_doc("CDP report: departments", pages)

def dept_card(d_, h=140):
    """Department comparison card: organisation Now (tint) above department Now (solid), per orientation."""
    w = CW; x0, x1 = 64, 215; k = (x1 - x0) / 40; b = []
    sco = d_.get("scores", {})
    b.append(tx(12, 19, "Department and organisation, now", w=600))
    for i, o in enumerate(ORDER):
        y = 30 + i * 22
        b.append(tx(12, y + 9, NAME[o], w=600))
        b.append(rc(x0 + 0.5, y + 0.5, NOW[o] * k - 1, 7, tint(o), ser(o), 1)); b.append(tx(x0 + NOW[o] * k + 4, y + 7, f1(NOW[o])))
        if sco.get(o) is not None:
            b.append(rc(x0, y + 9, sco[o] * k, 7, ser(o), INK, 0.5)); b.append(tx(x0 + sco[o] * k + 4, y + 16, f1(sco[o])))
    b.append(ln(x0, 28, x0, 30 + 4 * 22 - 4, INK, 0.75))
    if sco:
        lg, _ = legend(12, h - 13.95, [("tintbar", "Organisation", None), ("solidbar", "Department", None)]); b.append(lg)
    else:
        b.append(tx(12, h - 13.95, "No department scores in this data set; organisation shown.", size=8.5, cls="c"))
    right = (f'<div class="abs" style="left:257.64pt;top:12pt;width:229.64pt">'
             f'<h3 class="t-h2 c-ink">{esc(d_["name"])}</h3>'
             f'<div class="t-kpi-label c-ink" style="margin-top:4pt">People: {d_.get("n", "not supplied")}</div>'
             f'<p class="t-body c-ink" style="margin-top:8pt"><b class="t-body-strong">Leading orientation.</b> {NAME[d_["dominant"]]}{", unlike the organisation." if d_["divergence"] else ", the same as the organisation."} Largest difference: {NAME[max(ORDER, key=lambda o: abs(d_["diff"][o]))]}, {s1(d_["diff"][max(ORDER, key=lambda o: abs(d_["diff"][o]))])} points.</p>'
             f'<p class="t-body c-ink" style="margin-top:4pt"><b class="t-body-strong">Finding.</b> {("Subculture confirmed, " + d_["severity"].lower() + " severity.") if d_["severity"] else "No subculture finding from the platform."}</p>'
             + (f'<p class="t-body c-ink" style="margin-top:4pt">{icon("watch")} <b class="t-body-strong">Voice flag.</b> {", ".join(Q_LABEL[q] + ", " + s_.lower() for q, s_ in d_["voice"])}.</p>' if d_.get("voice") else "")
             + '</div>')
    return f'<article class="panel rel" data-block="dept-card" style="height:{h}pt" aria-label="{esc(d_["name"])}">{svg(w, h, "".join(b), d_["name"] + " compared with the organisation")}{right}</article>'

def p_360():
    w, h = CW, 236
    x0, x1 = 140, w - 60; lo, hi = 1, 5; k = (x1 - x0) / (hi - lo); top = 40; bot = 170
    b = []
    for v in (1, 2, 3, 4, 5):
        x = x0 + (v - lo) * k; b.append(ln(x, top - 8, x, bot)); b.append(tx(x, bot + 10, f"{v:.2f}", anchor="middle"))
    xr = x0 + 2 * k; b.append(ln(xr, top - 8, xr, bot, BRAND, 1, "3 2")); b.append(tx(xr + 4, top - 12, "Flag line 3.00"))
    msg = "Section scores for self and others are not in this data set."
    b.append(rc((x0 + x1) / 2 - 140, (top + bot) / 2 - 12, 280, 18, WHITE)); b.append(tx((x0 + x1) / 2, (top + bot) / 2, msg, size=10, anchor="middle", cls="c"))
    lg, _ = legend(12, h - 13.95, [("dot", "Self", INK), ("diamond", "Others", INK), ("dash1", "Flag line, 3.00", BRAND)]); b.append(lg)
    L = L360; bd = L["bands"]
    hl = headline(f'{wd(L["valid"], True)} of {wd(L["leaders"])} leaders have a valid 360 result. <span class="c-brand" style="font-weight:700">{wd(bd["Ready with support"], True)}</span> are ready with support and {wd(bd["Enablement required"])} need enablement first.')
    rows = [["Leaders in the 360", num(L["leaders"]), f"Valid results need at least {L['min_rater_forms']} rater forms"],
            ["Valid results", num(f"{L['valid']} of {L['leaders']}"), "Only valid results count in the pattern below"]]
    rows += [[esc(k_), num(f"{v_} of {L['valid']}"), "Readiness band from the 360"] for k_, v_ in bd.items()]
    rows += [["Most common growth area", NAME[L["most_common_growth"]], "The orientation most leaders are asked to grow"],
             ["Most common default", NAME[L["most_common_default"]], "The orientation most leaders fall back on"]]
    rows += [[f"Flag: {esc(k_)}", num(f"{v_} of {L['valid']}"), "Counted across leaders; never shown by name"] for k_, v_ in L["flags"].items()]
    tbl = table([150, 90, None], ["Measure", "Result", "What it shows"], rows, "table-360", right=(1,))
    flow = (hl + panel("Self and others by section", CW, h, "".join(b), "panel-360")
            + group(h2("The collective leadership pattern"), tbl)
            + sowhat(f"Leaders default to {NAME[L['most_common_default']]} while the strategy asks for {NAME[L['most_common_growth']]}. Coach the {wd(bd['Enablement required'])} leaders who need enablement before the Innovate pilots start."))
    return html_doc("CDP report: leadership 360 summary", [page(25, flow, "Leadership 360 summary, page 25", ("10", "Leadership 360 summary"))])

def p_meaning():
    hits = sum(v == "HIT" for v in CHECKS.values()); neg = [q for q in QS if EOS[q] < 0]
    top, sec, m = lead(NOW)
    steps = [
        ("Where the culture is", f2(NOW[top]), f"{NAME[top]} leads, now", f"Delivery sets the tone, but Engage sits only {f2(m)} points behind."),
        ("Where it wants to go", s2(GAP["ENGAGE"]), "Engage, the largest shift", "More Engage and Innovate, less Perform and Govern, in every dimension."),
        ("Where it falls short", f"{hits} of {len(CHECKS)}", "Strategy checks fully met", f"The innovation goal misses: Innovate is lowest at {f2(NOW['INNOVATE'])}."),
        ("What holds it back", f2(PG["ENGAGE"]), "Points apart on Engage", f"Leaders and staff see two organisations, and {wd(len(neg))} of eight voice scores are below zero."),
    ]
    colw = (CW - 24 - 48) / 4
    b = [ln(12 + 8, 20, 12 + 3 * (colw + 16) + 8, 20, BRAND, 0.75)]
    cols = ""
    for i, (lab, v, cap, body) in enumerate(steps):
        x = 12 + i * (colw + 16)
        b.append(circ(x + 8, 20, 8, BRAND))
        b.append(f'<text x="{x+8}" y="{20+2.9}" font-size="8" font-weight="700" text-anchor="middle">{i+1}</text>')
        cols += (f'<div class="abs" style="left:{round(x,2)}pt;top:36pt;width:{round(colw,2)}pt">'
                 f'<div class="t-kpi-label c-ink" style="min-height:20pt">{esc(lab)}</div>'
                 f'<div class="t-kpi-value c-ink" style="margin-top:4pt">{num(v)}</div>'
                 f'<div class="t-caption c-ink" style="margin-top:4pt;min-height:24pt">{esc(cap)}</div>'
                 f'<p class="t-body c-ink" style="margin-top:8pt">{esc(body)}</p></div>')
    ph = 200
    graphic = f'<div class="panel rel" data-block="four-step" style="height:{ph}pt">{svg(CW, ph, "".join(b), "Four step conclusion")}{cols}</div>'
    hl = headline(f'Delivery leads now and people want Engage and Innovate; the innovation goal misses, and leaders and staff sit {num(f2(PG["ENGAGE"]))} points apart.')
    rows = [["1. Where the culture is", f"Perform {f2(NOW['PERFORM'])}, Engage {f2(NOW['ENGAGE'])}; strength {sc(S['strength_band']).lower()}.", "Chapter 03, page 9"],
            ["2. Where it wants to go", f"Engage {s2(GAP['ENGAGE'])}, Innovate {s2(GAP['INNOVATE'])}, Perform {s2(GAP['PERFORM'])}, Govern {s2(GAP['GOVERN'])}.", "Chapter 04, page 12"],
            ["3. Where it falls short", f"Strategy miss on Innovate; partial hits on systems and business model.", "Chapter 05, page 15"],
            ["4. What holds it back", f"Shadow culture on Engage; readiness {RD['tps']}; {wd(len(neg))} of eight voice scores below zero.", "Chapters 06 to 08"]]
    tbl = table([150, None, 110], ["Step", "What the data shows", "Read more"], rows, "table-steps")
    flow = (hl + graphic + group(h2("The four steps in evidence"), tbl)
            + sowhat("Start with the gap between executives and staff. Until both groups describe the same organisation, plans for Engage and Innovate will not land."))
    return html_doc("CDP report: what this means", [page(26, flow, "What this means, page 26", ("11", "What this means"))])

# ---------------- generic blocks sheet ----------------
def p_blocks():
    s = [frame(0)]
    s.append(box(ML, MT, CW, None, "t-table c-muted", "Block sheet for review, not a report page. Real values from the sample where the block uses them."))
    rows = [
        ["Leading value", star("29.64"), "Star icon before the number, weight 600"],
        ["Hit", sig("check", "Hit"), "Check icon"],
        ["Partial hit", sig("partial", "Partial hit"), "Half filled circle"],
        ["Miss", sig("cross", "Miss"), "Cross icon"],
        ["Platform flag", sig("watch", "Critical"), "Watch triangle for any flag: Critical, Shadow culture, High"],
        ["Positive, no flag", sig("check", "Positive"), "Check icon"],
        ["Neutral band", sig(None, "Moderate"), "Word only, no icon"],
        ["Missing value", "No data", "Word in ink, never a dash"],
    ]
    tbl = table([120, 120, None], ["Signal", "In a cell", "Rule"], rows, "table-generic", first_bold=True)
    cc = check_content()
    sm = [finding_small("MISS", "Miss", "cross", f2(NOW["INNOVATE"]), "Innovate now", [
              ("Finding", f"Innovate is last of four at {f2(NOW['INNOVATE'])}."), ("Evidence", f"People would raise it to {f2(PREF['INNOVATE'])}."),
              ("Consequence", "New model work competes with delivery targets."), ("Action", "Ring fence pilot time. <b>Owner:</b> executive team. <b>Timing:</b> 90 days.")]),
          finding_small("SHADOW", "Shadow culture", "watch", f2(PG["ENGAGE"]), "Points apart on Engage", [
              ("Finding", f"Executives score Engage {f2(EX['ENGAGE'])}; staff {f2(ST['ENGAGE'])}."), ("Evidence", f"{EXN} executives and {STN} staff answered."),
              ("Consequence", "Top down messages risk reading as out of touch."), ("Action", "Open a direct route for staff views. <b>Owner:</b> chief executive. <b>Timing:</b> before launch.")])]
    flow = (group(h2("Generic table block"), tbl)
            + group(h2("Finding card, small (half width)"), f'<div class="pair">{"".join(sm)}</div>')
            + group(h2("So what callout"), sowhat(f"The strategy needs Innovate, yet the culture rewards delivery at {num(f2(NOW['PERFORM']))}. Close the leader and staff gap first.")))
    s.append(box(ML, MT + 24, CW, None, "flow", flow, attrs=' id="flow-blocks"'))
    return html_doc("CDP report: generic blocks", [section("".join(s), "Generic blocks")])

# ---------------- states sheet ----------------
def p_states():
    pages = []
    # page A: empty and partial
    s = [frame(0)]
    s.append(box(ML, MT, CW, None, "t-table c-muted", "States sheet for review, not a report page. Empty and partial states of the data blocks."))
    empty_prof = []
    x0, x1, top, base = 36, HALF - 12, 40, 172
    for v in (10, 20, 30, 40):
        y = base - v * 3.45; empty_prof.append(ln(x0, y, x1, y)); empty_prof.append(tx(x0 - 4, y + 2.5, str(v), anchor="end"))
    empty_prof.append(ln(x0, base, x1, base, INK, 0.75))
    empty_prof.append(tx((x0 + x1) / 2, 110, "No results yet", size=10, anchor="middle", cls="c"))
    # partial dumbbell: executive group suppressed
    rows_d = [(NAME[o], None, ST[o], ser(o)) for o in ORDER]
    part = ch_dumbbell(rows_d, 15, 35, ticks=[15, 20, 25, 30, 35], ref=25, fmt=lambda v: str(v), gap_fn=lambda l, a, c: ("Not shown", False),
                       legend_items=[("diamond", "Staff", INK), ("dash", "Even share, 25", INK)])
    hm_part = ch_heatmap([("Finance", {}), ("People and Culture", {o: "S" for o in ORDER}), ("Sales", {})], show_legend=False)
    flow = (group(h2("Empty: chart panel and table"), pair(panel("Orientation profile", HALF, 200, "".join(empty_prof), "state-empty-chart"),
                  panel("Verdict, empty", HALF, 200, tx(12, 40, "No strategy goals were set for this", size=10, cls="c") + tx(12, 54, "assessment, so no checks were run.", size=10, cls="c"), "state-empty-verdict")),
                  table([120, 70, 70, None], ["Orientation", "Now", "Preferred", "Gap"], [empty_row(4, "No results yet. The table fills when the assessment closes.")], "state-empty-table"))
            + group(h2("Partial: one group below the reporting threshold"), pair(panel("Executives and staff, now", HALF, 200, part, "state-partial-dumbbell"),
                  panel("Partial table row", HALF, 200, "", "state-partial-note")))
            + group(h2("Partial: a department held back"), panel("Departments by orientation", CW, 34 + 3 * 24 + 12, hm_part, "state-partial-heatmap")))
    s.append(box(ML, MT + 24, CW, None, "flow", flow, attrs=' id="flow-states-a"'))
    # text inside partial note panel (html)
    pages.append(section("".join(s).replace('data-block="state-partial-note" style="width:241.64pt;height:200pt">',
        'data-block="state-partial-note" style="width:241.64pt;height:200pt"><div class="abs t-body c-ink" style="left:12pt;top:30pt;width:217.64pt">'
        '<p>Suppressed cells print <b class="t-body-strong">Held back</b> in ink, never zero and never blank. The hatched cell in a heatmap carries the words <b class="t-body-strong">Below threshold</b> on a white label.</p>'
        '<p>Gap and flag columns print <b class="t-body-strong">Not shown</b> when either group is held back. Here the executive group is below the reporting threshold, so only staff diamonds are drawn and the legend drops Executives.</p></div>'), "States, empty and partial"))
    # page B: long and single
    s = [frame(0)]
    s.append(box(ML, MT, CW, None, "t-table c-muted", "States sheet for review, not a report page. Long and single result states; specimen geometry uses placeholders, not data."))
    # long table break specimen
    lrows = [[f"Department {i}", "x.xx", "x.xx", "x.xx", "x.xx"] for i in range(1, 4)]
    cont = table([150, 87, 87, 87, None], ["Department", "Engage", "Innovate", "Perform", "Govern"], lrows, "state-long-table", right=(1, 2, 3, 4))
    long_note = ('<div class="t-body c-ink" style="width:327.52pt"><p>Long tables break between rows only. The header row repeats on the next page, with '
                 '<b class="t-body-strong">continued</b> after the section heading. At least 3 rows stay on each side of a break.</p>'
                 '<p>Heatmap: up to 18 departments fit one page at 24 pt rows; beyond that the map continues on the next page with the header row repeated. Department cards run two pages per 10 departments.</p></div>')
    one = [d_ for d_ in DEPTS if d_["name"] == "Sales"]
    # 360 specimen: one row, placeholders
    w, h = CW, 120; x0, x1 = 140, w - 60; k = (x1 - x0) / 4; b = []
    for v in (1, 2, 3, 4, 5):
        x = x0 + (v - 1) * k; b.append(ln(x, 30, x, 80)); b.append(tx(x, 90, f"{v:.2f}", anchor="middle"))
    xr = x0 + 2 * k; b.append(ln(xr, 30, xr, 80, BRAND, 1, "3 2")); b.append(tx(xr + 4, 26, "Flag line 3.00"))
    y = 54; xa, xc = x0 + 2.6 * k, x0 + 1.7 * k
    b.append(tx(12, y + 2.5, "Section name", w=600)); b.append(ln(xc, y, xa, y, MUTED, 1)); b.append(circ(xa, y, 3.5, INK, INK, 0.5)); b.append(diamond(xc, y, 4, INK))
    b.append(tx(xa, y - 7, "self", anchor="middle", fill=MUTED)); b.append(tx(xc, y + 12, "others", anchor="middle", fill=MUTED))
    b.append(tx(w - 12, y + 2.5, "gap", anchor="end")); b.append(icon_at("watch", w - 12 - tw("gap") - 14, y - 5))
    lg, _ = legend(12, h - 13.95, [("dot", "Self", INK), ("diamond", "Others", INK), ("dash1", "Flag line, 3.00", BRAND)]); b.append(lg)
    flow = (group(h2("Long: table across a page break"), h1("9.1", "Department map, continued"), cont, long_note)
            + group(h2("Single result: one department"), dept_card(one[0]) if one else "")
            + group(h2("Specimen: leadership 360 row (placeholders, not data)"), panel("Self and others by section", CW, h, "".join(b), "specimen-360")))
    s.append(box(ML, MT + 24, CW, None, "flow", flow, attrs=' id="flow-states-b"'))
    pages.append(section("".join(s), "States, long and single"))
    return html_doc("CDP report: states", pages)

def write_logo_js():
    uri = g1.LOGO["pac-logo-colour"]
    js = ("/* Shared PAC colour logo for group 2 pages. Bytes from design_system/assets/pac-logo-colour.png.base64, unchanged. */\n"
          "(function(){var L={'pac-logo-colour':'" + uri + "'};"
          "document.querySelectorAll('img[data-logo]').forEach(function(i){i.src=L[i.getAttribute('data-logo')];});})();\n")
    open(f"{OUT}/logo.js", "w").write(js)

def main():
    write_logo_js()
    files = {
        "10-culture-now.html": p_culture_now(), "11-culture-gap.html": p_culture_gap(), "12-strategy-checks.html": p_strategy(),
        "13-executives-staff.html": p_exec_staff(), "14-readiness-risk.html": p_readiness(), "15-employee-voice.html": p_voice(),
        "16-departments.html": p_departments(), "17-leadership-360.html": p_360(), "18-what-this-means.html": p_meaning(),
        "19-blocks.html": p_blocks(), "20-states.html": p_states(),
    }
    for k, v in files.items(): open(f"{OUT}/{k}", "w").write(v)
    print({k: len(v) for k, v in files.items()})

if __name__ == "__main__":
    main()
