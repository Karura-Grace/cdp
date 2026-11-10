# Proposed changes to the design agent files (for the owner to decide; not edited)

The agent files in `Desktop/PAC-Design-Agent` are the owner's. These are proposals only.

1. **Data colours.** The system prompt (section 2) forbids blue, purple, green and teal as interface colours and allows an extended palette only when the design system allows it. The report needs four fixed data colours (Engage #2E86C1, Innovate #6C3483, Perform #C0392B, Govern #58A55C) and three verdict colours. Add them to `design_system/tokens.json` as data tokens and write the exception into `rules_locked.md`.
2. **Report knowledge.** The knowledge folder has no CDP report material. Add `REPORT-BRIEF.md`, `REPORT-DESIGN-COMPARISON.md`, the `reference` pictures and `report-sample-data.json`.
3. **Output type.** Add a rule that a report template is delivered as an empty template with placeholders plus a block catalogue, not only finished sample pages.
4. **Text limit.** Add a rule for documents: no page carries more than a stated amount of prose, and findings come before explanations.
5. **Role wording.** The prompt says "Culture Practitioner". The platform and spec say PAC Consultant for the role in the app. The owner chose the prompt's wording for client facing report text (Q-D8-8); the agent should know the app screens still say PAC Consultant.
6. **Skills.** The manifest lists `pac-branded-pdf` as a KEEP skill. That skill makes a generic PAC document; the CDP report template overrides its layout. State that the CDP template wins for CDP reports.
7. **Type fonts.** Confirm whether Georgia can be embedded in the PDF. If not, the manifest names Gelasio as the substitute.
8. **Skills manifest text.** Checked: the manifest file is intact. An earlier note here said it had lost words; that came from a display artefact in the tool output, not from the file. No action needed.
