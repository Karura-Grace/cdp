# CDP report template: SPEC, group 4 (other outputs: brief, deck, staff guide)

Owner: Imran Issa, PAC Africa. Prepared by the PAC Design Agent, 4 Nov 2026. Status: FOR REVIEW, not approved.
Sample: Zendaro Group (fictional). Generator: build_group4.py (imports build_group3). Tokens: tokens.json only; one new deck type scale proposed in section 2.

| File | Output | Size |
|---|---|---|
| 29-executive-brief.html | Executive brief, page 1: cover strip and one page summary | A4 595.28 x 841.89 |
| 30-deck-16x9.html | Deck: title slide, finding slide with chart, table slide | 960 x 540 pt |
| 31-staff-guide.html | Staff conversation guide, one content page | A4 |

## 1. Executive brief (A4, 5 pages for the sample)

Plan: p1 cover strip + one page summary; p2 culture now and gap (report chart pair 03 + gap table); p3 strategy checks and readiness (verdict cards + gauges); p4 priorities (report priority cards, compact) and KPI table with the platform target note; p5 back page (report back page). Range 4 to 6: add p5 "Departments and voice" when a department or voice flag exists. Pages 2 to 5 reuse report blocks unchanged; only page 1 is new.

### Page 1 (built; flow bottom 771.9, limit 777.89)
| Block | x, y | Size | Type, colour | Data |
|---|---|---|---|---|
| Cover strip | 0, 0 | 595.28 x 152, brand fill | | |
| White logo | 48, 28 | h 36 (w 96), whole file | pac-logo-white | |
| "CULTURE DYNAMICS PROFILE" | right aligned to 547.28, top 40 | 200 wide | type.kpi-label ink on brand (5.23:1) | fixed |
| "EXECUTIVE BRIEF" + client | 48, bottom anchored at 132 | 440 wide | label type.kpi-label ink; client type.display white 36/40 (large text, 3.55:1) | `organisation` |
| No running header on page 1 | | | footer rule, footer line "Confidential. Executive brief for {client} · Released {date}", "Page 1 of N" | |
| Flow | 48, 176 | 499.28, gap 16 | | |
| Headline | | 2 lines max (38) | type.headline, one brand number (largest gap) | |
| KPI tile row | | 4 x 112.82, gap 16 | report KPI tile, all white (no brand tile: the brand number is in the headline) | leading orientation, largest gap, checks met, Culture Risk Index |
| "Three things to act on" | | h2 + 8 | type.h2 | |
| Brief finding row (x3) | | 499.28 x auto (sample 97 to 111), white card, 1.5 brand top rule, padding 12, gap 8 | left 112.82: verdict tile 24 + number type.kpi-value + label type.kpi-label; right: owner and timing pills (radius.pill) first, then title type.h2, then one finding sentence type.body, 2 lines max (about 120 characters) | priorities 1 to 3 (title, owner, timing) + their decisive number |
| So what | | 1 line | report callout | |

Break rule: page 1 never breaks; if a finding sentence needs 3 lines, cut the sentence, not the layout.

## 2. Deck (16:9, 960 x 540 pt)

Frame: margins 48 left and right. Section label type d-label (Inter 700 10/12, caps, +0.6) at 48, 28; colour logo h 22 right aligned to 912, top 22. Footer rule 0.75 brand at y 508, x 48 to 912; footer line Inter 400 9/12 muted at y 516; slide number Inter 700 9 ink right aligned. Page paper #FAF7F2; panels white.

Proposed deck type scale (new tokens, need approval):
| Token | Value | Use |
|---|---|---|
| deck.title | Inter 700 40/44 | Title slide client name (white on brand) |
| deck.headline | Inter 600 24/30, 2 lines max, one brand number | Slide headline at y 64 |
| deck.label | Inter 700 10/12 caps +0.6 | Section label, panel titles, "SO WHAT" |
| deck.body | Georgia 14/20 | Finding lines, callouts |
| deck.table | Inter 12/16, cells padding 6 12, header ink | Tables |
| deck.foot | Inter 9/12 | Footer, notes (Georgia italic 9 for the target note) |
| deck.chart | 10 pt minimum (report chart at scale 1.45) | Chart text |

Slides built:
1. Title: brand background, white logo h 48 at 48, 48; label ink, client deck.title white, "Results and priorities" Inter 24 white; facts line Inter 12 ink at y 452 (respondents, groups, released). No diagonal bar (cover and back page only rule; owner to decide if the title slide counts as a cover).
2. Finding with chart: headline at 64; chart panel x 48, y 150, 374.38 x 342.6 (report profile chart scaled 1.45); right column x 446.38 to 912: Finding, Evidence, Consequence, Action in deck.body (labels bold, 8 between), so what callout 16 below. Bottom 492.
3. Table: headline at 64; KPI table x 48, y 136, 864 wide, columns 360, 112, 104, 104, 184; 10 rows, bottom 452; target note 6 below.

### What pptxgenjs cannot draw (flag for the deck builder)
- Native bar charts cannot give one series a dashed outline (the 12 month "target" bar) or a tint fill with a solid outline per point in a clustered chart cleanly; per point colours need `dataLabel`/`valAxis` workarounds. Proposal: Now as tint fill without outline, Preferred solid.
- No reference line inside a bar chart (even share 25, flag line 3.00): needs a combo chart with a line series or a drawn line shape positioned by hand (breaks when a consultant edits the chart).
- No white knockout behind data labels, no hatch pattern fills (suppressed heatmap cells), no diverging bar colouring by sign without splitting into two series.
- Heatmap, dumbbell, gauge and culture map are not native chart types: draw as shapes (not editable as charts) or embed as images.
- Fonts are not embedded: Inter and Georgia must be installed on the presenting machine, otherwise PowerPoint substitutes. Tabular figures cannot be forced.
- Vector icons (check, cross, watch, star) need to be shapes or SVG images; no font glyphs.
- Table banding and the 0.75 ink bottom rule are possible; per cell border control works but no letter spacing in table cells.
- Fully round pills: use `roundRect` with `rectRadius` 0.5 of the height; works.

## 3. Staff conversation guide (A4, internal)

Header "{client} · Staff conversation guide" with colour logo; footer "Internal. PAC staff only. Do not share with the client team" and "Page n" (total unknown until the guide length is set).
Content page (built; flow bottom 733.5):
| Block | Size | Type | Data |
|---|---|---|---|
| Title | h1 | type.h1 | fixed |
| Intro | 400 wide, 2 lines | type.body | `respondents.submitted` |
| Numbers to bring | white panel, padding 12; 5 equal columns, gap 12 | value type.h1 tnum, label type.table | voice scores below zero (lowest first) + top comment theme share |
| Step card (x4) | white panel, padding 12; marker 16 + 12 + text; time pill right aligned | title type.h2, body type.body, "You might say" Georgia italic 10 | steps are SAMPLE WORDING; numbers from data |
| Please avoid | callout, cross icons | type.body | sample wording consistent with report non negotiables |

Plain and friendly means: second person, short sentences, one idea per line, no charts, numbers only where the facilitator needs them.

## 4. Open items

- Sample wording (not data): brief finding sentences, slide Consequence and Action lines, all staff guide steps, timings (10, 15, 25, 10 minutes) and "You might say" lines.
- Brief p2 to p5 not built as HTML (they reuse approved report blocks); build on approval of page 1.
- Release date and assessment date still "to be confirmed" (not in the sample).
