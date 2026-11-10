# CDP report template: SPEC, group 1

Owner: Imran Issa, PAC Africa. Prepared by the PAC Design Agent, 3 Nov 2026.
Status: FOR REVIEW. Not approved. Group 2 does not start until this group is approved.
Sample client: Zendaro Group (fictional; Ostravane retired 4 Nov 2026). Data: cdp_report/report-sample-data.json, with the owner correction of 5 executives and 36 staff (cohorts block).

Files in this folder

| File | Page type | Pages |
|---|---|---|
| 01-page-frame.html | Running header and footer, grid (annotated) | 1 |
| 02-cover.html | Cover | 1 |
| 03-about.html | About this report, document control | 1 |
| 04-back-page.html | Back page, contact block | 1 |
| 05-contents.html | Table of Contents | 2 |
| 06-chapter-opener.html | Chapter opener, plus a variant sheet | 2 |
| 07-executive-summary.html | Executive summary | 2 |
| tokens.css | CSS variables and type classes generated from design_system/tokens.json | |
| build_group1.py | Generator: reads tokens.json and the sample data, writes the HTML | |
| render.py | Renders with Chromium, measures every block, writes preview PDF and PNG | |

The preview PDF printed by Chromium measures 594.96 x 841.92 because Chromium rounds to whole pixels; the HTML pages and this spec use the exact 595.28 x 841.89.

Logos are embedded as data URIs built from the supplied .base64 text files, bytes unchanged (the memory store refuses binary files). Open any HTML file in a browser; print to PDF gives exact A4.

---

## 0. Conventions

- Units are points (pt). Origin is the top left corner of the page, as in pdfkit. x, y is the top left of a box; w, h its size.
- Page: 595.28 x 841.89. Content box: x 48 to 547.28, y 72 to 777.89 (499.28 x 705.89).
- Text boxes: y is the top of the first line box. Line box height is the token leading.
- Colours are token names from tokens.json. Hex is given once in section 9.
- Measured values come from Chromium with Inter and Gelasio installed (Gelasio is metric compatible with Georgia, so line breaks match). Table rows render 0.25 to 0.75 pt taller in the browser because of the 0.5 hairline; pdfkit should use the designed values.

### 0.1 Placing text in pdfkit so it matches the HTML

pdfkit draws text with y at the top of the font's ascender and adds `lineGap` after each line.

```
h        = natural line height per pt of size: Inter 1.2100, Georgia 1.1362, Gelasio 1.2695
lineGap  = leading - size * h
y_pdfkit = y_box + (leading - size * h) / 2
baseline = y_pdfkit + size * ascender     (Inter 0.96875, Georgia 0.9170, Gelasio 0.9277)
```

Example: header text 7.5/10 with y_box 30.27 gives y_pdfkit 30.73 and baseline 38.00.
Inter numbers: pass `features: ['tnum']`. Tracking: `characterSpacing` (0.6 for chapter titles, 0.5 for panel titles and tile labels). Caps: uppercase the string in code.

---

## 1. Page frame (inner pages: About, Contents, every chapter page)

| Block | x | y | w | h | Font, size/leading | Colour | Fills from | Long text / missing data |
|---|---|---|---|---|---|---|---|---|
| Header text | 48 | 30.27 (baseline 38) | 435.14 | 10 | type.running: Inter 400, 7.5/10 | muted | `{organisation} · Culture Dynamics Profile` | One line. If wider than 435.14, use `organisation_short` (new platform field); if absent, cut with an ellipsis. Never wraps. |
| Header logo | 499.14 | 24 | 48.13 | 18 | pac-logo-colour.png, scaled by height | as supplied | asset | Never omitted. If the file fails to load, the build stops. |
| Header rule | 48 | 46 (centre line) | 499.28 | 0.75 | border.rule | brand | | |
| Footer rule | 48 | 789.89 (centre line) | 499.28 | 0.75 | border.rule | brand | | |
| Footer text | 48 | 798.16 (baseline 805.89) | 380 | 10 | type.running | muted | `Confidential. Prepared for {organisation} · Released {release_date}` (locked wording) | Missing date prints `Released (to be confirmed)`. A report marked final cannot be built without a date. If wider than 380, use `organisation_short`. |
| Page number | 447.28, right aligned to 547.28 | 797.62 (baseline 805.89) | 100 | 10 | Inter 700, 9/10, tnum | ink | `Page {n} of {N}` | N comes from the final pass (see 8.2). |

