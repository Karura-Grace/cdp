# Journey 4 design: findings console, alignment tiles, annotations, signals, and the in depth playbook

Status: DRAFT for owner approval, 22 October 2026. Nothing here is built. Every choice comes from the owner's answers in `context-sessions/DECISIONS-LOG.md` (J4 round, Erick Ngala comments, playbook rounds). Order set by the owner: J4 as designed, then the rulings that change what exists, then automation.

## Why now
The board summary (J5) leads with the four checks and the alignment percentage, and needs sub-culture and leader signals in the findings. The action plan the client prioritises (Erick comment 67) draws on the playbook. Craft Silicon reports are due 14 December 2026.

## Scope (matrix rows)
S4-01, S4-02, S4-03 (report builder inputs only), S4.2-002, S4.2-003, S4.4-002 to S4.4-010, S4.5.1 to S4.5.6 (signals and responses), S4.5.2-004 to 006, S4.5.3-003 to 007, S4.5.4-007 to 010, S4.5.5 (scenarios shown), plus the playbook reference data (Part B 11.7 to 11.10).

## Slices

### F1. Findings console (screen)
- New engagement tab "Findings", PAC consultant only, after the score is frozen and the evaluation has run.
- Findings grouped by check (C1 to C4, then signals, then scenarios) and by severity (Critical, High, Medium, Low). Each finding shows verdict, evidence (inputs, thresholds, overrides applied), the linked scores, the matched scenarios with their risks and debrief hypotheses, and its annotations.
- Reads only the stored evaluation payload. Nothing is recomputed.

### F2. Alignment scorecard (four tiles, C1 to C4)
- Each tile: verdict word, alignment percentage (C1, C4) or rank (C2, C3 count), and the decisive override in plain words, for example "Engage is the lowest orientation, so this is capped at Miss". "Show the working" is NOT chosen by the owner and is left out.
- Plain wording for each override code comes from one table in the engine reference data (OVERRIDE_1_BELOW_THRESHOLD, OVERRIDE_2_LOWEST, OVERRIDE_3_NOT_DOMINANT).

### F3. Annotations (schema, needs approval)
- New insert only table `finding_annotation (annotation_id, tenant_id, assessment_id, score_version, finding_id, body, created_at, created_by)`. A note never changes a verdict. Read by the assigned consultant and Super Admin only. Not in client reports (Erick comment 24: comments stay outside the reports).
- Setup H1, H3, H4 contradiction flags shown beside the findings they bear on, as evidence only.

### F4. Segment and leader signals as findings
- Sub-culture (confirmed or indicative) and leader signals are appended after the organisation findings, so existing finding IDs never change (spec 4.5.4). Inputs are the stored `segment_profile` and `leader_link_result` from J3.
- Leader flags per unit (integrity, safety, change capacity, LRI under 2.50) block that unit only. The leadership population signal needs five valid results and is counts only.
- Data quality signal (INFO): response rate under 40 percent, exclusions over 10 percent, alpha under 0.70. With no voiding (owner ruling), exclusions are the engine's automatic quality exclusions only.

### F5. C2 and C3 responses and recommendations
- C2 intensity text (MARGINAL, SUBSTANTIVE, ENTRENCHED) and C3 responses (HIT, PARTIAL, SYSTEMIC, identity risk) from spec 4.5.2 and 4.5.3, held as reference data, not code.

### F6. The in depth playbook (reference data, versioned)
- Load Part B 11.7 to 11.10 (Engage, Innovate, Perform, Govern) as it stands, all four equally. Each playbook holds: orientation profile (strengths, overplay risks, where it shows); interaction matrix by level (leader, team, unit, organisation) for each other orientation; metrics and outcomes (KPIs, leader traits, blind spots); the action library at three horizons with system levers, the visible 30 day signal and the re-measurement watch list.
- The action library feeds every action. In the client plan each action opens to: why, how, owner, KPI, visible signal, and what it unlocks. Clients rank and accept actions (owner ruling on comment 67); the consultant does not own the plan.
- Editing: PAC faculty only, through versioned releases tied to the rules version; an old report keeps the playbook version it used. Faculty extend the content after the first load. Client specific overlays are not in scope.
- Engine: the current `rules-data.ts` playbook (signal, levers, medium action, watch list) is replaced by the full structure in both `src/` and `oracle/`, then `npm run oracle:generate`. Old scores and plans reproduce.

## Schema and grants summary (what you approve)
- `public.finding_annotation`: insert only, read by the assigned consultant and Super Admin.
- Playbook reference data: new tables or a versioned JSON in the rules version (to decide with approval); read by all signed in staff roles for released plans.
- No new access to responses.

## Tests
- Engine: new cases for override wording, C2 and C3 response selection, playbook structure; old cases byte identical.
- API: success and every error for the console read and annotation write; annotation never alters a finding or its hash.
- RLS: one test per role for each new table.
- e2e: console groups, tiles, an annotation round trip, signals appended without shifting IDs.

## Open points
- Whether the 360 signals appear per leader in findings or as counts only: decided as per unit flags plus counts for the population (owner chose "sub-culture and leader signals as findings, organisation findings unchanged").
- Playbook content for Craft Silicon's gaps is checked by PAC faculty before first use.
