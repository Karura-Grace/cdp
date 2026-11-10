# Journey 2 design: respondent survey, 360 forms, capture quality and the survey window

Status: APPROVED by the owner on 19 October 2026, all slices S1 to S9. Owner choices: S5 read path with counts only; S2 encrypted server side drafts deleted at submit and at freeze; 360 open questions use the drafts below until the v1.1 forms are supplied. Rulings it relies on: `docs/designs/OPEN-decisions-2026-10-19.md` and `docs/designs/V21B-decisions-2026-10-18.md`.

## Scope
Open matrix rows in stage 2 (capture), N2.2, N2.3, N2.11 and the capture parts of N4 (360). That is 121 rows open in total, of which about 85 belong here. The rest (eOS routing N2.7, lens findings N2.10, leader types N4.3, self other narrative N4.5, alignment N4.6, worked examples N2.4) are findings and report rows and move to Journeys 4 and 5.

## Slices

### S1. Rules version 2.1 capture rules (engine and oracle)
- Speeding: below 40% of the assessment median, or below 8 minutes, whichever is higher (`V-02`, N2.11.2-SP). Config `survey.speeding_median_fraction` becomes 0.40 under rules 2.1. Rules 2.0 keeps 1/3 so frozen results reproduce.
- Exclusion: any two quality flags exclude the response from all scoring, and perspective duplication counts as a flag (`V-02`, N2.11.2-EXCL, N2.11.3-INSUFF, S2.6.3-004). Today only SPEEDING plus another flag excludes.
- 360 observed minimum: three observed ratings per section for A to D (`V-05`, N4.2-NOTOBS) instead of the 0.60 share.
- Cronbach's alpha per D7 to D9, report only, disclosed below 0.70 in the technical appendix (N2.11.2-ALPHA). Checked first whether the engine has it; otherwise added.
- Both `src/` and `oracle/cdp_oracle/`, new oracle cases for each rule, `npm run oracle:generate`, and `rules_version` 2.1 pinned on new assessments only.

### S2. Survey started and server side draft (needs approval: capture schema)
The spec wants started counts, an ABANDONED state, a final reminder only to people who started but have not submitted, and a server side save on every completed scenario (S2.3.1-005, S2.6.2-003, S2.6.3-005, N2.11.3-ABAND).
- `capture.invitation.started_at`, set by a new `capture.start_survey(token)` RPC on the first scenario.
- `capture.draft(invitation_id, payload_ciphertext, updated_at)`, encrypted like free text, written by `capture.save_draft(token, payload)`. **`capture.submit_response` deletes the draft in the same transaction that nulls `person_id`**, so no draft survives submission. Drafts of unsubmitted invitations are destroyed at freeze. No role gets SELECT. The browser keeps its local draft as today.
- Auto submit at close only where the respondent ticked "submit what I have if the window closes" (S2.6.3-005). It is off by default and runs in the freeze job through the same submit RPC.

### S3. Window, reminders and extensions (scheduler slice of Journey 9 brought forward for the survey)
- Reminder sender: a Vercel Cron route `/v1/jobs/reminders` (daily, Node runtime) uses `reminderSchedule` (or the custom plan from `lib/reminders.ts`). It sends through `lib/email.ts` to invitations that are not submitted. The final reminder goes only to `started_at is not null`. `capture.reminder_log(invitation_id, kind, sent_at)` with a unique key, so reruns never send twice. Sending stops at submission because submitted invitations drop out of the query (AC-2.5, simulated clock test).
- Extension: `public.window_extension(assessment_id, seq, old_close, new_close, reason, requested_by, approved_by, created_at)`, insert only. The first extension is by a PAC Consultant, up to 5 working days (`workingDays`). A second needs the engagement lead's approval (409 `EXTENSION_NEEDS_LEAD` without it). No third. It moves `expires_at` on open invitations, writes audit, and lists in the technical appendix (S2.6.2-005 to 007, N2.11.3-EXT).
- 360 rater window: `capture.submit_response` for 360 forms refuses outside that leader's rater window with 410 and the neutral expired message (owner ruling 19 Oct).
- New assessment version copies the rater window (owner ruling).

