# CDP report template: SPEC, group 2 (data pages)

Owner: Imran Issa, PAC Africa. Prepared by the PAC Design Agent, 3 Nov 2026.
Status: FOR REVIEW. Not approved. Group 3 has not started.
Sample client: Zendaro Group (fictional), 41 of 45 answered, 5 executives and 36 staff. Data: cdp_report/report-sample-data.json. Every number on the pages comes from that file or is computed from it (computed values are marked "computed" below).

Files in this folder

| File | Page type | Report pages |
|---|---|---|
| 10-culture-now.html | 03 The culture now | 9 to 11 |
| 11-culture-gap.html | 04 The culture gap | 12 to 14 |
| 12-strategy-checks.html | 05 Strategy checks | 15 to 16 |
| 13-executives-staff.html | 06 Executives and staff | 17 |
| 14-readiness-risk.html | 07 Readiness and risk | 18 to 19 |
| 15-employee-voice.html | 08 Employee voice | 20 to 21 |
| 16-departments.html | 09 Departments | 22 to 23 |
| 17-leadership-360.html | 10 Leadership 360 summary (collective pattern from `leadership_360`) | 25 |
| 18-what-this-means.html | 11 What this means | 25 |
| 19-blocks.html | Generic table, small finding card, so what callout (review sheet) | |
| 20-states.html | Empty, partial, long and single result states (review sheet, 2 pages) | |
| logo.js | Shared header logo (data URI from pac-logo-colour.png.base64, bytes unchanged) | |
| build_group2.py | Generator. Imports build_group1.py for tokens, frame, opener, icons, table style | |

Largest page file 36 KB. Every page links tokens.css and logo.js, so no file carries its own logo copy.
group 1 files were regenerated only to apply the new page plan (footer "of 41", Contents rows). Nothing else changed (checked by diff).

---

## 0. Conventions

All of SPEC-group-1 section 0 applies (points, origin top left, pdfkit text offset formula, tnum, uppercase in code).

New for group 2:
- **Chart coordinates are panel local.** Origin is the top left corner of the panel. Page position = panel x, y (from section 2) + local value. Text positions in charts are **baselines**, as pdfkit draws after the section 0.1 offset.
- **Chart text:** type.chart, Inter 400, 7 pt, ink, tnum. Names in charts Inter 600, 7 pt.
- **Number format on charts:** 1 decimal (29.6). Dense grouped bars (24 bars) use whole numbers (38). Tables use 2 decimals (29.64). Voice scores are whole numbers everywhere (the data is whole). Signs: "+" and true minus U+2212.
- **Knockout labels:** a value label that can cross a gridline or reference line sits on a white rectangle, width = text width + 2, height = 7, top = baseline − 5.74. pdfkit: `rect().fill('#FFFFFF')` then the text.
- **Draw order in every chart:** bands, gridlines, reference lines, bars and marks, knockouts and labels, axis line, legend.
- **Keylines:** every filled data mark has a 0.5 ink keyline (Rule 4). Now bars use a 1.0 series outline instead.
- **Panels:** white, radius 4, no outline (approved). Panel title type.panel-title at local (12, 12). Legend or caption baseline at local h − 13.95.

---

## 1. Page plan: 41 pages for the sample

| Pages | Content | Count | Status |
|---|---|---|---|
| 1 | Cover | 1 | Approved (group 1) |
| 2 | About this report | 1 | Approved |
| 3 to 4 | Table of Contents | 2 | Approved; rows updated to this plan |
| 5 to 6 | Executive summary | 2 | Approved |
| 7 | 01 How to read this report | 1 | Group 3 |
| 8 | 02 Method and participation | 1 | Group 3 |
| 9 to 11 | 03 The culture now | 3 | This group |
| 12 to 14 | 04 The culture gap | 3 | This group |
| 15 to 16 | 05 Strategy checks | 2 | This group |
| 17 | 06 Executives and staff | 1 | This group |
| 18 to 19 | 07 Readiness and risk | 2 | This group |
| 20 to 21 | 08 Employee voice | 2 | This group |
| 22 to 23 | 09 Departments | 2 | This group |
| 24 | 10 Leadership 360 summary | 1 | This group |
| 25 | 11 What this means | 1 | This group |
| 26 to 30 | 12 What to do next (3 priority pages, first 14 days, phase plan) | 5 | Group 3, planned |
| 31 to 32 | 13 Culture KPI scorecard | 2 | Group 3, planned |
| 33 to 35 | A Data tables | 3 | Group 3, planned |
| 36 | B Cohorts | 1 | Group 3, planned |
| 37 to 38 | C Glossary and references | 2 | Group 3, planned |
| 39 to 40 | D Working through the report | 2 | Group 3, planned |
| 41 | Back page | 1 | Approved |

Group 2 is 17 pages against 23 in the brief: denser pages, two charts per row, no definition boxes.

Range with real data sets (the build must stay within 40 to 50):

| Variable | Effect |
|---|---|
| No 360 data | Chapter 10 left out: 40 pages |
| Comment themes present | Employee voice page 21 fills; no extra page up to 8 themes, +1 page from 9 themes |
| Departments | Page 23 holds 4 department cards (140 high, 16 apart); each further 4 departments add 1 page. The heatmap holds 18 rows on page 22 |
| Leadership 360 with more than 8 sections | +1 page |
| More than 3 priorities | +1 page per priority (group 3) |

