# CDP report template: SPEC, group 3 (action and reference pages)

Owner: Imran Issa, PAC Africa. Prepared by the PAC Design Agent, 4 Nov 2026.
Status: APPROVED by the owner 4 Nov 2026 with rulings (see playbook/decisions.md). Earlier status: FOR REVIEW. Not approved. Groups 1 and 2 are approved.
Sample client: Zendaro Group (fictional), 45 invited, 41 answered, 5 executives, 36 staff. Data: cdp_report/report-sample-data.json (4 Nov version with names, departments, leadership_360, themes). Every number on the pages is read from that file or computed from it (computed values marked "computed").

| File | Page type | Report pages |
|---|---|---|
| 21-priorities.html | 12 What to do next: priority pages, quick wins | 27 to 29 |
| 22-phase-plan.html | 12.3 Phase plan: timeline and phase table | 30 |
| 23-change-principles.html | 12.4 Change principles and non negotiables | 31 |
| 24-kpi-scorecard.html | 13 Culture KPI scorecard; 13.2 governance, leading and lagging | 32 to 33 |
| 26-appendix-data.html | A Data tables | 34 to 35 |
| 27-appendix-cohorts-method.html | B Cohorts and method | 36 |
| 25-glossary.html | C Glossary | 37 to 38 |
| 28-appendix-facilitation.html | D Working through the report (facilitation guide) | 39 |
| build_group3.py | Generator. Imports build_group2 and build_group1 | |

Every file links tokens.css and logo.js (no embedded logo). Largest file 24.8 KB.
Not built this session (budget): style sheets for the executive brief, the 16:9 deck and the staff guide (items 7 to 9).

---

## 0. Conventions

SPEC-group-1 section 0 and SPEC-group-2 section 0 apply unchanged: points, origin top left, y = top of the first line box, pdfkit offset formula, tnum, true minus U+2212, 1 decimal on charts, 2 decimals in tables, voice scores whole, knockout labels, draw order, white panels on the paper page.

New in group 3:
- **Small counts in prose are words** ("four voice scores", "nine leaders"), from 0 to 10. Figures stay in tables, tiles, figures and charts. Function `wd()`.
- **Section heading number column**: 28 wide (as group 2) when the number fits; otherwise number width + 8 (e.g. "12.1" gets 41.6). Appendix letters: letter width + 8. Fixes "12.1Priorities" running together.
- **Dense table variant** (`table.t.dense`): tables with 7 or more columns pad numeric cells 4 left and right instead of 12; first column keeps 12. Used on A.1 and A.2 only. Needed so star + "31.81" fits a 46 wide column.
- **Sample wording**: action lines, owners, timings, quick wins, phase initiatives, principles, governance forums and session cards are written by the Culture Practitioner for each client. The sample text cites only Zendaro numbers. The platform supplies none of it.

---

## 1. Page plan: 40 pages for the sample

| Pages | Content | Count | Status |
|---|---|---|---|
| 1 | Cover | 1 | Approved |
| 2 | About this report | 1 | Approved |
| 3 to 4 | Table of Contents | 2 | Approved; rows need the plan below |
| 5 to 6 | Executive summary | 2 | Approved |
| 7 | 01 How to read this report | 1 | Not yet designed |
| 8 | 02 Method and participation | 1 | Not yet designed |
| 9 to 21 | 03 to 08 | 13 | Approved (group 2) |
| 22 to 24 | 09 Departments: map and table; profiles 1 to 3; profiles 4 to 5 | 3 | Group 2 page plus 1 page, because the new data has 5 departments (4.17 cards, 3 per page) |
| 25 | 10 Leadership 360 summary | 1 | Approved layout; now has data |
| 26 | 11 What this means | 1 | Approved |
| 27 to 29 | 12.1 Priorities (5), 12.2 Quick wins | 3 | This group |
| 30 | 12.3 Phase plan | 1 | This group |
| 31 | 12.4 Change principles and non negotiables | 1 | This group |
| 32 to 33 | 13 Culture KPI scorecard, 13.2 Governance | 2 | This group |
| 34 to 35 | A Data tables | 2 | This group |
| 36 | B Cohorts and method | 1 | This group |
| 37 to 38 | C Glossary | 2 | This group |
| 39 | D Working through the report | 1 | This group |
| 40 | Back page | 1 | Approved |

