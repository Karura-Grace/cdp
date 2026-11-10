#!/usr/bin/env python3
"""Build CDP report template, group 3 (action and reference pages), HTML A4 in points.

Imports build_group2 (and through it build_group1) for tokens, frame, opener,
icons, tables, svg helpers. Charts are inline SVG in panel local coordinates;
SVG text uses baselines, as pdfkit does after the SPEC-group-1 0.1 offset.
Every number comes from report-sample-data.json or is computed from it.
Wording of actions, owners, timings, governance and sessions is SAMPLE WORDING
for the Culture Practitioner to replace; see SPEC-group-3.md.
"""
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_group1 as g1
import build_group2 as g2
from build_group2 import (esc, box, section, chapter_opener, icon, ORDER, NAME, ML, MT, CW, RX, CB, HALF, D, S, T,
    tw, INK, MUTED, WHITE, BRAND, SURF, GRID, BAND_W, NEG, ser, tint, MINUS, f1, f2, s1, s2, s0, n0, num,
    svg, tx, txk, ln, rc, circ, diamond, icon_at, panel, pair, headline, h1, h2, sowhat, group, star, sig,
    table, empty_row, frame, html_doc, NOW, PREF, GAP, DIMS, DNOW, DPREF, LENS, EX, ST, EXN, STN, PG, PFLAG,
    RD, RISK, EOS, EOSD, QS, FIND, CHECKS, SCEN)
from PIL import ImageFont

OUT = g1.OUT
TOTAL = 40
g1.TOTAL_PAGES = TOTAL
def frame3(no):
    return frame(no).replace("of 41", f"of {TOTAL}")
def page(no, inner_flow, aria, opener=None, y0=None):
    s = [frame3(no)]
    y = 120 if opener else MT
    if opener: s.append(chapter_opener(MT, *opener))
    s.append(box(ML, y0 or y, CW, None, "flow", inner_flow, attrs=f' id="flow-{no}"'))
    return section("".join(s), aria)

NM = D["names"]; DIMN = NM["dimensions"]; QN = NM["voice"]
DEP = D["departments"]["rows"]; L360 = D["leadership_360"]; TH = D["themes"]
CLIENT = D["organisation"]
QF = sorted([q for q in QS if EOS[q] < 0], key=lambda q: EOS[q])          # voice scores below zero, lowest first
def dep(lbl): return next(d for d in DEP if d["label"] == lbl)
def h1(no, title):
    """Section heading. Number column 28 (as group 2) or the number width + 8 when wider, e.g. "12.1"."""
    col = max(28, round(tw(no, 14, 700) + 8, 2)) if "." in no else round(tw(no, 14, 700) + 8, 2)
    return f'<h2 class="t-h1 c-ink" data-block="h1"><span class="tnum" style="display:inline-block;min-width:{col}pt">{esc(no)}</span>{esc(title)}</h2>'
WORDS = "zero one two three four five six seven eight nine ten".split()
def wd(n, cap=False):
    """Small counts in prose as words (house style); 11 and up stay figures."""
    w_ = WORDS[n] if 0 <= n <= 10 else str(n); return w_.capitalize() if cap else w_
def dense(tbl):
    """Dense table variant: numeric cells padded 4 left and right (first column keeps 12). For 7 or more columns."""
    return tbl.replace('<table class="t t-table"', '<table class="t t-table dense"', 1)
DENSE_CSS = '<style>table.t.dense td:not(.first),table.t.dense th:not(:first-child){padding-left:4pt;padding-right:4pt}</style>'
def bn(v): return f'<span class="c-brand" style="font-weight:700">{num(v)}</span>'

# ---------------------------------------------------------------- small blocks
def marker(n):
    return (f'<span class="t-kpi-label" aria-hidden="true" style="display:inline-flex;width:16pt;height:16pt;border-radius:50%;'
            f'background:{BRAND};color:{INK};align-items:center;justify-content:center;flex:none;letter-spacing:0">{n}</span>')
def tag(label, value):
    """Owner and timing tag: fully round pill (radius.pill, owner ruling 4 Nov 2026; tags only)."""
    return (f'<span class="t-table c-ink" data-block="tag" style="display:inline-flex;align-items:center;height:18pt;padding:0 8pt;'
            f'background:{SURF};border-radius:var(--radius-pill);white-space:nowrap"><b style="font-weight:600">{esc(label)}:</b>&nbsp;{esc(value)}</span>')
def figures(items):
    cells = "".join(f'<div><div class="t-h1 c-ink tnum">{num(v)}</div><div class="t-table c-ink">{esc(l)}</div></div>' for v, l in items)
    return f'<div data-block="evidence-figures" style="display:grid;grid-template-columns:repeat(4,1fr);column-gap:8pt">{cells}</div>'

def priority_card(n, area, title, owner, timing, finding, evid, consequence, action, signal):
    rows = (f'<b class="t-body-strong">Finding</b><p class="t-body">{finding}</p>'
            f'<b class="t-body-strong">Evidence</b>{figures(evid)}'
            f'<b class="t-body-strong">Consequence</b><p class="t-body">{consequence}</p>'
            f'<b class="t-body-strong">Action</b><p class="t-body">{action}</p>')
    return (f'<article class="card" data-block="priority-card" style="padding:12pt" aria-label="Priority {n}">'
            f'<div style="display:flex;align-items:center;gap:8pt">{marker(n)}<span class="t-kpi-label c-ink" style="white-space:nowrap">Priority {n} \u00b7 {esc(area)}</span>'
            f'<span style="margin-left:auto;display:flex;gap:8pt">{tag("Owner", owner)}{tag("Timing", timing)}</span></div>'
            f'<h3 class="t-h2 c-ink" style="margin-top:8pt">{esc(title)}</h3>'
            f'<div style="display:grid;grid-template-columns:76pt 1fr;column-gap:8pt;row-gap:8pt;margin-top:12pt">{rows}</div>'
            f'<div data-block="signal" style="margin-top:12pt;background:{SURF};border-radius:var(--radius-1);padding:8pt 12pt">'
            f'<p class="t-body c-ink">{icon("watch")} <span class="t-panel-title c-ink">Signal to watch</span>&nbsp; {signal}</p></div></article>')