Worst realistic case (12 departments, 360 with 10 sections, 12 themes, 4 priorities): 41 + 2 + 1 + 1 + 1 = 46. The build warns above 48 and stops above 50.

---

## 2. Data page skeleton

### 2.1 First page of a chapter

| Block | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Chapter opener | 48 | 72 | 499.28 | 32 | SPEC-group-1 section 6 |
| Headline | 48 | 120 | 499.28 | 19 per line, max 2 | type.headline; the one key number in brand, Inter 700 (14 pt bold passes 3:1). One brand number per page |
| Content flow | 48 | 174 (155 when the headline is 1 line) | 499.28 | | Blocks stack with 16 between them |

### 2.2 Continuation page inside a chapter

| Block | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Section heading | 48 | 72 | 499.28 | 18 | type.h1, number in a 28 wide tnum column, then title ("3.2 The six dimensions") |
| Headline | 48 | 98 | 499.28 | 19 per line, max 2 | type.headline, all ink (no brand number on continuation pages) |
| Content flow | 48 | 152 (133 with a 1 line headline) | 499.28 | | gap 16 |

### 2.3 Inside the flow

- Order on every page: headline, chart (panel pair or full width panel), h2 + table, so what. Optional extra blocks (numbered list, second table) go between the table and the so what.
- h2 (type.h2, 14 high) sits 8 above its table.
- Gap between blocks: 16.
- Fill rule: every page in this group is 66 to 93 percent full; the two below 70 percent end a chapter (21 and 24).
- A heading never sits in the last 72 pt (above 705.89). Panels, cards and callouts never split. Tables split between rows with the header repeated and at least 3 rows each side.

---

## 3. Generic blocks

### 3.1 Chart panel and panel pair

| Part | Value |
|---|---|
| Panel | white, radius 4, padding 12, no outline |
| Half panel | 241.64 wide; left x 48, right x 305.64; gap 16 |
| Full panel | 499.28 wide, x 48 |
| Title | type.panel-title (Inter 700, 8/10, caps, +0.5) ink, local (12, 12), w 217.64 (half) or 475.28 (full), 1 line |
| Plot area | local y 30 to h − 30 |
| Legend | baseline local h − 13.95; swatch 10 x 7 (top = baseline − 6), 4 to label, 12 between items |
| Heights used | 200, 228 (half); 236, 246, 258 (full). Both panels in a pair share one height |

Neutral legend swatches (shape carries the meaning, not colour): Now = #EEEEEE fill with 1.0 ink outline; Preferred = muted fill with 0.5 ink keyline; reference line = 0.5 ink dash 2 on 2; Executives = filled ink circle r 3; Staff = hollow ink diamond.

### 3.2 Table block (all data tables)

Style as SPEC-group-1 section 3: header 18 high, ink fill, type.table-head white; body rows 4 + 11 per line + 4; white and surface banding from white; 0.5 #DDDDDD separators; 0.75 ink bottom rule; no vertical lines; first column Inter 600; numbers right aligned, tnum; cell padding 12 left and right.

Signal words in cells (icon 10 x 10, 4 before the word, ink; verdict colours never used in tables):

| Signal | Icon | Word source |
|---|---|---|
| Leading value | star | none, the number itself, Inter 600 |
| Hit | check | evaluation.checks HIT |
| Partial hit | half filled circle | PARTIAL_HIT |
| Miss | cross | MISS |
| Platform flag | watch triangle | severity CRITICAL or HIGH, perception flag, scenario severity CRITICAL or HIGH |
| Positive, no flag | check | voice score above 0 with no finding |
| Neutral band | none | band words (Moderate, Diffuse) |
| Missing | none | "No data", ink |

Star rule: one star per row or per column, on the highest value of that row or column, as named in each table below. Ties: star on each tied value.
Long text: cells wrap; row height grows by 11 per line; a cell above 3 lines raises a build warning.
Empty: one full width row, padding 12, type.body ink, saying why ("No comment themes in this data set...").

### 3.3 So what callout

As approved (SPEC-group-1 7.8): surface, 1.5 brand top rule, bottom radius 4, padding 12, label "SO WHAT", body type.body max 2 lines. Height 67.5 with 2 lines, 53.5 with 1. Text must cite at least one client number.

### 3.4 Finding card, small (half width)

| Part | Local position | Size | Font, colour |
|---|---|---|---|
| Card | 241.64 wide | auto; cards in a row share the taller height | white, 1.5 brand top rule, bottom radius 4, padding 12 |
| Verdict tile | 12, 13.5 | min 100.82 x 24, grows to fit the word (max 160) | type.kpi-label; colours as group 1 7.7 (Hit, Partial hit, Miss, Flag in ink) |
| Number | tile right + 12, vertically centred on the tile | 26 | type.kpi-value, ink |
| Number label | tile bottom + 4 | 10 per line | type.kpi-label, ink |
| Four lines | label bottom + 8, then 4 between | 217.64 wide | run in: "Finding." in type.body-strong, text type.body, ink |

Sample height 207.5 (page 16). Each line max 3 lines; above that the build warns. Missing owner or timing: "Owner: to be confirmed". Same field rules as the full card (no thresholds, override codes or alignment percentages).

