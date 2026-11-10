#!/usr/bin/env python3
"""Build CDP report template, group 1 sample pages (HTML, A4 in points).

Reads design_system/tokens.json and cdp_report/report-sample-data.json.
Writes tokens.css and one HTML file per page type into OUT.
All positions are in pt from the top left corner of the page.
"""
import json, os, sys, html

STORE = os.environ.get("STORE", "/mnt/memory/ui-ux-agent")
OUT = os.environ.get("OUT", "/tmp/w/out/cdp_report/template")
T = json.load(open(f"{STORE}/design_system/tokens.json"))
D = json.load(open(f"{STORE}/cdp_report/report-sample-data.json"))
os.makedirs(OUT, exist_ok=True)

# ---------- tokens ----------
C = T["color"]; WHITE = C["white"]["value"]
PW, PH = T["page"]["size"]
M = T["page"]["margin"]; ML, MR, MT, MB = M["left"], M["right"], M["top"], M["bottom"]
CW = T["page"]["content"]["width"]
RX = PW - MR                      # right edge of content, 547.28
CB = PH - MB                      # bottom of content, 777.89
G = T["grid"]; SP = T["space"]
Q = G["quarter"]; HALF = G["half"]; GUT = G["gutter"]
INTER = {"asc": 1984/2048, "desc": 494/2048}      # Inter hhea
GEORGIA = {"asc": 1878/2048, "desc": 449/2048}    # Georgia hhea (Gelasio differs, see spec)

def bl_top(baseline, size, leading, m=INTER):
    """Top of a CSS line box whose baseline sits at `baseline`."""
    return round(baseline - ((leading - (m["asc"]+m["desc"])*size)/2 + m["asc"]*size), 2)

ORDER = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"]
NAME = {k: k.title() for k in ORDER}
DATA = T["data"]

# ---------- sample values (all from report-sample-data.json + owner corrections) ----------
CLIENT = D["organisation"]
R = D["respondents"]; S = D["score"]
INVITED, SUBMITTED = R["invited"], R["submitted"]
EXEC_N = S["cohorts"]["executive"]["n"]      # 5  (owner correction: cohorts are right)
STAFF_N = S["cohorts"]["staff"]["n"]         # 36
assert EXEC_N + STAFF_N == SUBMITTED
NOW = {k: S["orientation_scores"]["now"][k] for k in ORDER}
PREF = {k: S["orientation_scores"]["preferred"][k] for k in ORDER}
GAP = {k: S["orientation_scores"]["gap"][k] for k in ORDER}
TOTAL_PAGES = 40
WORDS = "zero one two three four five six seven eight nine ten".split()
def wd(n, cap=False):
    w_ = WORDS[n] if 0 <= n <= 10 else str(n); return w_.capitalize() if cap else w_
QN = D["names"]["voice"]
MISSING = "To be confirmed"
REPORT_NAME = "Culture Dynamics Profile, full assessment report"
REF = "PAC/CDP/RPT/NNN"
RELEASED = None          # not in sample data
ASSESSED = None          # not in sample data

LOGO = {n: "data:image/png;base64," + "".join(open(f"{STORE}/design_system/assets/{n}.png.base64").read().split())
        for n in ("pac-logo-colour", "pac-logo-white", "cdp-wordmark")}

def esc(s): return html.escape(str(s), quote=False)
def num(s): return f'<span class="tnum">{esc(s)}</span>'
def signed(v):
    v = float(v); return ("+" if v > 0 else "\u2212") + f"{abs(v):.2f}"

# ---------- icons: 10 pt box, 1.25 stroke, round caps ----------
def icon(kind, color="var(--color-ink)", x=None, y=None):
    sw = T["element"]["icon"]["stroke"]
    a = f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"'
    body = {
        "check": f'<polyline points="1.8,5.4 4.1,7.6 8.2,2.6" {a}/>',
        "cross": f'<path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" {a}/>',
        "partial": f'<circle cx="5" cy="5" r="3.9" {a}/><path d="M5 1.1A3.9 3.9 0 0 0 5 8.9Z" fill="{color}"/>',
        "watch": f'<path d="M5 1.2L9.1 8.6H0.9Z" {a}/><path d="M5 4V5.9" {a}/><circle cx="5" cy="7.3" r="0.55" fill="{color}"/>',
        "star": f'<path d="M5 1L6.2 3.6L9 3.9L6.9 5.8L7.5 8.6L5 7.2L2.5 8.6L3.1 5.8L1 3.9L3.8 3.6Z" {a}/>',
    }[kind]
    pos = f' style="left:{x}pt;top:{y}pt"' if x is not None else ""
    cls = ' class="abs icon"' if x is not None else ' class="icon"'
    return f'<svg{cls}{pos} width="10pt" height="10pt" viewBox="0 0 10 10" aria-hidden="true">{body}</svg>'