# ---------------------------------------------------------------- priority content (numbers from data, wording sample)
fin, ops, pc, sal, tec = dep("Finance"), dep("Operations"), dep("People and Culture"), dep("Sales"), dep("Technology")
D8I = [float(x) for x in S["readiness_items"]["D8"]]
PRI = [
    dict(area="Engage", title="Close the split between how executives and staff see the organisation",
         owner="CEO and executive team", timing="Days 1 to 30",
         finding=f"Executives and staff describe two different organisations. The split is widest on Engage, where the platform raises a shadow culture flag.",
         evid=[(f2(EX["ENGAGE"]), f"Executives, {EXN} people"), (f2(ST["ENGAGE"]), f"Staff, {STN} people"),
               (f2(PG["ENGAGE"]), "Points apart"), (f2(LENS["LEADERSHIP"]["ENGAGE"]), "Engage in leadership")],
         consequence="Programmes designed at the top will read as out of touch, and more communication will deepen cynicism before any content lands.",
         action="Run an unfiltered listening round in all five departments before any programme is announced, and have the executive team answer what it hears in writing.",
         signal="Executive and staff Engage scores move closer at the next pulse, and the shadow culture flag clears."),
    dict(area="Innovate", title="Build the Innovate capability the strategy depends on",
         owner="COO with the Head of Technology", timing="Months 1 to 9",
         finding="The strategy relies on new business models, yet Innovate is the weakest of the four orientations. The strategy check on this goal is a Miss.",
         evid=[(f2(NOW["INNOVATE"]), "Innovate now"), (f2(PREF["INNOVATE"]), "Innovate preferred"),
               (s0(EOS["Q3"]), "Innovation climate"), (f1(tec["now"]["INNOVATE"]), "Technology, Innovate")],
         consequence="New models would launch into a culture that rewards delivery over experiment, and staff who want more Innovate would read the strategy as words.",
         action=f"Use Technology as the teaching ground: two teams from Operations and Sales each run one customer experiment under Technology coaching, with results shown to all staff.",
         signal=f"The innovation climate score rises from {s0(EOS['Q3'])}, and Innovate grows in Operations ({f1(ops['now']['INNOVATE'])}) and Finance ({f1(fin['now']['INNOVATE'])})."),
    dict(area="Employee voice", title="Repair the four voice scores below zero",
         owner="Head of People and Culture", timing="Months 1 to 6",
         finding=f"Four of eight voice scores sit below zero. Innovation climate and development are the lowest, and strategic clarity is close behind.",
         evid=[(s0(EOS[q]), QN[q]) for q in QF[:4]],
         consequence=f"{EOSD['Q4']['detractors']} of {EOSD['Q4']['n']} people are detractors on development. Without visible paths to grow, the shift to Innovate has few people ready to carry it.",
         action=f"Publish a growth path for every role family and protect learning time. Explain each major decision and its reasons on the floor within a week, since decisions draw {TH['rows'][1]['share_pct']} percent of comments.",
         signal=f"Detractors on development fall below promoters (now {EOSD['Q4']['detractors']} against {EOSD['Q4']['promoters']}), and recognition stops leading the comment themes."),
    dict(area="Departments", title="Bring the department subcultures into one operating logic",
         owner="Department heads, chaired by the COO", timing="Months 2 to 9",
         finding="Three departments run on their own logic. Finance leads with Govern and People and Culture with Engage, while the organisation leads with Perform.",
         evid=[(s1(fin["diff"]["GOVERN"]), "Finance, Govern"), (s1(pc["diff"]["ENGAGE"]), "People and Culture, Engage"),
               (s1(sal["diff"]["GOVERN"]), "Sales, Govern"), (s1(tec["diff"]["INNOVATE"]), "Technology, Innovate")],
         consequence="Work slows at the boundaries between departments, and programmes designed for the whole organisation land unevenly.",
         action=f"Hold one boundary session for each pair of departments that hand work across, starting with Finance and Sales, whose Govern scores sit {f1(fin['now']['GOVERN'] - sal['now']['GOVERN'])} points apart.",
         signal="Each department's difference from the organisation narrows to under 8 points on its lead orientation."),
    dict(area="Readiness", title="Prepare people to absorb the change",
         owner="Head of People and Culture", timing="Months 1 to 12",
         finding=f"Readiness sits at {RD['tps']} on a 1 to 5 scale, in the band where enablement is needed before change can land.",
         evid=[(RD["tps"], "Readiness, 1 to 5"), (f2(RD["d8"]), "Psychological safety"),
               (f2(min(D8I)), "Lowest safety item"), (f"{L360['bands']['Enablement required']} of {L360['valid']}", "Leaders to enable")],
         consequence="Pushing Innovate into teams where people hesitate to speak up will produce compliance, not experiment.",
         action=f"Train the {wd(L360['valid'])} leaders with valid 360 results to run safe team reviews, starting with the {wd(L360['bands']['Enablement required'])} whose results show enablement is required. The Culture Practitioner coaches the first round.",
         signal=f"No psychological safety item falls below 3.00 at the next pulse, and the lowest item rises from {f2(min(D8I))}."),
]

def p_priorities():
    cards = [priority_card(i + 1, **p) for i, p in enumerate(PRI)]
    pages = []
    hl = headline(f'Five priorities, in order. Start with the {bn(f2(PG["ENGAGE"]))} point split on Engage between executives and staff.')
    pages.append(page(27, hl + cards[0] + cards[1], "Page 27, What to do next, priorities 1 and 2", opener=("12", "What to do next")))
    hl = headline(f'Priorities 3 and 4 concern how people experience work: {wd(len(QF))} voice scores below zero and three departments on their own logic.')
    pages.append(page(28, h1("12.1", "Priorities, continued") + hl + cards[2] + cards[3], "Page 28, priorities 3 and 4"))
    # quick wins
    q = [
        ("Share the headline results with all staff, unedited", f"Executives and staff {f2(PG['ENGAGE'])} apart on Engage", "CEO", "Day 10"),
        ("Open an anonymous question route to the executive team and answer it every week", f"{EOSD['Q2']['detractors']} of {EOSD['Q2']['n']} detractors on leadership", "Executive team", "Day 14"),
        ("Explain the reasons behind the next three major decisions on the floor", f"Decisions: {TH['rows'][1]['share_pct']}% of comments", "Department heads", "Day 30"),
        ("Name and thank team contributions in every monthly meeting", f"Recognition: {TH['rows'][0]['share_pct']}% of comments, the top theme", "All managers", "Day 30"),
        ("Choose two customer experiments for the Innovate pilot and name the teams", f"Innovate {f2(NOW['INNOVATE'])}, lowest of four", "COO, Head of Technology", "Day 30"),
    ]
    rows = [[num(i + 1), esc(a), esc(b), esc(c), num(d)] for i, (a, b, c, d) in enumerate(q)]
    tbl = table([28, 186, 140, 85, None], ["#", "Quick win", "Why now", "Owner", "Done by"], rows, "table-quick-wins")
    hl = headline(f'Readiness of {RD["tps"]} sets the pace. Five quick wins in the first 30 days show staff the results are being acted on.')
    flow = (h1("12.1", "Priorities, continued") + hl + cards[4] +
            group(h1("12.2", "Quick wins, first 30 days"), tbl))
    pages.append(page(29, flow, "Page 29, priority 5 and quick wins"))
    return html_doc("CDP report: What to do next, priorities and quick wins", pages)

