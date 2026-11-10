# Build brief for helpers closing matrix rows

Project: CDP platform, repo ~/cdp-platform (npm workspaces apps/web Next 15, packages/cdp-engine). Read `CLAUDE.md` first (non negotiables, stack),
then the design for your journey in `docs/designs/`. The row list for your slice is in `docs/spec-crosscheck/requirements.csv` (columns id, spec_ref, requirement,
status, notes ...). The spec is `docs/spec/CDP_Platform_Developer_Specification_v2_1.md`; spec_ref gives the line.

## Rules
- Close the rows you are given completely: code plus an automated check (e2e script in `scripts/e2e-*.mjs` following the existing ones, or an engine test).
  Do not stop at the happy path: every refusal, error code and role cell in the row text gets a check.
- NEVER guess. If the spec, the design or an earlier decision does not answer something (wording, a list, a rule, a name, a number), do not invent it.
  Build the rest, leave that part as a clearly marked placeholder that blocks use (or is hidden), and list the question in your final report under "Questions".
- Migrations 20261018090000 to 098000 are already applied (setup perspectives, scorecard, calendar, demographics, data protection, retention, coach
  assignment, rater workflow, assessment versions) and `apps/web/lib/supabase/database.types.ts` is regenerated. If you need another schema change write a
  new migration file with a later timestamp, apply it with `node scripts/apply-migrations.mjs swnvjucteqguqdbsdmsl /mnt/c/Users/PAC/Desktop/MCain-Supabase-Token.txt`
  (prefix `NODE_OPTIONS="--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=4000"`), and regenerate the types the way the
  note at the top of your task says. Never touch auth, sign in, tokens or the unlinking of responses. Never read individual responses.
- Writes use admin() (service role) only after the role checks in `lib/staff.ts`; reads use the caller's client so RLS applies. New tables need an RLS read policy
  and a role check test. Errors are problem+json via `lib/problem.ts` with Appendix J codes. Audit with `lib/audit.ts`.
- Engine: never re implement a formula or threshold in the app. Engine changes go in `src/` and `oracle/cdp_oracle/` together, then `npm run oracle:generate`.
- UI: follow the existing console look (`app/console.css` classes, `StaffShell`). Plain English. No dashes or hyphenated words in text shown to people if avoidable.
  Do not run browsers or take screenshots.
- Other helpers work in parallel on other files. Only edit files in your slice. For a shared file (for example `setup-client.tsx`, `engagement-tabs.ts`, `preflight.ts`)
  make the smallest edit and put new UI in new files. Do NOT run `npm run build` or start servers (builds clash). Check types with
  `cd apps/web && npx tsc --noEmit` (build the engine first only if its dist is missing: `npm run build -w packages/cdp-engine`). The lead will build and run the e2e suites.
  Do not run e2e scripts that need a local server; you may write them and run `node --check`. Scripts that only talk to Supabase may be run.
- Do not commit or push. Do not print secrets. Files, comments and docs in plain English.

## What to return
1. Files changed and added.
2. A closure file `docs/spec-crosscheck/closures/<your-slice>.json`: a JSON list of `{ "id", "status", "severity" (if not Built), "evidence_code" (file:line), "evidence_test" (script and check label), "notes" }` for every row you worked on.
   Status Built only if code and a check exist. Anything you could not finish stays Partial or Missing with the reason in notes.
3. Questions for the owner (exact, answerable), and anything you saw that looks wrong.