Contents rows from chapter 12 (replace the group 1 TOC entries):
12 What to do next 27 (12.1 Priorities 27, 12.2 Quick wins, first 30 days 29, 12.3 Phase plan 30, 12.4 Change principles 31); 13 Culture KPI scorecard 32 (13.1 Baseline and targets 32, 13.2 Governance 33); A Data tables 34; B Cohorts and method 36; C Glossary 37; D Working through the report 39.

Range (build stays within 40 to 50; warns above 48, stops above 50):

| Variable | Effect |
|---|---|
| Priorities | 3: chapter 12 is 4 pages; 4: 4 pages; 5: 5 pages; 6: 5 pages. More than 6: build warning (a plan with 7 priorities is not a plan) |
| No 360 data | Chapter 10 left out: minus 1; "Leaders ready with support" KPI row and A/B 360 rows left out |
| Departments | Every 3 cards beyond 3 add a page (group 2); A.2 holds 12 rows on page 34, more push A.3 to page 35 |
| Glossary over 2 pages | plus 1 (only if terms are added) |
| More than 12 KPI rows | Table splits by rows; so what moves to page 33; governance page grows |

Worst realistic case (6 priorities, 12 departments, 360 present, 12 themes, 13 KPI rows): 40 + 0 (6 priorities) + 3 (departments) + 1 (themes) + 1 (KPI) = 45.

---

## 2. Priority card (12.1)

One priority per card, two cards per page. Card never splits.

| Part | Local x, y | Size | Font, colour | Data field |
|---|---|---|---|---|
| Card | page x 48 | 499.28 x auto (sample 270.5 to 295.5) | white, 1.5 brand top rule, top corners square, bottom radius 4, padding 12 | |
| Marker | 12, 14.5 | circle 16, brand fill | number type.kpi-label ink (5.23:1), centred | priority rank |
| Area label | 36, centred on the 18 row | 1 line, never wraps | type.kpi-label ink: "PRIORITY {n} · {AREA}" | `priority.area` (orientation name or Employee voice, Departments, Readiness) |
| Owner tag, timing tag | right aligned to 487.28, y 13.5 | h 18, padding 0 8, gap 8 | surface fill, radius.pill (fully round, 9 at 18 high; owner ruling 4 Nov 2026, tags only); text type.table ink, "Owner:" and "Timing:" Inter 600 | `priority.owner`, `priority.timing` |
| Title | 12, 39.5 | 475.28 wide, max 2 lines | type.h2 ink | `priority.title` |
| Row grid | 12, title bottom + 12 | label column 76, gap 8, text column x 96, 391.28 wide, 8 between rows | labels type.body-strong; text type.body ink | Finding, Evidence, Consequence, Action |
| Evidence figures | text column | 4 columns of 91.82, gap 8 | value Inter 700 14/18 tnum ink; label type.table ink, max 2 lines | `priority.evidence[]` = {value, label}; client numbers only |
| Signal strip | 12, rows bottom + 12 | 475.28 x auto (44 for 2 lines) | surface, radius 4, padding 8 12; watch icon 10, "SIGNAL TO WATCH" type.panel-title, then text type.body, run in | `priority.signal` |

Page positions (measured): page 27 headline 120 (2 lines), cards at 174 and 460.5 (bottom 730.5, 93%). Page 28 h1 72, headline 106, cards at 160 and 471.5 (bottom 752.5). Page 29 h1 72, headline 106, card 5 at 160, h1 "12.2" at 460, quick wins table at 486 (bottom 668.7, 85%).

Height budget: two cards fit when each is at most 294 (opener page) or 301 (continuation page). Finding, Consequence and Action are 2 lines each at most (about 120 characters at 391.28); the build warns at 3 lines and moves the second card to the next page if the pair does not fit.

