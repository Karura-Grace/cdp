# n03 diff: new spec chapter 10 (L2629-3390) vs old spec v2.1 appendices

Old locations: Appendix A (schema), B/J (API, errors), D (formulas, unit tests), E (phases), F (QA), G (glossary), H (decisions).

## Value level changes (first)
- Speeding flag: new D-05 and 2.11 (L1013) say "below 40% of the median ... or below 8 minutes, whichever is higher"; old 2.6.4 (L860) said "higher of 8 minutes or one third of the median". Code uses 1/3. Also "total completion time" (new) vs "active completion time" (old).
- Override count: old had Override 3 (UT-52 "INNOVATE 30 but PERFORM 34 highest, capped PARTIAL_HIT"); new has two overrides only (6.3.2, glossary "two overrides"), and new UT-52 is half-up rounding. Engine still applies Override 3.
- Load criterion: old "scoring < 10 minutes" for a 5,000-response assessment; new "completes within the agreed window" (no number). p95 under 2 s unchanged.
- UT-22 priority cap: old "TPS 2.40 -> cap 2"; new "four candidates, TPS 3.09, one blocking flag -> cap 3, fourth deferred, reason 'deferred on readiness grounds'". Engine reason text is "readiness cap".
- UT-23: old "removing a BUILD's trade-off -> 422 PlanIncoherent"; new "all selected priorities BUILD, no negative gap available -> PlanIncoherent raised, no plan emitted".
- UT-19: new expected adds "HR systems redesign within 90 days"; glossary urgency tier for process contradiction is 1-6 months, behaviour gap 0-90 days (inconsistent, owner question).
- UT-33: old "people lead notified"; new "CHRO notified; development plan required".
- UT-44: new adds "scores retained only in the irreversibly aggregated trend record" (old: aggregates kept relationship + 24 months).
- UT-13: new adds "coverage 42% displayed; TPS labelled provisional".
- UT-30: new "Peers merged into 'all others'" (old: ALL_OTHERS) same rule; the rule for a merged group still below three is in 10.10 only.
- Priority score: new 10.4 `(impact * urgency) / effort` and design register D-11 still says "modifiers"; no modifiers in the formula.
- Sample JSON: staff cohort n 430 / NOW 19/13/35/33 does not reconcile with the organisation row (11x30 + 430x19)/441 != 22 (engine fixture has n 452).

## Unit test table: renumbered and re-scoped (L2806-3027)
- Old table had UT-01..UT-62; new 10.5 table has UT-01..UT-56. UT-57..UT-68 are defined in chapter 12 (L4885-4929), not in this table.
- Same id, same scenario: UT-01 to UT-22, UT-24 to UT-32, UT-34 to UT-36, UT-40 to UT-43, UT-45 to UT-50.
- Same id, different scenario: UT-23, UT-37 (now "re-score a closed assessment after the rules version advances"), UT-44, UT-51 (was C3 partial; now Override 2 excluded on transition), UT-52 (was Override 3; now half-up rounding), UT-53 (was LAGGING single case; now 1,000-leader exhaustiveness), UT-54 (was D7-D9 banding; now CHRO designate scope), UT-55 (was 360 observed minimum; now line-manager view), UT-56 (was quality exclusion; now reference-library draft).
- Removed from the table (tests still exist in the engine): old UT-54 D7-D9 banding on 1 dp, UT-55 360 observed minimum, UT-56 quality exclusion, UT-57 C1 multiple requirements, UT-58 urgency tiers, UT-59 plan skeleton, UT-60 illustrative leader, UT-61 trade-off verification, UT-62 action score. Old UT-51 (C3 partial) and UT-52 (Override 3) gone from the table.
- New: UT-54 (403 for Client Admin without designation, CHRO designate gets the report), UT-55 (section 6 withheld from executive viewing a direct report), UT-56.

## Schema (10.1, was Appendix A)
- New tables or fields: coach_assignment (assignment-scoped), tenant.chro_designate_id, tenant.dpo_signoff_at, tenant.maturity_stage, tenant.retention_expiry, tenant.governing_privacy_regime, division/department/location/team collapsed in one family row, reference_library (element_type list, tied to rules_version), segment_query_log with resolved_count and suppression_outcome, narrative_draft with prompt_version and model_version, leader_development_plan.cycle_start/end, setup_section "Section I lock blocks launch changes".
- Removed from old Appendix A rows: strategic_requirement, consent_record, self_rating, rater_response, rater_rating, leader_text, scenario_match, kpi_reading, trigger, org_change, comparison are not in the new table list (still built in code).
- Statement kept: "Every table carries created_at, created_by, updated_at, updated_by" and tenant scoping on every client table.