### 3.5 Verdict card (strategy checks)

| Part | Local position | Size | Font |
|---|---|---|---|
| Card | half width | auto, shares row height (sample 132) | white panel, radius 4, padding 12, no top rule |
| Check label | 12, 12 | 10 | type.kpi-label: "C1 · STRATEGY" |
| Verdict tile + number | label + 8 | tile 100.82 x 24; number 24/26 | as 3.4 |
| Number label | + 4 | 10 per line | type.kpi-label |
| Evidence | + 8 | 217.64 wide, max 3 lines | type.body |

Grid: 2 x 2, gap 16, at the content start. Fewer than 4 checks: cards fill left to right; a single card stays half width.

### 3.6 Numbered list

Marker circle 16 diameter, brand fill, number type.kpi-label ink (5.23:1); text type.body ink 8 to the right, 1 pt lower; 8 between items. Max 5 items.

### 3.7 Department card

Full width white panel, 499.28 x 140. Left: chart (4.17). Right column at local x 257.64, top 12, width 229.64: department name type.h2; "PEOPLE: {n}" type.kpi-label, 4 below; then run in lines in type.body, 8 then 4 apart: Leading orientation, Finding, Voice flag (watch icon). Gap between cards 16.

### 3.8 Four step graphic

Full width white panel 499.28 x 200. Four columns 106.82 wide at local x 12, 134.82, 257.64, 380.46. Marker circles r 8 brand at (x + 8, 20), number Inter 700 8 ink baseline 22.9; connector 0.75 brand from x 20 to 388.46 at y 20. Column from y 36: step label type.kpi-label (20 reserved), value type.kpi-value 4 below, caption type.caption ink 4 below (24 reserved), body type.body 8 below, max 5 lines.

---

## 4. Chart catalogue (panel local geometry)

### 4.1 Profile bars (half, 241.64 x 228)
Plot x 36 to 229.64; value 40 at y 40, 0 at y 172 (3.3 per point). Gridlines 10 to 40, 0.5 #DDDDDD; ticks right aligned at x 32, baseline y + 2.5. Four groups of 48.41; per group a Now bar and a Preferred bar, 16 wide, 2 apart, pair centred. Now: series tint fill, 1.0 series outline (drawn inset 0.5). Preferred: series fill, 0.5 ink keyline. Value labels 1 decimal, centred, baseline bar top − 3, knockout. Group names Inter 600 baseline 184. Even share line at y 89.5, 0.5 ink dash 2 on 2, drawn before the bars. Axis 0.75 ink at y 172. Legend: Now, Preferred, Even share 25. Fields: orientation_scores.now, .preferred. Never stacked.

### 4.2 Share ring (half, 241.64 x 228)
Centre (80, 110), outer r 62, inner r 38. Segments clockwise from 12 o'clock in the fixed order Engage, Innovate, Perform, Govern; sweep = value / sum x 360; series fill, 0.5 ink keyline. Centre: "{leader} leads" Inter 600 7 baseline 106; value Inter 600 11 baseline 120 (2 decimals). Direct label list: x 158, first baseline 74, pitch 22; swatch 8 x 8 at (158, baseline − 7) with keyline; name Inter 600 at x 170; value right aligned at 229.64. Caption "Share of 100 points, now" baseline 214.05. pdfkit: each segment is one path (moveTo, arc via `path()` SVG string with A commands, lineTo, arc back, closePath).

### 4.3 Lead margin bars (half, 228)
Rows: label (Inter 600, baseline y + 7) and "{first} over {second}" (muted, baseline y + 16). Bars ink fill, 12 high at y + 1, from x 100; scale 0 to 20 over x 100 to 205 (5.25 per point). Value 2 decimals at bar end + 4, baseline y + 9.5. Gridlines 5, 10, 15, 20; axis 0.75 ink at x 100. Pitch 36 for 4 rows (lenses), 26 for 6 rows (dimensions); first row top y 36. Fields: lenses_now, dimension_now, orientation_scores.now (computed: first minus second).

### 4.4 Grouped bars, six dimensions (full, 499.28 x 236 Now; 246 gap)
Plot x 44 to 487.28. Now: 40 at y 36, 0 at y 176 (3.5 per point), gridlines every 10, even share line at 25. Gap: +25 at y 36, −25 at y 186, zero 111 (3.0 per point), gridlines every 5, zero line 0.75 ink. Six groups of 73.88; four bars 14 wide, 2 apart, block 62 centred. Series fills, 0.5 ink keyline. Labels whole numbers, centred, baseline bar top − 3 (positive) or bar bottom + 9 (negative). Group labels Inter 600 baseline 189 (Now) or 199 (gap). Legend: four orientations (+ even share on Now). Fields: dimension_now; gap = dimension_preferred − dimension_now (computed).

### 4.5 Gap bars with class bands (half, 241.64 x 200)
Name column x 12 (Inter 600). Plot x 58 to 178, zero x 118, scale −20 to +20 (3 per point). Bands drawn first, full plot height (y 30 to 148): 4 to 8 points #EEEEEE (band.watch), 8 to 20 points #DDDDDD (band.significant), both sides. Bars 12 high, row tops 34 + 30i, series fill, keyline. Value 1 decimal outside the bar end (4 gap). Class word right aligned at 229.64, from analytics.gap_bands, sentence case. Ticks −8, −4, 0, +4, +8 baseline 158; "Want less" left at x 58 and "Want more" right at x 178, baseline 169. Legend: "Watch band, 4 to 8", "Significant, above 8". Values beyond 20: scale grows to 30.

