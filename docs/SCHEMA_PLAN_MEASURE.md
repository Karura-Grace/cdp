# Plan: the Measure stage (spec chapter 6, screens S6-01 to S6-05)

**Status:** step A approved and built on 13 October 2026 (migration 19, `e2e-measure.mjs`). Step B (pulses) approved and built on 13 October 2026 (migration 20, `e2e-pulse.mjs`). Step C (adjust or retire) approved and built on 14 October 2026 (migration 21, `e2e-adjust.mjs`). Step D (cycle rollover) approved and built on 15 October 2026 (migration 22, `e2e-rollover.mjs`). The Measure stage is now complete.
**Date:** 13 October 2026

## What exists already
- Engine, tested: `validatePulse`, `pulseTriggers`, `otherTriggers`, `tradeOffVerification`, `compareProfiles`, `adjustOrRetire`, `kpiDirection`, `comparability` (`packages/cdp-engine/src/reassess.ts`). The app must call these, not copy them.
- Stage 5 data the Measure stage reads: `plan`, `priority`, `action`, `kpi_reading`, `action_evidence`.
- The score object, findings and report of the baseline assessment.

## Proposed build order (each step ships on its own)
**A. Trend comparison and triggers (needs migration 19).** Smallest slice that makes the cycle read as complete.
1. A re-assessment is the next cycle's engagement (`engagement.cycle_no` and `previous_engagement_id` already exist) with its own assessment, so no new columns on `assessment` were needed.
2. `public.org_change` (RESTRUCTURE, MERGER, NEW_CEO, MODEL_TRANSITION_LIVE, OTHER, date, description). Client Admin or consultant records it. Insert only.
3. `public.reassessment_trigger` (PULSE_MOVEMENT, STRUCTURAL_COMPLETE, ORG_CHANGE, BOARD_REQUEST, ANNUAL, source reference, raised, decision ACCEPTED or DISMISSED, reason). Only the PAC consultant decides.
4. `public.comparison` (baseline, current, version relation SAME, MINOR or MAJOR, deltas json). Computed on the server with the engine, stored, never edited. MAJOR refuses with 409 as the spec says.
5. RPCs with role checks and audit rows: `rpc_record_org_change`, `rpc_raise_trigger`, `rpc_decide_trigger`, `rpc_store_comparison`. Service role only, like the other `rpc_*` functions.
6. RLS: client roles read their own tenant's org changes and triggers; they read a comparison only after the current report is released (`app.score_released`). Super Admin reads none of the results, as elsewhere.
7. Screens: S6-04 Trend comparison (orientation scores, gaps, D7 to D9, TPS, trade-off verification panel, version banner, "movement and delivery side by side, never claims causation"), S6-03 Trigger monitor, org change form.
8. Seed: a second, 12 months later assessment for the Ostravane demo, with believable movement, so the screen has real computed numbers.

**B. Pulses (built, migration 20).** `capture.pulse`, `capture.pulse_invitation`, `capture.pulse_response`, unlinked at submission exactly like the main survey, results shown only for 5 or more and labelled INDICATIVE. Screens S6-01 pulse builder (watch-list items only, at most 10) and S6-02 pulse results. Respondent flow reuses `SurveyShell`. This is the largest part.

**C. Adjust or retire at the 90 and 180 day reviews (built, migration 21)** using `adjustOrRetire` on existing KPI readings (no new tables beyond a decision record on the action).

**D. Cycle rollover (S6-05) (built, migration 22)** creates the next engagement with a carry-forward preview.

## What I will not do without a further yes
- Change or delete baseline data. Comparisons are read-only over frozen results.
- Claim that an action caused a movement anywhere in the product.
- Run the retention destruction job (separate plan, still waiting on four answers).

## Tests
- Engine already covers the rules. Add app level checks: a MAJOR version comparison returns 409, a MINOR shows the banner, a consultant can decide a trigger and a client admin cannot, a client cannot read a comparison before release, org change is insert only, every decision writes an audit row.
- `e2e-measure.mjs` (new): seed, record an org change, raise and accept a trigger, store a comparison, check roles. Existing `e2e-ui`, `e2e-segments`, `e2e-360`, `e2e-plan`, `check-css-classes` still pass.

## Questions
1. Approve step A (migration 19) now, with B to D each approved when reached?
2. For the demo, is a made-up "12 months later" second assessment on Ostravane acceptable (clearly labelled illustrative)?

## Step B as built
- Tables: `public.pulse` (what is asked, baseline reading on the same items), `public.pulse_result` (aggregate, stored once, insert only), `capture.pulse_invitation` and `capture.pulse_response` (token hash only, person link destroyed at submission, no demographics, no free text).
- One read path to pulse answers: `capture.closed_pulse_set`, owned by `scoring_reader`, refuses until the pulse is closed and below the reporting floor (`segments.floor`).
- Items are watch-list references of one priority (`D2 S2`, `D8`, `eOS Q1`), at most ten, checked by the engine (`validatePulse`). Readings, answer validation and the baseline come from `packages/cdp-engine/src/pulse.ts`.
- Engine note: `pulse.ts` has TypeScript tests (`test/pulse.test.ts`) but no Python oracle mirror yet, because `python3` is not installed on the build machine. Add the mirror in `oracle/cdp_oracle/reassess.py` and run `npm run oracle:generate` where Python is available.
- Not built: scheduled pulses at 90 and 180 days (the consultant creates them), reminders, an audience narrower than the whole active roster.

## Step C as built
- One new table, `public.action_review` (insert only): the engine recommendation, the consultant decision, the reason when they differ, and the inputs the engine was given. One review per action and review point (+90d, +180d). Read by the PAC team, and by the client admin and executive once the report is released.
- A review is recorded only while the action is UNDER_REVIEW, the state the engine workflow uses for it (the client moves it there; the consultant cannot). This is stricter than the first proposal, which also allowed IN_PROGRESS, because the engine gives the consultant no IN_PROGRESS to UNDER_REVIEW move.
- The engine decides: `adjustOrRetire` with `kpiDirection` from the stored KPI readings. The app derives owner present, pre-condition open and earlier adjustments from stored data; the consultant answers two judgements the platform cannot know (milestones on track, finding still supported).
- After recording, the app uses the engine transition: RETIRE decisions move the action to RETIRED, CONTINUE and ADJUST decisions send it back to IN_PROGRESS, SUSPEND and REASSIGN hold it under review.
- Known limit: the engine retires for no movement only after two earlier adjustments, and there are only two review points, so that rule cannot fire from this screen.

## Step D as built
- Two new insert only tables: `public.rollover` (one per previous engagement, with counts and the carried backlog) and `public.carried_action` (a snapshot of each open action with its plan fields and history, disposition PENDING).
- `rpc_rollover_create` (service role only, one transaction, audited) creates the next engagement (cycle plus one, SETUP, previous engagement linked), copies the agreed setup sections as DRAFT with the workshop date and participants cleared, and writes the two records. The acting consultant is granted the new engagement for 90 days.
- The gate is the engine's own guard for leaving implementation (`checkEngagementTransition` IMPLEMENTATION to RE_ASSESSMENT): an accepted trigger on the baseline, or twelve months since its window closed. The baseline must be frozen and have a plan. What carries is shaped by the engine (`rolloverPlan`).
- Nothing of the baseline changes, including its engagement state.
- Not built: the next plan generation that links carried actions to the new findings or retires them as superseded (carried actions wait as PENDING); copying the organisation graph and its leader assignments (the next cycle needs its own graph saved before pre-flight passes); moving the baseline engagement through DEBRIEF to RE_ASSESSMENT, which the application does not drive anywhere yet.