# ---------------------------------------------------------------- phase plan
TIMES = [(0, 1), (0, 9), (0, 6), (1, 9), (0, 12)]
def ch_timeline(w=CW, h=184):
    x0, x1 = 140, w - 12; m = (x1 - x0) / 18
    X = lambda mo: x0 + mo * m
    rows = [f"{i+1}  {p['title']}" for i, p in enumerate(PRI)] + ["6  Reassess and embed"]
    short = ["Executive and staff split", "Innovate capability", "Voice scores below zero", "Department subcultures", "Readiness", "Reassess and embed"]
    spans = TIMES + [(9, 18)]
    top, pitch = 40, 18
    yb = top + pitch * len(rows)
    b = []
    for (a, z, nm_, fill) in ((0, 3, "Months 1 to 3", WHITE), (3, 9, "Months 4 to 9", BAND_W), (9, 18, "Months 10 to 18", WHITE)):
        b.append(rc(X(a), 30, X(z) - X(a), yb - 30 + 4, fill))
        b.append(tx((X(a) + X(z)) / 2, 26, nm_, 7, 600, "middle"))
    for mo in range(0, 19, 3): b.append(ln(X(mo), 30, X(mo), yb + 4, GRID, 0.5))
    for mo in (12, 18):
        b.append(ln(X(mo), 30, X(mo), yb + 4, INK, 1, "3 2"))
    for i, (lab, (a, z)) in enumerate(zip(short, spans)):
        y = top + pitch * i
        b.append(tx(12, y + 7.5, f"{i+1}", 7, 600)); b.append(tx(24, y + 7.5, lab, 7, 600))
        b.append(rc(X(a), y, X(z) - X(a), 10, INK))
    for mo in (12, 18):
        b.append(diamond(X(mo), yb - pitch + 5, 4.5, INK, WHITE, 1.25))
    b.append(ln(x0, yb + 4, x1, yb + 4, INK, 0.75))
    for mo in range(0, 19, 3): b.append(tx(X(mo), yb + 14, str(mo), 7, 400, "middle"))
    b.append(tx(x0 - 6, yb + 14, "Month", 7, 400, "end"))
    ly = h - 13.95
    b.append(rc(12, ly - 6, 10, 7, INK)); b.append(tx(26, ly, "Planned work"))
    lx = 26 + tw("Planned work") + 12
    b.append(diamond(lx + 5, ly - 2.5, 3.5, INK)); b.append(ln(lx + 5, ly - 8, lx + 5, ly + 3, INK, 1, "3 2"))
    b.append(tx(lx + 14, ly, "Culture measured again, months 12 and 18"))
    return panel("Plan over 18 months", w, h, "".join(b), "timeline", "Gantt chart of the five priorities and the reassessment over 18 months")

def p_phases():
    tl = ch_timeline()
    def cell(lines): return "".join(f'<div{" style=&quot;margin-top:4pt&quot;" if 0 else ""}>{esc(l)}</div>' for l in lines).replace("<div>", '<div style="margin-bottom:4pt">', len(lines) - 1)
    rows = [
        ["Listen and respond", num("Months 1 to 3"), cell(["Listening round and written executive response", "Growth paths published for every role family", "Innovate pilot teams named"]),
         cell(["Staff see the executive response before day 30", "Growth path live for every role family"])],
        ["Pilot and connect", num("Months 4 to 9"), cell(["Innovate pilots in Operations and Sales", "Boundary sessions between departments", f"{wd(L360['valid'], True)} leaders trained in safe team reviews"]),
         cell([f"Innovation climate above {s0(EOS['Q3'])}", "Every department pair has met at least once"])],
        ["Scale and embed", num("Months 10 to 18"), cell(["Scale the pilots that worked", "Build Engage and Innovate into goals and recognition", "Culture measured again at 12 and 18 months"]),
         cell(["Engage and Innovate on their 12 and 18 month targets (chapter 13)", "Shadow culture flag cleared"])],
    ]
    tbl = table([78, 92, 174, None], ["Phase", "Timeline", "Key initiatives", "Success indicators"], rows, "table-phases")
    hl = headline("Three phases over 18 months: listen and respond, pilot and connect, then scale and embed, with the culture measured again at 12 and 18 months.")
    sw = sowhat(f"All five priorities start in the first three months. The executive response to the {f2(PG['ENGAGE'])} point Engage split comes first, because every later step depends on staff trusting it.")
    flow = h1("12.3", "Phase plan") + hl + tl + group(h2("What each phase delivers"), tbl) + sw
    return html_doc("CDP report: Phase plan", [page(30, flow, "Page 30, phase plan")])

