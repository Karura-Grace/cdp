# Engine handoff: status, evidence, deviations

Date: 2 October 2026 · Engine 2.0.0 · Spec PAC/CDP/TECH/001 v2.1 · Instrument 1.1 · Rules 2.0

## Evidence

| Check | Result |
|---|---|
| Appendix D unit tests UT-01 … UT-62 | All present by ID in `test/spec.test.ts`, all passing |
| Engine-owned acceptance criteria (AC-1.x … AC-6.x) | `test/acceptance.test.ts`, all passing |
| Oracle parity | 122 cases (fixture, fixture with 360, 120 seeded random datasets): payload hash byte-identical to Python; evaluation and plan deep-equal |
| Welch t-test | 60 cases vs scipy, |Δp| < 1e-9 |
| Determinism (AC-3.2) | 100 re-runs of the fixture, one hash |
| Coverage | 98.4% lines, 84.9% branches |
| Total | 249 tests passing; `tsc --noEmit` clean |

## Reference fixture values reproduced

TPS 3.085 → **3.09** ENABLEMENT_REQUIRED, PROVISIONAL (coverage 0) · NOW 22/14/34/30, PREFERRED 31/25/28/16 · gaps +9/+11/−6/−14 · strength 9.0 MODERATE · congruence 4 of 6 (66.7%), lenses 2 of 3 · D7/D8/D9 3.2/2.8/3.1 · eOS index 7.1 · C1 MISS 50.0% (Override 2) · C2 MISS rank 3, 14.0 SUBSTANTIVE, escalated with SHADOW_CULTURE · C3 SYSTEMIC_MISS with identity risk · C4 PARTIAL_HIT 86.7% (Override 1) · scenarios SC-05, SC-01, SC-10 · plan: priority zero with 3 items, INNOVATE (release GOVERN), ENGAGE (release PERFORM, diagonal via GOVERN, C3 levers), GOVERN · illustrative leader LRI 2.92, fit 91.44 MIRRORED, NEUTRAL, safety flag, F blind spot.

## Spec inconsistency to raise with PAC faculty

**Table 9 cohort rows do not reconcile with the organisation row.** Executive NOW ENGAGE 30 (n = 11) and staff 19 (n = 430) give an organisation mean of (11×30 + 430×19) ÷ 441 = 19.3, not 22. No dataset can reproduce both. The seeded dataset reproduces the organisation row and every dimension exactly, so its executive–staff gaps are 8.2 / 2.0 / 2.0 / 8.2 rather than the worked example's 11 / 3 / 3 / 11. The flags are identical: SHADOW_CULTURE on ENGAGE and GOVERN only. The 11 / 3 / 3 / 11 example is still tested directly on the spec's cohort profiles. Recommend PAC corrects Table 9 at the next spec revision.

## Deviations from the zip's Python engine (fixed in both engines)

The Python engine in `cdp-platform.zip` was copied to `oracle/cdp_oracle/` and patched where it departed from the specification. The TypeScript port implements the specification. The oracle carries the same patches, so parity still holds.

| ID | Where | Python did | Spec says (now implemented) |
|---|---|---|---|
| P1 | score object | No reason when the perception gap is not computed | `perception_not_computed_reason` (UT-21, Table 40) |
| P2 | score object | Leader results not frozen with the score | `leader_results` in the payload, sorted by assignment (Table 40) |
| P3 | 360 groups | OTHER group never published | Any group with ≥ 3 raters is published; SUPERIOR always merges (Table 49) |
| P4 | carrier class | Any flag (including change capacity) blocked CULTURE_CARRIER | Only hard flags (integrity, safety) block it (Table 56) |
| P5 | planning | STRENGTHEN priorities got the MODERATE overplay narrative | STRENGTHEN priorities get the origin → target pathway, with no trade-off |
| P6 | priority zero | One item per blocking finding (5 for the fixture) | One item per gate, carrying its finding IDs (3 for the fixture, AC-5.1) |
| P7 | rounding | Could present signed zero ("-0.00") | Zero is always unsigned |

## Added in the TypeScript engine (not in the Python)

- Combination floor and roll-up (`resolveSegment`, UT-28), and differencing applied in heatmaps (the Python function was never called).
- The segment metrics bundle, including segment TPS over leaders inside the segment, and the leader–culture link with team → parent fallback and its label.
- Scenarios SC-06, SC-07 and SC-08, plus SUBCULTURE, segment ENGAGEMENT_MISS and LEADER_FLAG findings. These are appended after organisation findings, so organisation finding IDs never change.
- PLAN_INCOHERENT (UT-23), mandatory companions (AC-5.6), level caps with tenant override (D-05), and the Leader Development Plan draft.
- The escalation ladder now fires the tier owner at exactly 21 days, where the Python fired at 22. It also adds the 7-day reminder and the CEO escalation for a missed visible signal.
- Capture validation, the engagement state machine, org graph V1–V7, pre-flight L1–L8, the reminder plan, extension rules, release and export rules, and the AI guardrail screens.

## Known limits (the platform builds these, not the engine)

- Response-level destruction (UT-44) is a database job. The engine provides the dates (`retentionSchedule`), and the platform deletes the rows and issues the certificate.
- Segment cubes for standard axes: `heatmap` computes them on demand. Persist them on score freeze if p95 < 3 s needs it.
- Unit-level action generation (§5.5.6, "Unit" row): the engine generates organisation actions and LDP drafts. Unit actions (≤ 3 per unit) come from confirmed sub-cultures and use `assertCap("UNIT", n)`.
- `config.withTenant` is synchronous module state. Call it around a synchronous engine call only, never across an `await`.
