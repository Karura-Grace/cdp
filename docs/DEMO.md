# Demo rehearsal: Culture Dynamics Profile slice

What this shows: a respondent answers, the consultant freezes, scores and releases, and the client sees a report
that traces to a frozen, hashed score. Nothing here is a mock; every step runs against the real database and RLS.

## Before the day

1. `npm ci && npm run build` (builds the engine, then the app).
2. Create the free-text key once, in the Supabase SQL editor (otherwise typed answers in the survey fail with a 503):
   `select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'cdp_text_key', 'CDP free-text encryption key');`
3. Fixture engagement (475 responses, released report; already seeded on the demo project):
   `node --env-file=.env.local scripts/seed-demo.mjs <project-ref> sbp-key.txt fixture`
   It prints a PASS line when the score hash equals the oracle fixture hash. It refuses to run twice.
4. Logins are in `context-sessions/demo-credentials.txt` (gitignored): PAC Consultant, Client Admin, Executive,
   People Leader, Super Admin.
5. Start the app: `cd apps/web && npx next start --port 3100` (after `npm run build`).

## Live engagement (about 10 minutes before you start)

`node --env-file=.env.local scripts/seed-demo.mjs <project-ref> sbp-key.txt live 5 http://localhost:3100 8`

This makes a new "Live Demo Co" tenant, issues 5 single-use links and closes the survey window in 8 minutes. The
window genuinely opened 15 days ago, so the engine's pre-flight rule (10 working days) passes honestly.
To show setup and launch from scratch, with no seed script: sign in as the Super Admin, open **Organisations**, add an organisation and press **New engagement**; add a Client Admin and assign the PAC Consultant to the engagement on **Manage users**. Then sign in as the consultant: the dashboard offers **Set up the assessment**. Open **Organisation and leaders** on that page, download the templates, upload grades, locations, units, people and leaders, and read the V1 to V7 report (a rule that fails can be overridden with a reason). Create the assessment, fill in and agree Sections A to I with the guided forms (each form lists what it still needs; Section D needs Section C first), approve the consent text, record the transfer basis, issue links and press **Launch assessment**. `seed-demo.mjs ... bare` makes a tenant and engagement in one step for a quicker start; `draft` makes a ready-to-launch engagement.
More links: `node --env-file=.env.local scripts/issue-links.mjs 3 http://localhost:3100`.
Links from a live seed made before the consent migration (3 Oct) no longer open, because that assessment has no consent text. Seed a new live engagement.

## Run of show

1. **Landing** (`/`). Four energies, the Today-vs-Preferred picture, the privacy promise. Paste a survey link in the box.
2. **Respondent** (`/respond#token`). Read the intro, press Begin: the consent screen appears before any question (full text, tick box, "I agree" or "I do not agree"). Declining ends the session and records only the decline; agreeing opens the first question. Then show the constant-sum control (A to D, live total), Today then Preferred, readiness
   and experience questions. Submit. Reopen the same link: "no longer valid". Say: the token is in the URL hash, only its
   hash is stored, and the response row has no link to a person or an invitation.
3. **Consultant** (`/login`, `consultant@cdp-demo.example`). Dashboard shows the next step for the live engagement:
   - before the window closes: "Survey open until …";
   - then one button at a time: Freeze the data, Run scoring, Freeze the score, Run findings, Create the report.
4. **Draft report.** Open it. Write and save the two sections ("Save and accept"), then "Release to client".
5. **Client Admin** (`admin.live<stamp>@cdp-demo.example` for the live tenant). Before release the report is not there
   (not even by URL). After release it is, with the chart, findings and technical appendix.
6. **Fixture report** (Client Admin of the fixture tenant). Download the PowerPoint (native, editable charts) and the PDF.
   Open the technical appendix: score hash `sha256:3366fa7d…69348`, the same hash the Python reference produces.
7. **Roles** (optional). Executive sees the same released report; People Leader sees the organisational report only;
   another tenant's admin and Super Admin see nothing. Super Admin has no client results by design.

## Checks you can run

All need the app running on `http://localhost:3100` and `.env.local`.

