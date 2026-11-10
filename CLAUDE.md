# CDP Platform — build instructions for Claude Code

You are building the **Culture Dynamics Profile (CDP) Platform** for PAC Africa (Priority Activator Consulting). The build brief (decisions, scope, phases) is the CDP Platform Build Brief: Full Six-Stage Build doc; this file carries everything in it that you need. The authoritative specification is `docs/spec/CDP_Platform_Developer_Specification_v2_1.md` (PAC/CDP/TECH/001 v2.1, the `.docx` beside it is the same document). Where anything here conflicts with the spec, the spec wins. Raise the conflict; don't silently pick a side.

## 1. What already exists — do not rebuild it

`packages/cdp-engine` is the **finished, tested deterministic engine**: every Stage 3–6 calculation, the C1–C4 rules, scenarios, planning, workflow rules, segment suppression, capture validation, the engagement state machine, pre-flight, and the AI guardrail screens. It has 249 passing tests, including every Appendix D test UT-01…UT-62 by ID, and a byte-identical cross-check against a Python reference on 122 datasets. Read `packages/cdp-engine/README.md` and `packages/cdp-engine/docs/ENGINE_HANDOFF.md` first.

Rules for the engine:
- **Never re-implement a formula, threshold or rule in the app.** Call the engine. If something is missing, add it to the engine with tests, in **both** `src/` and `oracle/cdp_oracle/`, then run `npm run oracle:generate`.
- Never edit `oracle/cases/*.json` by hand. CI regenerates them and fails on any diff.
- Engine inputs and outputs carry `Decimal` values. Persist the **canonical payload** (`toJsonable`), and serve numbers as the strings it contains. Never pass a score through a JS `number`.
- The engine needs `node:crypto`. Run engine-calling route handlers on the Node runtime (`export const runtime = "nodejs"`), never Edge.

`reference/` holds the original FastAPI prototype zip and the static demo HTML. Use them as **UI and flow reference only**. Their API, data model and access control fall short of the spec (no tenancy, release-gate leaks, live recomputation instead of the frozen score object). `seed/item_bank_1_1.json` is the instrument seed (Appendix C).

## 2. Stack (PAC Africa standard)

- **Next.js (App Router) + TypeScript** monorepo: `apps/web`, plus `packages/cdp-engine`. The `/v1` REST API is Next.js route handlers under `apps/web/app/v1/...`.
- **Supabase**: Postgres, Auth, Storage and `pg_cron`. **RLS is the enforcement boundary. No Prisma.** Use typed queries with `supabase-js` (`supabase gen types`) and SQL migrations in `supabase/migrations`.
- **Vercel** for hosting, with Vercel Cron and/or `pg_cron` for scheduled jobs.
- **Region:** Supabase has no African region. Use one EU region for DB and Storage and record the tenant transfer basis (spec §1.4.5, D-04). Store evidence files in **Supabase Storage in the same region**. Using R2 or any other store needs its own recorded transfer basis.
- Exports: PPTX with **native charts** (`pptxgenjs`), XLSX (`exceljs`), and PDF rendered server-side from the released version.
- AI narrative: Anthropic API, called server-side only, with the model and prompt version pinned in the rules version (§4.8).

## 3. Non-negotiables (spec §0.8) and how to enforce them here

