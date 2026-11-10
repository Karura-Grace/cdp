# PAC Africa Design System: Brand Book

Owner: Imran Issa, PAC Africa
Status: Rules 1 to 6 LOCKED (owner, 3 Nov 2026; see rules_locked.md). Rule 4 amended for tags (radius.pill) and Rule 6 for framework names by owner rulings 4 Nov 2026 (rules_locked.md lines to be added by the owner). Rule 4 panel fill and Rule 5 clear space amended by owner approval of group 1, 3 Nov 2026 (rules_locked.md line to be updated by the owner). The word DRAFT in rule headings below is historical.
Scope of the drafts: print A4 report (CDP full report, executive brief, facilitation guide). Product interface values come later.

## Working method

- Build the base system first. Page looks come only after the base is approved.
- Lock each rule group before starting the next.
- Copy logos, icons and fonts as files. Never approximate a mark.
- Never invent values. If a value is missing, ask.

## Brand name

Priority Activator Consulting, trading as PAC Africa. Short form: PAC.
Never use the Gordian Knotz name or marks anywhere, including client work.

## Rule 1: Colour (LOCKED)

| Token | Hex | Allowed use | Not allowed |
|---|---|---|---|
| color.brand | #EA5732 | Cover and section bands, primary buttons, rules, key figures, captions | Body text |
| color.ink | #131313 | All body text, table headers, code | Large background areas |
| color.muted | #727070 | Secondary text, footers, metadata, captions | Primary headings |
| color.paper | #FAF7F2 | Default page background | Brand bands |
| color.surface | #FBE9E3 | Callouts, light cards, table row banding | Text blocks longer than a line |
| color.accent-dark | #8F3A24 | Decorative diagonal bar only | Text, buttons, anything the reader must act on |

Accessibility rules:
- White text on color.brand only for large text (24px and up). Body text on orange uses the white logo or black text, whichever passes contrast.
- No colour carries meaning alone. Every status or severity also has a text label.

Data colour exception (locked in rules_locked.md, owner decision Q-D8-2): Engage #2E86C1, Innovate #6C3483, Perform #C0392B, Govern #58A55C for chart series only. Verdict tiles only: Hit #2F6F40, Partial hit #C77C0E, Miss #A93226.

### Measured contrast (WCAG ratios, computed 3 Nov 2026)

| Colour | on white | on paper | on surface | white text on it | ink text on it |
|---|---|---|---|---|---|
| brand | 3.55 | 3.33 | 3.02 | 3.55 | 5.23 |
| muted | 4.92 | 4.61 | 4.19 (fails small text) | | |
| engage | 3.97 | 3.71 | 3.37 | 3.97 (large only) | 4.69 |
| innovate | 8.55 | 8.00 | 7.27 | 8.55 | |
| perform | 5.44 | 5.09 | 4.63 | 5.44 | |
| govern | 3.02 | 2.83 (fails 3:1) | 2.57 (fails 3:1) | 3.02 (fails) | 6.15 |
| hit | 6.05 | 5.67 | 5.15 | 6.05 | |
| partial | 3.32 | 3.11 | 2.83 | 3.32 (large only) | 5.59 |
| miss | 6.62 | 6.20 | 5.63 | 6.62 | |

Consequences, carried into the draft rules below:
- Brand orange as text only at 14 pt bold or larger (large text, needs 3:1).
- Muted text only on white or paper, never inside surface panels.
- Govern fails 3:1 on paper and surface, so every filled data mark gets a 0.5 pt ink keyline and a direct label.
- Partial hit tile carries ink text, not white.

### DRAFT proposal: report page colour
Report inner pages on white #FFFFFF (new token color.white), not paper. Reasons: office printers cannot print to the edge, so a cream page prints with a white frame; white gives the data colours their best contrast (Govern passes 3:1 only on white); it matches the reference layout. Paper stays the default for screens and product interfaces. Needs owner decision.

---

## Rule 2: Typography (DRAFT)

