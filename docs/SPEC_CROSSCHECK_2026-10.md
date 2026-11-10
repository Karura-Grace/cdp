# Developer specification cross check
**Date:** 17 October 2026
**Scope:** The Culture Dynamics Profile platform against the developer specification v2.1 (PAC/CDP/TECH/001), every requirement row by row, chapters 0 to 6 and appendices A to K
**Status:** Report only. No fixes have been made. A proposed fix order is at the end for your approval.
**Matrix:** `docs/spec-crosscheck/requirements.csv`, 1676 requirements
---
## Summary

The specification was split into **1676 requirements**: every table row, every rule that says shall, must or never, every screen, field, calculation, acceptance criterion, unit test, configuration key, error code and event. Each was given a status and, where it is not built, a severity tied to the first client (under 50 people, English, live within four weeks).

| Status | Requirements | Share |
|---|---|---|
| Built | 909 | 54% |
| Partial | 398 | 24% |
| Missing | 157 | 9% |
| Unverified | 151 | 9% |
| Differs by decision | 37 | 2% |
| Not applicable | 24 | 1% |

**909 of 1652 applicable requirements (55%) are built and backed by a test or a check.** A further 37 differ from the specification on purpose, with the decision recorded. 151 have code but no test yet, and 555 are partial or missing.

What this means in plain terms:

- **The engine is the strongest part.** All 62 unit tests from Appendix D pass by their ids, the scoring and the four alignment checks are tested, and the TypeScript engine matches the independent Python version on 122 datasets.
- **The core loop works end to end** from setup to a released report and a plan, and from there to the next cycle.
- **The weakest parts are the surroundings of the loop:** scheduled work (reminders, escalation, retention and destruction, automatic pulses), the events that should drive them, the data protection records, role scoping for leader results, and several screens the specification names (debrief board, workshop mode, priority builder, findings console, score review).
- **Nothing found makes the first client impossible to start,** but 59 gaps are in the non negotiable group (privacy, anonymity, terminology, release gate, audit) and should be closed before real staff answers are collected.

## How the check was done

1. The specification was divided into blocks and each block read line by line. Every requirement became one row.
2. For each row the code (file and line) and the test or check that exercises it were found. **Built** needs both. A row with code and no test is **Unverified**.
3. The automated runner (`node scripts/conformance.mjs`) runs the engine tests, 30 test suites and probes, and marks each row it can prove or disprove. A verifier checks that every cited line and test exists, and downgrades a Built row whose test it cannot find.
4. Some rows were checked by reading the code myself, and ten random Built rows were opened by hand: eight were exact; two were weak (a blank cited line, a duplicate with the wrong code) and were corrected.
5. Live checks ran against a local build on the live database (throwaway clients, removed afterwards with a backup) and, read only, on culture.pac.africa.

Severity: **Blocker** means the first client cannot go live; **Non negotiable** means a rule from section 0.8 or a privacy, anonymity or security requirement; **Important** means a feature or acceptance criterion is incomplete; **Minor** means wording, layout or a nice to have.

## Status by stage

| Stage | Built | Partial | Missing | Unverified | By decision | Not applicable | Total |
|---|---|---|---|---|---|---|---|
| Foundations | 99 | 50 | 13 | 59 | 4 | 18 | 243 |
| Setup | 71 | 61 | 12 | 20 | 3 | 1 | 168 |
| Assessment | 48 | 39 | 13 | 7 | 4 | 0 | 111 |
| Scoring | 125 | 27 | 18 | 27 | 0 | 1 | 198 |
| Reporting | 43 | 50 | 12 | 11 | 21 | 1 | 138 |
| Advisory and action planning | 45 | 102 | 46 | 15 | 0 | 0 | 208 |
| Re assessment | 41 | 24 | 8 | 3 | 0 | 0 | 76 |
| Appendix A, data model | 39 | 7 | 3 | 0 | 2 | 0 | 51 |
| Appendix B, API | 16 | 6 | 6 | 0 | 0 | 0 | 28 |
| Appendix C, item bank | 203 | 2 | 0 | 0 | 0 | 0 | 205 |
| Appendix D, formulas and unit tests | 87 | 0 | 0 | 1 | 0 | 0 | 88 |
| Appendix E, delivery plan | 2 | 2 | 1 | 5 | 0 | 3 | 13 |
| Appendix F, QA and UAT | 6 | 5 | 5 | 1 | 1 | 0 | 18 |
| Appendix G, glossary | 15 | 10 | 0 | 2 | 0 | 0 | 27 |
| Appendix H, decisions | 7 | 8 | 0 | 0 | 1 | 0 | 16 |
| Appendix I, configuration | 43 | 0 | 3 | 0 | 0 | 0 | 46 |
| Appendix J, errors | 19 | 2 | 2 | 0 | 1 | 0 | 24 |
| Appendix K, events | 0 | 3 | 15 | 0 | 0 | 0 | 18 |

