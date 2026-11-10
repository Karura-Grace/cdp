# Culture Dynamics Profile (CDP) platform: status report

**Date:** 12 October 2026
**For:** Managing Partner, PAC Africa
**Live site:** https://culture.pac.africa
**Code:** https://github.com/PAC-Africa/cdp-platform (private)

---

## 1. In one paragraph

The CDP platform is a working, deployed product. A consultant can set up an engagement, launch a survey, respondents can answer it anonymously on a phone, the system scores the results, produces findings and reports, and a client can act on them and track progress. It runs on the live site today. What stands between it and a first paying client is **not features**. It is a short list of security, legal and account setup items (section 5), several of which only PAC can decide or sign off.

## 2. What exists today

### The product, by stage of the CDP cycle

| Stage | What is built and working |
|---|---|
| **Setup** | Create a client organisation and engagement. Strategy, structure and survey design. Roster of people with departments, grades and tenure bands. Checks before launch. Launch locks the setup. |
| **Assess** | Anonymous culture survey (scenario questions, ratings, experience questions, typed comments). Invitation landing screen, consent step, progress saving, review screen. Works on a phone and by keyboard. Leadership 360 (self and rater views). A **fielding monitor** shows links issued, submitted, in progress, declined and days left, with no individual identities. |
| **Analyse** | Scoring of the nine dimensions and four orientations (ENGAGE, INNOVATE, PERFORM, GOVERN), NOW versus PREFERRED, culture gap, readiness for change. Groups of fewer than five people are never shown. A consultant can cut results by department, grade, tenure and team. Every such query is logged and the log cannot be edited. |
| **Decide** | Rules engine that tests the culture against the declared strategy, ranks findings by severity and gives each its evidence. Strategic verdict. Reports are reviewed and released by a Culture Practitioner before the client sees them. |
| **Act** | Action plan with priority zero, owners, dates and KPIs, a review workflow, evidence links, RAG status and escalation. Leader development plans built from each leader's 360. |
| **Reports and exports** | Branded PDF and PowerPoint exports with the PAC logo, a confidential marking and native charts. |
| **People Leader view** | A people leader sees their own team's results (hidden if fewer than five answered), their own 360 result and their agreed development plan, and nothing about other teams. |
| **Users and roles** | Roles for Super Admin, Consultant, Client Admin, Executive, People Leader, Coach and respondent. Each role sees only what it is allowed to. Password change, session timeouts, user management screens. |

### The public website

Home, Platform, Methodology, Solutions, Insights and Contact pages in the new design, plus Privacy, Terms, Security and Cookie pages. Navigation, footer, interactive survey preview and diagrams all work on desktop, tablet and phone.

### Design

The public site, the consultant and client dashboards, the login page, the survey invitation and the survey screens now share one design language. The diagram of the four orientations is defined once and reused, so it cannot drift between pages.

## 3. How much work this is

These numbers come from the code repository, not from estimates.

- **63 commits** over 11 days (since 2 October 2026), each one built, tested and deployed.
- **About 17,000 lines** of application code, database definitions and test scripts.
- **26 screens**, **46 server endpoints**, **18 database migrations**.
- **251 automated tests** on the scoring and rules engine, plus **13 complete test scripts** that drive the live system the way a user would (setup, launch, survey, scoring, release, export, roles, 360, action plans, segments).
- **Security enforced in the database**, not only on screen. For example, no role, including PAC staff, can read an individual survey response. That rule is built into the data layer and tested.

## 5. What is left before a real client

Engineering work, ordered by priority. Items that wait on a decision from PAC say so.

| # | Item | Notes |
|---|---|---|
| 1 | **Second factor at sign in (MFA)** for all staff roles | The spec requires it. Needs approval because it changes how people sign in. |
| 2 | **Separate scoring login** | Closes the gap where one server key could read every response. Needs approval (database permissions). |
| 3 | **Email invitations and reminders** | Needs an approved email sender. |
| 4 | **Data destruction job and certificates** | Planned in writing, not built. Needs PAC's answers to four questions on the plan. Will ship switched off, with a mode that only reports what it would do. |
| 5 | **Pulses at 90 and 180 days, and a second full assessment after twelve months** | The "Measure" stage is not yet built from start to finish. |
| 6 | **Change a survey after launch by creating a new version** | Launch locks setup today; there is no path to amend it. |
| 7 | **Narrative drafted by AI, with guardrails** | Not built. The screening rules exist in the engine. |
| 8 | **Single sign on** (OIDC or SAML) | Specified, not built. Likely not needed for the first client. |
| 9 | **Accessibility test with a screen reader**, and a load test | Keyboard and phone are tested. Screen reader and load for 5,000 users are not. |
| 10 | **Automated tests for the newest screens**, and a full browser regression pass | The newest screens were checked by hand and by scripts, not yet by a permanent test suite. |

## 6. Readiness for the first client

**First client:** named, under 50 respondents, English, launching in 2 to 4 weeks.

- **Ready now for demos:** yes. The whole cycle can be shown to a client on the live site.
- **Ready for real respondents:** not yet. The minimum is rotated keys, real user accounts, a second factor at sign in (MFA), a separate scoring login, and sign off on the consent wording, plus either email invitations or an agreed manual process for sending survey links. With under 50 respondents a manual process is workable for a first run.
- **Can wait until after the first client:** items 4 to 10 in the engineering list, subject to the written destruction promise after 24 months being met well before that date.

## 7. Known limits, stated plainly

- The destruction of response data after 24 months is **promised in the consent text but not yet automated**.
- Some screens were checked in screenshots and scripts, not yet by a person clicking through every role.
- Evidence attachments are links, not uploaded files.
- Hosting is in the EU (Ireland). Hosting inside a single country is not offered yet.

## Appendix: Try the demo yourself

The live site has two ready demo clients with fictional data: **Ostravane Logistics** (45 made up people, 41 survey answers, Leadership 360, action plan, released report) and **Demo Retail Bank** (a larger fixture with 475 answers). Nothing in them belongs to a real organisation.

**Sign in at:** https://culture.pac.africa/login

Start with the consultant login: it shows every step of the cycle. The email addresses still contain the word `meridian`, an old label on the logins; the client they open is Ostravane Logistics. Passwords are not stored in the repository. Ask Issa for them.

### Demo logins

| Login | Role | What it shows |
|---|---|---|
| `consultant@cdp-demo.example` | PAC Consultant | Both demo clients, every step. **Best first login.** |
| `admin.meridian@cdp-demo.example` | Client Admin | Ostravane Logistics: released report, exports, users. |
| `exec.meridian@cdp-demo.example` | Executive | Ostravane Logistics: released report and exports. |
| `lead.meridian@cdp-demo.example` | People Leader | Ostravane Logistics: My team results, own Leadership 360 and development plan. |
| `superadmin@cdp-demo.example` | Super Admin | Organisations and users. No client results, by design. |
| `admin.fixture@cdp-demo.example` | Client Admin | Demo Retail Bank. |
| `exec.fixture@cdp-demo.example` | Executive | Demo Retail Bank. |
| `peoplelead.fixture@cdp-demo.example` | People Leader | Demo Retail Bank: organisational report only. |

### A suggested ten minute walk through

1. Sign in as the consultant and open **Portfolio**, then **Ostravane Logistics**.
2. Look at the **engagement stages**, then **Leadership 360** and **Segments** (small groups are hidden by design).
3. Open the **released report** and download the PDF or PowerPoint export.
4. Sign out and sign in as the **People Leader** to see that role sees only its own team.
5. Sign in as the **Executive** to see that role sees released results only.