# ---------------------------------------------------------------- principles
def p_principles():
    pr = [
        ("Listen before launching", f"Executives and staff sit {f2(PG['ENGAGE'])} points apart on Engage. Each initiative starts from what staff said, not from what leaders assume."),
        ("Keep what works in Perform", f"Perform leads at {f2(NOW['PERFORM'])} and carries delivery. People want less of it ({s2(GAP['PERFORM'])}), so ease how people are managed, not the standards customers receive."),
        ("Grow Innovate where it already lives", f"Technology scores {f1(tec['now']['INNOVATE'])} on Innovate, the highest of any department. Spread its methods before buying new ones."),
        ("Give the reason for every decision", f"Decisions draw {TH['rows'][1]['share_pct']} percent of comments. Every change states why, who decided and what happens next."),
        ("One scorecard, local actions", f"{wd(len(DEP), True)} departments show {wd(len(set(d['dominant'] for d in DEP)))} different lead orientations. Heads adapt the actions; the scorecard stays the same for all."),
        ("Recognise the behaviour you want", f"Recognition is the top comment theme at {TH['rows'][0]['share_pct']} percent. Thank Engage and Innovate behaviour in public, every month."),
    ]
    cards = "".join(
        f'<article class="panel" data-block="principle" style="padding:12pt"><div style="display:flex;align-items:center;gap:8pt">{marker(i+1)}'
        f'<h3 class="t-h2 c-ink">{esc(t)}</h3></div><p class="t-body c-ink" style="margin-top:8pt">{esc(b)}</p></article>' for i, (t, b) in enumerate(pr))
    grid = f'<div data-block="principle-grid" style="display:grid;grid-template-columns:{HALF}pt {HALF}pt;gap:16pt">{cards}</div>'
    nn = [
        "No leader is named or ranked from the 360 results. Each leader's result is private and used for development only.",
        "No result is shown for a group of fewer than 5 people.",
        "The executive team answers the listening round in writing before any programme launches.",
        "Delivery standards stay in force while Perform eases. The change is in how people are managed, not in what customers receive.",
    ]
    items = "".join(f'<li style="display:flex;gap:8pt;margin-top:8pt">{icon("cross")}<span class="t-body c-ink">{esc(x)}</span></li>' for x in nn)
    box_ = (f'<aside class="callout" data-block="non-negotiables" style="padding:12pt"><div class="t-panel-title c-ink">Non negotiables</div>'
            f'<ul style="list-style:none">{items}</ul></aside>')
    hl = headline("Six principles guide every action in this plan, and four rules hold however strong the pressure to move fast.")
    flow = h1("12.4", "Change principles and non negotiables") + hl + grid + box_
    return html_doc("CDP report: Change principles", [page(31, flow, "Page 31, change principles and non negotiables")])

# ---------------------------------------------------------------- KPI scorecard
def target(base, months, higher=True, lo=0.0, hi=100.0):
    """Platform target rule (owner ruling 4 Nov 2026): step = 10 percent (12 months) or 20 percent (18 months)
    of the absolute baseline, or of the scale range when the baseline is zero; in the better direction; capped at the scale ends."""
    base = float(base); p = 0.10 if months == 12 else 0.20
    step = p * (abs(base) if base != 0 else (hi - lo))
    v = base + step if higher else base - step
    return round(min(hi, max(lo, v)), 2)
def t12(o): return target(NOW[o], 12)
def t18(o): return target(NOW[o], 18)
def ch_targets(w=HALF, h=200):
    x0, x1, yt, y0 = 36, w - 12, 36, 160; k = (y0 - yt) / 40
    Y = lambda v: y0 - v * k
    b = []
    for v in (10, 20, 30, 40):
        b.append(ln(x0, Y(v), x1, Y(v))); b.append(tx(x0 - 4, Y(v) + 2.5, str(v), 7, 400, "end"))
    b.append(ln(x0, Y(25), x1, Y(25), INK, 0.5, "2 2"))
    gw = (x1 - x0) / 2
    for gi, o in enumerate(("ENGAGE", "INNOVATE")):
        cx = x0 + gw * gi + gw / 2; bx = cx - 31
        vals = [(NOW[o], "base"), (t12(o), "t12"), (t18(o), "t18")]
        for j, (v, kind) in enumerate(vals):
            x = bx + j * 22; top = Y(v); hh = y0 - top
            if kind == "base": b.append(rc(x + 0.5, top + 0.5, 17, hh - 0.5, tint(o), ser(o), 1))
            elif kind == "t12": b.append(rc(x + 0.5, top + 0.5, 17, hh - 0.5, WHITE, ser(o), 1, ' stroke-dasharray="3 2"'))
            else: b.append(rc(x, top, 18, hh, ser(o), INK, 0.5))
            b.append(txk(x + 9, top - 3, f1(v), "middle"))
        b.append(tx(cx, 172, NAME[o], 7, 600, "middle"))
    b.append(ln(x0, y0, x1, y0, INK, 0.75))
    ly = h - 13.95; lx = 12; out = []
    for kind, lab in (("base", "Baseline"), ("t12", "12 months"), ("t18", "18 months"), ("ref", "Even share 25")):
        if kind == "base": out.append(rc(lx, ly - 6, 10, 7, BAND_W, INK, 1))
        elif kind == "t12": out.append(rc(lx, ly - 6, 10, 7, WHITE, INK, 1, ' stroke-dasharray="3 2"'))
        elif kind == "t18": out.append(rc(lx, ly - 6, 10, 7, MUTED, INK, 0.5))
        else: out.append(ln(lx, ly - 2.5, lx + 10, ly - 2.5, INK, 0.5, "2 2"))
        out.append(tx(lx + 14, ly, lab)); lx += 14 + tw(lab) + 10
    b += out
    return panel("Engage and Innovate targets", w, h, "".join(b), "chart-targets", "Engage and Innovate, baseline and targets at 12 and 18 months")

def ch_voice_lift(w=HALF, h=200):
    x0, x1 = 100, w - 12; zero = (x0 + x1) / 2; k = (x1 - x0) / 100
    X = lambda v: zero + v * k
    b = []
    for v in (-50, -25, 25, 50): b.append(ln(X(v), 34, X(v), 146))
    for i, q in enumerate(QF):
        y = 44 + 24 * i; v = EOS[q]; t_ = target(v, 12, True, -100, 100)
        b.append(tx(12, y + 9, QN[q], 7, 600))
        b.append(rc(X(v), y, zero - X(v), 12, NEG, INK, 0.5))
        b.append(tx(X(v) - 4, y + 9, s0(v), 7, 400, "end"))
        b.append(ln(X(t_), y - 2, X(t_), y + 14, INK, 1.25))
    b.append(ln(zero, 34, zero, 146, INK, 0.75))
    b.append(txk(zero + 4, 32, "Tick: 12 months", "start", 7, 600))
    for v in (-50, -25, 0, 25, 50): b.append(tx(X(v), 158, s0(v) if v else "0", 7, 400, "middle"))
    b.append(tx(12, h - 13.95, f"Baseline, all {EOSD['Q1']['n']} respondents; tick marks the 12 month target", 8.5, 400, "start", None, "c"))
    return panel("Voice scores to lift", w, h, "".join(b), "chart-voice-lift", "Voice scores below zero with the 12 month target")