### 4.6 Now and Preferred arrows (half, 200)
Plot x 62 to 219.64, scale 0 to 40 (3.941 per point). Row centre y 40 + 30i. Now: circle r 3, white fill, 1.25 series stroke. Line 1.5 series from Now to 5 short of Preferred. Arrow head: triangle 6 long, 7 high, series fill, keyline. Labels 1 decimal, knockout: Now on the side away from the arrow (6 gap), Preferred beyond the head (4 gap). Gridlines 10 to 40, even share 25 dashed, axis at x 62. Ticks baseline 158.

### 4.7 Tension pairs (half, 200)
Per tension block from y 40, pitch 66: title "{a} and {b}" Inter 600 baseline y; "{score}, {band}" right aligned at 229.64. Two bars on a shared zero: x 62 to 207.64, zero 134.82, scale ±15 (4.855 per point), bars 12 high at y + 8 and y + 24, series fill, keyline; names baseline y + 16.5 and y + 32.5. Zero line 0.75 ink y + 4 to y + 44. "Want less" and "Want more" baseline 164. Caption baseline 186.05. Fields: analytics.tensions, orientation_scores.gap. More than 2 tensions: the panel grows by 66 per tension (and its pair partner too).

### 4.8 Spread bars (half, 200)
Plot x 62 to 207.64, scale 0 to 12 (12.137 per point). Rows top 44 + 28i, bars 12, series fill. Overall line: 1.0 ink dash 3 on 2 at analytics.dispersion.overall, from y 34 to 148, label "All answers {value}" centred baseline 31. Values 2 decimals, knockout. Fields: mean of dispersion D1 to D6 per orientation (computed), dispersion.overall.

### 4.9 Dumbbell, executives and staff (half, 200)
Plot x 62 to 191.64, scale 15 to 35 (6.482 per point); gridlines 15 to 35, even share 25 dashed. Row y 40 + 30i. Executive: filled circle r 3.5, series fill, keyline; label 1 decimal baseline y − 7. Staff: hollow diamond, half diagonal 4, white fill, 1.25 series stroke; label baseline y + 13. Connector 1.0 muted. Labels knockout. Gap column: "Gap" Inter 600 right aligned 229.64 baseline 26; value 2 decimals right aligned, baseline y + 2.5; watch icon 14 left of the value when perception_flags is not NONE. Ticks baseline 162. Shown only when both groups are reported. Scale: if any value falls outside 15 to 35 the scale widens in steps of 5. No line is drawn at the flag point (that would publish the threshold).

### 4.10 Who scores higher (half, 200)
Plot x 62 to 207.64, scale −10 to +10, zero 134.82 (7.282 per point). Bars = executive minus staff (computed), series fill, keyline; values 2 decimals outside. End labels "Staff higher", "Executives higher" baseline 165. Caption baseline 186.05.

### 4.11 Gauges
Half circle from the low end (left) over the top to the high end (right). Track #EEEEEE; value arc butt capped. No band segments: band boundaries are scoring thresholds and stay hidden; the band word prints as text.
- Small (four in a 2 x 2 grid, panel 200): cells 108.82 wide; centres x 66.41 and 175.23, y 70 and 150; r 30, stroke 7. Value Inter 600 11 baseline cy − 4; "1" and "5" baseline cy + 10 at the arc ends; name Inter 600 baseline cy + 21; band word baseline cy + 30. The overall gauge arc is brand, the others ink.
- Large (panel 200 or 228): centre (120.82, 118), r 62, stroke 14. Value type.kpi-value baseline 110; band word type.kpi-label caps baseline 130; end labels baseline 132; note type.caption ink baseline 154.
- Diverging variant (voice index): arc runs from the origin (0, at the top) to the value; 0.75 ink tick at the origin; "0" baseline 44.
pdfkit: `doc.path('M x y A r r 0 0 1 x2 y2').lineWidth(w).stroke(color)`.

### 4.12 Readiness item strip (half, 200)
Scale 2.8 to 3.6 over x 50 to 225.64. Rows y 50, 94, 138. Each item a circle r 2.2, white fill, 1.0 muted stroke; equal values stack 5 upward. Mean: 1.5 ink line from y − 12 to y + 7, label "Mean {value}" centred baseline y + 15. Lowest value printed 5 left of its dot. Gridlines at 0.2 steps, ticks baseline 164. Fields: readiness_items.D7 to D9, readiness.d7 to d9. Values outside the scale widen it in steps of 0.2.

### 4.13 Health meters (half, 200)
Rows y 40, 80, 120: name Inter 600 baseline y; description muted baseline y + 9; value Inter 600 right aligned 229.64 with a star on the highest; track 8 high at y + 14, full width 12 to 229.64, #EEEEEE; fill ink, width value / 100. "0" and "100" baseline 166. Caption "Lower is better on every meter" type.caption ink baseline 186.05. Rows sorted high to low. Fields: analytics.risk.dispersion, .gap, .misalignment, .misalignment_source.