Order and selection: critical before high before medium before low; blocking before non blocking. Sample: 1 shadow culture (fnd_0005), 2 C1 Miss (fnd_0001), 3 voice flags fnd_0006 to 0009 (one card), 4 subcultures fnd_0011, 0012, 0014, 5 readiness signal fnd_0010.

Long and missing:
- Fewer than 4 evidence figures: columns stay 91.82, left aligned. Never more than 4.
- Owner or timing missing: tag prints "Owner: to be confirmed". Tags wider than the space beside the label (label + tags over 475.28) drop to their own row under the title, 8 below it.
- Odd number of priorities: the last card shares its page with 12.2 Quick wins. Even number: quick wins move to the phase plan page and the timeline panel is left out there (phase table carries the timing).
- No "In short" anywhere; the block is titled by the priority itself.

Never on a card: thresholds as rules, override codes, alignment percentages, requirement values (the band cut-offs in the signal line, "under 8 points", are allowed by owner decision 4 Nov).

## 3. Quick wins table (12.2)

Columns 28, 186, 140, 85, 60.28: #, Quick win, Why now, Owner, Done by. Table style as group 1. "Why now" must cite one client number. 3 to 6 rows; more than 6: build warning. Sample height 182.7 (rows wrap to 2 lines). Field: `plan.quick_wins[]` {action, evidence, owner, due}. Missing due: "To be confirmed".

## 4. Phase plan (12.3, page 30, bottom 709.5, 90%)

| Block | y | h | Content |
|---|---|---|---|
| h1, headline | 72, 106 | 18, 38 | |
| Timeline panel | 160 | 184 | full width, 4.1 below |
| h2 + phase table | 360, 382 | 14, 244.2 | columns 78, 92, 174, 155.28: Phase (short plain title from the sample, may wrap to 2 lines: "Listen and respond", "Pilot and connect", "Scale and embed"), Timeline, Key initiatives, Success indicators. Multi item cells: one item per line block, 4 between items, max 3 items |
| So what | 642 | 67.5 | |

### 4.1 Timeline chart (panel local, 499.28 x 184)
Plot x 140 to 487.28, months 0 to 18 (19.29 per month). Phase bands y 30 to row bottom + 4: months 0 to 3 white, 3 to 9 chart.band.watch #EEEEEE, 9 to 18 white; band labels "Months 1 to 3", "Months 4 to 9", "Months 10 to 18" Inter 600 7 centred, baseline 26 (no framework names, owner ruling 4 Nov 2026). Gridlines every 3 months, 0.5 #DDDDDD. Rows from y 40, pitch 18: number Inter 600 7 at x 12, short name at x 24 (baseline y + 7.5); bar ink fill, 10 high. Measure points: 1.0 ink dash 3 on 2 vertical lines at months 12 and 18, white diamond (half diagonal 4.5, 1.25 ink) on the last row. Axis 0.75 ink at row bottom + 4; tick labels baseline + 14; "Month" right aligned at x 134. Legend baseline 170.05: ink swatch "Planned work", diamond "Culture measured again, months 12 and 18". No brand colour in the chart.
Fields: priority timing as month ranges (`priority.start_month`, `priority.end_month`, new) plus the fixed row "Reassess and embed" 9 to 18. More than 6 priorities: panel grows 18 per row.

## 5. Change principles and non negotiables (12.4, page 31, bottom 643.5, 81%)

| Block | y | h | Content |
|---|---|---|---|
| h1, headline | 72, 106 | 18, 38 | |
| Principle grid | 160 | 316 | 6 half width white panels, 2 per row, gap 16; each: marker 16 + title type.h2 (1 line, 194 wide), body type.body 8 below, max 4 lines; panels in a row share height (sample 104, 90, 90) |
| Non negotiables | 492 | 151.5 | callout (surface, 1.5 brand top rule, padding 12); label "NON NEGOTIABLES"; up to 5 items, cross icon 10 + 8 + type.body, 8 between |