def kpi_rows():
    """Targets by the platform rule (target()); higher is better except the Culture Risk Index and gaps."""
    f2s = lambda v: s2(v) if v < 0 else f2(v)
    r = [
        ["Engage, share of the culture", num(f2(NOW["ENGAGE"])), num(f2(t12("ENGAGE"))), num(f2(t18("ENGAGE"))), "CDP reassessment"],
        ["Innovate, share of the culture", num(f2(NOW["INNOVATE"])), num(f2(t12("INNOVATE"))), num(f2(t18("INNOVATE"))), "CDP reassessment"],
        ["Executive and staff gap on Engage, lower is better", num(f2(PG["ENGAGE"])), num(f2(target(PG["ENGAGE"], 12, False))), num(f2(target(PG["ENGAGE"], 18, False))), "CDP cohorts"],
    ]
    for q in QF: r.append([f"Voice: {esc(QN[q])}", num(s0(EOS[q])), num(f2s(target(EOS[q], 12, True, -100, 100))), num(f2s(target(EOS[q], 18, True, -100, 100))), "CDP employee voice"])
    rv = float(RD["tps"]); ri = float(RISK["index"])
    lr = L360["bands"]["Ready with support"]; lv = L360["valid"]
    r += [
        ["Readiness, 1 to 5", num(RD["tps"]), num(f2(target(rv, 12, True, 1, 5))), num(f2(target(rv, 18, True, 1, 5))), "CDP readiness"],
        ["Culture Risk Index, lower is better", num(f"{RISK['index']}, {RISK['band'].title()}"), num(f"{target(ri, 12, False):g}"), num(f"{target(ri, 18, False):g}"), "CDP analytics"],
        ["Leaders ready with support", num(f"{lr} of {lv}"), num(f"{target(lr, 12, True, 0, lv):g} of {lv}"), num(f"{target(lr, 18, True, 0, lv):g} of {lv}"), "Leadership 360"],
    ]
    return r

def p_kpi():
    pages = []
    hl = headline(f'{wd(len(kpi_rows()), True)} measures track the plan. Engage moves from {bn(f2(NOW["ENGAGE"]))} now to {num(f2(t18("ENGAGE")))} at 18 months, the platform target.')
    tbl = table([180, 76, 66, 66, None], ["KPI", "Baseline", "12 month", "18 month", "Source"], kpi_rows(), "table-kpi", right=(1, 2, 3))
    sw = sowhat(f"Staff prefer Engage at {f2(PREF['ENGAGE'])}, well beyond the 18 month target, so the targets are a first step. The {wd(len(QF))} voice scores and the Engage split are the early signals; they move first or the targets will not.")
    note = '<p class="t-caption c-muted" data-block="kpi-note">Targets are set by the platform and may be changed by the Culture Practitioner before release.</p>'
    flow = hl + pair(ch_targets(), ch_voice_lift()) + group(h2("KPI table"), tbl, note, gap=4) + sw
    pages.append(page(32, flow, "Page 32, Culture KPI scorecard", opener=("13", "Culture KPI scorecard")))
    gov = [
        ["Executive culture review", "CEO and executive team, with the Culture Practitioner", "Every quarter", "Scorecard, progress on the five priorities, risks"],
        ["Department check in", "Each department head with the team", "Every month", "Quick wins, pilot progress, local voice"],
        ["Staff pulse", f"All staff, anonymous, groups of 5 or more", "Every 6 months", "Voice scores, Engage split, comment themes"],
        ["Board update", "Board, presented by the CEO", "Every 6 months", "Scorecard summary and decisions needed"],
    ]
    gtbl = table([130, 140, 90, None], ["Forum", "Who", "How often", "What it reviews"], [[esc(c) for c in r] for r in gov], "table-governance")
    def listpanel(title, when, items, block):
        li = "".join(f'<li class="t-table c-ink" style="display:flex;justify-content:space-between;gap:8pt;padding:4pt 0;border-top:0.5pt solid {GRID}"><span>{esc(a)}</span><span class="tnum" style="font-weight:600">{esc(b)}</span></li>' for a, b in items)
        return (f'<div class="panel" data-block="{block}" style="padding:12pt"><div class="t-panel-title c-ink">{esc(title)}</div>'
                f'<p class="t-caption c-ink" style="margin-top:4pt">{esc(when)}</p><ul style="list-style:none;margin-top:8pt">{li}</ul></div>')
    lead = listpanel("Leading measures", "Move first. Read every quarter.", [(QN[q], s0(EOS[q])) for q in QF] +
                     [("Recognition share of comments", f"{TH['rows'][0]['share_pct']}%"), ("Quick wins done", "0 of 5")], "panel-leading")
    lag = listpanel("Lagging measures", "Move last. Read at 12 and 18 months.", [("Engage share", f2(NOW["ENGAGE"])), ("Innovate share", f2(NOW["INNOVATE"])),
                    ("Executive and staff gap on Engage", f2(PG["ENGAGE"])), ("Readiness, 1 to 5", RD["tps"]), ("Culture Risk Index", RISK["index"]),
                    ("Leaders ready with support", f"{L360['bands']['Ready with support']} of {L360['valid']}")], "panel-lagging")
    lp = f'<div class="pair" data-block="lead-lag-pair">{lead}{lag}</div>'
    hl2 = headline("The executive team reviews the scorecard every quarter. Voice scores give the early warning; culture shares confirm it.")
    sw2 = sowhat(f"If the {wd(len(QF))} voice scores below zero have not moved by the first staff pulse, revisit priorities 1 and 3 before the 12 month reassessment.")
    flow2 = h1("13.2", "Governance, leading and lagging measures") + hl2 + group(h2("Governance rhythm"), gtbl) + lp + sw2
    pages.append(page(33, flow2, "Page 33, governance and measures"))
    return html_doc("CDP report: Culture KPI scorecard", pages)

# ---------------------------------------------------------------- appendix A data tables
def rowstar(vals, fmt):
    m = max(vals); return [star(fmt(v)) if v == m else num(fmt(v)) for v in vals]
def two_head_table(cols, top, head, rows, block):
    cg = "".join(f'<col style="width:{c}pt">' if c else "<col>" for c in cols)
    t1 = "".join(f'<th class="t-table-head{" r" if r_ else ""}" colspan="{cs}" style="{"text-align:center;" if cs > 1 else ""}border-bottom:0.5pt solid var(--color-muted)">{esc(h)}</th>' for h, cs, r_ in top)
    t2 = "".join(f'<th class="t-table-head{" r" if i else ""}">{esc(h)}</th>' for i, h in enumerate(head))
    tr = "".join("<tr>" + "".join(f'<td class="{"first" if i == 0 else "r tnum"}">{c}</td>' for i, c in enumerate(r)) + "</tr>" for r in rows)
    return f'<table class="t t-table" data-block="{block}"><colgroup>{cg}</colgroup><thead><tr>{t1}</tr><tr>{t2}</tr></thead><tbody>{tr}</tbody></table>'

