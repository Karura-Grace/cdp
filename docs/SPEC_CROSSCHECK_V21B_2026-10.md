# Cross check against the 17 October specification variant
**Date:** 18 October 2026
**Scope:** The Culture Dynamics Profile platform against the technical development document dated 17 October 2026 (PAC/CDP/TECH/001, final build baseline, Part A chapters 1 to 10 and Part B chapters 11 and 12), every requirement row by row
**Status:** Report only. No fixes have been made. Your rulings are in `docs/designs/V21B-decisions-2026-10-18.md`. The fix order is at the end for your approval.
**Matrix:** `docs/spec-crosscheck/requirements.csv`, 3090 requirements (1678 from the 1 October specification, 1412 new rows with ids starting N)
---
## Summary

The new document is not a small edit of version 2.1. It is organised by topic instead of by stage, it adds the report composition engine and the action planning reference (Part B), and it changes about 101 rules. Where the two conflict you ruled that the new text governs. Appendices C, I and K of the old specification still hold, and the new section 10.2 replaces appendix J.

| Status | New rows (17 October) | Old rows (1 October) |
|---|---|---|
| Built | 475 | 996 |
| Partial | 497 | 346 |
| Missing | 275 | 144 |
| Unverified | 88 | 133 |
| Differs by decision | 55 | 36 |
| Not applicable | 22 | 23 |
| Total | 1412 | 1678 |

Of the 860 new rows that are not built: 1 Blocker, 35 Non negotiable, 361 Important and 463 Minor.

The automated conformance run on 18 October covered 1720 checks and 55 failed. The failures sit in probes written for the old text, for example the speeding fraction, the 6 of 10 minimum for the 360 and Override 3. They are the same gaps this report lists, so they clear when the rules version 2.1 below is built.

## By chapter

| Chapter | Name | Rows | Built | Partial | Missing | Unverified | Differs | N/A |
|---|---|---|---|---|---|---|---|---|
| 0 | About this document | 30 | 10 | 9 | 0 | 3 | 0 | 8 |
| 1 | System set up | 103 | 49 | 33 | 3 | 10 | 8 | 0 |
| 2 | Organisational culture assessment | 128 | 80 | 27 | 11 | 8 | 0 | 2 |
| 3 | Sub culture and slice and dice | 51 | 10 | 10 | 21 | 9 | 0 | 1 |
| 4 | Leadership assessment | 43 | 26 | 8 | 5 | 4 | 0 | 0 |
| 5 | Linking leader reports to culture | 53 | 9 | 23 | 16 | 5 | 0 | 0 |
| 6 | Scenario reporting and guidance engine | 174 | 74 | 61 | 4 | 10 | 25 | 0 |
| 7 | Reports | 65 | 6 | 41 | 9 | 2 | 7 | 0 |
| 8 | Action planning module | 123 | 23 | 67 | 32 | 1 | 0 | 0 |
| 9 | Advisory roadmap | 31 | 3 | 21 | 6 | 0 | 0 | 1 |
| 10 | Build artefacts | 274 | 147 | 74 | 12 | 25 | 12 | 4 |
| 11 | Action planning reference (Part B) | 196 | 33 | 80 | 71 | 9 | 0 | 3 |
| 12 | Report composition engine (Part B) | 141 | 5 | 43 | 85 | 2 | 3 | 3 |

## What changed in the rules

These are the value level changes the code must follow. Each one is decided in the rulings document.

| Rule | Old text and code | New text | Ruling |
|---|---|---|---|
| Speeding | One third of the median | 40% of the median, or 8 minutes if higher | Adopt (`V-02`) |
| Quality exclusion | Speeding plus one other flag | Any two flags | Adopt, duplication counts (`V-02`) |
| Override 3 | Three overrides | Two overrides | Remove (`V-03`) |
| TPS precision | 4 decimals, unrounded | 2 decimals, half up | Switch (`V-04`) |
| 360 minimum, sections A to D | 6 of 10 | 3 | Lower to 3 (`V-05`) |
| LRI alignment term | Section F target | BUILD, then STRENGTHEN, then Section F | Implement (`V-06`) |
| Leader reports | All Client Admins and Executives | CHRO designate; Executives see directs only, no section 6 | Build, Client Admins keep access until a CHRO is named (`V-01`) |
| C3 STRENGTHEN | Supportive | Neutral | Neutral (`V-12`) |
| GOVERN trade off | Third priority | Trade off row only | Engine changes (`V-14`) |
| Survey labels | Neutral A to D chips | Orientation names | Show names (`V-08`) |
| Respondent bands | Promoters, Passives, Detractors | Advocates, Neutrals, Critics | Replace everywhere (`V-16`) |
| eOS display bands | Switch at 20 | Switch at 30 | Follow the new text |
| Sector and maturity drive C4 | B6 business model only | Sector and maturity drive C4 | Parked, owner supplies the mapping (`V-30`) |

