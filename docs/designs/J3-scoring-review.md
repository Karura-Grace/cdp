# Journey 3 design: scoring review, results by group, leader results

Status: DRAFT for owner approval, 21 October 2026. Nothing here is built. Every choice below comes from the three interview rounds of 20 October 2026, and from the Craft Silicon proposal (build order: client dates first, sub culture reports and leader reports both needed by 14 December 2026).

## Why this journey comes first
The Craft Silicon programme issues survey links on 16 November 2026. A link carries a snapshot of the respondent's cuts, written when the link is issued. Any cut missing from the snapshot on that day can never be reported for that survey. So slice S1 (cuts) must be finished and applied before 16 November. The sub culture reports and the leader reports (Journey 5) read the group results and leader results built here.

## Scope
Matrix rows in chapter 3 (scoring and groups), the leader results of chapter 4, and the review and release rows S3-01 to S3-05, S3.2-002 to 004, S3.4-011 to 013, S3.5.12 and S3.5.13, N3.2 to N3.6, S4.6-009. About 130 open rows. The sub culture report, its slides and the leader report documents are Journey 5.

## Slices

### S1. More cuts on every link (schema, needs approval; before 16 November)
- Today the snapshot written by `capture.issue_person_invitations` holds department, team and grade. The organisation data already holds location, unit parent (division), grade band with its executive flag, and start date (tenure band).
- Add to the snapshot: `division`, `location`, `executive` (YES or NO, from the grade band flag), `tenure_band`. Declared Section I attributes already live under `attributes`.
- Cuts offered on the Results by group tab: those organisation keys plus the Section I attributes. A key that is not declared there is not offered.
- Links already issued keep the snapshot they were issued with. No assessment is fielding with real respondents today, so nothing is lost.
- The floor of five valid responses applies to every cut and every combination.

### S2. Group results stored at score freeze (schema)
- New table `segment_profile (assessment_id, score_version, segment_key, definition, n, profile_json, payload_hash)`, written when the score is frozen, for every reportable group on the standard cuts. Groups under the floor are not stored; they are folded into their parent and recorded as merged.
- The score object and its hash do not change. The stored profile carries the score hash it came from, and the existing recompute check stays.
- Other groups are computed on request through the engine, as today.

### S3. Results by group, with labels (screens and engine)
- Each group shows SDI, the divergence per orientation (8.0 or more), profile divergence (SDI 12.0 or more), dominance divergence and the Welch test result. A group is labelled "Sub-culture (confirmed)" or "Indicative", with the tests that passed.
- A compare view of up to four groups beside the organisation.
- A filter builder (axis and value, combined with AND) with a live count that says "fewer than 5" below the floor.
- A heatmap that contains small groups loads, shows them as "below reporting threshold", folds them into their parent, and logs every cell. Asking for one small group on its own returns 409.
- Excel export of every segment view with the underlying counts. PowerPoint slides move to Journey 5.

### S4. Query log
- `segment_query_log` gains `resolved_count` (exact). Only the Super Admin can read the log; screens never show the exact count under the floor. Insert only stays.

### S5. Void until score freeze
- A consultant may void a response after data freeze and before score freeze. The response set gets a new hash, the reason is recorded in the freeze record and the exclusion log, and the next score is a new version. Voids are refused once the score is frozen.

### S6. Leader results and their link to the culture (schema)
- Computed at scoring and stored beside the leader results: fit index and band, carrier class (Critical Blocker, Culture Blocker, Culture Carrier, Emerging Carrier, Neutral, evaluated in the spec order), team eOS differential, contribution quadrant, safety flag, change capacity flag, integrity flag.
- Visible only to the PAC Consultant at this stage. Nothing about carrier class can be exported.
- The integrity flag notice to the leader and the people lead is sent when the leader report is released (Journey 5), after the debrief.
- A leadership population view for the consultant: counts by class and LRI distribution (needs five valid results).

### S7. Score review tab (screens)
- New consultant only tab, "Score review", between running the score and freezing it: NOW and PREFERRED, gaps and classes, readiness, eOS with routing, response rate table, a data quality panel (flags, voids by reason, D7 to D9 consistency, extensions), and the formula and inputs behind each number.
- The Freeze score button shows the score hash and versions first.
- Cronbach alpha below 0.70 appears as a plain sentence in the technical appendix ("D8 answers were less consistent than usual (0.64, below 0.70). Read the D8 score with care."). Alpha never removes data.

### S8. Release gate
- Release is refused (409) unless the technical appendix holds every part: response rate table, exclusions, suppression notes, versions, payload hash, substitutions, overrides, extensions. A checklist beside the Release button shows what is missing.

### S9. Engine, thresholds and routing (engine and oracle, both)
- Move the hard coded thresholds into configuration with the same values: readiness band edges, eOS bands (0, 30, 50), LRI 3.50 for carrier class and quadrant. Old scores reproduce byte for byte; a test covers each edge.
- eOS routing (Q1 to Q8, primary and secondary orientation) is attached to each negative eOS finding.
- Tests for the divergence rules, SDI, eOS bands, fit bands and carrier classes, which are unverified today.
- A read only "Added by scoring" note under Setup G5 for KEEP AND PROTECT orientations, stored in its own table with the score version. Setup stays locked.

## Schema and grants summary (what you approve)
New migrations (numbers follow 20261020110000):
- Replace `capture.issue_person_invitations` so the snapshot carries `division`, `location`, `executive`, `tenure_band`.
- `public.segment_profile` and `public.setup_system_note`: insert only, read by the assigned consultant (and the Super Admin); no client role until release.
- `public.segment_query_log.resolved_count`.
- `public.leader_link_result`: per leader, written at scoring, consultant only before release.
- Void after data freeze: a change to `capture.void_response` and the freeze record.

No new access to responses: the monitor read path stays counts only, and nobody gains SELECT on `capture`.

## Tests
- Engine: new cases in `src/` and `oracle/`, regenerated, old cases byte identical.
- API: success and every error code for the new routes; 409 on a small group, in every path.
- RLS: one test per role for each new table.
- AC-2.4 inspection still passes 8 of 8.
- e2e: a new suite for S1 to S8 on a seeded client with groups above and below the floor.

## Order of work
1. S1 first and applied, then S9 engine work, S2 to S6, then S7 and S8.
2. Journey 5 then starts with the sub culture report and the leader report, together with the new PDF design and the palette proposal.
3. The parts of Journey 4 the board summary needs (alignment percentage and override, segment and leader signals in the findings run) follow, before 14 December.

## Open points
- Confirm the tenure bands and the executive flag are set up for Craft Silicon before 9 November (Workshop 1).
- Sub culture and leader report layouts follow the 17 October spec chapter and the proposal figures; colours are proposed to you in Journey 5 before use.