AB = {"ENGAGE": "Engage", "INNOVATE": "Innovate", "PERFORM": "Perform", "GOVERN": "Govern"}
def p_appendix_a():
    pages = []
    rows = []
    for d in DIMS:
        rows.append([esc(DIMN[d])] + rowstar([DNOW[d][o] for o in ORDER], f2) + rowstar([DPREF[d][o] for o in ORDER], f2))
    rows.append(["All dimensions"] + rowstar([NOW[o] for o in ORDER], f2) + rowstar([PREF[o] for o in ORDER], f2))
    a1 = dense(two_head_table([131.28] + [46] * 8, [("", 1, 0), ("Now", 4, 1), ("Preferred", 4, 1)], ["Dimension"] + [AB[o][:3] + "." if False else AB[o] for o in ORDER] * 2, rows, "table-a1"))
    drows = []
    for d_ in DEP:
        drows.append([esc(d_["label"]), num(d_["n"])] + [f'{num(f1(d_["now"][o]))} <span style="font-size:7pt">({num(s1(d_["diff"][o]))})</span>' for o in ORDER] + [esc(NAME[d_["dominant"]])])
    drows.append(["Organisation", num(D["respondents"]["submitted"])] + [num(f1(NOW[o])) for o in ORDER] + [esc(NAME[S["dominance"]["dominant"][0]])])
    a2 = dense(table([118, 46, 70, 70, 70, 70, None], ["Department", "People", "Engage", "Innovate", "Perform", "Govern", "Leads"], drows, "table-a2", right=(1, 2, 3, 4, 5)))
    lrows = [[esc(l.title())] + rowstar([LENS[l][o] for o in ORDER], f2) for l in ("PRACTICE", "STRATEGY", "LEADERSHIP")]
    a3 = table([131.28, 92, 92, 92, None], ["Lens", "Engage", "Innovate", "Perform", "Govern"], lrows, "table-a3", right=(1, 2, 3, 4))
    note = '<p class="t-caption c-muted" data-block="caption">Department values are now; the difference from the organisation is in brackets. Departments under 5 people are not shown.</p>'
    flow = (group(h2("A.1 Dimension scores, now and preferred"), a1) + group(h2("A.2 Department scores"), a2, note, gap=8) +
            group(h2("A.3 Orientation scores by lens, now"), a3))
    pages.append(page(34, flow, "Page 34, Appendix A data tables", opener=("A", "Data tables")))
    it = S["readiness_items"]
    irows = []
    for i in range(12):
        vals = {k: float(it[k][i]) for k in ("D7", "D8", "D9")}
        irows.append([f"Item {i+1}"] + [num(f2(vals[k])) for k in ("D7", "D8", "D9")])
    irows.append(["Mean"] + [star(f2(RD["d7"])) if float(RD["d7"]) == max(float(RD["d7"]), float(RD["d8"]), float(RD["d9"])) else num(f2(RD["d7"])), num(f2(RD["d8"])), num(f2(RD["d9"]))])
    a4 = table([131.28, 122, 123, None], ["Item", DIMN["D7"], DIMN["D8"], DIMN["D9"]], irows, "table-a4", right=(1, 2, 3))
    vrows = []
    for q in QS:
        e = EOSD[q]
        vrows.append([esc(QN[q]), num(e["n"]), num(e["promoters"]), num(e["passives"]), num(e["detractors"]), num(s0(EOS[q]))])
    a5 = table([171.28, 56, 70, 66, 70, None], ["Voice score", "Answers", "Promoters", "Passives", "Detractors", "Score"], vrows, "table-a5", right=(1, 2, 3, 4, 5))
    note2 = '<p class="t-caption c-muted" data-block="caption">Item wording is held in the platform question bank and is not printed in client reports.</p>'
    flow2 = h1("A", "Data tables, continued") + group(h2("A.4 Readiness item scores, 1 to 5"), a4, note2) + group(h2("A.5 Employee voice detail"), a5)
    pages.append(page(35, flow2, "Page 35, Appendix A continued"))
    return html_doc("CDP report: Appendix A, data tables", pages)

# ---------------------------------------------------------------- appendix B cohorts and method
def p_appendix_b():
    crow = lambda nm_, n, vals: [esc(nm_), num(n)] + rowstar([vals[o] for o in ORDER], f2) + [esc(NAME[max(vals, key=vals.get)])]
    rows = [crow("Executives", EXN, EX), crow("Staff", STN, ST), crow("Organisation", D["respondents"]["submitted"], NOW)]
    rows.append(["Executives minus staff", ""] + [num(s2(EX[o] - ST[o])) for o in ORDER] + [f'{icon("watch")} Engage' if PFLAG["ENGAGE"] != "NONE" else ""])
    b1 = table([128, 46, 62, 62, 62, 62, None], ["Group", "People", "Engage", "Innovate", "Perform", "Govern", "Leads"], rows, "table-b1", right=(1, 2, 3, 4, 5))
    R = D["respondents"]; Qd = S["quality"]; md = Qd["median_duration"]
    flags = Qd["flags"]; nflag = sum(1 for v in flags.values() if v)
    al = S["readiness"]["alpha"]
    def alpha_note(v):
        v = float(v); return "Items agree strongly" if v >= 0.8 else ("Items agree moderately" if v >= 0.6 else "Items agree weakly; read with care")
    mrows = [
        ["Invited", num(R["invited"]), f"Everyone in scope at {esc(CLIENT)}"],
        ["Answered", num(f"{R['submitted']} ({R['submitted']/R['invited']*100:.1f}%)"), "Enough to report every group of 5 or more"],
        ["Complete answers", num(f"{Qd['states'].get('COMPLETE', 0)} of {R['submitted']}"), "No partial answers were scored"],
        ["Median time to complete", num(f"{md//60} min {md%60} s"), "Time taken by the middle respondent"],
        ["Answer quality checks", num(f"{nflag} of {len(flags)} raised"), "No speeding, straight lining, uniform answers or duplicated perspectives found"],
        ["Leadership 360 coverage", num(f"{float(S['readiness']['coverage'])*100:.1f}%"), "Share of headcount led by leaders with a valid 360 result; " + ("readiness is provisional" if float(S['readiness']['coverage']) < 0.6 else "above 60%, so readiness is final")],
    ] + [[f"Item agreement, {esc(DIMN[k])}", num(al[k]), alpha_note(al[k])] for k in ("D7", "D8", "D9")] + [
        ["Departments reported", num(f"{len(DEP)} of {len(DEP)}"), "Groups under 5 people are not shown"],
        ["Leadership 360", num(f"{L360['valid']} of {L360['leaders']} leaders"), f"A valid result needs at least {L360['min_rater_forms']} rater forms"],
        ["Comments", num(f"{TH['commenters']} people"), f"A theme is shown when at least {TH['min_comments_to_show']} comments share it"],
    ]
    b2 = table([190, 90, None], ["Measure", "Result", "What it tells you"], mrows, "table-b2")
    flow = group(h2("B.1 Cohort scores, now"), b1) + group(h2("B.2 Method and data quality"), b2)
    return html_doc("CDP report: Appendix B, cohorts and method", [page(36, flow, "Page 36, Appendix B cohorts and method", opener=("B", "Cohorts and method"))])

