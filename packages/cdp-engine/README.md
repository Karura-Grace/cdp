# @pac/cdp-engine

Deterministic core of the CDP Platform (spec PAC/CDP/TECH/001 v2.1 · instrument 1.1 · rules 2.0).
Pure TypeScript functions, `decimal.js` arithmetic with ROUND_HALF_UP presentation, no I/O, no clock, no randomness, no AI.

```bash
npm install
npm test                 # 249 tests: Appendix D UT-01…UT-62, acceptance criteria, oracle parity
npm run build            # dist/ (ESM + .d.ts)
npm run oracle:generate  # regenerate oracle cases from the Python reference (needs python3 + scipy)
```

| Module | Spec | What it does |
|---|---|---|
| `num`, `canonical` | §0.1, §3.4 | Decimal core, half-up `q()`, canonical JSON, `payloadHash` |
| `config`, `rules-data` | App. I, §5.5 | Configuration registry, rules 2.0 data (pathways, playbooks, tiers, workflow) |
| `scoring` | §2.6.3–4, §3.5 | Completion states, quality flags, profiles, gaps, dominance, strength, congruence, lenses, D7–D9, alpha, eOS, 360, LRI, TPS, perception, sub-culture, fit, carrier/blocker, `scoreAssessment` |
| `segments`, `suppression` | §3.5.12–13 | Segment metrics, heatmaps, floors, combination floor, differencing, roll-up, leader–culture link, leadership population |
| `checks` | §1.5, §4.5 | Requirements, C1–C4 with overrides, signals, severity, scenarios SC-01…SC-12, `evaluate` |
| `planning` | §5.5–5.6 | Priority zero, selection and cap, trade-offs, pathways, draft actions, scoring, companions, caps, LDP, workflow, RAG, escalation |
| `reassess` | §6.5–6.6 | Pulses, triggers, trade-off verification, adjust-or-retire, comparability, retention, rollover |
| `capture` | §0.6, §1.6, §2.6, §4.6 | Payload validation, engagement state machine, org graph V1–V7, pre-flight L1–L8, reminders, release and export rules |
| `guardrails` | §4.8, §0.2 | AI draft screens (numeric, terminology, traceability, causal, attribution), build-time terminology scan |

See `CLAUDE.md` for how the platform is built around this package and `docs/ENGINE_HANDOFF.md` for status and every deviation from the Python reference.
