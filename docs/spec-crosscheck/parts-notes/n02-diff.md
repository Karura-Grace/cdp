# n02 diff: new spec ch5 to ch9 (lines 1336-2628) against the old v2.1 spec

Old locations: new 5 = old 3.5.13; new 6 = old 4.4 to 4.8 and 5.5; new 7 = old 4.6 and 4.7; new 8 = old 5.x and 6.5; new 9 = old 0.6 (and 6.5). "Q" numbers match the owner questions at the end.

## Value and rule changes (value-level first)

- Carrier class 1 CRITICAL BLOCKER: new adds a condition. New "lead_build ≤ org_build − 5, default orientation in MODERATE, and either an integrity or safety flag (4.4) or LRI < 2.50". Old "lead_target ≤ org_target − 5.0 and (integrity or safety flag, or LRI < 2.50)". Code has the old rule (scoring.ts:459). Row N5.3-003.
- Carrier class 3 CULTURE CARRIER: new adds "and the self–other gap on the BUILD section is Aligned (4.5)". Old: no such test. Code has the old rule. N5.3-006.
- Carrier classes: the old LAGGING class (class 3, "lead_target ≤ org_target − 5.0 (other cases)") is gone. New five classes; a leader below org_build whose default is not MODERATE is NEUTRAL with "a development note on the BUILD section". Code and UT-53 still return LAGGING. N5.3-008, N5.3-009.
- Carrier target orientation: new "the organisation’s primary BUILD orientation, resolved exactly as for the LRI alignment score (4.6)" = BUILD, else largest STRENGTHEN, else Section F target. Old "lead_target = leader_profile(leadership target orientation)" (Section F tags). Code uses Section F only. Same change reaches LDP composition (N8.6-003). N5.3-001.
- Carrier response recipient: new "CHRO designate and the sponsoring executive". Old "people-lead Client Admin and sponsoring executive". Visibility list now "the leader, their assigned coach, the CHRO designate and the PAC Consultant" (old: leader, coach, people-lead Client Admin, PAC Consultant). N5.3-004, N5.3-011.
- Leader report audience: new adds the CHRO. Old "Leader, coach, people-lead Client Admin". N7.2-004.
- Fit index input: new "the leader’s four A–D average item scores"; old specified `other_avg` (rater average). Code uses the rater average. Possible reading change, Q1. N5.2-001.
- Contribution band: new wording "banded at ≥ +10, +10 to −10, ≤ −10, cross-tabulated with the leader’s LRI band" and "Cohort pattern ... never for an individual leader". Old Table 57 "bands ≥ +10, > −10 and < +10, ≤ −10" with a 0 / 3.50 quadrant. Q2. N5.4-005, N5.4-007.
- Third alignment override removed: new "Two overrides then apply, in order" (6.3.2 and 6.10.1 pseudo-code). Old had Override 3 (a DOMINANT requirement also needs the highest NOW). Code and UT-52 still apply it. Q4. N6.3.2-005.
- Stepping stones: new table fixes the route. "INNOVATE → GOVERN: Route via PERFORM", "ENGAGE → PERFORM: Route via GOVERN", the other two diagonals allow two neighbours. Old "route through whichever of the two neighbours has the higher NOW score". Code still takes the stronger neighbour. N6.5.1-003, N6.5.1-005.
- Pathway core interventions: new lists are longer for ten of twelve pathways. Example ENGAGE → PERFORM now ends "accountability culture; a visible scoreboard"; GOVERN → INNOVATE adds "design capability"; PERFORM → INNOVATE adds "celebrate well-run failures". Bridging narratives are unchanged. N6.5-003 to N6.5-013.
- Pulse and re-assessment triggers: new "more than 0.5 on a Likert dimension or more than 15 points on an eOS category". Old "≥ 0.5" and "≥ 15", plus a scenario trigger "≥ 8.0 points" that the new text no longer lists. Code keeps ≥ and 8.0. N8.8-002.
- Visible signal in scoring: new modifier "Floors the score at the top decile regardless of effort". Old "visible-signal action always ordered first in its priority". Code orders it first. N8.3-010.
- SHADOW CULTURE modifier: new "Forces urgency to 5 and the action to priority zero". Old forced urgency 5 only. N8.3-006.
- Action prioritisation anchors: new states only anchors 1 and 5 per factor with derivation text. Old gave all five impact levels, all five effort levels and a backlog urgency level 1. Impact now cites "number of respondents in the affected segment" as an input. N8.3-002 to N8.3-004.
- Palette: new ENGAGE #2E86AB, INNOVATE #7B4FA0, PERFORM #E8610A, GOVERN #2E8B57; NOW navy #14213D solid, PREFERRED orange #E8610A dashed. Old ENGAGE #2E86C1, INNOVATE #6C3483, PERFORM #C0392B, GOVERN #58A55C, navy #1C2B4A and orange never a series colour. Old status colours (#2F6F40, #C77C0E, #A93226) are not restated. Code has the old palette in exports and the culture map and a third set on the report page. N7.6-C01 to N7.6-C05.
- PDF footer: new "Proprietary and Confidential — Priority Activator Consulting"; watermark carries tenant name, release date, practitioner name and a document reference. Old: "Confidential" mark and footer with client, version, hash. N7.6-002, N7.6-003 (Q8: the line contains a dash).
- Release gate appendix content: new "response rates, exclusions, suppression notes, instrument and rules versions, and the definition used for any substituted input". Old "response-rate table, exclusions, suppression notes, versions, payload hash, substitutions and overrides". N7.1-003.
- AI acceptance record: new "consultant’s identity, the prompt version and the model version". Old also stored the "payload hash". Old Residency row (in-region or recorded transfer basis) is not in the new 6.12.4 list. N6.12.4-006.
- Stepping order of evaluation: new fixed order places "pathway selection" before "scenario matching"; old order was checks, flags, gates, scenarios. No dependency; N6.1-004.
- Candidate list in pseudo-code: new "FOR o WHERE class[o] IN [BUILD, STRENGTHEN]". Old: BUILD, STRENGTHEN linked to a non-HIT check, or significant MODERATE. Decision tree 6.11 step 1 sends +4 to +8 to "KEEP & PROTECT and stop" (Q7). N6.10-005, N6.11-001.
- Trade-off pseudo-code: new "p.trade_off ... NOT ALREADY assigned ... IF NULL RAISE PlanIncoherent". Old allowed sharing when all negatives were used. Code still shares. N6.10-007.
- C3 supportive set: new "BUILD or KEEP & PROTECT set"; old "BUILD, STRENGTHEN and KEEP & PROTECT all count as supportive". STRENGTHEN is now in neither set (Q5). N6.3.5-001.
- Signal table 6.4: new rows "KPI–culture alignment: Dominant orientation ≠ the orientation the KPI agenda needs = MISS: Strategic" (added, Q6) and "Process misalignment: Reward or promotion criteria contradict the preferred culture = SYSTEMIC MISS". WATCH action changed: new "Examine in the results debrief against cohort data; monitor at re-assessment", old "add the orientation to the pulse watch-list". C1 MISS action no longer names "executive coaching anchored to the required orientation". N6.4-007, N6.4-009.
- LDP details: new Support "named explicitly with the support owner"; Confidentiality list now "leader, their line manager, their coach, the CHRO and the PAC consultant"; Measurement now also "in the team’s eOS categories on the watch-list". N8.6-005, N8.6-010.
- Publish guard: new "All blocking gates for the affected orientation are recorded complete. Publication ... starts the RAG clock". Old guard also said "the visible signal is scheduled". N8.5-005.
- Divergence reporting for declared RAG: new "a persistent divergence between them is itself reported to the sponsor"; old "persists for two consecutive weeks". N8.7.1-001.
- Scenario templates (8.9): new adds a KPI set column and a watch-list per scenario (old had objective, mandatory actions, visible signal). N8.9-001 to N8.9-013.
- Scenario table (6.8): severity column no longer shown; diagnoses are fuller and each scenario has four risks and four hypotheses. Code severities and shorter wording remain. N6.8-003.