# ---------------------------------------------------------------- appendix C glossary
GLOSS = [
    ("Adaptive capacity", "How well teams adjust their work when conditions change. One of the three readiness measures, on a 1 to 5 scale."),
    ("Band", "The word the platform gives a score so it can be read without a reference table, such as Moderate or Significant."),
    ("Congruence", "Whether practice, strategy and leadership point to the same orientation. Fragmented means they point in different directions."),
    ("Culture Practitioner", "The PAC professional who runs the assessment, reads the results with the client and guides the change."),
    ("Culture Risk Index", "One reading, from 0 to 100, of how exposed a planned change is to cultural friction. Lower is better."),
    ("Culture strength", "How clearly one orientation stands out from the others. A diffuse culture has no clear leader."),
    ("Detractor, passive, promoter", "The three groups each voice score sorts people into, from least to most favourable."),
    ("Digital readiness", "How prepared people feel to adopt new tools and ways of working. A readiness measure on a 1 to 5 scale."),
    ("Dimension", "One of six areas of organisational life the profile examines: Cultural DNA, Leadership Blueprint, People Architecture, Cohesion Drivers, Strategic Compass and Victory Conditions."),
    ("Dominant orientation", "The orientation with the highest Now score. The secondary orientation comes next."),
    ("Employee voice score", "A reading from \u2212100 to +100 on one of eight topics, such as leadership or communication. Above zero is Positive."),
    ("Engage", "The orientation that puts people, relationships and belonging first."),
    ("Even share", "25 points for each orientation: the profile a culture would show if none stood out. Drawn as a dashed line on profile charts."),
    ("Executives and staff", "The two groups compared in chapter 06. Each needs at least 5 answers to be shown."),
    ("Flag", "A platform marker that a result needs attention. Always printed with the Watch icon and a word."),
    ("Gap", "Preferred minus Now for an orientation or dimension. A positive gap means people want more of it."),
    ("Govern", "The orientation that puts structure, control and reliable process first."),
    ("Hit, Partial hit, Miss", "The three verdicts on a strategy check: the culture supports the strategy, supports it in part, or works against it."),
    ("Innovate", "The orientation that puts new ideas, experiment and change first."),
    ("Leadership 360", "Feedback on each leader from the leader and from colleagues. Results are private to each leader; this report shows only the collective pattern."),
    ("Leadership 360 coverage", "The share of headcount led by leaders with a valid Leadership 360 result. Below 60 percent, the readiness score is marked provisional."),
    ("Leadership alignment", "How closely leaders' behaviour matches the culture the strategy needs, on a 1 to 5 scale."),
    ("Lens", "The angle a question takes: Practice (how work gets done), Strategy (what the organisation aims for) or Leadership (how leaders behave)."),
    ("Now and Preferred", "Now is the culture people experience today; Preferred is the culture they want. Each splits 100 points across the four orientations."),
    ("Orientation", "One of the four cultural directions the profile measures: Engage, Innovate, Perform and Govern."),
    ("Perception gap", "The difference between how executives and staff score the same orientation."),
    ("Perform", "The orientation that puts results, targets and competition first."),
    ("Psychological safety", "Whether people feel safe to speak up, admit mistakes and disagree. A readiness measure on a 1 to 5 scale."),
    ("Readiness", "How prepared the organisation is to absorb change, read from digital readiness, psychological safety and adaptive capacity."),
    ("Reporting threshold", "The smallest group shown on its own: 5 people. Smaller groups count in the totals but are never shown separately."),
    ("Shadow culture", "A flag raised when executives and staff describe the organisation so differently that they are, in effect, describing two cultures."),
    ("Spread", "How much people disagree about a score. A wide spread means experience differs across the organisation."),
    ("Strategy check", "One of four tests of whether the culture supports the strategy: strategy, leadership behaviour, systems and business model."),
    ("Subculture", "A department whose profile differs clearly from the organisation, sometimes led by a different orientation."),
    ("Tension", "A pair of orientations pulling against each other, such as Engage and Perform, given a band."),
    ("Voice index", "The overall employee voice reading across all eight topics."),
    ("Watch and Significant", "Classes for the size of a gap: Watch from 4 to 8 points, Significant above 8. Watch gaps are worth monitoring; significant gaps call for action."),
]
GEO = ImageFont.truetype(os.path.expanduser("~/.fonts/Gelasio.ttf"), 1000)
def lines_of(text, width=HALF, size=10):
    n, cur = 1, 0.0; sp = GEO.getlength(" ") * size / 1000
    for w_ in text.split():
        wl = GEO.getlength(w_) * size / 1000
        if cur and cur + sp + wl > width: n += 1; cur = wl
        else: cur = cur + (sp if cur else 0) + wl
    return n
def entry_h(t, m): return 11 + 2 + 14 * lines_of(m)
def gl_entry(t, m):
    return (f'<div data-block="glossary-row" style="break-inside:avoid"><dt class="t-table c-ink" style="font-weight:600">{esc(t)}</dt>'
            f'<dd class="t-body c-ink" style="margin-top:2pt">{esc(m)}</dd></div>')