| Script | Proves |
|---|---|
| `scripts/e2e-release.mjs` | score, freeze, findings, report, release and the release gate for six roles (once per fixture seed) |
| `scripts/e2e-ui.mjs` | login redirects, cookie sessions, CSRF header, draft visibility, release from the browser path |
| `scripts/e2e-export.mjs` | export access rules, PDF validity, PPTX chart values, audit log |
| `scripts/e2e-live.mjs <ref> sbp-key.txt` | the whole live path on a new tenant, with the stored hash cross-checked against a local engine run, and the consent rules (refused without consent, decline stores nothing, consent record unlinked at submission, launch needs an approved text) |
| `scripts/e2e-orgs.mjs` | tenant and engagement creation (Super Admin only), validation, residency lock, hand-off to a consultant (44 checks) |
| `scripts/check-setup-sections.mjs` | the section schema and its rules, no server needed (49 checks) |
| `scripts/e2e-org.mjs <ref> sbp-key.txt` | the org graph: import integrity, V1 to V7 against real rows, overrides, the launch snapshot and headcounts, locks, access per role per table, CSV round trip, pages (276 checks) |
| `scripts/check-org-csv.mjs`, `scripts/check-appendix.mjs` | the CSV parser and the report appendix rows, no server needed |
| `scripts/e2e-setup.mjs <ref> sbp-key.txt` | the setup endpoints and guided-form rules, from a bare engagement to launch (83 checks): workshop rule, Section F tie, consent versions, transfer basis, links, role limits, locks after launch, audit |
| `scripts/e2e-launch.mjs <ref> sbp-key.txt` | pre-flight and launch: each rule broken in turn refuses launch (422) and changes nothing; a clean draft launches, locks setup, pins the window, is audited and is idempotent |
| `scripts/e2e-users.mjs` | user management: who may create, change, deactivate and reset whom, tenant isolation, one-time passwords (49 checks) |
| `scripts/e2e-segments.mjs` | segments on the Ostravane demo: groups that report, small groups hidden with a roll up, 409 for a parent below the floor, consultant only, every query logged, the log cannot be deleted |
| `scripts/e2e-360.mjs <ref> <token>` | Leadership 360 on an open test client (seed `seed-rich-demo.mjs ... open`): nominations, links, form rules, single use, unlinking, no direct reads, leader results stored and immutable (31 checks) |
| `scripts/e2e-plan.mjs <ref> <token>` | action plan on a client it seeds itself: build, who sees what, field locks, every workflow move and its role, the P0 gate (engine and database), evidence before closing, readings, append only history (45 checks) |
| `scripts/e2e-team.mjs <ref> <token>` | People Leader own-team view on a client it seeds: linking rules, team results and suppression, own 360 result and agreed plan, nothing else opens (26 checks) |
| `scripts/e2e-measure.mjs` | the Measure stage on the Ostravane demo's second cycle (seed it with `seed-measure-demo.mjs <ref> <token>`): stored comparison and who reads it, org changes, triggers raised once and decided once, nothing editable after (24 checks) |
| `scripts/check-session-policy.mts` | the 7 day and 8 hour session limits, no server needed |

## Public deployment (added 5 Oct)

- **Live site:** https://cdp-platform-demo-ten.vercel.app (second alias: cdp-platform-demo-pac-gk.vercel.app). Vercel team `pac-gk`, project `cdp-platform-demo`. It is separate from `cdp-pac.vercel.app`, which is untouched.
- **Address (11 Oct):** https://culture.pac.africa (Cloudflare CNAME, DNS only, to Vercel project `cdp.pac.africa`; Supabase email links and R2 CORS point at it). `cdp.pac.africa` still serves the old prototype from another Vercel account.
- **Second host (8 Oct):** after the first Vercel account hit its limit, the same repo also runs on team `pa-africa`, project `cdp.pac.africa`, at https://cdppacafrica.vercel.app. The first build failed (`module-not-found` for the engine) because the project's root directory was `apps/web`; it must be the repo root, with the settings below. The three environment variables were added for Production and Preview. A Super Admin sign in and `GET /v1/users` work there.
- **Settings:** framework Next.js, install `npm ci`, build `npm run build`, output `apps/web/.next`. Deployment Protection is off so respondents can open links. Production environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (type config) and `SUPABASE_SERVICE_ROLE_KEY` (sensitive).
- **How it deploys:** a push to `main` on GitHub (PAC-Africa/cdp-platform) builds and publishes by itself. Vercel blocks a build when the commit author's email is not linked to a member of the team (`TEAM_ACCESS_REQUIRED`). Commits are authored as `Claude <issa@pac.africa>`. That email is now verified on the GitHub account, which cleared the block. Builds for commit f886f24 made before that stay marked BLOCKED and are harmless.
- **Command line deploy** (needs a Vercel token for the `pac-gk` team; the 7 day token on the Windows Desktop expires): `NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" vercel deploy --prod --yes --scope pac-gk --token <token>`. On this network the upload drops connections, so retry up to four times; Vercel keeps files that already uploaded. `.vercelignore` keeps the upload to about 8 MB.
- **Checked on the public site:** pages return 200, and `e2e-ui` and `e2e-export` pass against it (sign in, survey, scoring, PDF, PPTX and XLSX export). A person has only seen the landing page through screenshots.
- **Survey links:** `seed-demo.mjs` takes a base URL argument. Use the Vercel address for links given to people outside this machine.
- **Free text answers:** the Vault key `cdp_text_key` was created in Supabase on 5 Oct, so typed answers should now save. This was not re tested end to end afterwards.

## Running locally (added 9 Oct)