# ---------- css ----------
def css():
    ty = T["type"]
    fam = {"ui": 'var(--font-ui)', "prose": 'var(--font-prose)'}
    out = [":root{"]
    for k in ["brand", "ink", "muted", "paper", "surface", "accent-dark"]:
        out.append(f"--color-{k}:{C[k]};")
    out.append(f"--color-white:{WHITE};")
    for k in ORDER:
        out.append(f"--data-{k.lower()}:{DATA[k.lower()]};")
    for k, v in DATA["tint"].items():
        if not k.startswith("_"): out.append(f"--data-tint-{k}:{v};")
    for k in ["hit", "partial", "miss"]:
        out.append(f"--verdict-{k}:{T['verdict'][k]['value']};--verdict-{k}-on:{T['verdict'][k]['text_on']};")
    out.append(f"--chart-gridline:{T['chart']['gridline']};--chart-axis:{T['chart']['axis']};--chart-reference:{T['chart']['reference.line']};")
    out.append('--font-ui:"Inter","Roboto","Open Sans",sans-serif;--font-prose:Georgia,Gelasio,serif;')
    for k, v in SP.items(): out.append(f"--space-{k}:{v}pt;")
    out.append(f"--radius-1:{T['radius']['1']}pt;--radius-pill:{T['radius']['pill']}pt;")
    for k, v in T["border"].items(): out.append(f"--border-{k}:{v}pt;")
    out.append("}")
    out.append(f"@page{{size:{PW}pt {PH}pt;margin:0}}")
    out.append("*{box-sizing:border-box;margin:0;padding:0}")
    out.append("html{background:var(--color-muted)}")
    out.append("body{padding:24pt 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}")
    out.append("@media print{html{background:none}body{padding:0}.page{margin:0!important}.no-print{display:none!important}}")
    out.append(f".page{{position:relative;width:{PW}pt;height:{PH}pt;overflow:hidden;background:var(--color-paper);margin:0 auto 24pt;page-break-after:always;break-after:page;color:var(--color-ink)}}")
    out.append(".abs{position:absolute}")
    out.append(".tnum{font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}")
    out.append(".icon{display:inline-block;vertical-align:-1.5pt;flex:none}")
    for name, t in ty.items():
        if name.startswith("_"): continue
        w = t["weight"]; style = "normal"
        if w == "Regular": w = 400
        elif w == "Bold": w = 700
        elif w == "Italic": w, style = 400, "italic"
        rule = f".t-{name}{{font-family:{fam[t['font']]};font-weight:{w};font-style:{style};font-size:{t['size']}pt;line-height:{t['leading']}pt"
        if t.get("case") == "upper": rule += ";text-transform:uppercase"
        if t.get("tracking"): rule += f";letter-spacing:{t['tracking']}pt"
        if t["font"] == "ui": rule += ";font-variant-numeric:tabular-nums"
        rule += "}"
        out.append(rule)
    out.append(".t-pagenum{font-family:var(--font-ui);font-weight:700;font-size:9pt;line-height:10pt;font-variant-numeric:tabular-nums}")
    out.append(".c-ink{color:var(--color-ink)}.c-muted{color:var(--color-muted)}.c-white{color:var(--color-white)}.c-brand{color:var(--color-brand)}")
    out.append(".panel{background:var(--color-white);border-radius:var(--radius-1)}")
    out.append(".card{background:var(--color-white);border-top:var(--border-strong) solid var(--color-brand);border-radius:0 0 var(--radius-1) var(--radius-1)}")
    out.append(".callout{background:var(--color-surface);border-top:var(--border-strong) solid var(--color-brand);border-radius:0 0 var(--radius-1) var(--radius-1)}")
    out.append("p+p{margin-top:6pt}")
    # tables
    out.append("table.t{border-collapse:collapse;width:100%;table-layout:fixed}")
    out.append("table.t th{background:var(--color-ink);color:var(--color-white);text-align:left;padding:4pt 12pt;vertical-align:top}")
    out.append("table.t td{padding:4pt 12pt;vertical-align:top;border-top:var(--border-hair) solid var(--chart-gridline)}")
    out.append("table.t thead tr{background:var(--color-ink)}table.t th{background:none!important}table.t tbody tr:nth-child(odd){background:var(--color-white)}table.t tbody tr:nth-child(even){background:var(--color-surface)}")
    out.append("table.t tbody tr:first-child td{border-top:0}")
    out.append("table.t tbody tr:last-child td{border-bottom:var(--border-rule) solid var(--color-ink)}")
    out.append("table.t td.first{font-weight:600}table.t .r{text-align:right}")
    # leaders
    out.append(".toc-row{display:flex;align-items:baseline;gap:4pt}.toc-row .lead{flex:1;align-self:baseline;height:1pt;background-image:radial-gradient(circle,var(--color-muted) 0.45pt,transparent 0.55pt);background-size:3pt 1pt;background-repeat:repeat-x;background-position:right center}")
    # annotations
    out.append(".anno{outline:var(--border-hair) dashed var(--color-muted);color:var(--color-muted);font:400 7pt/9pt var(--font-ui)}")
    out.append(".anno-line{border-top:var(--border-hair) dashed var(--color-muted)}")
    out.append("svg.ch text{font-family:var(--font-ui);font-variant-numeric:tabular-nums;fill:var(--color-ink)}svg.ch .b{font-weight:600}svg.ch .c{font-family:var(--font-prose);font-style:italic;font-variant-numeric:normal}")
    out.append(".hl-num{font-variant-numeric:tabular-nums}.flow{display:flex;flex-direction:column;gap:16pt}.pair{display:grid;grid-template-columns:241.64pt 241.64pt;column-gap:16pt}.rel{position:relative}")
    return "\n".join(out)

# ---------- page shell ----------
def page_html(title, pages):
    return f"""<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<title>{esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="tokens.css">
</head><body>
{''.join(pages)}
</body></html>"""

def box(x, y, w, h=None, cls="", inner="", style="", tag="div", attrs=""):
    hh = f"height:{h}pt;" if h is not None else ""
    return f'<{tag} class="abs {cls}" style="left:{x}pt;top:{y}pt;width:{w}pt;{hh}{style}"{attrs}>{inner}</{tag}>'

def frame(page_no, aria):
    """Running header and footer for inner pages."""
    hdr_text = f"{esc(CLIENT)} \u00b7 Culture Dynamics Profile"
    rel = RELEASED or "(to be confirmed)"
    foot = f"Confidential. Prepared for {esc(CLIENT)} \u00b7 Released {esc(rel)}"
    hb = T["page"]["header"]["baseline_from_top"]; hr = T["page"]["header"]["rule_from_top"]
    fr = PH - T["page"]["footer"]["rule_from_bottom"]; fb = PH - T["page"]["footer"]["baseline_from_bottom"]
    lw, lh = T["page"]["header"]["logo_box"]; ltop = T["page"]["header"]["logo_top"]
    logo_w = round(lh * 591 / 221, 2)
    s = []
    s.append(f'<header aria-label="Running header">')
    s.append(box(ML, bl_top(hb, 7.5, 10), 435.14, None, "t-running c-muted", hdr_text))
    s.append(f'<img class="abs" src="{LOGO["pac-logo-colour"]}" alt="PAC Africa" style="left:{round(RX-logo_w,2)}pt;top:{ltop}pt;height:{lh}pt;width:{logo_w}pt">')
    s.append(box(ML, hr - 0.375, CW, 0.75, "", "", "background:var(--color-brand)"))
    s.append('</header><footer aria-label="Running footer">')
    s.append(box(ML, fr - 0.375, CW, 0.75, "", "", "background:var(--color-brand)"))
    s.append(box(ML, bl_top(fb, 7.5, 10), 380, None, "t-running c-muted", foot))
    s.append(box(RX - 100, bl_top(fb, 9, 10), 100, None, "t-pagenum c-ink", f"Page {page_no} of {TOTAL_PAGES}", "text-align:right"))
    s.append("</footer>")
    return "".join(s)

