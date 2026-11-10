# Report design: Geminia reference vs our DRAFT7

**Date:** 3 November 2026
**Purpose:** a plain description of how the Geminia full assessment report is laid out, page by page, and how our current report is laid out, so a custom design template can be written against it.
**Sources:** `CDP-References/Geminia Culture Intelligence Full Assessment Report (1).pdf` (33 pages) and `CDP_Documents/DRAFT7/report.pdf` (80 pages, code in `apps/web/lib/export/pdf-full.ts` and `full-model.ts`).
**Rule:** we copy the layout ideas only, never the Geminia wording or its third party terms (spec section 0.2).

---

## 1. Geminia: the format

### 1.1 Page frame (every inner page)
- A4, about 45 pt side margins. White page.
- **Header:** left, "Geminia Life Insurance" in bold navy. Right, small grey text "Organisational Culture Intelligence Report 2026 - CONFIDENTIAL". A thin gold rule runs under both.
- **Footer:** a thin gold rule, then small grey "CONFIDENTIAL - For Internal Use Only" on the left and the page number in gold on the right.
- No watermark. No logo on inner pages.
- Fonts: Poppins for the cover and big titles, Open Sans for body, headings and tables. Body is about 9 pt, justified.
- Colours: navy (about #1B3A6B) for bars, table headers and headings; gold (about #C9952B) for number tiles, sub headings, rules and page numbers; mid blue and pale blue for chart series; green, gold and red only for signals.

### 1.2 Cover, title page, contents, back cover
- **Cover:** split page. Left white column with the client logo at top and contact lines at bottom. Right side a full height photo. A navy block runs across the middle with "CULTURE REPORT" in big white type, a bright blue strip under it with "Presented by : PAC" and the website. Tagline bottom right.
- **Title page (p2):** white, the report title in big navy caps, "Powered by the PAC Culture Intelligence Platform | April 2026", then a short block of assessment facts (date, respondents, framework, departments).
- **Contents (p3 to 5):** a navy band down the left edge, "Table of Contents" in very large cyan type at the top. Chapters in gold caps with a number ("01. METHODOLOGY..."), sub sections in small grey, page numbers right in gold, thin leader lines. Three pages.
- **Back cover:** full navy page, a pattern of blue dashes, the client name top left, the date top right, a small legal block at the bottom.

### 1.3 Chapter opener (every chapter, top of its first page)
- A gold square tile with the chapter number ("03") joined to a full width navy bar with the chapter title in white caps ("CULTURE GAP ANALYSIS NOW vs. PREFERRED").
- Under it, numbered section headings in bold navy ("3.1 Gap Priority Matrix"). Third level headings ("4.1.1 Sub-Profile Analysis") are smaller.
- Small gold sub heads inside text for each item, for example "D1: Dominant Characteristics: Compete (29.6/100)" followed by one short paragraph.
- Each chapter starts on a new page. Chapters are one to three pages. Pages are dense and full, with no big empty areas.

### 1.4 Block types and where they sit
| Block | Look | Typical position |
|---|---|---|
| Intro paragraph | 4 to 6 lines, justified | Directly under the section heading, always first |
| KPI tiles | Four rounded tiles in navy, blue, green, gold; big white number, small label, tiny caption | Executive summary only, under the first paragraph |
| Chart panel | Pale grey blue rounded panel, bold navy caps title ("NOW VS PREFERRED - GAP OVERVIEW"), chart, legend below | Two panels side by side across the page, straight after the intro |
| Full width chart | Same panel, one chart across the page | Employee voice (diverging bars), dimensions (grouped vertical bars) |
| Data table | Navy header row with white bold text, white and very light blue rows, thin borders, first column bold, numbers centred, a star on the leading value, signal words in red caps (CRITICAL) | Right after the charts, full width |
| Callout | Gold small heading ("Critical Caution: The Variance Signal"), a vertical gold or red rule on the left, short text and bullets | Under a table, to explain it |
| Big Three | Coloured heading word (green ACCELERATOR, gold BLOCKER, red BLOCKER), a coloured vertical rule, 2 to 3 bullets | Executive summary page 2, under the radar and donut panels |
| Text beside chart | Paragraph on the left half, small chart on the right half | Departments chapter |
| Health indicator meters | Horizontal bars with a label and percentage, red for lower is better | Beside the readiness bar chart (chapter 7) |
| Recommendation list | Bold lead in phrases with bullets, grouped as Priority 1, 2, 3 | Roadmap chapter |
| Phase table | Four columns: Phase, Timeline, Key initiatives, Success indicators | Roadmap chapter |

### 1.5 Page by page flow (what sits where)
1. **p6 Executive summary:** intro paragraph, four KPI tiles, one more paragraph, KPI table (KPI, Score, Rating, Business Implication).
2. **p7:** radar and donut panels side by side, then "The Big Three Findings" (three coloured findings with bullets).
3. **p8 to 9 Method:** framework paragraph, dimension table (Dimension, Name, What it measures), supplementary indices table, data sources table.
4. **p10 to 12 Culture now:** summary paragraph, orientation table, six dimension grouped bar chart, dimension table with stars and an average row, then one gold sub head and paragraph per dimension.
5. **p13 to 14 Gap:** intro, two bar charts side by side (Now vs Preferred, Executive vs Staff), table with variance, consensus and priority, caution callout, then executive vs staff table and a tension table.
6. **p15 to 16 Departments:** paragraph beside a small chart, department table, one gold sub head per department, a red "Risk Flag" line, then a cross department recommendation.
7. **p17 to 18 Benchmarking:** (we leave this out by decision Q-D7-4).
8. **p19 to 20 Employee voice:** one full width diverging bar chart, table (Category, Score, Promoters, Passives, Detractors, Signal), then a callout per critical signal.
9. **p21 to 22 Readiness:** two infographic panels side by side (factor bars, health meters), eight factor table, plain language "what this means" text.
10. **p23 Risk:** risk dashboard table with coloured status words, then a red ruled bullet list of drivers.
11. **p24 to 27 Roadmap:** posture, three priorities with bullets, 14 day quick wins, phase table, five change principles.
12. **p28 to 29 KPI scorecard:** donut and bar chart pair, intro, ten column KPI table (KPI, Baseline, 12 month, 18 month, Tool), then governance and leading vs lagging.
13. **p30 to 32 Appendices:** dimension data table, cohort table, glossary (two columns), facilitation guide in three sessions with a red ruled "non negotiables" box.

### 1.6 Why it reads well
- Every page opens with a heading, then a visual, then a table, then one plain callout. The reader always sees data before prose.
- Two small charts per page beat one big one.
- One style for tables everywhere.
- Colour carries meaning only in signals (green good, gold watch, red critical).
- 33 pages for ten chapters. No page is mostly empty.

### 1.7 Weak points to avoid copying
- Third party framework names and the Collaborate, Create, Compete, Control labels (banned by the spec).
- Eight readiness factors with identical scores and an unexplained 80 percent success figure.
- Typos and run together words in several headings.
- Charts are flat images, so they cannot be adjusted or made accessible.

---

## 2. Ours: DRAFT7 format

### 2.1 Page frame
- A4, 56 pt margins. Cream paper (#FAF7F2) with white cards on it.
- **Header:** small grey "Client name · report title" on the left, the PAC logo on the right. No rule.
- **Footer:** an orange rule, then "Confidential. Prepared for client · Released date" left and "Page n of N" right.
- A faint diagonal "CONFIDENTIAL" watermark on most pages (off on graphic pages and review copies).
- Fonts: Inter heavy for headings, a serif for body at 11 pt (larger and airier than Geminia).
- Colours: ink black (#151C26), PAC orange (#EB5733), muted grey. The four orientation colours (blue, purple, red, green) appear only in charts, as the spec requires.

### 2.2 Cover, contents, back
- **Cover:** full orange page with light circles, PAC white logo top left, a CDP badge top right, "Culture Dynamics Profile", the report title in white, client name, release date, "Presented by Priority Activator Consulting". No photo.
- **About this report:** a small table (organisation, report, audience, released, prepared by, classification) and a one line confidentiality note.
- **Contents (3 pages):** big two line "Table of Contents", an orange rule, orange number tiles (black for summary and appendices) with caps chapter titles and page numbers right, sub headings numbered 3.1, 3.2 with dotted leaders. This was built to copy the Geminia contents, without its navy band.
- **Back page:** none yet.

### 2.3 Chapter opener
- Orange number tile plus a full width black rounded bar with the title in white caps.
- Seven "Part" dividers: a white rounded card with the part name and an orientation symbol, above the chapter bar.
- A muted grey lead line under the bar, then the chapter content. Chapters flow on after each other; only the summary, part openers and first appendix force a new page.

### 2.4 Block types
| Block | Look |
|---|---|
| "In short" | Plain paragraph block written by the AI polish, first in each chapter |
| Definition box | Cream box with an orange left rule: what the measure is and how to read its bands |
| Tiles | Four rounded tiles (black, orange, gold, red) with a big number and caption |
| Charts | Drawn vector bars in white rounded cards, one per block, mostly full width |
| Tables | Black header row, alternating cream rows, 9.5 pt serif |
| Advice | Numbered orange circle, recommendation text, two grey pills (timing, owner); "Signal to watch" in a pink box; "What good looks like" and "Traps to avoid" bullet lists |
| Check cards | One card per alignment check with verdict word and colour |
| Meters | Bars with a target marker, used on the risk page |
| Callout | Orange ruled box, small caps label |

### 2.5 Chapter order (spec 4.6 order)
Executive summary, 01 The four orientations, 02 Method and participation, 03 The culture now, 04 The six dimensions, 05 The culture gap, 06 Hits and misses, 07 Executives and staff, 08 Readiness for change, 09 Risk and cultural debt, 10 Employee voice, 11 What people wrote, 12 Departments, 13 Leadership 360 summary, 14 What this means, 15 What to do next, 16 Culture KPI scorecard, Appendices A to D. 80 pages.

### 2.6 Where we fall short of Geminia (seen in DRAFT7)
- **Empty space:** several pages carry only a few lines (for example pages 21, 44, 69 and 78), because advice blocks spill over and the next chapter does not start until the flow allows it.
- **Text before data:** the AI "In short" paragraph and long advice come before the chart in many chapters; Geminia puts the visual first.
- **One chart at a time:** we rarely place two charts side by side, so pages hold less data.
- **Weight:** 80 pages against 33. Much of the extra is advice text; good depth, but it needs tighter placement.
- **Watermark:** a diagonal watermark on every page makes dense pages harder to read.
- **Tables:** black header and cream rows read as heavier and less clear than navy and light blue, and have no star or signal colour on the leading values.
- **No photo or pattern** on the cover or back cover, and the cover has no facts block (respondents, date, framework).

### 2.7 What we do better
- Spec compliant terms, palette and section order; no outside benchmarks.
- A leadership 360 summary, spread and agreement tables, axes, values vs reality, KPI targets at 12 and 18 months and a facilitation appendix.
- Vector charts (sharp, can be made accessible), AI readings that the consultant accepts, a numbered recommendation format with owners and timing.

---

## 3. Questions for the template
1. Keep PAC orange and black, or move to a navy and gold look like Geminia?
2. Charts: two per row in grey panels, as Geminia, or keep one per card?
3. Do we keep the watermark, the cream paper and the serif body?
4. Cover: add a photo, a pattern or a facts block (respondents, date, framework)?
5. Chapter order stays as spec 4.6, with Geminia's page flow (heading, visual, table, callout) inside each chapter?

---

## 4. Owner answers to the five template questions (3 November 2026)
1. Palette: PAC palette only for structure. Geminia is a layout reference, not a colour reference.
2. Charts: two per row in surface panels where space allows; full width only for diverging and grouped bars.
3. Watermark, cream paper and serif body: Georgia body and Inter headings are chosen; the watermark is off by default; paper colour is for the agent to justify.
4. Cover: designed by the agent, with a facts block (respondents, date, instrument). Photo or pattern is the agent's proposal.
5. Chapter order follows the platform specification (section 4.6). Inside each chapter: headline finding, chart, table, so what.
6. Extra finding from the review: the report must report findings, not explain terms. Definitions go to the glossary, advice must cite the client's numbers, and the words "In short" are never used as a heading.