### 4.14 Voice diverging bars (full, 499.28 x 258)
Name column x 12. Plot x 96 to 463.28, scale −50 to +50 (3.673 per point), zero 279.64. Rows top 48 + 20i, bars 12. Below zero data.perform #C0392B, above zero data.engage #2E86C1 (owner default), keyline. Values whole numbers with sign, outside the bar end. Index line: 1.0 ink dash 3 on 2 at eos.index, y 36 to 202; label "Index {value}" baseline 40 at line + 4. Gridlines at ±25, ±50; ticks baseline 212; "More detractors" and "More promoters" baseline 223; legend baseline 244.05. Scores beyond ±50: scale goes to ±100.

### 4.15 Composition bars (half, 228)
Name column x 12. Bars x 68 to 229.64, scaled to eos_detail.n; rows top 34 + 19i, 12 high. Segments left to right: detractors #C0392B, passives #DDDDDD, promoters #2E86C1, each with keyline. Counts centred when the segment is at least 12 wide: white on red (5.44:1), ink on grey and on blue (4.69:1).

### 4.16 Heatmap (full)
Name column x 12, 148 wide (Inter 600). Cells 72 x 24 from x 160; Leads column text at x 460. Header names Inter 600 centred, baseline 28. Rows from y 34. Cell value 8.5 Inter, signed 1 decimal, Inter 600 when the absolute value is 8 or more.
Colour steps (difference from the organisation, pre mixed, no transparency):

| Step | Fill | Text |
|---|---|---|
| Below −8 | #C0392B | white |
| −8 to −4 | #E9BAB5 | ink |
| −4 to +4 | #FFFFFF | ink |
| +4 to +8 | #B6D5E9 | ink |
| Above +8 | #2E86C1 | ink |

Cell border 0.5 #DDDDDD. Suppressed cell: hatch of 1.0 #C7C6C6 lines at 45 degrees every 4, white label box (x + 6, y + 7, 60 x 10), "Below threshold" centred. Missing cell: white, "No data" in muted 7. Note (optional) type.caption baseline rows bottom + 14; legend swatches 10 x 8 baseline + 34 (+ hatched swatch "Below reporting threshold"); caption "Difference from the organisation, in points" baseline + 47. Panel height = 34 + 24 x rows + 62. Up to 18 rows per page; beyond that the map continues with the header repeated.

### 4.17 Department comparison chart (inside the card, 140 high)
Title Inter 600 baseline 19. Rows y 30 + 22i: name Inter 600 baseline y + 9; organisation Now bar 7 high at y, tint fill, 1.0 series outline; department bar 7 high at y + 9, series fill, keyline; values 1 decimal at bar ends. Scale 0 to 40 over x 64 to 215. Axis 0.75 ink at x 64. Legend Organisation, Department; when the department has no scores the department bars are left out and the legend becomes the note "No department scores in this data set; organisation shown."

### 4.18 Leadership 360 dumbbell (full, 236)
Plot x 140 to 439.28, scale 1.00 to 5.00 (74.82 per point), gridlines at each whole point, ticks 2 decimals baseline 180. Flag line at 3.00: 1.0 brand dash 3 on 2, label "Flag line 3.00" baseline 28. Rows from y 40, pitch 30, section names Inter 600 at x 12 (128 wide, 2 lines max). Self: filled ink circle r 3.5. Others: hollow ink diamond. Gap value right aligned at 487.28; watch icon when the others score is below 3.00. Never names a leader: the data is the collective self versus others by section. Up to 8 sections per panel; 9 to 16 sections make the panel 236 + 30 per extra row and push the table to the next page.

---

## 5. Pages: blocks, measured positions and fields

Positions are measured in Chromium (y of the block top, h). Panels at x 48 and 305.64 (pairs) or 48 (full).

### Page 9, 03 The culture now (bottom 621, fill 78%)
| Block | y | h | Content and fields |
|---|---|---|---|
| Opener | 72 | 32 | "03", "The culture now" |
| Headline | 120 | 38 | Leader now (brand number), lead over second, Preferred of the leader. Fields: orientation_scores.now, .preferred |
| Panel pair | 174 | 228 | Orientation profile (4.1) and Share of the culture now (4.2) |
| h2 | 418 | 14 | "Orientation scores by lens" |
| Table | 440 | 97.7 | Columns 120, 76, 76, 76, 76, 75.28: Orientation, Now, Practice, Strategy, Leadership, Rank now. Star on the highest of each column. Fields: orientation_scores.now, lenses_now |
| So what | 553.7 | 67.5 | Cites the lead and Leadership Engage |

### Page 10, 3.2 The six dimensions (bottom 667, 84%)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 38 | Count of dimensions each orientation leads; peak value |
| Full panel | 152 | 236 | Six dimensions, now (4.4) |
| h2 + table | 404, 426 | 14, 157.9 | Columns 120, 74 x 4, 83.28: Dimension, four orientations, Leads. 6 rows + Organisation row. Star on the row maximum. Fields: dimension_now |
| So what | 599.9 | 67.5 | |