def section(inner, aria, bg=None):
    st = f' style="background:var(--color-{bg})"' if bg else ""
    return f'<section class="page" aria-label="{esc(aria)}"{st}>{inner}</section>'

def chapter_opener(y, number, title, x=ML):
    t, b = T["element"]["chapter-tile"]["size"], T["element"]["chapter-bar"]
    s = box(x, y, t, t, "t-chapter-number c-white", f'<span style="display:flex;height:100%;align-items:center;justify-content:center">{esc(number)}</span>', "background:var(--color-brand)")
    s += box(x + t, y, RX - x - t, b["height"], "t-chapter-title c-white",
             f'<h1 style="font:inherit;letter-spacing:inherit;display:flex;height:100%;align-items:center;padding-left:{b["inset"]}pt;padding-right:{b["inset"]}pt">{esc(title)}</h1>', "background:var(--color-ink)")
    return s

# ======================================================================
# 01 page frame
# ======================================================================
def build_frame():
    s = [frame(9, "frame")]
    # annotations: content area, grid columns, key lines
    s.append(box(ML, MT, CW, CB - MT, "anno", f'<span style="position:absolute;left:4pt;top:4pt">Content area {ML}, {MT} to {RX}, {CB} ({CW} by {round(CB-MT,2)} pt)</span>'))
    x = ML
    for i in range(G["columns"]):
        s.append(box(round(x, 2), MT + 24, G["column"], CB - MT - 48, "", "", "background:var(--color-surface)"))
        x += G["column"] + G["gutter"]
    labels = [
        (30.27, f"Header text: baseline 38, type.running, muted"),
        (46, "Header rule: y 46, 0.75 brand"),
        (PH - 52, "Footer rule: y 789.89, 0.75 brand"),
        (PH - 36, "Footer baseline: y 805.89"),
    ]
    yy = 380
    notes = [
        "Page frame, inner pages. Annotations in dashed grey are not printed.",
        "Margins: left 48, right 48, top 72, bottom 64. 12 columns of 26.94 with 16 gutters.",
        "Header: client and report name left (type.running, muted, baseline 38).",
        "PAC colour logo right, height 18, top 24, right edge 547.28.",
        "Rules: 0.75 brand at y 46 and y 789.89, x 48 to 547.28.",
        "Footer: confidentiality line left (type.running, muted, baseline 805.89),",
        "page number right (Inter 700, 9, ink, baseline 805.89).",
    ]
    s.append(box(ML + 24, yy, CW - 48, len(notes) * 12 + 24, "", "".join(f'<div class="t-table">{esc(n)}</div>' for n in notes), "background:var(--color-white);padding:12pt;border-radius:var(--radius-1)"))
    return page_html("CDP report: page frame", [section("".join(s), "Page frame sample, page 9")])

# ======================================================================
# 02 cover
# ======================================================================
BAND_H = 400
NAME_W = 403.28   # 467.28 bar foot minus 48 margin minus 16 clear
def diag_bar(bottom_y):
    """PROPOSED diagonal bar: 45 degrees, 24 pt wide, rising to the right edge."""
    w = 24 * 2 ** 0.5   # horizontal width of a 24 pt bar at 45 degrees = 33.94
    x0 = 467.28
    pts = [(x0, bottom_y), (round(x0 + w, 2), bottom_y), (PW, round(bottom_y - (PW - x0 - w), 2)), (PW, round(bottom_y - (PW - x0), 2))]
    p = " ".join(f"{a},{b}" for a, b in pts)
    return f'<svg class="abs" style="left:0;top:0" width="{PW}pt" height="{PH}pt" viewBox="0 0 {PW} {PH}" aria-hidden="true"><polygon points="{p}" fill="var(--color-accent-dark)"/></svg>', pts

def build_cover():
    s = []
    s.append(box(0, 0, PW, BAND_H, "", "", "background:var(--color-brand)"))
    bar, _ = diag_bar(BAND_H); s.append(bar)
    lw = round(48 * 568 / 213, 2)
    s.append(f'<img class="abs" src="{LOGO["pac-logo-white"]}" alt="PAC Africa, Priority Activator Consulting" style="left:{ML}pt;top:48pt;height:48pt;width:{lw}pt">')
    # client block, anchored to the bottom of the band (bottom 352)
    # bottom anchored at y 352; grows upward; name max 2 lines; width keeps 16 pt clear of the diagonal bar
    s.append(box(ML, 200, NAME_W, 152, "", f'<div class="t-kpi-label c-ink">Prepared for</div><h1 class="t-display c-white" style="margin-top:4pt">{esc(CLIENT)}</h1>',
                 "display:flex;flex-direction:column;justify-content:flex-end", attrs=' id="cover-client"'))
    # paper area
    ww = round(48 * 1393 / 540, 2)
    s.append(f'<img class="abs" src="{LOGO["cdp-wordmark"]}" alt="CDP, Culture Dynamics Profile" style="left:{ML}pt;top:448pt;height:48pt;width:{ww}pt">')
    s.append(box(ML, 544, 360, None, "t-h1 c-ink", "Full assessment report", attrs=' id="cover-report-type"'))
    s.append(box(ML, 632 - 0.375, CW, 0.75, "", "", "background:var(--color-brand)"))
    facts = [
        ("Respondents", f"{SUBMITTED} of {INVITED} invited", f"{EXEC_N} executives, {STAFF_N} staff", False),
        ("Assessment date", ASSESSED or MISSING, "Supplied by the platform", ASSESSED is None),
        ("Instrument", "Culture Dynamics Profile", "Four orientations, six dimensions", False),
        ("Reference", REF, "Number supplied by the platform", True),
    ]
    for i, (lab, val, cap, miss) in enumerate(facts):
        x = round(ML + i * (Q + GUT), 2)
        inner = (f'<div class="t-kpi-label c-ink">{esc(lab)}</div>'
                 f'<div class="t-h2 {"c-muted" if miss and val == MISSING else "c-ink"} tnum" style="margin-top:4pt">{esc(val)}</div>'
                 f'<div class="t-caption c-muted" style="margin-top:4pt">{esc(cap)}</div>')
        s.append(box(x, 644, Q, None, "", inner, attrs=f' data-block="fact-{i+1}"'))
    fb = PH - 36
    s.append(box(ML, bl_top(fb, 7.5, 10), 240, None, "t-running c-muted", "Confidential"))
    s.append(box(RX - 240, bl_top(fb, 7.5, 10), 240, None, "t-running c-muted", "www.pac.africa", "text-align:right"))
    return page_html("CDP report: cover", [section("".join(s), "Cover")])