## Non negotiable and Blocker gaps (new rows)

| Row | Status | Requirement |
|---|---|---|
| `N0.4-001` | Partial | Platform and document use PAC terminology only; no third party culture framework, instrument, quadrant taxonomy or survey... |
| `N0.4-002` | Partial | Deny list enforced in the build pipeline (10.7); no third party terminology in code identifiers, database enumerations, UI... |
| `N0.4-003` | Partial | eOS respondent bands are named Advocates, Neutrals and Critics; objectives sit on the client strategic scorecard |
| `N0.5-R11` | Partial | Rule 11 five respondents per culture segment, three raters per 360 rater group, combination floors and differencing protection;... |
| `N0.5-R14` | Partial | Rule 14 PAC terminology only; deny list enforced in the build pipeline and on every AI draft (0.4, 6.12.4) |
| `N1.1-017` | Partial | Regional hosting with data residency honoured per tenant |
| `N1.1-018` | Partial | Encryption in transit and at rest; field level encryption for free text responses; key rotation |
| `N1.3-EX` | Partial | Executive: released organisational and sub culture reports, leadership team aggregate, organisation wide action plan and... |
| `N1.3.1-LEADER` | Partial | Matrix: Leader report: Consultant R; Client Admin R (CHRO designate only); Executive R (self; directs sections 1 5, 7 10);... |
| `N3.6-PRIMARY` | Partial | Primary floor: no culture segment reported below five valid responses; 360 rater groups need three, below three merged into all... |
| `N3.6-DIFF` | Partial | A segment is suppressed if it can be derived by subtracting a reported segment from another and the residual falls below the... |
| `N3.6-AUDIT` | Partial | Every segment query is logged with actor, predicates, resolved count and suppression outcome |
| `N4.4-INTEG-ESC` | Missing | Integrity flag consequence: immediate attention and a specific development plan; reported to the leader and to the CHRO; the... |
| `N4.4-INTEG-CONSENT` | Missing | The consent text on both 360 forms must say the integrity flag escalates outside the development relationship |
| `N5.1-005` | Partial | Where a team profile is substituted upward, every index is computed on the substituted profile and the report must carry... |
| `N5.3-011` | Missing | Carrier and blocker classification is visible only to the leader, their assigned coach, the CHRO designate and the PAC Consultant |
| `N5.3-012` | Missing | Classification is labelled developmental and carries the ethical use statement on the same screen |
| `N5.3-013` | Partial | Classification is never exported into any performance, remuneration, succession or disciplinary context; the platform blocks the... |
| `N7.6-013` | Partial | No report, template, legend, axis label or footnote names or alludes to any third party framework, instrument or brand |
| `N8.6-010` | Partial | LDP visible to the leader, line manager, coach, CHRO and consultant; never used in a remuneration or disciplinary process;... |
| `N10.5-UT54` | Missing | `UT-54` CHRO designate scope: Client Admin without designation requests a leader report gives 403; the CHRO designate returns... |
| `N10.5-UT55` | Missing | `UT-55` Line manager view: executive opens a direct report's leader report gives sections 1 5 and 7 10 returned; section 6 (fit... |
| `N10.6-P1c` | Partial | P1 acceptance: every permission cell in 1.3.1 is enforced by an automated test |
| `N10.6-P6a` | Partial | P6 acceptance: `UT-30` to `UT-35`, `UT-53` to `UT-55` pass |
| `N10.6-P10a` | Missing | P10 scope: penetration test |
| `N10.7-06` | Partial | Intellectual property: search code, database enumerations, UI strings, report templates, chart legends and AI prompts for deny... |
| `N10.7-13` | Partial | Data protection: exercise every data subject right as a respondent; all routes work; platform states plainly that a submitted... |
| `N10.7-14` | Partial | Data protection: advance the clock past the 24 month retention expiry; destruction executes; certificate issued; no recoverable... |
| `N10.8-35` | Missing | Glossary: CHRO designate is the one named client user with read access to leader reports, development plans and leader... |
| `N10.9-D01` | Partial | `D-01` Role model: six roles plus two scoped designations (CHRO designate, assigned coach); executives see direct reports'... |
| `N10.9-D15` | Partial | `D-15` IP position: PAC terminology only; build pipeline and AI deny list (0.4; `UT-39`) |
| `N11.14-001` | Partial | Action plans address organisational culture, never individuals |
| `N11.14-004` | Partial | No culture finding, carrier or blocker classification or development plan is used in any performance, remuneration, succession... |
| `N12.6-006` | Partial | Release check: Numbers: every number in the narrative matches the findings payload (6.12.4) |
| `N12.6-007` | Partial | Release check: Language: terminology screen and causal language screen pass (6.12.4) |
| `N12.6-008` | Partial | Release check: Ethics: no leader classification, flag or development content appears outside the audiences permitted in 1.3 and... |