### S4. Objection revokes the link (needs approval: tokens)
When a respondent records an objection, `capture.revoke_invitation(invitation_id)` sets `expires_at = now()`, which makes the link return 410. It also deletes any draft, nulls `person_id`, and raises the consultant task already built in J1. Nothing about the objection is stored with any answer.

### S5. Void and quality monitor (needs approval: a pre freeze read path)
The spec wants a quality monitor during the window: counts of each flag, the median completion time, and a void action with a reason (S2-16, S2.2-004, S2.6.1-004). Flags are engine logic, and responses are not readable before freeze. Proposed:
- `capture.monitor_set(assessment_id)`, owned by `scoring_reader` like `frozen_response_set`, callable only by the server monitor route. It returns engine input rows keyed by `response_id` only (no snapshot, no free text). The route runs `qualityFlags` and returns **counts and the median only**. The table lists response ids with flags and duration so the consultant can pick one to void, never their answers.
- `capture.void_response(response_id, reason)`, consultant only, writes `voided_reason` and an exclusion log row, and audits. It is refused after score freeze.
- Hourly median recompute while the window is open (S2.5-003). The Client Admin is prompted when the median after 30 complete responses falls outside 30 to 50 minutes (S2.5-004, N2.2-TIME).
- Alternative if you prefer no read before freeze: the monitor shows counts only after freeze, and voiding happens between freeze and scoring.

### S6. Respondent screens
- V-08 orientation names on every constant sum statement in fixed order, live running total with remaining points, Next disabled until exactly 100, no auto balancing. Fill remainder is kept (`V-09`).
- One scenario per screen on mobile, up to three on desktop. Progress counted against 36 scenario sets, then by block.
- Interactive practice scenario on the instructions screen (not scored). D7 to D9 blocks carry a "why this matters" note.
- Landing shows the organisation, purpose, staff message, completion time and window. Review lists unanswered optional items. Confirmation gives no receipt of answers.
- Keyboard and screen reader operable stepper (S2.3.1-002). An e2e test at 360 px width, keyboard only (AC-2.1). The full accessibility audit stays in hardening.
- Survey free text: three optional questions, 2,000 characters each, with a reminder not to name people. Stored encrypted, as today.

### S7. 360 forms
- Self form: 60 items, all required, plus six reflection questions S-Q1 to S-Q6. Rater form: relationship, frequency, 60 items with not observed, seven qualitative questions R-Q1 to R-Q7, and a rater confirmation (S2-13, S2-14, N4.1-OPEN). Text goes in a new `capture.response_360_text(response_id, question_code, ciphertext)`.
- The question text should come verbatim from "Leadership 360 forms v1.1", which we do not have. The drafts below are used until it arrives, marked DRAFT, and the item bank version is bumped.
- Consent text on both forms gains the integrity flag sentence (N4.4-INTEG-CONSENT).
- Comments reach the leader only after consultant review. A redaction keeps the original in the encrypted store (N4.7-COMMENTS, S2.4-015). The review screen shows comments one at a time, with no rater identity.
- Rater group under 3 merged into "all others", and no breakdown if still under 3 (already in engine, test added).

### S8. Monitor, rates and freeze manifest
- Response monitor: invited, started, submitted by cohort (cohorts with 5 or more invited only), and a daily trend. It never lists who has or has not responded (S2-15, S2.6.5-005, AC-2.7).
- The response rate table on every report: invited, started, submitted, complete, substantially complete, partial, insufficient, excluded, with the reasons summarised (N2.11.3-RATE).
- The freeze manifest records counts by state, the instrument and rules versions, and the extensions (S2.7-001, S2.6.2-010, AC-2.8).
- Executive grade flag: launch is refused unless at least one grade band is marked executive (`is_executive`), because the executive versus staff split depends on it.