## API (10.2, replaces Appendix B and J)
- New text names 21 endpoints (old Appendix B/J had engagement-based routes and a separate error list). Paths differ from the code: spec is tenant and assessment centred (/v1/tenants/{id}/org-graph, /setup/{section}, /v1/assessments, /v1/reports, /v1/actions, /v1/pulses, /v1/trends, /v1/dashboards/{role}); code is engagement centred (/v1/engagements/{id}/...).
- New in this version: GET /v1/assessments/{id}/findings with filters; POST /v1/reports/{id}/narrative; GET /v1/dashboards/{role}; GET /v1/trends with warn/409; POST /v1/actions with 422 without linked_finding_id; export formats pdf|pptx|xlsx; segments `predicates=` free query.
- Error behaviours stated: 422 org graph defects; 422 launch pre-flight (org graph, Section I lock, consent text, DPO sign-off, cohort floors); 409 "below reporting threshold"; 422 release; 409 illegal transition; 422 pulse; 409 across a major version.

## Phases (10.6, was Appendix E)
- 10 phases over 26 sprints with new names: P1 Foundation (1-3), P2 Instrument and capture (4-6), P3 Scoring (7-8), P4 Segmentation (9-10), P5 Rules engine (11-13), P6 Leadership (14-15), P7 Reporting (16-18), P8 Action planning (19-21), P9 Measurement (22-23), P10 Hardening and UAT (24-26). Old: P1 Foundation, P2 Setup, P3 Capture, P4 Scoring, P5 Segments, P6 Findings, P7 Reports, P8 Planning, P9 Re-assessment, P10 Hardening (sprints 23-25).
- New acceptance wording: "rules are editable as data without a code release" (P5); "performance and remuneration export path is provably blocked" (P6); "visible-signal escalation reaches the CEO role" (P8); "load test at 5,000 concurrent respondents" in P10 scope; "UAT checklist at 10.7 fully signed off".

## QA checklist (10.7, was Appendix F)
- New rows: "Rules baseline (0.5): all sixteen, each with a named test"; "Consultant workflow ... every stage gate in 9.1".
- Reworded: IP scan "re-run as a build-pipeline gate, not a one-off review"; Load scoring window "agreed window".
- Old rows not repeated: "Rounding: run UT-10 and UT-54 on the production build", "Penetration test completed" (pen test only in P10 scope now), "Scoring 5,000 under 10 minutes".

## Glossary and decisions
- Glossary new terms: CHRO designate, Reference library, Strategic priority card, Watch-list, Item-bank version, Setup Sections A-I.
- Design decisions register (10.9) is D-01..D-21 with new meaning; the old Appendix H ids D-01..D-16 are not the same topics (old D-07 scorecard CSV is now D-08; old D-10 speeding is now D-05; old D-08 retention is not in this register). All entries stated "decided; none open".
- 10.10 Companion conformance is new: five documents with the content each must carry.

## Moved
- Old Appendix D formula library is now 10.4 pseudo-code; no `dimension_score` or per-dimension helper lines in the new list, `sub_alignment`, `behaviour_gap_points`, `priority_score` stated explicitly.
- Old Appendix G glossary now 10.8, with reference column pointing to new section numbers.

## Owner questions
- Q1 UT-19 / D-11: "HR systems redesign within 90 days" for a C3 systemic miss, but 10.8 says process contradiction is 1-6 months and behaviour gap 0-90 days. Which tier governs a systemic C3 miss? Options: (a) 90 days (behaviour gap tier), (b) 1-6 months (process contradiction).
- Q2 CHRO designate: how is the designate recorded and who may change it? Options: (a) tenant column set by the consultant at setup, (b) a flag on one Client Admin user set by Super Admin; until then should Client Admins keep reading leader reports (current) or lose access (spec)?
- Q3 Override 3: remove it from the engine (new text, two overrides) or keep it and amend the spec?
- Q4 Speeding threshold: change code from one third to 40% of median (new text)? Existing frozen scores would change on re-score.
- Q5 UT-54 and UT-55 scope: executives currently read every leader report after release; confirm they should only see direct reports, minus the fit-and-contribution section.