Families: Georgia for prose (fallback Gelasio, metric compatible, open licence). Inter for headings, numbers, tables, charts, labels, header and footer. No third family.
Weights: Inter 400, 600, 700 only. Georgia Regular, Italic, Bold only.
Figures: all numbers in tables, charts, tiles and meters are set in Inter with tabular figures, because Georgia uses old style figures that do not align in columns. Numbers inside prose stay Georgia.

| Token | Family, weight | Size / leading (pt) | Case, tracking | Colour | Allowed for | Not allowed for |
|---|---|---|---|---|---|---|
| type.display | Inter 700 | 36 / 40 | Sentence | white on brand band, or ink | Cover title, back page | Inner pages |
| type.toc-title | Inter 700 | 32 / 36 | Sentence | ink | "Table of Contents" only | Anything else |
| type.chapter-number | Inter 700 | 16 / 16 | Figures | white on brand tile | Chapter number tile | Running text |
| type.chapter-title | Inter 700 | 12 / 14 | CAPS, +0.6 pt | white on ink bar | Chapter bar | Section headings |
| type.h1 | Inter 700 | 14 / 18 | Sentence | ink | Numbered section heading (3.1) | Body emphasis |
| type.h2 | Inter 600 | 11 / 14 | Sentence | ink | Sub section (3.1.1), item heads | Captions |
| type.headline | Inter 600 | 14 / 19 | Sentence | ink; the one number may be brand | Headline finding, one per page | More than two lines |
| type.body | Georgia 400 | 10 / 14 | Sentence | ink | All prose, findings, callout text | Tables, charts |
| type.body-strong | Georgia 700 | 10 / 14 | Sentence | ink | Lead in words, Finding/Evidence/Consequence/Action labels | Whole paragraphs |
| type.panel-title | Inter 700 | 8 / 10 | CAPS, +0.5 pt | ink | Chart panel titles, callout labels ("SO WHAT") | Headings outside panels |
| type.table-head | Inter 600 | 8 / 10 | Sentence | white on ink | Table header row | Body rows |
| type.table | Inter 400 | 8.5 / 11 | Sentence | ink | Table cells; 600 for first column and leading value | Prose |
| type.kpi-value | Inter 700 | 24 / 26 | Figures | ink, or white on ink or brand tile | KPI and verdict tile numbers | Running text |
| type.kpi-label | Inter 600 | 8 / 10 | CAPS, +0.5 pt | ink (also on brand tile) | Tile labels | Long text |
| type.chart | Inter 400 | 7 / 9 | Sentence | ink | Axis ticks, data labels, legends | Anything under 7 pt |
| type.caption | Georgia Italic | 8.5 / 12 | Sentence | muted on white or paper; ink inside panels | One line under a chart or table | Definitions longer than one line |
| type.running | Inter 400 | 7.5 / 10 | Sentence | muted | Header and footer | Body |

Rules:
- Minimum text size 7 pt anywhere.
- Prose is left aligned, ragged right. No justification and no automatic hyphenation (avoids rivers and breaks that read as hyphens).
- Brand coloured text only at 14 pt bold or larger: in practice the headline number. The page number is Inter 700, 9 pt, ink (orange at footer size fails contrast; the orange footer rule carries the brand).
- Capitals only for chapter titles, panel titles and tile labels. Never for sentences.
- Paragraph spacing 6 pt after, no first line indent.

## Rule 3: Spacing and grid (DRAFT)

Page: A4, 595.28 x 841.89 pt, portrait. Single sided (no mirrored margins).

| Token | Value (pt) | Meaning |
|---|---|---|
| page.margin.left / right | 48 | Side margins |
| page.margin.top | 72 | Top of content area |
| page.margin.bottom | 64 | Bottom of content area |
| content.width | 499.28 | 595.28 minus 96 |
| content.height | 705.89 | 841.89 minus 136 |
| header.baseline | 38 from top | Running header text |
| header.rule | 46 from top, 0.75 brand | Under header |
| header.logo.box | 72 x 18, top 24, right aligned to margin | Logo slot |
| footer.rule | 52 from bottom, 0.75 brand | Above footer |
| footer.baseline | 36 from bottom | Footer text |

