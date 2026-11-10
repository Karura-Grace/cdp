# n04 diff: new spec Part B (ch11 Action Planning Reference, ch12 Report Composition Engine) vs old v2.1

Range: new-spec-17oct.txt L3391 to L4935. The old spec only cites the external "CDP Action Planning Guide" (4 mentions) and has no composition engine (grep: "fit score" 0, "interaction matrix" 0, "seven-step" 0, "comfort club" 0). So most of Part B is ADDED. Value-level items first.

## Value-level changes and clashes with old text or the code
- UT ids reused with new meaning: new UT-57 to UT-68 are composition tests (fit score, mandatory trigger, readiness ceiling, set assembly, determinism, no invented slot, suggestion integrity, AI off, gate exclusion, history, moderation, version pinning). Old UT-57 to UT-62 are C1 multiple requirements, urgency tiers, plan skeleton, illustrative leader, trade-off verification, action score. The existing tests of those numbers stay valid for the old rules. Do not mark new UT-57..68 Built because of them.
- Effort ceilings by TPS band (12.3.1): HIGH RISK 2, ENABLEMENT REQUIRED 3, TARGETED SUPPORT 4, STRONG READINESS 5. New. Priority caps by band (2, 3, 4) already exist (config.ts:44), a different cap.
- Fit score weights 0.30 / 0.20 / 0.15 / 0.15 / 0.10 / 0.10 (sum 1.00, asserted), two decimals half-up, ties on lower effort then entry_id (12.3.2). New.
- Faculty outcome review: at least 20 closures and not-achieved rate above 60% triggers review (12.7). New numbers, not in old Appendix I.
- Library entry retired "not achieved" in the same tenant: loses history_fit after one cycle, excluded after two (12.3.1, 12.7). New.
- Visible signal: exactly one per priority and dated within 30 days (12.3.3, 12.6). Old 5.5/5.6: at most one, end date at most start + 30 days (spec L1622). Now "exactly one" is the stricter rule; code enforces exactly one (missingCompanions).
- Four-level commitment matrix is valid for publication only when every level has at least one commitment (11.12.3). Old had the four_level_commitments field (L1607) but no publish rule stated here. Code: neither the field nor the rule.
- Release checks (12.6) grow from the old two sections plus hash plus appendix to eight: sections, traceability, coherence, gates, measures, numbers, language, ethics. Code checkRelease has four reasons.
- Playbook lever for INNOVATE and GOVERN, fourth slot: new text 11.8.4 and 11.10.4 give Onboarding (INNOVATE: invite new hires to challenge one practice; GOVERN: structured induction). Code rules-data.ts gives DECISION_RIGHTS (remove full business case; revise delegation matrix). ENGAGE and PERFORM match.
- GOVERN watch-list adds "audit and compliance findings" (11.10.4); code list is D1 S2, D3 S1, D5 S2, D6 S3, D9 only.
- Worked example 11.11: two priorities (INNOVATE, ENGAGE) plus GOVERN and PERFORM shown as trade-off rows, "only two orientations qualify", P0 has two items. Old/engine fixture (UT-59, same numbers 22/14/34/30) selects three priorities INNOVATE, ENGAGE, GOVERN with P0 of three items (adds D8_LE_3). Owner question Q1.
- Worked example D8 workstream is attached to the INNOVATE and ENGAGE priorities ("D8 gate"); engine puts it in P0.
- Thresholds restated in 11.3 are unchanged and match config: ENGAGE > 30, INNOVATE > 28, PERFORM > 30, GOVERN > 28; C4 model pairs unchanged.
- Stepping stone rule restated in 11.4: TPS below 3.50, or D8 or D9 at or below 3.0. Matches planning.ts:55-72.

## Added (new in this part, no old counterpart)
- 11.1 mapping table of 13 reference elements to platform objects; reference stored as versioned data editable by faculty without code release.
- 11.3 orientation master data: focus, values, leader type, motto, map position, performance themes, "how it creates value".
- 11.4 relationship table (6 pairs) with "what it means for action planning".
- 11.5 seven-step process.
- 11.6 Hits and Misses quick reference (4 checks) with C2/C3 reading notes.
- 11.7 to 11.10 four playbooks, each: profile, 4-level interaction matrix, metrics and outcomes (headline, supporting indicators, nurture, characterised by, leader traits, blind spots, typical contexts), "if you need more" (8 leader actions, 10 team/org priorities, HR levers, visible signal, watch-list).
- 11.11 worked example with results table, interpretation, resulting plan, readiness cap.
- 11.12 three templates with field-to-source bindings: action plan summary (12 fields and panels), priority card (10 fields), four-level commitment matrix.
- 11.13 instrument-to-action cross reference (D1 to D6 with default lever families).
- 11.14 ethical use in action planning (extends 1.4.5, 5.3: blocks export into performance, remuneration, succession, disciplinary).
- 12.1 to 12.9 whole Report Composition Engine: library entry schema (18 fields), mapping of section 11 content to entry types (15 mappings), hard filters (7), fit score (6 terms), set assembly (7 steps), slot filling, report-by-library table (12 rows), narrative composition guardrails, six template sentence patterns, eight release checks, outcome learning, worked example (11 entries), six new tables, six new API routes, UT-57 to UT-68, delivery plan.

## Changed
- Report release gate widened (see above).
- Faculty role and library console introduced (old spec mentions faculty 7 times, none as a platform role with approval workflow).
- reference_library row in 10.1 is replaced by library_entry plus library_version (12.9.1).

## Removed or moved
- Old external "CDP Action Planning Guide" reference becomes embedded content (11.x). No old rule removed in this range.
- Old C3 wording in 5.5 (ritual if D6, narrative if D4) is not restated here; 11.6 only says "visible signal within 30 days".

## Owner questions
- Q1 (11.11 vs engine): in the worked example GOVERN (-14, MODERATE significant) is a trade-off row, not a third priority, and "only two orientations qualify". The engine and UT-59 select GOVERN as priority 3 because MODERATE with a gap at or beyond the BUILD threshold counts as a candidate. Options: (a) change the engine so a MODERATE orientation is never a priority when it serves as a trade-off for a selected BUILD; (b) keep the engine and correct the worked example; (c) keep both and treat the example as illustrative only.
- Q2 (fourth lever): INNOVATE and GOVERN fourth lever is Onboarding in the new text and DECISION_RIGHTS in code. Options: follow the text (Onboarding) and move decision rights into the trade-off action; or keep both as a fifth lever.
- Q3 (scope of ch12): the composition engine, library console and faculty outcome report are a large build and sit after D-NARRATIVE. Options: build only the library data and the structured section object for the first client; defer fit scoring and faculty features; or defer all of ch12 to after the first client.