### Page 11, 3.3 Strength and consistency (bottom 642, 81%)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 38 | Lens leaders with values |
| Panel pair | 152 | 228 | Lead margin by lens; Lead margin by dimension (4.3) |
| h2 + table | 396, 418 | 14, 141 | Columns 120, 60, 100, 219.28: Indicator, Score, Rating, What it means. Rows: culture_strength + strength_band; congruence.dimension_pct + band; dispersion.overall ("Not banded"); entropy.score + band |
| So what | 575 | 67.5 | |

### Page 12, 04 The culture gap (bottom 593, 74%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | Largest positive and negative gap; count in the significant band |
| Panel pair | 174 | 200 | Gap by orientation (4.5); Now and Preferred (4.6) |
| h2 + table | 390, 412 | 14, 97.2 | Columns 120, 70, 70, 70, 84, 85.28: Orientation, Now, Preferred, Gap, Class, Direction. Star on the largest absolute gap. Fields: orientation_scores, analytics.gap_bands, classification (Build, Moderate) |
| So what | 525.2 | 67.5 | |

### Page 13, 4.2 Gap by dimension (bottom 657, 83%)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 38 | Whether every dimension moves the same way (computed check); largest single shift |
| Full panel | 152 | 246 | Gap by dimension (4.4, signed) |
| h2 + table | 414, 436 | 14, 137.9 | Columns 120, 70 x 4, 99.28: Dimension, four gaps, Largest shift. Star on the largest absolute value per row |
| So what | 589.9 | 67.5 | |

### Page 14, 4.3 Tensions and spread (bottom 631, 79%)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 38 | Tension scores and bands; orientation with the widest spread |
| Panel pair | 152 | 200 | Tension pairs (4.7); Spread of answers (4.8) |
| h2 + table | 368, 390 | 14, 157.7 | Columns 120, 70 x 4, 99.28: Dimension, four orientations, Average; plus "All dimensions" row. Star on the row maximum. Fields: analytics.dispersion |
| So what | 563.7 | 67.5 | |

### Page 15, 05 Strategy checks (bottom 695, 88%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | Hits out of checks; the miss with its number in brand |
| Verdict grid | 174 | 280 | Four verdict cards (3.5). Number per check: C1 Innovate now; C2 leadership profile Engage (evaluation evidence.profile); C3 gap of the offending orientation; C4 the weaker orientation of the pair, now |
| h2 + table | 470, 492 | 14, 119.5 | Columns 116, 78, 88, 82, 82, 53.28: Check, Verdict (icon + word), Rests on, Now, Preferred, Severity |
| So what | 627.4 | 67.5 | |

### Page 16, 5.2 Evidence by check (bottom 667, 84%)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 38 | |
| Finding grid | 152 | 431 | Four small finding cards (3.4), 2 x 2, rows 207.5 |
| So what | 599 | 67.5 | |

### Page 17, 06 Executives and staff (bottom 695, 88%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | Flagged gap (brand) and the flag word |
| Panel pair | 174 | 200 | Dumbbell (4.9); Who scores higher (4.10) |
| h2 + table | 390, 412 | 14, 97.2 | Columns 104, 84, 70, 56, 84, 101.28: Orientation, "Executives, {n}", "Staff, {n}", Gap, Higher group, Flag (watch icon + word or "No flag") |
| h2 + list | 525.2, 547.2 | 14, 64 | "Questions to test with the executive team": numbered list (3.6) from scenario SC-05 hypotheses |
| So what | 627.2 | 67.5 | |

### Page 18, 07 Readiness and risk (bottom 612, 77%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | readiness.tps (brand) and band |
| Panel pair | 174 | 200 | Readiness gauges (4.11 small); Readiness items (4.12) |
| h2 + table | 390, 412 | 14, 116.7 | Columns 130, 60, 130, 90, 89.28: Measure, Score, Band, Lowest item, Highest item. Rows: overall, D7, D8, D9, Leadership alignment ("Not banded") |
| So what | 544.7 | 67.5 | Cites the lowest item |

### Page 19, 7.2 Culture Risk Index (bottom 732, 93%)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 38 | Index, band, largest driver |
| Panel pair | 152 | 200 | Large gauge 0 to 100 (lower is better); Health meters (4.13) |
| h2 + table | 368, 390 | 14, 77.5 | "Risk drivers": columns 140, 64, 295.28: Driver, Score (star on highest), What drives it (computed from dispersion, gap_bands, perception_gap) |
| h2 + table | 483.4, 505.4 | 14, 143.3 | "Risk scenarios the platform found": columns 120, 74, 140, 165.28: Scenario, Severity, Diagnosis, Main risks (first two, one per line). Fields: evaluation.scenarios |
| So what | 664.7 | 67.5 | More than 3 scenarios: the scenarios table splits by rows onto one extra page and the so what follows it |

### Page 20, 08 Employee voice (bottom 731, 93%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | Count below zero; lowest (brand) and highest |
| Full panel | 174 | 258 | Voice diverging bars (4.14) |
| h2 + table | 448, 470 | 14, 177.9 | Columns 120, 60, 70, 70, 70, 109.28: Voice score, Score (star on highest), Promoters, Passives, Detractors, Signal |
| So what | 663.9 | 67.5 | |