## Added

- 5.1 Data model: three joins table and the rule "the report must carry the words 'computed against [parent unit] because the team is below the reporting threshold' ... must never be silent". N5.1-001 to N5.1-005.
- 5.4 Leader influence "must label these figures as association measures" and "Cohort pattern ... never for an individual leader". N5.4-001, N5.4-007.
- 5.5 Ten section Individual leader report and 5.6 eight section Leadership-team aggregate (Integrity and safety counts, Distribution). N5.5, N5.6.
- 6.3.1 explanation of margins and "encoded as one lookup table with a margin column (UT-50)". N6.3.1-005.
- 6.6 Readiness gates table with a Blocking column, including "Leader flags: Integrity or safety flag, or LRI < 2.50: ... sponsored one level up". N6.6.
- 6.7 Priority selection rules table (seven rules). N6.7.
- 6.12.1 "thematic summaries ... produced by a separate extraction step". N6.12.1-002.
- 7.1 Four common rules including "naming an owner and a date" in the recommendation. N7.1.
- 7.5 Leader report presentation rules: "notifies the coach rather than releasing the document". N7.5.
- 7.6 Export formats table: PDF immutability and watermark, PPTX template and one assertion per slide, Excel "suppressed segments shown as suppressed rather than omitted", Word "DRAFT — NOT FOR RELEASE". N7.6.
- 8.2 "Mandatory companions" stated per priority (same three as old 5.5.6). 8.3 explicit modifier list in order. N8.3.
- 8.4 Action record: `scorecard_link`, `cdp_remeasure_watchlist`, `classification_at_creation`, `closure_outcome`, `percent_complete` named as required fields, and the scorecard described as "a light structure ... importable from CSV". N8.4.
- 9.1 Ten stage engagement table with owner and artefacts per stage; 9.3 five review questions "recorded against the priority"; 9.4 governance table with decision rights. N9.