Rules:
- Cover and back page carry no frame. Every other page does, including Contents and About.
- Page background is paper on every inner page (owner default). Charts, tiles and cards sit on white panels.
- Watermark: off (switch). When on: "CONFIDENTIAL", Inter 700, 72 pt, 45 degrees, #F4F4F4, drawn first so content sits on top.
- Grid: 12 columns of 26.94 with 16 gutters. Column n starts at `x = 48 + (n - 1) * 42.94`. Half 241.64, third 155.76, quarter 112.82.

---

## 2. Cover (page 1)

Background: paper. No frame.

| Block | x | y | w | h | Font, size/leading | Colour | Fills from | Long text / missing data |
|---|---|---|---|---|---|---|---|---|
| Orange band | 0 | 0 | 595.28 | 400 | | brand | | Fixed. Full bleed (see 8.4 on printers). |
| Diagonal bar (PROPOSED) | polygon (467.28, 400), (501.22, 400), (595.28, 305.94), (595.28, 272) | | 24 wide at 45 degrees | | | accent-dark | | Fixed. One per page. Not drawn until approved (switch `cover.diagonal`). |
| White logo | 48 | 48 | 128.00 | 48 | pac-logo-white.png, scaled by height | as supplied | asset | Clear space 48 above and left (page edge). |
| "PREPARED FOR" | 48 | bottom anchored, see client block | 403.28 | 10 | type.kpi-label: Inter 600, 8/10, caps, +0.5 | ink (5.23:1 on brand) | fixed text | |
| Client name | 48 | bottom of block at 352; one line sits at 312 | 403.28 | 40 per line | type.display: Inter 700, 36/40 | white (3.55:1, large text) | `organisation` | Grows upward, max 2 lines (top 272). Label sits 4 above the first line. If 3 lines would be needed, use `organisation_short`. Type never shrinks. Width keeps 16 clear of the diagonal bar. |
| CDP wordmark | 48 | 448 | 123.81 | 48 | cdp-wordmark.png, scaled by height | as supplied | asset | On paper only: its orange dot vanishes on the band and recolouring is not allowed. Clear space 48 above (to band) and below. |
| Report type | 48 | 544 | 360 | 18 | type.h1: Inter 700, 14/18 | ink | `report_type` ("Full assessment report", "Executive brief") | One line. |
| Facts rule | 48 | 632 (centre line) | 499.28 | 0.75 | border.rule | brand | | |
| Fact columns (4) | 48, 176.82, 305.64, 434.46 | 644 | 112.82 each | up to 70 | see below | | | |
| Fact label | column x | 644 | 112.82 | 10 | type.kpi-label | ink | fixed: RESPONDENTS, ASSESSMENT DATE, INSTRUMENT, REFERENCE | |
| Fact value | column x | 658 | 112.82 | 14 per line | type.h2: Inter 600, 11/14, tnum | ink; muted when missing | see table below | Max 2 lines (Instrument uses 2). |
| Fact caption | column x | value bottom + 4 | 112.82 | 12 per line | type.caption: Georgia Italic 8.5/12 | muted (4.61:1 on paper) | see table below | Max 2 lines. Block bottom never below 714. |
| Bottom left | 48 | 798.16 (baseline 805.89) | 240 | 10 | type.running | muted | "Confidential" (classification) | |
| Bottom right | 307.28, right aligned | 798.16 | 240 | 10 | type.running | muted | "www.pac.africa" | |

Facts content

| Fact | Value | Caption | Sample | Missing |
|---|---|---|---|---|
| Respondents | `{submitted} of {invited} invited` | `{executive.n} executives, {staff.n} staff` | 41 of 45 invited; 5 executives, 36 staff | If invited is missing: `{submitted} responses` |
| Assessment date | `assessment_date`, format "3 November 2026" | "Supplied by the platform" when missing, else blank | To be confirmed (not in sample data) | Value "To be confirmed" in muted |
| Instrument | "Culture Dynamics Profile" | "Four orientations, six dimensions" | fixed | No framework name on client pages (owner ruling, 4 Nov 2026) |
| Reference | `PAC/CDP/RPT/{NNN}` | "Number supplied by the platform" when missing | PAC/CDP/RPT/NNN | Shows NNN; final build refuses NNN |

---

## 3. About this report (page 2)

Frame on. Content is one flow from y 72; positions below are the measured sample.