## Part B, the new material

Chapter 11 (the action planning reference with four playbooks) and chapter 12 (the report composition engine) are mostly new. 337 rows were checked: 38 are built. Thresholds, the stepping stone rule, the business model pairs and the worked example numbers already match. The library is still a code constant, with no library tables, no commitment matrix, no commitment charter or ExCo pack renderers and no outcome learning. You ruled that the first client needs the library as data and the structured section object, with fit scoring after.

## Proposed fix order

For your approval. Nothing below has been started.

**1. Rules version 2.1 and the engine (decisions `V-02` to `V-07`, `V-12`, `V-14`, `V-16`)**
Speeding and exclusion, Override 3 removed, 2 decimal TPS, the 360 minimum of 3, the LRI chain, the C3 STRENGTHEN rule, GOVERN trade off, the Advocates, Neutrals and Critics terms, and the terminology gate failing closed when its secret is missing. Both the engine and the Python oracle, oracle regenerated, a new rules version so every frozen result keeps its stored version.

**2. Leader access and privacy (`V-01`)**
CHRO designate column set by the consultant, Executives limited to directs and no section 6, audit of every read, the integrity flag escalation to the CHRO and the 360 consent wording, the ethical use statement and carrier visibility, the export guard on every leader export path, and RLS tests for `UT-54` and `UT-55`. Needs your approval of the schema change.

**3. Respondent and launch screens**
Orientation names on the survey (`V-08`), eOS bands, executive grade flag required before launch, reminders and window extension, void response and exclusion log, 360 free text items (`V-11`, needs your wording).

**4. Reports and exports (`V-41`)**
Findings wired to segments and leaders in the app, then the Sub culture, Leader, Leadership team and Action plan reports, the seven slide sub culture export, Excel, then Word. New palette and NOW and PREFERRED colours, footer wording without the dash (`V-15`), release gate of 8 checks.

**5. Action planning gaps**
Action record fields (milestones, linked finding, closure outcome, stored and declared RAG), unit level actions, four level commitments, readiness gate fixes (D7 blocks nothing, D9 blocks everything), reminders and the escalation ladder as jobs, role dashboards, the KPI culture alignment finding (`V-13`), the fifth lever (`V-23`), Leader Development Plan links.

**6. Chapter 12 library as data (`V-40`)**
Library tables, `reference_library_id` on actions, faculty edit with version pinning, the structured section object.

**7. Go live hardening**
Two step sign in (needs your written yes), 5,000 respondent load test, penetration test, accessibility audit, backup and restore test, rate limiting.

## Open points for the owner

- Wording for the 360 free text items (`V-11`).
- The sector and maturity to business model mapping (`V-30`).
- Rows that the new text supersedes keep their old ids and are noted with old: in the matrix notes.
- Reminder: hand over the second developer specification for a full cross check after all journeys end.
