# Oracle

`cdp_oracle/` is the Python engine from the original `cdp-platform.zip`, patched (P1–P7 in `docs/ENGINE_HANDOFF.md`) so it matches the specification. It is a test reference only and never runs in production.

`dump.py` writes `cases/*.json` (inputs plus Python outputs) and `cases/welch.json` (scipy p-values). `test/oracle.test.ts` requires the TypeScript engine to reproduce them exactly.

Rule: any change to engine behaviour is made in **both** engines in the same PR, then `npm run oracle:generate`. CI fails if the regenerated cases differ from the committed ones, or if the TypeScript output differs from the cases.
