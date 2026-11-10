# Reference review, October 2026

Sources, all in `C:\Users\PAC\Desktop\CDP-References` (not committed):

| File | What it is |
|---|---|
| `CDP_Culture_Development_Platform v6.html` | The "golden" single file platform: offline, browser storage, admin console, respondent flow, Leadership 360, report. Demo organisation Savanna Ridge Microfinance. |
| `Geminia Culture Intelligence Full Assessment Report.pdf` and Reports (5), (6), (7) | A 33 page client report for Geminia Life Insurance, April 2026. The four versions differ only in layout and small wording; (7) adds the eNPS definition and benchmark bands. Two further files are byte identical copies. |
| `Geminia Pitch Deck.pdf`, (1), (2) | A 12 slide executive deck of the same results. The text of all three is identical; only images differ. |

Every page of every distinct file was read. Decisions below were taken with the owner on 16 October 2026.

## How each source is used

- **Spec v2.1 and the engine remain the rule source.** Most golden thresholds turn out to be the same as the spec (gap, C1, perception, TPS weights). Where they differ, the decision is per rule (table below).
- **The Geminia report is the target format** for the organisational report: structure, sections and polish. Every number still comes from the frozen score object, the stored evaluation and the plan.
- **The pitch deck is the model for the PPTX export**: twelve slides, native charts.
- **The golden HTML guides screens and flow**: one console per engagement, the landing page, the 360 previews, and a second demo organisation.

## Rule conflicts and decisions

| Topic | Golden HTML v6 | Spec v2.1 (engine) | Decision |
|---|---|---|---|
| NOW to PREFERRED gap | Over 8 points significant; reading bands Low under 4, Moderate 4 to 8, Significant over 8, Critical 16 and over | Same cut points: BUILD at 8 or more, STRENGTHEN at 4 or more, KEEP_AND_PROTECT, MODERATE | Keep spec classes. Add the golden reading band (adds Critical at 16) beside them. |
| Leadership 360 self against raters | Gap of 0.8 or more is a blind spot or hidden strength; aggregates from 2 raters | ALIGNED to 0.50, WATCH to 1.00, BLIND_SPOT above 1.00; rater floor 3 | Keep spec. Floor 3 protects raters in small teams. |
| 360 "not observed" | Rater told to choose 3 (Neutral) | Null accepted as NOT_OBSERVED | Keep a true Not observed option, excluded from means. |
| C1 strategy check | Points per goal type: Results 30 (P), Innovation 28 (I), People 30 (E), Compliance 28 (G), Transformation 26 (E and I) | The same thresholds, plus percentage verdict bands (80 and 60) | No conflict. Keep spec. |
| C4 business model | Thresholds 26 and 24 per model | Spec rules | Keep spec. |
| Executive against staff gap | "Shadow culture" over 5 points, "blindspot" over 7 | Same thresholds: WATCH over 5, SHADOW_CULTURE over 7 | No conflict in numbers. Use the plain names in the report. |
| Transformation Preparedness Score | D9 x 0.35 + D8 x 0.30 + LA x 0.20 + D7 x 0.15, LA = 5 minus mean perception gap x 0.2 | Same weights; spec leadership alignment term differs (see `ENGINE_COMPARISON_2026-10.md`) | Keep spec. Also show TPS / 5 as a percentage labelled preparedness, never as a probability. |
| Cultural entropy | Mean absolute NOW to PREFERRED gap; bands 6, 12, 20 | Not in spec | Add to engine with the golden formula, thresholds in config, shown in points. |
| Culture Risk Index | Gap 40%, dispersion 30%, misalignment 30% | Not in spec | Add to engine with the golden formula. |
| Tensions and dispersion | E against P, I against G; spread per dimension | Not in spec | Add to engine. |
| Reporting floor | 5 | 5 | Same. |
| eOS bands | Above 0 acceptable, above 30 good, above 50 excellent | Spec bands | Same in substance. |
| Cohorts | Self selected: Executive, Management, Staff | From the org graph; executive by grade | Keep the org graph. Cohort matrix rows are grade bands, each shown only at 5 or more. Tenure comes from `start_date` and `tenure_band`, already in the snapshot. |
| Benchmarks | Geminia uses Cameron and Quinn OCAI averages | None | Skip until PAC has its own norms; OCAI averages do not apply to a different instrument. |

## Geminia metrics mapped to ours

| Geminia | Ours |
|---|---|
| Change Readiness | D9 adaptive capacity |
| Psychological Safety Index | D8 psychological safety |
| Transformation Success Probability | TPS, shown as a percentage labelled preparedness |
| Strategic Alignment | C1 result |
| Leadership Staff Misalignment | Executive against staff gap |
| Cultural Entropy, Culture Risk Index | New engine metrics (above) |
| Growth Mindset Indicator | Dropped: no source items |
| Global benchmark columns | Dropped until PAC norms exist |

## Data quality issues seen in the Geminia report

To raise with PAC before any of it is reused as sample material:

1. All eight Change Readiness factors show the same value (3.53 and 71%). That cannot come from real item data.
2. "80% Transformation Success Probability" has no stated formula.
3. Entropy is presented as "40 cents of every dollar"; the measure is a gap in points, not a share of spend.
4. Typos such as "Geminiais", and "Flexibility vs Stability" listed twice in the axes line in some versions.
5. The benchmark table on slide 4 of the deck prints a minus sign before two global averages ("-22.0/ 50").

## What was built (16 and 17 October 2026)

| Area | Where |
|---|---|
| Engagement console: Overview and one tab bar across every engagement page | `apps/web/app/engagements/[id]/page.tsx`, `lib/engagement-tabs.ts`, `scripts/e2e-console.mjs` |
| Home page in the reference layout, with survey and 360 entry boxes and the live demo link | `apps/web/app/(site)/page.tsx`, `components/site/entry-cards.tsx` |
| Engine analytics in the score payload: gap bands, cultural entropy, tensions, answer spread, Culture Risk Index; values against reality; leader highlights | `packages/cdp-engine/src/scoring.ts` and the Python oracle, `test/analytics.test.ts` |
| Scores frozen before the analytics block still reproduce their hash | `apps/web/lib/scoring.ts` (`computeScore` with stored hashes) |
| Organisational report in the reference shape: scorecard, Big Three, two narratives, values against reality, gap and risk, employee voice, departments, KPI scorecard and governance, first 14 days, change principles, facilitation guide, method, glossary, How to read this boxes | `apps/web/app/reports/[id]/story.tsx`, `lib/report-story.ts`, `lib/report-extras.ts` |
| PDF and PowerPoint in the same order, the deck following the pitch deck flow | `apps/web/lib/export/` |
| Client logo co branding (migration 24) | `supabase/migrations/20261017090000_tenant_logo.sql`, `scripts/e2e-logo.mjs` |
| Leadership 360: previews, rater context (migration 25), strongest and weakest behaviours, reflection | `supabase/migrations/20261017100000_rater_meta.sql`, `app/preview/360`, `app/assessments/[id]/leaders/result.tsx` |
| Savanna Ridge Microfinance showcase with a shared viewer login | `scripts/seed-savanna.mjs`, `scripts/lib/demo-savanna.mjs` |

Not built from the reference set: benchmarks (no PAC norms yet), the Growth Mindset indicator (no source items), the ROI calculator (approved as a consultant tool; still to do), 360 open questions and verbatims (our instrument has none), self selected cohorts (we use the org graph).
