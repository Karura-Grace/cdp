# Workplan and automation: design (for the owner to approve)

Status: DRAFT, 23 October 2026. Nothing here is built. It follows Erick Ngala comments 10, 11 and 26 and the owner's answers Q-WP1 to Q-WP4 in `context-sessions/DECISIONS-LOG.md`.

## What you decided
- Every client project has a workplan: dated steps the system runs on its own, at the date and time set.
- Steps run by the system: send the survey and 360 links; reminders and the window close; freeze, score, findings and the report draft after the close; and the plan opening to the client at release.
- Release stays the consultant's act. The consultant reviews the finished report, then releases it, downloads it and sends it.
- The Client Admin and the consultant agree the schedule together. Both can edit it until launch.
- If a step cannot go ahead it pauses. The consultant and the Super Admin are told and must fix it and resume. Nothing half done goes out.
- Alerts: the consultant by email and on the Overview; the Super Admin by email when a step pauses; the Client Admin by email when links go out and when results are ready for release.

## Design

### 1. The workplan (schema, needs approval)
New table `workplan_step (engagement_id, step, run_at, status, paused_reason, started_at, done_at, set_by, set_at)`, one row per step per engagement. Steps, in order:
1. `SEND_LINKS`: issue and email the survey links to the roster.
2. `SEND_360_LINKS`: issue and email the 360 links (only if the client has Leadership 360).
3. `CLOSE_AND_SCORE`: at the window close, freeze the data, auto submit drafts, score, freeze the score, run the findings, create the report and its system drafted text. One run, in that order.
4. Reminders are not a step: they already follow the window (daily job) and keep doing so.
5. `OPEN_PLAN`: at release the plan is built and opens to the client (this one fires when the consultant releases, not on a date).
`run_at` is a date and time in the client's time zone (`tenant.timezone`), moved off the client's holidays and weekends only if the consultant asks. Status: SCHEDULED, RUNNING, DONE, PAUSED, CANCELLED. Rows are written through a function that checks the caller; history is kept in an insert only `workplan_event` table.

### 2. The runner
A job route `/v1/jobs/workplan` (same CRON_SECRET guard as reminders) claims every step that is due and SCHEDULED, once, in the database (`for update skip locked`, like `claim_reminders`), then runs it. Each step calls the same code the buttons call today, moved out of the route handlers into library functions (freeze, score, evaluate, report draft, link issue) so a click and the job do exactly the same thing. The audit log records the actor as the system.

### 3. When a step cannot run, it pauses
Pause reasons, each said in plain words: setup not agreed or launch checks failing; fewer valid responses than the reporting floor; a scoring input missing (for example an unresolved Section F tie); a freeze or score error; no email service configured. The step goes to PAUSED with the reason, nothing after it runs, and the people in Q-WP4 are emailed. The consultant (or Super Admin) fixes the cause and presses Resume, which sets it back to SCHEDULED for now. An unexpected error pauses it too, with the error kept in `workplan_event` (never answers, never tokens).

### 4. Alerts
Emails use the existing sender (hello@pac.africa). Content: the step that ran or paused, the client, the time, the reason if paused, and a link to the engagement. No results, no scores, no names of respondents. The Overview gets a Workplan card: each step, its date and time, its state, and a Resume or Edit button for those who may.

### 5. Editing rights
Client Admin and consultant may add, change and cancel steps until the assessment is launched. After launch only the consultant and Super Admin may move a step that has not run yet. A step that has run cannot be edited.

## Open points for you
1. **How often the runner can run.** Vercel cron on this project is daily today. "At a date and time" needs it to run every 15 minutes, which needs the Vercel Pro plan or a call from another scheduler (for example `pg_cron` calling the route). Which do you want? Without it a step runs at the next daily run after its time.
2. **Who sends the 360 links and when.** The 360 links depend on the raters being chosen first. Should the system refuse to send them until every leader has a supervisor, peers and direct reports (it would pause with that reason)?
3. **Email each person their link.** Today the consultant ticks this box when issuing links. In the workplan this becomes a setting of the SEND_LINKS step. Default on or off?
4. **Outside consultants.** Comment 26 says forms are sent by the PAC consultant or a consultant outside PAC. Does an outside consultant sign in to the platform as a PAC Consultant, or is the schedule just in their name?
5. **A paused step and the window.** If CLOSE_AND_SCORE pauses, the window stays closed and no responses are accepted. Is that right, or should the consultant be able to reopen it (the extensions rule already allows any extension)?

## Build slices
1. Move freeze, score, findings, report draft and link issue into library functions; routes call them. No behaviour change, all suites pass.
2. Schema and writers for the workplan, events and RLS tests per role.
3. The runner route and its pause logic, tested on a simulated clock like reminders (`?now=`).
4. The Workplan card on the Overview and the editing rules; alert emails.
5. e2e: a client run from launch to a drafted report with no clicks, a pause and resume, and the rights per role.