# ======================================================================
# 03 about
# ======================================================================
def build_about():
    s = [frame(2, "about")]
    w8 = round(8 * G["column"] + 7 * GUT, 2)  # 327.52
    q = D["score"]["quality"]; flags = sum(q["flags"].values()); mins = round(q["median_duration"] / 60)
    rows = [
        ("Reference", f"{REF} (number supplied by the platform)"),
        ("Organisation", CLIENT),
        ("Report", REPORT_NAME),
        ("Audience", MISSING),
        ("Released", RELEASED or MISSING),
        ("Prepared by", "Priority Activator Consulting (PAC Africa). Culture Practitioner: to be confirmed"),
        ("Classification", "Confidential"),
    ]
    tr = "".join(f'<tr><td class="first">{esc(a)}</td><td>{esc(b)}</td></tr>' for a, b in rows)
    tiles = [("Invited", str(INVITED), "People asked to take part"),
             ("Responded", str(SUBMITTED), f"{round(100*SUBMITTED/INVITED)} percent of those invited"),
             ("Executives", str(EXEC_N), "Executive group"),
             ("Staff", str(STAFF_N), "Staff group")]
    tile_row = "".join(kpi_tile_static(lab, val, cap, "white") for lab, val, cap in tiles)
    flow = (
        '<h1 class="t-h1 c-ink" data-block="about-title">About this report</h1>'
        f'<div class="t-body c-ink" data-block="about-intro" style="margin-top:8pt;width:{w8}pt">'
        f"<p>The Culture Dynamics Profile shows how {esc(CLIENT)} works today, how its people want it to work, and where the culture supports or holds back the strategy. It reads culture through four orientations: Engage, Innovate, Perform and Govern.</p>"
        f"<p>Each chapter leads with a finding, shows the evidence behind it and ends with what it means for {esc(CLIENT)}.</p></div>"
        '<h2 class="t-h2 c-ink" data-block="h-doc-control" style="margin-top:24pt">Document control</h2>'
        f'<table id="doc-control" class="t t-table" style="margin-top:8pt"><colgroup><col style="width:120pt"><col></colgroup><thead><tr><th class="t-table-head">Field</th><th class="t-table-head">Detail</th></tr></thead><tbody>{tr}</tbody></table>'
        '<h2 class="t-h2 c-ink" data-block="h-participation" style="margin-top:24pt">Participation</h2>'
        f'<div data-block="participation-tiles" style="margin-top:8pt;display:grid;grid-template-columns:repeat(4,{Q}pt);column-gap:{GUT}pt">{tile_row}</div>'
        f'<div class="t-body c-ink" data-block="quality" style="margin-top:16pt;width:{w8}pt"><p>All {SUBMITTED} responses were complete. {"No response was" if flags == 0 else str(flags) + " responses were"} flagged for speeding, straight lining, uniform allocation or duplicated perspectives. The median time to complete was {mins} minutes.</p></div>'
        '<h2 class="t-h2 c-ink" data-block="h-confidentiality" style="margin-top:24pt">Confidentiality</h2>'
        f'<div class="t-body c-ink" data-block="confidentiality" style="margin-top:8pt;width:{w8}pt"><p>This report is confidential to {esc(CLIENT)} and PAC Africa. Results are shown for groups only, never for a named person. Groups below the reporting threshold are held back.</p></div>'
    )
    s.append(box(ML, MT, CW, None, "", flow, attrs=' id="about-flow"'))
    return page_html("CDP report: about this report", [section("".join(s), "About this report, page 2")])

def kpi_tile_static(label, value, caption, tone):
    bg = {"white": "var(--color-white)", "brand": "var(--color-brand)", "ink": "var(--color-ink)"}[tone]
    vcol = "c-ink" if tone == "white" else "c-white"
    lcol = "c-white" if tone == "ink" else "c-ink"
    return (f'<div data-block="kpi-tile" style="background:{bg};border-radius:var(--radius-1);padding:12pt">'
            f'<div class="t-kpi-label {lcol}" style="min-height:10pt">{esc(label)}</div>'
            f'<div class="t-kpi-value {vcol} tnum" style="margin-top:4pt">{value}</div>'
            f'<div class="t-caption {lcol}" style="margin-top:4pt">{esc(caption)}</div></div>')

# ======================================================================
# 04 back page
# ======================================================================
def build_back():
    s = []
    bar, _ = diag_bar(PH); s.append(bar)
    lw = round(36 * 568 / 213, 2)
    s.append(f'<img class="abs" src="{LOGO["pac-logo-white"]}" alt="PAC Africa, Priority Activator Consulting" style="left:{ML}pt;top:48pt;height:36pt;width:{lw}pt">')
    s.append(box(ML, 560, 420, None, "t-display c-white", "Consulting Built for<br>Real World Impact"))
    s.append(box(ML, 664, 260, None, "t-h2 c-ink", "Priority Activator Consulting"))
    s.append(box(ML, 682, 260, None, "t-body c-ink",
        '<address style="font-style:normal">Suite E2, 1st Floor, Jasmine Centre<br>Westlands, Nairobi<br>info@pac.africa<br>www.pac.africa</address>'))
    return page_html("CDP report: back page", [section("".join(s), "Back page", "brand")])

