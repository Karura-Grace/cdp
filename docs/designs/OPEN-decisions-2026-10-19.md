# Owner rulings on open points, 19 October 2026

These settle the questions left open in the 18 October handoff and in the 17 October variant summary. Where a ruling touches capture SQL, tokens or schema, the detail goes into the Journey 2 design for approval before it is built.

## Build order
Journeys 2 to 10 govern. The rules version 2.1 engine work is folded into the journey it belongs to (for example the 360 minimum of 3 in Journey 2, the respondent band names in Journey 5). This replaces the seven step order proposed at the end of `docs/SPEC_CROSSCHECK_V21B_2026-10.md`.

## Variant points
- V-11, 360 free text items: Claude drafts two or three items, the owner edits and approves them.
- V-30, sector and maturity to C4 business model: Claude drafts a mapping table as configuration, marked DRAFT for faculty review; the owner approves it. B6 keeps working meanwhile.
- Respondent band names: Promoters, Passives and Detractors are replaced by Advocates, Neutrals and Critics everywhere. That covers the engine, the payload, web reports, PDF and PPTX exports, the Savanna Ridge demo (reseeded), the rehearsal guide and the sample files on the Desktop.
- Speeding: follow spec 2.1 exactly. The threshold lives in configuration and every exclusion is written to the exclusion log.

## Journey 1 follow ups
- Objection: an objection revokes the person's issued link at once, not only future links.
- Section C currency: one currency per client. Money KPIs take the client currency.
- Segment cuts: only About you attributes declared in Section I may be used as segment cuts. The five response floor still applies.
- KPI readings after launch: Client Admin and PAC Consultant may add them. Every reading is audited.
- Launch: each of sections A to D needs its own recorded Executive tick. Launch is blocked until all four are ticked.
- Spec line 485: our copy now says headcount is context only and response rate is submitted divided by invited.
- Old drafts with typed participant names: left as they are. The setup screen prompts the consultant to replace them with people.
- A1 to A4: a dedicated Super Admin page that lists and edits these fields across clients.
- Staff message history: the audit log keeps every earlier wording.
- New assessment version: the rater window is copied from the previous version and stays editable.
- 360 rater window: `capture.submit_response` refuses an answer outside the leader's rater window with 410 and the neutral expired link message.