| Block | x | y | w | h | Font, size/leading | Colour | Fills from | Long text / missing data |
|---|---|---|---|---|---|---|---|---|
| Title | 48 | 72 | 499.28 | 18 | type.h1 | ink | fixed "About this report" | |
| Intro | 48 | 98 (title + 8) | 327.52 (8 columns) | 90 (two paragraphs) | type.body: Georgia 10/14, 6 after paragraph | ink | fixed copy with `{organisation}` | Grows down; everything below moves. |
| "Document control" | 48 | 212 (intro + 24) | 499.28 | 14 | type.h2: Inter 600, 11/14 | ink | fixed | |
| Document control table | 48 | 234 (h2 + 8) | 499.28 | 18 + 7 rows | header type.table-head on ink; cells type.table, first column 600 | white on ink; ink on white and surface | see below | Rows grow by 11 per extra line. Never breaks (7 rows). |
| "Participation" | 48 | 414 (table + 24) | 499.28 | 14 | type.h2 | ink | fixed | |
| Participation tiles (4) | 48, 176.82, 305.64, 434.46 | 436 (h2 + 8) | 112.82 | 92 | KPI tile, tone white (section 7.3) | | invited, submitted, executive.n, staff.n | Missing count: value "No data", caption says why. |
| Quality paragraph | 48 | 544 (tiles + 16) | 327.52 | 42 | type.body | ink | `quality.states.COMPLETE`, sum of `quality.flags`, `quality.median_duration` (seconds, shown as rounded minutes) | If any flag is above 0: "{n} responses were flagged for ..." |
| "Confidentiality" | 48 | 610 (paragraph + 24) | 499.28 | 14 | type.h2 | ink | fixed | |
| Confidentiality text | 48 | 632 | 327.52 | 42 | type.body | ink | fixed copy with `{organisation}` | |

Sample bottom 674; page fill 85 percent.

Document control table (owner fields plus reference)

| Column | Width | Cell padding | Rows |
|---|---|---|---|
| Field | 120 | 12 left/right, 4 top/bottom | Reference, Organisation, Report, Audience, Released, Prepared by, Classification |
| Detail | 379.28 | same | `PAC/CDP/RPT/{NNN}`, `organisation`, "Culture Dynamics Profile, {report_type}", `audience`, `release_date`, "Priority Activator Consulting (PAC Africa). Culture Practitioner: {practitioner_name}", `classification` (default "Confidential") |

Table style (all tables): header row 18 high, ink fill, no vertical lines; body rows 19 for one line (4 + 11 + 4), +11 per extra line; rows alternate white, surface (first body row white); 0.5 hairline #DDDDDD (chart.gridline) between body rows; 0.75 ink rule under the last row. Missing values print "To be confirmed" in ink (muted fails on surface at 4.19:1).

---

## 4. Back page (last page)

Background: brand, full page. No frame.

| Block | x | y | w | h | Font, size/leading | Colour | Fills from | Notes |
|---|---|---|---|---|---|---|---|---|
| White logo | 48 | 48 | 96.00 | 36 | pac-logo-white.png | as supplied | asset | Back slot 120 x 36. |
| Diagonal bar (PROPOSED) | polygon (467.28, 841.89), (501.22, 841.89), (595.28, 747.83), (595.28, 713.89) | | 24 wide, 45 degrees | | | accent-dark | | Same geometry as the cover, anchored to the page foot. |
| Tagline | 48 | 560 | 420 | 80 (2 lines) | type.display 36/40 | white | fixed "Consulting Built for / Real World Impact" | Break after "for" is fixed. |
| Company name | 48 | 664 | 260 | 14 | type.h2 | ink | fixed "Priority Activator Consulting" | |
| Contact block | 48 | 682 | 260 | 56 (4 lines) | type.body: Georgia 10/14 | ink (5.23:1) | fixed: Suite E2, 1st Floor, Jasmine Centre / Westlands, Nairobi / info@pac.africa / www.pac.africa | Bottom at 738, inside the 777.89 content line. |

---

## 5. Table of Contents (pages 3 and 4)

Frame on.