Grid: 12 columns, column 26.94 pt, gutter 16 pt.
- Half (6 col): 241.64 pt. Used for chart panel pairs.
- Third (4 col): 155.76 pt. Used for verdict cards in threes, text beside small chart.
- Quarter (3 col): 112.82 pt. Used for four KPI tiles.
- Full: 499.28 pt. Tables, diverging bars, grouped bars, heatmap.

Spacing scale (pt): space.1 = 2, space.2 = 4, space.3 = 8, space.4 = 12, space.5 = 16, space.6 = 24, space.7 = 32, space.8 = 48. No other values.

| Use | Token |
|---|---|
| Label to its element, icon to text | space.2 (4) |
| Inside a block (title to chart, rows of a card) | space.3 (8) |
| Panel and card padding, table cell horizontal padding | space.4 (12); table cell vertical padding 4 |
| Between blocks on a page | space.5 (16) |
| Above a section heading (h1) | space.6 (24); 8 below |
| Chapter bar to first content | space.5 (16) |

Flow rules:
- Each chapter starts on a new page. Inside a chapter, blocks flow.
- No page below 60 percent filled unless it ends a chapter (owner rule).
- A heading never sits in the last 72 pt of a page; it moves with its block.
- Tables break between rows only, header row repeats, at least 3 rows on each side of a break.
- Chart panels, tiles, cards and callouts never break.
- Prose: at least 2 lines at the foot and head of a page.

## Rule 4: Radius and borders (DRAFT)