## Removed or moved out of this range

- Old 4.5.4 Signals rows "Leadership population" and "Data quality (response rate < 40%, exclusions > 10%, alpha < 0.70)" are not in the new 6.4 table. Old "change capacity" leader flag and the CAPACITY sub-culture type do not appear in ch5 to ch9 (a change-capacity flag is still at new line 1296, ch4).
- Old 4.5.6 Severity table (Table 67) is not in the new text. Code `severityFor` (checks.ts:117) is now unspecified.
- Old 4.4 finding object field list (type enum, verdict enum, metrics, evidence, scenario_ids, annotation) is not restated in 6.1; moved to ch10 or dropped.
- Old 5.5.2 outcome-to-recommendation Tables 79 to 84 (about 43 rows: C1 to C4 treatments, gap class treatments, eOS 0 to 30 and above 50, LRI bands 2.50 / 3.50 / 4.00, integrity, safety and change-capacity flag actions, sub-culture outcomes) are not in ch5 to ch9. Part of it is spread over 5.3, 6.2, 6.4, 6.6 and 8.6. The rest should be checked against ch11 (playbooks) by whoever covers it; old rows stay in requirements.csv.
- Old 4.7 chart rules (Table 70: 35% tint, neutral 25 line, TPS gauge parts, dumbbells, heatmap scale), the "one chart library" rule and "status verdicts always carry an icon and a word" are not restated; 7.3 and 7.4 list charts by name only.
- Old 5.3 Screens and user flow (debrief board, priority builder, workshop mode, action editor, approval queue) is not in ch8; screen rows S5.3-001 to S5.3-009 in requirements.csv have no new counterpart here.
- Old 5.5.9 note "D-05 ... stored as tenant-level configuration" (caps and 7 / 14 / 21 / 28 day intervals) is not in 8.3.1 or 8.7.2. Code keeps tenant overrides.
- Old playbook defaults Table 88 moved to 11.7 to 11.10 (outside this range).
- Old 4.8 Table 72 "Residency" row dropped from 6.12.4.

## Owner questions raised by this range

- Q1 Fit index input: rater average (current, matches the old worked example 91.4) or the leader's own self average?
- Q2 Contribution quadrants: where does the −10 to +10 eOS band fall (no quadrant, split at 0 as now, or use only the ±10 bands)?
- Q3 Leader report section 10 wants verbatim strengths and development comments; the 360 form has no free text. Add free text items, or drop the section?
- Q4 Keep the extra override 3 for "INNOVATE dominant" (platform / digital) that the new text no longer has, or remove it (and UT-52)?
- Q5 C3: a dominant orientation classed STRENGTHEN is in neither set in the new table. Treat as supportive (as now) or as neutral?
- Q6 New signal "KPI–culture alignment": a separate finding or the C1 check by another name?
- Q7 Plan candidates: only BUILD and STRENGTHEN (pseudo-code), or also significant MODERATE and only linked STRENGTHEN (code)?
- Q8 PDF footer line contains an em dash; the PAC writing rule bans dashes. Keep the spec wording or change it?
- Q9 Draft actions copy baseline and target from the client's Setup C and D KPI. Allowed under "engine never assigns ... a target value", or leave blank?