| Block | x | y | w | h | Font, size/leading | Colour | Fills from | Notes |
|---|---|---|---|---|---|---|---|---|
| Title | 48 | 72 | 499.28 | 36 | type.toc-title: Inter 700, 32/36 | ink | fixed "Table of Contents" | First contents page only. |
| First block, page 3 | | 132 (title + 24) | | | | | | |
| First block, page 4 | | 72 | | | | | | |
| Number tile | 48 | block top | 32 | 32 | type.chapter-number: Inter 700, 16/16, centred | white on brand | chapter number "01" to "13", "ES", "A" to "D" | |
| Chapter row | 92 (tile + 12) | block top + 7 | 455.28 | 18 | type.h1: Inter 700, 14/18 | ink | chapter title | One line. Page number right aligned to 547.28, same type, tnum. |
| Sub row | 92 | block top + 36, then every 15 | 455.28 | 11 | type.table: Inter 400, 8.5/11 | ink | sub section number (28 wide column, tnum) and title | One line each. Page number right aligned, tnum. |
| Dotted leader | title end + 4 | on the baseline | to page number - 4 | | dots 0.9 diameter every 3 | muted | | pdfkit: line with `lineWidth(0.9)`, `lineCap('round')`, `dash(0.01, {space: 3})`. |
| Gap between blocks | | 12 | | | | | | |

Block height = 32 when there are no sub rows, else 32 + 4 + 15 x sub rows.

Sample block tops: page 3: ES 132, 01 225, 02 269, 03 347, 04 440, 05 533, 06 641 (bottom 707). Page 4: 07 72, 08 150, 09 228, 10 306, 11 369, 12 413, 13 506, A 584, B 628, C 672, D 716 (bottom 748). Fill: 89 and 96 percent.

Rules:
- A chapter block never splits. If it does not fit above 777.89, it starts the next page.
- Contents may use up to 3 pages; the build reserves 2 and warns if a third is needed.
- Rows come from the heading tree of the laid out report; page numbers from the layout pass (8.2).
- Titles longer than the row (about 50 characters for chapters, 85 for sub rows) raise a build warning; they are not wrapped or shrunk.
- Sub section names and page numbers in the sample are planned values from the brief, not platform data.

---

## 6. Chapter opener

| Block | x | y | w | h | Font, size/leading | Colour | Fills from | Long text / missing data |
|---|---|---|---|---|---|---|---|---|
| Number tile | 48 | 72 | 32 | 32 | type.chapter-number, centred | white on brand | `chapter.number` | |
| Title bar | 80 | 72 | 467.28 | 32 | type.chapter-title: Inter 700, 12/14, caps, +0.6; inset 12 left and right; centred vertically | white on ink | `chapter.title` | One line up to 443.28 wide. If longer: 2 lines, tile and bar both become 48 high (variant B). Never 3 lines. |
| Headline finding | 48 | 120 (bar + 16) | 499.28 | 19 per line, max 2 | type.headline: Inter 600, 14/19 | ink | `chapter.headline` (consultant accepted) | Over 2 lines: build warning. Missing: the block is left out and content starts at 120. |
| Content start | 48 | 174 (headline + 16) | | | | | group 2 blocks | |

Variant A, part label (optional): symbol slot 24 x 24 at (48, 104), label type.kpi-label ink at (80, 111), opener moves down to y 136. The symbol files are not supplied, so the slot stays empty and the label prints alone, starting at x 48.
Each chapter starts on a new page.

---

## 7. Executive summary (pages 5 and 6)

### 7.1 Page 5 layout

| Block | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Chapter opener | 48 | 72 | 499.28 | 32 | number "ES", title "Executive summary" |
| Headline | 48 | 120 | 499.28 | 38 | type.headline, 2 lines |
| KPI tiles | 48, 176.82, 305.64, 434.46 | 174 | 112.82 | 102 | 7.3 |
| Chart panel 1, Culture at a glance | 48 | 292 | 241.64 | 235 | 7.4 |
| Chart panel 2, Shift from Now to Preferred | 305.64 | 292 | 241.64 | 235 | 7.5 |
| "Key indicators" | 48 | 543 | 499.28 | 14 | type.h2 |
| KPI table | 48 | 565 | 499.28 | 179 (sample) | 7.6 |

Sample bottom 744; fill 95 percent.

Headline sample: "Perform leads the culture at 29.64 points, yet people want Engage to rise by 11.34 points, and only 1 of 4 strategy checks is a full hit." Fields: `orientation_scores.now[dominant]`, `orientation_scores.gap[largest absolute]`, count of `evaluation.checks` equal to HIT.

### 7.2 Page 6 layout

