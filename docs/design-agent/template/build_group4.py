#!/usr/bin/env python3
"""Build CDP style sheets, group 4: executive brief (A4), 16:9 deck (960 x 540 pt), staff guide (A4).

Imports build_group3 (and through it groups 1 and 2) for tokens, frame, icons, tables and charts.
Every number comes from report-sample-data.json or is computed by the same functions as the report.
Wording of actions, owners, timings and staff guide steps is SAMPLE WORDING (as group 3).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_group1 as g1
import build_group3 as g3
from build_group3 import (esc, box, section, icon, ORDER, NAME, ML, CW, RX, HALF, D, S, INK, WHITE, BRAND, SURF,
    f1, f2, s0, s1, s2, num, panel, headline, h2, sowhat, group, table, NOW, PREF, GAP, PG, EX, ST, RD, RISK, EOS, EOSD,
    QF, QN, TH, L360, CHECKS, PRI, kpi_rows, t18, wd, tag, marker, bn)
import build_group2 as g2

OUT = g1.OUT
CLIENT = D["organisation"]; R = D["respondents"]
BRIEF_TOTAL = 5           # planned brief length for the sample (spec section 1)

def doc(title, pages, extra_css=""):
    return g1.page_html(title, pages).replace("</head>", f"<style>{extra_css}</style></head>") if extra_css else g1.page_html(title, pages)

def a4_frame(no, total, header, footer):
    f = g1.frame(no, "")
    f = f.replace(f"Page {no} of {g1.TOTAL_PAGES}", f"Page {no} of {total}")
    f = f.replace(f"{esc(CLIENT)} \u00b7 Culture Dynamics Profile", header)
    rel = "(to be confirmed)"
    return f.replace(f"Confidential. Prepared for {esc(CLIENT)} \u00b7 Released {rel}", footer)

def footer_only(f):
    a = f.index('<header'); b = f.index('</header>') + len('</header>')
    return f[:a] + f[b:]

# ======================================================================= 29 executive brief
def verdict(kind, word, ic):
    bg = {"miss": "var(--verdict-miss)", "flag": INK}[kind]; on = {"miss": "var(--verdict-miss-on)", "flag": WHITE}[kind]
    return (f'<div class="t-kpi-label" style="background:{bg};color:{on};border-radius:var(--radius-1);height:24pt;display:inline-flex;'
            f'align-items:center;gap:4pt;padding:0 8pt;white-space:nowrap">{icon(ic, on)}<span>{esc(word)}</span></div>')

def brief_row(v, number, nlabel, title, finding, owner, timing):
    left = (f'<div>{v}<div class="t-kpi-value c-ink tnum" style="margin-top:8pt">{num(number)}</div>'
            f'<div class="t-kpi-label c-ink" style="margin-top:4pt">{esc(nlabel)}</div></div>')
    right = (f'<div><div style="display:flex;gap:8pt">{tag("Owner", owner)}{tag("Timing", timing)}</div>'
             f'<h3 class="t-h2 c-ink" style="margin-top:8pt">{esc(title)}</h3><p class="t-body c-ink" style="margin-top:4pt">{finding}</p></div>')
    return (f'<article class="card" data-block="brief-finding" style="padding:12pt;display:grid;grid-template-columns:112.82pt 1fr;column-gap:16pt">'
            f'{left}{right}</article>')

def p_brief():
    s = [footer_only(a4_frame(1, BRIEF_TOTAL, "", f"Confidential. Executive brief for {esc(CLIENT)} \u00b7 Released (to be confirmed)"))]
    # cover strip 0 to 152
    s.append(box(0, 0, g1.PW, 152, "", "", "background:var(--color-brand)", attrs=' data-block="cover-strip"'))
    lw = round(36 * 568 / 213, 2)
    s.append(f'<img class="abs" src="{g1.LOGO["pac-logo-white"]}" alt="PAC Africa, Priority Activator Consulting" style="left:{ML}pt;top:28pt;height:36pt;width:{lw}pt">')
    s.append(box(RX - 200, 40, 200, None, "t-kpi-label c-ink", "Culture Dynamics Profile", "text-align:right"))
    s.append(box(ML, 76, 440, 56, "", f'<div class="t-kpi-label c-ink">Executive brief</div><h1 class="t-display c-white" style="margin-top:4pt">{esc(CLIENT)}</h1>',
                 "display:flex;flex-direction:column;justify-content:flex-end", attrs=' id="brief-client"'))
    # one page summary
    hits = sum(v == "HIT" for v in CHECKS.values()); miss = sum(v == "MISS" for v in CHECKS.values()); part = sum(v == "PARTIAL_HIT" for v in CHECKS.values())
    lead = NOW["PERFORM"] - NOW["ENGAGE"]
    hl = headline(f'Perform leads at {num(f2(NOW["PERFORM"]))}, people want Engage up by {bn(s2(GAP["ENGAGE"]))}, and only {wd(hits)} of {wd(len(CHECKS))} strategy checks is a full hit.')
    tiles = [("Leading orientation", num(f2(NOW["PERFORM"])), f"Perform, {f2(lead)} ahead", "white"),
             ("Largest shift wanted", num(s2(GAP["ENGAGE"])), f"Engage, {f2(NOW['ENGAGE'])} to {f2(PREF['ENGAGE'])}", "white"),
             ("Strategy checks met", num(f"{hits} of {len(CHECKS)}"), f"{hits}\u00a0hit, {part}\u00a0partial, {miss}\u00a0miss", "white"),
             ("Culture Risk Index", num(RISK["index"]), f"{RISK['band'].title()}; lower is better", "white")]
    trow = f'<div data-block="kpi-tiles" style="display:grid;grid-template-columns:repeat(4,112.82pt);column-gap:16pt">{"".join(g1.kpi_tile_static(*t) for t in tiles)}</div>'
    p1, p2, p3 = PRI[0], PRI[1], PRI[2]
    rows = (brief_row(verdict("flag", "Shadow culture", "watch"), f2(PG["ENGAGE"]), "Points apart on Engage", p1["title"],
                      f"Executives put Engage at {f2(EX['ENGAGE'])}, staff at {f2(ST['ENGAGE'])}. Messages from the top will read as out of touch.", p1["owner"], p1["timing"])
            + brief_row(verdict("miss", "Miss", "cross"), f2(NOW["INNOVATE"]), "Innovate now", p2["title"],
                      f"The strategy needs new business models, yet Innovate is weakest and the innovation climate sits at {s0(EOS['Q3'])}.", p2["owner"], p2["timing"])
            + brief_row(verdict("flag", "Watch", "watch"), f"{len(QF)} of 8", "Voice scores below zero", p3["title"],
                      f"{QN[QF[0]]} and {QN[QF[1]].lower()} are lowest; {TH['rows'][0]['theme'].lower()} leads the comments at {TH['rows'][0]['share_pct']} percent.", p3["owner"], p3["timing"]))
    sw = sowhat(f"Close the {f2(PG['ENGAGE'])} point Engage split before any programme is announced.")
    flow = hl + trow + group(h2("Three things to act on"), rows, gap=8) + sw
    s.append(box(ML, 176, CW, None, "flow", flow, attrs=' id="flow-brief-1"'))
    return doc("CDP executive brief: cover strip and one page summary", [section("".join(s), "Executive brief, page 1")])

# ======================================================================= 30 deck, 960 x 540 pt
SW, SH = 960, 540; SM = 48
DECK_CSS = (f"@page{{size:{SW}pt {SH}pt;margin:0}}"
            f".slide{{position:relative;width:{SW}pt;height:{SH}pt;overflow:hidden;background:var(--color-paper);margin:0 auto 24pt;break-after:page;color:var(--color-ink)}}"
            ".d-title{font-family:var(--font-ui);font-weight:700;font-size:40pt;line-height:44pt}"
            ".d-head{font-family:var(--font-ui);font-weight:600;font-size:24pt;line-height:30pt}"
            ".d-label{font-family:var(--font-ui);font-weight:700;font-size:10pt;line-height:12pt;letter-spacing:0.6pt;text-transform:uppercase}"
            ".d-body{font-family:var(--font-prose);font-size:14pt;line-height:20pt}"
            ".d-body b{font-weight:700}"
            ".d-foot{font-family:var(--font-ui);font-size:9pt;line-height:12pt}"
            "table.d-table{border-collapse:collapse;width:100%;font-family:var(--font-ui);font-size:12pt;line-height:16pt;font-variant-numeric:tabular-nums}"
            "table.d-table th{background:var(--color-ink);color:#fff;font-weight:600;text-align:left;padding:6pt 12pt}"
            "table.d-table td{padding:6pt 12pt;border-bottom:0.5pt solid #DDDDDD}"
            "table.d-table tbody tr:nth-child(even) td{background:var(--color-surface)}"
            "table.d-table tbody tr:nth-child(odd) td{background:#FFFFFF}"
            "table.d-table td.first{font-weight:600}table.d-table .r{text-align:right}"
            "table.d-table tbody tr:last-child td{border-bottom:0.75pt solid var(--color-ink)}")

def slide(inner, aria, bg=None):
    st = f' style="background:var(--color-{bg})"' if bg else ""
    return f'<section class="page slide" aria-label="{esc(aria)}"{st}>{inner}</section>'

def deck_frame(no, label):
    lh = 22; lw = round(lh * 591 / 221, 2)
    return (box(SM, 28, 600, 12, "d-label c-ink", esc(label))
            + f'<img class="abs" data-logo="pac-logo-colour" src="" alt="PAC Africa" style="left:{round(SW-SM-lw,2)}pt;top:22pt;height:{lh}pt;width:{lw}pt">'
            + box(SM, 508 - 0.375, SW - 2 * SM, 0.75, "", "", "background:var(--color-brand)")
            + box(SM, 516, 600, 12, "d-foot c-muted", f"Confidential. Prepared for {esc(CLIENT)}")
            + box(SW - SM - 100, 516, 100, 12, "d-foot c-ink", f"<b>{no}</b>", "text-align:right"))

def p_deck():
    sl = []
    # title slide
    lw = round(48 * 568 / 213, 2)
    t = (f'<img class="abs" src="{g1.LOGO["pac-logo-white"]}" alt="PAC Africa, Priority Activator Consulting" style="left:{SM}pt;top:48pt;height:48pt;width:{lw}pt">'
         + box(SM, 236, 640, None, "", f'<div class="d-label c-ink">Culture Dynamics Profile</div><h1 class="d-title c-white" style="margin-top:8pt">{esc(CLIENT)}</h1>'
               f'<p class="c-white" style="font-family:var(--font-ui);font-size:24pt;line-height:30pt;margin-top:8pt">Results and priorities</p>', attrs=' id="deck-title"')
         + box(SM, 452, 640, None, "d-foot c-ink", f'<span style="font-size:12pt;line-height:16pt">{R["submitted"]} of {R["invited"]} invited answered \u00b7 {g2.EXN} executives, {g2.STN} staff \u00b7 Released (to be confirmed)</span>')
         + box(SM, 488, 400, None, "d-foot c-ink", "Confidential"))
    sl.append(slide(t, "Slide 1, title", "brand"))
    # finding slide with chart
    scale = 1.45; cw_, ch_ = round(HALF * scale, 2), round(228 * scale, 2)
    chart = (f'<div class="panel abs" data-block="deck-chart" style="left:{SM}pt;top:150pt;width:{cw_ + 24}pt;height:{ch_ + 12}pt">'
             f'<div style="position:absolute;left:12pt;top:0;width:{HALF}pt;height:228pt;transform:scale({scale});transform-origin:0 0">'
             f'{panel("Orientation profile, now and preferred", HALF, 228, g2.ch_profile(), "slide-profile")}</div></div>')
    rx = SM + cw_ + 24 + 24; rw = SW - SM - rx
    lines = [("Finding", f"Perform leads the culture at {f2(NOW['PERFORM'])}; Engage sits {f2(NOW['PERFORM'] - NOW['ENGAGE'])} behind."),
             ("Evidence", f"People would move Engage to {f2(PREF['ENGAGE'])} and Innovate to {f2(PREF['INNOVATE'])}, and cut Perform to {f2(PREF['PERFORM'])}."),
             ("Consequence", "A plan that pushes delivery harder will meet a workforce asking for the opposite."),
             ("Action", "Build the plan around Engage and Innovate, and keep the delivery standards customers see.")]
    body = "".join(f'<p class="d-body c-ink" style="margin-top:{0 if i == 0 else 8}pt"><b>{a}.</b> {esc(b)}</p>' for i, (a, b) in enumerate(lines))
    sw = (f'<aside class="callout" style="padding:12pt;margin-top:16pt"><div class="d-label c-ink">So what</div>'
          f'<p class="d-body c-ink" style="margin-top:4pt">The gap is about how people are led, not what they deliver.</p></aside>')
    f_ = (deck_frame(2, "03 \u00b7 The culture now")
          + box(SM, 64, SW - 2 * SM, None, "d-head c-ink", f'Perform leads at {f2(NOW["PERFORM"])}, yet people want Engage to rise by <span class="c-brand" style="font-weight:700">{s2(GAP["ENGAGE"])}</span> points.', attrs=' id="deck-headline-2"')
          + chart + box(rx, 150, rw, None, "", body + sw, attrs=' id="deck-right-2"'))
    sl.append(slide(f_, "Slide 2, finding with chart"))
    # table slide
    rows = kpi_rows()
    th = "".join(f'<th class="{"r" if i in (1, 2, 3) else ""}">{h}</th>' for i, h in enumerate(["KPI", "Baseline", "12 month", "18 month", "Source"]))
    tr = "".join("<tr>" + "".join(f'<td class="{"first" if i == 0 else ("r" if i in (1, 2, 3) else "")}">{c}</td>' for i, c in enumerate(r)) + "</tr>" for r in rows)
    tbl = (f'<table class="d-table" data-block="deck-table"><colgroup><col style="width:360pt"><col style="width:112pt"><col style="width:104pt"><col style="width:104pt"><col></colgroup>'
           f'<thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table>'
           f'<p class="d-foot c-muted" style="margin-top:6pt;font-family:var(--font-prose);font-style:italic">Targets are set by the platform and may be changed by the Culture Practitioner before release.</p>')
    f_ = (deck_frame(3, "13 \u00b7 Culture KPI scorecard")
          + box(SM, 64, SW - 2 * SM, None, "d-head c-ink", f'{wd(len(rows), True)} measures track the plan; Engage moves from <span class="c-brand" style="font-weight:700">{f2(NOW["ENGAGE"])}</span> to {f2(t18("ENGAGE"))}.', attrs=' id="deck-headline-3"')
          + box(SM, 136, SW - 2 * SM, None, "", tbl, attrs=' id="deck-table-3"'))
    sl.append(slide(f_, "Slide 3, table"))
    html = doc("CDP deck 16:9: title, finding with chart, table", sl, DECK_CSS)
    return html.replace("</body>", '<script src="logo.js"></script></body>')

# ======================================================================= 31 staff guide
def p_staff():
    fr = a4_frame(1, 1, f"{esc(CLIENT)} \u00b7 Staff conversation guide", "Internal. PAC staff only. Do not share with the client team")
    fr = fr.replace("Page 1 of 1", "Page 1")
    steps = [
        ("Open and set the ground rules", "10 minutes",
         "Explain that answers were anonymous and that no group under five people is shown.",
         "Nothing you say today will be traced back to you."),
        ("Share what the survey found", "15 minutes",
         f"Show the four voice scores below zero, starting with {QN[QF[0]].lower()} at {s0(EOS[QF[0]])}.",
         "These are your numbers. We want to understand what sits behind them."),
        ("Listen", "25 minutes",
         f"Ask about the top two comment themes: {TH['rows'][0]['theme'].lower()} and {TH['rows'][1]['theme'].lower()}. Write down what people say, not who said it.",
         "What would have to change for this score to go up?"),
        ("Agree one change", "10 minutes",
         "Ask the group to pick the one change they want first. Note it in their words.",
         "If we could fix one thing this quarter, what should it be?"),
    ]
    blocks = ""
    for i, (title, mins, do, say) in enumerate(steps):
        blocks += (f'<article class="panel" data-block="guide-step" style="padding:12pt;display:grid;grid-template-columns:16pt 1fr;column-gap:12pt">'
                   f'{marker(i + 1)}<div><div style="display:flex;align-items:center;gap:8pt"><h3 class="t-h2 c-ink">{esc(title)}</h3>'
                   f'<span style="margin-left:auto">{tag("Time", mins)}</span></div>'
                   f'<p class="t-body c-ink" style="margin-top:4pt">{esc(do)}</p>'
                   f'<p class="t-body c-ink" style="margin-top:4pt;font-style:italic">You might say: \u201c{esc(say)}\u201d</p></div></article>')
    facts = [(s0(EOS[q]), QN[q]) for q in QF] + [(f"{TH['rows'][0]['share_pct']}%", f"of comments on {TH['rows'][0]['theme'].lower()}")]
    fact_html = "".join(f'<div><div class="t-h1 c-ink tnum">{num(v)}</div><div class="t-table c-ink">{esc(l)}</div></div>' for v, l in facts)
    numbers = (f'<div class="panel" data-block="guide-numbers" style="padding:12pt"><div class="t-panel-title c-ink">Numbers to bring</div>'
               f'<div style="display:grid;grid-template-columns:repeat(5,1fr);column-gap:12pt;margin-top:8pt">{fact_html}</div></div>')
    dont = ["Do not name or guess who gave an answer.", "Do not discuss any single leader's 360 result.",
            "Do not promise a change the executive team has not agreed."]
    items = "".join(f'<li style="display:flex;gap:8pt;margin-top:4pt">{icon("cross")}<span class="t-body c-ink">{esc(x)}</span></li>' for x in dont)
    box_ = f'<aside class="callout" data-block="guide-donts" style="padding:12pt"><div class="t-panel-title c-ink">Please avoid</div><ul style="list-style:none;margin-top:4pt">{items}</ul></aside>'
    intro = (f'<h1 class="t-h1 c-ink" data-block="guide-title">Running the staff conversation</h1>'
             f'<p class="t-body c-ink" style="margin-top:8pt;width:400pt">One hour with a department group of five or more, no line manager in the room. '
             f'Your job is to listen. The {R["submitted"]} people who answered want to know they were heard.</p>')
    flow = intro + numbers + group(h2("The hour in four steps"), *[blocks], gap=8) + box_
    s = [fr, box(ML, 72, CW, None, "flow", flow, attrs=' id="flow-guide-1"')]
    return doc("CDP staff conversation guide: content page", [section("".join(s), "Staff guide, page 1")])

def main():
    files = {"29-executive-brief.html": p_brief(), "30-deck-16x9.html": p_deck(), "31-staff-guide.html": p_staff()}
    for k, v in files.items(): open(f"{OUT}/{k}", "w").write(v)
    print({k: len(v) for k, v in files.items()})

if __name__ == "__main__":
    main()
