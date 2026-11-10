# Journey 1 design: setup, launch and the privacy foundation

For approval before any schema, RLS or auth change. Closes 61 Partial and 12 Missing stage 1 rows, plus the stage 1 privacy rows that journey 8 would otherwise need to repeat (retention, processing register, data subject rights, DPIA, coach assignment). Nothing here is started.

## What the owner sees
1. **Setup workspace.** Every section A to I shows the Executive entry, the HR entry and the Agreed entry side by side for E, F and G, with a divergence flag per field and the agreed text written by the consultant. Client Admin can draft A to D and the HR or Executive entries where the matrix allows. Facilitator is recorded on the workshop panel. Participants become people of record, and the check for two named executives uses their executive grade.
2. **Requirements panel.** After B, C and D are agreed the screen shows what the rules derive (C1, C4, leadership target, tie break reason) before the workshop moves on.
3. **Scorecard.** Objectives become a real entity linked to B priorities, with KPIs under them, import and export of the scorecard.
4. **Survey design (Section I).** All six fields complete: cohorts, anonymity wording that changes the staff message, window with tenant public holidays and a warning when it overlaps the performance review period, reminder plan (standard or custom), staff message template, qualitative complement counts.
5. **Pre-flight and launch.** L1 to L8 all real: L7 shows a difference report between the invitation list and the active people in scope, L8 checks Leadership 360 set up, L5 uses holidays, and a new DPIA check blocks launch when no DPIA is recorded. Launch is split: consultant approves, Client Admin launches. A scoring relevant change after launch creates a new assessment version with a visible reason.
6. **Privacy pages.** DPIA record, processing register, sub processor list, breach workflow with the 72 hour clock, retention schedule with notices at 90 and 30 days and a destruction certificate, and the data subject rights path (access, rectification of demographics, objection, invitation erasure).

## Schema changes (migration 26 onwards, one file per block)
| Block | Change | Rows closed |
|---|---|---|
| 26 setup perspectives | No table change. `setup_record` already allows EXECUTIVE, HR, AGREED. Add `facilitator_person_id`, `workshop.participants` as `text[]` of person ids (kept `text[]`, validated in the API against `person_of_record`), `tie_break_reason`, `contradiction_flags_by`, `setup_version int` on `engagement` and `setup_snapshot jsonb` written on launch. | S1-06, S1-07, S1.4.2-*, S1.7-001, AC-1.3 |
| 27 scorecard | `objective(objective_id, tenant_id, engagement_id, title text(200), priority_keys text[])`, `kpi.objective_id`, `kpi.currency_code` (ISO 4217, only when unit is CURRENCY). RLS like `kpi_reading`: tenant scoped, consultant or Client Admin write, released reads. | S1.4.3-001, S1.4.3-003, S1-09, L4 |
| 28 tenant settings | `tenant_holiday(tenant_id, day, label)`, `tenant.review_period_start/end`, `tenant.headcount` used as response rate denominator (view, not a copy). | S1-01, S1.4.4-I4a, I4c, S1.4.1-003, L5 |
| 29 demographics | `demographic_attribute(attr_id, tenant_id, name, values text[], is_sensitive bool, analytical_purpose text not null)`, `person_demographic(person_id, attr_id, value)` with a check that the value is in the closed list, no free text. Segments may use these axes. | S1.4.1-015, S1-05, S1.4.5-003, AC-1.7 |
| 30 data protection | `dpia_record(tenant_id, recorded_at, recorded_by, reference, transfer_basis)` (sets `tenant.dpia_recorded_at`), `processing_register(...)`, `sub_processor(...)`, `breach_incident(... opened_at, notify_by = opened_at + 72h, notified_at)`, `data_subject_request(kind ACCESS, RECTIFY, OBJECT, ERASE, status, opened_at, closed_at)`, `engagement.purpose text` copied into consent text. Insert only audit entries for each write. | S1.4.5-002/005/008/009, AC-1.5 |
| 31 retention | `retention_schedule(engagement_id, close_date, destroy_on = close_date + 24 months, notice_90_sent, notice_30_sent)`, `destruction_certificate(engagement_id, destroyed_at, row_counts jsonb, hash)`. Destruction is a SECURITY DEFINER function owned by a retention role, callable only by the scheduled job, which removes response level data and writes the certificate in the same transaction. Test on a throwaway client: data gone, score object untouched, certificate present. | S1.4.5-006, UT-44 database test |
| 32 coach assignment | `coach_assignment(assignment_id, tenant_id, coach_user_id, leader_person_ids text[], from_date, to_date)`; RLS: Coach role reads a leader report only for an assigned leader inside dates. Replaces the tenant wide Coach read for leader outputs. | S1.4.6-004, S0.5-007, T7-leader.CO |
| 33 rater workflow | `rater_nomination.proposed_by`, `approved_by`, defaults for superior, peers and direct reports from the org graph. | S1.4.6-002, L8, S1-11 |
| 34 assessment versions | `assessment.supersedes_assessment_id`, `version_reason`; launch lock stays; a scoring relevant edit calls a function that clones the assessment as DRAFT with the reason. | S1.6.2-lock, AC-1.6 |

All new tables carry `tenant_id`, RLS policies filtered on it, an RLS test per role, `created_*` and `updated_*`, and insert only audit logging where the spec says so.

## Auth and RLS
No change to sign in or MFA. Client Admin gains write on EXECUTIVE and HR perspective rows and draft rows for A to D (policy change on `setup_record`). Launch needs two actions: consultant `approve_launch` and Client Admin `launch`, recorded in `audit_log`. Token handling and unlinking are not touched.

## Engine
No scoring change. Calls the existing `f1Divergence`, `deriveSetup`, `leadershipTarget`, `retentionSchedule` and `preflight`; engine `preflight` gets L7 and L8 inputs (`invited`, `nominations`) passed from the app. Any engine edit goes to `src/` and `oracle/` together.

## Tests and evidence
- New e2e suites `e2e-setup-perspectives`, `e2e-scorecard`, `e2e-privacy`, `e2e-retention` plus RLS cells for coach assignment and perspectives; refusal tests for every field in S1.4.2 that is Unverified now.
- Matrix rows updated in the same commit; runner re run; test clients removed.

## Decisions I am making (change any of them)
- Participants stay `text[]` but must hold person ids; existing text names are migrated by matching on email, unmatched names are kept in a note field.
- XLSX import for the org graph is added with `exceljs` (already in the stack).
- Public holidays for Kenya, Uganda, Tanzania, Ethiopia, Rwanda and Ghana are seeded for 2026 and 2027 as defaults the Client Admin can edit.
- Staff message gets two template texts (FULL and CONFIDENTIAL_AGGREGATE) in plain English, reviewed by you before first use.
- Verb list for F1 stays a placeholder until PAC supplies its list (open item).

## Open questions
1. Does the consultant approval need to be a different person from the one who launches, or can the Client Admin launch straight after approval in one sitting?
2. Retention 24 months from close: confirm as the default and whether a client can ask for shorter.
3. 72 hour breach workflow: who is the notifying person at PAC (name and email for the register)?
