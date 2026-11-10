# CDP Platform: batch database plan for the 72 hour build

**Date:** 11 October 2026
**Status:** Proposed. Nothing in this plan has been applied. Per the build rules, schema, security rule (RLS), auth and unlinking changes need approval first.
**Scope:** Four migrations after `20261003180000_org_graph.sql`: segments and named invitations, Leadership 360, action plan and tracking, email outbox.

## How to read this

Each section says what is added, who can read and write it, and what it does not change. The SQL files will follow this plan exactly. Any difference found while writing the SQL will be reported before it is applied. Every new table has `tenant_id`, audit columns and row level security, and gets one security test per role.

## What stays the same

- No change to `capture.response`, `capture.response_allocation` or the rule that no role can read an individual response.
- No change to auth, MFA (still stubbed), sign in, roles or tokens already issued.
- The service role still reaches the database only through `public.rpc_*` wrappers.
- The engine is not changed. Scores, segments, 360 and planning all call it.

## Migration 13: segments and named invitations

**Why:** Today a survey link is an anonymous seat with no department, grade or tenure, so results cannot be split. Segments need those attributes at the moment a person is invited, and the existing unlinking rule must still remove the link to the person at submission.

**Adds**
1. `person_of_record.start_date` (optional date). The roster import and CSV template accept it. Tenure is worked out from it.
2. `public.tenure_band` per tenant: a name and a range in months, seeded with five default bands (Under 1 year, 1 to 3 years, 3 to 5 years, 5 to 10 years, Over 10 years). A consultant can edit them before launch. This keeps thresholds in data, not in code.
3. `capture.issue_person_invitations(assessment, people, expires)`: for each rostered person it makes one single use token, stores only the token hash, and writes a snapshot of **department, grade, tenure band** taken from the roster. It returns the token and the person id to the server only, so the server can email the link and then forget the token.
4. `public.segment_query_log`: insert only, no update or delete for anyone. Each row records who asked, the assessment, the axis and filter, and the outcome (allowed or suppressed). It never stores group sizes below the floor.
5. Wrappers `public.rpc_issue_person_invitations` and `public.rpc_log_segment_query`.

**Security**
- The snapshot is copied to the response at submission and then emptied on the invitation; `person_id` is nulled in the same transaction. This is the existing behaviour and is re-tested.
- Segment reads use only the frozen set after freeze. Groups under 5 are suppressed by the engine and the API returns 409 `BELOW_REPORTING_THRESHOLD` with the roll up.
- The query log can be read by Super Admin and the assigned PAC Consultant. Client roles cannot read it.

**Risk to know:** with under 50 respondents, department plus grade plus tenure can identify a person. The engine floor of 5 and its differencing check stop small cells and subtraction attacks; many cells will show as suppressed. This is intended.

## Migration 14: Leadership 360

**Adds**
1. `public.rater_nomination`: for one leader assignment, one rater person, relationship (Superior, Peer, Direct Report), status (Nominated, Approved, Invited). It holds the plan, not the answers.
2. `capture.response_360`, `capture.response_360_item` and `capture.response_360_text`: one row per submitted form (self or rater). Holds the leader assignment, relationship, ratings and free text. Free text is encrypted with the existing Vault key. It holds **no person id and no token**.
3. `capture.submit_360(token, payload)`: same pattern as `submit_response`. Checks the token hash, validates ratings, stores the form and nulls the person link in the same transaction. Uses the existing `SELF_360` and `RATER_360` invitation kinds.
4. `capture.frozen_360_set(assessment)`: returns ratings by leader and relationship with **no ids that join to people**, only after freeze. Same grant model as `frozen_response_set`.
5. `public.leader_result`: the scored result per leader, stored with the score version it came from, written by the scoring job from the engine's `scoreLeaders`.
6. Wrappers for nominate, approve, invite, submit and read.

**Security**
- A leader can see only their own result, and only after release. A People Leader never sees individual raters or who submitted. The engine's minimum rater rule hides a relationship group with too few raters.
- Nomination status is visible to the assigned consultant and Super Admin; counts only for clients.

## Migration 15: action plan and tracking

**Adds**, with columns taken from the engine's `Plan`, `Priority`, `Action` and `PriorityZeroItem` types:
1. `public.plan` (one per assessment and score version) and `public.priority` (sequence, orientation, classification, gap, urgency tier, owner role, due, linked findings, blocked by).
2. `public.priority_zero_item` (the P0 register, with a completed flag and who completed it).
3. `public.action` (level, objective, intervention, horizon, owner, sponsor, dates, status, visible signal flag, KPI name, baseline, target, budget, generated by). Statuses are the engine's: Draft, In review, In co design, Approved, Published, In progress, Under review, Closed, Retired, Discarded.
4. `public.action_status_event` (insert only history of each change, with who and why), `public.kpi_reading` (value, date, note) and `public.action_evidence` (file path in Supabase Storage in the same EU region, type, uploaded by).
5. `public.leader_development_plan` from the engine's `draftDevelopmentPlan`, visible only to that leader and the assigned consultant.
6. A trigger so an action cannot be Published while a blocking P0 item is open, and cannot be Closed without evidence. The engine's `transition` is called first; the trigger is the second layer.

**Security**
- Client roles see plans, actions and dashboards only for an assessment with a released report. Action edits follow the engine's role rules (`transition`), so a role the engine refuses is also refused by the database.
- Evidence files live in a private Storage bucket; access goes through the app with signed links.

## Migration 16: email outbox and reminders

**Adds**
1. `public.event_outbox`: event id, tenant, type, payload, status, attempts, times. Consumers are idempotent on `event_id`.
2. `public.email_log`: recipient domain, template name, status and times. **No message body and no token**.
3. `public.reminder_state` per pending invitation: last sent and count. When a person submits, their link to the invitation is removed, so they drop out of reminders.
4. Wrappers for the sender job to claim, send and mark outbox rows.

**Security**
- Only the server job writes these tables. Email addresses stay in the roster and are read server side only. No client role can read them.
- Sender is `hello@pac.africa` through Resend. No send happens until you add the Resend key and the DNS records.

## Order and testing

Apply in order 13, 14, 15, 16. After each one: the engine tests (251), the existing end to end scripts, and new security tests that sign in as each of the six roles and check read and write per new table. A rollback script ships with each migration.

## What I need from you

1. **Approve or amend this plan.**
2. A Supabase access token for the account that owns project `swnvjucteqguqdbsdmsl`. The file `MByte-supabase-token.txt` is for a different organisation and cannot see the CDP project.