### S9. J1 follow ups carried here
- Tenant currency: `tenant.currency_code` (schema), with KPI `currency_code` defaulting from it.
- A per section Executive tick for A to D is required before launch.
- A "replace typed names with people" prompt on old drafts.
- A Super Admin A1 to A4 page across clients.
- Client Admin may add KPI readings after launch, audited.

## Schema and grants summary (what you approve)
Migrations 20261020* add:
- `capture.invitation.started_at`
- `capture.draft`
- `capture.reminder_log`
- `capture.response_360_text`
- `public.window_extension`
- `public.exclusion_log`
- `tenant.currency_code`

New `SECURITY DEFINER` RPCs:
- `start_survey`
- `save_draft`
- `revoke_invitation`
- `void_response`
- `monitor_set` (scoring_reader)

Changed: `submit_response`, which deletes the draft, applies the 360 window check, and stores 360 text. No new SELECT grant on `capture` to any role. The AC-2.4 inspection test is extended to the new tables.

## Tests
- Engine and oracle cases for S1.
- e2e suites:
  - `e2e-survey-window` (reminders on a simulated clock, extensions, 410s)
  - `e2e-draft-unlink` (the draft is gone after submit and after freeze)
  - `e2e-objection-revoke`
  - `e2e-quality-void`
  - `e2e-360-text`
  - the existing respondent suites, rerun
- RLS test per role for each new table.
- Conformance rerun and closures in `docs/spec-crosscheck/closures/j2-*.json`.

## Draft text for approval

### 360 self reflection questions (DRAFT, replace with v1.1 verbatim when supplied)
- S-Q1 What do you do as a leader that most helps your team succeed?
- S-Q2 Where do you think your behaviour falls short of what your team needs from you?
- S-Q3 Which of the four orientations do you rely on most under pressure, and what does that cost?
- S-Q4 What feedback have you received in the last year that you have not yet acted on?
- S-Q5 What would your team say you should start doing?
- S-Q6 What one change in your leadership would make the biggest difference to the culture of your unit?

### 360 rater qualitative questions (DRAFT)
- R-Q1 What does this leader do that you most value?
- R-Q2 What should this leader start doing?
- R-Q3 What should this leader stop doing?
- R-Q4 How does this leader behave when things go wrong?
- R-Q5 How does this leader make it safe, or unsafe, to speak up?
- R-Q6 How does this leader support people to grow?
- R-Q7 Is there anything else that would help this leader develop?

Each rater question carries the line: "Please do not name or describe anyone in a way that could identify them. Comments are read by a PAC consultant before the leader sees them."

### Integrity flag consent sentence (both forms)
"If other people's ratings of this leader's integrity fall below the set level, that result is shared with the leader and with the client's CHRO designate. This is the only 360 result that goes outside the development relationship."

### C4 business model by sector and maturity (DRAFT for faculty, configuration only; the Section B6 choice always wins)
| Sector | Start up, Growth | Mature | Turnaround, Post merger |
|---|---|---|---|
| Financial services | Regulated / compliance | Regulated / compliance | Transition |
| NGO / social impact | NGO / social impact | NGO / social impact | Transition |
| Manufacturing | Product (B2B) | Product (B2B) | Transition |
| Technology | Platform / digital scale up | Product (B2B) | Transition |
| Public sector | Regulated / compliance | Regulated / compliance | Transition |
| Health | Regulated / compliance | Regulated / compliance | Transition |
| Retail | Service (B2C) | Service (B2C) | Transition |
| Energy and utilities | Regulated / compliance | Regulated / compliance | Transition |
| Other | no default, B6 required | no default, B6 required | Transition |

The table prefills B6. The consultant can change it, and the change is audited.