### Page 21, 8.2 Who says what, and themes (bottom 539, 66%, chapter end)
| Block | y | h | Content |
|---|---|---|---|
| h1 + headline | 72, 98 | 18, 19 | Score with the most detractors |
| Panel pair | 133 | 228 | Composition bars (4.15); Voice index gauge (diverging variant) |
| h2 + table | 377, 399 | 14, 56.7 | Themes: columns 150, 70, 90, 189.28: Theme, Mentions, Tone, What people said. Sample: empty row |
| So what | 471.7 | 67.5 | |

### Page 22, 09 Departments (bottom 574, 71%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | Count of confirmed subcultures; those whose lead differs |
| Full panel | 174 | 168 | Heatmap (4.16). Sample: 3 rows, every cell "No data" |
| h2 + table | 358, 380 | 14, 110.2 | Columns 118, 86, 110, 112, 73.28: Department, People, Leading orientation, Platform finding, Voice flags |
| So what | 506.2 | 67.5 | |

### Page 23, 9.2 Department profiles (bottom 604, 75%)
h1 + headline at 72 and 98; department cards (3.7) at 152, 308, 464 (140 each, gap 16). Order: severity, then name.

### Page 24, 10 Leadership 360 summary (bottom 545, 67%, empty state)
Opener; headline at 120; full panel 360 dumbbell (4.18) at 174, 236 high, with the empty message on a white knockout; h2 + table (Section 150, Self 70, Others 70, Gap 70, Flag 139.28) at 426; build note. With data: headline names the weakest section and the self versus others gap; table stars the largest gap; so what follows.

### Page 25, 11 What this means (bottom 625, 78%)
| Block | y | h | Content |
|---|---|---|---|
| Opener, headline | 72, 120 | 32, 38 | All ink |
| Four step graphic | 174 | 200 | 3.8. Values: leader now; largest gap; hits of checks; flagged perception gap |
| h2 + table | 390, 412 | 14, 130 | Columns 150, 239.28, 110: Step, What the data shows, Read more (chapter and page from the layout pass) |
| So what | 558 | 67.5 | |

---

## 6. States (20-states.html, plus the real empty states in the sample)

| State | Rule | Shown |
|---|---|---|
| Empty chart | Grid and axes stay; marks left out; "No results yet" type.body italic centred, ink | 20-states p1 |
| Empty verdict | Panel holds one italic sentence saying why; no tiles | 20-states p1 |
| Empty table | Header row plus one full width row with the reason | 20-states p1; themes table p21; 360 table p24 |
| Partial: group held back | Held back values print "Held back"; derived gap and flag print "Not shown"; the held back marker and its legend item are left out | 20-states p1 (executives) |
| Partial: department held back | Whole row hatched, "Below threshold" label per cell | 20-states p1 |
| Long table | Breaks between rows, header repeats, section heading gets ", continued", at least 3 rows each side | 20-states p2 |
| Long heatmap | 18 rows per page, header repeated | rule |
| Long card lists | Department cards 4 per page | rule |
| Single result | One department: one card, full width, no comparison text implying others | 20-states p2 |
| Single check | One verdict card, half width, left | rule |
| No 360 data | Chapter left out, contents renumber; page 24 shows the empty template | 17-leadership-360 |
| Specimen | 360 row geometry with placeholder words, not data | 20-states p2 |

---

## 7. pdfkit build notes for group 2

Everything in group 2 is vector paths, two type families and flat fills. No blur, gradients, transparency or photographs.