After `npm run build`, run `cd apps/web && npx next start --port 3100` and open http://localhost:3100/login. It uses the same Supabase project as the live sites, so the data and the Super Admin login are the same. The original prototype is the separate repo `PAC-Africa/cdp.pac.africa` (Next 14, its own older data model); it is not connected to this platform's database.

## Demo client with everything (added 11 Oct)

`node --env-file=apps/web/.env.local scripts/seed-rich-demo.mjs <ref> <token-file> http://localhost:3100` makes **Ostravane Logistics (demo)**: 45 named made up people in five departments, 41 answers, Leadership 360 for ten leaders, a released report, and an action plan with six actions taken along (approved, published, tracked with KPI readings). Rename the previous copy first; the Ostravane demo logins move to the newest copy. All logins are in `CDP-LOGINS.md` on the Windows Desktop. Start with `consultant@cdp-demo.example`: Portfolio, then Meridian: Action plan, Leadership 360, Segments, and the report.

## Public website (added 12 Oct)

The seven pages of the new Claude Design are live: Home (`/`), Platform, Methodology, Solutions, Insights, About PAC and Contact, with the shared navigation and footer (`apps/web/app/(site)`, `components/site`). They are plain React generated from the design files; the design's stylesheet is scoped under `.cdp-site` so it cannot affect the app screens. Differences from the design, on purpose: the Contact form opens the visitor's own email app addressed to hello@pac.africa (no email service yet); the newsletter box is a "Subscribe by email" link; the testimonial block and the article dates, authors and read times were placeholders and are removed (article cards say "Coming soon"); the hosting claims now say the EU, which is where the data is.

## Accounts (added 5 Oct)

- **Real account:** one Super Admin, `issa@pac.africa`, created 5 Oct with a one time password that must be changed at first sign in. The password is in `context-sessions/real-accounts.md` (gitignored) and a copy is on the Windows Desktop. Delete both once it is changed.
- **Demo accounts:** `superadmin@`, `consultant@`, `admin.fixture@`, `exec.fixture@` and `peoplelead.fixture@cdp-demo.example`, plus about 50 throwaway `admin.<mode><stamp>@cdp-demo.example` logins left by test runs. Passwords are in `context-sessions/demo-credentials.txt`. Remove the throwaways before real use.
- **Creating more:** a Super Admin signs in, opens Users, and adds PAC Consultants and client users (one time passwords are shown once). Super Admins can only be created in the database. See `docs/AUTH_AND_ROLES.md`.

## Branded documents (added 5 Oct)

The `pac-branded-pdf` skill is installed in `~/.claude/skills/`. Its Python tools are in `~/.venvs/pac-pdf` (weasyprint, markdown-it-py, pymupdf) and `uv` is in `~/.local/bin`. Build with `~/.venvs/pac-pdf/bin/python ~/.claude/skills/pac-branded-pdf/scripts/build_pdf.py in.md out.pdf --config doc.json`. Run `check_style.py` first: no dashes or hyphenated words in prose. PDFs of `AUTH_AND_ROLES.md` and `GAPS.md` are on the Windows Desktop.

## Known limits (say them before they are found)

- MFA is stubbed in one function (`app.mfa_ok()`). The claims hook is enabled in Auth settings (5 Oct) but nothing reads its claims, so the demo does not depend on it.
- The setup forms cover the spec's fields for A to I but not cohorts, demographics or separate Executive and HR perspectives. L7, L8 of the pre-flight are reported as not assessed (no invitation list tied to people, no 360 raters). The tenant's transfer basis is an unsigned placeholder written by the seed.
- The consent wording is a draft template written for the demo. PAC legal and the client's data protection officer must approve the wording before real use. There is no screen to edit or approve it yet.
- No invitation emails: links are copied by hand. No reminders, segments, 360, priorities or action plans, pulses.
- Report text is written by the consultant; there is no AI narrative.
- The survey route has no rate limit (tokens are 128-bit, so guessing is not a risk; add a Vercel Firewall rule for load).
- Readiness is marked provisional because there are no leadership 360 results (leader coverage 0).
- Demo shortcuts live in `scripts/seed-demo.mjs`: the fixture is frozen with its window open, and the transfer-basis
  pre-flight check (L6) is asserted true because no transfer-basis record exists yet.
- Open items for Imran: replacing `cdp-pac.vercel.app`, the transfer-basis signer, the email sender domain, the
  terminology deny-list secret, Anthropic data terms.

## Email and evidence files (13 October 2026)
- Evidence files: Cloudflare R2 bucket `pac-cdp`, key scoped to that bucket, CORS allows PUT and GET from https://culture.pac.africa. `scripts/e2e-plan.mjs` covers upload, recording and download and passes against the live site.
- Email: Resend, sending domain `pac.africa` (verified), sender hello@pac.africa. Setup, Survey links, "Issue and email links" emails each rostered person their personal link. Reminders and password reset emails are not built yet: the link token is stored only as a hash, so a reminder needs a fresh link, which is a design decision.