def p_glossary():
    entries = sorted(GLOSS, key=lambda e: e[0].lower().lstrip("0123456789") or e[0])
    entries = sorted(GLOSS, key=lambda e: (not e[0][0].isdigit(), e[0].lower()))
    caps = [CB - 120 - 4, CB - 72 - 4]   # usable height per column: page 37 starts at 120, page 38 at 72 (+ h1 26)
    cols, cur, used, pi = [], [], 0, 0
    limits = [CB - 120, CB - 120, CB - 72 - 26, CB - 72 - 26]
    for t, m in entries:
        h = entry_h(t, m) + (12 if cur else 0)
        if used + h > limits[len(cols)] - 8:
            cols.append(cur); cur, used = [], 0; h = entry_h(t, m)
        cur.append((t, m)); used += h
    cols.append(cur)
    rest = [e for c in cols[2:] for e in c]
    if rest:
        tot = sum(entry_h(*e) + 12 for e in rest); acc = 0; k = 0
        while k < len(rest) and acc + entry_h(*rest[k]) + 12 <= tot / 2 + 20: acc += entry_h(*rest[k]) + 12; k += 1
        cols = cols[:2] + [rest[:k], rest[k:]]
    def colhtml(c): return f'<dl style="display:flex;flex-direction:column;gap:12pt">{"".join(gl_entry(*e) for e in c)}</dl>'
    def two(a, b): return f'<div data-block="glossary-columns" style="display:grid;grid-template-columns:{HALF}pt {HALF}pt;column-gap:16pt;align-items:start">{colhtml(a)}{colhtml(b) if b else "<div></div>"}</div>'
    while len(cols) < 4: cols.append([])
    p1 = page(37, two(cols[0], cols[1]), "Page 37, Appendix C glossary", opener=("C", "Glossary"))
    p2 = page(38, h1("C", "Glossary, continued") + two(cols[2], cols[3]), "Page 38, glossary continued")
    return html_doc("CDP report: Appendix C, glossary", [p1, p2]), [len(c) for c in cols]

# ---------------------------------------------------------------- appendix D facilitation guide
SESS = [
    ("Executive read out", f"The {wd(EXN)} executives with the Culture Practitioner.",
     f"Agree what the results say before anyone else sees them, and face the {f2(PG['ENGAGE'])} point Engage split together.",
     ["The five priorities and the evidence behind each", "Why staff see Engage differently from executives", "What the executive team will say to staff, and when"],
     "An agreed message to staff and a named owner for each priority."),
    ("Department heads working session", "The heads of " + ", ".join(d["label"] for d in DEP[:-1]) + " and " + DEP[-1]["label"] + ".",
     "Read each department's profile against the organisation and plan the boundary sessions.",
     ["Each department's lead orientation and its difference from the organisation", "Which differences to protect and which to close", "The quick wins each head owns in the first 30 days"],
     "A 30 day plan for each department and dates for the boundary sessions."),
    ("Staff conversations", "Staff in department groups of 5 or more, led by a trained facilitator, with no line manager in the room.",
     "Test the findings with the people who gave them, and hear what the numbers do not say.",
     ["What the results say about this department", f"The {wd(len(QF))} voice scores below zero: what sits behind them", "One change the team wants first"],
     "Themes fed back to the executive team without names."),
]
def session_card(i, nm_, who, purpose, agenda, outputs):
    ag = "".join(f'<li style="display:flex;gap:8pt;margin-top:4pt"><span class="t-table tnum" style="font-weight:600;width:8pt;flex:none;padding-top:1.5pt">{j+1}</span><span class="t-body">{esc(a)}</span></li>' for j, a in enumerate(agenda))
    lab = lambda s: f'<div class="t-panel-title c-ink">{s}</div>'
    left = (f'<div style="display:flex;align-items:center;gap:8pt">{marker(i)}<span class="t-kpi-label c-ink">Session {i}</span></div>'
            f'<h3 class="t-h2 c-ink" style="margin-top:8pt">{esc(nm_)}</h3>'
            f'<div style="margin-top:8pt">{lab("Who")}<p class="t-body c-ink" style="margin-top:4pt">{esc(who)}</p></div>'
            f'<div style="margin-top:8pt">{lab("Purpose")}<p class="t-body c-ink" style="margin-top:4pt">{esc(purpose)}</p></div>')
    right = (f'{lab("Agenda")}<ol style="list-style:none">{ag}</ol>'
             f'<div style="margin-top:8pt">{lab("Outputs")}<p class="t-body c-ink" style="margin-top:4pt">{esc(outputs)}</p></div>')
    return (f'<article class="panel" data-block="session-card" style="padding:12pt;display:grid;grid-template-columns:217.64pt 241.64pt;column-gap:16pt">'
            f'<div>{left}</div><div>{right}</div></article>')
def p_appendix_d():
    cards = "".join(session_card(i + 1, *s) for i, s in enumerate(SESS))
    nn = ["Results are shared as they are. No number is softened or left out.",
          "No individual leader's 360 result is shown or discussed in any session.",
          "No group of fewer than 5 people is discussed on its own, and what staff say is fed back without names.",
          "Every session ends with an owner and a date for each agreed action."]
    items = "".join(f'<li style="display:flex;gap:8pt;margin-top:4pt">{icon("cross")}<span class="t-body c-ink">{esc(x)}</span></li>' for x in nn)
    box_ = f'<aside class="callout" data-block="non-negotiables" style="padding:12pt"><div class="t-panel-title c-ink">Non negotiables for every session</div><ul style="list-style:none;margin-top:4pt">{items}</ul></aside>'
    return html_doc("CDP report: Appendix D, working through the report", [page(39, cards + box_, "Page 39, Appendix D facilitation guide", opener=("D", "Working through the report"))])

def main():
    gl, gcols = p_glossary()
    files = {
        "21-priorities.html": p_priorities(), "22-phase-plan.html": p_phases(), "23-change-principles.html": p_principles(),
        "24-kpi-scorecard.html": p_kpi(), "25-glossary.html": gl, "26-appendix-data.html": p_appendix_a(),
        "27-appendix-cohorts-method.html": p_appendix_b(), "28-appendix-facilitation.html": p_appendix_d(),
    }
    for k, v in files.items(): open(f"{OUT}/{k}", "w").write(v.replace("</head>", DENSE_CSS + "</head>") if "dense" in v else v)
    print({k: len(v) for k, v in files.items()}, "glossary cols", gcols)

if __name__ == "__main__":
    main()