# ======================================================================
# 05 contents
# ======================================================================
TOC = [
    ("ES", "Executive summary", 5, [("", "Culture at a glance", 5), ("", "Key indicators", 5), ("", "The Big Three", 6)]),
    ("01", "How to read this report", 7, []),
    ("02", "Method and participation", 8, [("2.1", "Participation", 8), ("2.2", "Groups and reporting", 8)]),
    ("03", "The culture now", 9, [("3.1", "Orientation profile", 9), ("3.2", "The six dimensions", 10), ("3.3", "Strength and consistency", 11)]),
    ("04", "The culture gap", 12, [("4.1", "Gap by orientation", 12), ("4.2", "Gap by dimension", 13), ("4.3", "Tensions and spread", 14)]),
    ("05", "Strategy checks", 15, [("5.1", "The four verdicts", 15), ("5.2", "Evidence by check", 16)]),
    ("06", "Executives and staff", 17, [("6.1", "Where the groups differ", 17), ("6.2", "Questions to test", 17)]),
    ("07", "Readiness and risk", 18, [("7.1", "Readiness for change", 18), ("7.2", "Culture Risk Index", 19)]),
    ("08", "Employee voice", 20, [("8.1", "Voice scores", 20), ("8.2", "Who says what, and themes", 21)]),
    ("09", "Departments", 22, [("9.1", "Department map", 22), ("9.2", "Department profiles", 23)]),
    ("10", "Leadership 360 summary", 25, [("10.1", "The collective leadership pattern", 25)]),
    ("11", "What this means", 26, []),
    ("12", "What to do next", 27, [("12.1", "Priorities", 27), ("12.2", "Quick wins, first 30 days", 29), ("12.3", "Phase plan", 30), ("12.4", "Change principles", 31)]),
    ("13", "Culture KPI scorecard", 32, [("13.1", "Baseline and targets", 32), ("13.2", "Governance", 33)]),
    ("A", "Data tables", 34, []),
    ("B", "Cohorts and method", 36, []),
    ("C", "Glossary", 37, []),
    ("D", "Working through the report", 39, []),
]
TILE = 32; SUB_PITCH = 15; SUB_GAP = 4; BLOCK_GAP = 12
def toc_block_h(subs): return TILE + (SUB_GAP + len(subs) * SUB_PITCH if subs else 0)

def toc_block(y, num_, title, page, subs):
    s = box(ML, y, TILE, TILE, "t-chapter-number c-white", f'<span style="display:flex;height:100%;align-items:center;justify-content:center">{esc(num_)}</span>', "background:var(--color-brand)")
    tx = ML + TILE + 12
    s += box(tx, y + 7, RX - tx, 18, "toc-row t-h1 c-ink", f'<span>{esc(title)}</span><span class="lead" aria-hidden="true"></span><span class="tnum">{page}</span>')
    yy = y + TILE + SUB_GAP
    for n, t, p in subs:
        lab = f'<span class="tnum" style="display:inline-block;width:28pt">{esc(n)}</span>{esc(t)}'
        s += box(tx, yy, RX - tx, 11, "toc-row t-table c-ink", f'<span>{lab}</span><span class="lead" aria-hidden="true"></span><span class="tnum">{p}</span>')
        yy += SUB_PITCH
    return s

def build_contents():
    pages = []; geo = []
    avail = [(132, CB), (MT, CB)]
    idx = 0; first = True
    for pno, (top, bottom) in zip([3, 4], avail):
        s = [frame(pno, "contents")]
        if first:
            s.append(box(ML, MT, CW, None, "t-toc-title c-ink", '<h1 style="font:inherit">Table of Contents</h1>'))
        y = top
        while idx < len(TOC):
            n, t, p, subs = TOC[idx]
            h = toc_block_h(subs)
            if y + h > bottom: break
            s.append(toc_block(y, n, t, p, subs)); geo.append((pno, n, y, h))
            y += h + BLOCK_GAP; idx += 1
        pages.append(section("".join(s), f"Table of Contents, page {pno}"))
        first = False
    assert idx == len(TOC), "contents overflow"
    return page_html("CDP report: table of contents", pages), geo

# ======================================================================
# 06 chapter opener
# ======================================================================
def build_opener():
    s = [frame(9, "opener")]
    s.append(chapter_opener(MT, "03", "The culture now"))
    lead = round(float(NOW["PERFORM"]) - float(NOW["ENGAGE"]), 2)
    s.append(box(ML, 120, CW, None, "t-headline c-ink",
        f'<p>Perform leads the culture now at {num(NOW["PERFORM"])} points, only {num(f"{lead:.2f}")} ahead of Engage, so no single orientation sets the tone.</p>'))
    s.append(box(ML, 174, CW, CB - 174, "anno", '<span style="position:absolute;left:8pt;top:8pt">Chapter content flows here from y 174 (group 2 blocks: chart panel pair, table, so what). Annotation, not printed.</span>'))
    p1 = section("".join(s), "Chapter opener, page 9")
    # variant sheet
    v = [frame(9, "opener variants")]
    v.append(box(ML, MT, CW, None, "t-table c-muted", "Variant sheet for review, not a report page. A: part label above the opener; dashed square is the 24 pt slot for the orientation symbol (file to be supplied). B: title that needs two lines."))
    # A: part label
    v.append(box(ML, 104, 24, 24, "anno", ""))
    v.append(box(ML + 24 + 8, 111, 300, None, "t-kpi-label c-ink", "Part 2 \u00b7 The culture"))
    v.append(chapter_opener(136, "03", "The culture now"))
    # B: two line title, tile and bar grow to 48
    y = 216
    v.append(box(ML, y, 32, 48, "t-chapter-number c-white", '<span style="display:flex;height:100%;align-items:center;justify-content:center">12</span>', "background:var(--color-brand)"))
    v.append(box(ML + 32, y, CW - 32, 48, "t-chapter-title c-white",
        '<div style="display:flex;height:100%;align-items:center;padding:0 12pt">What to do next: priorities, the first 14 days and the three phase plan for the year</div>', "background:var(--color-ink)"))
    v.append(box(ML, 280, CW, None, "t-table c-muted", "Test title only. Real chapter titles fit one line (longest planned: Leadership 360 summary)."))
    p2 = section("".join(v), "Chapter opener variants")
    return page_html("CDP report: chapter opener", [p1, p2])