| Block | x | y | w | h (sample) |
|---|---|---|---|---|
| "The Big Three" | 48 | 72 | 499.28 | 18 (type.h1) |
| Finding card 1 | 48 | 98 | 499.28 | 185.5 |
| Finding card 2 | 48 | 299.5 | 499.28 | 185.5 |
| Finding card 3 | 48 | 501 | 499.28 | 185.5 |
| So what callout | 48 | 702.5 | 499.28 | 67.5 |

Gap between cards 16. Sample bottom 770; fill 99 percent.

### 7.3 KPI tile

| Part | Offset in tile | Size | Font | Colour (white tile / brand tile / ink tile) |
|---|---|---|---|---|
| Tile | | 112.82 x 102 (92 when every label fits one line) | radius 4, padding 12, no outline | white / brand / ink |
| Label | 12, 12 | 88.82 x 20 (2 lines reserved) | type.kpi-label | ink / ink / white |
| Value | 12, 36 | 88.82 x 26 | type.kpi-value: Inter 700, 24/26, tnum | ink / white (3.55:1, large) / white |
| Caption | 12, 66 | 88.82 x 24 (2 lines) | type.caption: Georgia Italic 8.5/12 | ink / ink / white |

Sample tiles

| Label | Value | Caption | Fields | Tone |
|---|---|---|---|---|
| LEADING ORIENTATION | 29.64 | Perform, 5.59 points ahead of Engage | `orientation_scores.now`, `dominance.dominant`, `dominance.secondary` | white |
| LARGEST SHIFT WANTED | +11.34 | Engage, from 24.05 to 35.39 | `orientation_scores.gap` (largest absolute), `.now`, `.preferred` | white |
| STRATEGY CHECKS MET | 1 of 4 | 1 hit, 2 partial hits, 1 miss | `evaluation.checks` | brand (the focal point of the page) |
| CULTURE RISK INDEX | 50 | Medium band; lower is better | `analytics.risk.index`, `.band` | white |

Rules: one brand tile per page at most. All four tiles share the height of the tallest. Value max 6 characters; captions use no break spaces between a number and its word (pdfkit honours U+00A0). Missing value: "No data" in type.h2, caption says why ("Below reporting threshold" or "Not measured"); the tile stays so the row keeps four.

### 7.4 Chart panel 1: Culture at a glance

Panel: white, radius 4, padding 12, no outline. Title type.panel-title (Inter 700, 8/10, caps, +0.5, ink) at (60, 304). Plot area (60, 322) to (277.64, 498). Legend row at y 506, type.chart (Inter 400, 7/9, ink).

| Element | Value |
|---|---|
| Centre | (168.82, 410) |
| Axes | Engage to the upper left, Innovate upper right, Perform lower right, Govern lower left (fixed order) |
| Scale | 0 to 40 points; 1 point = 2.25 along an axis; tip of each axis at 63.64 in x and y from the centre |
| Grid | squares for 10, 20, 30, 40: half sides 15.91, 31.82, 47.73, 63.64; 0.5 chart.gridline; axis lines 0.5 chart.gridline |
| Even share line | square at 25 (half side 39.77), 0.5 chart.reference.line (ink), dash 2 on 2 |
| Now shape | polygon through the four Now values, 1.0 muted, dash 3 on 2, no fill; points: circle r 2, white fill, 1.0 muted stroke |
| Preferred shape | polygon through the four Preferred values, 1.5 brand, no fill; points: circle r 2.5, brand fill, 0.5 ink keyline |
| Axis labels | 80 x 18 boxes centred on each tip: upper labels end 4 above the tip, lower labels start 4 below. Line 1 name (Inter 600, 7), line 2 "{now} to {preferred}" (Inter 400, 7, tnum) |
| Legend | "Now" dashed muted, "Preferred" brand, "Even share, 25" dashed ink; swatch 12 long, 4 to label, 12 between items |

Fields: `orientation_scores.now`, `orientation_scores.preferred`.
Empty state: grid and axes drawn, no shapes, centred type.body ink "No results yet". Partial (an orientation missing): its point is left out and its label reads "Not reported"; the shape becomes a line. Values above 40: scale moves to 0 to 50 (square step stays 10).

### 7.5 Chart panel 2: Shift from Now to Preferred

Panel as 7.4, at x 305.64. Title at (317.64, 304). Plot area (317.64, 322) to (535.28, 498).