Fields: `plan.principles[]` {title, body} (4 to 6; 4 gives 2 rows), `plan.non_negotiables[]`. Each principle body cites a client number. Fewer than 6 principles: grid shrinks, page stays above 60 percent with 4.

## 6. Culture KPI scorecard (13)

### Page 32 (bottom 710.5, 90%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | one brand number: Engage now |
| Panel pair | 174 | 200 | 6.1 targets chart; 6.2 voice lift chart |
| h2 + KPI table | 390, 412 | 14, 215.4 | columns 180, 76, 66, 66, 111.28: KPI, Baseline, 12 month, 18 month, Source. Numbers right aligned |
| So what | 643 | 67.5 | |

KPI rows (sample, 10): Engage share; Innovate share; executive and staff gap on Engage; the voice scores below zero (one row each, lowest first); readiness; Culture Risk Index; leaders ready with support (360). Fields: `kpi[]` {name, baseline (from score), target_12, target_18, source}.
Targets (platform rule, owner ruling 4 Nov 2026): 12 month = baseline + 10 percent of the absolute baseline, 18 month = baseline + 20 percent, in the better direction, capped at the scale ends; baseline zero: step = share of the scale range. Higher is better: Engage and Innovate shares, voice scores (scale −100 to +100), readiness (1 to 5), leaders ready (0 to valid). Lower is better: Culture Risk Index (0 to 100), executive and staff gap. Sample: Engage 24.05 / 26.46 / 28.86; Innovate 22.88 / 25.17 / 27.46; Engage gap 7.23 / 6.51 / 5.78; innovation climate −29 / −26.10 / −23.20; readiness 3.33 / 3.66 / 4.00; Culture Risk Index 50 / 45 / 40; leaders ready 6 / 6.6 / 7.2 of 9. Targets print 2 decimals; whole number baselines (voice, CRI) keep their format. Note under the table: type.caption muted, 4 below the table rule: "Targets are set by the platform and may be changed by the Culture Practitioner before release." Page 32 bottom 733.9.
Long: up to 12 rows on the page; more split by rows to page 33 with the header repeated.

