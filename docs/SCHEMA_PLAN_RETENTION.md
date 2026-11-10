# Plan: retention notices and destruction (spec §6.6.3, AC-6.5, UT-44)

**Status:** proposed, not built. Needs approval because it adds schema, a database function that permanently deletes data, and a scheduled job.
**Date:** 12 October 2026

## What the spec requires

- Response-level data is destroyed 24 months after the assessment window closes, unless the client asked in writing, before expiry, for something else.
- The client admin is notified 90 and 30 days before.
- An immutable destruction certificate is issued, and the event is audited.
- Aggregates (scores, findings, plans, segment metrics at 5 or more) contain no response rows and are kept for the client relationship plus 24 months. They are destroyed earlier only on written request (D-08). This plan does not touch aggregates.
- The consent text already promises this to every respondent ("kept for 24 months after the survey closes and then permanently destroyed"), so the platform has to be able to keep the promise.

## What counts as response-level data in this build

Destroyed:

| Table | Holds |
|---|---|
| `capture.response`, `response_allocation`, `response_item`, `response_text` | Survey answers and encrypted comments |
| `capture.response_360`, `response_360_item` | Leadership 360 ratings |
| `capture.invitation`, `capture.invitation_360` | Token hashes, expiry, submitted flags (person link is already nulled at submission) |
| `capture.consent_record` | Consent decisions (the consent guard trigger blocks deletes today) |

Kept (aggregates, no response rows): `score_object`, `evaluation`, `report`, `plan`, `action*`, `development_item`, `audit_log`, `segment_query_log`, `invitation_roster` (records only that a person was invited).

**Decision for you:** `leader_result` holds each named leader's 360 scores, computed from the ratings. The spec lists "rater ratings" for destruction but "findings, plans and action history" as kept. I propose we **keep `leader_result`** while the leader's development plan is active, and destroy it with the response data otherwise. The default in the build would be to destroy it at the same time as the ratings, which is the stricter reading. Say if you want it kept.

## Proposed schema (one migration)

1. `public.retention_hold(assessment_id, tenant_id, requested_by, reason, new_destroy_on, recorded_at)`: the client's written request, recorded by a Super Admin. Insert only. A hold must be recorded before the destruction date and moves the date.
2. `public.retention_notice(assessment_id, days_before, sent_at)`: unique per assessment and 90 or 30, so a notice goes out once.
3. `public.destruction_certificate(certificate_id, assessment_id, tenant_id, executed_at, executed_by, destroy_on, rows_removed jsonb, aggregates_hash text)`: insert only, readable by Super Admin and the tenant's Client Admin. `rows_removed` is counts per table. `aggregates_hash` is the stored score hash that survives, so the certificate shows the aggregates were left alone.
4. `public.rpc_retention_due(p_today date)`: for each launched assessment, `window_close + 24 months` (the engine's `retentionSchedule`, not a second copy of the rule), moved by any hold. Returns assessments needing a 90 day notice, a 30 day notice, or destruction. Service role only.
5. `capture.destroy_assessment_responses(p_assessment_id, p_actor)`: security definer, owned by the same restricted role as the other capture functions. It refuses unless today is on or after the destruction date and there is no later hold. It deletes the tables above in one transaction, writes the certificate and an `audit_log` row (`retention.destroyed`), and returns the certificate id. The consent guard trigger gets an exception only inside this function (a session flag, not a role grant).
6. `public.rpc_destroy_assessment_responses` as the service-role-only wrapper, like the other `rpc_*` functions.

## Proposed app work

- `lib/retention.ts` calls the engine's `retentionSchedule` for dates. No dates or thresholds in app code.
- `GET /v1/jobs/retention` (Vercel cron, daily, secret header like any cron route): calls `rpc_retention_due`, sends notices through the email layer once it exists (until then it records the notice as pending and shows it on a Super Admin screen), and runs destruction for anything due.
- `POST /v1/assessments/{id}/retention-hold` (Super Admin): records a hold.
- Super Admin screen "Retention": per assessment, destruction date, notices sent, holds, certificates. Client Admin sees their own certificate.
- Certificate download as a small PDF using the existing PAC export style.

## What I will not do without a further yes

- Run destruction against any real client's data. The job will have a dry-run mode and ship **disabled**; turning it on is a separate step for you.
- Change the 24 month period (it is a config value, `retention.response_months`).

## Tests

- UT-44 as a database test: a seeded assessment closed 24 months and a day ago, no hold: response tables empty for it, certificate row present, score object and report untouched, hash matches.
- Destruction refused before the date, refused with a later hold, idempotent on a second run.
- A hold recorded after the date is refused.
- Notices: 90 day and 30 day each sent once.
- Role checks: Client Admin cannot read responses, can read their certificate, cannot record a hold; other tenants see nothing.
- The existing `e2e-live`, `e2e-launch` and AC-2.4 style checks still pass (no change to submit or unlink).

## Open questions

1. Keep or destroy `leader_result` (see above).
2. Who records a client's written request for a different term: Super Admin only (proposed), or also the assigned consultant?
3. Notices go to the Client Admin only, per the spec. Should the assigned consultant also be copied?
4. Email is not built. Until it is, notices appear on the Super Admin Retention screen and in the audit log. Is that acceptable for the first client?