| Token | Value | Allowed for | Not allowed for |
|---|---|---|---|
| radius.0 | 0 pt | Chapter tile and bar, tables, table header, rules, heatmap cells | |
| radius.1 | 4 pt | Chart panels, KPI tiles, verdict cards, finding cards, callouts | Anything larger |
| radius.pill | 9999 pt (fully round) | Owner and timing tags only (owner ruling 4 Nov 2026, amends Rule 4 for tags) | Cards, panels, tiles, buttons, callouts |
| border.hair | 0.5 pt | Table row separators (muted tint #DDDDDD), chart gridlines, data mark keyline (ink) | Panel outlines |
| border.rule | 0.75 pt | Header and footer rules (brand), chart axes (ink), table bottom rule (ink) | |
| border.strong | 1.5 pt | Top rule of callouts and finding cards (brand) | Side borders |
| border.series | 1 pt | Outline of "Now" bars in the series colour | Interface |

Rules:
- No coloured left border cards. Callouts carry a full width top rule instead (avoids the common AI layout cliché and the DRAFT7 look).
- Chart panels, KPI tiles, verdict cards and finding cards are white #FFFFFF on the paper page, fill only, no outline (owner approved with group 1, 3 Nov 2026). Callouts and table banding stay surface.
- Tables: no vertical lines. Header row ink fill; body rows white and surface banding.
- Dense tables (7 or more columns): numeric cells padded 4 pt left and right; first column keeps 12 (approved 4 Nov 2026).
- Section heading (h1) number column: 28 pt, or the number width + 8 when wider, for example 12.1 (approved 4 Nov 2026).
- No shadows, no blur, no gradients, no transparency.
- Circles only for numbered markers (16 pt diameter) and chart dots.

## Rule 5: Logo and graphic elements (DRAFT)

Logo handling (no files supplied yet):
- Until files arrive, the logo slot holds plain type: "PAC Africa" in Inter 700, 10 pt, ink in the header; white, 14 pt on the cover band. Not a drawn mark, no imitation of the logo shape or colours.
- CDP is written as plain text "Culture Dynamics Profile". The CDP wordmark (orange full stop) is not imitated in type.
- Slots are fixed so files drop in without layout change: header 72 x 18 pt; cover 160 x 48 pt; back page 120 x 36 pt. Logo scaled by height, aspect locked, clear space equal to its height on all sides. Frame rules (header and footer rules) may sit inside a logo's clear space; content may not (owner approved with group 1, 3 Nov 2026).
- Colour logo on white or paper only; white logo on brand only.

Graphic elements:
- Chapter tile: 32 x 32 pt square, brand fill, number type.chapter-number centred. Joined to a 32 pt high ink bar running to the right margin, title inset 12 pt.
- Diagonal bar: accent-dark, cover and back page only, one per page. Angle and width to come from the brand book (TO BE CONFIRMED). Never on inner pages.
- Cover: brand band, no photograph (rights and raster). Facts block: respondents, assessment date, instrument.
- Icons: one set drawn as vector paths, 10 pt box, 1.25 pt stroke, round caps. Hit = check, Partial hit = half filled circle, Miss = cross, Watch = triangle with bar, Leading value = five point star. Ink on light grounds, white on dark tiles. No emoji, no font glyphs for icons.
- Orientation symbols: to be supplied (TO BE CONFIRMED). Not drawn by the agent.
- Watermark: off by default (switch). When on: "CONFIDENTIAL", Inter 700, 72 pt, 45 degrees, pre mixed colour #F4F4F4 (no transparency).

## Rule 6: Writing and tone for report text (DRAFT)

Allowed:
- Number first. Each page leads with one headline sentence that contains the number.
- Findings in four lines: Finding, Evidence, Consequence, Action (with owner and timing).
- Say what the data shows for this organisation, then what it means for it.
- Vary sentence shape with the result. Each item reads differently because each result differs.
- PAC terms only: Engage, Innovate, Perform, Govern; Culture Practitioner. No framework name on any client page (owner ruling 4 Nov 2026); phase plans use plain month ranges: Months 1 to 3, Months 4 to 9, Months 10 to 18, each with a short plain title.
- Counts zero to ten are words in prose; tables, charts and tiles keep numerals (approved 4 Nov 2026).
- Plain business English, short sentences, active voice, UK spelling.
- Captions: one line, what the chart shows, never how to read it.

Not allowed:
- Definitions or "how to read" boxes inside chapters (glossary only).
- "In short" as a heading. AI drafted readings are titled "Findings".
- Repeated sentence frames across items.
- Advice without this client's number. Generic advice is dropped.
- Dashes or hyphens in prose (brand names and codes excepted).
- Scoring formulas, thresholds, weights or calculation examples.
- Third party framework or instrument names.
- Hype words, stacked adjectives, filler openers.
- Invented dates, versions, figures or reference numbers; mark TO BE CONFIRMED.

## Assets (to be supplied)

- PAC logos: logo_color, logo_white, logo_badge
- Georgia embedding licence, or approval of Gelasio (font files needed; neither is installed on the build machine. Inter is installed.)
- CDP wordmark, SVG
- Orientation symbols, SVG
- Diagonal bar geometry

## Open decisions

- Orange and grey: brand book values used (#EA5732, #727070). CDP notes list #EB5733 and #706F6F. Brand book values stand unless told otherwise.
- Report page colour: white proposed (above).
- Diverging and heatmap colours: spec asks for negatives red and positives blue; locked rule limits blue to the Engage series. Owner to choose.

## Report rules approved 4 Nov 2026 (group 3 rulings)

- KPI targets follow the platform rule: 12 month = baseline + 10 percent of the absolute baseline, 18 month = + 20 percent, in the better direction, capped at the scale ends; baseline zero uses a share of the scale range. Higher is better for wanted shares, voice scores, readiness and leaders ready; lower is better for the Culture Risk Index and gaps. Note under the KPI table: "Targets are set by the platform and may be changed by the Culture Practitioner before release." Values in tokens.json `kpi-target`.
- Item agreement words: strong from 0.80, moderate from 0.60, weak below 0.60 ("read with care").
- Leadership 360 coverage: share of headcount led by leaders with a valid Leadership 360 result; the readiness score is marked provisional below 60 percent.