# ======================================================================
# 07 executive summary
# ======================================================================
def kpi_tile(x, y, label, value, caption, tone, h):
    bg = {"white": "var(--color-white)", "brand": "var(--color-brand)", "ink": "var(--color-ink)"}[tone]
    vcol = "c-ink" if tone == "white" else "c-white"
    lcol = "c-white" if tone == "ink" else "c-ink"
    inner = (f'<div class="t-kpi-label {lcol}" style="min-height:20pt">{esc(label)}</div>'
             f'<div class="t-kpi-value {vcol}" style="margin-top:4pt">{value}</div>'
             f'<div class="t-caption {lcol}" style="margin-top:4pt">{esc(caption)}</div>')
    return box(x, y, Q, h, "", inner, f"background:{bg};border-radius:var(--radius-1);padding:12pt", attrs=' data-block="kpi-tile"')

def culture_map(x0, y0, w, h):
    """Four axis map: Engage NW, Innovate NE, Perform SE, Govern SW. Scale 0 to 40."""
    cx, cy = round(x0 + w / 2, 2), round(y0 + h / 2, 2)
    Rr = 90.0; k = Rr / 40 * 0.70710678
    dirs = {"ENGAGE": (-1, -1), "INNOVATE": (1, -1), "PERFORM": (1, 1), "GOVERN": (-1, 1)}
    def pt(o, v): dx, dy = dirs[o]; return (round(cx + dx * k * v, 2), round(cy + dy * k * v, 2))
    el = []
    for v in (10, 20, 30, 40):
        d = round(k * v, 2)
        el.append(f'<rect x="{cx-d}" y="{cy-d}" width="{2*d}" height="{2*d}" fill="none" stroke="var(--chart-gridline)" stroke-width="0.5"/>')
    for o in ORDER:
        a, b = pt(o, 40); el.append(f'<line x1="{cx}" y1="{cy}" x2="{a}" y2="{b}" stroke="var(--chart-gridline)" stroke-width="0.5"/>')
    d = round(k * 25, 2)
    el.append(f'<rect x="{cx-d}" y="{cy-d}" width="{2*d}" height="{2*d}" fill="none" stroke="var(--chart-reference)" stroke-width="0.5" stroke-dasharray="2 2"/>')
    now = " ".join(f"{a},{b}" for a, b in (pt(o, float(NOW[o])) for o in ORDER))
    pref = " ".join(f"{a},{b}" for a, b in (pt(o, float(PREF[o])) for o in ORDER))
    el.append(f'<polygon points="{now}" fill="none" stroke="var(--color-muted)" stroke-width="1" stroke-dasharray="3 2"/>')
    el.append(f'<polygon points="{pref}" fill="none" stroke="var(--color-brand)" stroke-width="1.5"/>')
    for o in ORDER:
        a, b = pt(o, float(NOW[o])); el.append(f'<circle cx="{a}" cy="{b}" r="2" fill="var(--color-white)" stroke="var(--color-muted)" stroke-width="1"/>')
        a, b = pt(o, float(PREF[o])); el.append(f'<circle cx="{a}" cy="{b}" r="2.5" fill="var(--color-brand)" stroke="var(--color-ink)" stroke-width="0.5"/>')
    svg = f'<svg class="abs" style="left:0;top:0" width="{PW}pt" height="{PH}pt" viewBox="0 0 {PW} {PH}" aria-hidden="true">{"".join(el)}</svg>'
    labels = []
    for o in ORDER:
        tx, ty = pt(o, 40)
        top = ty - 22 if dirs[o][1] < 0 else ty + 4
        labels.append(box(round(tx - 40, 2), round(top, 2), 80, 18, "t-chart c-ink",
            f'<div style="text-align:center"><b style="font-weight:600">{NAME[o]}</b><br><span class="tnum">{NOW[o]} to {PREF[o]}</span></div>'))
    return svg + "".join(labels), (cx, cy, Rr)

def shift_bars(x0, y0, w, h):
    lab_w = 52; pad = 28
    px0 = x0 + lab_w + pad; px1 = x0 + w - pad
    zero = round((px0 + px1) / 2, 2); sc = (px1 - px0) / 2 / 15
    pitch = 36; bar_h = 12; top0 = y0 + 8
    el = []
    for v in (-15, -10, -5, 5, 10, 15):
        gx = round(zero + v * sc, 2)
        el.append(f'<line x1="{gx}" y1="{y0}" x2="{gx}" y2="{y0+4*pitch+4}" stroke="var(--chart-gridline)" stroke-width="0.5"/>')
    rows = []
    for i, o in enumerate(ORDER):
        v = float(GAP[o]); by = top0 + i * pitch
        bx = zero if v > 0 else round(zero + v * sc, 2); bw = round(abs(v) * sc, 2)
        el.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bar_h}" fill="var(--data-{o.lower()})" stroke="var(--color-ink)" stroke-width="0.5"/>')
        rows.append(box(x0, by + 1.5, lab_w, 9, "t-chart c-ink", f'<b style="font-weight:600">{NAME[o]}</b>'))
        vx = bx + bw + 4 if v > 0 else bx - 4 - 26
        rows.append(box(round(vx, 2), by + 1.5, 26, 9, "t-chart c-ink tnum", signed(v), "text-align:" + ("left" if v > 0 else "right")))
    axis_bottom = y0 + 4 * pitch + 4
    el.append(f'<line x1="{zero}" y1="{y0}" x2="{zero}" y2="{axis_bottom}" stroke="var(--chart-axis)" stroke-width="0.75"/>')
    ticks = []
    for v in (-10, 0, 10):
        gx = zero + v * sc
        t = "0" if v == 0 else (("+" if v > 0 else "\u2212") + str(abs(v)))
        ticks.append(box(round(gx - 12, 2), axis_bottom + 4, 24, 9, "t-chart c-ink tnum", t, "text-align:center"))
    ticks.append(box(round(px0 - 4, 2), axis_bottom + 16, 60, 9, "t-chart c-ink", "Want less"))
    ticks.append(box(round(px1 - 56, 2), axis_bottom + 16, 60, 9, "t-chart c-ink", "Want more", "text-align:right"))
    svg = f'<svg class="abs" style="left:0;top:0" width="{PW}pt" height="{PH}pt" viewBox="0 0 {PW} {PH}" aria-hidden="true">{"".join(el)}</svg>'
    return svg + "".join(rows) + "".join(ticks), (zero, sc)