### 6.1 Targets chart (half, 241.64 x 200)
Plot x 36 to 229.64; 40 at y 36, 0 at y 160 (3.1 per point). Gridlines 10 to 40; even share 25 line 0.5 ink dash 2 on 2. Two groups (Engage, Innovate) of 96.82; three bars 18 wide, 4 apart (block 62) centred: Baseline = series tint + 1.0 series outline; 12 month = white fill + 1.0 series outline dash 3 on 2; 18 month = series fill + 0.5 ink keyline. Labels 1 decimal knockout, baseline bar top − 3. Names Inter 600 baseline 172. Legend baseline 186.05, neutral swatches: Baseline (#EEEEEE, 1.0 ink), 12 months (white, dashed ink), 18 months (muted, keyline), Even share 25.
Orientations shown: those with a numeric target in the KPI table (1 to 4 groups; group width = plot / count).

### 6.2 Voice lift chart (half, 241.64 x 200)
Name column x 12 (Inter 600 7). Plot x 100 to 229.64, −50 to +50, zero 164.82 (1.296 per point). Rows top 44 + 24i, bars 12, data.perform fill + keyline, value outside the bar end. Zero line 0.75 ink y 34 to 146; label "Tick: 12 months" Inter 600 7 at zero + 4, baseline 32, knockout. 12 month target per row: 1.25 ink tick from y − 2 to y + 14 at the target value. Ticks baseline 158. Caption type.caption ink baseline 186.05. Rows: voice scores below zero, lowest first, max 6; none below zero: panel shows the empty chart rule ("No voice score is below zero").

### Page 33, 13.2 Governance, leading and lagging (bottom 598.5, 75%, chapter end)
| Block | y | h | Content |
|---|---|---|---|
| h1, headline | 72, 106 | 18, 38 | |
| h2 + governance table | 160, 182 | 14, 141 | columns 130, 140, 90, 139.28: Forum, Who, How often, What it reviews. 3 to 6 rows. Field `plan.governance[]` |
| Leading and lagging pair | 339 | 176.5 | two half white panels: title type.panel-title, caption type.caption ink 4 below, list rows type.table with value right aligned Inter 600 tnum, 4 padding, 0.5 #DDDDDD top rule per row. Max 8 rows each |
| So what | 531 | 67.5 | |

## 7. Appendix A, Data tables (pages 34 to 35)

Appendix pages use the chapter opener with a letter tile and no headline; content starts at 120 (SPEC-group-1 section 6, missing headline rule).

| Block | y | h | Content and fields |
|---|---|---|---|
| A.1 h2 + table | 120, 142 | 14, 176.7 | Dense variant. Two header rows (18 each): "Now" and "Preferred" spanning 4 columns each, centred, 0.5 muted rule under the group row. Columns 131.28 + 8 x 46. Rows: names.dimensions D1 to D6 + "All dimensions" (orientation_scores). Star on the row maximum in each half. Fields: dimension_now, dimension_preferred |
| A.2 h2 + table + note | 335, 357 | 14, 144 | Dense. Columns 118, 46, 4 x 70, 55.28: Department, People, four orientations "now (diff)" with the difference in Inter 7, Leads. Last row Organisation (n = respondents.submitted). Note type.caption muted. Fields: departments.rows |
| A.3 h2 + table | 537, 559 | 14, 78 | Lens by orientation, star on the row maximum. Field: lenses_now |
| Page 35: h1 | 72 | 18 | "A Data tables, continued" |
| A.4 h2 + table + note | 106, 128 | 14, 274.9 | Item 1 to 12 by D7, D8, D9 (column heads from names.dimensions), Mean row with a star on the highest mean. Item wording is not printed (note). Fields: readiness_items, readiness.d7 to d9 |
| A.5 h2 + table | 439, 461 | 14, 187 | Voice score (names.voice), Answers, Promoters, Passives, Detractors, Score. Fields: eos_detail, eos |

Fill 80 and 82 percent. Long: A.1 always 7 rows; A.2 beyond 12 departments pushes A.3 to page 35; A.4 with more than 12 items per measure splits by rows.

## 8. Appendix B, Cohorts and method (page 36, bottom 565.9, 70%)

| Block | y | h | Content |
|---|---|---|---|
| B.1 h2 + table | 120, 142 | 14, 98 | columns 128, 46, 4 x 62, 77.28: Group, People, four orientations, Leads. Rows Executives, Staff, Organisation (star on row max), then "Executives minus staff" (signed 2 decimals; Leads cell = watch icon + orientation name for each flagged perception gap). Fields: cohorts, orientation_scores.now, perception_flags |
| B.2 h2 + table | 256, 278 | 14, 287.9 | columns 190, 90, 219.28: Measure, Result, What it tells you. Rows: invited, answered (with rate, computed), complete, median time (seconds to "27 min 44 s", computed), quality checks raised, readiness coverage (percent), item agreement for D7 to D9 (readiness.alpha) with a plain word, departments reported, Leadership 360 valid of leaders and minimum rater forms, comments and the theme minimum |

Item agreement words (owner to approve): 0.80 and above "Items agree strongly"; 0.60 to 0.79 "Items agree moderately"; below 0.60 "Items agree weakly; read with care". Missing cohort: row prints "Held back" (group 2 partial state). No 360: row left out.

## 9. Appendix C, Glossary (pages 37 to 38)

Two columns of 241.64, gap 16. Entry: term type.table Inter 600 ink (11), 2 gap, meaning type.body ink; 12 between entries; an entry never splits. Order: alphabetical, terms starting with a figure first. Page 37 columns run from 120 to 777.89 (column 1 then column 2); page 38 starts with h1 "C Glossary, continued" at 72, columns from 106, balanced by height. Sample: 37 terms, columns 10, 11, 8, 8; page 37 bottom 747.1 (96%), page 38 bottom 588.1 (73%, chapter end).
Fields: glossary text is template copy, not platform data, except dimension names (names.dimensions). Definitions say what a measure reveals, never how it is calculated. The cut-offs that appear (reporting threshold 5, gap bands 4 and 8) are allowed by owner decision 4 Nov.
Long: a third page only if terms are added; the build warns.

## 10. Appendix D, Working through the report (page 39, bottom 775.5)

| Block | y | h | Content |
|---|---|---|---|
| Session cards | 120, 298, 476 | 162, 162, 176 | full width white panel, padding 12, two columns 217.64 and 241.64, gap 16. Left: marker 16 + "SESSION n" type.kpi-label; name type.h2 8 below; WHO and PURPOSE labels type.panel-title, text type.body 4 below, 8 between groups. Right: AGENDA with numbered items (number Inter 600 8.5 tnum in an 8 wide column, text type.body, 4 between), OUTPUTS |
| Non negotiables | 668 | 107.5 | callout as section 5, label "NON NEGOTIABLES FOR EVERY SESSION", 4 items |

Fields: `facilitation.sessions[]` {name, who, purpose, agenda[3 to 4], outputs}, `facilitation.non_negotiables[]`. The page is full: a fourth session or a fourth agenda item on every card moves the non negotiables box to a second page (plus 1). The sample uses no session lengths or dates (none supplied).

---

## 11. pdfkit build notes for group 3

All vector paths, two type families, flat fills. Nothing needs blur, gradients, transparency or photographs.

| In the HTML | pdfkit method |
|---|---|
| Two row table header with spanning cells (A.1) | Draw both ink rows as rects; span text centred over x of the 4 columns; 0.5 muted line under the group row |
| Dashed bar outline (12 month target, legend) | `rect(x, y, w, h).dash(3, {space: 2}).lineWidth(1).stroke(colour)`, then `undash()` |
| Run in label in the signal strip ("SIGNAL TO WATCH" then body) | Icon path at line start; `text(label, {continued: true, characterSpacing: 0.5})` in Inter 700 8, then `font('Georgia').text(body)`; first line indent 14 for the icon |
| Tags with auto width | width = widthOfString("Owner:") + widthOfString(value) + space + 16; right align from 487.28 |
| Glossary columns | Heights from heightOfString at width 241.64; greedy fill as in build_group3.py `p_glossary` |
| CSS grid and flex (cards, figures, principle grid) | Positions in this spec |
| Inline icons in tables and lists | Draw the 10 pt path, text 14 to the right (as group 2) |

Nothing in group 3 needs a feature pdfkit lacks.

---

## 12. Proposed rules (need approval)

1. `element.priority-card` as section 2. APPROVED; tags are fully round pills (owner ruling 4 Nov 2026).
2. `table.dense`: APPROVED.
3. Section heading number column: APPROVED.
4. Small counts in prose as words, 0 to 10: APPROVED.
5. Item agreement words and cut-offs (0.80, 0.60): APPROVED.
6. KPI target method: replaced by the platform rule (section 6).

## 13. Open items and assumptions

- Sample wording, not data: every action, owner, timing, quick win, initiative, success indicator, principle, non negotiable, governance forum and frequency, and session card. These need a source field in the platform (`plan.*`, `kpi[]`, `facilitation.*`) or a consultant entry screen.
- DONE 4 Nov 2026 (stage 5 Task A): Group 1 and group 2 pages carried the old client name (Ostravane), "of 41" footers, the old Contents rows, and placeholder dimension and voice names; departments, 360 and themes pages still show empty states. They need a data refresh pass (regenerate with the new sample, 5 department cards, 360 with data, themes table). Not done this session so approved pages were not changed without review.
- Chapters 01 and 02 are still undesigned and counted as 1 page each.
- RESOLVED (owner ruling 4 Nov 2026): the B.2 row is "Leadership 360 coverage", the share of headcount led by leaders with a valid Leadership 360 result. The readiness score (Transformation Probability Score) is marked provisional below 60 percent. Glossary entry added; "4D Framework" entry removed.
- Platform strings with hyphens ("Sub-culture divergence", "Organisation-wide programmes") do not appear on group 3 pages; where scenario names are printed they are shown as supplied.