| In the HTML | pdfkit | Replacement or method |
|---|---|---|
| SVG `<pattern>` hatch for suppressed cells | No pattern fills | `save()`, `rect(x, y, w, h).clip()`, draw 45 degree lines every 4 (1.0 #C7C6C6) across the box, `restore()`, then the 0.5 border and the white label box |
| SVG arcs (ring, gauges) | Supported through `doc.path()` with SVG path data (A command) | Use the path strings in build_group2.py (`arc_path`, `gauge`) |
| `text-anchor` middle and end | Not available | x = anchor − widthOfString (end) or − width / 2 (middle) |
| Letter spacing on the gauge band word | `characterSpacing: 0.5` | |
| Flex and grid layout, auto row heights | None | Positions in section 4; heights from `heightOfString`; row heights 8 + 11 x lines |
| Inline icons inside table cells | No inline images | Draw the 10 pt icon path at the cell text position, word 14 to the right |
| Stacked equal values in the item strip | n/a | Offset 5 per repeat, computed in code |
| Knockout labels | Supported | White rectangle, then text |

Nothing in this group needs a feature pdfkit lacks.

---

## 8. Tokens and rules proposed (need approval; not yet in tokens.json)

1. `chart.track` = #EEEEEE (gauge and meter tracks). Same value as band.watch.
2. `chart.heat`: five steps as in 4.16, reusing data.perform, data.tint.perform, white, data.tint.engage, data.engage.
3. `chart.composition`: detractors data.perform, passives chart.band.significant, promoters data.engage.
4. `chart.flag-line`: 1.0 brand, dash 3 on 2 (360 only).
5. `chart.mean`: 1.5 ink.
6. `chart.label`: 1 decimal on charts, whole numbers on dense grouped bars, 2 decimals in tables; knockout behind labels that may cross lines.
7. Signal word set and icons as in 3.2.
8. Neutral legend swatches as in 3.1.
9. `element.finding-card-small`, `element.verdict-card`, `element.dept-card` (140 high), `element.four-step` (200 high), `element.numbered-list` as in section 3.
10. Verdict tile width: minimum 100.82, grows to fit the word up to 160 ("Shadow culture" needs 112).
11. Gauges never show band segments; the shadow culture point is never drawn as a line.

## 9. Open items and assumptions

Not in the sample data (shown as empty states or plain labels, never invented):
- Department scores and sizes: heatmap and cards show their empty state. Department names and findings come from evaluation.findings.
- Leadership 360 results: chapter 10 shows its empty state.
- Comment themes: empty themes table.
- Names for dimensions D1 to D9 and voice scores Q1 to Q8: shown as "Dimension 1" and "Voice score 1". Needs platform fields (proposed `dimension_labels`, `eos_labels`).

Assumptions to confirm:
- Readiness gauges use a 1 to 5 scale (items range 2.95 to 3.51).
- Voice index plotted on the same −100 to +100 scale as the eight scores (it equals their average in the sample).
- Middle gap band word "Watch" (only "Significant" appears in the data).
- Signal "Positive" for voice scores above zero with no platform flag.
- "Not banded" printed where the platform gives no band (spread, leadership alignment).

Sample wording, not data: Action lines, owners and timings on the small finding cards (page 16); every so what sentence.

Platform text that breaks the writing rules: scenario names and risks contain hyphens ("Sub-culture divergence", "Organisation-wide programmes"). Printed as supplied; the platform copy should be fixed.

## Zendaro refresh (4 Nov 2026, Task A of stage 5)

Layouts as approved; data and names only, except where a real name would not fit the approved geometry (marked FIT below). Page plan is now the final 40 page plan: group 2 runs pages 9 to 26 (departments grew to three pages for five department cards; 360 moved to 25, What this means to 26). Footer reads "of 40".

### Names
- Dimensions D1 to D9 and voice Q1 to Q8 come from `names.dimensions` and `names.voice`. Prose that said "dimension 4" or "voice score 3" now uses the name (for example "in Cohesion Drivers", "Innovation climate is lowest at −29").
- Counts zero to ten in prose are words (approved rule 5); tables, charts and tiles keep numerals.

### Changed geometry (FIT)
| Block | Was | Now | Why |
|---|---|---|---|
| Readiness items (4.12), row label | x 12, baseline row y + 2.5, 38 pt column | x 12, baseline row y − 18, white knockout, above the dots | "Psychological safety" is 72 pt and ran into the lowest item label |
| Who says what (composition), page 21 | label column 56 pt, bars x 68 to 229.64, pitch 19, bar 12, panel 228 | label above bar (baseline y − 2.5), bars x 12 to 229.64, top 40, pitch 22, bar 10, segment value baseline y + 7.5; panel 240 (pair height 240, voice index panel 240) | Voice names run to 125 pt |
| Voice diverging chart, page 20 | label plain text | label on white knockout (txk) | "Would recommend as a place to work" crosses the −50 gridline |
| Voice table, page 20 | columns 120, 60, 70, 70, 70, 109.28 | 170, 50, 66, 62, 70, 81.28 | Names wrapped to two lines |
| Themes table, page 21 | Theme 150, Mentions 70, Tone 90, What people said | Theme 150, Share 70 (right), What people said 279.28 | Data has `share_pct` and `what_people_say`; no tone field, so the Tone column is dropped rather than invented |
| Department table, page 22 | 118, 86, 110, 112, 73.28 | 110, 52 (People, right), 112, 106, 119.28 | "Communication (Medium)" overflowed |

### Data now shown
- Page 22: heatmap cells = `departments.rows[].diff`, Leads column = `dominant`; legend note removed. Panel height 34 + 24 x rows + 36 + 12 (sample 202). Headline: count of departments whose `dominant` differs from the organisation lead, plus the largest absolute difference. Table: People = `n`; Leading orientation = name, ", differs" when not the organisation lead; Platform finding = SUBCULTURE severity or "None"; Voice flags from department ENGAGEMENT_MISS findings.
- Pages 23 and 24: one card per department, three per page (140 high, 16 gap). Card bars: organisation Now (tint) and department `now` (solid). Right column: People {n}; leading orientation sentence with the largest difference; finding sentence ("No subculture finding from the platform." when none). Page 24 ends the chapter at 448 (53 percent), allowed by the chapter end rule.
- Page 25, Leadership 360: headline from `leaders`, `valid`, `bands`. Table (150, 90, 259.28: Measure, Result, What it shows): leaders, valid results, one row per band, most common growth area, most common default, one row per flag. So what from growth and default. The dumbbell panel keeps its approved geometry and shows "Section scores for self and others are not in this data set." because the sample has no section level self and others scores.
- Page 21 so what now cites the leading comment theme and the commenter count.

### Measured bottoms (limit 777.89)
9: 621.2; 10: 667.4; 11: 642.5; 12: 592.7; 13: 657.4; 14: 631.1; 15: 694.9; 16: 666.5; 17: 694.6; 18: 612.2; 19: 732.2; 20: 753.2; 21: 685.2; 22: 625.2; 23: 604.0; 24: 448.0; 25: 687.7; 26: 625.5. Every headline measures 37.99 (two lines).

Section 8 "Not in the sample data" is superseded for departments, 360 (except section scores), themes and names.
