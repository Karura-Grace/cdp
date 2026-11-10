# Specification cross check matrix

`requirements.csv` holds one row for every requirement in the developer specification v2.1 (PAC/CDP/TECH/001), chapters 0 to 6 and appendices A to K.
The summary is in `docs/SPEC_CROSSCHECK_2026-10.md` (PDF: PAC/CDP/RPT/003).

## Columns
`id`, `spec_ref`, `stage`, `kind`, `requirement`, `status`, `severity`, `evidence_code` (file:line), `evidence_test`, `decision_ref`, `notes`,
`status_auto` and `last_run` (written by the runner).

Statuses: Built, Partial, Missing, Differs by decision, Not applicable, Unverified (code found, no test yet).
Severities for anything not Built: Blocker, Non negotiable, Important, Minor.

## Re running
1. Build and start the local server: `npm run build` then `cd apps/web && npx next start --port 3100`.
2. `node scripts/conformance.mjs` runs the engine tests, the e2e suites and the probes, fills `status_auto` and `last_run`, and removes the test clients it created (backup kept).
   Options: `--only probes|engine|e2e`, `--keep-clients`, `--include-release`.
3. `node scripts/conformance/map.mjs` re maps the last run onto the matrix without running anything.

## Working files
`parts/*.csv` are the per chapter extracts, merged by `scripts/conformance/merge.mjs`. `verify-claims.mjs` checks cited code lines and tests,
`coverage.mjs` compares table rows and "shall" sentences in the spec with matrix rows, `report.mjs` generates the summary document.