| Element | Value |
|---|---|
| Name column | x 317.64, width 52, type.chart, Inter 600 |
| Zero line | x 452.46, y 322 to 470, 0.75 chart.axis (ink) |
| Scale | minus 15 to plus 15 points over x 397.64 to 507.28; 1 point = 3.655 |
| Gridlines | at plus and minus 5, 10, 15; 0.5 chart.gridline |
| Bars | height 12, tops at 330, 366, 402, 438 (pitch 36), fixed order Engage, Innovate, Perform, Govern; fill data.{orientation}; 0.5 ink keyline |
| Value labels | type.chart tnum, 4 outside the bar end: "+11.34", "+8.91", "−10.15", "−10.10" (true minus sign U+2212) |
| Tick labels | "−10", "0", "+10" centred under ticks at y 474 |
| End labels | "Want less" left at x 393.64, "Want more" right aligned to 511.28, y 486 |
| Caption row | y 506, "Points between Now and Preferred, by orientation", type.chart ink |

Fields: `orientation_scores.gap`. Bars keep orientation colours. The owner's diverging red and blue default is for employee voice and the heatmap, where the bars are not orientations.
Empty: zero line only plus "No results yet". Values beyond 15: scale grows to the next multiple of 5.

### 7.6 KPI table

Position (48, 565), width 499.28. Columns: Indicator 116, Score 52 (right aligned, tnum), Rating 108, Meaning 223.28. Style as section 3.

| Indicator | Score | Rating (icon + word) | Meaning (sample) | Fields |
|---|---|---|---|---|
| Culture strength | 4.64 | Diffuse | Perform leads Engage by only 5.59 points. | `culture_strength`, `strength_band` |
| Largest culture gap | +11.34 | Significant | More Engage wanted; less Perform and Govern. | `orientation_scores.gap`, `analytics.gap_bands` |
| Strategy congruence | 33.3% | Fragmented | Practice leans Perform, strategy Govern, leadership Engage. | `congruence.dimension_pct`, `.band`, `.lens` |
| Perception gap | 7.23 | Watch icon + Shadow culture | Executives put Engage at 30.40, staff at 23.17. | `perception_gap`, `perception_flags`, `cohorts.*.now` |
| Change readiness | 3.33 | Enablement required | Readiness scores run from 3.20 to 3.40; support before scale. | `readiness.tps`, `.tps_band`, `.d7`, `.d8`, `.d9` |
| Culture Risk Index | 50 | Medium | Spread of answers, at 64, drives it most. | `analytics.risk` |
| Employee voice index | 3.4 | Watch icon + 4 of 8 negative | Detractors lead on 4 of the 8 voice scores. | `eos`, `eos_detail` |

Rating rules: band words come from the platform in sentence case. The Watch icon marks rows tied to a CRITICAL finding; icon and word are ink (verdict colours are for tiles only). Icon box 10 x 10, 4 before the word, sitting on the text line.
Long text: meaning up to 2 lines (3 allowed, build warning). Missing score: "No data" in the score cell, rating "Not measured", meaning left blank. Page break: if the table would cross 777.89 it moves whole to the top of page 6 and the Big Three follow it (7 rows cannot split 3 and 3 plus a header).

### 7.7 Finding card (Big Three)

| Part | Position in card | Size | Font | Colour |
|---|---|---|---|---|
| Card | x 48, full width | 499.28 x content | white fill; top rule 1.5 brand (border.strong); top corners square, bottom corners radius 4; padding 12 | |
| Left column | 12, 13.5 | 100.82 wide | | |
| Verdict tile | left column top | 100.82 x 24, radius 4, padding 0 8 | icon 10 + 4 + word in type.kpi-label | Hit: verdict.hit fill, white. Partial hit: verdict.partial fill, ink. Miss: verdict.miss fill, white. Flag (not a strategy check): ink fill, white |
| Number | tile + 8 | 26 | type.kpi-value, tnum | ink |
| Number label | number + 4 | up to 2 lines of 10 | type.kpi-label | ink |
| Right column | x 176.82 | 358.46 wide | | |
| Title | top | 14 per line | type.h2 | ink |
| Four rows | title + 8, then 4 between rows | label column 76, gap 8, text column 274.46 | label type.body-strong (Georgia Bold 10/14); text type.body | ink |

Card height = 1.5 + 12 + max(left column, right column) + 12. Sample: 185.5 each.

