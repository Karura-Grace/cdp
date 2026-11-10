# n01 diff: new spec (17 Oct) chapters 0 to 4 against the old v2.1 file

Range: docs/spec/new-spec-17oct.txt lines 127 to 1335. Old = docs/spec/CDP_Platform_Developer_Specification_v2_1.md. New governs. Row ids are in docs/spec-crosscheck/parts/n01-ch0-4.csv.

## Value or rule changes (judged against the code)

- Speeding threshold. Old: "below the higher of 8 minutes or one third of the assessment's median" (D-10, config survey.speeding_median_fraction = 1/3). New: "below 40% of the assessment's median completion time, or below 8 minutes, whichever is higher". Code still uses 1/3. N2.11.2-SP.
- Quality exclusion rule. Old: "SPEEDING together with any other flag" excludes (UT-56: UNIFORM + DUPLICATION alone is retained). New: "Two or more flags on one response excludes it from all scoring". Code still follows the old rule. N2.11.2-EXCL, N2.11.3-INSUFF.
- 360 observed-items minimum. Old: rater excluded from a section below 6 of 10 observed (A to D) and 3 of 5 (E to H), UT-55. New: "a section with fewer than three observed items for a rater is excluded". A to D changes from 6 to 3; E to H unchanged. Code and UT-55 follow the old value. N4.2-NOTOBS.
- LRI alignment term. Old: the A to D section of the Section F target orientation ("target section"). New: the primary BUILD orientation (greater strategic need if two), else the STRENGTHEN orientation with the largest gap, else the Section F target; the report states which was used. Code always uses the Section F target. N4.6-ALIGN.
- TPS inputs. Old: D7 to D9, leadership alignment and TPS stored at 4 dp, TPS computed from unrounded values ("The TPS uses the unrounded 4 dp values"). New: "computed from the stored two-decimal input values and rounded half-up to two decimals". Code keeps 4 dp. Worked example (3.085 to 3.09) is the same either way. N2.9.1-INPUTS, N2.4-DP.
- Executive grade flag. Old: at least one executive grade is a non-blocking warning (V5). New: the flag "must be set before launch". Code warns only. N1.2.1-GRADE.
- Leader report visibility. Old matrix: Client Admin reads leader reports "if people lead"; Executive reads self plus direct reports. New: Client Admin only as CHRO designate; Executive "self; directs' sections 1 to 5, 7 to 10"; line manager sees all but section 6. Code lets every Client Admin and Executive read every leader result once released (no CHRO designate policy). N1.3.1-LEADER, N1.3-EX, N1.3.2-LM.
- Roles. Old: seven roles (Coach is a role; Client Admin flagged is_people_lead). New: six roles plus two designations (CHRO designate, assigned coach). Code keeps COACH as a role and has no designate. N1.3-ROLES, N1.3.2-CHRO.
- Permission matrix rows. Old had "Survey launch and data freeze" and a separate "Carrier / blocker classification" row, a Coach column, People Leader approval of unit actions (A as division head). New has "Survey launch" only, a "Leader Development Plan" row, no Coach column, People Leader action approval R only. Code follows the old for approvals. N1.3.1-APPROVE, N1.3.1-LDP, N1.3.1-LAUNCH.
- Integrity flag escalation. Old: "reported to the leader and the people-lead Client Admin". New: "to the leader and to the CHRO". Neither is built. N4.4-INTEG-ESC.
- Engagement divergence. Old: negative in the segment while "non-negative" organisation-wide. New: while "positive" organisation-wide (an organisation value of exactly 0 no longer qualifies). Code uses >= 0. N3.3-ENG.
- Sector and maturity drive C4. New 1.2.2 Section A row: "Sector and maturity stage drive the C4 business-model requirement lookup". Old: C4 is looked up from the B6 business model. Code uses B6 only. N1.2.2-A.
- Retention. Old and new both say 24 months, notices at 90 and 30 days, certificate. New adds "Implemented as a scheduled job". Decision D-J1: consultant triggered, no job. N1.4.5-RETAIN, N1.1-021.
- Constant-sum control. Old: "Next is disabled until the scenario totals exactly 100. No auto-balancing or auto-fill." and "turns to a confirmed state at exactly 100", "35 left" style remaining count. New: the auto-fill ban is gone; it requires a live total, no submit unless 100, zero allowed, integers only, orientation label displayed with a stated reason. The Fill remainder button no longer breaks a stated rule. N2.3.2-FILL, N2.3.2-LABEL.
- Instrument 1.1. New states 1.1 is the canonical UK-English item bank, orthographic only, with a recorded equivalence statement, equivalent to 1.0 for trend. Old treated 1.0 as equal to 1.1 in code (UT-43) without an equivalence statement. N1.4.2-V11.
- Rounding test id. New 2.4 cites UT-52 for the half-up rule (3.085 reports 3.09). In the code UT-10 is the half-up test and UT-52 is Override 3. N2.4-ROUND.
- 360 section names. New E to H: Integrity Values and Standards; Psychological Safety and Communication; Strategy Data and Digital; Leading Change and Adaptive Capacity. Same as old Appendix C. The code's l360-items.json titles differ (label only). N4.1-E to N4.1-H.