def finding_card(y, verdict, word, icon_kind, number, num_label, title, lines):
    tile_bg = {"hit": "var(--verdict-hit)", "partial": "var(--verdict-partial)", "miss": "var(--verdict-miss)", "flag": "var(--color-ink)"}[verdict]
    on = {"hit": "var(--verdict-hit-on)", "partial": "var(--verdict-partial-on)", "miss": "var(--verdict-miss-on)", "flag": "var(--color-white)"}[verdict]
    left = (f'<div style="background:{tile_bg};color:{on};border-radius:var(--radius-1);height:24pt;display:flex;align-items:center;gap:4pt;padding:0 8pt" class="t-kpi-label">{icon(icon_kind, on)}<span>{esc(word)}</span></div>'
            f'<div class="t-kpi-value c-ink" style="margin-top:8pt">{number}</div>'
            f'<div class="t-kpi-label c-ink" style="margin-top:4pt">{esc(num_label)}</div>')
    rows = "".join(f'<div style="display:grid;grid-template-columns:76pt 1fr;column-gap:8pt;margin-top:4pt" class="frow"><div class="t-body-strong">{esc(a)}</div><div class="t-body">{b}</div></div>' for a, b in lines)
    right = f'<h3 class="t-h2 c-ink" style="font-weight:600;margin-bottom:8pt">{esc(title)}</h3>{rows}'
    inner = (f'<div style="display:grid;grid-template-columns:{Q-12}pt 1fr;column-gap:16pt;padding:12pt">'
             f'<div>{left}</div><div>{right}</div></div>')
    return f'<article class="card" data-block="finding-card" aria-label="{esc(title)}">{inner}</article>'

