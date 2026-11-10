# Locked rules

Only the owner edits this file. The agent proposes changes in its messages.

## Rule 1: Colour (locked)
See design_system/README.md, Rule 1 table. Tokens: brand #EA5732, ink #131313, muted #727070, paper #FAF7F2, surface #FBE9E3, accent-dark #8F3A24 (decorative diagonal bar only).

## Data colour exception (owner decision Q-D8-2, 3 Nov 2026)
Four orientation colours are allowed for chart series only, never for interface, bars, buttons or text. They come from the CDP platform specification and are fixed for every client:
- Engage #2E86C1
- Innovate #6C3483
- Perform #C0392B
- Govern #58A55C
Verdict tiles only (always with icon and word): Hit #2F6F40, Partial hit #C77C0E, Miss #A93226.

## Owner choices for the report (3 Nov 2026)
- Type: Georgia body 10 pt, Inter headings.
- Palette: PAC palette only for structure.
- Two charts per row where space allows.

## Rules 2 to 6 (approved by the owner, 3 Nov 2026)
Typography, spacing and grid, radius and borders, logo and graphic elements, writing and tone: locked as drafted in design_system/README.md and tokens.json. Changes need the owner.

## Owner defaults set by Claude Code on 3 Nov 2026 (owner to confirm)
- Page colour: paper #FAF7F2; chart plots and tiles sit on white panels so Govern green stays readable.
- Diverging bars and heatmap: negative Perform red #C0392B, positive Engage blue #2E86C1 (platform spec 4.7, data tokens only).
- Footer line: "Confidential. Prepared for {client} · Released {date}" plus "Page n of N". Reference code on the cover and About page: PAC/CDP/RPT/{NNN}, number supplied by the platform.
- Document control fields: organisation, report, audience, released, prepared by, classification.
- PDF library: pdfkit (embeds TrueType fonts, vector paths, clipping, no blur or gradients).
- Decorative diagonal bar (accent-dark #8F3A24): you propose angle and width from the brand book; owner approves.
- Sample data: cohort counts are 5 executives and 36 staff (the respondents block in the sample file was wrong).

## Group 1 approval amendments (owner approved group 1 on 3 Nov 2026, recorded by Claude Code at the owner request)
- Page colour: paper #FAF7F2. Chart panels, KPI tiles, verdict and finding cards are white #FFFFFF, fill only, radius 4; callouts and table banding stay surface. This amends Rule 4.
- Rule 5 amendment: frame rules may sit inside a logo clear space; content may not.
- The earlier line "owner to confirm" on defaults is now confirmed for page colour. Other defaults (diverging red and blue, footer line, reference code, pdfkit) stay as proposed until the owner says otherwise.