| Field | Card 1 | Card 2 | Card 3 |
|---|---|---|---|
| Source | fnd_0001, C1, verdict MISS, CRITICAL | fnd_0005, PERCEPTION_GAP, SHADOW_CULTURE, CRITICAL | fnd_0006 to fnd_0009, ENGAGEMENT_MISS, CRITICAL |
| Tile | Miss, cross icon | Shadow culture, Watch icon, ink | Watch, Watch icon, ink |
| Number and label | 22.88, INNOVATE NOW, LAST OF FOUR | 7.23, POINTS APART ON ENGAGE | 4 of 8, VOICE SCORES BELOW ZERO |
| Finding, Evidence, Consequence | from scores (see HTML) | scenario SC-05 risks | `eos`, `eos_detail` |
| Action, owner, timing | sample wording | sample wording | sample wording |

Selection: critical findings first, then high, ordered by severity then blocking; one card per finding type (the four voice flags make one card). Fewer than three qualifying findings: show only those, no filler.
Long text: each row up to 3 lines; above that the build warns and does not shrink type. Cards never split; a card that would cross 777.89 moves to the next page.
Missing owner or timing: prints "Owner: to be confirmed".
Never shown on a card: thresholds, requirement values, override codes, alignment percentages (they would let a reader work back to the scoring rules).

### 7.8 So what callout

Surface fill, 1.5 brand top rule, top corners square, bottom radius 4, padding 12. Label "SO WHAT" type.panel-title ink; text type.body ink, 4 below the label, max 2 lines (text width 475.28). Sample height 67.5. Never splits.

---

## 8. pdfkit build notes

### 8.1 What pdfkit draws natively
Rectangles, rounded rectangles, custom paths (square top and rounded bottom corners via `moveTo`, `lineTo`, `bezierCurveTo`), polygons (diagonal bar, map shapes), dashed and dotted lines, circles, PNG images with alpha, TrueType and OpenType fonts with `features`, `characterSpacing`, `lineGap`, text width measuring (`widthOfString`, `heightOfString`).

### 8.2 Needs a two pass build
- "Page n of N" and the Contents page numbers. Use `bufferPages: true`, lay out the report, then `switchToPage(i)` to draw footers and the Contents rows. Reserve 2 Contents pages up front.

### 8.3 What pdfkit cannot do, and the replacement
| In the HTML | pdfkit | Replacement |
|---|---|---|
| Dotted leaders made with a CSS radial gradient | No gradients | Round capped dashed line (8 section 5) |
| Flex and grid layout, margin collapsing | No layout engine | Positions in this spec; heights from `heightOfString` |
| Automatic table layout | None | Fixed column widths in this spec; row height = 8 + 11 x lines |
| `text-transform: uppercase` | None | Uppercase in code |
| Inline icon inside a text line | No inline images | Draw the 10 pt icon path at the line position, then the word 14 to the right |
| Gelasio as Georgia fallback | fontkit does not apply variable font axes reliably | Make static Gelasio Regular, Italic, Bold with fontTools instancer, or license Georgia (open item) |
| Tagged PDF for screen readers | Partial (`tagged: true`, structure API) | Tag headings, tables and figures; set `lang: 'en-GB'` and document title |

Nothing in group 1 uses blur, shadows, gradients, transparency or photographs.

### 8.4 Print
The cover band and back page bleed to the edge. Office printers leave a white edge of about 12; print shops need 3 mm bleed (8.5 pt). Proposal: the PDF build has a `bleed` switch that extends the band and back page fill by 8.5 pt and adds crop marks.

---

## 9. Tokens used

Colours: brand #EA5732, ink #131313, muted #727070, paper #FAF7F2, surface #FBE9E3, accent-dark #8F3A24, white #FFFFFF, data.engage #2E86C1, data.innovate #6C3483, data.perform #C0392B, data.govern #58A55C, verdict.hit #2F6F40, verdict.partial #C77C0E, verdict.miss #A93226, chart.gridline #DDDDDD, chart.axis and chart.reference.line #131313.
Spacing used: 4, 8, 12, 16, 24, 32, 48 only. Radius: 0 and 4. Borders: 0.5, 0.75, 1, 1.5.

Contrast pairs used (WCAG): muted on paper 4.61; ink on paper 17.39; ink on white 18.58; ink on surface 15.81; white on ink 18.58; ink on brand 5.23 (labels, contact, captions on the brand tile); white on brand 3.55, used only at 24 pt and above (display, tile value); white on verdict.miss 6.62; white on verdict.hit 6.05; ink on verdict.partial 5.59; brand line on white 3.55; govern bar on white 3.02 with ink keyline and direct label.

---

## 10. Proposed tokens and rules (need approval, not yet in tokens.json)