## Added (in the new text, not in the old)

- 1.1 architecture: report composer layer ("Selects fitting suggestions from the reference library ... Specified at section 12"). N1.1-013.
- 0.1 Part B and document family table with PAC/CDP/360/SELF and 360/RATER, Authority paragraph. N0.1-003, N0.2-002.
- 1.3.2 scoped designations table: CHRO designate (one per tenant, changeable only by the PAC Consultant) and Assigned coach; line-manager rule. N1.3.2-CHRO, N1.3.2-COACH, N1.3.2-LM.
- 1.4.5 Ethiopia clause ("for Ethiopian tenants, Ethiopia's personal data protection proclamation"). Code has no Ethiopia enum value; OTHER works. N1.4.5-DPO.
- 3.5 comparison view "up to four segments", trend view banner, "Export ... to Excel ... and to PowerPoint". N3.5-COMPARE, N3.5-TREND, N3.5-EXPORT.
- 3.8 Slide-ready outputs (seven slides with fixed titles). N3.8-1 to N3.8-7.
- 3.4 direction narrative examples (ENGAGE care blind spot, GOVERN bureaucracy blind spot). N3.4-DIR.
- 2.9.2 and 0.5 rule 3 wording that eOS Q2 is never substituted for leadership alignment, and the provisional label is never a gate input. N2.9.2-Q2.
- 0.5 sixteen-rule baseline table (restates rules defined later). N0.5-R01 to N0.5-R16.
- 4.4 integrity flag: the consent text on both forms must say it escalates outside the development relationship. Old had it too (S3.5.10-013); kept as N4.4-INTEG-CONSENT.

## Removed or condensed (old detail with no counterpart in chapters 0 to 4)

- Old tenant field table (legal name, sector enum, headcount, ISO country codes, time zone) and org_unit, person_of_record, grade_band, leader_assignment schemas: the new chapter 1 holds only the graph entity table (1.2.1) and points to 10.1. Old rows stay in requirements.csv.
- Old field-level setup tables A1 to I6 (types, lengths, enums, validation, contradiction flags): new 1.2.2 has one behaviour line per section. Old rows stay.
- Old completion-time rule detail (median of the first 30 complete responses outside 30 to 50 minutes, D-11): new states only 35 to 45 minutes and "UAT measures the median". Old rule stays.
- Old window extension cap "up to 5 working days": not restated.
- Old D7 to D9 "at least 9 of 12 items answered" respondent rule: new says "mean of its 12 item responses"; the 9 of 12 rule is not restated (code still applies it).
- Old SDI worked values, old master threshold table 58, old stored-precision convention (Table 2, 4 dp for D7 to D9, LRI, leadership alignment, TPS): replaced by "held to two decimal places internally".
- Old carrier/blocker, fit index and influence logic (old 3.5.13) moved to the new chapter 5 (not in this range).
- Old AI prohibited and permitted tables (old 4.8): not in chapters 0 to 4; the new text refers to 6.12.

## Moved

- Old 0.5 roles and matrix: now new 1.3.
- Old 0.4 non-functional table and architecture: now new 1.1 (shorter; availability, performance, recovery and browser rows are not restated).
- Old 2.x capture rules (validation, quality flags, completion states, window): now new 2.11.
- Old 3.5.x scoring logic: now new 2.4 to 2.10 and 3.2 to 3.4.
- Old sub-culture and perception gap (3.5.12): now new 3.3 and 3.4; old leader scoring (3.5.10): now new 4.2 to 4.6.
- Old Appendix C item text and Appendix I and K keep their old rulings; Appendix J is replaced by the new 10.2.

## Owner questions raised by this range

See the report to the caller (Q1 to Q8): C4 lookup input, leader report scope, orientation labels on the survey, Fill remainder, TPS input precision, quality flag rules, 360 observed minimum, LRI alignment term.
