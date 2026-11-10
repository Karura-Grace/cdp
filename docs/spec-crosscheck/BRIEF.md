# Brief for the spec cross check helpers

You are checking the CDP platform (repo `~/cdp-platform`) against its developer specification
`docs/spec/CDP_Platform_Developer_Specification_v2_1.md` (PAC/CDP/TECH/001 v2.1). You get a line range of the spec.
Your job: turn every requirement in that range into rows of a CSV, find the code and test evidence for each, and give a status.

## Rules
- READ ONLY. Do not edit any file except your own output CSV. Do not run anything against the network or the database.
  You may run `grep`, `find`, `sed -n`, `cat`, `node -e` on local files, and `cd packages/cdp-engine && npx vitest run <file>` if you need to confirm a unit test passes.
- Atomic rows: one table row of the spec, or one sentence with shall / must / may not / never / only / required, or one screen id, field, calculation, rule, error code, event, config key, acceptance criterion or unit test, is one CSV row. Do not merge several requirements into one row. Long tables give many rows.
- Read the whole range. Every table row in the range must appear as at least one CSV row (prose that only explains needs no row).
- Evidence first, then status. Status values:
  - `Built`: you found the code (file:line) AND a test or check that exercises it (engine test name in `packages/cdp-engine/test/*.ts`, or a script check in `scripts/e2e-*.mjs` / `scripts/inspect-*.mjs` whose `ok("...")` label proves it). Quote the test file and the check label.
  - `Unverified`: code found, no test found.
  - `Partial`: some of the requirement is built, some is not. Say which part is missing in notes.
  - `Missing`: no code.
  - `Differs by decision`: built differently on purpose; cite the decision from the list below.
  - `Not applicable`: explain why (for example a delivery plan statement, not a product requirement).
- Severity for anything not `Built`: `Blocker` (the first client, under 50 people, English, cannot go live without it), `Non negotiable` (spec section 0.8 rules, privacy, anonymity, security, release gate, audit), `Important` (feature or acceptance criterion incomplete), `Minor` (wording, layout, nice to have). Leave empty for `Built` and `Not applicable`.
- Be honest and specific. A route that exists but returns the wrong error code is Partial, not Built. A UI screen the spec names that does not exist is Missing even if an API exists.

## Where things are
- App: `apps/web` (Next.js App Router). API routes `apps/web/app/v1/**/route.ts`. Pages `apps/web/app/**/page.tsx`. Libraries `apps/web/lib/*.ts`. Errors `apps/web/lib/problem.ts`.
- Engine: `packages/cdp-engine/src/*.ts` (config `src/config.ts`), Python oracle `packages/cdp-engine/oracle/cdp_oracle/*.py`, tests `packages/cdp-engine/test/*.ts` (`spec.test.ts` has UT-01 to UT-62 by id, `acceptance.test.ts` has AC tests).
- Database: `supabase/migrations/*.sql` (RLS, RPCs, triggers, capture schema). Types `apps/web/lib/supabase/database.types.ts`.
- End to end checks: `scripts/e2e-*.mjs`, `scripts/inspect-*.mjs`, `scripts/rehearsal-verify.mjs`. Each check is `ok("label", condition)`.
- Earlier reviews (may be stale, verify before trusting): `docs/CONFORMANCE.md`, `docs/GAPS.md`, `docs/REFERENCE_REVIEW_2026-10.md`, `docs/ENGINE_COMPARISON_2026-10.md`, `packages/cdp-engine/docs/ENGINE_HANDOFF.md`.

## Decisions on record (use for Differs by decision; cite the id)
- D-R2: files (evidence) are stored in Cloudflare R2, not Supabase Storage (approved 11 Oct 2026, migration 17).
- D-LOGO: client logo held on the tenant row (17 Oct 2026, migration 24).
- D-ANALYTICS: extra analytics block in the score payload (gap bands, entropy, tensions, dispersion, Culture Risk Index), payload versions 1 to 3 (16 and 17 Oct 2026).
- D-COHORT: cohorts from the org graph by grade (`is_executive`), no self selected cohort (17 Oct 2026).
- D-MFA: MFA (aal2) not enforced yet; parked until the owner gives a written yes.
- D-LAUNCH: the PAC consultant launches; the spec's split (consultant approves, Client Admin launches) is planned, not built.
- D-NARRATIVE: report text is written by the consultant plus a rule based PAC library; AI narrative comes after the first client.
- D-LANG: English only for the first client.
- D-SCORINGKEY: a separate `scoring_reader` key (`SCORING_KEY`) reads the frozen response set, the service role cannot (migration 23).
- D-SIGNUP: public sign up kept on by owner choice (11 Oct 2026).
- D-FULLREPORT: organisational report has a full length version and an executive brief (17 Oct 2026).

## Output
Write CSV to the path you are given, UTF-8, header exactly:
`id,spec_ref,stage,kind,requirement,status,severity,evidence_code,evidence_test,decision_ref,notes`
- `id`: stable and unique, e.g. `S1.4-012` (section then running number), `AC-1.3`, `UT-29`, `APPB-017`, `APPI-segments.floor`, `APPJ-BELOW_REPORTING_THRESHOLD`, `APPK-score.frozen`.
- `spec_ref`: section number and spec line, e.g. `1.4.2 L512`.
- `stage`: 0 to 6, or A to K for appendices.
- `kind`: rule, screen, field, calc, role, api, config, error, event, data, ac, ut, qa, ui, ip.
- Quote any field containing a comma, quote or newline (RFC 4180, double the quotes).
- When done, reply with: the CSV path, row count, counts by status, and the ten most serious gaps in one line each. Keep the reply under 400 words.
- D-NEUTRAL410: a used, expired or unknown survey link all answer 410 TOKEN_INVALID with one neutral message, so a link cannot be probed (CLAUDE.md section 4).