1. `type.pagenum`: Inter 700, 9/10, ink. The rule exists in the README text but not in tokens.json.
2. `element.logo-slot.cdp-cover`: 48 high (123.81 x 48), on paper only.
3. `element.cover-band`: height 400; client block bottom anchored at 352, width 403.28.
4. `element.diagonal-bar`: 45 degrees, 24 wide, accent-dark, anchored at x 467.28 on the band foot (cover) or page foot (back). Angle taken from the logo X strokes (measured 43 to 44 degrees).
5. `element.toc`: tile 32, row inset 12, sub pitch 15, sub number column 28, block gap 12, leader dot 0.9 every 3, muted.
6. `element.verdict-tile`: 24 high, radius 4, padding 0 8; flag variant ink with white.
7. `panel.fill`: white (owner default). Rule 4 still says panels are surface; callouts stay surface.
8. Cards and callouts with a top rule: top corners square, bottom corners 4.
9. `chart.map`: Now 1.0 muted dash 3 on 2; Preferred 1.5 brand; even share 0.5 ink dash 2 on 2.
10. `chart.diverging`: update to the owner default (negative #C0392B, positive #2E86C1). tokens.json still shows the earlier option.

## 11. Conflicts and open items

- Header logo clear space: Rule 5 asks for clear space equal to the logo height (18), but the locked header rule sits 4 below the logo box. Built as locked. Proposal: frame rules may sit inside a logo's clear space; content may not.
- Sample data file: the respondents block still reads 10 executives and 31 staff. Built with 5 and 36 from the cohorts block, per the owner.
- rules_locked.md still labels the defaults "owner to confirm"; treated as confirmed per the owner's message. README and tokens.json status lines still say DRAFT.
- Brief section 3 lists page numbers in brand; locked Rule 2 says ink. Built in ink.
- Culture map: no method for map coordinates or the stepping stone route exists in the files. The panel uses a four axis map of real Now and Preferred scores. Replace when the platform supplies coordinates.
- Executive summary fits 2 pages, not 3 as in the brief. Contents numbering assumes 44 pages.
- Not in the data, shown as to be confirmed: assessment date, release date, audience, Culture Practitioner name, reference number.
- Sample wording, not data: Action lines, owners and timings on finding cards; Contents sub section names and page numbers.
- Field meaning to confirm: `congruence.dimension_pct` shown as "33.3%"; scale of `culture_strength` (4.64) and `eos.index` (3.4).
- Voice category names (Q1 to Q8) are not in the sample data, so the copy avoids naming them.
- Orientation symbols and Georgia licence are still outstanding.

## Zendaro refresh (4 Nov 2026, Task A of stage 5)

Layouts unchanged. Data, names and page plan only. Re-rendered and re-measured with render.py; page size 595.28 x 841.89 on every page.

| Item | Was | Now |
|---|---|---|
| Client | Ostravane Logistics 7 | Zendaro Group (from `organisation`) |
| Footer total | Page n of 41 | Page n of 40 (final plan, SPEC-group-3 section 1) |
| Cover fact 3 caption | Diagnose stage, 4D Framework | Four orientations, six dimensions |
| About, intro paragraph 2 | 4D Framework sentence | "Each chapter leads with a finding, shows the evidence behind it and ends with what it means for {client}." (same one line slot) |
| ES headline | "only 1 of 4 strategy checks" | counts as words: "only one of four" (approved rule 5) |
| Big Three card 3, Finding | "the lowest stands at minus 29" | names the score: "the lowest, innovation climate, stands at minus 29" (from `names.voice`) |
| Big Three card 3, Evidence | "and 7 promoters" | "and seven promoters" |

Contents rows (40 page plan): ES 5; 01 7; 02 8; 03 9; 04 12; 05 15; 06 17; 07 18; 08 20; 09 22 (9.1 22, 9.2 23); 10 25 (10.1 The collective leadership pattern 25); 11 26; 12 27 (12.1 Priorities 27, 12.2 Quick wins, first 30 days 29, 12.3 Phase plan 30, 12.4 Change principles 31); 13 32 (13.1 Baseline and targets 32, 13.2 Governance 33); A Data tables 34; B Cohorts and method 36; C Glossary 37; D Working through the report 39. Chapter 12 gained one sub row (+15 pt); both Contents pages still fit (page 3 bottom 751, page 4 bottom 685).

Measured bottoms after refresh: About 674.2; ES page 5 743.7; ES page 6 770.0 (limit 777.89).
