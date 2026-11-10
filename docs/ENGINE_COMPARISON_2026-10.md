# Engine comparison: specification, this platform, and the legacy prototype

**Date:** 16 October 2026
**Scope:** Whether the scoring in this platform agrees with the specification and with the legacy prototype's scoring code
**Method:** `scripts/compare-legacy-engine.mjs` feeds the 475 responses of the reference fixture through the legacy `analyse()` and compares each figure with the engine's expected score.

## Specification against this engine

Covered by tests that already run on every change: all 62 unit tests of Appendix D (UT-01 to UT-62) by ID, the fixture values of chapters 3 and 4, and 122 datasets scored by both the TypeScript engine and the Python reference with byte identical payload hashes. The determinism and the pinned version tests for scoring the same data again are not separate scripts (AC 3.2 and 3.3 are true by design; AC 3.3 is on the build list).

## Legacy scoring against this engine, same responses

| Figure | Result |
|---|---|
| NOW, PREFERRED and gap for all four orientations (12 figures) | Identical to four decimals |
| D7, D8, D9 readiness means | Identical to four decimals |
| Employee Orientation Survey, eight net scores | Identical |
| Executive against staff perception gaps | Agree within 0.05 (the legacy rounds to one decimal before showing) |
| Transformation Preparedness Score | Legacy 3.20, ours 3.09 |

Response counts agree: 463 with complete NOW answers and 441 with complete PREFERRED answers on both sides.

## The one difference, and why

The legacy computes Leadership Alignment as 5 minus 0.2 times the mean perception gap, which gives 3.97 on the fixture. This platform follows the specification: the term comes from the instrument alone until Leadership 360 results exist, gives 3.40 and marks the score provisional. With the 0.20 weight that moves the Transformation Preparedness Score from 3.09 to 3.20. This is a deliberate improvement in rigour, not a defect, and the legacy figure should not be quoted next to ours.

## Only one side has

- Legacy only: cultural entropy, a Culture Risk Index and two tensions. They use fixed numbers that the specification does not define, so they were left out. Adding them needs PAC to define the formulas.
- This platform only: culture strength and congruence, significance tests, response quality flags, the four alignment checks and their overrides, leader results, scenario matching, planning, and the reporting floors.

## Not yet compared

Legacy Hits and Misses checks (`hits-misses.mjs`), wave comparison and Leadership 360 scoring against ours; and specification Appendices A, B, F, I, J and K. Appendix D is covered above.
