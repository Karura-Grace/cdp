# Addendum to BRIEF.md for the new spec (17 Oct 2026 variant)

Read BRIEF.md first; everything there holds except the following.

- Spec file: `docs/spec/new-spec-17oct.txt` (plain text from the 17 Oct docx, PAC/CDP/TECH/001 "Final build baseline"; headings start `#HeadingN`; each table cell is on its own line, so read a table as repeated groups of lines; tables of N columns give N lines per row; figures are not in the text). Old spec for comparison: `docs/spec/CDP_Platform_Developer_Specification_v2_1.md`. The new doc governs on any conflict (owner ruling 18 Oct).
- Rulings: old Appendix C (item text) still holds; old Appendix I (config registry) and K (events) still hold; old Appendix J (errors) is replaced by new 10.2 API section; old rows for these stay in requirements.csv, do not re-row them unless the new text states a value.
- Ids: `N<section>-<nnn>` (e.g. `N2.4-012`, `N10.5-UT03`, `N11.7-004`); stage column: the new chapter number as `N1`..`N12`; spec_ref `2.4 L737` uses lines of new-spec-17oct.txt.
- Existing matrix: `docs/spec-crosscheck/requirements.csv` (old ids). Before judging a row, grep it for the same rule (by keyword/value). If an old row exists, reuse its evidence (re-verify the cited line still exists) and write `old:<id>` in notes. If the new text has a different value, threshold, name, count or rule than the old spec, say so in notes starting `CHANGED:` and judge the code against the NEW text (so it may become Partial/Differs even though the old row was Built).
- Decisions on record: also D-J1 (journey 1 owner decisions, `docs/designs/J1-decisions-2026-10-18.md`); read it if your range touches setup, launch, privacy, perspectives or scorecard.
- Also write `docs/spec-crosscheck/parts-notes/<your-prefix>-diff.md`: bullet list of every added, changed, removed or moved rule versus the old spec (value-level first), with both quotes short. This feeds the owner's summary.
- Output CSV into `docs/spec-crosscheck/parts/` with the filename you are given. Do NOT run node scripts/conformance*.mjs or touch the DB or network. Do not edit other files.
- Reply under 300 words: csv path, rows, counts by status, ten most serious gaps, number of CHANGED rows, anything ambiguous that needs an owner question (list as concrete questions with options).