def build_es():
    p = []
    # ---------- page 5 ----------
    s = [frame(5, "es1")]
    s.append(chapter_opener(MT, "ES", "Executive summary"))
    checks = D["evaluation"]["checks"]; hits = sum(v == "HIT" for v in checks.values())
    partial = sum(v == "PARTIAL_HIT" for v in checks.values()); miss = sum(v == "MISS" for v in checks.values())
    s.append(box(ML, 120, CW, None, "t-headline c-ink",
        f'<p>Perform leads the culture at {num(NOW["PERFORM"])} points, yet people want Engage to rise by {num(GAP["ENGAGE"])} points, and only {wd(hits)} of {wd(len(checks))} strategy checks is a full hit.</p>'))
    lead = float(NOW["PERFORM"]) - float(NOW["ENGAGE"])
    risk = S["analytics"]["risk"]
    tiles = [
        ("Leading orientation", num(NOW["PERFORM"]), f"Perform, {lead:.2f} points ahead of Engage", "white"),
        ("Largest shift wanted", num(signed(GAP["ENGAGE"])), f"Engage, from {NOW['ENGAGE']} to {PREF['ENGAGE']}", "white"),
        ("Strategy checks met", num(f"{hits} of {len(checks)}"), f"{hits}\u00a0hit, {partial}\u00a0partial hits, {miss}\u00a0miss", "brand"),
        ("Culture Risk Index", num(risk["index"]), f"{risk['band'].title()} band; lower is better", "white"),
    ]
    for i, (lab, val, cap, tone) in enumerate(tiles):
        s.append(kpi_tile(round(ML + i * (Q + GUT), 2), 174, lab, val, cap, tone, 102))
    # chart panel pair
    py, ph = 292, 235
    for i, title in enumerate(["Culture at a glance", "Shift from Now to Preferred"]):
        x = round(ML + i * (HALF + GUT), 2)
        s.append(box(x, py, HALF, ph, "panel", "", attrs=f' data-block="chart-panel-{i+1}"'))
        s.append(box(x + 12, py + 12, HALF - 24, None, "t-panel-title c-ink", f'<h2 style="font:inherit;letter-spacing:inherit">{esc(title)}</h2>'))
    m, _ = culture_map(ML + 12, py + 30, HALF - 24, 176); s.append(m)
    # legend left
    ly = py + ph - 12 - 9
    s.append(box(ML + 12, ly, HALF - 24, 9, "t-chart c-ink",
        '<span style="display:flex;gap:12pt;align-items:center">'
        '<span style="display:inline-flex;gap:4pt;align-items:center"><svg width="12pt" height="4pt" viewBox="0 0 12 4"><line x1="0" y1="2" x2="12" y2="2" stroke="var(--color-muted)" stroke-width="1" stroke-dasharray="3 2"/></svg>Now</span>'
        '<span style="display:inline-flex;gap:4pt;align-items:center"><svg width="12pt" height="4pt" viewBox="0 0 12 4"><line x1="0" y1="2" x2="12" y2="2" stroke="var(--color-brand)" stroke-width="1.5"/></svg>Preferred</span>'
        '<span style="display:inline-flex;gap:4pt;align-items:center"><svg width="12pt" height="4pt" viewBox="0 0 12 4"><line x1="0" y1="2" x2="12" y2="2" stroke="var(--chart-reference)" stroke-width="0.5" stroke-dasharray="2 2"/></svg>Even share, 25</span>'
        '</span>'))
    b, _ = shift_bars(ML + HALF + GUT + 12, py + 30, HALF - 24, 176); s.append(b)
    s.append(box(ML + HALF + GUT + 12, ly, HALF - 24, 9, "t-chart c-ink", "Points between Now and Preferred, by orientation"))
    # key indicators table
    s.append(box(ML, 543, CW, None, "t-h2 c-ink", '<h2 style="font:inherit">Key indicators</h2>'))
    pg = S["perception_gap"]; coh = S["cohorts"]; rd = S["readiness"]; eos = S["eos"]
    neg = [k for k in [f"Q{i}" for i in range(1, 9)] if eos[k] < 0]
    lens = S["congruence"]["lens"]
    rows = [
        ("Culture strength", S["culture_strength"], None, S["strength_band"].title(), f"Perform leads Engage by only {lead:.2f} points."),
        ("Largest culture gap", signed(GAP["ENGAGE"]), None, "Significant", "More Engage wanted; less Perform and Govern."),
        ("Strategy congruence", S["congruence"]["dimension_pct"] + "%", None, S["congruence"]["band"].title(),
            f"Practice leans {NAME[lens['PRACTICE']]}, strategy {NAME[lens['STRATEGY']]}, leadership {NAME[lens['LEADERSHIP']]}."),
        ("Perception gap", pg["ENGAGE"], "watch", "Shadow culture",
            f"Executives put Engage at {coh['executive']['now']['ENGAGE']}, staff at {coh['staff']['now']['ENGAGE']}."),
        ("Change readiness", rd["tps"], None, "Enablement required",
            f"Readiness scores run from {min(float(rd['d7']),float(rd['d8']),float(rd['d9'])):.2f} to {max(float(rd['d7']),float(rd['d8']),float(rd['d9'])):.2f}; support before scale."),
        ("Culture Risk Index", risk["index"], None, risk["band"].title(), f"Spread of answers, at {risk['dispersion']}, drives it most."),
        ("Employee voice index", eos["index"], "watch", f"{len(neg)} of 8 negative", f"Detractors lead on {len(neg)} of the 8 voice scores."),
    ]
    tr = ""
    for a, sc, ic, rating, mean in rows:
        rt = (icon(ic) + " " if ic else "") + esc(rating)
        tr += f'<tr><td class="first">{esc(a)}</td><td class="r tnum">{esc(sc)}</td><td>{rt}</td><td>{esc(mean)}</td></tr>'
    s.append(box(ML, 565, CW, None, "",
        f'<table class="t t-table"><colgroup><col style="width:116pt"><col style="width:52pt"><col style="width:108pt"><col></colgroup>'
        f'<thead><tr><th class="t-table-head">Indicator</th><th class="t-table-head r">Score</th><th class="t-table-head">Rating</th><th class="t-table-head">What it means for {esc(CLIENT)}</th></tr></thead><tbody>{tr}</tbody></table>',
        attrs=' id="kpi-table"'))
    p.append(section("".join(s), "Executive summary, page 5"))

    # ---------- page 6 ----------
    s = [frame(6, "es2")]
    s.append(box(ML, MT, CW, None, "t-h1 c-ink", '<h2 style="font:inherit">The Big Three</h2>'))
    ex, st = coh["executive"]["now"]["ENGAGE"], coh["staff"]["now"]["ENGAGE"]
    others = {k: v for k, v in pg.items() if k != "ENGAGE"}; nk = max(others, key=lambda k: float(others[k]))
    q = S["eos_detail"]; low = min(neg, key=lambda k: eos[k]); rest = sorted([eos[k] for k in neg if k != low])
    def words(n): return f"minus {abs(n)}" if n < 0 else str(n)
    cards = [
        ("miss", "Miss", "cross", num(NOW["INNOVATE"]), "Innovate now, last of four",
         "Strategy check: the culture does not yet carry the innovation goal", [
            ("Finding", f"Innovate is the weakest orientation today, at {NOW['INNOVATE']} points, while the strategy depends on new business models."),
            ("Evidence", f"It ranks fourth of four. People would raise it to {PREF['INNOVATE']} if they could, a shift of {GAP['INNOVATE']} points."),
            ("Consequence", f"New model work will compete for time with a Perform culture, at {NOW['PERFORM']}, that rewards today\u2019s targets."),
            ("Action", "Protect time and budget for a small set of new model pilots and review them at every executive meeting. <b>Owner:</b> executive team. <b>Timing:</b> first 90 days."),
         ]),
        ("flag", "Shadow culture", "watch", num(pg["ENGAGE"]), "Points apart on Engage",
         "Executives and staff describe two different organisations", [
            ("Finding", f"Executives score Engage at {ex}; staff score it at {st}, a gap of {pg['ENGAGE']} points."),
            ("Evidence", f"{EXEC_N} executives and {STAFF_N} staff answered. Engage is the only orientation flagged; the next widest gap is {NAME[nk]} at {pg[nk]}."),
            ("Consequence", "Change messages from the top risk reading as out of touch and raising cynicism before the programme starts."),
            ("Action", "Open a direct route for staff views to reach the executive team before the first change message. <b>Owner:</b> chief executive. <b>Timing:</b> before launch."),
         ]),
        ("flag", "Watch", "watch", num(f"{len(neg)} of 8"), "Voice scores below zero",
         "Critics outnumber supporters on half the employee voice scores", [
            ("Finding", f"Four of the eight employee voice scores are below zero; the lowest, {QN[low].lower()}, stands at {words(eos[low])}."),
            ("Evidence", f"On the lowest score, {q[low]['detractors']} of {q[low]['n']} people are detractors and {wd(q[low]['promoters'])} promoters. The others sit at {words(rest[0])}, {words(rest[1])} and {words(rest[2])}."),
            ("Consequence", "A change programme would start with more doubt than backing in these four areas."),
            ("Action", "Run listening sessions on the four lowest scores and report back the changes made. <b>Owner:</b> People and Culture lead. <b>Timing:</b> first 60 days."),
         ]),
    ]
    flow = "".join(finding_card(0, *c) for c in cards)
    sowhat = (f'<aside class="callout" data-block="so-what" style="padding:12pt"><div class="t-panel-title c-ink">So what</div>'
              f'<p class="t-body c-ink" style="margin-top:4pt">The strategy needs Innovate, yet the culture rewards delivery at {NOW["PERFORM"]}, and leaders and staff see Engage {pg["ENGAGE"]} points apart. Close that gap first.</p></aside>')
    s.append(box(ML, 98, CW, None, "", flow + sowhat, "display:flex;flex-direction:column;gap:16pt", attrs=' id="es2-flow"'))
    p.append(section("".join(s), "Executive summary, page 6"))
    return page_html("CDP report: executive summary", p)

def main():
    open(f"{OUT}/tokens.css", "w").write(css())
    files = {
        "01-page-frame.html": build_frame(),
        "02-cover.html": build_cover(),
        "03-about.html": build_about(),
        "04-back-page.html": build_back(),
        "06-chapter-opener.html": build_opener(),
        "07-executive-summary.html": build_es(),
    }
    toc_html, geo = build_contents(); files["05-contents.html"] = toc_html
    for k, v in files.items(): open(f"{OUT}/{k}", "w").write(v)
    json.dump(geo, open("/tmp/w/toc_geo.json", "w"))
    print("written", sorted(files))

if __name__ == "__main__":
    main()