## Acceptance criteria

| Criterion | What it requires | Status | Severity |
|---|---|---|---|
| `AC-1.1` | A tenant and engagement can be created; residency and privacy regime immutable after first launch | Built |  |
| `AC-1.2` | Org graph import reports every `V1-V7` defect with row references; launch blocked until resolved or... | Partial | Important |
| `AC-1.3` | A section cannot move to Agreed without workshop date and two named executives; E, F and G store EXECUTIVE,... | Partial | Important |
| `AC-1.4` | Requirements derive exactly per §1.5.1 1.5.3; a tie blocks Section F agreement | Built |  |
| `AC-1.5` | Pre flight `L1-L6` block launch with a 422 naming the failed checks; `L7-L8` warn | Partial | Important |
| `AC-1.6` | Locked setup cannot be edited in any scoring field without creating a new assessment version | Partial | Important |
| `AC-1.7` | Every demographic attribute has an analytical purpose; free text demographics cannot be created | Missing | Non negotiable |
| `AC-2.1` | Respondent completes all 36 scenario sets on a 360 px mobile screen, keyboard only and with a screen reader | Partial | Important |
| `AC-2.2` | A non 100 scenario is rejected by the client, the API (422) and the database | Built |  |
| `AC-2.3` | Consent recorded before the first item renders; declining stores no response data | Built |  |
| `AC-2.4` | After submission no query, log or backup can join the response to a person (schema, grants and logs... | Partial | Non negotiable |
| `AC-2.5` | Reminders fire on schedule in a simulated clock test and stop on submission | Partial | Important |
| `AC-2.6` | Completion states and quality flags assigned exactly as 2.6.3 2.6.4 on a seeded dataset | Built |  |
| `AC-2.7` | Response rate views never show a cohort with fewer than 5 invited people | Partial | Non negotiable |
| `AC-2.8` | Freeze produces the manifest; scoring cannot start before freeze | Partial | Important |
| `AC-3.1` | Every fixture value in chapter 3 reproduced exactly (`UT-03` to `UT-13`, `UT-31` to `UT-37`, `UT-45` to... | Unverified | Important |
| `AC-3.2` | Scoring the same frozen dataset 100 times yields an identical payload hash | Built |  |
| `AC-3.3` | Re scoring a closed assessment after the rules version advances uses the pinned version and returns the... | Partial | Important |
| `AC-3.4` | All decimal arithmetic uses fixed point types and ROUND_HALF_UP; 3.085 presents as 3.09 | Built |  |
| `AC-3.5` | Every suppression path returns 409 with a reason and logs the query; differencing and combination tests pass... | Partial | Non negotiable |
| `AC-3.6` | No rater identity and no individual response is retrievable by any role or service account | Unverified | Important |
| `AC-4.1` | Fixture reproduces C1 MISS 50.0%, C2 MISS (rank 3, 14.0, SUBSTANTIVE), C3 SYSTEMIC MISS with identity risk,... | Built |  |
| `AC-4.2` | Balanced transition requirement never forces MISS through Override 2 | Built |  |
| `AC-4.3` | Scenario matching returns `SC-05`, `SC-01`, `SC-10` for the fixture, ordered by severity | Built |  |
| `AC-4.4` | Release refused with 422 when a mandatory section is empty or AI text is unaccepted | Built |  |
| `AC-4.5` | AI drafts with an unmatched number or a deny listed term are blocked and logged | Partial | Minor |
| `AC-4.6` | Exports exist only for released versions and carry the watermark, version and payload hash | Built |  |
| `AC-5.1` | Fixture produces exactly the plan skeleton: P0 with three items; INNOVATE ENGAGE GOVERN in order; trade offs... | Built |  |
| `AC-5.2` | Removing a BUILD's trade off returns 422 PlanIncoherent (`UT-23`) | Partial | Important |
| `AC-5.3` | Publishing an action on an orientation with open SHADOW_CULTURE gate returns 409 naming the pre condition... | Built |  |
| `AC-5.4` | Every transition in 5.6 enforced; every other returns 409 | Partial | Important |
| `AC-5.5` | Escalation ladder fires on schedule in simulated clock test; undelivered visible signal reaches the CEO | Partial | Important |
| `AC-5.6` | Generation refuses a priority missing visible signal system lever or BUILD trade off action and says which | Partial | Minor |
| `AC-5.7` | Leader outputs cannot be exported into performance remuneration succession or disciplinary contexts | Partial | Non negotiable |
| `AC-6.1` | Pulse with more than ten items, or any item outside the watch list, refused (422) (`UT-42`) | Built |  |
| `AC-6.2` | Each trigger in 6.5.1 raised on seeded data and requires accept or dismiss with reason | Built |  |
| `AC-6.3` | Trade off verification returns INTENDED, MIXED and unintended release outcomes on seeded cases | Partial | Important |
| `AC-6.4` | Comparison across a major version returns 409; across a minor version returns data with a warning (`UT-43`) | Partial | Important |
| `AC-6.5` | Destruction job removes every response level row and issues a certificate; aggregates contain no response... | Missing | Non negotiable |
| `AC-6.6` | Rollover produces a DRAFT setup, carried actions and backlog, and links the baseline | Built |  |

17 of 40 acceptance criteria are fully built. The others are partial because a part is missing; each is explained in the matrix notes.

## Blockers and non negotiable gaps

60 rows. The single Blocker is the hardening exit (penetration test, load test, accessibility audit), which is required before a go live and is on the go live checklist. The rest are non negotiable.

| Id | Status | Requirement | What is missing |
|---|---|---|---|
| `S0.2-001` | Partial | Platform uses PAC terminology only | The full length report table and the score payload use third party net score terms instead of Advocates, Neutrals, Critics. |
| `S0.2-002` | Partial | Terminology gate scans source, DB enums, seed, UI strings, locale files, report... | Runs in CI, but if the CDP_DENY_LIST secret is unset the workflow writes an empty file and the gate passes with 0 terms (fails closed only when the file is absent).... |
| `S0.2-004` | Partial | Metric names are PAC names: eOS with Advocates, Neutrals and Critics; TPS; LRI;... | TPS, LRI and scorecard used; eOS bands shown as Promoters/Passives/Detractors and 'net score'; Advocates/Neutrals/Critics never appear in the UI. |
| `S0.4-012` | Partial | Stores: in region per tenant, encryption in transit and at rest, field level encryption... | Free text encrypted and audit log append only; single EU region for all tenants (not per tenant, not Africa); no key rotation procedure found. |
| `S0.4-016` | Partial | Security: MFA for every non respondent role; optional SSO per tenant; OWASP ASVS L2;... | MFA parked by decision; no SSO; no pen test; secrets in Vercel env and Supabase Vault. |
| `S0.4-017` | Partial | Hosting in an African public cloud region (default South Africa) with per tenant... | Runs in one EU Supabase region (CLAUDE.md section 2), with a per tenant transfer basis recorded before launch; not an African region. |
| `S0.5-005` | Partial | Executive: released org and sub culture reports, leadership team aggregate, org plan and... | No sub culture or leadership team report for Executives; Executive reads every leader's 360, not only self and direct reports. |
| `S0.5-007` | Partial | Coach: leader reports and LDPs of assigned leaders only, for the assignment period | No coach to leader assignment or period; any Coach in the tenant reads every leader's development items after release, and no leader report. |
| `T7-leader.CA` | Partial | Leader report: Client Admin = R if people lead | Every Client Admin reads every leader result; the is_people_lead flag is never checked, the read is not audit logged and the screen has no ethical use statement. |
| `T7-leader.EX` | Partial | Leader report: Executive = R self + direct reports | Executives read all leaders' results, not only their own and their direct reports'. |
| `T7-leader.CO` | Partial | Leader report: Coach = R assigned | No coach assignment or period exists; Coach reads no leader result but reads every leader's development items after release. |
| `S0.8-NN4` | Partial | Non negotiable: every threshold read from configuration (Appendix I), never hard coded | Engine and app read config; but config is code (no runtime rules version), and the terminology/`D-11` '35 to 45 minutes' strings are literals in... |
| `S0.8-NN9` | Partial | Non negotiable: the terminology gate runs on every build and fails it on any hit | Runs in the engine workflow only; an unset secret yields an empty list that passes; Vercel builds do not run it; 'Promoters/Passives/Detractors' present in code. |
| `S0.8-DD4` | Partial | DoD Security: permission checks tested for every role in 0.5; audit entries written; no... | No per cell Table 7 suite; Coach and many deny cells untested (see T7 rows). |
| `APPG-10` | Partial | Glossary term used consistently in UI and reports: Advocates / Neutrals / Critics | Bands computed correctly but labelled Promoters / Passives / Detractors in the full report and payload. |
| `APPH-D-04` | Partial | Hosting African region with per tenant transfer basis; RPO 1 h, RTO 8 h; backups 35... | EU Supabase region with recorded transfer basis; backups and restore test not evidenced. |
| `APPH-D-08` | Partial | Response data destroyed at 24 months; aggregates kept relationship + 24 months; earlier... | Engine schedule only; no destruction job or certificate. |
| `APPH-D-13` | Partial | Coach scoped to assigned leaders and dates; people lead CHRO reads leader reports and... | No coach assignment or dates, no people lead gating, no read audit, no ethical use statement; export block exists in engine. |
| `S1-05` | Partial | Cohort and demographics: mark executive grades; define closed list demographic... | Executive grade flag and team size floor built. No demographic attribute definition (name, values, analytical purpose) and no cohort size preview beyond V5/V6. |
| `S1.4.1-015` | Missing | demographic_attribute: name, closed value list, is_sensitive, analytical_purpose... | No demographic_attribute table or screen. Segments use fixed org derived axes (department, team, grade, tenure band); no gender, age or other attributes, so nothing... |
| `S1.4.5-001` | Partial | Consent per respondent before first item renders, explicit, timestamped, against... | Consent gate and versioning built. Consent record timestamp is truncated to the day by design. Template wording for data categories, recipients and withdrawal not... |
| `S1.4.5-002` | Partial | Purpose limitation: assessment purpose stored on engagement and reproduced in consent;... | Export block built. No purpose field on the engagement; consent purpose comes from the template. |
| `S1.4.5-003` | Partial | Data minimisation: only demographics named in Section I with an analytical purpose can... | Only org derived attributes collected; no Section I declaration or analytical purpose recorded. |
| `S1.4.5-005` | Partial | Data subject rights: self service access, rectification of demographics, objection and... | Consent statement built. No self service access, rectification, objection or invitation erasure flow. |
| `S1.4.5-006` | Missing | Retention: 24 months from close then irreversible destruction of response level data;... | No job, notices or certificate in the app (outside Stage 1 delivery but stated here). |
| `S1.4.5-008` | Missing | Controller/processor: processing register, sub processor list, 72 hour breach workflow,... | None of these records exist. |
| `S1.4.5-009` | Partial | DPIA recorded on the tenant before first launch | Column exists; no way to set it and pre flight does not check it. |
| `S1.6.1-ovr` | Partial | Consultant may override a blocking rule only with a recorded reason; override listed in... | Override with reason built and snapshotted at launch. No check proves the override is printed in the report technical appendix. |
| `AC-1.7` | Missing | Every demographic attribute has an analytical purpose; free text demographics cannot be... | No demographic attributes can be created at all (so no free text either), but nothing records an analytical purpose for the fixed axes used. |
| `S2.1-004` | Partial | Scope: token lifecycle and identity unlinking | Unlink built, but timestamp side channel remains: see `AC-2.4`. |
| `S2.2-003` | Partial | Client Admin and PAC Consultant monitor response rates: counts and rates only, cohorts... | Client Admin sees no fielding view. The 360 leaders page shows per named leader 'Self form returned' and 'n of m raters returned', i.e. who has responded and cohorts... |
| `S2.6.5-001` | Partial | Unlinking: response written against the snapshot and person token link destroyed in the... | Same transaction unlink built. Gap: capture.invitation.submitted_at and capture.response.submitted_at are both now() of the same transaction, and invitation.sent_at... |
| `S2.6.5-005` | Partial | Monitoring: response rate views only for cohorts with 5+ invited and never list who has... | Survey view is total only (safe). The 360 page shows per named leader whether their self form was returned and per leader rater returns for groups below 5. |
| `AC-2.4` | Partial | After submission no query, log or backup can join the response to a person (schema,... | Grants hold: no migration grants anon, authenticated or service_role any table privilege on capture; only scoring_reader has SELECT (response, allocation, item,... |
| `AC-2.7` | Partial | Response rate views never show a cohort with fewer than 5 invited people | Culture survey view is safe by having no cohorts; the 360 progress view shows per leader counts below 5 and per leader self form status. |
| `S3.2-003` | Unverified | Change a score: nobody; scores are immutable | No test attempts to update or delete a score_object row (e2e 360 tests leader_result immutability only). Add a check that an UPDATE/DELETE of a frozen score_object fails. |
| `S3.5.10-012` | Missing | Integrity flag notified to the leader and the people lead Client Admin; development... | No notification or event to the leader or people lead on an integrity flag. |
| `S3.5.10-013` | Missing | Consent text on both 360 forms says the integrity flag leaves the development relationship | Consent wording not found. |
| `S3.5.12-017` | Partial | Primary floor: no culture segment reported below 5 valid responses (counted on the... | Floor checked on NOW responses; PREFERRED subset re checked. `D7-D9` and eOS subsets inside a permitted segment are not floored on their own counts. |
| `S3.5.12-022` | Partial | Query audit: every segment query logged with actor, predicates, resolved count and... | Log has no resolved count column and stores only the parent predicate plus axis; suppressed heatmap cells return inside a 200 (with reason and roll up), 409 only when... |
| `S3.5.13-017` | Partial | Classifications visible only to leader, coach, people lead Client Admin and PAC... | Export guard exists; classifications are never produced in the app (S3.5.13 005) so the visibility rule has nothing to apply to. leader_result is readable by EXECUTIVE... |
| `S3.6-014` | Unverified | A frozen score object is never modified; a re run after a void creates a new version | Same gap as `S3.2-003`: no test of the trigger. |
| `AC-3.5` | Partial | Every suppression path returns 409 with a reason and logs the query; differencing and... | Suppressed cells inside a heatmap come back in a 200 with reason and roll up rather than 409; log lacks the resolved count. |
| `S4.6-009` | Partial | Release gate: technical appendix present (response rate table, exclusions, suppression... | Presence is assumed, not checked. The appendix has versions, hashes and org graph overrides. Response rate and exclusions are in Method, not the appendix. No... |
| `S4.6-011` | Missing | Leader reports are released to the coach (or consultant) for a facilitated conversation;... | No leader report release flow and no record of the conversation. |
| `S5.6.2-006` | Partial | Never exported to remuneration succession or disciplinary processes | Engine guard tested; no export route passes kind LEADER_OUTPUT with a context, and there is no LDP export at all (so nothing leaves, but the guard is not on a path). |
| `AC-5.7` | Partial | Leader outputs cannot be exported into performance remuneration succession or... | Guard tested at engine level but not wired to a leader export path. |
| `S6.2-006` | Missing | Run retention and destruction jobs: System (scheduler); Super Admin monitors | Spec 6.6.3 and `AC-6.5` unmet. Schema change needs approval. |
| `S6.6-004` | Missing | Response level data destroyed 24 months after window close unless client asked for an... | No job and no alternative in writing record. |
| `S6.6-005` | Partial | Notifications at 90 and 30 days before destruction | Dates computed; nothing sends the notices. |
| `S6.6-006` | Missing | An immutable destruction certificate is issued | No certificate table or route. |
| `AC-6.5` | Missing | Destruction job removes every response level row and issues a certificate; aggregates... | Needs a database test. |
| `UT-44` | Partial | `UT-44` as a database test: destruction removes response level rows and issues a... | Engine date test passes; the database test required by CLAUDE.md phase 9 does not exist. |
| `APPE-P9` | Partial | P9 Re assessment exit: `AC-6.1` to `AC-6.6`; `UT-42` to `UT-44`, `UT-61` | `AC-6.5` destruction job and certificate missing. |
| `APPE-P10` | Missing | P10 Hardening exit: Appendix F signed off | Pen test, load test, accessibility audit and faculty UAT not done; see APPF rows. |
| `APPF-006` | Partial | Terminology: scan code, enumerations, seed data, UI strings, templates, chart legends,... | Gate runs in CI; secret presence and coverage of apps/web strings and prompts need owner confirmation; no Vercel build hook. |
| `APPF-010` | Partial | AI: seed a value and try to make the panel state another; request a causal claim;... | Engine guardrails tested; no end to end check (D NARRATIVE, AI not live). |
| `APPF-012` | Missing | Data protection: exercise every data subject right; advance the clock past retention;... | Same gap as `AC-6.5`. |
| `APPF-017` | Missing | Penetration test completed | Spec P10. |
| `APPA-demographic_attribute` | Missing | Table demographic_attribute exists with the Appendix A columns | No demographic attribute table (`AC-1.7`): cohorts come from the org graph; no recorded analytical purpose per attribute. |

## Important gaps by stage

The 332 important gaps are in the matrix. These are the ones that matter most in each stage (missing first).

### Foundations

44 important gaps. The first 8:

- `T7-org.PL` (missing): Org graph and leader mapping: People Leader = R own team. People Leader sees no graph; the team view shows team results only.
- `T7-sub.CA` (missing): Sub culture report: Client Admin = R. No released sub culture report for the client.
- `T7-sub.EX` (missing): Sub culture report: Executive = R. No released sub culture report for Executives.
- `T7-carrier.PAC` (missing): Carrier / blocker classification: PAC Consultant = R. Not stored in leader_result and not shown on any screen (no carrier/blocker in apps/web).
- `T7-carrier.CA` (missing): Carrier / blocker classification: Client Admin = R if people lead. Not exposed.
- `T7-carrier.PL` (missing): Carrier / blocker classification: People Leader = R self. Not exposed.
- `T7-carrier.CO` (missing): Carrier / blocker classification: Coach = R assigned. Not exposed.
- `T7-draft.CA` (missing): Draft actions: Client Admin = CRU. Client Admin cannot see, create or edit a draft action.

### Setup

36 important gaps. The first 8:

- `S1-07` (missing): Perspective comparison E, F, G: side by side executive and HR entries, divergence flag.... No API or UI writes EXECUTIVE or HR rows; no comparison screen; no divergence flags; SETUP_DIVERGENCE finding never produced.
- `S1.4.3-001` (missing): objective.title text(200), linked to one or more Section B priorities. No objective entity; L4 treats each B3 priority as an objective.
- `S1.5.4-004` (missing): Divergence (E, F, G): F1 share of tags differing between EXECUTIVE and HR; text fields.... Engine function exists; app never captures EXECUTIVE/HR entries, never calls it, no SETUP_DIVERGENCE finding.
- `L7` (missing): L7 invitation list matches ACTIVE persons in scope (difference report); warning. Named links are issued after launch from the roster, so no pre launch difference report exists.
- `S1.1-001` (partial): In scope: tenant and engagement creation, org graph and leader mapping, demographics,.... Scope summary; demographics (`S1-05`) and native scorecard objectives (`S1-09`) and 360 configuration UI (`S1-11`) are the parts not...
- `S1.1-002` (partial): No setup input may be pre filled by an individual or by HR in isolation; all positions.... Agreement needs a workshop record, but participants are free text names (not person records) and the only writer is the consultant on the...
- `S1.1-003` (partial): Sequence: B, C, D first; E, F, G captured separately by executive team and senior HR,.... Only the C before D dependency is enforced. No ordering of B/C/D before others; separate EXECUTIVE and HR capture for E, F, G is not built...
- `S1.2-003` (partial): Client Admin loads and maintains org graph, leader mapping, demographics, respondent.... Org graph and leaders: built for both roles. Demographic attributes do not exist (see S1.4.1 015). Respondent list: invitations are issued...

### Assessment

34 important gaps. The first 8:

- `S2.1-005` (missing): Scope: reminders and window management. No reminder job, no extension route; window pinned after launch.
- `S2.2-004` (missing): PAC Consultant monitors data quality and voids a response with a reason. No void route or UI, no exclusion log; voided_reason can never be set by the app.
- `S2.2-005` (missing): PAC Consultant extends the window once; a second extension requires the engagement lead. assessment_guard blocks window change after launch (ASSESSMENT_PINNED), so no extension is possible.
- `S2-16` (missing): Quality monitor: counts of each quality flag, median completion time, void action with.... Flag counts and median appear only in the score payload after freeze (scoring.ts quality block); no live monitor or void action.
- `S2.4-015` (missing): rater_text / self_text: encrypted, released to the leader only after consultant review. 
- `S2.6.2-003` (missing): Final reminder only to started not submitted tokens. Server never knows a token was started (no server drafts).
- `S2.6.2-004` (missing): Reminders stop on submission. 
- `S2.6.2-005` (missing): One extension by a PAC Consultant, up to 5 working days. Window pinned after launch.

### Scoring

30 important gaps. The first 8:

- `S3-02` (missing): `S3-02` Data quality panel: flag counts, exclusions by reason, internal consistency.... Payload carries flag counts and alpha; no screen shows them.
- `S3.4-011` (missing): segment_profiles: pre aggregated for every permitted segment in the standard axes;.... Score object has no segment_profiles block; segments are recomputed from the frozen set at read time (hash checked).
- `S3.5.3-005` (missing): KEEP_AND_PROTECT is written to Setup G5 as a system entry. Nothing writes system G5 entries after scoring.
- `S3.5.8-012` (missing): Alpha below 0.70 disclosed in the technical appendix. Alpha is in the payload but never shown in any report or appendix.
- `S3.5.11-012` (missing): Coverage is shown wherever the TPS is shown. No page or export prints coverage.
- `S3.5.13-005` (missing): Leader culture link computed for every valid leader and stored/served by the app. No route, page or stored payload holds fit, carrier class or influence measures; evaluate route passes no leader signals (Stage 4...
- `S3.2-002` (partial): Review scores, flags, exclusion log and segment suppression: PAC Consultant. Segment suppression review exists; there is no screen to review scores, quality flags or the exclusion log before a report is created (see...
- `S3.2-004` (partial): A consultant may void a response (Stage 2) and re run, creating a new score version with.... No void API or UI exists, so voided_reason can never be set; score_object has no column for the re run reason.

### Reporting

40 important gaps. The first 8:

- `S4.4-010` (missing): annotation: consultant annotation that never changes the verdict. No column, route or UI.
- `S4.5.2-005` (missing): SUBSTANTIVE recommendation: leadership workstream, 360 baseline and re measure,.... No intensity driven recommendation text. Planning may cover part of this (chapter 5).
- `S4.5.2-006` (missing): ENTRENCHED recommendation: workstream plus system levers and a leadership KPI carried at.... As above.
- `S4.5.3-003` (missing): contradiction_evidence: Setup H1/H3/H4 contradiction flags shown as evidence without.... stopStart and evaluate take no H flags, and the C3 finding evidence holds only the offending orientations.
- `S4.5.3-005` (missing): C3 PARTIAL_HIT response: redesign the contradicting mechanism within 90 days (ritual if.... There is no D4/D6 specific text. report library.ts:121 has only generic wording.
- `S4.5.4-010` (missing): Data quality signal INFO: response rate < 40%, exclusions > 10%, alpha < 0.70. No DATA_QUALITY finding and no thresholds in config.
- `S4.6-003` (missing): Sub culture Report for ExCo and unit heads. Cannot be created (reports route TYPES) and has no template.
- `S4.2-002` (partial): PAC Consultant reviews findings, annotates them and records H section contradiction flags. Can review findings. No annotation field or UI. H contradiction flags are captured in setup but never shown beside the findings.

### Advisory and action planning

85 important gaps. The first 8:

- `S5.3-001` (missing): Debrief board: findings ranked by severity with decision tree outcome per orientation;.... No debrief board page. Debrief is only a recorded flag on engagement advance (scripts/e2e lifecycle.mjs) and findings console elsewhere.
- `S5.3-003` (missing): Priority builder: candidates in engine order with reasons; cap indicator; trade off.... Priorities are immutable (trigger priority_immutable). No picker; pathway narrative and backlog are in plan.payload_json but not displayed...
- `S5.3-004` (missing): Workshop mode: projector friendly priority cards four level commitment matrix effort.... No workshop mode screen and no commitment matrix.
- `S5.4-010` (missing): four_level_commitments json individual team unit organisation more of less of start stop.... No column and no engine output.
- `S5.4-011` (missing): Priority status CANDIDATE SELECTED DEFERRED APPROVED PUBLISHED CLOSED. priority has no status column; deferred backlog only in plan payload.
- `S5.4-020` (missing): owner / sponsor one person each; sponsor senior to owner by grade rank. Free text names; not linked to people; no seniority check.
- `S5.4-023` (missing): milestones list >=2 for MEDIUM >=3 for STRUCTURAL each with due date and status. No milestone table; RAG milestone rules cannot run in the app.
- `S5.4-032` (missing): closure_outcome ACHIEVED PARTIALLY_ACHIEVED NOT_ACHIEVED SUPERSEDED. No column; closure needs only evidence.

### Re assessment

18 important gaps. The first 8:

- `S6-01.c` (missing): `S6-01` audience cohort with projected size. No audience predicate or projected size on the pulse table or builder.
- `S6-04.a` (missing): `S6-04` any permitted segment across cycles. Comparison is organisation level only; no segment trend and no aggregate_trend_record.
- `S6.4-006` (missing): aggregate_trend_record: record: organisation and segment metrics (n>=5) retained after.... Needed with the destruction job.
- `S6.6-007` (missing): Aggregate trend records retained for the client relationship plus 24 months; destroyed.... No retention clock and no erase on request route for aggregates.
- `S6.2-004` (partial): Take adjust or retire decisions: Sponsor at review; ExCo for RED four weeks items. Consultant records the decision; no sponsor or ExCo sign off and no RED four weeks ExCo route.
- `S6-01` (partial): Pulse builder: pick a priority; items only from its watch list; live item count (max.... No audience cohort or projected size: a pulse goes to every active person on the roster (pulses/[id]/open/route.ts:28). Schedule is a...
- `S6-04` (partial): Trend comparison: any metric, any permitted segment, across cycles; version banner;.... Organisation level only; no segment selection, no LRI distribution delta, MINOR banner unverified.
- `S6-04.b` (partial): `S6-04` version banner. Relation returned and stored; MINOR warning banner not verified in the UI. See `AC-6.4`.

## Rows with code but no test

151 requirements have code but no test or check that proves them. They are not known to be wrong; they are not yet proven. Most are role cells where access should be refused (Coach, audit log, anonymous respondents) and field validations. They are listed in the matrix with status Unverified, and closing them is mostly a matter of writing small probes.

| Stage | Unverified |
|---|---|
| Foundations | 59 |
| Setup | 20 |
| Assessment | 7 |
| Scoring | 27 |
| Reporting | 11 |
| Advisory and action planning | 15 |
| Re assessment | 3 |
| Appendix D, formulas and unit tests | 1 |
| Appendix E, delivery plan | 5 |
| Appendix F, QA and UAT | 1 |
| Appendix G, glossary | 2 |

## Departures by decision

37 requirements are built differently on purpose. They are not defects; each is tied to a recorded decision.

| Decision | Requirements | What was decided |
|---|---|---|
| `D-NARRATIVE` | 24 | Report text is written by the consultant plus a rule based PAC library; AI narrative comes after the first client. |
| `D-LANG` | 8 | English only for the first client. |
| `D-LAUNCH` | 3 | The PAC consultant launches; the split with the Client Admin is planned. |
| `D-COHORT` | 1 | Cohorts come from the organisation file by grade; people do not pick their own (17 October 2026). |
| `D-NEUTRAL410` | 1 | A used, expired or unknown survey link all answer 410 with one neutral message, so a link cannot be probed. |

## Built beyond the specification

These exist in the platform and the specification does not ask for them (they are not counted above):

- The engagement console: an Overview with a tab bar across every engagement page, and the Start here path with the setup checklist.
- The survey and Leadership 360 preview pages for consultants.
- The analytics block: gap bands, cultural entropy, tensions, spread of answers, the Culture Risk Index, values against reality, and the risk dashboard against PAC targets.
- The full length organisational report (about 35 pages), the executive brief, a 30 slide deck, a consultant note per chapter, and the client logo on reports.
- The rater context questions, the strongest and weakest behaviours, and reflection questions in leader results.
- The value at stake calculator, the Culture Map, and the home page and entry boxes.
- The Savanna Ridge showcase, the rehearsal guide and data, and the cleanup and conformance tooling.

## Proposed fix order

For your approval. Nothing below has been started.

**1. Before any real staff answer is collected (non negotiable)**

- Replace the third party terms in the full report and the score payload with the PAC terms (Advocates, Neutrals, Critics), make the terminology gate fail when its secret is missing, and run it on the web build. The report terms are mine, added on 17 October.
- Scope leader results as the specification says: Client Admin only as people lead, Executive only self and direct reports, Coach by assignment and dates, every read audited, and the ethical use statement.
- Close the timing side channel between invitations and responses, and stop the Leadership 360 page showing who has responded for groups under five.
- Retention: the destruction job, the 90 and 30 day notices and the certificate, with a database test (needs your approval for a schema change).
- Data protection records: demographic attributes with an analytical purpose, the DPIA record checked at launch, the processing register and the data subject rights path (schema changes, written design first).
- Segment suppression returns 409 in every path and the query log records the resolved count; test that a score cannot be changed; release gate checks the technical appendix; leader reports release to the coach first.

**2. Before the first client sees results (the experience)**

- The D7 readiness gate never blocks a priority (a defect found in this check).
- Reminders, the launch split (consultant approves, Client Admin launches), the score review screen, window extension, and the findings console with annotations.
- Run findings with segments and leaders so sub culture and leader signals appear in the product; wire the priority builder rules (`validatePriorityEdit`, companions, caps); the requirements endpoint.
- The scheduler: escalation, automatic pulses at 90 and 180 days, and the event outbox for the Appendix K events.

**3. Soon after the first client**

- The remaining report types (sub culture, leader, leadership team, action plan), XLSX export, role dashboards, the scorecard entity with import and export, trends by segment, and 360 open text.

**4. Go live hardening**

- Two step sign in (needs your written yes), the load test (5,000 respondents), the penetration test, an accessibility audit, a backup and restore test, and rate limiting.

## Automated checks

`node scripts/conformance.mjs` runs the engine tests, the end to end suites and the probes, writes the result against the matrix rows it can prove, and removes the test clients it created. `node scripts/conformance/merge.mjs` rebuilds the matrix from its parts, `verify-claims.mjs` checks every cited line and test, and `coverage.mjs` compares matrix rows with the specification text. The last full run (2026-10-17) made 1736 checks; 58 failed, and each failure is a row in the matrix.