| Rule | Enforcement in this stack |
|---|---|
| No role or service account can read an individual response or rater response | Response tables live in schema `capture`. `anon`, `authenticated` and the app's service role get **no** SELECT on `capture`. Writes go only through `capture.submit_response(...)` (`SECURITY DEFINER`), which validates the token hash, re-runs constant-sum and scale checks, writes rows against the demographic snapshot, and nulls `invitation.person_id` in the **same transaction**. Reads go only through `capture.frozen_response_set(assessment_id)`, owned by a `scoring_reader` role and callable only by the scoring job after freeze. It returns engine input rows with **no IDs that join to people**. |
| Scoring is pure, deterministic and version-pinned | `/v1/assessments/{id}/score` loads the frozen set, calls `scoreAssessment`, stores `payload` + `payload_hash`, and is idempotent: the same hash means no new version. |
| Every client-visible number traces to the frozen score object | Findings, reports, segments, dashboards and AI drafts read **only** the frozen `score_object.payload` and the stored `evaluation`/`plan`. Never recompute from responses at read time (the prototype's main defect). |
| Reporting floors enforced at the API boundary | Segment endpoints call `segmentMetrics` / `heatmap`, catch `Suppressed`, and return **409 `BELOW_REPORTING_THRESHOLD`** with the roll-up. Every query is logged to the insert-only `segment_query_log`. |
| Every threshold comes from configuration | Engine `config` + `RULES_2_0`. App code never contains a threshold literal. |
| No report reaches a client role before release | RLS: client roles can `SELECT` scores, findings, plans, actions and dashboards for an assessment only `WHERE EXISTS (released report)`. The prototype leaked these. Test every role. |
| No action published over an open blocking gate | `PATCH /v1/actions/{id}` → engine `transition(..., { openGates: blockedBy(priority, evaluation) minus completed P0 items })`. |
| Leader outputs never exported into performance, pay, succession or discipline | `checkExport` on every export, with the context parameter required. The people-lead read is audit-logged (D-13). |
| Terminology gate on every build | `node packages/cdp-engine/scripts/terminology-gate.mjs .` in CI, with the deny-list from the `CDP_DENY_LIST` secret. It fails closed when the secret is missing. Never commit the list. |

## 4. Identity, roles and tenancy

- Staff roles (Super Admin, PAC Consultant, Client Admin, Executive, People Leader, Coach) use Supabase Auth with **MFA required** (TOTP). RLS checks `auth.jwt()->>'aal' = 'aal2'` for every non-respondent policy. OIDC/SAML SSO is per tenant (spec Table 5).
- Put `tenant_id`, `role`, `is_people_lead` and `person_id` in the JWT through a **custom access token hook** that reads `app.membership`. PAC roles are granted **per engagement and time-boxed** in `app.engagement_assignment(user_id, engagement_id, role, from, to)`. RLS checks that table with `now()` inside the window.
- Every client table carries `tenant_id`, and every policy filters on it. A user with no membership sees nothing.
- **Respondents and raters do not log in.** They hold a single-use 128-bit token, and only its SHA-256 hash is stored. Survey routes call `SECURITY DEFINER` RPCs that take the token. Expired or used tokens return 410 with a neutral message.
- The permissions matrix is spec Table 7. Write one RLS test per cell (pgTAP or a Vitest suite that signs in as each role). The two override rules in §0.5 sit above the matrix.

## 5. Data model

Implement spec Appendix A in SQL with these decisions:
- Use prefixed opaque IDs (`ten_`, `eng_`, `asm_`, `rsp_`, `fnd_`, `pri_`, `act_`, `rep_`), never sequential integers.
- Every row has `created_at/by`, `updated_at/by`. `audit_log` and `segment_query_log` are insert-only: no UPDATE or DELETE grant to anyone.
- `capture.response_allocation`: `CHECK (points BETWEEN 0 AND 100)` plus a **deferred constraint trigger** asserting four rows summing to 100 per (response, scenario, perspective) (AC-2.2, database layer).
- Free text (`response_text`, `rater_text`, `leader_text`) is encrypted with Supabase Vault / pgsodium before insert.
- `score_object (assessment_id, version, payload jsonb, payload_hash, frozen_at, frozen_by)` is immutable after freeze, enforced by a trigger. Store `evaluation` and `plan` with the score version they came from.
- `tenant.residency_region` and `privacy_regime` are immutable after first launch (trigger).
- Setup sections A–I live in `setup_record (engagement, section, perspective EXECUTIVE|HR|AGREED, payload, status, workshop_date, participants)`. Only AGREED feeds `deriveSetup`. Launch locks them; a scoring-relevant change creates a new assessment version (AC-1.6).

## 6. API (`/v1`, spec Appendix B) → engine

Errors are RFC 7807 problem+json, using the codes in spec Appendix J. Engine `Problem` objects and `WorkflowError(code, status)` map straight to them. Use 409 for state conflicts and suppression, and 422 for validation.

| Endpoint | Engine call(s) |
|---|---|
| `PUT /engagements/{id}/org-graph` | `validateOrgGraph` (V1–V7, overrides with reasons) |
| `POST /engagements/{id}/setup/{section}/agree`, `GET …/requirements` | workshop-record check (422 `WORKSHOP_RECORD_MISSING`), `deriveSetup`, `leadershipTarget` (tie → refuse), `f1Divergence`, `f1BehaviourWarning` |
| `POST /assessments/{id}/preflight`, `…/launch` | `preflight` (L1–L8), `workingDays`, `checkEngagementTransition` |
| `GET/PUT /survey?token=` | `validateSurveyPayload`, `surveyProgress`, then `capture.submit_response` RPC; `validate360` for 360 forms |
| `POST /assessments/{id}/freeze` | refuse before window close; hash the canonical response set; engagement → SCORING |
| `POST /assessments/{id}/score`, `…/score/freeze` | `scoreLeaders` → `scoreAssessment` (store payload + hash), then freeze |
| `GET /assessments/{id}/segments?predicates=` | `classifyAll` on the frozen set + `segmentMetrics` / `heatmap`; `Suppressed` → 409 + log |
| `POST /assessments/{id}/evaluate`, `GET …/findings` | `evaluate(score, setup, { segments, leaders })`. Pass segment and leader signals from permitted segments and `leaderCultureLink` |
| `POST /assessments/{id}/plan` | `buildPlan`; persist priorities, P0 items, actions (DRAFT, `generated_by = RULES_ENGINE`) |
| `PATCH /actions/{id}`, transitions | `transition`, `validatePriorityEdit`, `assertCompanions`, `assertCap`, `blockedBy` |
| `POST /actions/{id}/kpi-readings`, `…/evidence`; dashboards | `rag`, `kpiProgress`, `escalation` |
| `POST /reports`, `…/narrative`, `…/release`, `GET …/export` | AI draft → `screenDraft` (with `payloadNumbers`, finding IDs, deny-list, small-group names) → consultant accepts; `checkRelease`; `checkExport` |
| `POST /pulses`, `GET /trends` | `validatePulse`, `pulseTriggers`, `otherTriggers`, `tradeOffVerification`, `comparability` (MAJOR → 409 `VERSION_INCOMPARABLE`) |
| Leader endpoints, LDP | `leaderCultureLink`, `leadershipPopulation` (≥ 5 valid), `draftDevelopmentPlan` |

Scheduled jobs (spec Appendix K events):
- reminders via `reminderSchedule`, stopping on submission
- escalation ladder daily via `escalation`
- visible-signal miss → CEO
- retention notices and destruction via `retentionSchedule`, with a destruction certificate
- pulse scheduling at 90 and 180 days

Emit the domain events in Appendix K to an `event_outbox` table, with idempotent consumers keyed on `event_id`.

## 7. Build order (spec Appendix E, adapted). Each phase is done only when its ACs pass in CI

1. **P1 Foundation:** monorepo, Supabase project and migrations, tenancy, roles, custom claims hook, MFA, the permissions-matrix RLS test suite, audit log, residency fields, the terminology gate in CI. Exit: AC-1.1, AC-1.2, and every cell of Table 7 tested.
2. **P2 Setup:** sections A–I with perspectives and workshop records, requirement derivation, scorecard, Section I, consent text versions, pre-flight and launch. Exit: AC-1.3…AC-1.7.
3. **P3 Capture:** item bank seeding with the locale model, the respondent journey API, the `capture` schema and RPCs, tokens and unlinking, 360 nomination and forms, reminders, monitors (counts only, cohorts ≥ 5), freeze. Exit: AC-2.1…AC-2.8. AC-2.4 needs a schema, grants and logs inspection test.
4. **P4–P5 Scoring and segments:** score and freeze endpoints, the segment API with 409s, the query log, leader results. Exit: AC-3.1…AC-3.6, plus a test that scoring the seeded fixture through the API reproduces the engine hash `sha256:…` stored in `oracle/cases/fixture.json`.
5. **P6–P7 Findings and reports:** evaluate, the findings console data, the report suite (all six types, §4.6), the narrative service with guardrails, release, and exports with watermark, version and hash. Exit: AC-4.1…AC-4.6.
6. **P8 Planning:** priorities, P0 register, action workflow, approvals by level, LDPs, RAG, escalation jobs, dashboards. Exit: AC-5.1…AC-5.7 through the API.
7. **P9 Re-assessment:** pulses, triggers, comparisons, trade-off verification, adjust-or-retire, rollover, retention and destruction jobs. Exit: AC-6.1…AC-6.6, including UT-44 as a database test.
8. **P10 Hardening:** load test (5,000 concurrent respondents, p95 < 2 s; scoring 5,000 responses < 10 min), the Appendix F checklist, pen-test fixes.

Work in small vertical slices. Ask for approval before any slice that touches DB schema, RLS, auth, tokens or unlinking.

## 8. Testing standard (spec Table 12, definition of done)

- Engine: `cd packages/cdp-engine && npm test` stays green on every PR.
- API contract tests for success **and every error code** listed for the endpoint.
- RLS tests per role for every new table.
- A full-engagement end-to-end test on the seeded fixture: SETUP → … → RE_ASSESSMENT, asserting the fixture headline values from `docs/ENGINE_HANDOFF.md`.
- Logs carry no personal data and never tokens or payload bodies.

## 9. Open items to confirm with Imran / PAC before the related phase

- **Live deployment (cpd-pac.vercel.app).** Confirm the exact URL; as given it returned a 404 on 2 Oct 2026. If it runs the prototype, its demo sign-in lets anyone choose the PAC Consultant role without a password. Restrict it before any real data is used, and confirm whether the new build replaces it on the same domain. Do not deploy the new build over it until Imran confirms.

- Supabase EU region choice, and who signs each tenant's transfer basis and DPIA (P1).
- Email sender and domain for invitations and reminders; whether SMS (Africa's Talking) is in scope (P3).
- The PAC-restricted terminology deny-list, supplied as a CI secret (P1).
- Anthropic data-retention terms on the API account; `ai.enabled` default per tenant (P7).
- Spec Table 9 cohort rows don't reconcile with the organisation row. See ENGINE_HANDOFF.md; faculty to correct.
