**PRIORITY ACTIVATOR CONSULTING**  |  CDP Platform Developer Specification  ·  PAC/CDP/TECH/001 v2.1**	CONFIDENTIAL**

**PRIORITY ACTIVATOR CONSULTING**

**CULTURE DYNAMICS PROFILE**

**CDP Platform**

**Developer Specification**

Build reference from setup to assessment, scoring, reporting, advisory and re-assessment

 

| **Document reference** | PAC/CDP/TECH/001 |
| --- | --- |
| **Version** | 2.1 Final · issued for build |
| **Date** | 1 October 2026 |
| **Instrument / rules version** | Item bank 1.1  ·  Rules 2.0 |
| **Prepared for** | CDP platform development team and PAC consulting faculty |
| **Classification** | Proprietary and Confidential: Priority Activator Consulting |

# Document control

| **Document** | CDP Platform Developer Specification |
| --- | --- |
| **Reference** | PAC/CDP/TECH/001 |
| **Version and status** | 2.1 Final · Issued for build · all design decisions adopted (Appendix H) |
| **Date** | 1 October 2026 |
| **Supersedes** | Specification 2.0 and the Technical Specification & Build Guide 1.0 |
| **Pinned versions** | Instrument (item bank) 1.1 · Rules 2.0 |
| **Owner** | PAC CDP faculty (method) · PAC engagement lead (release) |
| **Aligned source documents** | PAC/CDP/INST/001 Pre-Assessment Setup Guide v1.1 · PAC/CDP/ACT/001 Action Planning Guide v1.1 · Leadership 360° Self-Evaluation v1.1 · Leadership 360° Leader Evaluation v1.1 · Culture Dynamics Profile client deck v1.1 |
| **Change control** | Changes to formulas, thresholds or rules are raised as a PAC change request, released as a new rules version, and never applied retrospectively to a closed assessment (§3.2, §6.6). |
| **Classification** | Proprietary and Confidential: Priority Activator Consulting |

**Contents**

	**0  Foundations****	5**

	0.1  Authority and how to read this document	5

	0.2  Intellectual property and terminology	6

	0.3  The platform at a glance	6

	0.4  Reference architecture	7

	0.5  Roles and permissions	9

	0.6  Engagement lifecycle	11

	0.7  The reference fixture	12

	0.8  Developer quick start and definition of done	13

	**1  Setup****	14**

	1.1  Purpose and scope	14

	1.2  Roles and permissions in this stage	14

	1.3  Screens and user flow	14

	1.4  Data captured	15

	1.5  Calculations	19

	1.6  Decision rules	21

	1.7  Outputs to the next stage	22

	1.8  Acceptance criteria	23

	**2  Assessment****	24**

	2.1  Purpose and scope	24

	2.2  Roles and permissions in this stage	24

	2.3  Screens and user flow	24

	2.4  Data captured	26

	2.5  Calculations	27

	2.6  Decision rules	27

	2.7  Outputs to the next stage	29

	2.8  Acceptance criteria	30

	**3  Scoring****	31**

	3.1  Purpose and scope	31

	3.2  Roles and permissions in this stage	31

	3.3  Screens and user flow	31

	3.4  Data produced	31

	3.5  Calculations	33

	3.6  Decision rules	41

	3.7  Outputs to the next stage	42

	3.8  Acceptance criteria	42

	**4  Reporting****	43**

	4.1  Purpose and scope	43

	4.2  Roles and permissions in this stage	43

	4.3  Screens and user flow	43

	4.4  Data captured: the finding object	44

	4.5  Calculations: the alignment checks and signals	44

	4.6  Decision rules: report suite and release	48

	4.7  Report visual standards	49

	4.8  AI interpretation service	52

	4.9  Outputs to the next stage	53

	4.10  Acceptance criteria	54

	**5  Advisory and action planning****	55**

	5.1  Purpose and scope	55

	5.2  Roles and permissions in this stage	55

	5.3  Screens and user flow	55

	5.4  Data captured	56

	5.5  Calculations: from outcome to recommendation	58

	5.6  Decision rules: workflow and tracking	66

	5.7  Outputs	68

	5.8  Acceptance criteria	69

	**6  Re-assessment****	70**

	6.1  Purpose and scope	70

	6.2  Roles and permissions in this stage	70

	6.3  Screens and user flow	70

	6.4  Data captured	70

	6.5  Calculations	71

	6.6  Decision rules	72

	6.7  Outputs	73

	6.8  Acceptance criteria	73

	**Appendix A  Data model****	75**

	**Appendix B  API****	78**

	**Appendix C  Item bank (version 1.1)****	80**

	C.1  Culture scenarios (D1–D6)	80

	C.2  Readiness items (D7–D9)	85

	C.3  eOS, qualitative and consent items	87

	C.4  Leadership 360 items	88

	**Appendix D  Formula library and unit tests****	92**

	**Appendix E  Delivery plan****	95**

	**Appendix F  QA and UAT checklist****	96**

	**Appendix G  Glossary****	97**

	**Appendix H  Decisions adopted****	99**

	**Appendix I  Configuration registry****	101**

	**Appendix J  Error catalogue****	103**

	**Appendix K  Events and notifications****	104**

# 0  Foundations

New to this specification? Start with §0.8, which gives reading paths by role, the build order and the definition of done.

This specification is the single build reference for the Culture Dynamics Profile (CDP) platform. It is written so that a development team can build, test and release the platform without returning to PAC for interpretation. It follows the platform in the order a client experiences it: **setup**, **assessment**, **scoring**, **reporting**, **advisory and action planning**, and **re-assessment**. Each stage chapter uses the same eight headings: purpose, roles and permissions, screens and user flow, data captured, calculations, decision rules, outputs to the next stage, and acceptance criteria.

## 0.1  Authority and how to read this document

The specification and the five source documents listed in the document control table are aligned. For build purposes this specification is authoritative: where a source document is less precise (for example, it states a band without its boundary rule), code from this document. The source documents carry the client-facing wording of the same rules.

**Table 1  ****Reading conventions**

| **Marker** | **Meaning for the developer** |
| --- | --- |
| **Logic** | Exact, testable rule: formula, threshold, boundary, error behaviour. Code exactly this. |
| **Advisory meaning** | The interpretation a PAC consultant must give alongside the number. It constrains how a value is displayed; it never changes a calculation. |
| **Decision adopted** | A rule the source documents did not settle. The specification adopts the recommended option; build it exactly as written. Every adopted decision is listed in Appendix H, and every tunable value is a configuration key in Appendix I, so PAC can recalibrate later through a new rules version without a code release. |
| **Worked example** | Uses the reference fixture in §0.6. Every number is reproduced in the unit tests (Appendix D). |

### Engineering conventions

**Table 2  ****Engineering conventions**

| **Topic** | **Convention** |
| --- | --- |
| Arithmetic | All scoring arithmetic uses fixed-point decimal types, never binary floating point. Rounding is **ROUND_HALF_UP** (3.085 → 3.09). Binary floats would store 3.085 as 3.08499… and round it to 3.08; UT-10 detects this. |
| Stored precision | Orientation scores, gaps, lens scores, SDI and fit are stored to 2 dp. D7–D9 means, section averages, LRI, leadership alignment and TPS are stored to 4 dp and presented as stated in each rule. |
| Banding | Each metric states the value it is banded on (for example D7–D9 are banded on the 1 dp presented value; TPS on the 2 dp value). Bands are exhaustive and non-overlapping. |
| Identifiers | Prefixed opaque IDs: ten_, eng_, asm_, rsp_, fnd_, pri_, act_, rep_. Never expose sequential integers. |
| Enumerations | UPPER_SNAKE_CASE in code and APIs (for example PARTIAL_HIT, KEEP_AND_PROTECT); human labels come from a locale file. |
| Dates and time | Stored in UTC (ISO 8601). Displayed in the tenant time zone (default Africa/Nairobi). Working days exclude weekends and the tenant’s configured public holidays. |
| Orientation order | Always ENGAGE, INNOVATE, PERFORM, GOVERN in tables, charts, APIs and exports. |
| Versioning | Every assessment pins an instrument version and a rules version. Recomputation always uses the pinned versions. |

## 0.2  Intellectual property and terminology

The four orientations (ENGAGE, INNOVATE, PERFORM, GOVERN), the nine dimensions, the scenario statements, the scoring architecture, the alignment checks, the playbooks and all tooling described here are Priority Activator Consulting’s own development. The platform uses PAC terminology only.

| **TERMINOLOGY GATE (BUILD PIPELINE)** A PAC-maintained deny-list of third-party framework, instrument, survey-method and brand terms is scanned on every build across source code, database enumerations, seed data, UI strings, locale files, report templates, chart legends and AI prompt text. Any hit fails the build. The deny-list itself is stored in a restricted configuration file, is versioned with the rules, and is never rendered in the product. Metric names are PAC names: Employee Orientation Survey (eOS) with Advocates, Neutrals and Critics; Transformation Probability Score (TPS); Leader Readiness Index (LRI); strategic scorecard. |
| --- |

## 0.3  The platform at a glance

**Figure 1  ***End-to-end platform flow: six stages, the gates between them and the annual loop*

**Table 3  ****Stage summary**

| **Stage** | **What the platform does** | **Primary roles** | **Gate to the next stage** |
| --- | --- | --- | --- |
| 1 Setup | Creates the tenant and engagement, loads the org graph, captures Setup Sections A–I at the executive workshop, derives the strategic requirements and locks survey design. | Client Admin, PAC Consultant, Executive (workshop) | Launch pre-flight passes (§1.6). |
| 2 Assessment | Runs the culture survey and the Leadership 360, records consent, unlinks identity at submission, sends reminders and monitors response quality. | Respondent, rater, Client Admin, PAC Consultant | Window closed; consultant freezes data (§2.6). |
| 3 Scoring | Computes every metric deterministically from the frozen data: profiles, gaps, classes, readiness, eOS, 360 results, TPS, segments. | System; PAC Consultant reviews | Score object frozen and hashed (§3.6). |
| 4 Reporting | Evaluates C1–C4 and all signals, matches scenarios, builds the report suite, drafts narrative and releases reports after practitioner review. | PAC Consultant; audiences per report | Release gate: conclusion and recommendation present (§4.6). |
| 5 Advisory and action planning | Applies readiness gates, creates priority zero, selects up to four priorities with trade-offs and pathways, generates and governs actions. | PAC Consultant, Executive, Client Admin, People Leaders, owners | Blocking gates cleared before publication (§5.6). |
| 6 Re-assessment | Runs pulses, detects triggers, re-administers the CDP, compares with baseline, verifies trade-offs and adjusts or retires actions. | PAC Consultant, Client Admin | Next cycle opened (§6.6). |

## 0.4  Reference architecture

The platform is a multi-tenant web application. Each client organisation is a tenant. PAC operates the platform and receives consulting rights per engagement, never globally. Four concerns are separated by design: capture, scoring, interpretation and reporting. Scoring is deterministic and reproducible; interpretation may be probabilistic; the two never run in the same service.

**Figure 2  ***Reference architecture: clients, gateway, services and in-region stores*

**Table 4  ****Architecture layers**

| **Layer** | **Responsibility** | **Build rule** |
| --- | --- | --- |
| Front end | Respondent survey, consultant console, client dashboards, action-planning workspace. | Responsive, mobile-first respondent path; WCAG 2.1 AA; local draft persistence with explicit resume for low bandwidth. |
| API gateway | Versioned REST (/v1) over HTTPS; tenant scoping; role checks; rate limits. | Every request resolves tenant, actor, role and engagement. Queries whose resolved audience is below an anonymity floor are rejected here, not in the renderer. |
| Capture service | Invitations, consent, survey responses, 360 ratings, reminders. | Server-side revalidation of every submission; destroys the person–token link at submission. |
| Scoring service | All metrics in Stage 3. | Pure functions. No AI, randomness or external calls. Version-pinned. Re-running returns a byte-identical payload. |
| Segment engine | Segment resolution, suppression, differencing protection, heatmaps. | Reads pre-aggregated segment cubes with respondent counts; logs every query. |
| Rules engine | Checks C1–C4, signals, gates, scenarios, priorities, draft actions. | Rules stored as versioned data (decision tables), editable by PAC faculty without a code release. |
| Report service | Report assembly, charts, exports, release workflow. | Exports generated server-side from the released version; immutable. |
| Action service | Action records, workflow, RAG, reminders, escalation, evidence. | State transitions enforced server-side; illegal transitions return 409. |
| AI interpretation service | Draft narrative from findings only. | Receives no response rows, no verbatim text, no counts below floors. Guardrails in §4.5. |
| Stores | Operational relational DB; analytics store; encrypted text store; object storage; append-only audit log. | In-region per tenant; encryption in transit and at rest; field-level encryption for free text; key rotation. |

**Table 5  ****Non-functional requirements**

| **Quality attribute** | **Requirement** |
| --- | --- |
| Availability | 99.5% monthly for the respondent path during an open survey window; 99.0% otherwise. |
| Performance | Survey page response under 2 s at the 95th percentile with 5,000 concurrent respondents. Scoring of a 5,000-response assessment completes within 10 minutes. Segment queries return within 3 s. |
| Recovery | Recovery point objective 1 hour; recovery time objective 8 hours. Daily encrypted backups retained 35 days, in-region; point-in-time recovery enabled on the operational database; restore tested quarterly (D-04). |
| Security | MFA for every non-respondent role; optional SSO (OIDC or SAML) per tenant; OWASP ASVS level 2; annual penetration test; secrets in a managed vault. |
| Hosting region | Shared multi-tenant deployment in an African public-cloud region (default: South Africa), with a cross-border transfer basis recorded per tenant under its privacy regime (§1.4.5). A tenant whose regime or contract requires in-country hosting receives a dedicated in-country deployment of the same build (D-04). |
| Accessibility | WCAG 2.1 AA, including keyboard-only and screen-reader completion of the constant-sum control. |
| Browsers | Current and previous major versions of Chrome, Edge, Safari and Firefox; Android Chrome and iOS Safari for the respondent path. |
| Reference stack | Not mandated. Recommended: TypeScript single-page front end; a Python or TypeScript API with a decimal library; PostgreSQL for operational and analytics stores (materialised segment cubes); object storage; a job scheduler. Any stack that meets the conventions in §0.1 is acceptable. |

## 0.5  Roles and permissions

Seven roles are defined. **Coach** exists because the Leadership 360 and Leader Development Plan require a coach to see leader reports, which no other role could do without over-granting. Role assignment is per tenant and, for PAC roles, per engagement and time-boxed.

**Table 6  ****Roles**

| **Role** | **Held by** | **Scope** |
| --- | --- | --- |
| Super Admin | PAC platform operations | Tenant lifecycle, instrument and rules versions, keys, retention jobs. No access to response content or client reports. |
| PAC Consultant | PAC engagement lead and certified CDP practitioners | Full engagement scope for assigned tenants: setup, launch, data freeze, scoring review, findings, report release, plan review, closure countersign. |
| Client Admin | Client setup owner (CHRO or OD lead) | Org graph, respondent list, invitations, setup sections, action administration. Aggregate results after release. A Client Admin flagged is_people_lead (the CHRO) also reads leader reports and carrier/blocker classifications for development purposes. |
| Executive | CEO, ExCo, Board members | Released organisational and sub-culture reports, leadership-team aggregate, organisation-level plan and progress; their own leader report and those of their direct reports. |
| People Leader | Any leader with an accountable team | Own leader report, own team sub-culture report where the team meets the floor, own Leader Development Plan, own unit actions. |
| Coach | Internal or external coach assigned to named leaders | Leader reports and Leader Development Plans of assigned leaders only, for the assignment period. |
| Respondent | All staff; 360 raters | Own survey or rater form, own consent record, data-subject requests, published summary if the client publishes it. |

**Table 7  ****Permissions matrix (C create · R read · U update · A approve or release · — none)**

| **Object** | **Super Admin** | **PAC Consultant** | **Client Admin** | **Executive** | **People Leader** | **Coach** | **Resp.** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tenant and residency settings | CRU | R | R | — | — | — | — |
| Instrument and rules versions | CRU | R | — | — | — | — | — |
| Org graph and leader mapping | R | RU | CRU | R | R own team | — | — |
| Setup Sections A–I | — | CRUA | CRU | R | — | — | — |
| Survey launch and data freeze | — | A | C | — | — | — | — |
| Own survey or rater response | — | — | — | — | — | — | CRU to submit |
| Individual response rows | — | — | — | — | — | — | — |
| Scores and findings | — | RU (override with reason) | R after release | R after release | R own scope | — | — |
| Report release | — | A | — | — | — | — | — |
| Organisational report | — | R | R | R | R | — | R if published |
| Sub-culture report | — | R | R | R | R own team | — | — |
| Leader report | — | R | R if people lead | R self + direct reports | R self | R assigned | — |
| Carrier / blocker classification | — | R | R if people lead | — | R self | R assigned | — |
| Leadership-team aggregate | — | R | R | R | — | — | — |
| Draft actions | — | CRU | CRU | R | CRU own level | — | — |
| Action approval | — | R | R | A (organisation) | A (unit, as division head) | — | — |
| Evidence | — | R | RU | R | CRU | — | — |
| Audit log | R | R | R own tenant | — | — | — | — |

| **TWO RULES OVERRIDE THE MATRIX** No role, including Super Admin, can read an individual culture response row or an individual 360 rater response. The platform exposes aggregates only, and the database role used by the application has no grant that would allow it. No report reaches a client role until a PAC Consultant releases it (§4.6). |
| --- |

## 0.6  Engagement lifecycle

The platform models each client cycle as an **engagement** with one state at a time. Every transition has an owner, a guard condition and an audit entry. Stage chapters reference these states.

**Figure 3  ***Engagement state machine*

**Table 8  ****Engagement transitions**

| **From** | **To** | **Guard condition** | **Performed by** |
| --- | --- | --- | --- |
| — | SETUP | Tenant exists; engagement created with cycle number. | PAC Consultant |
| SETUP | FIELDING | Launch pre-flight passes (§1.6). | PAC Consultant approves; Client Admin launches |
| FIELDING | SCORING | Window closed (minimum 10 working days) and data frozen. | PAC Consultant |
| SCORING | REPORTING | Score object computed, reviewed and frozen. | PAC Consultant |
| REPORTING | DEBRIEF | At least the Organisational Culture Report and Board / Executive Summary released. | PAC Consultant |
| DEBRIEF | PLANNING | Priority zero recorded and the debrief logged. | PAC Consultant |
| PLANNING | IMPLEMENTATION | Organisation-level plan approved and published. | Executive approves; PAC Consultant releases |
| IMPLEMENTATION | PULSE / back | Pulse scheduled at 90 and 180 days; returns to IMPLEMENTATION on completion. | Scheduler; PAC Consultant |
| IMPLEMENTATION | RE-ASSESSMENT | 12 months elapsed or a trigger accepted (§6.5). | PAC Consultant |
| RE-ASSESSMENT | SETUP (next cycle) or CLOSED | Next cycle created with carry-forward, or client exit recorded. | PAC Consultant |

## 0.7  The reference fixture

All worked examples, charts and unit tests use one illustrative client: a mid-sized East African financial services firm of about 650 staff, mature stage. Its three-year strategy is to grow digital channels and differentiate on customer experience; its current model is a service (B2C) business. Twelve-month targets: digital adoption 28% → 45%; customer satisfaction +10 points; voluntary attrition 19% → 13%. The figures are illustrative and must never be presented as evidence about a real organisation.

**Table 9  ****Reference fixture: culture profile**

| **Dimension (NOW, organisation)** | **ENGAGE** | **INNOVATE** | **PERFORM** | **GOVERN** | **Sum** | **Dominant** |
| --- | --- | --- | --- | --- | --- | --- |
| D1 Cultural DNA | 20 | 14 | 30 | 36 | 100 | GOVERN |
| D2 Leadership Blueprint | 18 | 16 | 38 | 28 | 100 | PERFORM |
| D3 People Architecture | 22 | 12 | 30 | 36 | 100 | GOVERN |
| D4 Cohesion Drivers | 26 | 12 | 34 | 28 | 100 | PERFORM |
| D5 Strategic Compass | 22 | 16 | 34 | 28 | 100 | PERFORM |
| D6 Victory Conditions | 24 | 14 | 38 | 24 | 100 | PERFORM |
| **Orientation score NOW (D1–D6 mean)** | **22.00** | **14.00** | **34.00** | **30.00** | 100 | PERFORM |
| **Orientation score PREFERRED** | **31.00** | **25.00** | **28.00** | **16.00** | 100 | ENGAGE |
| Executive NOW (n = 11) | 30.00 | 16.00 | 32.00 | 22.00 | 100 | PERFORM |
| Staff NOW (n = 430) | 19.00 | 13.00 | 35.00 | 33.00 | 100 | PERFORM |

**Table 10  ****Reference fixture: other inputs**

| **Fixture input** | **Value** |
| --- | --- |
| Respondents | 650 invited · 487 submitted · 441 complete or substantially complete · 12 excluded |
| D7 · D8 · D9 (organisation) | 3.2 · 2.8 · 3.1 |
| eOS categories Q1–Q8 | +18 · +9 · −8 · +6 · +11 · −14 · +21 · +14 (Index 7.1) |
| Setup Section B | Top priority tagged INNOVATION_NEW_MODELS (digital channel growth) → requires INNOVATE > 28 |
| Setup Section A/B business model | Current SERVICE_B2C; no planned change → requires ENGAGE > 30 and PERFORM > 30 |
| Setup Section F | Target leadership behaviours tagged ENGAGE (coaching, listening) → leadership target orientation ENGAGE |
| Leadership 360 coverage | 0% in this cycle (no 360 run yet) |

## 0.8  Developer quick start and definition of done

**Table 11  ****Reading paths**

| **If you are building…** | **Read in this order** |
| --- | --- |
| Back end (services, API) | §0.1 conventions → §0.4 architecture → §0.5 permissions → Stage chapters 1–6 (Data captured, Calculations, Decision rules) → Appendices A, B, I, J, K. |
| Scoring and rules engine | §0.1 → §0.7 fixture → §3.5 → §4.5 → §5.5 → Appendix D (every unit test) → Appendix I. |
| Front end | §0.3 → each stage’s Screens and user flow → §2.3.1 constant-sum control → §4.7 visual standards → Appendix J (error handling). |
| Data and analytics | §3.5.12 segments and suppression → §3.6 master thresholds → Appendix A. |
| QA and test | §0.7 fixture → every Acceptance criteria table → Appendices D and F. |
| Security and DevOps | §0.4 non-functional requirements → §1.4.5 data protection → §2.6.5 anonymity → §6.6.3 retention → Appendix H (D-04). |

### Build rules that are never negotiable

- Scoring is pure, deterministic, decimal-based and version-pinned; it never calls AI.

- No role or service account can read an individual response or rater response.

- Every reporting floor is enforced at the API boundary and cannot be overridden.

- Every threshold is read from configuration (Appendix I), never hard-coded.

- Every client-visible number traces to the frozen score object and its hash.

- No report reaches a client role before a PAC Consultant releases it.

- No action is published over an open blocking gate; every BUILD names its release.

- Leader outputs can never be exported into performance, pay, succession or disciplinary contexts.

- The terminology gate runs on every build and fails it on any hit.

### Definition of done (every story)

**Table 12  ****Definition of done**

| **Area** | **Done means** |
| --- | --- |
| Behaviour | Matches the Logic and Decision rules of the relevant section exactly, including boundary values. |
| Tests | Unit tests for every formula and boundary; the named UT-xx tests pass; API contract tests for success and every listed error code. |
| Fixture | Any story touching scoring, checks or planning reproduces the §0.7 fixture values exactly. |
| Security | Permission checks tested for every role in §0.5; audit entries written; no new path to response rows. |
| Accessibility | WCAG 2.1 AA for any UI, including keyboard and screen reader. |
| Observability | Structured logs without personal data; metrics and alerts for failures; events emitted per Appendix K. |
| Documentation | API reference generated from code; configuration keys registered in Appendix I. |

# 1  Setup

Setup turns a client into a configured engagement. It records the organisation’s structure (which determines what can be analysed), captures the nine setup sections at the facilitated Pre-Assessment Executive Workshop (which determine what the culture will be judged against), derives machine-readable strategic requirements from them, and locks the survey design. Nothing is launched until the pre-flight in §1.6 passes.

## 1.1  Purpose and scope

- **In scope:** tenant and engagement creation; org graph and leader mapping; demographic attributes; Setup Sections A–I with workshop records; requirement tagging; the strategic scorecard; survey and 360 configuration; consent text; invitations; launch pre-flight.

- **Principle carried from PAC/CDP/INST/001:** all setup positions are agreed collectively at the executive workshop against the approved strategic plan. No input may be pre-filled by an individual or by HR working in isolation. The platform record is the single source of truth.

- **Sequence:** Sections B, C and D first (they anchor every finding); E, F and G captured separately by the executive team and by senior HR, then agreed; Section I finalised and locked last.

## 1.2  Roles and permissions in this stage

**Table 13  ****Setup responsibilities**

| **Task** | **Who** |
| --- | --- |
| Create tenant; set residency region and privacy regime | Super Admin |
| Create engagement (cycle) and assign consultants | Super Admin creates; PAC Consultant assigned per engagement |
| Load and maintain org graph, leader mapping, demographics, respondent list | Client Admin (PAC Consultant may edit) |
| Record workshop, capture and agree Sections A–I | PAC Consultant facilitates and records; Client Admin may draft; Executive participants confirm |
| Tag priorities, business model and target behaviours; confirm leadership target orientation | PAC Consultant (with workshop record) |
| Approve launch pre-flight | PAC Consultant |
| Launch survey and issue invitations | Client Admin, after consultant approval |

## 1.3  Screens and user flow

**Table 14  ****Setup screens**

| **ID** | **Screen** | **Behaviour** |
| --- | --- | --- |
| S1-01 | Tenant settings | Legal and trading name, sector, headcount, operating geography, residency region, privacy regime, time zone, public holidays, branding pack (logo, client colour for covers only). |
| S1-02 | Engagement | Cycle number, assigned consultants with start and end dates, planned window, linked previous engagement (for trend and action carry-forward). |
| S1-03 | Org graph import | CSV or XLSX template upload for units, grades, locations and people; live validation report (§1.6.1) with downloadable defect list; re-upload replaces by stable keys. |
| S1-04 | Leader mapping | Assign exactly one accountable leader per team with effect dates; reporting-chain viewer; cycle and self-leadership checks. |
| S1-05 | Cohort and demographics | Mark executive grades; define closed-list demographic attributes, each with its analytical purpose; preview cohort sizes against the five-respondent floor. |
| S1-06 | Setup workspace A–I | One tab per section; workshop record panel (date, participants, facilitator); field-level comments; section status (Draft → Agreed → Locked). |
| S1-07 | Perspective comparison (E, F, G) | Side-by-side executive and HR entries, a divergence flag per field, and an Agreed version that becomes the record. |
| S1-08 | Requirement tagging | Tag each Section B priority with a goal type; set current and planned business model; tag each Section F target leadership behaviour with an orientation; shows the derived requirements (§1.5) live. |
| S1-09 | Strategic scorecard | Objectives with KPIs, units, direction, baseline, 12-month and 3-year targets, imported from Sections C and D; optional CSV import. |
| S1-10 | Survey design (Section I) | Cohorts, anonymity commitment, languages, window, reminder plan, staff message, consent text version, completion-time statement, qualitative complement. |
| S1-11 | Leadership 360 configuration | Leaders in scope; rater nomination (§1.4.6); rater window; coach assignments. |
| S1-12 | Pre-flight and launch | Checklist with pass / fail per rule; launch button enabled only when every blocking rule passes; consultant approval recorded. |

## 1.4  Data captured

### 1.4.1  Tenant, structure and people

**Table 15  ****Tenant, structure and people**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| tenant.name / legal_name | string(200) | Required; legal name used in consent text and reports. | Y |
| tenant.sector | enum | FINANCIAL_SERVICES, NGO_SOCIAL_IMPACT, MANUFACTURING, TECHNOLOGY, PUBLIC_SECTOR, HEALTH, RETAIL, ENERGY_UTILITIES, OTHER. Drives benchmark labelling only. | Y |
| tenant.headcount | integer | 1–1,000,000. Context only; response rate is submitted ÷ invited (see Response rate). [PAC change 19 Oct 2026: was "Used for response-rate denominators".] | Y |
| tenant.geographies | enum[] | Country codes (ISO 3166-1 alpha-2); at least one. | Y |
| tenant.residency_region | enum | Hosting region; immutable after first launch. | Y |
| tenant.privacy_regime | enum | KE_DPA_2019, UG_DPPA_2019, RW_DPP_2021, TZ_PDPA_2022, NG_NDPA_2023, GH_DPA_2012, OTHER (free-text name). Selects consent text template and transfer rules. | Y |
| tenant.timezone | IANA tz | Default Africa/Nairobi. | Y |
| org_unit.unit_id / parent_unit_id | id | Self-referencing tree; no cycles; one root per tenant. | Y |
| org_unit.type | enum | DIVISION, DEPARTMENT, TEAM. Divisions optional; every team sits under a department. | Y |
| location | id + name | Mandatory attribute on people when the tenant has more than one site. | C |
| grade_band.rank_order / is_executive | int / bool | Ordered scale; at least one grade flagged executive before launch. | Y |
| person_of_record | record | employee_ref (tenant-unique), work email, unit (team), grade, location, employment_status ACTIVE / ON_LEAVE / EXITED. Never joined to a response. | Y |
| leader_assignment | record | person_id, team_id, effect_from, effect_to (nullable). Exactly one active accountable leader per team on any date. | Y |
| headcount_led | derived int | Count of ACTIVE persons whose team is led by the leader on the window start date (direct team only). | — |
| demographic_attribute | record | name, closed list of values, is_sensitive, analytical_purpose (required text). Free-text demographics are not permitted. Sensitive attributes default to “prefer not to say”. | Y |

### 1.4.2  Setup Sections A–I

Each section is stored as a structured record with a workshop record. Field codes (A1…I6) match PAC/CDP/INST/001. Sections E, F and G hold three perspectives: EXECUTIVE, HR and AGREED; only AGREED feeds the rules engine.

**Table 16  ****Setup Sections A–I**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| workshop.date | date | Required before a section can move to Agreed. | Y |
| workshop.participants | person[] | At least two named executive participants and the facilitating consultant. | Y |
| A1 Organisation name · A2 Sector · A3 Headcount · A4 Geography | mirrors tenant | Pre-filled from tenant; editable only by Client Admin. | Y |
| A5 Maturity stage | enum | START_UP, GROWTH, MATURE, TURNAROUND, POST_MERGER. | Y |
| A6 Assessment trigger | text(2000) | Free text; shown in report method section. | Y |
| B1 Strategic intent | text(1000) | 1–3 sentences. | Y |
| B2 Strategic horizon | enum | ONE_YEAR, THREE_YEARS, FIVE_YEARS. | Y |
| B3 Top strategic priorities | list[1..3] | Each item: text(300) + **goal_type** enum: RESULTS_GROWTH, INNOVATION_NEW_MODELS, PEOPLE_TALENT, COMPLIANCE_PROCESS, TRANSFORMATION. At least one priority required; exactly one goal type per priority. | Y |
| B4 Competitive positioning | enum[] | COST, INNOVATION, RELATIONSHIPS, QUALITY, SPEED, OTHER. | Y |
| B5 Market or customer shift | text(1000) | Optional. | N |
| B6 Business model | current enum + planned enum (nullable) + planned_by date | Enum: PRODUCT_B2B, SERVICE_B2C, PLATFORM_DIGITAL, NGO_SOCIAL_IMPACT, REGULATED. A planned model different from current, with planned_by inside the B2 horizon, sets model_transition = true. | Y |
| C1–C2 KPIs and baselines | scorecard KPI[] (§1.4.3) | 5–8 KPIs, each with baseline value and date. | Y |
| C3 Performance trend | enum | IMPROVING, STABLE, DECLINING. | Y |
| C4 Biggest performance gap | text(1000) | — | Y |
| C5 Voluntary attrition % | decimal(5,2) | 0–100. | Y |
| C6 Average time-to-hire (days) | integer | 0–365. | N |
| D1–D2 Targets 12 months and 3 years | on scorecard KPI | Per KPI; 12-month target required. | Y |
| D3 Definition of winning · D4 Board metrics · D5 Non-negotiable standards | text(1000) each | D5 feeds the KEEP & PROTECT narrative for GOVERN. | Y |
| E1–E6 Lived culture | text(2000) × 6, per perspective | Decisions, conflict, recognition, informal power, meetings, dysfunctional patterns. Divergence flag per field when executive and HR entries are marked different by the consultant. | Y |
| F1 Target leadership behaviours | list[5] | Each: observable behaviour text(300) + **orientation tag** (ENGAGE / INNOVATE / PERFORM / GOVERN). Validation rejects value statements (warning: text shorter than 6 words or without a verb from the observable-verb list; consultant can override). | Y |
| F2 Target staff behaviours | list[5] text(300) | Optional orientation tag. | Y |
| F3 Decision-making model · F4 Collaboration model | text(1000) | — | Y |
| F5 Innovation and risk appetite | enum | CONSERVATIVE, MODERATE, AMBITIOUS. Shown beside INNOVATE results; does not change any threshold. | Y |
| G1–G4 Stop / start agenda | list[3..5] each | Stop leadership behaviours; stop practices; start leadership behaviours; start practices. | Y |
| G5 Keep and protect | list | Workshop entries plus system entries written by the KEEP & PROTECT classification (§3.4) after scoring, labelled by source. | Y |
| H1–H6 Processes and enablers | text(2000) × 6 | Performance management, onboarding, promotion criteria, reward, bottlenecks, planned changes. H1, H3 and H4 each carry a **contradiction flag** the consultant may set after the debrief (feeds C3 evidence). | Y |
| I1–I6 Survey design | see §1.4.4 | — | Y |

### 1.4.3  Strategic scorecard

The platform holds a light strategic scorecard natively: objectives and KPIs captured from Sections C and D, optionally imported from CSV. It is not a strategy-execution system; its purpose is to give every organisation-level culture action a line to a strategic objective and a measurable KPI. Clients that run their own scorecard system exchange objectives, KPIs and readings through the scorecard import/export endpoints (Appendix B), delivered in phase P9 (D-07).

**Table 17  ****Strategic scorecard**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| objective.title | text(200) | Linked to one or more Section B priorities. | Y |
| kpi.name / unit | text(120) / enum | Unit: PERCENT, COUNT, CURRENCY (ISO 4217), RATIO, DAYS, SCORE, OTHER. | Y |
| kpi.direction | enum | HIGHER_IS_BETTER or LOWER_IS_BETTER. Drives RAG “moving towards target”. | Y |
| kpi.baseline_value / baseline_date / source | decimal / date / text | Baseline date not in the future. | Y |
| kpi.target_12m / target_3y | decimal | Target must differ from baseline in the stated direction. | Y / N |

### 1.4.4  Survey design and consent (Section I)

**Table 18  ****Survey design (Section I)**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| I1 Cohorts | cohort[] | Named analysis cohorts as predicates over org graph and demographics (for example executive flag, department, tenure band). Each cohort shows its projected size; projected size below 5 is a blocking pre-flight failure unless the cohort is marked “roll up to parent”. | Y |
| I2 Anonymity commitment | enum | FULL (default and recommended), CONFIDENTIAL_AGGREGATE. Both apply all floors in §2.5; the value changes only the staff-message wording. | Y |
| I3 Languages | locale[] | Only locales with a published, reconciled item-bank variant can be selected (§2.3.3). | Y |
| I4 Window | start date, close date | At least 10 working days; must not overlap another live CDP assessment for the tenant; warning if it overlaps the tenant’s performance-review period. | Y |
| I5 Staff communication | text(3000) | Must state purpose, use of results, anonymity commitment and what will happen next; template provided. | Y |
| I6 Qualitative complement | enum + counts | NONE, INTERVIEWS, FOCUS_GROUPS, BOTH; recommended minimum 8 interviews and 2 focus groups. | Y |
| completion_estimate_text | string | Default “35–45 minutes”. Updated after measurement (§2.5, D-11). | Y |
| consent_text_version | ref | Generated from the privacy-regime template; edited by PAC Consultant; locked at launch. | Y |
| reminder_plan | enum | STANDARD (day 3, day 6, 24 h before close, final reminder to started-not-submitted). Custom plans require consultant approval. | Y |

### 1.4.5  Data protection obligations

The obligations below implement the data-protection position for Kenyan tenants under the Kenya Data Protection Act, 2019 and its regulations; for other tenants the equivalent regime selected in tenant.privacy_regime applies. The client’s data protection officer and PAC legal review the configuration before first launch in each jurisdiction.

**Table 19  ****Data protection implementation**

| **Obligation** | **Platform implementation** |
| --- | --- |
| Lawful basis and consent | Consent captured per respondent before the first item renders, as an explicit affirmative action, timestamped, against a versioned consent text that states purpose, data categories, retention, recipients and the right to withdraw. Not bundled with employment terms. |
| Purpose limitation | Assessment purpose stored on the engagement and reproduced in consent text. Exports other than released reports are blocked. |
| Data minimisation | Only demographics named in Section I with an analytical purpose can be collected. |
| Sensitive personal data | Gender, age band, disability, health and ethnicity attributes are sensitive: optional, default “prefer not to say”, never blocking. |
| Data subject rights | Self-service access, rectification of demographic attributes, objection and erasure of the invitation record. The consent text states before submission that a submitted response is unlinked and cannot be individually retrieved or deleted. |
| Retention and destruction | 24 months from assessment close, then irreversible destruction of response-level data, unless the client requests an alternative in writing before expiry. Notifications at 90 and 30 days; destruction certificate. Treatment of aggregates: §6.4. |
| Cross-border transfer | Residency enforced at storage and processing. Any out-of-region processing (including AI interpretation) requires a recorded transfer basis on the tenant; otherwise the service must run in-region. |
| Controller / processor | The client is controller; PAC is processor. The platform keeps a processing register, a sub-processor list and a breach workflow that supports notification to the controller and the regulator within 72 hours of becoming aware of a qualifying breach. Registration with the Office of the Data Protection Commissioner, where required, is confirmed on the tenant record. |
| Impact assessment | A data protection impact assessment is recorded on the tenant before first launch (recommended for all tenants). |
| Ethical use | CDP findings are never used for decisions about specific individuals. Enforced by construction: no individual culture response exists; leader outputs are development-only and cannot be exported into performance, remuneration, succession or disciplinary contexts. |

### 1.4.6  Leadership 360 configuration

**Table 20  ****Leadership 360 configuration**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| leaders_in_scope | assignment[] | Default: every accountable leader. Each leader in scope must be a person of record with a work email. | Y |
| rater nomination | rater[] per leader | Leader proposes; line manager approves (or Client Admin on their behalf). Defaults: superior = line manager (1); direct reports = all direct team members (pre-filled from org graph); peers = 3–8 nominated. Minimum 3 non-self raters in total is required for a valid result (D-09). | Y |
| rater_group | enum | SUPERIOR, PEER, DIRECT_REPORT, OTHER. | Y |
| coach_assignment | person + leaders[] + dates | Optional; grants the Coach role for assigned leaders only. | N |

## 1.5  Calculations

### 1.5.1  Strategic requirements (input to C1)

**Logic.** Each Section B3 priority produces one requirement from its goal type. Thresholds are strict inequalities on the organisation-wide NOW orientation score. Margins are shown as distance from the 25-point neutral point (four orientations sharing 100 points equally).

**Table 21  ****C1 requirement lookup (rules data)**

| **goal_type** | **Required orientation(s)** | **Threshold** | **Margin** | **Requirement type** |
| --- | --- | --- | --- | --- |
| RESULTS_GROWTH | PERFORM | > 30 | +5 | SINGLE |
| INNOVATION_NEW_MODELS | INNOVATE | > 28 | +3 | SINGLE |
| PEOPLE_TALENT | ENGAGE | > 30 | +5 | SINGLE |
| COMPLIANCE_PROCESS | GOVERN | > 28 | +3 | SINGLE |
| TRANSFORMATION | ENGAGE and INNOVATE | > 26 each | +1 each | JOINT |

- Duplicate requirements (two priorities with the same goal type) are merged into one requirement that lists both priorities as its source.

- Each distinct requirement is evaluated separately in C1 (§4.4.1) and produces its own finding. The C1 headline verdict is the worst of them (MISS < PARTIAL HIT < HIT).

### 1.5.2  Business-model requirement (input to C4)

**Table 22  ****C4 requirement lookup (rules data)**

| **Model** | **Requirement** | **Threshold** | **Type** |
| --- | --- | --- | --- |
| PRODUCT_B2B | PERFORM and INNOVATE | 30 and 28 | PAIRED (each at its single threshold) |
| SERVICE_B2C | ENGAGE and PERFORM | 30 and 30 | PAIRED |
| PLATFORM_DIGITAL | INNOVATE dominant | > 28 and highest NOW | DOMINANT |
| NGO_SOCIAL_IMPACT | ENGAGE and INNOVATE | 30 and 28 | PAIRED |
| REGULATED | GOVERN and PERFORM | 28 and 30 | PAIRED |
| Any, with model_transition = true | All four orientations | > 24 each (margin −1) | BALANCED (supersedes the current model) |

| **C4 PAIRED-ORIENTATION THRESHOLD (D-01)** Paired business-model requirements test **each named orientation against its own single-orientation threshold** (30 for ENGAGE and PERFORM, 28 for INNOVATE and GOVERN). The lower +1 margin (26 each) applies only to the C1 TRANSFORMATION requirement, which asks for two orientations to emerge together rather than for two established strengths. Rationale: a business model needs both named orientations to be strong in their own right; two orientations at 30 each are arithmetically achievable under constant-sum (60 of 100 points). This is the rule that reproduces the published worked example (C4 PARTIAL HIT, alignment 86.7%). It is stored as rules data; UT-15 is the reference test. |
| --- |

### 1.5.3  Leadership target orientation (input to C2, TPS, LRI and carrier logic)

**Logic.** The leadership target orientation is the orientation most often tagged on the five Section F1 target leadership behaviours. A tie must be resolved by the consultant at setup, with a recorded reason, before Section F can be agreed. This one value is used everywhere a “target” orientation is needed for leadership: the C2 target, the D2 term of leadership alignment, the LRI alignment section, and the carrier/blocker test.

| **WORKED EXAMPLE** Section F1 has five behaviours tagged ENGAGE, ENGAGE, ENGAGE, PERFORM, ENGAGE → leadership target orientation = ENGAGE. Section B3 priority 1 tagged INNOVATION_NEW_MODELS → C1 requirement INNOVATE > 28. Business model SERVICE_B2C, no planned change → C4 requirement ENGAGE > 30 and PERFORM > 30. |
| --- |

### 1.5.4  Structural derivations

**Table 23  ****Structural derivations**

| **Derived value** | **Rule** |
| --- | --- |
| headcount_led(leader) | ACTIVE persons in the leader’s team on the window start date. |
| Executive cohort | Respondents whose grade has is_executive = true at submission (snapshot). |
| Projected cohort size | Count of ACTIVE persons matching the cohort predicate; used only for pre-flight warnings, never for reporting. |
| Divergence (E, F, G) | For tagged fields (F1), the share of behaviours whose orientation tag differs between EXECUTIVE and HR entries; for text fields, the consultant’s divergence flag. Reported as a pre-assessment finding of type SETUP_DIVERGENCE. |

## 1.6  Decision rules

### 1.6.1  Org graph and leader-mapping validation

**Table 24  ****Mapping validation**

| **#** | **Rule** | **On failure** | **Blocking** |
| --- | --- | --- | --- |
| V1 | Every team has exactly one active accountable leader on the window start date. | List teams | Yes |
| V2 | Every accountable leader is a person of record and an invited respondent. | List leaders | Yes |
| V3 | No person leads their own team as its only member; no cycles in the reporting chain. | List chain | Yes |
| V4 | Every person resolves to exactly one team, one grade and (if multi-site) one location. | List persons | Yes |
| V5 | At least one grade is flagged executive, and the projected executive cohort is at least 5. | Warning if < 5 (perception gap will not compute) | No |
| V6 | Every team either has a projected size of at least 5 or is marked “roll up to parent”. | List teams | Yes |
| V7 | Work emails are unique and well-formed. | List rows | Yes |

A consultant may override a blocking rule only by recording a reason; the override is listed in the technical appendix of every report.

### 1.6.2  Launch pre-flight

**Table 25  ****Launch pre-flight**

| **#** | **Check** | **Failure behaviour** |
| --- | --- | --- |
| L1 | Mapping validation passes or every failure carries a consultant override. | 422 with defect list |
| L2 | Sections B, C, D, F, G, H and I are Agreed; E has an Agreed perspective; each has a workshop record with two or more executives. | 422 naming sections |
| L3 | At least one B3 priority with a goal type; business model set; leadership target orientation set (tie resolved). | 422 |
| L4 | Scorecard has at least one objective and one KPI with baseline and 12-month target. | 422 |
| L5 | Section I complete and locked; window ≥ 10 working days; all languages have published variants. | 422 |
| L6 | Consent text version approved by a PAC Consultant; privacy regime and residency set; transfer basis recorded if any processing is out of region. | 422 |
| L7 | Invitation list matches the ACTIVE persons in scope (difference report shown). | Warning |
| L8 | Leadership 360 configured if in scope: raters nominated and approved for each leader. | Warning; 360 can launch later in the window |

| **LOCK RULE** Launch locks Sections A–I and Section I in particular. Any later change to setup that affects scoring or rules (cohorts, requirements, business model, target orientation) creates a new assessment version and is visible in the technical appendix; text-only edits are allowed and audited. |
| --- |

## 1.7  Outputs to the next stage

| {   "engagement_id": "eng_2026_01",   "setup_version": 3,   "requirements": {     "c1": [ { "requirement_id": "req_01", "goal_type": "INNOVATION_NEW_MODELS",               "orientations": ["INNOVATE"], "thresholds": {"INNOVATE": 28}, "type": "SINGLE",               "source_priorities": ["B3.1"] } ],     "c4": { "model": "SERVICE_B2C", "model_transition": false, "type": "PAIRED",             "orientations": ["ENGAGE","PERFORM"], "thresholds": {"ENGAGE": 30, "PERFORM": 30} },     "leadership_target_orientation": "ENGAGE"   },   "executive_grades": ["grd_01","grd_02"],   "cohorts": [ {"cohort_id": "coh_exec", "predicate": {"is_executive": true}, "projected_n": 12} ],   "survey": { "window": {"open": "2026-10-05", "close": "2026-10-19"}, "languages": ["en-GB"],               "consent_text_version": "cst_KE_v4", "instrument_version": "1.1", "rules_version": "2.0" } } |
| --- |

## 1.8  Acceptance criteria

**Table 26  ****Setup acceptance criteria**

| **ID** | **Criterion** |
| --- | --- |
| AC-1.1 | A tenant and engagement can be created; residency and privacy regime are immutable after first launch. |
| AC-1.2 | Org graph import reports every V1–V7 defect with row references; launch is blocked until resolved or overridden with a reason. |
| AC-1.3 | A section cannot move to Agreed without a workshop date and two named executives; E, F and G store EXECUTIVE, HR and AGREED perspectives. |
| AC-1.4 | Requirements derive exactly per §1.5.1–§1.5.3; a tie blocks Section F agreement. |
| AC-1.5 | Pre-flight L1–L6 block launch with a 422 naming the failed checks; L7–L8 warn. |
| AC-1.6 | Locked setup cannot be edited in any field that affects scoring without creating a new assessment version. |
| AC-1.7 | Every demographic attribute has an analytical purpose; free-text demographics cannot be created. |

# 2  Assessment

Assessment is data capture. It runs two instruments inside one survey window: the **culture survey** (every respondent) and the **Leadership 360** (leaders in scope and their raters). Its job is to capture complete, valid, candid data and to make it impossible to link any response back to a person.

## 2.1  Purpose and scope

- **In scope:** respondent survey journey; constant-sum entry; D7–D9, eOS and qualitative capture; Leadership 360 self and rater forms; consent; token lifecycle and identity unlinking; reminders and window management; live response-rate and data-quality monitoring; data freeze.

- **Out of scope here:** any score. The capture service stores raw values only; Stage 3 computes everything.

## 2.2  Roles and permissions in this stage

**Table 27  ****Assessment responsibilities**

| **Task** | **Who** |
| --- | --- |
| Complete the culture survey | Respondent (single-use token; no login) |
| Complete a 360 self form / rater form | Leader in scope / nominated rater (single-use token per form) |
| Monitor response rates | Client Admin and PAC Consultant: counts and rates only, and only for cohorts with at least 5 invited people |
| Monitor data quality, void a response with reason | PAC Consultant |
| Extend the window | PAC Consultant once; a second extension requires the engagement lead |
| Freeze data and close the window | PAC Consultant |

## 2.3  Screens and user flow

**Figure 4  ***Respondent journey for the culture survey*

**Table 28  ****Assessment screens**

| **ID** | **Screen** | **Behaviour** |
| --- | --- | --- |
| S2-01 | Landing | Validates the token; shows organisation name, purpose, the staff message (I5), the completion-time statement and the anonymity commitment. Expired or used tokens show a neutral message with no personal data. |
| S2-02 | Language | Lists published locales for the assessment; choice stored on the response. |
| S2-03 | Consent | Full consent text, with the statement that a submitted response cannot be individually retrieved or deleted. Explicit tick plus “I agree”. Declining ends the session and records a decline with no other data. |
| S2-04 | About you | Closed-list demographics named in Section I; sensitive attributes default to “prefer not to say”. Grade and unit are pre-filled from the invitation snapshot and are not editable. |
| S2-05 | Instructions | Constant-sum and Likert instructions with an interactive practice scenario (not stored). |
| S2-06 | NOW · D1–D6 | 18 scenario screens (one scenario per screen on mobile; up to three per screen on desktop). Progress shows “scenario set n of 36”. |
| S2-07 | PREFERRED · D1–D6 | Perspective-change interstitial, then the same 18 scenarios with the PREFERRED stem (“…five years from now”). The respondent’s NOW allocations are not shown, to avoid anchoring. |
| S2-08 | D7, D8, D9 | Three blocks of 12 items, 1–5 agreement, one block per screen with a “why this matters” note. |
| S2-09 | eOS | Eight items, 0–10. |
| S2-10 | Qualitative | Three open questions, 2,000 characters each, optional, with a reminder not to name individuals. |
| S2-11 | Review and submit | Summary of completion; unanswered optional items listed; submit button. |
| S2-12 | Confirmation | Thanks and what happens next. No receipt of answers is offered. |
| S2-13 | 360 self form | Leader-facing: 60 items (Sections A–H), 1–5, all required; six reflection questions; acknowledgement. One sitting or resume by token. |
| S2-14 | 360 rater form | Relationship question (superior, peer, direct report, other), frequency of interaction, 60 items with a “not observed” option (leave blank), seven qualitative questions, rater confirmation. |
| S2-15 | Response monitor | Admin and consultant: invited, started, submitted by cohort (cohorts ≥ 5 invited only), daily trend, reminder log. |
| S2-16 | Quality monitor | Consultant: counts of each quality flag, median completion time, void action with reason. |

### 2.3.1  Constant-sum control

**Table 29  ****Constant-sum control**

| **Property** | **Specification** |
| --- | --- |
| Layout | Four statements labelled ENGAGE, INNOVATE, PERFORM, GOVERN in that fixed order. The orientation label is shown (the instrument is a self-report of relative emphasis, not a disguised test). |
| Input | Integer 0–100 per statement via numeric field and stepper (keyboard and screen-reader operable). Slider is optional and must snap to integers. |
| Running total | Live total with remaining points (“35 left”); turns to a confirmed state at exactly 100. |
| Advance rule | Next is disabled until the scenario totals exactly 100. No auto-balancing or auto-fill. |
| Persistence | Draft saved locally on every change and server-side on every scenario completion. |

### 2.3.2  Instrument structure

**Table 30  ****Instrument structure (full item bank in Appendix C)**

| **Block** | **Count** | **Scale** | **Perspective** |
| --- | --- | --- | --- |
| D1–D6 culture scenarios | 18 scenarios × 4 statements | Constant-sum, exactly 100 per scenario | NOW and PREFERRED (36 scenario sets, 144 allocations) |
| D7 Digital Readiness | 12 items | 1–5 agreement | Single |
| D8 Psychological Safety | 12 items | 1–5 agreement | Single |
| D9 Adaptive Capacity | 12 items | 1–5 agreement | Single |
| eOS | 8 items | 0–10 | Single |
| Qualitative | 3 questions | Free text | Single |
| Total quantitative values per respondent | 188 | 144 + 36 + 8 | — |
| Leadership 360 | 60 items (A–D 10 each; E–H 5 each) | 1–5 frequency / agreement | Self; raters by group |

### 2.3.3  Languages

Each item has one canonical UK-English source text (item bank 1.1) and zero or more locale variants. A variant is publishable only after forward translation, independent back-translation and reconciliation by a bilingual certified practitioner, recorded against the item. Scores from locale variants of the same item version are pooled; a language cohort is reportable only with five or more respondents, and the platform flags any orientation where a language cohort diverges from the rest by 8.0 points or more, because that may indicate a translation defect.

| **LOCALES (D-03)** The platform launches in en-GB. Kiswahili (sw-KE) and French (fr) are translated and reconciled during phase P10 and published before the first non-English client launch; further languages are added per client contract. Reconciliation is done by a PAC-certified bilingual practitioner who did not produce the forward translation. The locale model is built in phase P3, so adding a language is a content task, not a release. |
| --- |

## 2.4  Data captured

**Table 31  ****Assessment data**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| invitation.token_hash | hash | Single-use, 128-bit random token; only the hash is stored. Expires at window close. | Y |
| invitation.person_id | id | Present until submission; set to null at submission and person_link_destroyed_at recorded. | Y |
| invitation.demographic_snapshot | json | Unit path, grade, executive flag, location, tenure band and other Section I attributes, captured at send; the only demographic link carried to the response. | Y |
| consent_record | record | invitation_id (until unlink), consent_text_version, decision (AGREE / DECLINE), timestamp. Retained as a count and text version after unlink. | Y |
| response.response_id / assessment_id | id | No person reference of any kind. | Y |
| response.language / started_at / submitted_at / duration_seconds | locale / ts / int | Duration is active time (gaps over 30 minutes excluded). | Y |
| response.completion_state | enum | COMPLETE, SUBSTANTIALLY_COMPLETE, PARTIAL_CULTURE, INSUFFICIENT, ABANDONED (§2.6.3). | Y |
| response.quality_flags | enum[] | SPEEDING, STRAIGHT_LINING, UNIFORM_ALLOCATION, PERSPECTIVE_DUPLICATION; set in Stage 3 step 2. | — |
| response_allocation | row | response_id, scenario_id, perspective (NOW / PREFERRED), orientation, points (0–100). Database check: four rows per (response, scenario, perspective) summing to 100. | Y |
| response_item | row | response_id, item_id, value (D7–D9: 1–5; eOS: 0–10). Missing = no row. | N |
| response_text | row | response_id, question_code (Q1–Q3), encrypted_text. Field-encrypted. | N |
| rater_response | record | leader_360_id, rater_group, interaction_frequency, submitted_at. No rater identity after submission. | Y |
| rater_rating | row | rater_response_id, item_id, value 1–5 or NOT_OBSERVED (null). | Y |
| self_rating | row | leader_360_id, item_id, value 1–5 (all 60 required). | Y |
| rater_text / self_text | row | question_code, encrypted_text; released to the leader only after consultant review (§4.5). | N |

## 2.5  Calculations

**Table 32  ****Assessment calculations**

| **Value** | **Rule** |
| --- | --- |
| Progress | Scenario sets completed ÷ 36 for the culture block; then block-level progress for D7–D9, eOS, qualitative. |
| Response rate | submitted ÷ invited, per assessment and per cohort with ≥ 5 invited. |
| Median completion time | Median duration_seconds of COMPLETE responses; recomputed hourly while the window is open. |
| Completion-time statement check | After the first 30 COMPLETE responses (or at UAT), if the median falls outside 30–50 minutes the Client Admin is prompted to update completion_estimate_text for future reminders. (D-11.) |
| Window working days | Count of working days from open to close in the tenant calendar; must be ≥ 10. |

## 2.6  Decision rules

### 2.6.1  Validation at capture

**Table 33  ****Validation at capture**

| **Rule** | **Behaviour** |
| --- | --- |
| Constant-sum integrity | A scenario is accepted only if its four allocations are integers ≥ 0 summing to exactly 100. Revalidated server-side on save and submit, and enforced by a database constraint. Failing rows are rejected (422), never corrected. |
| Scale integrity | D7–D9 and 360 items accept integers 1–5; eOS accepts integers 0–10; rater items also accept NOT_OBSERVED. Out-of-range values return 422. |
| Single submission | One submission per token. A second submit returns 409. A consultant may void a response with a recorded reason; voided responses are excluded from all scoring and counted in the exclusion log. |
| Self-form completeness | All 60 self items are required before submission. |
| Free text | Stored field-encrypted. Any text shown in a thematic extract is screened for names and identifying details first (§4.5). |

### 2.6.2  Window, reminders and extension

- Invitations at open; reminders on working day 3, working day 6 and 24 hours before close; a final reminder only to started-not-submitted tokens. Reminders stop on submission.

- One extension by a PAC Consultant (up to 5 working days); a second extension requires the engagement lead. Every extension is recorded and listed in the technical appendix because it changes cohort composition.

- At close the window cannot reopen. Late tokens are expired. The consultant then **freezes** the dataset: the freeze records counts, hashes the response set and moves the engagement to SCORING.

### 2.6.3  Completion states

**Table 34  ****Completion states**

| **State** | **Definition** | **Treatment in scoring** |
| --- | --- | --- |
| COMPLETE | All 36 scenario sets, all 36 Likert items and all 8 eOS items. | Included in all analyses. |
| SUBSTANTIALLY_COMPLETE | All 36 scenario sets; one or more Likert or eOS items missing. | Included in culture analyses; each D7–D9 mean and eOS category uses valid items only. |
| PARTIAL_CULTURE | Fewer than 36 sets but all 18 NOW scenarios. | NOW profile only; excluded from gaps, classes, pathways. Counted separately. |
| INSUFFICIENT | Fewer than 18 NOW scenarios, or excluded by quality flags (§2.6.4). | Excluded from all scoring; in the exclusion log with reason. |
| ABANDONED | Started, not submitted, window closed. Drafts are submitted automatically at close only if the respondent ticked “submit my answers if I run out of time” at consent; otherwise not scored. | Denominator only; destroyed with the assessment. |

### 2.6.4  Quality flags (computed in Stage 3, step 2)

**Table 35  ****Quality flags**

| **Flag** | **Test** | **Treatment** |
| --- | --- | --- |
| SPEEDING | Active completion time below the higher of 8 minutes or one third of the assessment’s median completion time. | Flag (D-10). |
| STRAIGHT_LINING | Zero variance across all 36 D7–D9 items answered. | Exclude from D7–D9 means if also SPEEDING; otherwise retain and report the count. |
| UNIFORM_ALLOCATION | 25/25/25/25 on 12 or more of the 18 NOW scenarios. | Retain in counts; exclude from dominance, strength and congruence calculations; report incidence. |
| PERSPECTIVE_DUPLICATION | NOW and PREFERRED identical on 16 or more of 18 scenarios. | Retain; annotate gap analysis with the incidence. |
| Exclusion rule | SPEEDING together with any other flag. | Response becomes INSUFFICIENT and is excluded from all scoring. |

Exclusion requires SPEEDING plus one other flag, because UNIFORM_ALLOCATION with PERSPECTIVE_DUPLICATION alone can describe a genuinely undecided respondent.

### 2.6.5  Anonymity mechanics

**Table 36  ****Anonymity mechanics**

| **Mechanism** | **Rule** |
| --- | --- |
| Unlinking | On submission the response is written against the invitation’s demographic snapshot and the person–token link is destroyed in the same transaction. The platform cannot reconstruct an individual response. |
| Culture floor | No culture segment is reported below 5 valid responses (enforced in Stage 3, §3.5.10). |
| 360 floor | A rater group is reported only with 3 or more raters; groups below 3 merge into “all others”; a superior group of one always merges. A 360 result is valid only with the self form plus at least 3 non-self raters in total. |
| Qualitative floor | Verbatim extracts only for segments with at least 8 valid qualitative responses; otherwise themes with counts. |
| Monitoring | Response-rate views show only cohorts with at least 5 invited people and never list who has or has not responded. |

## 2.7  Outputs to the next stage

| {   "assessment_id": "asm_7f31", "frozen_at": "2026-10-20T09:00:00Z",   "instrument_version": "1.1", "rules_version": "2.0",   "counts": { "invited": 650, "started": 512, "submitted": 487, "complete": 418,               "substantially_complete": 23, "partial_culture": 22, "insufficient": 12,               "voided": 0, "abandoned": 25 },   "response_set_hash": "sha256:9c1e…",   "leader_360": { "leaders_in_scope": 64, "valid_results": 0 },   "extensions": [], "overrides": [] } |
| --- |

In the fixture, 441 responses (418 complete + 23 substantially complete) enter gap analysis; 463 enter the NOW profile (adding the 22 partial); 12 are excluded.

## 2.8  Acceptance criteria

**Table 37  ****Assessment acceptance criteria**

| **ID** | **Criterion** |
| --- | --- |
| AC-2.1 | A respondent can complete all 36 scenario sets on a 360-px-wide mobile screen, keyboard-only and with a screen reader. |
| AC-2.2 | A non-100 scenario is rejected by the client, the API (422) and the database. |
| AC-2.3 | Consent is recorded before the first item renders; declining stores no response data. |
| AC-2.4 | After submission no query, log or backup can join the response to a person (verified by inspection of the schema, application grants and logs). |
| AC-2.5 | Reminders fire on schedule in a simulated-clock test and stop on submission. |
| AC-2.6 | Completion states and quality flags are assigned exactly as §2.6.3–2.6.4 on a seeded dataset. |
| AC-2.7 | Response-rate views never show a cohort with fewer than 5 invited people. |
| AC-2.8 | Freeze produces the manifest above; scoring cannot start before freeze. |

# 3  Scoring

Scoring converts the frozen dataset into one immutable **score object**. Every function in this stage is pure, deterministic and pinned to the assessment’s instrument and rules versions. No AI, randomness or external call is permitted. Re-running scoring on the same frozen data returns a byte-identical payload.

## 3.1  Purpose and scope

- **In scope:** revalidation; quality flags and completion states; orientation scores; gaps and classification; dominance, strength, congruence and lenses; D7–D9; eOS; Leadership 360 scoring and the LRI; leadership alignment and the TPS; segments, perception gap, sub-culture detection and suppression; leader–culture link.

- **Out of scope:** alignment checks, scenarios and recommendations (Stage 4 and Stage 5).

## 3.2  Roles and permissions in this stage

**Table 38  ****Scoring responsibilities**

| **Task** | **Who** |
| --- | --- |
| Run scoring (idempotent) | System, triggered by the consultant after freeze |
| Review scores, flags, exclusion log, segment suppression | PAC Consultant |
| Change a score | Nobody. Scores are immutable. A consultant may void a response (Stage 2) and re-run, which creates a new score version with the reason recorded. |
| Freeze the score object | PAC Consultant |

## 3.3  Screens and user flow

**Table 39  ****Scoring screens**

| **ID** | **Screen** | **Behaviour** |
| --- | --- | --- |
| S3-01 | Score review | Organisation NOW and PREFERRED profile, gaps and classes, readiness, eOS, response-rate table and exclusion log, with every value traceable to its formula and inputs (“show working”). |
| S3-02 | Data-quality panel | Flag counts, exclusions by reason, internal-consistency coefficients for D7–D9, extensions and overrides. |
| S3-03 | Segment explorer | Predicate builder with live permitted count; profile, gap, readiness and eOS for permitted segments; suppression reasons shown in place of values. |
| S3-04 | Leader results | Per leader: validity, rater-group coverage, section averages, flags, LRI; aggregate distribution. Visible to the consultant only at this stage. |
| S3-05 | Freeze | Displays the score hash and versions; freezing moves the engagement to REPORTING. |

## 3.4  Data produced

**Table 40  ****Score object**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| score_object.assessment_id / version | id / int | A new version is created only by a re-run after a void; earlier versions are retained. | Y |
| score_object.payload_hash | sha256 | Hash of the canonical JSON payload; used in determinism tests and on report technical appendices. | Y |
| orientation_scores | {now, preferred, gap} × 4 | 2 dp. | Y |
| classification / significant | enum × 4 / bool × 4 | §3.5.3. | Y |
| dimension_scores | D1–D6 × {now, preferred} × 4 | 2 dp; required for lenses, C2, C3 and watch-lists. | Y |
| dominance | {dominant[], secondary, shared} | dominant is a list: one orientation, or two when shared. | Y |
| strength / congruence / lenses | decimal / object / object | §3.5.5–3.5.7. | Y |
| readiness | {d7, d8, d9, leadership_alignment, coverage, tps, tps_band, provisional} | §3.5.8, §3.5.11. | Y |
| eos | {q1..q8, index} | Integers for categories; index 1 dp. | Y |
| cohorts / perception_gap | object | Executive and staff profiles and absolute gaps, or a not_computed_reason. | Y |
| segment_profiles | segment_profile[] | Pre-aggregated for every permitted segment in the standard axes; others computed on request. | Y |
| leader_results | leader_360[] | Per valid result: section averages by group, flags, gaps, LRI, fit, classification. | N |
| quality | object | Counts per completion state and flag; exclusion reasons; internal-consistency coefficients. | Y |

## 3.5  Calculations

**Figure 5  ***Scoring pipeline: nine pure, version-pinned steps*

### 3.5.1  Which responses enter which calculation

**Table 41  ****Inclusion rules**

| **Calculation** | **Responses included** |
| --- | --- |
| NOW orientation and dimension scores | COMPLETE, SUBSTANTIALLY_COMPLETE, PARTIAL_CULTURE |
| PREFERRED scores, gaps, classes, pathways | COMPLETE, SUBSTANTIALLY_COMPLETE |
| Dominance, strength, congruence | As NOW, excluding UNIFORM_ALLOCATION responses |
| D7–D9 | Responses with at least 9 of 12 items answered in that dimension, excluding STRAIGHT_LINING responses that are also SPEEDING |
| eOS category | Responses with a valid value for that category |
| Nothing | INSUFFICIENT, voided, ABANDONED |

### 3.5.2  Orientation scores

**Logic.** For orientation o, perspective p and cohort c (the set of included responses):

| orientation_score(o, p, c) = Σ_r Σ_d∈D1..D6 Σ_s∈S1..S3 allocation(r, d, s, p, o)  ÷  (18 × │c│) dimension_score(d, o, p, c) = Σ_r Σ_s∈S1..S3 allocation(r, d, s, p, o)  ÷  (3 × │c│) respondent_score(r, o, p)   = Σ_d Σ_s allocation(r, d, s, p, o) ÷ 18        # used by significance tests |
| --- |

Because every scenario sums to 100, the four orientation scores for any perspective and cohort sum to 100 (asserted, tolerance 0.01 for 2 dp rounding). Scores are stored to 2 dp and shown to whole points in client reports.

| **WORKED EXAMPLE** Fixture NOW: ENGAGE 22.00, INNOVATE 14.00, PERFORM 34.00, GOVERN 30.00 (sum 100). PREFERRED: 31.00, 25.00, 28.00, 16.00. The six dimension rows in §0.7 average to these values. |
| --- |

### 3.5.3  Culture gap and classification

| gap(o) = orientation_score(o, PREFERRED) − orientation_score(o, NOW)        # 2 dp; Σ gaps = 0 |
| --- |

**Table 42  ****Gap classification**

| **Class** | **Gap rule (on the 2 dp gap)** | **Meaning** |
| --- | --- | --- |
| BUILD | ≥ +8.00 | Significantly more of this orientation is needed. |
| STRENGTHEN | +4.00 to < +8.00 | Moderately more is needed. |
| KEEP_AND_PROTECT | > −4.00 and < +4.00 | Broadly the right level. Written to Setup G5 as a system entry. |
| MODERATE | ≤ −4.00 | Less of this orientation, or a healthier form of it. |
| significant (flag) | │gap│ ≥ 8.00 | Strategically significant in either direction: requires a named workstream and an executive owner. |

| **CULTURE-GAP SIGNIFICANCE (D-02)** Significance is **│gap│ ≥ 8.0**, in either direction. This makes significance identical to the BUILD boundary (≥ +8.0) and the significant-MODERATE boundary (≤ −8.0), so a gap of exactly 8.0 is never “BUILD but not significant”. |
| --- |

| **WORKED EXAMPLE** Gaps +9.00, +11.00, −6.00, −14.00 (sum 0). ENGAGE BUILD (significant); INNOVATE BUILD (significant); PERFORM MODERATE (not significant); GOVERN MODERATE (significant). KEEP & PROTECT: none, so G5 receives no system entry. |
| --- |

### 3.5.4  Dominance

- Dominant = highest NOW orientation score; secondary = second highest.

- **Shared dominance** when the top two differ by **less than 1.0** point: dominant returns both, the narrative must call the culture dual-oriented, and pathway selection (§5.5.5) uses the one with the higher score as the origin, recording the tie. Exact equality is also shared. Ties are never broken arbitrarily.

- The same rule applies to PREFERRED profiles, each dimension, each lens and each segment.

### 3.5.5  Culture strength

| culture_strength = orientation_score(dominant, NOW) − 25          # dominant = highest score |
| --- |

**Table 43  ****Culture strength**

| **Strength** | **Band** | **Advisory meaning** |
| --- | --- | --- |
| < 5.0 | DIFFUSE | No orientation carries the organisation; change is easy to start and hard to sustain. |
| 5.0 to < 10.0 | MODERATE | A recognisable emphasis without rigidity; the most workable starting point. |
| 10.0 to < 15.0 | STRONG | A clear identity that resists demands outside it. |
| ≥ 15.0 | HIGHLY_CONCENTRATED | Any shift will feel like an attack on identity; bridging narratives are mandatory. |

Fixture: 34.00 − 25 = **9.0, MODERATE**.

### 3.5.6  Culture congruence

| dimension_congruence_count = count(d ∈ D1..D6 where dominant(d, NOW) contains the organisational dominant) dimension_congruence_pct   = count ÷ 6 × 100                         # reported to 1 dp lens_congruence            = count(lens ∈ {Strategy, Practice, Leadership} where dominant(lens, NOW) contains it)  # "n of 3" |
| --- |

**Table 44  ****Dimension congruence (banded on the count, not the percentage)**

| **Count of 6** | **Band** | **Advisory meaning** |
| --- | --- | --- |
| 5 or 6 | HIGHLY_CONGRUENT | Findings generalise safely across the organisation. |
| 3 or 4 | MODERATELY_CONGRUENT | Name the dissenting dimensions; the intervention usually belongs there. |
| 0 to 2 | FRAGMENTED | Report at cohort level first; the organisation-wide profile is an arithmetic artefact. |

Fixture: D2, D4, D5, D6 dominant PERFORM → 4 of 6, **66.7%, MODERATELY_CONGRUENT**; lenses Strategy PERFORM, Practice GOVERN, Leadership PERFORM → **2 of 3**.

### 3.5.7  Alignment lenses

**Table 45  ****Lenses**

| **Lens** | **Composition** | **Use** |
| --- | --- | --- |
| STRATEGY | mean(D5, D6) | Does the PREFERRED profile match the strategic requirement (C1 context)? |
| PRACTICE | mean(D1, D3, D4) | Do NOW practices support the strategy (C3, C4 context)? |
| LEADERSHIP | D2 | Do leaders model the required orientation (C2 context, perception gap)? |
| CAPACITY (not a lens) | D9, TPS; read with D7, D8 and eOS | Sets pace and the number of priorities. |

Each lens score is the mean of its member dimension scores per orientation, for NOW and PREFERRED. Only D1–D6 enter lens calculations. Fixture NOW: Strategy 23.0 / 15.0 / 36.0 / 26.0 (PERFORM); Practice 22.67 / 12.67 / 31.33 / 33.33 (GOVERN); Leadership 18 / 16 / 38 / 28 (PERFORM).

### 3.5.8  Readiness dimensions D7–D9

| respondent_dim(r, D) = mean(answered items of D for r)      # requires ≥ 9 of 12 answered dim_score(D, c)      = mean(respondent_dim(r, D) for included r in c)   # stored 4 dp, shown 1 dp |
| --- |

**Table 46  ****Readiness bands (banded on the value rounded half-up to 1 dp)**

| **Score (1 dp)** | **D7 Digital Readiness** | **D8 Psychological Safety** | **D9 Adaptive Capacity** |
| --- | --- | --- | --- |
| 1.0 – 2.0 | Digitally resistant | Fear-based culture | Critical resistance: transformation will fail without structural intervention |
| 2.1 – 3.0 | Digitally cautious | Cautious / selective candour | Significant barriers: foundation work before launch |
| 3.1 – 3.5 | Moderately ready | Moderate safety | Moderate readiness: targeted enablement |
| 3.6 – 4.0 | Digitally capable | Open culture | Good readiness: standard change approach |
| 4.1 – 5.0 | Digitally advanced | Challenge culture: highly safe | Strong readiness: full programme |

**Band rule.** Round to 1 dp first, then band; the bands are then exhaustive (3.04 → 3.0 → second band). Readiness gates such as “D8 ≤ 3.0” use the same 1 dp value. The TPS uses the unrounded 4 dp values. An internal-consistency coefficient (Cronbach’s alpha over the 12 items) is reported per dimension; below 0.70 it is disclosed in the technical appendix and never used to exclude data.

### 3.5.9  eOS categories and Index

| advocates = count(v ∈ {9,10}); critics = count(v ∈ {0..6}); valid = count(v ∈ {0..10}) eos_category(q) = round_half_up(100 × (advocates − critics) ÷ valid, 0)     # integer, −100..+100 eos_index       = mean(eos_category(q) for q in Q1..Q8)                        # 1 dp |
| --- |

**Table 47  ****eOS bands**

| **Category score** | **Band** | **Required response** |
| --- | --- | --- |
| < 0 | NEGATIVE (engagement miss) | Structured listening sessions with the affected cohort within 30 days, before any intervention is announced (blocking gate). |
| 0 to 30 | ACCEPTABLE | Monitor; add to the relevant priority watch-list. |
| > 30 to 50 | GOOD | No action for the category itself. |
| > 50 | EXCELLENT | Record as a strength to keep and protect. |

**Table 48  ****eOS routing (a routing suggestion, read with D1–D9 before naming a priority)**

| **#** | **Category** | **Primary orientation** | **Secondary** |
| --- | --- | --- | --- |
| Q1 | Recommend as a great place to work | ENGAGE | All (overall health) |
| Q2 | Quality of leadership | Leadership target orientation (§1.5.3) | ENGAGE |
| Q3 | Commitment to innovation | INNOVATE | ENGAGE (safety) |
| Q4 | Development and career growth | ENGAGE | GOVERN (fair processes) |
| Q5 | Transparency of communication | ENGAGE | GOVERN |
| Q6 | Work-life integration and wellbeing | ENGAGE | PERFORM (moderate pace) |
| Q7 | Inclusion, fairness and equity | ENGAGE | GOVERN (consistent standards) |
| Q8 | Strategy translated into daily purpose | PERFORM | GOVERN (role clarity) |

Fixture: categories +18, +9, −8, +6, +11, −14, +21, +14; Index 57 ÷ 8 = 7.125 → **7.1**. Q3 and Q6 are negative: two blocking listening gates. A positive Index alongside a negative category is always reported as a negative finding.

### 3.5.10  Leadership 360 scoring

| section_avg_rater(x, rater) = mean(observed items of section x for rater)       # requires ≥ 6 of 10 observed for A–D and ≥ 3 of 5 for E–H; otherwise that rater is excluded from x group_avg(x, g)   = mean(section_avg_rater(x, rater) for raters in group g)     # published groups only other_avg(x)      = mean(group_avg(x, g) for each published group, after merging)   # groups weighted equally self_avg(x)       = section_total_self(x) ÷ item_count(x) self_other_gap(x) = self_avg(x) − other_avg(x) |
| --- |

**Table 49  ****Leader readings**

| **Reading** | **Rule (on other_avg unless stated)** |
| --- | --- |
| Valid result | Self form submitted and at least 3 non-self raters in total. Otherwise no 360 report is produced and the leader does not count towards coverage. |
| Group publication | A group with ≥ 3 raters is published; groups with fewer merge into ALL_OTHERS; if ALL_OTHERS still has < 3 raters it is folded into the overall figure only and no group breakdown is shown. SUPERIOR (one rater) always merges. |
| Default orientation | Highest A–D other_avg (shared if within 0.10). |
| Growth orientation | Lowest A–D other_avg. |
| Leadership range | max − min of A–D other_avg < 0.50 → reported as range, a strength in its own right. |
| Integrity flag | E other_avg < 4.00 → immediate attention and a development action; notified to the leader and the people-lead Client Admin. The only leader finding that leaves the development relationship; consent text on both forms says so. |
| Safety flag | F other_avg < 3.00 → the leader’s unit may not receive an ENGAGE or INNOVATE BUILD priority until a safety-focused development action is in place. |
| Change-capacity flag | H other_avg < 3.00 → the unit plan is sponsored one level up until cleared. |
| Self–other tier | │gap│ ≤ 0.50 ALIGNED; > 0.50 and ≤ 1.00 WATCH; > 1.00 BLIND_SPOT. Sign reported as narrative (positive = over-rating). |

| LRI = 0.35 × other_avg(H) + 0.30 × other_avg(F) + 0.20 × other_avg(section of the leadership target orientation) + 0.15 × other_avg(G) # A = ENGAGE, B = INNOVATE, C = PERFORM, D = GOVERN. Stored 4 dp; banded on the 2 dp value. |
| --- |

**Table 50  ****LRI bands (identical to TPS bands)**

| **LRI (2 dp)** | **Band** | **Consequence** |
| --- | --- | --- |
| < 2.50 | HIGH_RISK | Cannot yet carry a culture priority; development first; unit plan sponsored one level up. |
| 2.50 to < 3.50 | ENABLEMENT_REQUIRED | Can carry a priority with structured coaching and a named sponsor. |
| 3.50 to < 4.00 | READY_WITH_SUPPORT | Can own a unit priority; coaching on the growth orientation. |
| ≥ 4.00 | STRONG | Candidate to sponsor an organisation-wide priority and coach peers. |

The LRI uses the overall other-rating. The self form shows a self-LRI for reflection only; it is never stored as the leader’s LRI or used in any aggregate.

| **WORKED EXAMPLE (ILLUSTRATIVE LEADER)** Other averages A 2.6, B 3.0, C 4.2, D 3.5, E 4.3, F 2.8, G 3.4, H 3.0; self F 4.0. Default PERFORM (4.2); growth ENGAGE (2.6). F gap +1.2 → BLIND_SPOT; A gap +0.8 → WATCH. F < 3.00 → safety flag. H = 3.00 is not below 3.00 → no change-capacity flag. Leadership target orientation ENGAGE → alignment section A. LRI = 0.35 × 3.0 + 0.30 × 2.8 + 0.20 × 2.6 + 0.15 × 3.4 = 1.050 + 0.840 + 0.520 + 0.510 = **2.92 → ENABLEMENT_REQUIRED**. |
| --- |

### 3.5.11  Leadership alignment and the Transformation Probability Score

| coverage       = Σ headcount_led(leaders with a valid 360) ÷ Σ headcount_led(all leaders in scope)     # 0 if none in scope LRI_weighted   = Σ (LRI(l) × headcount_led(l)) ÷ Σ headcount_led(l)   over leaders with a valid 360 (unused if coverage = 0) LA_instrument  = 1 + 4 × min(1, D2_NOW[target] ÷ T(target))     # target = leadership target orientation; T from §1.5.1 SINGLE row leadership_alignment = coverage × LRI_weighted + (1 − coverage) × LA_instrument          # 1..5, stored 4 dp  TPS = 0.35 × D9 + 0.30 × D8 + 0.20 × leadership_alignment + 0.15 × D7     # weights asserted to sum to 1.00 TPS_presented = round_half_up(TPS, 2); band on TPS_presented |
| --- |

**Table 51  ****TPS bands**

| **TPS (2 dp)** | **Band** | **Consequence for the plan** |
| --- | --- | --- |
| < 2.50 | HIGH_RISK | Foundation first; maximum 2 priorities in the first cycle (consultant may set 1). |
| 2.50 to < 3.50 | ENABLEMENT_REQUIRED | Maximum 3 priorities; stage diagonal shifts through a stepping stone. |
| 3.50 to < 4.00 | TARGETED_SUPPORT | Up to 4 priorities with change-management support. |
| ≥ 4.00 | STRONG_READINESS | Up to 4 priorities in parallel. |

- **Why the blend.** Both terms measure leadership behaviour against the orientation the strategy requires, so the blend never mixes constructs. It is computable at zero coverage, and coverage acts as a weight, not a switch, so there is no step between cycles.

- **Reporting.** Coverage is shown wherever the TPS is shown. Below 60% coverage the TPS is labelled PROVISIONAL (presentational only; no gate reads the label). At zero coverage the report states that leadership alignment is derived entirely from D2.

- **Segments.** A segment’s TPS uses the segment’s D7–D9, the segment’s D2 for the instrument term, and coverage over leaders whose teams lie inside the segment.

| **WORKED EXAMPLE** Coverage 0 → leadership_alignment = LA_instrument = 1 + 4 × min(1, 18.0 ÷ 30) = **3.40** (D2 NOW ENGAGE 18 from the fixture). TPS = 0.35 × 3.1 + 0.30 × 2.8 + 0.20 × 3.40 + 0.15 × 3.2 = 1.085 + 0.840 + 0.680 + 0.480 = 3.085 → **3.09, ENABLEMENT_REQUIRED, PROVISIONAL** (coverage 0%). |
| --- |

### 3.5.12  Segments, perception gap and sub-cultures

**Segmentation.** Any attribute on the respondent’s demographic snapshot is an axis (division, department, team, location, grade band, executive flag, tenure band, age band, gender, contract type, language, custom attributes). A segment is a conjunction of axis–value predicates. The engine resolves the segment, counts valid responses, applies suppression, and only then computes. Every Stage 3 metric is computable for a permitted segment.

| perception_gap(o) = │ NOW(o, executive cohort) − NOW(o, staff cohort) │     # both cohorts n ≥ 5, else not computed SDI(segment)      = Σ_o │ NOW(o, segment) − NOW(o, organisation) │ ÷ 2         # 0..100, % of profile that differs |
| --- |

**Table 52  ****Perception gap**

| **Perception gap** | **Flag** | **Required response** |
| --- | --- | --- |
| ≤ 5.0 | NONE | Report in the cohort comparison. |
| > 5.0 and ≤ 7.0 | WATCH | Examine in the debrief; monitor at re-assessment. Not blocking. |
| > 7.0 | SHADOW_CULTURE | Perception-gap workshop before any intervention on that orientation (blocking). |

**Table 53  ****Sub-culture detection**

| **Sub-culture test** | **Threshold** | **Verdict** |
| --- | --- | --- |
| Single-orientation divergence | │segment − organisation│ ≥ 8.0 on one orientation | DIVERGENT on that orientation; routed to its playbook. |
| Profile divergence | SDI ≥ 12.0 | Candidate distinct sub-culture. |
| Dominance divergence | Segment dominant ≠ organisation dominant, and the segment is not in shared dominance (top two differ by ≥ 1.0) | Candidate structural sub-culture. |
| Significance | Welch two-sample t-test of respondent_score(o, NOW) for the segment against the rest of the organisation on each divergent orientation; two-sided, α = 0.05; segment n ≥ 5 and complement n ≥ 5 | CONFIRMED, else INDICATIVE (cannot trigger a funded intervention). |
| Readiness divergence | │segment − organisation│ ≥ 0.5 on D8 or D9 | CAPACITY sub-culture: may need a different pace. |
| Engagement divergence | Any eOS category negative in the segment while non-negative organisation-wide | Hidden engagement failure: 30-day listening rule for that segment. |

A segment is named a **sub-culture** when it meets the profile-divergence or dominance-divergence test **and** the significance test on at least one orientation. Segments meeting only the single-orientation test are reported as divergent without the sub-culture label.

**Table 54  ****Suppression**

| **Suppression rule** | **Specification (no role can override)** |
| --- | --- |
| Primary floor | No culture segment reported below 5 valid responses (counted on the responses the metric uses). |
| Combination floor | A multi-axis segment must itself have ≥ 5; individual axis counts are irrelevant. |
| Differencing protection | A segment is suppressed if it equals a reported segment minus another reported segment and the residual is below 5. The engine suppresses complementary pairs: department 22, team A 18, team B 4 → both teams suppressed; the department remains reportable. |
| Roll-up | Suppressed segments merge into the nearest parent that passes, labelled “merged into [parent]”. Never shown as zero or blank. |
| Qualitative | Verbatim extracts require ≥ 8 valid qualitative responses in the segment; otherwise themes with counts only. |
| Query audit | Every segment query is logged with actor, predicates, resolved count and outcome; the API returns 409 “below reporting threshold”, never an empty payload. |

| **WORKED EXAMPLE** Executive NOW 30 / 16 / 32 / 22 vs staff 19 / 13 / 35 / 33 → gaps 11, 3, 3, 11. ENGAGE and GOVERN are **SHADOW_CULTURE** (blocking for those orientations); INNOVATE and PERFORM have no flag. |
| --- |

### 3.5.13  Leader–culture link

| leader_profile(o) = other_avg(section of o) ÷ Σ other_avg(A..D) × 100         # normalised to 100 fit_index         = 100 − Σ_o │ leader_profile(o) − team_NOW(o) │ ÷ 2 lead_target       = leader_profile(leadership target orientation) org_target        = organisation NOW score on the leadership target orientation |
| --- |

The team profile is the team’s own NOW profile if it meets the floor; otherwise the nearest passing parent, and every leader output then carries “computed against [unit] because the team is below the reporting threshold”.

**Table 55  ****Fit index**

| **Fit index** | **Reading** | **Advisory meaning** |
| --- | --- | --- |
| ≥ 85 | MIRRORED | Leader and team are the same culture: sustains it if right, reproduces it if wrong. |
| 70 to < 85 | ALIGNED | Normal and healthy. |
| 55 to < 70 | DIVERGENT | Determine which direction the difference runs. |
| < 55 | COUNTER_CULTURAL | Either the intervention the unit needs or the friction exhausting it. |

**Table 56  ****Carrier and blocker classification (exhaustive)**

| **#** | **Classification** | **Rule (evaluate top-down; first match wins)** | **Response** |
| --- | --- | --- | --- |
| 1 | CRITICAL_BLOCKER | lead_target ≤ org_target − 5.0 and (integrity or safety flag, or LRI < 2.50) | Escalate to people-lead Client Admin and sponsoring executive; unit plan suspended. |
| 2 | CULTURE_BLOCKER | lead_target ≤ org_target − 5.0 and default orientation is classified MODERATE | Direct leadership intervention; unit will not move without it. |
| 3 | LAGGING | lead_target ≤ org_target − 5.0 (other cases) | Development action on the target orientation; implementer role. |
| 4 | CULTURE_CARRIER | lead_target ≥ org_target + 5.0, no hard flag, LRI ≥ 3.50 | Sponsor, peer coach, source of the 30-day signal. |
| 5 | EMERGING_CARRIER | lead_target ≥ org_target + 5.0 (other cases) | Highest-return development investment. |
| 6 | NEUTRAL | │lead_target − org_target│ < 5.0 | Implementer, not sponsor. |

The six classes are exhaustive: every leader receives exactly one. Classifications are visible only to the leader, their coach, the people-lead Client Admin and the PAC Consultant; they carry the ethical-use statement and cannot be exported.

**Table 57  ****Leader influence**

| **Influence measure** | **Definition (association, never causation)** |
| --- | --- |
| Team eOS differential | eOS_Index(team) − eOS_Index(organisation); bands ≥ +10, > −10 and < +10, ≤ −10. |
| Team readiness differential | TPS(team) − TPS(organisation), where the team meets the floor. |
| Contribution quadrant | LRI ≥ 3.50 or < 3.50 × team eOS differential ≥ 0 or < 0: EXEMPLAR, STRUCTURAL_CONSTRAINT, TEAM_CARRYING_LEADER, PRIORITY_INTERVENTION. Reported in aggregate only. |

| **WORKED EXAMPLE** Illustrative leader: other A–D 2.6 / 3.0 / 4.2 / 3.5 → profile 19.55 / 22.56 / 31.58 / 26.32. Team NOW = organisation 22 / 14 / 34 / 30 → fit = 100 − (2.45 + 8.56 + 2.42 + 3.68) ÷ 2 = **91.4, MIRRORED**. lead_target ENGAGE 19.55 vs org 22.00 → within 5.0 → **NEUTRAL**. |
| --- |

## 3.6  Decision rules

**Table 58  ****Master threshold table**

| **Metric** | **Value banded** | **Bands (exhaustive)** |
| --- | --- | --- |
| Gap class | 2 dp gap | ≥ 8.00 · 4.00–< 8.00 · > −4.00–< 4.00 · ≤ −4.00 |
| Significance | 2 dp │gap│ | ≥ 8.00 |
| Shared dominance | 2 dp scores | top two differ by < 1.00 |
| Strength | 2 dp | < 5 · 5–< 10 · 10–< 15 · ≥ 15 |
| Congruence | count of 6 | 5–6 · 3–4 · 0–2 |
| D7–D9 | 1 dp | 1.0–2.0 · 2.1–3.0 · 3.1–3.5 · 3.6–4.0 · 4.1–5.0 |
| eOS category | integer | < 0 · 0–30 · 31–50 · > 50 |
| TPS, LRI | 2 dp | < 2.50 · 2.50–< 3.50 · 3.50–< 4.00 · ≥ 4.00 |
| Perception gap | 2 dp absolute | ≤ 5.00 · > 5.00–≤ 7.00 · > 7.00 |
| Self–other gap | 2 dp absolute | ≤ 0.50 · > 0.50–≤ 1.00 · > 1.00 |
| SDI | 2 dp | ≥ 12.00 candidate |
| Fit | 2 dp | ≥ 85 · 70–< 85 · 55–< 70 · < 55 |

Freezing the score object is the gate to Stage 4. A frozen score object is never modified; a re-run after a void creates a new version, and only the latest frozen version feeds reports.

## 3.7  Outputs to the next stage

| {   "assessment_id": "asm_7f31", "score_version": 1, "payload_hash": "sha256:4be0…",   "instrument_version": "1.1", "rules_version": "2.0",   "orientation_scores": {     "now":       {"ENGAGE": 22.00, "INNOVATE": 14.00, "PERFORM": 34.00, "GOVERN": 30.00},     "preferred": {"ENGAGE": 31.00, "INNOVATE": 25.00, "PERFORM": 28.00, "GOVERN": 16.00},     "gap":       {"ENGAGE":  9.00, "INNOVATE": 11.00, "PERFORM": -6.00, "GOVERN": -14.00} },   "classification": {"ENGAGE": "BUILD", "INNOVATE": "BUILD", "PERFORM": "MODERATE", "GOVERN": "MODERATE"},   "significant":    {"ENGAGE": true, "INNOVATE": true, "PERFORM": false, "GOVERN": true},   "dominance": {"dominant": ["PERFORM"], "secondary": "GOVERN", "shared": false},   "culture_strength": 9.0, "strength_band": "MODERATE",   "congruence": {"dimension_count": 4, "dimension_pct": 66.7, "band": "MODERATELY_CONGRUENT",                  "lens": {"STRATEGY": "PERFORM", "PRACTICE": "GOVERN", "LEADERSHIP": "PERFORM", "agreement": 2}},   "dimension_now": {"D2": {"ENGAGE": 18.0, "INNOVATE": 16.0, "PERFORM": 38.0, "GOVERN": 28.0}, "D3": {"…": "…"}},   "cohorts": {"executive": {"n": 11, "now": {"ENGAGE": 30.0, "INNOVATE": 16.0, "PERFORM": 32.0, "GOVERN": 22.0}},               "staff":     {"n": 430, "now": {"ENGAGE": 19.0, "INNOVATE": 13.0, "PERFORM": 35.0, "GOVERN": 33.0}}},   "perception_gap": {"ENGAGE": 11.0, "INNOVATE": 3.0, "PERFORM": 3.0, "GOVERN": 11.0},   "readiness": {"d7": 3.2, "d8": 2.8, "d9": 3.1, "coverage": 0.0,                 "leadership_alignment": 3.40, "leadership_alignment_source": "INSTRUMENT_TERM_ONLY",                 "tps": 3.09, "tps_band": "ENABLEMENT_REQUIRED", "provisional": true},   "eos": {"Q1": 18, "Q2": 9, "Q3": -8, "Q4": 6, "Q5": 11, "Q6": -14, "Q7": 21, "Q8": 14, "index": 7.1},   "quality": {"complete": 418, "substantially_complete": 23, "partial_culture": 22, "insufficient": 12} } |
| --- |

## 3.8  Acceptance criteria

**Table 59  ****Scoring acceptance criteria**

| **ID** | **Criterion** |
| --- | --- |
| AC-3.1 | Every fixture value in this chapter is reproduced exactly (UT-03 to UT-13, UT-31 to UT-37, UT-45 to UT-47). |
| AC-3.2 | Scoring the same frozen dataset 100 times yields an identical payload hash. |
| AC-3.3 | Re-scoring a closed assessment after the rules version advances uses the pinned version and returns the original hash. |
| AC-3.4 | All decimal arithmetic uses fixed-point types and ROUND_HALF_UP; 3.085 presents as 3.09. |
| AC-3.5 | Every suppression path returns 409 with a reason and logs the query; differencing and combination tests pass (UT-27 to UT-29). |
| AC-3.6 | No rater identity and no individual response is retrievable by any role or service account. |

# 4  Reporting

Reporting turns the frozen score object into **findings** and then into **released reports**. The rules engine evaluates the four alignment checks and every signal, matches scenarios and attaches severity and evidence. Reports present findings with a conclusion and a recommendation; nothing reaches a client role until a PAC Consultant releases it.

## 4.1  Purpose and scope

- **In scope:** rules-engine evaluation of C1–C4, signals and scenarios; the finding object; report suite and templates; chart library; AI draft narrative and its guardrails; release workflow; exports and branding.

- **Order of evaluation (fixed):** gap classification (already in the score object) → C1 → C4 → C2 → C3 → perception and engagement flags → readiness signals → sub-culture and leader signals → scenario matching. Stage 5 then applies gates and selects priorities.

## 4.2  Roles and permissions in this stage

**Table 60  ****Reporting responsibilities**

| **Task** | **Who** |
| --- | --- |
| Run evaluation (idempotent, version-pinned) | System, triggered by the consultant |
| Review findings; annotate; record H-section contradiction flags | PAC Consultant |
| Override a finding verdict | Not permitted. A consultant may add a recorded annotation that appears beside the finding. |
| Request, edit and accept AI draft narrative | PAC Consultant |
| Release a report | PAC Consultant only |
| Read released reports | Per the permissions matrix (§0.5) |

## 4.3  Screens and user flow

**Table 61  ****Reporting screens**

| **ID** | **Screen** | **Behaviour** |
| --- | --- | --- |
| S4-01 | Findings console | All findings grouped by check and severity, each with evidence, linked scores (“show working”), matched scenarios and annotations. |
| S4-02 | Alignment scorecard | Four tiles C1–C4 with verdict, percentage or rank, and the decisive override. |
| S4-03 | Report builder | Choose report type and audience; the template assembles sections and charts from findings; mandatory sections highlighted until complete. |
| S4-04 | Narrative review | AI draft beside the findings it cites; numeric-integrity and terminology results; accept, edit or reject per section; acceptance recorded. |
| S4-05 | Release | Checklist (§4.6); release records practitioner, versions and payload hash; distribution per audience. |
| S4-06 | Export | PDF, PPTX or XLSX of a released version only. |

## 4.4  Data captured: the finding object

**Table 62  ****Finding**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| finding_id / assessment_id / score_version | id | Finding is pinned to a score version. | Y |
| type | enum | C1_PERFORMANCE_ALIGNMENT, C2_BEHAVIOUR_GAP, C3_STOP_START, C4_MODEL_READINESS, GAP_CLASSIFICATION, PERCEPTION_GAP, ENGAGEMENT_MISS, READINESS_SIGNAL, SUBCULTURE, LEADER_FLAG, LEADERSHIP_POPULATION, SETUP_DIVERGENCE, DATA_QUALITY. | Y |
| verdict | enum | HIT, PARTIAL_HIT, MISS, SYSTEMIC_MISS, WATCH, SHADOW_CULTURE, CONFIRMED, INDICATIVE, FLAG, INFO. | Y |
| severity | enum | CRITICAL, HIGH, MEDIUM, LOW (§4.5.6). | Y |
| orientation / segment_definition | enum / json | Orientation(s) concerned; segment null for organisation-wide. | N |
| metrics | json | e.g. alignment_pct, rank, behaviour_gap_points, intensity, gap, perception_gap. | Y |
| evidence | json | Inputs used, thresholds, overrides applied, setup references (e.g. “Section B3.1”). | Y |
| blocking / blocks | bool / json | Whether the finding creates a blocking gate and for what scope (orientation, cohort, unit). | Y |
| scenario_ids | id[] | Scenarios this finding contributes to. | N |
| annotation | text | Consultant annotation; never changes the verdict. | N |

## 4.5  Calculations: the alignment checks and signals

**Figure 6  ***Alignment scorecard for the reference fixture*

### 4.5.1  Alignment percentage and verdict (C1 and C4)

| FUNCTION alignment_verdict(requirement, now):            # now = organisation NOW orientation scores     R = requirement.orientations; T = requirement.thresholds     subs = [ MIN(100, 100 × now[r] / T[r]) FOR r IN R ]     pct  = ROUND_HALF_UP(MEAN(subs), 1)     verdict = HIT IF pct >= 80 ELSE PARTIAL_HIT IF pct >= 60 ELSE MISS     # Override 1: thresholds are strict (> T); not exceeding a threshold caps the verdict     IF ANY(now[r] <= T[r] FOR r IN R): verdict = MIN(verdict, PARTIAL_HIT)     # Override 2: a required orientation that is the lowest NOW score forces MISS (not for BALANCED)     IF requirement.type != BALANCED AND ANY(r IN lowest(now) FOR r IN R): verdict = MISS     # Override 3: DOMINANT requirements also need the highest NOW score (shared counts)     IF requirement.type == DOMINANT AND R[0] NOT IN dominant(now): verdict = MIN(verdict, PARTIAL_HIT)     RETURN verdict, pct, overrides_applied |
| --- |

lowest(now) returns every orientation less than 1.0 point above the minimum, mirroring shared dominance. Override 2 is never applied to a BALANCED requirement: with all four orientations required, one is always lowest, so the override would turn every transition check into a MISS.

| **WORKED EXAMPLE** **C1.** Requirement INNOVATE > 28; NOW 14.00. sub = 50.0 → pct 50.0 → MISS; Override 2 also applies (INNOVATE lowest). **C1 MISS, 50.0%.** **C4.** SERVICE_B2C: ENGAGE > 30, PERFORM > 30; NOW 22.00 and 34.00. subs 73.3 and 100.0 → pct 86.7 → HIT, then Override 1 (ENGAGE 22 ≤ 30) → **C4 PARTIAL HIT, 86.7%.** **Transition variant (UT-17).** All four > 24 on 22 / 14 / 34 / 30: subs 91.7, 58.3, 100, 100 → 87.5 → HIT; Override 1 (ENGAGE, INNOVATE ≤ 24) → PARTIAL HIT; Override 2 not applied. |
| --- |

### 4.5.2  Behaviour gap (C2)

| profile = MEAN(dimension_now[D2], dimension_now[D3])         # per orientation target  = leadership_target_orientation                       # §1.5.3 rank    = position of target in profile, highest = 1 (ties share the higher rank) behaviour_gap_points = profile[dominant] − profile[target]    # 0 when target is dominant  verdict = HIT          IF rank == 1         = HIT          IF rank == 2 AND behaviour_gap_points < 1.0      # shared dominance         = PARTIAL_HIT  IF rank == 2         = MISS         IF rank IN (3, 4) intensity = MARGINAL IF gap < 5.0 ELSE SUBSTANTIVE IF gap < 15.0 ELSE ENTRENCHED |
| --- |

**Table 63  ****C2 intensity**

| **Intensity** | **What the recommendation must contain** |
| --- | --- |
| MARGINAL | Coaching and explicit recognition of the target behaviour; state how close the profile is so the client is not over-sold a programme. |
| SUBSTANTIVE | A structured leadership workstream: development programme, CDP-anchored 360 baseline and re-measure, and a culture-stewardship objective in every people manager’s review. |
| ENTRENCHED | The workstream plus system levers (promotion criteria, reward mix, performance-management redesign) and a leadership KPI carried at ExCo. |

Rank sets the verdict; magnitude sets intensity and never changes the verdict (except the shared-dominance case, which applies the existing 1.0-point rule). A C2 MISS on an orientation that also carries SHADOW_CULTURE is escalated to the board-level narrative as the strongest single finding.

| **WORKED EXAMPLE** mean(D2, D3) NOW = ENGAGE 20.0, INNOVATE 14.0, PERFORM 34.0, GOVERN 32.0. Target ENGAGE ranks 3rd → **C2 MISS**. behaviour_gap_points = 34.0 − 20.0 = 14.0 → **SUBSTANTIVE**. ENGAGE also carries SHADOW_CULTURE → board-level escalation. |
| --- |

### 4.5.3  Stop / start audit (C3)

| m = count of { dominant(D4, NOW), dominant(D6, NOW) } whose class is MODERATE       # if a dimension has shared dominance, it counts as MODERATE when either co-dominant orientation is MODERATE verdict = HIT IF m == 0 ; PARTIAL_HIT IF m == 1 ; SYSTEMIC_MISS IF m == 2 identity_risk = class(dominant(D4, NOW)) == MODERATE           # modifier on any verdict contradiction_evidence = Setup H1 / H3 / H4 contradiction flags (shown as evidence; do not change the verdict) |
| --- |

**Table 64  ****C3 responses**

| **Verdict** | **Response** |
| --- | --- |
| HIT | Reinforce publicly; name the existing ritual that already signals the desired behaviour. |
| PARTIAL_HIT | Redesign the contradicting mechanism within 90 days: the recognition ritual if D6, the bonding narrative if D4. |
| SYSTEMIC_MISS | HR systems redesign within 90 days (performance management, promotion criteria, incentives, onboarding); change at least one visible ritual within 30 days. |
| identity_risk | Frame as preserving the bonding narrative while redirecting its energy, using the pathway’s bridging narrative. |

The classes BUILD, STRENGTHEN and KEEP & PROTECT all count as supportive, so the table is exhaustive.

| **WORKED EXAMPLE** D4 dominant PERFORM (MODERATE); D6 dominant PERFORM (MODERATE) → m = 2 → **C3 SYSTEMIC MISS**, identity_risk = true. |
| --- |

### 4.5.4  Signals

**Table 65  ****Signals**

| **Signal** | **Rule** | **Verdict** | **Blocking scope** |
| --- | --- | --- | --- |
| Perception gap | §3.5.12 | WATCH / SHADOW_CULTURE | SHADOW: that orientation |
| Engagement miss | eOS category < 0 (organisation or segment) | FLAG | Cohort / segment |
| Readiness: TPS | Band §3.5.11 | FLAG (band) | Caps priority count |
| Readiness: D8 ≤ 3.0 | 1 dp | FLAG | ENGAGE and INNOVATE BUILD priorities |
| Readiness: D9 ≤ 3.0 | 1 dp | FLAG | All content actions |
| Readiness: D7 ≤ 3.0 | 1 dp | FLAG | Technology-dependent priorities |
| Sub-culture | §3.5.12 | CONFIRMED / INDICATIVE | None (unit planning) |
| Leader flags | Integrity, safety, change capacity; LRI < 2.50 | FLAG | That unit |
| Leadership population | ≥ 5 valid results: mean LRI band, collective blind spots, default-orientation spread | INFO / FLAG | None |
| Data quality | Response rate < 40%, exclusions > 10%, alpha < 0.70 | INFO | None |

### 4.5.5  Scenario library

Scenarios are stored as data: an ID, a match expression over the score object and findings, a severity, a diagnosis, risks, hypotheses to test in the debrief, and a linked action template (§5.5.8). All matches are returned, ordered by severity then ID; the report leads with the first.

**Table 66  ****Scenario library (match expressions are rules data)**

| **ID** | **Scenario** | **Match expression** | **Severity** | **Diagnosis** |
| --- | --- | --- | --- | --- |
| SC-01 | Delivery without belonging | dominant = PERFORM AND strength ≥ 5.0 AND gap[ENGAGE] ≥ 8.0 AND (eos.Q6 < 0 OR eos.Q4 < 0) | HIGH | Results are funded from discretionary effort that is running out. |
| SC-02 | Order without ideas | dominant = GOVERN AND gap[INNOVATE] ≥ 8.0 AND d7 ≤ 3.0 | HIGH | Control has hardened into a brake. |
| SC-03 | Ideas without delivery | dominant = INNOVATE AND (gap[GOVERN] ≥ 8.0 OR gap[PERFORM] ≥ 8.0) | HIGH | Creative energy scatters; few initiatives reach customers. |
| SC-04 | Care without accountability | dominant = ENGAGE AND strength ≥ 10.0 AND gap[PERFORM] ≥ 8.0 | HIGH | Cohesion is protected at the cost of performance conversations. |
| SC-05 | Shadow culture | ANY perception_gap > 7.0 | CRITICAL | Executives and staff describe two different organisations. |
| SC-06 | Sub-culture divergence | ANY segment SUBCULTURE = CONFIRMED with dominance divergence | MEDIUM | A unit runs a different operating logic. |
| SC-07 | Leader misaligned with a healthy team | team profile dominant = organisation PREFERRED dominant AND fit < 55 AND class IN (CULTURE_BLOCKER, CRITICAL_BLOCKER) | HIGH | The team is where the organisation wants to go; the leader is not. |
| SC-08 | Capable leader, constrained unit | LRI ≥ 3.50 AND team eOS differential ≤ −10 | MEDIUM | The constraint sits above or around the leader. |
| SC-09 | Low transformation readiness | tps < 2.50 | CRITICAL | The organisation cannot yet sustain the change it has named. |
| SC-10 | Systems fighting the strategy | C3 = SYSTEMIC_MISS | HIGH | Reward and recognition pay for the behaviour the organisation wants to stop. |
| SC-11 | Everything at once | count(class IN (BUILD, STRENGTHEN)) ≥ 3 | MEDIUM | No strategic choice has been made. |
| SC-12 | Aligned and under-recognised | C1, C2, C3, C4 all HIT AND strength ≥ 10.0 AND no eOS category < 0 | LOW | The culture serves the strategy; the risk is erosion. |

Risks and debrief hypotheses for each scenario are carried as data with the scenario and shown in the findings console and report; they are listed in full in the rules seed file and in the Action Planning Guide playbooks. SC-07 and SC-08 are evaluated per leader and reported in aggregate only.

| **WORKED EXAMPLE** Fixture matches: **SC-05** Shadow culture (CRITICAL), **SC-01** Delivery without belonging (HIGH: PERFORM dominant, strength 9.0, ENGAGE gap +9, Q6 −14), **SC-10** Systems fighting the strategy (HIGH: C3 SYSTEMIC MISS). SC-11 does not match (two BUILD, no STRENGTHEN). |
| --- |

### 4.5.6  Severity

**Table 67  ****Severity rules**

| **Severity** | **Assigned when** |
| --- | --- |
| CRITICAL | C1 or C4 MISS; SHADOW_CULTURE; eOS category negative organisation-wide; TPS < 2.50; integrity flag; SC-05, SC-09. |
| HIGH | C2 MISS; C3 SYSTEMIC_MISS; C1 or C4 PARTIAL HIT on a significant BUILD orientation; confirmed sub-culture; safety or change-capacity flag; SC-01–04, SC-07, SC-10. |
| MEDIUM | Other PARTIAL HIT; WATCH; C3 PARTIAL HIT; indicative sub-culture; segment-only eOS miss; SC-06, SC-08, SC-11. |
| LOW | HIT; informational and data-quality findings; SC-12. |

## 4.6  Decision rules: report suite and release

**Table 68  ****Report suite**

| **Report** | **Audience** | **Purpose and required content** |
| --- | --- | --- |
| Board / Executive Summary | Board, CEO | Four pages plus one appendix page. 1 judgement · 2 alignment scorecard · 3 three findings that matter · 4 readiness and what it permits · 5 priorities, owners, dates · 6 What this means · 7 What to do next · 8 technical appendix. Charts: profile, scorecard, TPS gauge, perception gap if flagged. |
| Organisational Culture Report | ExCo, CHRO, OD | 1 how to read · 2 method and participation · 3 NOW, PREFERRED, gaps · 4 strength and congruence · 5 four checks with evidence · 6 cohorts and perception gap · 7 readiness and TPS · 8 eOS and qualitative themes · 9 sub-cultures · 10 leadership in aggregate · 11 What this means · 12 What to do next · 13 technical appendix. |
| Sub-culture Report | ExCo, unit heads | Identification · profile against organisation (SDI, dominance) · gaps · perception and voice · readiness · leadership link · What this means · What to do next. |
| Leader Report | Leader, coach, people-lead Client Admin | How to read · orientation profile self and others · extended dimensions and flags · self–other gaps · team culture · fit and classification · behaviour gap the organisation needs · What this means · Leader Development Plan · qualitative feedback (reviewed and redacted). |
| Leadership-Team Report | CEO, CHRO, board people committee | Requires ≥ 5 valid results. Collective profile vs D2 and target · default-orientation spread · LRI distribution and the weighted mean feeding the TPS · carrier/blocker counts by unit (never by name) · collective blind spots · flag counts · What this means · What to do next. |
| Action Plan Report | All levels, role-filtered | Specified in §5.7. |

- **Release gate.** Release returns 422 unless “What this means” and “What to do next” both contain accepted text, every chart and number is drawn from the pinned score object, the technical appendix is present (response-rate table, exclusions, suppression notes, versions, payload hash, substitutions and overrides) and any AI text has been accepted by a named consultant.

- **Leader reports** are released to the coach (or the consultant) for a facilitated conversation; the leader receives access after the conversation is recorded. They are never emailed as attachments.

- **Conclusion templates.** Board: “The culture as measured [does / does not] support the declared strategy, principally because [check and evidence]. The consequence over [horizon] is [risk from the matched scenario].” Organisational report: dominant culture → direction of travel → primary misalignment → readiness constraint, in that order.

## 4.7  Report visual standards

Charts are rendered by one chart library used on screen and in exports. The orientation palette is fixed for every report and client. Identity never relies on colour alone: every series is direct-labelled or has a legend, and status verdicts always carry an icon and a word.

**Table 69  ****Report palette (validated for colour-vision deficiency on the adjacent pairs)**

| **Token** | **Hex** | **Use** |
| --- | --- | --- |
| ENGAGE | #2E86C1 | Orientation series and labels (blue) |
| INNOVATE | #6C3483 | Orientation series and labels (purple) |
| PERFORM | #C0392B | Orientation series and labels (red) |
| GOVERN | #58A55C | Orientation series and labels (green); direct labels mandatory (contrast 2.9:1 on white) |
| PAC navy · orange | #1C2B4A · #E8610A | Headings, structure, reference lines; never used as a series colour |
| Status: HIT · PARTIAL · MISS | #2F6F40 · #C77C0E · #A93226 | Verdict tiles only, always with icon (✓ ◐ ✕) and label |

**Figure 7  ***Orientation profile: NOW (light, outlined) vs PREFERRED (solid), with the 25-point neutral line*

**Figure 8  ***Culture gap with the classification bands shaded and the class labelled*

**Figure 9  ***TPS gauge with the band label, formula line and provisional marker*

**Figure 10  ***Executive–staff perception gap: dumbbell per orientation with the flag labelled*

**Figure 11  ***eOS categories: diverging bars around zero, negatives marked as 30-day listening gates, Index line*

**Figure 12  ***Leadership 360 self vs others with self–other tier per section and the 3.00 flag line*

**Table 70  ****Chart rules**

| **Chart** | **Rules** |
| --- | --- |
| Profile | Grouped bars in fixed orientation order; NOW as 35% tint with outline, PREFERRED solid; values on bars; neutral 25 reference line; never stacked. |
| Gap | Horizontal bars from zero; background bands at −8, −4, +4, +8; class label at the right; negative gaps shown with equal prominence (the release side of the trade-off). |
| TPS gauge | Four bands with labels and ranges; needle at the 2 dp value; formula line under the title; PROVISIONAL marker when coverage < 60%. |
| Perception gap | Dumbbell: executive filled circle, staff hollow diamond; gap value and flag at the right; only shown when both cohorts have n ≥ 5. |
| eOS | Diverging horizontal bars, negative in red and positive in blue; zones for acceptable and good; Index as a dashed reference line. |
| 360 self vs others | Dumbbell per section, self hollow diamond and others filled circle; tier label at the right; 3.00 flag line; rater-group breakdown in a separate small-multiple only for published groups. |
| Heatmaps | Segments × orientations, cell = segment minus organisation; diverging scale centred on zero, marked from ±8.0; suppressed cells hatched and labelled “below reporting threshold”. |
| Exports | PowerPoint charts are native chart objects, not images, so a consultant can adjust emphasis in the room; PDF and Excel carry the same values with segment counts. |

## 4.8  AI interpretation service

The AI service drafts narrative for the consultant to review. It is an assistant to the practitioner, never a substitute, and it cannot compute or change any value.

**Table 71  ****AI scope**

| **Permitted** | **Prohibited** |
| --- | --- |
| Explain a score using the published bands. | Compute, recompute, estimate, round or adjust any score. |
| Name business consequences drawn from matched scenarios. | Introduce a risk, diagnosis or cause not in the findings. |
| Sequence findings and choose the headline. | Assert a causal link between culture and a business outcome. |
| Draft “What this means” and “What to do next” from selected priorities. | Invent an action, owner, date, budget or KPI. |
| Adapt tone and length to audience. | Change a threshold, verdict or classification, or soften a MISS. |
| Say plainly that the data does not support a conclusion. | Fill gaps with benchmarks, external comparisons or third-party terminology. |

**Table 72  ****AI guardrails**

| **Guardrail** | **Implementation** |
| --- | --- |
| Input | Findings payload only: scores, verdicts, flags, gates, matched scenarios, selected priorities, setup parameters, and qualitative **themes** (never verbatim text or counts below a floor). |
| Prompt | Fixed and versioned with the rules: role, vocabulary constraint (CDP glossary only), grounding rule (every claim cites a finding ID), refusal rule, and output contract (one JSON field per report section). A bounded “emphasis” field is the only consultant input. |
| Numeric integrity | Every number in the draft must match a value in the payload; otherwise the draft is blocked and the incident logged. |
| Terminology screen | The deny-list (§0.2) is applied to every draft; a hit blocks it. |
| Traceability | Statements without a finding reference are stripped before the consultant sees the draft; strips are logged. |
| Causal screen | Causal constructions linking culture to outcomes are rejected and replaced with associational wording. |
| Attribution screen | Any reference to an individual or a group small enough to identify one blocks the draft. |
| Acceptance | No AI text reaches a client until a named consultant accepts it; acceptance stores consultant, prompt version, model version and payload hash. Generated prose is never re-used as an input. |
| Residency | Runs in-region or under a recorded transfer basis (§1.4.5). |

| // Output contract (excerpt) { "report_id": "rep_0091", "prompt_version": "2.0.3", "sections": {     "judgement": { "text": "…", "cites": ["fnd_0042","fnd_0047"] },     "what_this_means": { "text": "…", "cites": ["fnd_0042","fnd_0050","sc_05"] },     "what_to_do_next": { "text": "…", "cites": ["pri_01","pri_02","pri_00"] } } } |
| --- |

## 4.9  Outputs to the next stage

| {   "assessment_id": "asm_7f31", "rules_version": "2.0",   "checks": {     "C1": [{"finding_id": "fnd_0042", "requirement_id": "req_01", "verdict": "MISS", "alignment_pct": 50.0,             "overrides": ["OVERRIDE_2_LOWEST"], "severity": "CRITICAL"}],     "C2": {"finding_id": "fnd_0043", "verdict": "MISS", "rank": 3, "behaviour_gap_points": 14.0,            "intensity": "SUBSTANTIVE", "escalated_with": "SHADOW_CULTURE", "severity": "HIGH"},     "C3": {"finding_id": "fnd_0044", "verdict": "SYSTEMIC_MISS", "identity_risk": true, "severity": "HIGH"},     "C4": {"finding_id": "fnd_0045", "verdict": "PARTIAL_HIT", "alignment_pct": 86.7,            "overrides": ["OVERRIDE_1_BELOW_THRESHOLD"], "severity": "HIGH"} },   "flags": [ {"finding_id": "fnd_0046", "type": "PERCEPTION_GAP", "orientation": "ENGAGE", "verdict": "SHADOW_CULTURE", "blocking": true},              {"finding_id": "fnd_0047", "type": "PERCEPTION_GAP", "orientation": "GOVERN", "verdict": "SHADOW_CULTURE", "blocking": true},              {"finding_id": "fnd_0048", "type": "ENGAGEMENT_MISS", "category": "Q3", "blocking": true},              {"finding_id": "fnd_0049", "type": "ENGAGEMENT_MISS", "category": "Q6", "blocking": true},              {"finding_id": "fnd_0050", "type": "READINESS_SIGNAL", "signal": "D8_LE_3", "value": 2.8, "blocking": true},              {"finding_id": "fnd_0051", "type": "READINESS_SIGNAL", "signal": "TPS_BAND", "value": 3.09, "band": "ENABLEMENT_REQUIRED"} ],   "scenarios": ["SC-05", "SC-01", "SC-10"] } |
| --- |

## 4.10  Acceptance criteria

**Table 73  ****Reporting acceptance criteria**

| **ID** | **Criterion** |
| --- | --- |
| AC-4.1 | The fixture reproduces C1 MISS 50.0%, C2 MISS (rank 3, 14.0, SUBSTANTIVE), C3 SYSTEMIC MISS with identity risk, C4 PARTIAL HIT 86.7% (UT-14 to UT-19, UT-48, UT-49). |
| AC-4.2 | The balanced transition requirement never forces MISS through Override 2 (UT-17). |
| AC-4.3 | Scenario matching returns SC-05, SC-01, SC-10 for the fixture, ordered by severity. |
| AC-4.4 | Release is refused with 422 when a mandatory section is empty or AI text is unaccepted (UT-40). |
| AC-4.5 | AI drafts with an unmatched number or a deny-listed term are blocked and logged (UT-38, UT-39). |
| AC-4.6 | Exports exist only for released versions and carry the watermark, version and payload hash. |

# 5  Advisory and action planning

This stage converts findings into commitments. The engine drafts; people decide. It applies readiness gates, raises **priority zero** for anything blocking, selects up to four strategic priorities with named trade-offs and pathways, generates draft actions at three levels and three horizons, and then governs those actions through co-design, approval, publication, tracking and closure. Every outcome from Stages 3 and 4 maps to a specific recommendation, priority treatment, owner and timeline (§5.5.2).

## 5.1  Purpose and scope

- **In scope:** debrief support; priority zero; priority selection; pathways and stepping stones; draft action generation; prioritisation; action records; workflow and approvals; Leader Development Plans; RAG, reminders and escalation; dashboards; plan outputs.

- **Principles:** no draft becomes a commitment without a named owner, sponsor, date, measure and approval; no content is published over an open blocking gate; every BUILD names what will be released; every priority carries a 30-day visible signal and a system lever.

## 5.2  Roles and permissions in this stage

**Table 74  ****Advisory responsibilities**

| **Task** | **Who** |
| --- | --- |
| Run plan generation | System, triggered by the consultant after reports are released |
| Triage drafts (keep, edit, merge, discard with reason) | PAC Consultant |
| Facilitate co-design; record effort, owners, sponsors, trade-offs | PAC Consultant facilitates; Executives and People Leaders participate |
| Approve | Executive (organisation level) · division head (unit level) · line manager (leader development actions) |
| Publish | PAC Consultant releases; Client Admin distributes |
| Update progress, upload evidence | Action owner |
| Review at 30 / 90 / 180 days; close | Sponsor reviews and closes; PAC Consultant attends and countersigns organisation-level closure |

## 5.3  Screens and user flow

**Table 75  ****Advisory screens**

| **ID** | **Screen** | **Behaviour** |
| --- | --- | --- |
| S5-01 | Debrief board | Findings ranked by severity with the decision tree outcome per orientation; perception-gap workshop mode shows executive and staff pictures side by side. |
| S5-02 | Priority zero register | Every blocking gate as a pre-condition with owner (CEO + CHRO), due date (30 days) and completion evidence. |
| S5-03 | Priority builder | Candidates in engine order with reasons; cap indicator; trade-off picker (negative-gap orientations only); pathway and narrative; deferred backlog with reasons. |
| S5-04 | Workshop mode | Projector-friendly: priority cards, four-level commitment matrix (individual, team, department or unit, organisation), effort rating, owner and sponsor nomination. |
| S5-05 | Action editor | Full action record (§5.4.2) with validation; machine-generated drafts labelled until reviewed. |
| S5-06 | Approval queue | Per approver; blocked items show the missing field or open gate. |
| S5-07 | Leader Development Plan | Generated from the leader report; up to three actions linked to unit actions. |
| S5-08 | Dashboards | Role-shaped (§5.7.2). |
| S5-09 | Review | 30 / 90 / 180-day review form with the five standard questions, KPI reading, evidence and the adjust-or-retire decision. |

## 5.4  Data captured

### 5.4.1  Priority

**Table 76  ****Priority**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| priority_id / assessment_id | id | — | Y |
| sequence | int 0–4 | 0 = priority zero (pre-conditions; outside the cap). | Y |
| orientation / classification / gap | enum / enum / decimal | Snapshot at creation. | Y (not P0) |
| linked_findings | id[] | At least one. | Y |
| urgency_tier | enum | STRATEGIC_MISS (0–30 days), BEHAVIOUR_GAP (0–90 days), PROCESS_CONTRADICTION (1–6 months), MODEL_READINESS (6–18 months), PRE_CONDITION (30 days). | Y |
| owner_role / executive_sponsor | enum / person | Owner role from the tier (§5.5.3); a named ExCo sponsor before approval. | Y |
| trade_off_orientation | enum | Required for BUILD priorities; must have a negative gap. | C |
| pathway / relationship / stepping_stone / narrative | json | §5.5.5. | C |
| visible_signal_action_id | id | Exactly one action dated within 30 days. | Y |
| four_level_commitments | json | Individual, team, department or unit, organisation: more of, less of, start, stop, keep. | Y |
| status | enum | CANDIDATE, SELECTED, DEFERRED (with reason), APPROVED, PUBLISHED, CLOSED. | Y |

### 5.4.2  Action

**Table 77  ****Action**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| action_id / level | id / enum | ORGANISATION, UNIT, LEADER. | Y |
| priority_id / linked_finding_id | id | An action without a finding cannot be created (422). | Y |
| objective | text(300) | Stated as an outcome, not an activity. | Y |
| orientation / classification_at_creation | enum | Snapshot. | Y |
| intervention | text(1000) | Drawn from the playbook or template; editable. | Y |
| horizon | enum | QUICK_WIN_0_3M, MEDIUM_3_12M, STRUCTURAL_12M_PLUS; constrained by gates. | Y |
| is_visible_signal | bool | At most one per priority; end date ≤ start + 30 days. | Y |
| system_lever | enum | PERFORMANCE_MANAGEMENT, PROMOTION, REWARD, ONBOARDING, RECOGNITION_RITUAL, DECISION_RIGHTS, NONE (quick wins only). | Y |
| owner / sponsor | person | One person each; sponsor senior to owner (grade rank). | Y |
| budget_amount / currency / source | decimal / ISO 4217 / text | Required for STRUCTURAL. | C |
| start_date / end_date | date | End date inside the horizon window. | Y |
| milestones | list | ≥ 2 for MEDIUM, ≥ 3 for STRUCTURAL; each with due date and status. | C |
| kpi / scorecard_kpi_id | text / id | Measure, target and date present (validated). Organisation level must link a scorecard KPI. | Y |
| baseline_value / baseline_date / source | decimal / date / text | Required. | Y |
| target_value / target_date | decimal / date | Required; direction consistent with KPI direction. | Y |
| watchlist | ref[] | Defaults from the playbook watch-list (D-dimension scenarios, D7–D9, eOS categories). | Y |
| effort / impact / urgency / priority_score | int / decimal / int / decimal | §5.5.7. | Y |
| status / rag / rag_declared / percent_complete | enum / enum / enum / int | §5.6. | Y |
| evidence | file[] | Required before closure. | C |
| review_points | date[] | Default start + 30, 90, 180 days. | Y |
| closure_outcome | enum | ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED, SUPERSEDED. | C |
| generated_by | enum | RULES_ENGINE, CONSULTANT, CLIENT_ADMIN, PEOPLE_LEADER. | Y |

**Table 78  ****Tracking records**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| kpi_reading | record | action_id (or scorecard KPI), value, reading_date, source, entered_by. Drives RAG. | Y |
| development_action | record | plan_id, orientation, start / stop / keep, observable behaviour, visible change in 30 days, support type and owner, linked unit action, review points. | Y |

## 5.5  Calculations: from outcome to recommendation

**Figure 13  ***Decision path applied to each orientation*

### 5.5.1  Order of evaluation

- Collect blocking findings → create **priority zero** items.

- Build the candidate list (§5.5.4) and assign urgency tiers (§5.5.3).

- Sort candidates; apply the readiness cap; defer the rest with reasons.

- Assign trade-offs to BUILD priorities; attach C3 system-lever actions.

- Select pathways and stepping stones (§5.5.5).

- Generate draft actions per priority, level and horizon (§5.5.6); add scenario template actions (§5.5.8).

- Score and order actions (§5.5.7); apply caps (§5.5.9); move overflow to the backlog.

### 5.5.2  Outcome-to-recommendation tables

These tables are the rules data the engine executes. “Timeline” is the due date offset from plan publication unless stated.

**Table 79  ****Alignment checks → recommendation**

| **Outcome** | **Recommendation** | **Priority treatment** | **Owner** | **Timeline** |
| --- | --- | --- | --- | --- |
| C1 MISS | Dedicated culture workstream with board visibility; quarterly KPI reporting; executive coaching anchored to the required orientation. | Candidate, sort key 1; impact 4–5 | CEO + CHRO | Start ≤ 30 days; signal ≤ 30 days |
| C1 PARTIAL HIT | Targeted 6–12-month workstream on the required orientation. | Candidate if BUILD or STRENGTHEN | CEO + CHRO | 6–12 months |
| C1 HIT | Sustain through recognition and ritual; record in G5 if not BUILD. | No priority | CHRO | Next review |
| C2 MISS · SUBSTANTIVE | Leadership workstream: programme, CDP-anchored 360 baseline and re-measure, culture-stewardship objective for all people managers. | Candidate, sort key 2 | CHRO + people managers | 0–90 days; 360 re-measure 180 days |
| C2 MISS · ENTRENCHED | As above plus system levers (promotion, reward, performance management) and an ExCo leadership KPI. | Candidate, sort key 2; adds structural actions | CHRO + people managers; ExCo sponsor | 0–90 days; structural 12 months |
| C2 MISS · MARGINAL | Coaching and recognition of the target behaviour; no system change. | Embedded in another priority | People managers | 0–90 days |
| C2 PARTIAL HIT | Targeted 6–12-month leadership workstream. | Candidate if target is BUILD / STRENGTHEN | CHRO + people managers | 6–12 months |
| C3 SYSTEMIC MISS | HR systems redesign (performance management, promotion, incentives, onboarding); one visible ritual change. | System-lever actions on the priority whose trade-off is the offending orientation, else its own candidate | CHRO + OD | Ritual ≤ 30 days; redesign ≤ 90 days |
| C3 PARTIAL HIT | Redesign the contradicting mechanism (ritual if D6, narrative if D4). | As above | CHRO + OD | ≤ 90 days |
| C3 identity risk | Bridging narrative preserving the bonding mechanism. | Narrative on the affected priority | CEO | At launch |
| C4 MISS | Multi-orientation culture transformation: Foundation 0–90 days, Activation 4–12 months, Embedding years 2–3. | Candidate, sort key 1 | CEO + ExCo | 6–18 months |
| C4 PARTIAL HIT | Close the gap on the below-threshold orientation within its existing priority. | Strengthens the related priority | CEO + ExCo | 6–18 months |

**Table 80  ****Gap classes → recommendation**

| **Gap class** | **Recommendation** | **Priority treatment** |
| --- | --- | --- |
| BUILD (significant) | Use the orientation’s “need more” playbook (Action Planning Guide §4.x.4). | Candidate priority; must name a trade-off. |
| STRENGTHEN | Targeted actions inside another priority or a unit plan; monitor. | Candidate only if linked to a check; otherwise embedded. |
| KEEP & PROTECT | Record in G5; prevent over-correction; reassure people who identify with it. | No priority; listed on the keep-and-protect panel. |
| MODERATE (significant, ≤ −8.0) | Target the overplay, not the orientation; bridging narrative. | Candidate priority (release-side priority). |
| MODERATE (> −8.0) | Name as the release side of a BUILD. | Trade-off only. |

**Table 81  ****Readiness gates → effect**

| **Readiness outcome** | **Effect** | **Owner** | **Timeline** |
| --- | --- | --- | --- |
| TPS < 2.50 | Foundation first: D9 and D8 conditions before content; cap 2 (consultant may set 1); all content actions ranked below enablement actions; SC-09 template. | CEO + CHRO | First 90 days |
| TPS 2.50 – < 3.50 | Cap 3; diagonal shifts via stepping stone. | — | — |
| TPS 3.50 – < 4.00 | Cap 4 with change-management support. | — | — |
| TPS ≥ 4.00 | Cap 4 in parallel. | — | — |
| D8 ≤ 3.0 | Psychological-safety workstream must precede or accompany any ENGAGE or INNOVATE BUILD (blocking for those). | CHRO | P0, 30 days |
| D9 ≤ 3.0 | Change infrastructure (sponsorship, resourcing, clarity of expected behaviours, lessons-learned) before content (blocking for content actions). | CEO + CHRO | P0, 30 days |
| D7 ≤ 3.0 | Digital adoption plan and named executive sponsor for any technology-dependent priority (blocking for that priority). | Executive sponsor | Before publication |

**Table 82  ****Perception and voice → recommendation**

| **Voice outcome** | **Recommendation** | **Owner** | **Timeline** |
| --- | --- | --- | --- |
| SHADOW_CULTURE (> 7.0) | Facilitated perception-gap workshop; executives see the staff picture first; blocks interventions on that orientation. | CEO + CHRO (P0) | 30 days |
| WATCH (> 5.0 – ≤ 7.0) | Examine in debrief; add the orientation to the pulse watch-list. | PAC Consultant | Debrief; 90-day pulse |
| eOS category negative | Structured listening sessions with the affected cohort before interventions are announced; blocks announcements to that cohort. | CHRO (P0) | 30 days |
| eOS 0 – 30 | Add to the routed priority’s watch-list. | Priority owner | Next pulse |
| eOS > 50 | Record as a strength to protect. | CHRO | — |

**Table 83  ****Leader outcomes → recommendation**

| **Leader outcome** | **Recommendation** | **Owner** | **Timeline** |
| --- | --- | --- | --- |
| LRI < 2.50 | Development plan first; unit priority sponsored one level up. | Line manager + coach | LDP in 30 days; review 90 / 180 |
| LRI 2.50 – < 3.50 | May carry a priority with structured coaching and a named sponsor. | Line manager | LDP in 30 days |
| LRI 3.50 – < 4.00 | May own a unit priority; coaching on growth orientation. | Leader | Cycle |
| LRI ≥ 4.00 | Candidate sponsor of an organisation priority; peer coach. | Leader | Cycle |
| Integrity flag | Specific development action; people-lead Client Admin informed. | Line manager + CHRO | Immediately |
| Safety flag | Safety-focused development action before the unit takes an ENGAGE or INNOVATE BUILD. | Line manager + coach | 30 days |
| Change-capacity flag | Unit plan sponsored one level up until cleared. | Division head | Until 180-day re-measure |
| BLIND_SPOT section | Named development action on that section. | Leader + coach | LDP |
| CULTURE_CARRIER | Sponsor or co-lead the priority; host the visible signal. | Leader | 30 days |
| CULTURE_BLOCKER / CRITICAL | Direct leadership intervention; CRITICAL suspends the unit plan and escalates. | Sponsoring executive + CHRO | Immediately |

**Table 84  ****Sub-culture outcomes → recommendation**

| **Sub-culture outcome** | **Recommendation** | **Owner and timeline** |
| --- | --- | --- |
| CONFIRMED sub-culture | Unit-level debrief and plan (max 3 actions); decide to align, protect or learn from it (SC-06). | Unit leader, sponsored by division head; 90 days |
| INDICATIVE | Monitor; cannot trigger a funded intervention. | PAC Consultant; next pulse |
| CAPACITY sub-culture | Different pace for that unit; unit-level readiness actions. | Unit leader; cycle |
| Segment eOS miss | Listening sessions for that segment. | CHRO; 30 days |

### 5.5.3  Urgency tier and owner

| urgency_tier(o) =     STRATEGIC_MISS        IF o is required by a C1 requirement with verdict MISS            # 0–30 days, CEO + CHRO     MODEL_READINESS       IF o is required by C4 with verdict MISS                          # 6–18 months, CEO + ExCo     BEHAVIOUR_GAP         IF o == leadership target AND C2 IN (MISS, PARTIAL_HIT)           # 0–90 days, CHRO + people managers     STRATEGIC_MISS        IF o is required by C1 with PARTIAL_HIT                           # treated as strategic, 6–12-month horizon     PROCESS_CONTRADICTION IF o is the C3 offending orientation, or o is MODERATE significant # 1–6 months, CHRO + OD     MODEL_READINESS       IF o is required by C4 with PARTIAL_HIT     PROCESS_CONTRADICTION OTHERWISE |
| --- |

### 5.5.4  Priority selection

| candidates = { o : class[o] == BUILD                  OR (class[o] == STRENGTHEN AND o is linked to any check that is not HIT)                  OR (class[o] == MODERATE AND gap[o] <= -8.0) } SORT candidates BY     1. required by a C1 or C4 MISS            DESC     2. leadership target with C2 MISS         DESC     3. C3 offending orientation (SYSTEMIC)    DESC     4. │gap│                                  DESC     5. orientation order (ENGAGE, INNOVATE, PERFORM, GOVERN)   # deterministic tie-break cap = 2 IF tps < 2.50 ELSE 3 IF tps < 3.50 ELSE 4 selected = first cap candidates; the rest DEFERRED with reason "readiness cap"  FOR p IN selected WHERE class[p] == BUILD:           # constant-sum discipline     p.trade_off = orientation with the most negative gap, preferring one not yet used as a trade-off;                   sharing is allowed when no unused negative-gap orientation remains     # a plan edit that removes a BUILD's trade-off is refused: 422 PlanIncoherent  IF C3 IN (PARTIAL_HIT, SYSTEMIC_MISS):     attach C3 system-lever actions to the priority whose trade_off == C3 offending orientation;     if none, add that orientation as a MODERATE candidate in tier PROCESS_CONTRADICTION (subject to cap)  priority_zero = all blocking findings (SHADOW_CULTURE, eOS negative, D8/D9 gates, leader CRITICAL) → owner CEO + CHRO, due 30 days |
| --- |

| **WORKED EXAMPLE: THE SELECTED PLAN** Candidates: INNOVATE (BUILD +11, C1 MISS), ENGAGE (BUILD +9, C2 MISS), GOVERN (MODERATE −14, significant). Sorted: INNOVATE (key 1), ENGAGE (key 2), GOVERN (key 4). TPS 3.09 → cap 3 → all three selected; none deferred. Trade-offs: INNOVATE releases GOVERN (−14); ENGAGE releases PERFORM (−6). C3 SYSTEMIC MISS (offending PERFORM) attaches its system-lever actions to the ENGAGE priority, whose trade-off is PERFORM. Priority zero: perception-gap workshop (ENGAGE and GOVERN SHADOW_CULTURE); listening sessions for eOS Q3 and Q6; psychological-safety workstream (D8 2.8). |
| --- |

**Table 85  ****Reference fixture: generated plan skeleton**

| **#** | **Priority** | **Evidence** | **Pathway** | **Owner · tier** | **Timeline** |
| --- | --- | --- | --- | --- | --- |
| 0 | Pre-conditions | SHADOW ENGAGE + GOVERN; eOS Q3 −8, Q6 −14; D8 2.8 | — | CEO + CHRO · PRE_CONDITION | All within 30 days |
| 1 | Digital innovation (INNOVATE BUILD) | Gap +11; C1 MISS 50.0%; SC-01 context | PERFORM → INNOVATE, adjacent (outward): “Tomorrow’s targets depend on today’s experiments.” Release: GOVERN | CEO + CHRO · STRATEGIC_MISS; owner e.g. Head of Digital | Signal ≤ 30 days; sprints by 90 days; KPI digital adoption 28% → 45% by 12 months |
| 2 | Coach-first leadership (ENGAGE BUILD) | Gap +9; C2 MISS rank 3, 14.0 SUBSTANTIVE; C4 PARTIAL 86.7%; SC-01; C3 SYSTEMIC levers | PERFORM → ENGAGE, diagonal; stepping stone GOVERN (30 > 14): “We perform best when our people are at their best.” Release: PERFORM | CHRO + people managers · BEHAVIOUR_GAP | Blocked until P0 workshop and safety workstream; 360 baseline 90 days; attrition 19% → 13% at 12 months |
| 3 | Streamline control (GOVERN MODERATE) | Gap −14 significant; SC-10 context | Moderate the overplay; keep regulatory controls | CHRO + OD · PROCESS_CONTRADICTION; owner e.g. COO | Blocked until P0 workshop; delegation matrix by 6 months |

### 5.5.5  Pathways and stepping stones

Origin = dominant NOW orientation (the higher of a shared pair). Target = the priority’s orientation. Adjacent shifts share a pole; diagonal shifts (ENGAGE↔PERFORM, INNOVATE↔GOVERN) share none.

**Table 86  ****Pathway library (rules data)**

| **Pathway** | **Relationship** | **Difficulty** | **Bridging narrative** | **Core interventions** |
| --- | --- | --- | --- | --- |
| PERFORM → ENGAGE | Diagonal | High | “We perform best when our people are at their best.” | Coach-first leadership development; CDP-anchored 360; wellbeing investment; team-based recognition. |
| ENGAGE → PERFORM | Diagonal | High | “Delivering for our customers is how we secure each other’s future.” | Commercial acumen; objective-setting rigour; performance-conversation skills; visible scoreboard. |
| GOVERN → INNOVATE | Diagonal | High | “Our discipline is what lets us experiment safely.” | Innovation sprints; permission to fail; fewer approval layers; ring-fenced experimentation budget. |
| INNOVATE → GOVERN | Diagonal | High | “Good systems let our best ideas scale.” | Process discipline; documentation; quality management system; governance training. |
| ENGAGE → INNOVATE | Adjacent (adaptive) | Moderate | “Our trust is the safety net for bold ideas.” | Idea forums; action learning; protected experimentation time. |
| INNOVATE → ENGAGE | Adjacent (adaptive) | Moderate | “Great ideas need great teams.” | Mentoring; team rituals; retention plans for creative talent. |
| ENGAGE → GOVERN | Adjacent (inward) | Moderate | “Fairness and consistency are how we care at scale.” | Role clarity; standardised people processes; documented decision rights. |
| GOVERN → ENGAGE | Adjacent (inward) | Moderate | “Our standards exist to serve the people who deliver them.” | Manager coaching capability; participative process design. |
| INNOVATE → PERFORM | Adjacent (outward) | Moderate | “Ideas only count when customers pay for them.” | Phase-gate discipline; commercial targets on the portfolio. |
| PERFORM → INNOVATE | Adjacent (outward) | Moderate | “Tomorrow’s targets depend on today’s experiments.” | Innovation objectives in scorecards; sandbox time; pilot funding. |
| PERFORM → GOVERN | Adjacent (structured) | Moderate | “Reliability is how we keep winning.” | Control framework; quality metrics beside delivery metrics. |
| GOVERN → PERFORM | Adjacent (structured) | Moderate | “Our systems exist to deliver results, not to be admired.” | Outcome measures; customer proximity; delegated decision rights. |

**Stepping stone.** When the shift is diagonal and (TPS < 3.50 or D8 ≤ 3.0 or D9 ≤ 3.0), route through whichever of the two neighbours has the higher NOW score (ties: the neighbour on the target’s adaptive/structured pole). The priority then carries two narratives: the neighbour shift first, then the target shift.

### 5.5.6  Draft action generation

**Table 87  ****Action levels**

| **Level** | **Scope** | **Default owner** | **Generated from** |
| --- | --- | --- | --- |
| Organisation | System changes: performance management, promotion, reward, onboarding, recognition rituals, decision rights, portfolio funding. | Urgency-tier owner | Playbook system levers for the priority orientation; C3 lever set where attached; scenario template mandatory actions. |
| Unit | Departments, divisions, locations or teams confirmed as sub-cultures or divergent on the priority orientation. | Unit leader, sponsored by division head | The unit’s classes and eOS pattern, filtered to the priority orientation. |
| Leader | Behavioural commitments in the Leader Development Plan. | The leader, with line manager as sponsor | Growth orientation, self–other gaps, flags, alignment section score. |

- Every draft is created as DRAFT and labelled machine-generated until a consultant reviews it. The engine never fills owner, sponsor (as a person), budget or target value: those are commitments.

- **Mandatory companions** per priority: one quick win dated ≤ 30 days marked as the visible signal; at least one MEDIUM or STRUCTURAL action with a system lever other than NONE; for BUILD priorities, one action that gives effect to the trade-off. Generation fails (and the consultant is told why) if any is missing.

- Horizons are filtered by gates: under TPS < 2.50 only QUICK_WIN and enablement actions may be generated for content priorities in the first 90 days.

**Table 88  ****Playbook defaults (full action sets are seeded from Action Planning Guide §4.1.4–4.4.4)**

| **Orientation** | **30-day visible signal (default)** | **System levers (default)** | **Watch-list (default)** |
| --- | --- | --- | --- |
| ENGAGE | CEO publicly recognises a manager for developing talent at an all-staff forum. | People-development objective in every manager’s scorecard; promotion credit for developing others; team recognition; onboarding buddy and 30/60/90 check-ins. | D2 S2 · D3 S2 · D4 S2 · D8 · eOS Q1, Q4, Q6, Q7 |
| INNOVATE | Publicly celebrate a well-run experiment that failed, and what was learned. | Innovation objective in scorecards; promotion credit for intelligent risk; innovation budget or protected time; new hires challenge one practice in 90 days. | D1 S3 · D2 S1 · D5 S1, S3 · D7 · D8 · eOS Q3 |
| PERFORM | Publish a simple team scoreboard and recognise a delivery win against it. | Cascaded targets with quarterly review; promotion on delivered results; variable pay on a few measurable outcomes; first-week expectations. | D2 S1, S3 · D3 S3 · D5 S1 · D6 S1–S3 · eOS Q8 · D8 |
| GOVERN | Fix one visible process bottleneck staff complain about and say what changed. | Role clarity with quality and compliance measures; promotion for reliability and judgement on risk; recognise error reduction; structured induction. | D1 S2 · D3 S1 · D5 S2 · D6 S3 · D9 · audit findings |

### 5.5.7  Action prioritisation

| priority_score = impact × urgency ÷ effort            # 2 dp; visible-signal action always ordered first in its priority |
| --- |

**Table 89  ****Prioritisation factors**

| **Factor** | **Rule (1–5)** |
| --- | --- |
| Impact | 5 = addresses a C1 or C4 MISS on a BUILD orientation with a linked scorecard KPI · 4 = C1/C4 MISS without KPI, or C2 MISS, or C3 SYSTEMIC MISS · 3 = PARTIAL HIT linked, or significant BUILD/MODERATE unlinked · 2 = STRENGTHEN or unit divergence · 1 = otherwise. +0.5 where │gap│ ≥ 12.0 (maximum 5). |
| Urgency | 5 = priority zero or STRATEGIC_MISS tier · 4 = BEHAVIOUR_GAP · 3 = PROCESS_CONTRADICTION · 2 = MODEL_READINESS · 1 = backlog. SHADOW_CULTURE or a negative eOS category on the action’s orientation or cohort forces 5. |
| Effort | Engine default by action type, adjusted in the workshop: 1 a decision or meeting · 2 single-team change · 3 cross-team programme ≤ 3 months · 4 multi-function programme or policy redesign · 5 system redesign with budget and external support. |
| Modifiers | TPS < 2.50: content actions ranked below all enablement actions. Leader integrity or safety flag on the owning unit: unit actions suspended and escalated. |

Example: INNOVATE sprint action — impact 5 (C1 MISS, BUILD, linked KPI), urgency 5 (STRATEGIC_MISS), effort 3 → score 8.33.

### 5.5.8  Scenario templates

**Table 90  ****Scenario action templates**

| **Scenario** | **Objective pattern** | **Mandatory actions** | **Visible signal** |
| --- | --- | --- | --- |
| SC-01 | Sustain delivery while restoring the conditions that make it repeatable. | Coach-first programme; budgeted wellbeing investment; remove one target-only review ritual; listening sessions on negative categories. | CEO recognises a manager for developing talent. |
| SC-02 | Protected space to experiment without loosening controls that matter. | Remove ≥ 2 approval layers below a set value; ring-fenced experimentation budget; innovation objective in scorecards; digital adoption plan if D7 ≤ 3.0. | Fix one visible bottleneck. |
| SC-03 | Convert creative energy into delivered outcomes. | Portfolio stop rule and owner; phase-gate review; documentation standard; count adoption, not launches. | Scoreboard and a delivery win. |
| SC-04 | Hold standards as an expression of care. | Performance-conversation capability; objective-setting; reward differentiation; scoreboard. | Scoreboard and a delivery win. |
| SC-05 | Close the distance between what leaders believe and staff experience. | Perception-gap workshop first; unfiltered upward listening route; middle-manager sensing; re-measure at pulse. | Executives publish, unedited, three things staff said that they had not expected. |
| SC-06 | Decide to align, protect or learn from the unit. | Unit debrief; boundary agreement with adjacent units; unit plan ≤ 3 actions. | Unit leader states what the unit adopts and what it does differently. |
| SC-07 | Protect the team while the leadership question is addressed. | LDP with named coach; sponsor one level up; 360 re-measure at 180 days; retention conversations. | Leader commits to one observable change in 30 days. |
| SC-08 | Remove the constraint rather than develop the leader. | Decision-rights review; resourcing review; dependency mapping; parent-unit check. | Sponsor names the constraint and a removal date. |
| SC-09 | Build the capacity to change before naming what to change. | Change infrastructure; safety workstream if D8 ≤ 3.0; 1–2 priorities. | Formally close the last unfinished change programme. |
| SC-10 | Stop paying for the behaviour the organisation wants to stop. | HR systems redesign ≤ 90 days; one recognition ritual changed ≤ 30 days. | Change a ritual and explain why in the same announcement. |
| SC-11 | Make the strategic choice the profile has avoided. | Return to Sections B–D; one primary build with trade-off; defer the rest visibly. | Publish the deferred list. |
| SC-12 | Protect what is working. | Document the rituals; write them into onboarding and promotion; record G5. | Name the practice that will not change, and why. |

### 5.5.9  Caps

**Table 91  ****Caps**

| **Level** | **Cap** | **Rule** |
| --- | --- | --- |
| Organisation | 4 priorities (fewer by gate); ≤ 6 organisation actions per priority | Priority zero is outside the cap. |
| Unit | 3 actions per unit per cycle | A unit leader with more than three culture commitments alongside an operational role will deliver none. |
| Leader | 3 development actions per six-month cycle | From the 360 development plan structure. |
| Overflow | Backlog | Held visibly with evidence and score; reported as deferred with the reason. |

| **ACTION CAPS AND ESCALATION INTERVALS (D-05)** The caps above and the escalation intervals in §5.6.3 (7, 14, 21 and 28 days) are adopted. They are stored as tenant-level configuration (Appendix I) so a client-specific variation can be set by a PAC Consultant without a release. |
| --- |

## 5.6  Decision rules: workflow and tracking

**Figure 14  ***Action workflow*

**Table 92  ****Action transitions (any other transition returns 409)**

| **Transition** | **Who** | **Guard** |
| --- | --- | --- |
| → DRAFT | Engine, consultant, Client Admin, People Leader (own level) | A linked finding exists. |
| DRAFT → IN_REVIEW | PAC Consultant | Triage recorded (kept, edited, merged); DISCARDED requires a reason. |
| IN_REVIEW → IN_CO_DESIGN | PAC Consultant | Workshop session recorded; effort rated; owners and sponsors nominated; trade-offs named. |
| IN_CO_DESIGN → APPROVED | Approver for the level | All mandatory fields complete (owner, sponsor, KPI, baseline, target, dates; budget for STRUCTURAL; milestones). |
| APPROVED → PUBLISHED | PAC Consultant releases | Every blocking gate on the action’s orientation and cohort is recorded complete; the visible signal is scheduled. |
| PUBLISHED → IN_PROGRESS | Owner | Start date reached. |
| IN_PROGRESS ⇄ UNDER_REVIEW | Owner submits; sponsor reviews | At 30 / 90 / 180 days: progress, KPI reading, evidence; adjust-or-retire decision (§6.5.3). |
| UNDER_REVIEW → CLOSED / RETIRED | Sponsor; consultant countersigns organisation level | Evidence uploaded and closure outcome selected; closure without evidence returns 409. |

### 5.6.1  RAG (computed, then declared)

| progress = (latest_kpi − baseline) ÷ (target − baseline)      # sign-adjusted for KPI direction towards  = progress > 0.05 ; flat = −0.05 ≤ progress ≤ 0.05 ; away = progress < −0.05 |
| --- |

**Table 93  ****RAG rules**

| **RAG** | **Computed rule** |
| --- | --- |
| GREEN | No milestone overdue, no review point overdue, and KPI towards target (or no reading due yet). |
| AMBER | One milestone overdue ≤ 14 days, or KPI flat at the 90-day review, or one review point overdue. |
| RED | Any milestone overdue > 14 days, or KPI away from target, or end date passed without closure, or two consecutive review points missed. |

The owner may declare a different RAG with a mandatory comment; both values are stored, and a divergence that persists for two consecutive weeks is reported to the sponsor.

### 5.6.2  Leader Development Plans

- Up to three actions per six-month cycle: at least one on the growth orientation, at least one on the leadership target orientation, and one on any BLIND_SPOT section.

- Each names the orientation it builds, what the leader will START, STOP or KEEP, an observable behaviour a direct report would see, and one visible change within 30 days.

- Support named explicitly (coaching with a minimum of eight sessions when the priority tier is BEHAVIOUR_GAP; training; exposure; stretch assignment).

- Each development action links to the unit action it enables; an unlinked plan is flagged “disconnected”.

- Reviewed at 30, 90 and 180 days with the line manager; re-measured at the next 360. Never exported to remuneration, succession or disciplinary processes.

### 5.6.3  Reminders and escalation

**Table 94  ****Escalation ladder**

| **Trigger** | **Action** |
| --- | --- |
| 7 days before a milestone or review point | Reminder to owner. |
| Milestone overdue | Daily reminder to owner for 7 days. |
| Overdue 14 days | Notify sponsor; RAG at least AMBER. |
| Overdue 21 days, or RED for 2 consecutive weeks | Escalate to the urgency-tier owner; appears on the executive exception list. |
| RED for 4 consecutive weeks | Named item at the next ExCo review with a required decision: re-resource, re-scope, re-assign or retire. |
| Visible signal not delivered in 30 days | Immediate escalation to the CEO. |
| Closure requested without evidence | Blocked; owner told which evidence type is missing. |

## 5.7  Outputs

### 5.7.1  Plan outputs

**Table 95  ****Plan outputs**

| **Output** | **Content** | **Audience and cadence** |
| --- | --- | --- |
| Action Plan Report | Priority table (orientation, gap, class, signal, owner, tier, deliverable and date), priority cards, four-level matrix, gates applied, trade-offs, keep-and-protect list, deferred backlog. | ExCo and CHRO at approval; reissued at each 90-day review |
| Timeline (Gantt) | All actions across horizons with milestones, review points, visible signals and priority-zero gates as dependencies. | Programme governance, monthly |
| Commitment charter | One page per priority and per unit: objective, behaviours that will change, what stops, owner and sponsor by name, KPI baseline and target, review dates. | Every leader and team, at launch |
| Board progress report | Priorities with RAG, KPI movement, eOS and TPS trend, P0 completion, escalations needing a board decision, next re-assessment date. | Board, quarterly |
| ExCo progress report | The above plus action detail, overdue items, evidence status, adjust-or-retire decisions. | ExCo, monthly |
| Manager progress report | Own unit actions and development plan with the unit’s culture and eOS position. | People Leaders, monthly |

### 5.7.2  Dashboards

**Table 96  ****Dashboards**

| **Role** | **Dashboard** |
| --- | --- |
| Executive | Up to four priorities with RAG, percent complete, KPI trend against target, P0 status and the exception list. One screen. |
| Client Admin | All actions with filters, overdue list, evidence gaps, distribution and reminder log. |
| People Leader | Own unit actions and development plan beside the unit profile and eOS. |
| PAC Consultant | Portfolio across clients: engagement state, P0 completion, plan health, re-assessment due dates. |
| Board | Quarterly extract: priorities with RAG, eOS and TPS trend, escalations for decision. |
| Respondent | Published organisational summary and public commitments, where the client publishes them. |

| { "priority_id": "pri_01", "sequence": 1, "orientation": "INNOVATE", "classification": "BUILD", "gap": 11.0,   "linked_findings": ["fnd_0042"], "urgency_tier": "STRATEGIC_MISS", "owner_role": "CEO+CHRO",   "trade_off_orientation": "GOVERN", "pathway": {"from": "PERFORM", "to": "INNOVATE", "relationship": "ADJACENT_OUTWARD",   "stepping_stone": null, "narrative": "Tomorrow's targets depend on today's experiments."},   "actions": [ { "action_id": "act_0117", "level": "ORGANISATION", "linked_finding_id": "fnd_0042",       "objective": "Create protected space to experiment without loosening the controls that matter.",       "intervention": "Run three 90-day customer-journey innovation sprints with a ring-fenced budget; remove the full-business-case requirement before a pilot.",       "horizon": "MEDIUM_3_12M", "is_visible_signal": false, "system_lever": "DECISION_RIGHTS",       "owner": null, "sponsor": null, "status": "DRAFT", "generated_by": "RULES_ENGINE",       "impact": 5, "urgency": 5, "effort": 3, "priority_score": 8.33,       "kpi": "Digital channel adoption", "scorecard_kpi_id": "kpi_07", "baseline_value": 28, "target_value": 45,       "target_date": "2027-10-31", "watchlist": ["D1 S3","D2 S1","D5 S1","D5 S3","D7","D8","eOS Q3"],       "review_points": ["+30d","+90d","+180d"] } ] } |
| --- |

## 5.8  Acceptance criteria

**Table 97  ****Advisory acceptance criteria**

| **ID** | **Criterion** |
| --- | --- |
| AC-5.1 | The fixture produces exactly the plan skeleton in §5.5.4: priority zero with three items, priorities INNOVATE, ENGAGE, GOVERN in that order, trade-offs GOVERN and PERFORM, stepping stone GOVERN for ENGAGE (UT-22, UT-24, UT-25). |
| AC-5.2 | Removing a BUILD’s trade-off returns 422 PlanIncoherent (UT-23). |
| AC-5.3 | Publishing an action on an orientation with an open SHADOW_CULTURE gate returns 409 naming the pre-condition (UT-26). |
| AC-5.4 | Every transition in §5.6 is enforced; every other transition returns 409. |
| AC-5.5 | The escalation ladder fires on schedule in a simulated-clock test; an undelivered visible signal reaches the CEO. |
| AC-5.6 | Generation refuses a priority missing a visible signal, a system lever or (for BUILD) a trade-off action, and says which. |
| AC-5.7 | Leader outputs cannot be exported into performance, remuneration, succession or disciplinary contexts. |

# 6  Re-assessment

Culture is managed, not fixed once. Re-assessment measures whether the plan is moving the culture, decides what to adjust or retire, and opens the next annual cycle with the history carried forward. Movement is reported; causation is never claimed.

## 6.1  Purpose and scope

- **In scope:** watch-list pulses at 90 and 180 days; early re-assessment triggers; full re-administration at 12 months; before-and-after comparison; trade-off verification; adjust-or-retire decisions; version comparability; cycle rollover; retention and destruction.

## 6.2  Roles and permissions in this stage

**Table 98  ****Re-assessment responsibilities**

| **Task** | **Who** |
| --- | --- |
| Create and run a pulse | PAC Consultant (Client Admin may request) |
| Record a material organisational change | Client Admin |
| Accept a trigger and open re-assessment | PAC Consultant |
| Take adjust-or-retire decisions | Sponsor at review; ExCo for RED-four-weeks items |
| Roll over to the next cycle | PAC Consultant |
| Run retention and destruction jobs | System (scheduler); Super Admin monitors |

## 6.3  Screens and user flow

**Table 99  ****Re-assessment screens**

| **ID** | **Screen** | **Behaviour** |
| --- | --- | --- |
| S6-01 | Pulse builder | Pick a priority; items offered only from its watch-list; live item count (maximum 10); audience cohort with projected size; schedule at 90 or 180 days. |
| S6-02 | Pulse results | Watch-list items against the baseline on the same items, labelled INDICATIVE; trigger indicators. |
| S6-03 | Trigger monitor | Open triggers with source (pulse, structural completion, organisational change, board request, 12 months) and accept or dismiss with reason. |
| S6-04 | Trend comparison | Any metric, any permitted segment, across cycles; version banner; trade-off verification panel. |
| S6-05 | Cycle rollover | Creates the next engagement with carry-forward preview. |

## 6.4  Data captured

**Table 100  ****Re-assessment data**

| **Field** | **Type** | **Validation and behaviour** | **Req.** |
| --- | --- | --- | --- |
| pulse | record | priority_id, item_refs (≤ 10, all on the watch-list), audience predicate, run window, status. | Y |
| pulse_response | record | pulse_id, demographic snapshot, values; same unlinking as the main survey. | Y |
| trigger | record | type (PULSE_MOVEMENT, STRUCTURAL_COMPLETE, ORG_CHANGE, BOARD_REQUEST, ANNUAL), source reference, raised_at, decision (ACCEPTED / DISMISSED), reason. | Y |
| org_change | record | type (RESTRUCTURE, MERGER, NEW_CEO, MODEL_TRANSITION_LIVE, OTHER), effective date, description. | Y |
| comparison | record | baseline assessment, current assessment, version relation (SAME, MINOR, MAJOR), deltas json. | — |
| aggregate_trend_record | record | Organisation and segment metrics (n ≥ 5 only) retained after response-level destruction (§6.6.3). | — |

## 6.5  Calculations

### 6.5.1  Pulse instruments and triggers

A pulse uses only the priority’s watch-list. Scenario references (for example “D2 S2”) present that scenario’s NOW constant-sum block. Dimension references (D7, D8, D9) present a fixed four-item short form so a pulse stays within ten items. Results are compared with the baseline on the **same items** and are always labelled INDICATIVE; they never replace a full assessment score.

**Table 101  ****Pulse short forms (D-12)**

| **Short form** | **Items (item bank 1.1)** |
| --- | --- |
| D7 | D7-01, D7-03, D7-04, D7-08 |
| D8 | D8-02, D8-03, D8-05, D8-11 |
| D9 | D9-01, D9-05, D9-09, D9-10 |

**Table 102  ****Re-assessment triggers**

| **Trigger** | **Rule** |
| --- | --- |
| Pulse movement: Likert | Short-form mean (1 dp) differs from the baseline on the same items by ≥ 0.5 in either direction. |
| Pulse movement: eOS | Category score differs from baseline by ≥ 15 points. |
| Pulse movement: scenario | Allocation to the priority orientation on a watch-list scenario differs from baseline by ≥ 8.0 points. |
| Structural completion | All STRUCTURAL actions on a priority are CLOSED. |
| Organisational change | A recorded RESTRUCTURE, MERGER, NEW_CEO or MODEL_TRANSITION_LIVE. |
| Board request | Recorded by the PAC Consultant. |
| Annual | 12 months after the baseline window closed. |

A trigger raises a review, not an automatic survey. The consultant accepts (opening RE-ASSESSMENT) or dismisses with a reason. Pulse results are reported only for audiences with n ≥ 5.

### 6.5.2  Before-and-after comparison and trade-off verification

| delta(metric) = current − baseline         # orientation scores, gaps, classes, D7–D9, TPS, LRI distribution, eOS version_relation = MAJOR → comparison refused (409); MINOR → warning banner; SAME → none  FOR each BUILD priority p with target t and trade-off r in the baseline plan:     rise   = NOW_current(t) − NOW_baseline(t)     falls  = { o ≠ t : max(0, NOW_baseline(o) − NOW_current(o)) }     share_r = falls[r] ÷ Σ falls                 # undefined if Σ falls = 0     verdict = INTENDED_RELEASE   IF rise > 0 AND share_r ≥ 0.50             = MIXED_RELEASE      IF rise > 0 AND share_r < 0.50             = NO_MOVEMENT        IF rise ≤ 0     unintended = any baseline KEEP_AND_PROTECT orientation with NOW fall ≥ 4.0 |
| --- |

An unintended release is one of the most useful findings a re-assessment produces and is reported prominently. The report states movement and delivery side by side and never claims that an action caused a movement (the AI causal screen applies).

### 6.5.3  Adjust-or-retire rules (at 90 and 180-day reviews)

**Table 103  ****Adjust or retire**

| **Condition** | **Decision** | **Rationale** |
| --- | --- | --- |
| KPI towards target, milestones on schedule | Continue unchanged. | Working. |
| KPI flat, milestones delivered | Adjust the intervention, keep the objective; re-rate effort and impact. | Right objective, wrong mechanism; the most common case and not a failure. |
| KPI flat, milestones not delivered | Adjust resourcing or ownership; escalate to sponsor. | A delivery problem, not a design problem. |
| KPI away from target | Suspend and re-diagnose; check for overplay and for an unintended release on a KEEP & PROTECT orientation. | Over-correction is the commonest harm. |
| Pre-condition never completed | Retire the dependent action; reinstate the pre-condition as priority zero. | Content over an open gate will not hold. |
| Finding no longer supported by current data | Retire as SUPERSEDED, recording the superseding assessment. | The organisation has moved. |
| Owner or sponsor has left | Reassign within 14 days or retire. | An unowned action is not an action. |
| Two consecutive adjustments with no KPI movement | Retire as NOT_ACHIEVED; return the finding to the backlog with the approaches tried. | Recording what did not work is the most valuable carry-forward. |

## 6.6  Decision rules

### 6.6.1  Comparability

- Item bank 1.0 and 1.1 are equivalent (orthographic standardisation only); comparisons across them carry no warning.

- Any future wording change that affects meaning creates a new major version; comparisons across a major version are refused (409) with an explanation.

- A minor version (for example a new locale) shows a warning banner and the data.

### 6.6.2  Cycle rollover

**Table 104  ****Rollover**

| **Carried forward** | **Rule** |
| --- | --- |
| Setup Sections A–I | Copied as DRAFT; must be re-agreed at the next executive workshop (dates and participants re-recorded). |
| Open actions | Carried with status and history; linked to the new assessment’s findings at the next plan generation, or retired as SUPERSEDED. |
| Backlog | Carried with evidence, scores and the reasons for deferral. |
| G5 keep and protect | Carried; system entries recomputed from the new classification. |
| Baseline | The previous assessment becomes the baseline for comparison and trade-off verification. |

### 6.6.3  Retention and destruction

- Response-level data (responses, allocations, items, text, rater ratings, invitations, consent link records) is destroyed 24 months after the assessment window closed, unless the client requested an alternative in writing before expiry. Notifications at 90 and 30 days; an immutable destruction certificate is issued.

- Aggregate trend records (organisation and segment metrics with n ≥ 5, findings, plans and action history) contain no response rows. They are retained for the life of the client relationship plus 24 months after exit, to support trend comparison; this term is written into the standard services contract, and the aggregates are destroyed earlier on the client’s written request (D-08).

## 6.7  Outputs

| { "comparison_id": "cmp_2027_01", "baseline": "asm_7f31", "current": "asm_9a02", "version_relation": "SAME",   "deltas": { "now": {"ENGAGE": +4.0, "INNOVATE": +5.0, "PERFORM": -3.0, "GOVERN": -6.0}, "tps": +0.21 },   "trade_off_verification": [      {"priority": "pri_01", "target": "INNOVATE", "trade_off": "GOVERN", "rise": 5.0, "share_trade_off": 0.67, "verdict": "INTENDED_RELEASE"},      {"priority": "pri_02", "target": "ENGAGE",   "trade_off": "PERFORM", "rise": 4.0, "share_trade_off": 0.33, "verdict": "MIXED_RELEASE"} ],   "unintended_release": [] } |
| --- |

Illustrative only: in this example GOVERN fell 6.0 and PERFORM fell 3.0 (total 9.0 released). For INNOVATE the trade-off GOVERN carries 6.0 ÷ 9.0 = 0.67 of the release (intended). For ENGAGE the trade-off PERFORM carries 3.0 ÷ 9.0 = 0.33 (mixed): the organisation released bureaucracy rather than pace, which the debrief should explore.

## 6.8  Acceptance criteria

**Table 105  ****Re-assessment acceptance criteria**

| **ID** | **Criterion** |
| --- | --- |
| AC-6.1 | A pulse with more than ten items, or any item outside the priority watch-list, is refused (422) (UT-42). |
| AC-6.2 | Each trigger in §6.5.1 is raised on seeded data and requires an accept or dismiss decision with reason. |
| AC-6.3 | Trade-off verification returns INTENDED, MIXED and unintended-release outcomes on seeded cases. |
| AC-6.4 | Comparisons across a major version return 409; across a minor version return data with a warning (UT-43). |
| AC-6.5 | The destruction job removes every response-level row and issues a certificate; aggregates contain no response rows (UT-44). |
| AC-6.6 | Rollover produces a DRAFT setup, carried actions and backlog, and links the baseline. |

# Appendix A  Data model

Relational core. Surrogate, prefixed identifiers; every client table carries tenant_id and is filtered by it at the data-access layer; every row carries created_at, created_by, updated_at, updated_by. Response tables carry no person reference and the application role has no grant that could join them to people.

**Figure 15  ***Domain map of the data model*

**Table 106  ****Tables**

| **Table** | **Key columns** | **Relationships and constraints** |
| --- | --- | --- |
| tenant | tenant_id, name, legal_name, sector, headcount, geographies[], residency_region, privacy_regime, timezone, branding_pack_id, dpia_recorded_at | Root. residency_region and privacy_regime immutable after first launch. |
| engagement | engagement_id, tenant_id, cycle_no, state, previous_engagement_id, consultants[] (person, from, to) | State machine §0.6. |
| org_unit | unit_id, tenant_id, parent_unit_id, type (DIVISION / DEPARTMENT / TEAM), name, rollup_to_parent | Tree; no cycles. |
| location · grade_band | location_id, name · grade_id, name, rank_order, is_executive | — |
| person_of_record | person_id, tenant_id, employee_ref, email, unit_id, grade_id, location_id, employment_status | Never joined to responses. |
| leader_assignment | assignment_id, person_id, team_id, effect_from, effect_to | One active per team per date (exclusion constraint). |
| demographic_attribute · value | attribute_id, name, is_sensitive, analytical_purpose · value_id, label, order | Closed lists only. |
| setup_record | setup_id, engagement_id, section (A–I), perspective (EXECUTIVE / HR / AGREED), payload_json, status, workshop_date, participants[], locked_at | Unique (engagement, section, perspective). |
| strategic_requirement | requirement_id, engagement_id, check (C1 / C4), type (SINGLE / JOINT / PAIRED / DOMINANT / BALANCED), orientations[], thresholds_json, source_refs[] | Derived at agreement; frozen at launch. |
| strategic_objective · strategic_kpi | objective_id, title · kpi_id, objective_id, name, unit, direction, baseline_value, baseline_date, source, target_12m, target_3y | Scorecard §1.4.3. |
| instrument_version · rules_version | version_id, semver, status (DRAFT / PUBLISHED / RETIRED), published_at, equivalence_note | Immutable once published. |
| item · scenario · scenario_statement · item_locale_variant | item_id, version_id, block, dimension, sequence, scale_type, canonical_text · scenario_id, dimension, sequence, title, prompt_now, prompt_preferred · statement_id, scenario_id, orientation, text · variant_id, item_ref, locale, text, back_translation_ref, reconciled_by, reconciled_at | Appendix C. |
| assessment | assessment_id, engagement_id, instrument_version_id, rules_version_id, window_open, window_close, frozen_at, response_set_hash, status | Pinned versions. |
| invitation | invitation_id, assessment_id, kind (SURVEY / SELF_360 / RATER_360), token_hash, person_id (nullable), demographic_snapshot_json, sent_at, submitted_at, person_link_destroyed_at, auto_submit_consent | person_id nulled at submission. |
| consent_record | consent_id, invitation_id (nullable after unlink), consent_text_version, decision, decided_at | — |
| response · response_allocation · response_item · response_text | response_id, assessment_id, demographic_snapshot_json, language, started_at, submitted_at, duration_seconds, completion_state, quality_flags[], voided_reason · (response_id, scenario_id, perspective, orientation, points) · (response_id, item_id, value) · (response_id, question_code, ciphertext) | CHECK points 0–100; deferred constraint: four rows per (response, scenario, perspective) sum to 100. |
| leader_360 · self_rating · rater_response · rater_rating · leader_text | result_id, assessment_id, assignment_id, valid, coverage_headcount · (result_id, item_id, value) · rater_response_id, result_id, rater_group, frequency · (rater_response_id, item_id, value nullable) · (result_id, source, question_code, ciphertext, review_state) | No rater identity stored. |
| score_object | score_id, assessment_id, version, payload_json, payload_hash, frozen_at, frozen_by | Immutable after freeze. |
| segment_profile | profile_id, score_id, segment_definition_json, respondent_count, metrics_json, suppressed, suppression_reason | Suppression evaluated on counts. |
| finding · scenario_match | finding_id, assessment_id, score_version, type, verdict, severity, orientation, segment_definition_json, metrics_json, evidence_json, blocking, blocks_json, annotation · (finding_id, scenario_id) | — |
| report · narrative_draft | report_id, assessment_id, type, audience, status, released_by, released_at, payload_hash, files[] · draft_id, report_id, prompt_version, model_version, payload_hash, generated_json, accepted_by, accepted_at | Release gate §4.6. |
| priority | priority_id, assessment_id, sequence, orientation, classification, gap, urgency_tier, owner_role, executive_sponsor_id, trade_off_orientation, pathway_json, visible_signal_action_id, four_level_json, status, deferred_reason | ≤ 4 plus sequence 0. |
| action · milestone · review_point · kpi_reading · evidence | see §5.4.2 · (action_id, description, due_date, status) · (action_id, due_date, completed_at, outcome_json) · (action_id or kpi_id, value, reading_date, source) · (action_id, type, file_ref, uploaded_by, uploaded_at) | Closure requires evidence. |
| development_plan · development_action | plan_id, result_id, cycle_start, cycle_end · dev_action_id, plan_id, orientation, start_stop_keep, behaviour, visible_change_30d, support, linked_action_id | ≤ 3 per cycle. |
| pulse · pulse_response · trigger · org_change · comparison | §6.4 | — |
| audit_log · segment_query_log | log_id, tenant_id, actor_id, action, object_type, object_id, payload_hash, at · query_id, actor_id, predicates_json, resolved_count, outcome, at | Append-only; no update or delete grant. |

# Appendix B  API

REST over HTTPS, JSON, versioned under /v1. Authentication: OIDC for staff roles with MFA; single-use tokens for respondents and raters. Errors use RFC 7807 problem details with a machine code. 409 is used for state conflicts and suppression; 422 for validation failures.

**Table 107  ****Endpoints**

| **Method and path** | **Purpose** | **Rules** |
| --- | --- | --- |
| POST /v1/tenants | Create tenant | Super Admin. |
| POST /v1/tenants/{id}/engagements | Create engagement (cycle) | Super Admin or PAC Consultant. |
| PUT /v1/engagements/{id}/org-graph | Bulk upsert structure, people, leader assignments | Returns the V1–V7 validation report; 422 with defects. |
| GET · PUT /v1/engagements/{id}/setup/{section}?perspective= | Read / write Sections A–I | PUT refused after lock (409). |
| POST /v1/engagements/{id}/setup/{section}/agree | Move a section to Agreed | Requires workshop record (422). |
| GET /v1/engagements/{id}/requirements | Derived requirements | Computed from Agreed setup. |
| POST /v1/assessments | Create assessment | Pins instrument and rules versions. |
| POST /v1/assessments/{id}/preflight | Run pre-flight | Returns L1–L8 results. |
| POST /v1/assessments/{id}/launch | Launch | 422 if any blocking check fails. |
| GET /v1/survey?token= | Respondent instrument in chosen locale | Token only; 410 if expired or used. |
| PUT /v1/survey/response?token= | Save draft or submit | Constant-sum revalidation; unlink on submit; 409 on resubmission. |
| POST /v1/assessments/{id}/freeze | Freeze dataset | Consultant; window closed. |
| POST /v1/assessments/{id}/score | Run scoring | Idempotent; identical hash on re-run. |
| POST /v1/assessments/{id}/score/freeze | Freeze score object | Consultant. |
| GET /v1/assessments/{id}/segments?predicates= | Segment metrics | 409 “below reporting threshold”; query logged. |
| POST /v1/assessments/{id}/evaluate | Run rules engine | Returns findings, flags, scenarios. |
| GET /v1/assessments/{id}/findings | List findings | Filter by type, severity, orientation, segment. |
| POST /v1/assessments/{id}/plan | Generate priorities and draft actions | Returns priority zero, priorities, backlog. |
| POST /v1/reports · POST /v1/reports/{id}/narrative · POST /v1/reports/{id}/release | Draft, AI narrative, release | Release 422 if mandatory sections empty or AI text unaccepted. |
| GET /v1/reports/{id}/export?format=pdf│pptx│xlsx | Export released report | 403 for unreleased; never raw responses. |
| POST /v1/actions · PATCH /v1/actions/{id} | Create / update action or transition | 422 without finding; 409 illegal transition or open gate. |
| POST /v1/actions/{id}/kpi-readings · /evidence | Progress data | Evidence required before closure. |
| GET /v1/dashboards/{role} | Role dashboard | Scoped server-side. |
| GET · PUT /v1/engagements/{id}/scorecard · POST …/scorecard/import | Scorecard read, write and CSV / JSON import | Objectives, KPIs and readings; idempotent on external_ref (D-07). |
| GET /v1/engagements/{id}/scorecard/export | Scorecard and linked culture actions for a client system | JSON or CSV. |
| POST /v1/pulses | Create pulse | 422 if > 10 items or off watch-list. |
| GET /v1/trends?metric=&segment= | Cross-cycle trend | 409 across major version; warning across minor. |

### Sample: submit a scenario set with a wrong total

| PUT /v1/survey/response?token=… { "scenario_id": "D2-S1", "perspective": "NOW", "allocations": {"ENGAGE": 30, "INNOVATE": 30, "PERFORM": 30, "GOVERN": 20} }  HTTP/1.1 422 { "type": "https://cdp.pac.africa/problems/constant-sum", "code": "CONSTANT_SUM_VIOLATION",   "title": "Allocations must total exactly 100", "detail": "Received 110.", "scenario_id": "D2-S1" } |
| --- |

### Sample: suppressed segment

| GET /v1/assessments/asm_7f31/segments?predicates=department:dep_11,gender:F HTTP/1.1 409 { "code": "BELOW_REPORTING_THRESHOLD", "rule": "COMBINATION_FLOOR", "minimum": 5,   "rollup": { "segment": "department:dep_11", "label": "merged into Retail Banking" }, "query_id": "qry_5521" } |
| --- |

### Sample: publish blocked by an open gate

| PATCH /v1/actions/act_0130  { "status": "PUBLISHED" } HTTP/1.1 409 { "code": "BLOCKING_GATE_OPEN", "gate": "SHADOW_CULTURE", "orientation": "ENGAGE",   "precondition": "Perception-gap workshop (priority zero item P0-1)", "due": "2026-11-20" } |
| --- |

### Sample: evaluate response (abridged)

| POST /v1/assessments/asm_7f31/evaluate HTTP/1.1 200 { "rules_version": "2.0", "checks": {"C1": "MISS", "C2": "MISS", "C3": "SYSTEMIC_MISS", "C4": "PARTIAL_HIT"},   "blocking": ["SHADOW_CULTURE:ENGAGE", "SHADOW_CULTURE:GOVERN", "EOS:Q3", "EOS:Q6", "D8_LE_3"],   "scenarios": ["SC-05","SC-01","SC-10"], "findings_url": "/v1/assessments/asm_7f31/findings" } |
| --- |

# Appendix C  Item bank (version 1.1)

The item bank is seed data, loaded into item, scenario and scenario_statement for instrument version 1.1. Canonical language en-GB. Identifiers below are stable across versions; a change of meaning requires a new major version. The structured form of each record is:

| { "scenario_id": "D1-S1", "dimension": "D1", "sequence": 1, "title": "Organisational Character",   "prompt_now": "How would you describe the fundamental character of this organisation today?",   "prompt_preferred": "What fundamental character must this organisation have five years from now?",   "statements": [ {"statement_id": "D1-S1-E", "orientation": "ENGAGE", "text": "…"}, … ] } { "item_id": "D7-01", "block": "LIKERT", "dimension": "D7", "sequence": 1, "scale": "AGREE_1_5", "text": "…" } { "item_id": "EOS-Q1", "block": "EOS", "sequence": 1, "scale": "ZERO_TEN", "text": "…" } { "item_id": "L-A01", "block": "L360", "section": "A", "sequence": 1, "scale": "FREQ_1_5",   "text_self": "…", "text_rater": "…" } |
| --- |

## C.1  Culture scenarios (D1–D6)

Each scenario is answered twice. NOW instruction: “Distribute exactly 100 points across the four statements based on how closely each describes your organisation.” PREFERRED instruction: “…how closely each should describe your organisation five years from now.” The PREFERRED screen prefixes the prompt with “PREFERRED perspective:”.

**Table 108  ****Scenarios**

| **ID** | **Dimension** | **Scenario** | **NOW prompt** | **PREFERRED prompt** |
| --- | --- | --- | --- | --- |
| D1-S1 | D1 Cultural DNA | Organisational Character | How would you describe the fundamental character of this organisation today? | What fundamental character must this organisation have five years from now? |
| D1-S2 | D1 Cultural DNA | New Employee Experience | What do new employees consistently notice and remark upon within their first few weeks? | What should new employees notice and remark upon within their first few weeks in the future organisation? |
| D1-S3 | D1 Cultural DNA | Response to Adversity | How does this organisation characteristically respond when things go significantly wrong? | How should this organisation respond when things go significantly wrong in the future? |
| D2-S1 | D2 Leadership Blueprint | Primary Leadership Orientation | How would you best describe the dominant approach that leaders take in this organisation? | What dominant approach should leaders take in this organisation five years from now? |
| D2-S2 | D2 Leadership Blueprint | How Leaders Invest Their Time | How do leaders in this organisation characteristically spend their discretionary time and focused attention? | How should leaders spend their discretionary time and focused attention in the future organisation? |
| D2-S3 | D2 Leadership Blueprint | What Leaders Are Recognised For | What kinds of leadership contributions are most valued, celebrated, and emulated in this organisation? | What kinds of leadership contributions should be most valued, celebrated, and emulated in the future? |
| D3-S1 | D3 People Architecture | Core Management Philosophy | How would you characterise the dominant philosophy used to manage and direct people in this organisation? | What philosophy should dominate how people are managed and directed five years from now? |
| D3-S2 | D3 People Architecture | Development and Growth Approach | How does this organisation primarily develop, grow, and invest in the capabilities of its people? | How should this organisation develop, grow, and invest in the capabilities of its people in the future? |
| D3-S3 | D3 People Architecture | Performance Conversation Style | How are performance conversations and feedback primarily conducted within this organisation? | How should performance conversations and feedback be conducted in the future organisation? |
| D4-S1 | D4 Cohesion Drivers | Primary Bonding Mechanism | What most fundamentally holds this organisation together and creates a coherent collective identity? | What should most fundamentally hold this organisation together and create a coherent collective identity in the future? |
| D4-S2 | D4 Cohesion Drivers | What Makes People Stay | What is the primary reason that people decide to remain in this organisation over the long term? | What should be the primary reason people decide to remain in this organisation over the long term? |
| D4-S3 | D4 Cohesion Drivers | Identity Through Change | How does this organisation maintain a coherent sense of identity when going through significant change? | How should this organisation maintain a coherent sense of identity through significant change in the future? |
| D5-S1 | D5 Strategic Compass | Primary Strategic Orientation | What is the most prominent orientation guiding how this organisation approaches strategy? | What orientation should be most prominent in how this organisation approaches strategy five years from now? |
| D5-S2 | D5 Strategic Compass | Budget and Resource Allocation Logic | When resources are allocated in this organisation, what consistently and reliably receives strategic priority? | When resources are allocated in the future, what should consistently and reliably receive strategic priority? |
| D5-S3 | D5 Strategic Compass | Long-Term Investment Philosophy | What investment logic most characteristically reflects how this organisation thinks about the next five years? | What investment logic should characterise how this organisation thinks about the next five years? |
| D6-S1 | D6 Victory Conditions | Organisational Success Definition | How does this organisation primarily define and articulate what success means for it? | How should this organisation define and articulate what success means for it in the future? |
| D6-S2 | D6 Victory Conditions | What Gets Celebrated | What types of achievements and behaviours are most enthusiastically recognised and celebrated here? | What types of achievements and behaviours should be most enthusiastically recognised and celebrated in the future? |
| D6-S3 | D6 Victory Conditions | Performance Measurement Philosophy | What types of metrics and measures most fundamentally reflect how this organisation tracks its performance? | What types of metrics and measures should most fundamentally reflect how this organisation tracks performance five years from now? |

**Table 109  ****Scenario statements (72)**

| **Statement ID** | **Orientation** | **Text (identical for NOW and PREFERRED)** |
| --- | --- | --- |
| D1-S1-E | ENGAGE | This organisation is fundamentally a people-centred community. Deep relationships, mutual care, and shared purpose define daily experience. People invest in one another as whole human beings, not merely as role-holders or performance units. |
| D1-S1-I | INNOVATE | This organisation is fundamentally an ideas engine. Bold experimentation, creative disruption, and the freedom to challenge convention define who we are. We move fast and prize originality over conformity at every level. |
| D1-S1-P | PERFORM | This organisation is fundamentally a performance machine. Ambitious goals, relentless execution, and measurable outcomes define us. We compete hard, celebrate achievement loudly, and hold ourselves to exacting standards. |
| D1-S1-G | GOVERN | This organisation is fundamentally a system of order. Clear structures, defined processes, and consistent standards define how we work. We value precision, reliability, and systematic discipline above improvisation. |
| D1-S2-E | ENGAGE | New employees immediately notice the warmth and genuine inclusion. Colleagues go out of their way to welcome them, offer proactive support, and make them feel part of something that transcends any single role or task. |
| D1-S2-I | INNOVATE | New employees immediately notice the energy and creative freedom. They are quickly encouraged to question existing approaches, propose ideas boldly, and take ownership of challenges without waiting for permission. |
| D1-S2-P | PERFORM | New employees immediately notice the pace and the performance expectations. They quickly understand that results matter, targets are taken seriously, and strong delivery is expected and closely observed from the very first week. |
| D1-S2-G | GOVERN | New employees immediately notice the structure and operational clarity. There are established ways of doing things, clear reporting lines, and thoroughly documented expectations for every level and function across the organisation. |
| D1-S3-E | ENGAGE | When things go seriously wrong, we rally together as a community. People offer genuine support, share the burden collectively, and focus on protecting team morale while communicating openly and looking after each other through difficulty. |
| D1-S3-I | INNOVATE | When things go seriously wrong, we treat it as essential learning. We diagnose rapidly, experiment with recovery approaches, and view failure as data that makes us smarter, not as a signal to blame, retreat, or become more risk-averse. |
| D1-S3-P | PERFORM | When things go seriously wrong, we focus intensely on getting back on track. We define the performance gap, set clear recovery targets, and expect everyone to work urgently and accountably until performance standards are restored. |
| D1-S3-G | GOVERN | When things go seriously wrong, we follow the established protocol. We activate risk management procedures, document accurately what occurred, and ensure that proper escalation and accountability channels are adhered to without exception. |
| D2-S1-E | ENGAGE | Leaders are primarily coaches and mentors. They prioritise development conversations, team cohesion, and creating environments where people feel genuinely seen, valued, and supported in their professional and personal growth. |
| D2-S1-I | INNOVATE | Leaders are primarily visionaries and champions of change. They set ambitious directions, encourage unconventional thinking, and give people genuine autonomy to experiment and find solutions that have never been tried before. |
| D2-S1-P | PERFORM | Leaders are primarily drivers and scorekeepers. They establish challenging targets, track performance rigorously, and hold people firmly to clear standards of measurable output, delivery, and commercial contribution. |
| D2-S1-G | GOVERN | Leaders are primarily architects and stewards of process. They design efficient operating systems, maintain quality and consistency across operations, and preserve clear accountability structures throughout the organisation. |
| D2-S2-E | ENGAGE | Leaders invest significant time in coaching conversations, structured listening sessions, team cohesion activities, and ensuring that the human dimensions of work are not neglected or subordinated to performance pressure alone. |
| D2-S2-I | INNOVATE | Leaders invest significant time scanning emerging trends, incubating new initiatives, removing barriers to experimentation, and personally sponsoring projects that challenge existing assumptions and inherited approaches. |
| D2-S2-P | PERFORM | Leaders invest significant time reviewing performance data, calibrating against targets, eliminating execution bottlenecks, and actively pushing for consistently higher performance standards and outcomes across all functions. |
| D2-S2-G | GOVERN | Leaders invest significant time in systems improvement, process design, compliance management, and ensuring that operational quality and established standards are consistently upheld and improved across all areas. |
| D2-S3-E | ENGAGE | Leaders are most celebrated for developing others, building deeply motivated and cohesive teams, handling difficult human situations with genuine wisdom and care, and creating authentic belonging within their areas of responsibility. |
| D2-S3-I | INNOVATE | Leaders are most celebrated for inspiring new thinking, launching bold initiatives ahead of market demands, championing change before it is explicitly required, and consistently unlocking the creative potential of the people around them. |
| D2-S3-P | PERFORM | Leaders are most celebrated for delivering outstanding results, consistently exceeding targets, building elite-performing teams, and generating measurable commercial or operational wins that materially advance the organisation's position. |
| D2-S3-G | GOVERN | Leaders are most celebrated for building reliable and efficient systems, preventing costly problems before they arise, and maintaining consistent quality and compliance standards rigorously across their areas of responsibility. |
| D3-S1-E | ENGAGE | Employees are managed through relationship and meaningful participation. Managers prioritise collaborative decision-making, seek genuine team consensus, and ensure that all members have voice in matters that directly affect their daily work. |
| D3-S1-I | INNOVATE | Employees are managed through autonomy and creative challenge. Managers provide generous space for independent thinking, tolerate productive failure as a natural element of learning, and actively reward intellectual initiative and experimentation. |
| D3-S1-P | PERFORM | Employees are managed through clear targets and firm accountability. Managers set demanding performance expectations, track progress against measurable goals rigorously, and hold people to consistently high standards of delivery. |
| D3-S1-G | GOVERN | Employees are managed through defined roles and established procedures. Managers ensure people understand their responsibilities clearly, adhere to documented protocols consistently, and perform within their designated remit reliably. |
| D3-S2-E | ENGAGE | Development is relationship-led. The most valued growth experiences are mentoring relationships, peer learning circles, team-based stretch projects, and the opportunity to develop alongside trusted, respected, and more experienced colleagues. |
| D3-S2-I | INNOVATE | Development is discovery-led. The most valued experiences include stretch assignments beyond comfort zones, cross-functional exposure, experimentation with new approaches, and regular access to cutting-edge external thinking and innovation. |
| D3-S2-P | PERFORM | Development is results-led. The most valued experiences are high-stakes projects with real accountability, performance coaching under meaningful pressure, visible delivery moments, and fast-track advancement for consistently strong performers. |
| D3-S2-G | GOVERN | Development is competency-led. The most valued experiences are structured technical training programmes, professional certification, methodical skill-building against defined competency frameworks, and clear progression milestones with specified criteria. |
| D3-S3-E | ENGAGE | Performance conversations are primarily supportive and developmental in tone. Feedback is delivered within a context of genuine care for the person, and performance challenges are met with coaching support and encouragement rather than pressure or sanction. |
| D3-S3-I | INNOVATE | Performance conversations are primarily exploratory and future-oriented. The primary focus is on learning from experience, adapting approaches, and identifying the next bold challenge to pursue, rather than dwelling at length on past shortfalls. |
| D3-S3-P | PERFORM | Performance conversations are primarily candid and accountability-driven. Honest feedback is delivered directly and without excessive softening, underperformance is named clearly, and improvement expectations are specific, measurable, and time-bound. |
| D3-S3-G | GOVERN | Performance conversations are primarily structured and standards-based. Reviews follow a consistent and documented format, are benchmarked against defined competency frameworks, and result in recorded development plans with measurable milestones. |
| D4-S1-E | ENGAGE | What holds this organisation together is the quality of our relationships. Loyalty, mutual respect, and genuine care for each other create bonds that survive difficult periods, leadership transitions, and sustained external pressure. |
| D4-S1-I | INNOVATE | What holds this organisation together is our shared hunger for what is possible. A collective excitement about the new, the untried, and the transformative creates enduring unity and common purpose across all functions and hierarchical levels. |
| D4-S1-P | PERFORM | What holds this organisation together is our shared competitive drive. A collective commitment to winning, outperforming others, and delivering ambitious results creates a unifying force and common identity across all divisions. |
| D4-S1-G | GOVERN | What holds this organisation together is adherence to shared systems and standards. Common processes, clearly defined policies, and consistent expectations create a unifying operational framework that guides and aligns collective behaviour. |
| D4-S2-E | ENGAGE | People remain primarily because of the depth of relationships and genuine sense of belonging they experience here. The quality of their human connections (with colleagues, managers, and teams) is the decisive factor in their decision to stay. |
| D4-S2-I | INNOVATE | People remain primarily because of the intellectual stimulation and growth the organisation continuously provides. The opportunity to work on genuinely novel problems, learn continuously, and pioneer meaningful solutions is the decisive retention factor. |
| D4-S2-P | PERFORM | People remain primarily because of the high-performance culture and the compelling career trajectory it enables. The chance to achieve at a high level, advance rapidly, and be recognised for exceptional contribution keeps strong performers committed over time. |
| D4-S2-G | GOVERN | People remain primarily because of the stability, security, and predictability the organisation dependably provides. Clear expectations, reliable processes, and predictable career progression create a sense of institutional safety that sustains long-term loyalty. |
| D4-S3-E | ENGAGE | During significant change, the organisation anchors to its people-first values. Preserving trust, ensuring that no one is left behind, and maintaining relational continuity are the non-negotiable constants through any period of disruption or transformation. |
| D4-S3-I | INNOVATE | During significant change, the organisation maintains identity through its appetite for reinvention. Change is not experienced as a threat but as a natural expression of who we are; agility and continuous adaptation are our defining cultural constants. |
| D4-S3-P | PERFORM | During significant change, the organisation maintains identity through its performance orientation. The goal-driven culture and competitive spirit remain consistent and recognisable regardless of what is structurally changing around and beneath them. |
| D4-S3-G | GOVERN | During significant change, the organisation maintains identity through structural discipline. Established processes provide institutional continuity, and well-documented protocols ensure operational consistency and predictability despite external disruption. |
| D5-S1-E | ENGAGE | Our strategy is oriented primarily toward human capital excellence. We believe that investing deeply in people (their skills, wellbeing, engagement, and development) is the most reliable and sustainable route to long-term organisational performance. |
| D5-S1-I | INNOVATE | Our strategy is oriented primarily toward future opportunity and emerging capability. We invest ahead of where the market is moving, acquire leading capabilities early, and consistently prioritise positioning for what comes next over optimising what already exists. |
| D5-S1-P | PERFORM | Our strategy is oriented primarily toward market leadership and sustained commercial excellence. We invest in capabilities that strengthen our competitive position, grow our revenue base, and deliver consistently superior returns to stakeholders. |
| D5-S1-G | GOVERN | Our strategy is oriented primarily toward operational excellence and scalable efficiency. We invest in process improvement, quality management systems, enterprise risk reduction, and the infrastructure required to grow without compromising standards. |
| D5-S2-E | ENGAGE | People programmes receive consistent strategic priority. Learning and development budgets, employee experience investments, wellbeing programmes, and engagement initiatives are treated as core strategic expenditures, not discretionary or deferrable costs. |
| D5-S2-I | INNOVATE | Innovation and growth programmes receive consistent strategic priority. Research and development, new capability investment, technology pilots, and market exploration are protected, including during periods of financial constraint and competitive pressure. |
| D5-S2-P | PERFORM | Revenue-generating and commercial activities receive consistent strategic priority. Sales capability, marketing investment, customer acquisition, and performance management infrastructure are the primary beneficiaries of resource decisions. |
| D5-S2-G | GOVERN | Systems infrastructure and compliance receive consistent strategic priority. Technology investment, process re-engineering, audit readiness, quality management, and institutional risk infrastructure are treated as non-negotiable operational foundations. |
| D5-S3-E | ENGAGE | Over a five-year horizon, we prioritise culture-building, employer brand strength, and talent pipeline development. We believe that an organisation with genuinely outstanding people practices will consistently outperform across any market or economic condition. |
| D5-S3-I | INNOVATE | Over a five-year horizon, we prioritise positioning at the frontier of our industry. Early investments in emerging technology, unconventional business models, and frontier approaches are how we intend to create and sustain durable competitive leadership. |
| D5-S3-P | PERFORM | Over a five-year horizon, we prioritise sustained commercial outperformance and market expansion. We set progressively demanding performance targets and build the execution capabilities required to consistently deliver against them at scale. |
| D5-S3-G | GOVERN | Over a five-year horizon, we prioritise building reliable, scalable operating systems and institutional resilience. We invest in the infrastructure, standards, and process discipline required to deliver consistent excellence as the organisation scales. |
| D6-S1-E | ENGAGE | Success means that our people genuinely thrive. A highly engaged workforce, low voluntary turnover, outstanding employee experience scores, and leaders who invest consistently in developing others are the defining measures of our success as an organisation. |
| D6-S1-I | INNOVATE | Success means that we lead our industry in originality and adaptive capability. Being consistently first with genuinely novel solutions, achieving recognition as pioneers and thought leaders, and building an innovation reputation that attracts exceptional talent define our success. |
| D6-S1-P | PERFORM | Success means that we win commercially and outpace competition. Revenue growth, market share gains, consistent outperformance of competitors, and delivering superior returns to our stakeholders are the primary definitions of what success means here. |
| D6-S1-G | GOVERN | Success means that we operate with systemic excellence. Consistent quality at scale, zero material compliance failures, efficient and reliable process execution, and dependable delivery within agreed cost and timeline parameters define success for us. |
| D6-S2-E | ENGAGE | Genuine teamwork, remarkable acts of care, and outstanding cross-functional collaboration are celebrated most enthusiastically. Recognition focuses equally on collective achievement and individual contribution, and stories of human connection carry significant cultural status. |
| D6-S2-I | INNOVATE | Breakthrough thinking, bold experiments, and the intellectual courage to attempt something genuinely new are celebrated most enthusiastically, regardless of whether every experiment ultimately succeeds or falls short of initial ambitions. |
| D6-S2-P | PERFORM | Exceptional commercial results, ambitious targets exceeded, and elite individual and team performance are celebrated most enthusiastically. Numbers, competitive rankings, and tangible organisational wins carry enduring and significant cultural status. |
| D6-S2-G | GOVERN | Flawless execution, consistently excellent quality, clean audit and compliance outcomes, and the sustained discipline to maintain high standards under operational pressure are what this organisation celebrates most enthusiastically and publicly. |
| D6-S3-E | ENGAGE | We track success by the health and vitality of our people and their working relationships. Employee engagement scores, voluntary retention rates, team health indices, developmental feedback quality, and wellbeing indicators are the measures that carry the most weight here. |
| D6-S3-I | INNOVATE | We track success by the vibrancy of our innovation pipeline and our rate of institutional learning. Speed of new initiative generation, successful pilot conversions, adoption velocity of new approaches, and experimentation frequency are the metrics we prioritise. |
| D6-S3-P | PERFORM | We track success through rigorous commercial and operational KPIs. Revenue targets, margin ratios, market share data, customer acquisition metrics, and competitive positioning indicators are the primary performance measures we report upon and act on. |
| D6-S3-G | GOVERN | We track success through quality, compliance, and operational efficiency metrics. Error rates, compliance scores, service-level adherence rates, process efficiency ratios, and audit outcomes are the foundational measures of our effectiveness as an organisation. |

## C.2  Readiness items (D7–D9)

Scale AGREE_1_5: 1 Strongly disagree · 2 Disagree · 3 Neutral · 4 Agree · 5 Strongly agree. Instruction: “Rate each statement based on the organisation as a whole.”

**Table 110  ****D7–D9 items (36)**

| **Item ID** | **Dimension** | **Text** |
| --- | --- | --- |
| D7-01 | Digital Readiness | Our organisation actively encourages adoption of new digital tools and technologies to improve how work is designed and executed. |
| D7-02 | Digital Readiness | When new technology is introduced, most employees approach it with genuine curiosity and openness rather than resistance and avoidance. |
| D7-03 | Digital Readiness | Senior leaders visibly model the use of digital tools and data-driven approaches in their own daily ways of working and communicating. |
| D7-04 | Digital Readiness | Important business decisions are regularly and meaningfully informed by data analytics and digital insights, not solely by experience, intuition, or hierarchy. |
| D7-05 | Digital Readiness | Meaningful and ongoing investment is made in digital skills development at all organisational levels, not only for technically designated staff. |
| D7-06 | Digital Readiness | Employees feel genuinely confident suggesting technology-based improvements to existing processes and workflows without fear of their ideas being dismissed. |
| D7-07 | Digital Readiness | This organisation has a clear, communicated, and actionable digital strategy that employees at all levels understand and can connect to their daily responsibilities. |
| D7-08 | Digital Readiness | Digital transformation initiatives are actively sponsored and visibly championed at the executive level, not simply delegated to and managed within the IT function. |
| D7-09 | Digital Readiness | Before full organisational deployment, new digital approaches are regularly piloted at a smaller scale, creating structured space for learning, iteration, and improvement. |
| D7-10 | Digital Readiness | Failure in a digital experiment is consistently treated as a valuable learning opportunity and a sign of healthy risk-taking rather than a cause for blame or punitive accountability. |
| D7-11 | Digital Readiness | Cross-functional collaboration on digital projects happens naturally, proactively, and with minimal bureaucratic friction in this organisation. |
| D7-12 | Digital Readiness | Our workforce collectively possesses the digital literacy required to perform effectively in current roles and to adapt with reasonable ease to tomorrow's evolving digital requirements. |
| D8-01 | Psychological Safety | In this organisation, it is genuinely safe to take a reasonable professional or interpersonal risk, even when the outcome of that risk is genuinely uncertain. |
| D8-02 | Psychological Safety | People in this organisation can raise problems, surface concerns, and speak uncomfortable truths without realistic fear of negative consequences for their standing or career. |
| D8-03 | Psychological Safety | When mistakes occur in this organisation, they are approached as opportunities for collective learning and systemic improvement rather than as occasions for individual blame or shame. |
| D8-04 | Psychological Safety | Asking colleagues or managers for assistance (regardless of seniority or reporting-line relationships) is seen here as a sign of mature collaboration, not as personal weakness. |
| D8-05 | Psychological Safety | People here feel genuinely comfortable challenging decisions, plans, perspectives, or assumptions, including those expressed or endorsed by senior and executive leaders. |
| D8-06 | Psychological Safety | Diverse, dissenting, and unconventional viewpoints are actively sought out, carefully considered, and meaningfully incorporated when important organisational decisions are being made. |
| D8-07 | Psychological Safety | I can bring my authentic perspective and full identity to work in this organisation without needing to mask, suppress, or edit who I am or how I genuinely think. |
| D8-08 | Psychological Safety | Concerns about ethical issues, unfair treatment, unsafe practices, or value conflicts can be raised in this organisation without realistic fear of retaliation, marginalisation, or exclusion. |
| D8-09 | Psychological Safety | When a person sincerely disagrees with a decision that has been made, they are able to express that disagreement openly and directly without it damaging their professional standing or relationships. |
| D8-10 | Psychological Safety | This organisation's culture does not pressure people to perform certainty, project false confidence, or pretend they fully understand things they do not actually understand. |
| D8-11 | Psychological Safety | People in positions of authority in this organisation actively, visibly, and consistently invite challenge, productive dissent, and critical questioning rather than implicitly discouraging it. |
| D8-12 | Psychological Safety | Failures, setbacks, and near-miss incidents are discussed openly and constructively in this organisation so that collective learning occurs and avoidable mistakes are not repeated. |
| D9-01 | Adaptive Capacity | Leadership communicates clearly, consistently, and with genuine transparency about the purpose, rationale, and expected impacts of significant organisational changes. |
| D9-02 | Adaptive Capacity | Employees feel genuinely heard, acknowledged, and meaningfully considered when they raise concerns, questions, or reservations about planned changes and strategic directions. |
| D9-03 | Adaptive Capacity | There is a compelling, specific, and widely understood organisational vision for where this organisation is heading and the reasoning behind that direction. |
| D9-04 | Adaptive Capacity | Adequate and well-planned resources (including time, budget, and appropriately skilled people) are allocated to support major change and transformation initiatives. |
| D9-05 | Adaptive Capacity | Middle managers in this organisation actively champion, personally embody, and consistently role-model the changes that senior leadership is formally requesting. |
| D9-06 | Adaptive Capacity | When this organisation has undertaken significant transformation or change efforts in the past, it has generally followed through with sufficient discipline, sustained commitment, and visible results. |
| D9-07 | Adaptive Capacity | Effective feedback mechanisms exist that allow employees at all levels to share their honest views on how change is actually unfolding, and to have confidence those views are genuinely considered. |
| D9-08 | Adaptive Capacity | This organisation actively recognises, rewards, and publicly celebrates behaviours and outcomes that demonstrably align with its stated strategic direction and desired cultural values. |
| D9-09 | Adaptive Capacity | This organisation is able to sustain meaningful change momentum over a 12 to 24 month period without significant energy loss, widespread confusion, or visible reversion to previous patterns. |
| D9-10 | Adaptive Capacity | Employees at all levels understand concretely and specifically what new behaviours, priorities, and ways of working are expected of them during significant transformation efforts. |
| D9-11 | Adaptive Capacity | This organisation systematically and deliberately learns from past change efforts (both successes and instructive failures) and actively applies those lessons to subsequent transformation initiatives. |
| D9-12 | Adaptive Capacity | The pace, sequencing, and communication of change in this organisation feels coherent and manageable rather than chaotic, exhausting, poorly planned, or inadequately supported. |

## C.3  eOS, qualitative and consent items

**Table 111  ****eOS items (8)**

| **Item ID** | **Category** | **Text (scale ZERO_TEN: 0 not at all / completely negative · 10 extremely / completely positive)** |
| --- | --- | --- |
| EOS-Q1 | Recommend as a great place to work | How likely would you be to recommend this organisation as a genuinely great place to work to a trusted friend or valued colleague? |
| EOS-Q2 | Quality of leadership | How would you rate the overall quality and effectiveness of leadership at all levels in this organisation? |
| EOS-Q3 | Commitment to innovation | How would you rate this organisation's commitment to genuine innovation, creative risk-taking, and trying new approaches? |
| EOS-Q4 | Development and career growth | How satisfied are you with the quality and accessibility of professional development and career growth opportunities available to you? |
| EOS-Q5 | Transparency of communication | How would you rate the transparency, openness, and quality of communication from organisational leadership? |
| EOS-Q6 | Work-life integration and wellbeing | How would you rate this organisation's tangible support for healthy work-life integration and genuine employee wellbeing? |
| EOS-Q7 | Inclusion, fairness and equity | How inclusive, fair, and equitable is this workplace in its treatment of people from all backgrounds, identities, and perspectives? |
| EOS-Q8 | Strategy translated into daily purpose | How effectively does this organisation's strategy and direction translate into clarity, meaning, and purpose in your day-to-day work? |

**Table 112  ****Qualitative items (3)**

| **Item ID** | **Title** | **Text (free text, optional, 2,000 characters)** |
| --- | --- | --- |
| QUAL-Q1 | Culture Strengths | What are the greatest STRENGTHS of this organisation's culture? What specific aspects of how things are done here make you proud to be part of this organisation? Please give concrete examples wherever possible. |
| QUAL-Q2 | Culture Challenges | What are the most significant CHALLENGES in how things are done here? What specific cultural patterns, behaviours, or organisational norms frustrate you most? What gets in the way of the organisation being at its best? |
| QUAL-Q3 | The One Change | If you could change ONE thing about how this organisation operates (one cultural pattern, behavioural norm, structural feature, or leadership practice), what would it be, and why would that single change have the greatest impact? |

## C.4  Leadership 360 items

Scale FREQ_1_5: 1 Never / Strongly disagree · 2 Seldom / Disagree · 3 Sometimes / Neutral · 4 Often / Agree · 5 Always / Strongly agree. Rater form: blank = NOT_OBSERVED. Sections: A ENGAGE, B INNOVATE, C PERFORM, D GOVERN (10 items each); E Integrity, values and standards; F Psychological safety and communication; G Strategy, data and digital; H Leading change and adaptive capacity (5 items each).

**Table 113  ****Leadership 360 items (60)**

| **Item ID** | **Sec.** | **Self form** | **Rater form** |
| --- | --- | --- | --- |
| L-A01 | A | I invest significant time in mentoring and developing my direct reports. | This leader invests significant time in mentoring and developing direct reports. |
| L-A02 | A | I prioritise team cohesion and consensus-building over individual speed. | This leader prioritises team cohesion and consensus-building over individual speed. |
| L-A03 | A | I actively work to resolve interpersonal conflicts and preserve a supportive team environment. | This leader actively works to resolve interpersonal conflicts and preserve a supportive team environment. |
| L-A04 | A | I treat my team members with empathy and value them as members of the organisation. | This leader treats team members with empathy and values them as members of the organisation. |
| L-A05 | A | I include everyone fairly and make sure all voices in my team are heard, regardless of role or background. | This leader includes everyone fairly and makes sure all voices in the team are heard, regardless of role or background. |
| L-A06 | A | I recognise and celebrate team achievements, effort, and individual contributions. | This leader recognises and celebrates team achievements, effort, and individual contributions. |
| L-A07 | A | I actively invest in the long-term career growth and well-being of each team member. | This leader actively invests in the long-term career growth and well-being of each team member. |
| L-A08 | A | I seek input from my team before making decisions that materially affect them. | This leader seeks input from the team before making decisions that materially affect them. |
| L-A09 | A | I make myself available to listen to both professional and personal concerns. | This leader makes themselves available to listen to both professional and personal concerns. |
| L-A10 | A | I build trust through consistent follow-through on the commitments I make to my team. | This leader builds trust through consistent follow-through on commitments made to the team. |
| L-B11 | B | I encourage my team to take calculated risks, even when some attempts may fail. | This leader encourages the team to take calculated risks, even when some attempts may fail. |
| L-B12 | B | I continuously scan the market for emerging trends, technologies, and customer needs. | This leader continuously scans the market for emerging trends, technologies, and customer needs. |
| L-B13 | B | I prefer flexible, non-linear approaches to solving complex business problems. | This leader prefers flexible, non-linear approaches to solving complex business problems. |
| L-B14 | B | I thrive in ambiguity and can pivot quickly when conditions change. | This leader thrives in ambiguity and pivots quickly when conditions change. |
| L-B15 | B | I champion new product ideas, distribution models, and service innovations. | This leader champions new product ideas, distribution models, and service innovations. |
| L-B16 | B | I challenge “the way we have always done it” thinking within my team. | This leader challenges “the way we have always done it” thinking within the team. |
| L-B17 | B | I allocate time, budget, and resources for experimentation and pilots. | This leader allocates time, budget, and resources for experimentation and pilots. |
| L-B18 | B | I articulate a compelling future vision for my function that energises the team. | This leader articulates a compelling future vision that energises the team. |
| L-B19 | B | I stay informed about new technology, digital transformation, and disruption in the sector. | This leader stays informed about new technology, digital transformation, and disruption in the sector. |
| L-B20 | B | I treat setbacks and failed experiments as opportunities to learn and iterate. | This leader treats setbacks and failed experiments as opportunities to learn and iterate. |
| L-C21 | C | I define success primarily by meeting or exceeding KPIs, targets, and financial goals. | This leader defines success primarily by meeting or exceeding KPIs, targets, and financial goals. |
| L-C22 | C | I push my team to outperform our competitors in the market. | This leader pushes the team to outperform competitors in the market. |
| L-C23 | C | I am comfortable being demanding to ensure deliverables are completed on time and to standard. | This leader is comfortable being demanding to ensure deliverables are completed on time and to standard. |
| L-C24 | C | I stay close to customers and the market, tracking customer feedback, competitor moves and performance benchmarks. | This leader stays close to customers and the market, tracking customer feedback, competitor moves and performance benchmarks. |
| L-C25 | C | I set stretch goals that raise the performance bar for my unit. | This leader sets stretch goals that raise the performance bar for the unit. |
| L-C26 | C | I hold my team rigorously accountable for results and the consequences of missed targets. | This leader holds the team rigorously accountable for results and the consequences of missed targets. |
| L-C27 | C | I make tough decisions quickly when performance is lagging. | This leader makes tough decisions quickly when performance is lagging. |
| L-C28 | C | I prioritise speed to market when launching new products, services, or campaigns. | This leader prioritises speed to market when launching new products, services, or campaigns. |
| L-C29 | C | I communicate a clear sense of urgency and competitive intensity in my team. | This leader communicates a clear sense of urgency and competitive intensity in the team. |
| L-C30 | C | I translate wins into visible momentum that drives the next target. | This leader translates wins into visible momentum that drives the next target. |
| L-D31 | D | I ensure every process in my area follows established SOPs and regulatory requirements. | This leader ensures every process in their area follows established SOPs and regulatory requirements. |
| L-D32 | D | I believe clear reporting lines, roles, and structure are essential to success. | This leader believes clear reporting lines, roles, and structure are essential to success. |
| L-D33 | D | I focus on technical accuracy and minimising errors in core operations, transactions, and client documentation. | This leader focuses on technical accuracy and minimising errors in core operations, transactions, and client documentation. |
| L-D34 | D | I prefer predictable, proven outcomes over experimental approaches for core operations. | This leader prefers predictable, proven outcomes over experimental approaches for core operations. |
| L-D35 | D | I track internal metrics, dashboards, and performance reports with discipline. | This leader tracks internal metrics, dashboards, and performance reports with discipline. |
| L-D36 | D | I document decisions, processes, and lessons learned for institutional memory. | This leader documents decisions, processes, and lessons learned for institutional memory. |
| L-D37 | D | I enforce adherence to internal controls, audit standards, and company policy. | This leader enforces adherence to internal controls, audit standards, and company policy. |
| L-D38 | D | I plan meticulously and manage resources within approved budgets. | This leader plans meticulously and manages resources within approved budgets. |
| L-D39 | D | I standardise workflows to ensure consistent service quality across teams. | This leader standardises workflows to ensure consistent service quality across teams. |
| L-D40 | D | I minimise operational risk through careful, methodical execution. | This leader minimises operational risk through careful, methodical execution. |
| L-E41 | E | I conduct my work with transparency, honesty, and the highest ethical standards. | This leader conducts their work with transparency, honesty, and the highest ethical standards. |
| L-E42 | E | I ensure customers, clients or beneficiaries are treated fairly and receive services that genuinely meet their needs. | This leader ensures customers, clients or beneficiaries are treated fairly and receive services that genuinely meet their needs. |
| L-E43 | E | I consistently model the organisation’s core values in my decisions and behaviour. | This leader consistently models the organisation’s core values in their decisions and behaviour. |
| L-E44 | E | I address unethical behaviour in my team promptly and firmly, regardless of performance record. | This leader addresses unethical behaviour in the team promptly and firmly, regardless of performance record. |
| L-E45 | E | I safeguard confidential information and proactively manage conduct, compliance and reputational risk. | This leader safeguards confidential information and proactively manages conduct, compliance and reputational risk. |
| L-F46 | F | I communicate expectations, change, and strategic direction clearly to my team. | This leader communicates expectations, change, and strategic direction clearly to the team. |
| L-F47 | F | I actively invite challenge and dissenting views and respond without defensiveness or penalty. | This leader actively invites challenge and dissenting views and responds without defensiveness or penalty. |
| L-F48 | F | I listen actively and demonstrate that I have understood the other party’s position before responding. | This leader listens actively and demonstrates understanding of the other party’s position before responding. |
| L-F49 | F | I give timely, specific, and constructive feedback, both positive and developmental. | This leader gives timely, specific, and constructive feedback, both positive and developmental. |
| L-F50 | F | I openly admit my own mistakes and treat others’ mistakes as opportunities to learn rather than to blame. | This leader openly admits their own mistakes and treats others’ mistakes as opportunities to learn rather than to blame. |
| L-G51 | G | I align my team’s priorities with the organisation’s strategy and explain how each person’s work contributes to it. | This leader aligns the team’s priorities with the organisation’s strategy and explains how each person’s work contributes to it. |
| L-G52 | G | I demonstrate a strong grasp of the organisation’s business or operating model: its key revenue or funding drivers, cost structure, and the metrics that matter most. | This leader demonstrates a strong grasp of the organisation’s business or operating model: its key revenue or funding drivers, cost structure, and the metrics that matter most. |
| L-G53 | G | I anticipate how market, regulatory, economic, technological and social changes will affect the organisation. | This leader anticipates how market, regulatory, economic, technological and social changes will affect the organisation. |
| L-G54 | G | I make data-informed decisions rather than relying solely on intuition or hierarchy. | This leader makes data-informed decisions rather than relying solely on intuition or hierarchy. |
| L-G55 | G | I actively sponsor the adoption of digital tools and new ways of working in my team, rather than leaving it to the IT function. | This leader actively sponsors the adoption of digital tools and new ways of working in the team, rather than leaving it to the IT function. |
| L-H56 | H | I explain concretely what new behaviours, priorities and ways of working are expected during change. | This leader explains concretely what new behaviours, priorities and ways of working are expected during change. |
| L-H57 | H | I secure adequate time, budget and skilled people before launching major change. | This leader secures adequate time, budget and skilled people before launching major change. |
| L-H58 | H | I sustain momentum and follow through on change initiatives until results are visible. | This leader sustains momentum and follows through on change initiatives until results are visible. |
| L-H59 | H | I systematically apply lessons from past change efforts, both successes and failures, to new initiatives. | This leader systematically applies lessons from past change efforts, both successes and failures, to new initiatives. |
| L-H60 | H | I balance short-term delivery pressure with long-term investment in people, capability and strategy. | This leader balances short-term delivery pressure with long-term investment in people, capability and strategy. |

Open questions: six self-reflection questions (self form) and seven qualitative feedback questions (rater form), carried verbatim from the Leadership 360 forms v1.1 and stored as leader_text question codes S-Q1…S-Q6 and R-Q1…R-Q7. They are analysed thematically and never scored.

# Appendix D  Formula library and unit tests

Reference implementation in language-neutral pseudo-code. All arithmetic is fixed-point decimal with ROUND_HALF_UP. Function names are the names to use in code and tests.

| # ---------- culture ---------- orientation_score(o, p, c) = Σ alloc(r,d,s,p,o) for r∈c, d∈D1..D6, s∈S1..S3 ÷ (18·│c│)             → 2 dp dimension_score(d, o, p, c) = Σ alloc(r,d,s,p,o) for r∈c, s∈S1..S3 ÷ (3·│c│)                     → 2 dp gap(o)               = orientation_score(o, PREFERRED) − orientation_score(o, NOW)                 → 2 dp classify(g)          = BUILD if g ≥ 8 · STRENGTHEN if g ≥ 4 · KEEP_AND_PROTECT if g > −4 · MODERATE significant(g)       = │g│ ≥ 8 dominant(profile)    = argmax; shared if top two differ by < 1.0 culture_strength     = max(NOW) − 25 congruence_count     = #{d ∈ D1..D6 : dominant(NOW_d) ∋ dominant(NOW)} lens(L)              = mean(dimension_score over L's dimensions)        # STRATEGY D5,D6 · PRACTICE D1,D3,D4 · LEADERSHIP D2 # ---------- readiness and voice ---------- likert_dimension(D)  = mean over r of mean(answered items of D for r), r needs ≥ 9 answered     → 4 dp; band on 1 dp eos_category(q)      = round(100·(#v≥9 − #v≤6) ÷ #valid, 0) eos_index            = round(mean(eos_category(Q1..Q8)), 1) # ---------- leadership ---------- section_avg(x, rater)= mean(observed items) if observed ≥ 60% of items else EXCLUDED other_avg(x)         = mean(group_avg(x, g) for published groups) LRI                  = 0.35·other_avg(H) + 0.30·other_avg(F) + 0.20·other_avg(target section) + 0.15·other_avg(G) coverage             = Σ headcount_led(valid) ÷ Σ headcount_led(in scope) LA_instrument        = 1 + 4·min(1, D2_NOW[target] ÷ T_single(target)) leadership_alignment = coverage·LRI_weighted + (1 − coverage)·LA_instrument TPS                  = 0.35·D9 + 0.30·D8 + 0.20·leadership_alignment + 0.15·D7      → band on 2 dp # ---------- segments and leaders ---------- perception_gap(o)    = │NOW_exec(o) − NOW_staff(o)│                     # both n ≥ 5 SDI                  = Σ│NOW_seg(o) − NOW_org(o)│ ÷ 2 leader_profile(o)    = other_avg(section o) ÷ Σ other_avg(A..D) · 100 fit_index            = 100 − Σ│leader_profile(o) − team_NOW(o)│ ÷ 2 # ---------- checks and planning ---------- alignment_pct        = round(mean(min(100, 100·NOW(r) ÷ T(r)) for r∈R), 1)   + overrides 1–3 (§4.5.1) behaviour_gap_points = mean(D2,D3)[dominant] − mean(D2,D3)[target] priority_score       = impact·urgency ÷ effort                                    → 2 dp |
| --- |

**Table 114  ****Unit tests**

| **ID** | **Test** | **Input** | **Expected** |
| --- | --- | --- | --- |
| UT-01 | Constant-sum rejection | 30/30/30/20 | 422; not persisted |
| UT-02 | Constant-sum acceptance | 40/30/20/10 | Accepted |
| UT-03 | Gaps sum to zero | Fixture profiles | +9, +11, −6, −14; Σ = 0 |
| UT-04 | Gap boundaries | 8.00, 7.99, 4.00, 3.99, −3.99, −4.00, −8.00 | BUILD+sig, STRENGTHEN, STRENGTHEN, KEEP, KEEP, MODERATE, MODERATE+sig |
| UT-05 | Culture strength | Dominant 34.00 | 9.0; MODERATE |
| UT-06 | Dimension congruence | Fixture D1–D6 | 4 of 6; 66.7%; MODERATELY_CONGRUENT; lenses 2 of 3 |
| UT-07 | Shared dominance | PERFORM 30.40, GOVERN 30.00 | Shared; dominant = [PERFORM, GOVERN] |
| UT-08 | eOS category | 100 valid: 30 advocates, 25 neutrals, 45 critics | −15; ENGAGEMENT_MISS, blocking |
| UT-09 | eOS Index | 18, 9, −8, 6, 11, −14, 21, 14 | 7.125 → 7.1 |
| UT-10 | TPS and rounding | D9 3.1, D8 2.8, LA 3.40, D7 3.2 | 3.085 → 3.09 (decimal half-up; float would give 3.08); ENABLEMENT_REQUIRED; cap 3 |
| UT-11 | TPS bands | 2.49, 2.50, 3.49, 3.50, 3.99, 4.00 | HIGH_RISK, ENABLEMENT, ENABLEMENT, TARGETED, TARGETED, STRONG |
| UT-12 | TPS weights | Weight vector | Σ = 1.00; any other vector raises a configuration error |
| UT-13 | Leadership alignment blend | coverage 0.42, LRI_weighted 3.25, D2 target 18.0, T 30 | LA_instrument 3.40; LA = 1.365 + 1.972 = 3.337 → 3.34; PROVISIONAL |
| UT-14 | C1 fixture | INNOVATE > 28, NOW 14 (lowest) | 50.0%; MISS; OVERRIDE_2 |
| UT-15 | C4 fixture | ENGAGE > 30, PERFORM > 30; NOW 22, 34 | 86.7%; PARTIAL_HIT via OVERRIDE_1 |
| UT-16 | C1 capping | PERFORM > 30; NOW 45 (not lowest) | sub 100.0; 100.0%; HIT |
| UT-17 | C4 transition | All > 24; NOW 22/14/34/30 | 91.7, 58.3, 100, 100 → 87.5%; PARTIAL_HIT via OVERRIDE_1; OVERRIDE_2 not applied |
| UT-18 | C2 rank | mean(D2,D3) 20/14/34/32; target ENGAGE | Rank 3; MISS; 14.0; SUBSTANTIVE |
| UT-19 | C3 systemic | D4 and D6 dominant PERFORM (MODERATE) | SYSTEMIC_MISS; identity_risk true |
| UT-20 | Perception bands | 5.0, 5.1, 7.0, 7.1 | NONE, WATCH, WATCH, SHADOW_CULTURE |
| UT-21 | Perception floor | Executive n = 4 | Not computed; reason stated; no flag |
| UT-22 | Priority cap | Fixture with TPS 2.40 | Cap 2: INNOVATE, ENGAGE selected; GOVERN DEFERRED “readiness cap”; P0 outside cap |
| UT-23 | Trade-off removal | Edit removes INNOVATE’s trade-off | 422 PlanIncoherent |
| UT-24 | Diagonal stepping stone | Dominant PERFORM, target ENGAGE, TPS 3.09 | DIAGONAL, High; stepping stone GOVERN (30 > 14) |
| UT-25 | Adjacent pathway | Dominant PERFORM, target INNOVATE | ADJACENT_OUTWARD; no stepping stone; outward narrative |
| UT-26 | Gate on publication | SHADOW ENGAGE open; publish ENGAGE action | 409 BLOCKING_GATE_OPEN naming the workshop |
| UT-27 | Primary floor | Segment n = 4 | 409; logged |
| UT-28 | Combination floor | Department n = 30; department × female n = 3 | 409 on combination; department returned |
| UT-29 | Differencing | Department 22; team A 18; team B 4 | Both teams suppressed; roll-up to department |
| UT-30 | 360 group floor | Peers n = 2 | Merged into ALL_OTHERS; no peer breakdown |
| UT-31 | LRI | H 3.6, F 3.2, target section 2.9, G 3.4 | 1.26 + 0.96 + 0.58 + 0.51 = 3.31; ENABLEMENT_REQUIRED |
| UT-32 | Self–other tiers | 0.50, 0.51, 1.00, 1.01 | ALIGNED, WATCH, WATCH, BLIND_SPOT |
| UT-33 | Integrity flag | E other 3.95 | Flag; people lead notified; development action required |
| UT-34 | Fit index | Leader 40/20/25/15 vs team 22/14/34/30 | 100 − 48 ÷ 2 = 76.0; ALIGNED |
| UT-35 | Culture blocker | Target ENGAGE; leader 15 vs org 22; default PERFORM (MODERATE); LRI 3.0; no flags | CULTURE_BLOCKER |
| UT-36 | Determinism | Score 100 times | Identical payload hash |
| UT-37 | Version pinning | Re-score after rules advance | Pinned version used; hash unchanged |
| UT-38 | AI numeric integrity | Draft with an absent number | Blocked; logged |
| UT-39 | AI terminology | Draft with a deny-listed term | Blocked; logged |
| UT-40 | Release gate | Empty “What this means” | 422 |
| UT-41 | Closure evidence | Close without evidence | 409 naming evidence type |
| UT-42 | Pulse constraints | 12 items, 2 off watch-list | 422 on both counts |
| UT-43 | Version comparability | 1.x vs 2.x; 1.0 vs 1.1 | 409; data without warning (equivalent) |
| UT-44 | Destruction | 24 months past close, no extension | Response-level rows gone; certificate; aggregates hold no response rows |
| UT-45 | LA at zero coverage | coverage 0; D2 target 18.0; T 30 | 3.40; TPS 3.09; “no 360 data” statement |
| UT-46 | LA at full coverage | coverage 1.0; LRI_weighted 3.60; LA_instrument 2.10 | 3.60; no provisional label |
| UT-47 | LA continuity | coverage 0.599 then 0.601 | Difference < 0.01; only the label changes |
| UT-48 | C2 intensity | 4.9, 5.0, 14.9, 15.0 | MARGINAL, SUBSTANTIVE, SUBSTANTIVE, ENTRENCHED; verdict unchanged |
| UT-49 | C2 shared dominance | Rank 2, gap 0.8; then gap 1.0 | HIT; then PARTIAL_HIT |
| UT-50 | Requirement margins | Each goal type and model | 30/+5, 28/+3, 26/+1 (JOINT), paired at single thresholds, 24/−1 (BALANCED) |
| UT-51 | C3 partial | D4 dominant ENGAGE (BUILD), D6 dominant PERFORM (MODERATE) | PARTIAL_HIT; identity_risk false |
| UT-52 | Override 3 | PLATFORM_DIGITAL; INNOVATE 30 but PERFORM 34 highest | pct 100.0; capped PARTIAL_HIT |
| UT-53 | LAGGING | Target ENGAGE; leader 15 vs org 22; default INNOVATE (BUILD); LRI 3.2 | LAGGING |
| UT-54 | D7–D9 banding | 3.04, 3.05, 2.96 | 3.0 band 2; 3.1 band 3; 3.0 band 2; gate D8 ≤ 3.0 true for 3.04 and 2.96 |
| UT-55 | 360 observed minimum | Rater observes 5 of 10 in section A | Rater excluded from A; included elsewhere |
| UT-56 | Quality exclusion | SPEEDING + UNIFORM_ALLOCATION; then UNIFORM + DUPLICATION only | INSUFFICIENT; then retained with flags |
| UT-57 | C1 multiple requirements | RESULTS_GROWTH HIT and INNOVATION MISS | Two findings; headline C1 MISS |
| UT-58 | Urgency tiers | Fixture | INNOVATE STRATEGIC_MISS; ENGAGE BEHAVIOUR_GAP; GOVERN PROCESS_CONTRADICTION |
| UT-59 | Plan skeleton | Fixture | P0 with 3 items; INNOVATE, ENGAGE, GOVERN; trade-offs GOVERN, PERFORM; C3 levers on ENGAGE |
| UT-60 | Illustrative leader | Other A–H 2.6/3.0/4.2/3.5/4.3/2.8/3.4/3.0; target ENGAGE | LRI 2.92; safety flag; F BLIND_SPOT; fit 91.44; NEUTRAL |
| UT-61 | Trade-off verification | §6.7 example | INNOVATE INTENDED (0.67); ENGAGE MIXED (0.33) |
| UT-62 | Action score | Impact 5, urgency 5, effort 3 | 8.33 |

# Appendix E  Delivery plan

Two-week sprints. Each phase ends with its acceptance criteria and named unit tests passing in CI. Every design decision is already adopted (Appendix H), so no sprint waits on a decision.

**Table 115  ****Phases**

| **Phase** | **Sprints** | **Scope** | **Exit criteria** |
| --- | --- | --- | --- |
| P1 Foundation | 1–3 | Tenancy, authentication and MFA, roles and permissions, org graph and leader mapping, audit log, residency, terminology build gate. | AC-1.1, AC-1.2; every permission cell tested; no role can read a response row; deny-list gate active. |
| P2 Setup | 4–5 | Sections A–I with perspectives and workshop records, requirement tagging and derivation, scorecard, Section I, consent, pre-flight. | AC-1.3 to AC-1.7; UT-50. |
| P3 Capture | 6–8 | Item bank and locale model, constant-sum control, respondent journey, 360 forms and nomination, tokens and unlinking, reminders, monitors, freeze. | AC-2.1 to AC-2.8; UT-01, UT-02. |
| P4 Scoring | 9–10 | Scoring service, quality flags, completion states, all Stage 3 metrics, leader scoring, LA and TPS, version pinning. | AC-3.1 to AC-3.4; UT-03 to UT-13, UT-31 to UT-37, UT-45 to UT-47, UT-54 to UT-56, UT-60. |
| P5 Segments | 11–12 | Segment engine, suppression, differencing, perception gap, sub-culture tests, heatmaps, query log, leader–culture link. | AC-3.5, AC-3.6; UT-20, UT-21, UT-27 to UT-30, UT-34, UT-35, UT-53. |
| P6 Findings | 13–14 | Rules engine as data, C1–C4, signals, severity, scenario library. | AC-4.1 to AC-4.3; UT-14 to UT-19, UT-48 to UT-52, UT-57. |
| P7 Reports | 15–17 | Report suite, chart library, AI service and guardrails, release, exports, branding. | AC-4.4 to AC-4.6; UT-38 to UT-40. |
| P8 Planning | 18–20 | Priority zero, selection, pathways, generation, prioritisation, action records, workflow, LDP, RAG, escalation, dashboards, outputs. | AC-5.1 to AC-5.7; UT-22 to UT-26, UT-41, UT-58, UT-59, UT-62. |
| P9 Re-assessment | 21–22 | Pulses, triggers, comparison, trade-off verification, adjust-or-retire, rollover, retention jobs. | AC-6.1 to AC-6.6; UT-42 to UT-44, UT-61. |
| P10 Hardening | 23–25 | Penetration test, load test, accessibility audit, localisation, full UAT with PAC faculty. | Appendix F signed off. |

# Appendix F  QA and UAT checklist

**Table 116  ****QA and UAT**

| **Area** | **Check** | **Pass condition** |
| --- | --- | --- |
| Anonymity | Try to retrieve an individual response or rater response as every role, including Super Admin and the application database role. | Impossible by any route. |
| Anonymity | Try to identify a small group by differencing or combining permitted segments. | Suppressed; attempt in the query log. |
| Scoring | Reproduce every worked example and fixture value in this document. | Exact match, including 3.09, 50.0%, 86.7%, rank 3 / 14.0, 2.92 and 91.44. |
| Scoring | Constant-sum enforcement at client, API and database. | All three reject a non-100 scenario. |
| Rounding | Run UT-10 and UT-54 on the production build. | Decimal half-up behaviour confirmed. |
| Terminology | Scan code, enumerations, seed data, UI strings, templates, chart legends and prompts. | Zero deny-list hits; gate runs on every build. |
| Gates | Attempt to publish over each blocking gate type. | Refused, naming the pre-condition. |
| Workflow | Attempt every illegal transition. | 409 in every case. |
| Reports | Release a report with an empty mandatory section or unaccepted AI text. | Refused. |
| AI | Seed a value and try to make the panel state another; request a causal claim. | Blocked; causal text rewritten associationally. |
| Ethical use | Export a leader report or classification into performance, remuneration, succession or disciplinary context. | Blocked, not warned. |
| Data protection | Exercise every data-subject right; advance the clock past retention. | Routes work; destruction executes; certificate issued. |
| Accessibility | Keyboard-only and screen-reader completion of the full instrument. | Completable without assistance; WCAG 2.1 AA audit passed. |
| Localisation | Complete the instrument in each published locale. | No truncation, untranslated strings or anchor mismatches. |
| Load | 5,000 concurrent respondents; score a 5,000-response assessment. | p95 < 2 s; scoring < 10 minutes. |
| End to end | Run a full engagement on seeded data with PAC faculty. | Every state in §0.6 reached; faculty confirm outputs are board-ready. |

# Appendix G  Glossary

**Table 117  ****Glossary**

| **Term** | **Meaning** | **Reference** |
| --- | --- | --- |
| Orientation | One of ENGAGE, INNOVATE, PERFORM, GOVERN. | §3.5.2 |
| NOW / PREFERRED | Current culture; the culture the organisation needs in five years (D1–D6 only). | §2.3 |
| Orientation score | Mean of an orientation’s 18 scenario allocations per perspective and cohort. | §3.5.2 |
| Gap; BUILD / STRENGTHEN / KEEP & PROTECT / MODERATE | PREFERRED − NOW; the four half-open classes. Significant when │gap│ ≥ 8.0. | §3.5.3 |
| Dominant; shared dominance | Highest score; shared when the top two differ by < 1.0. | §3.5.4 |
| Culture strength; congruence | Dominant − 25; count of dimensions (and lenses) sharing the organisational dominant. | §3.5.5–3.5.6 |
| Lens | Strategy = mean(D5, D6); Practice = mean(D1, D3, D4); Leadership = D2. | §3.5.7 |
| D1–D9 | Cultural DNA · Leadership Blueprint · People Architecture · Cohesion Drivers · Strategic Compass · Victory Conditions · Digital Readiness · Psychological Safety · Adaptive Capacity. | §2.3.2 |
| eOS; eOS Index | Employee Orientation Survey: eight categories, Advocates − Critics, −100 to +100; Index = mean of categories. | §3.5.9 |
| Advocates / Neutrals / Critics | eOS response bands 9–10, 7–8, 0–6. | §3.5.9 |
| Leadership target orientation | Most frequent orientation tag on the Section F1 target leadership behaviours. | §1.5.3 |
| LRI | Leader Readiness Index, on others’ ratings, 1–5. | §3.5.10 |
| Coverage; leadership alignment | Headcount share of leaders with a valid 360; blend of weighted LRI and the D2 instrument term. | §3.5.11 |
| TPS | Transformation Probability Score, 1–5. | §3.5.11 |
| C1–C4; HIT / PARTIAL HIT / MISS | Performance alignment · behaviour gap · stop/start audit · business-model readiness; check verdicts. | §4.5 |
| Alignment percentage | Mean capped attainment of required orientations against thresholds, with overrides. | §4.5.1 |
| WATCH / SHADOW CULTURE | Perception-gap flags: > 5.0 to 7.0; > 7.0. | §3.5.12 |
| SDI; sub-culture | Sub-culture Divergence Index; a segment meeting profile or dominance divergence and significance. | §3.5.12 |
| Fit index; carrier / blocker | Leader–team profile congruence; classification against the leadership target orientation. | §3.5.13 |
| Finding; severity | Structured result of the rules engine; CRITICAL, HIGH, MEDIUM, LOW. | §4.4, §4.5.6 |
| Scenario | Named score pattern with diagnosis, risks, hypotheses and an action template. | §4.5.5 |
| Priority zero | Pre-conditions created by blocking gates; CEO + CHRO; 30 days; outside the cap. | §5.5.4 |
| Urgency tier | STRATEGIC_MISS 0–30 days · BEHAVIOUR_GAP 0–90 days · PROCESS_CONTRADICTION 1–6 months · MODEL_READINESS 6–18 months. | §5.5.3 |
| Pathway; stepping stone; bridging narrative | Shift from dominant NOW to target; neighbour used for diagonal shifts at low readiness; framing that preserves identity. | §5.5.5 |
| Visible signal | One change within 30 days, preferably to a recognition ritual. | §5.5.6 |
| Strategic scorecard | Client objectives and KPIs held natively; organisation actions must link to one. | §1.4.3 |
| Pulse | ≤ 10 watch-list items at 90 / 180 days; indicative only. | §6.5.1 |

# Appendix H  Decisions adopted

Every point the source documents left open has been decided. Build each one exactly as stated. Where a value may need recalibration after live use, it is a configuration key (Appendix I) changed through a new rules version, never through code.

**Table 118  ****Decisions adopted**

| **ID** | **Decision** | **Adopted position** | **Where it applies** |
| --- | --- | --- | --- |
| D-01 | C4 threshold when two orientations are required | Each paired orientation is tested against its own single-orientation threshold (30 for ENGAGE and PERFORM, 28 for INNOVATE and GOVERN). The 26-each threshold applies only to the C1 TRANSFORMATION requirement. | §1.5.2, §4.5.1 · UT-15 |
| D-02 | Culture-gap significance | │gap│ ≥ 8.0 in either direction; identical to the BUILD and significant-MODERATE boundaries. | §3.5.3 · UT-04 |
| D-03 | Locales | Launch in en-GB. Kiswahili (sw-KE) and French (fr) translated and reconciled in phase P10, published before the first non-English client launch. Further languages per client contract. Reconciler: PAC-certified bilingual practitioner independent of the forward translation. | §2.3.3 · P3, P10 |
| D-04 | Hosting, resilience | Shared deployment in an African public-cloud region (default South Africa) with a per-tenant transfer basis; dedicated in-country deployment where a tenant’s regime or contract requires it. RPO 1 hour, RTO 8 hours; daily encrypted backups kept 35 days; quarterly restore test. | §0.4, §1.4.5 · P1 |
| D-05 | Action caps and escalation | 4 priorities plus priority zero; ≤ 6 organisation actions per priority; ≤ 3 unit actions per unit per cycle; ≤ 3 development actions per leader per six months; escalation at 7 / 14 / 21 / 28 days. | §5.5.9, §5.6.3 · P8 |
| D-06 | Pulse triggers | Short-form mean moves ≥ 0.5; eOS category moves ≥ 15 points; scenario allocation moves ≥ 8.0 points. A trigger opens a consultant review, not an automatic survey. | §6.5.1 · P9 |
| D-07 | Strategic scorecard | Held natively in the platform with CSV import. Clients with their own scorecard system integrate through the scorecard import/export endpoints delivered in P9. No vendor-specific connectors in version 1. | §1.4.3, Appendix B · P2, P9 |
| D-08 | Aggregate retention | Response-level data destroyed at 24 months. Aggregates (n ≥ 5, no response rows) kept for the client relationship plus 24 months after exit, as written into the standard services contract; destroyed earlier on written request. | §6.6.3 · P9 |
| D-09 | 360 rater nomination | Leader proposes, line manager approves (Client Admin may act for the line manager). Superior = line manager; all direct reports pre-filled; 3–8 peers. A valid result needs the self form plus ≥ 3 raters. | §1.4.6 · P3 |
| D-10 | Speeding threshold | Faster than the higher of 8 minutes or one third of the assessment’s median completion time. A response is excluded only when SPEEDING occurs together with another quality flag. | §2.6.4 · P4 |
| D-11 | Completion-time statement | “35–45 minutes” at launch; Client Admin prompted to update once the measured median of the first 30 complete responses falls outside 30–50 minutes. | §2.5 · P3 |
| D-12 | Pulse short forms | D7: items 01, 03, 04, 08 · D8: 02, 03, 05, 11 · D9: 01, 05, 09, 10. | §6.5.1 · P9 |
| D-13 | Coach role; people-lead access | Coach role scoped to assigned leaders and dates. The Client Admin flagged as people lead (CHRO) reads leader reports and carrier/blocker classifications for development use only. Every such read is audit-logged and the screen carries the ethical-use statement; export to performance, pay, succession or discipline is blocked. | §0.5, §3.5.13 · P1, P6 |
| D-14 | Orientation colours | The validated palette in §4.7 is used in the platform, every report and every export. The client deck adopts the same palette at its next revision. | §4.7 · P7 |
| D-15 | Calibrated thresholds | SDI 12.0; strength bands 5 / 10 / 15; congruence counts 5–6 / 3–4 / 0–2; fit bands 85 / 70 / 55; carrier/blocker ±5.0 with the LAGGING class. Reviewed by PAC faculty once ten client assessments are complete, using pooled aggregate data; any change ships as a new rules version. | §3.5.5–§3.5.13 · P5 |
| D-16 | 360 observed-item minimum | 6 of 10 items (Sections A–D) and 3 of 5 (E–H) per rater per section; otherwise that rater is excluded from that section only. | §3.5.10 · P4 · UT-55 |

# Appendix I  Configuration registry

Every tunable value lives here, under a stable key, versioned with the rules. Scope: GLOBAL (rules version, PAC faculty only), TENANT (PAC Consultant per client) or ENGAGEMENT. Code must read these keys; literal values in code are a review failure.

**Table 119  ****Configuration keys**

| **Key** | **Default** | **Scope** | **Meaning** |
| --- | --- | --- | --- |
| scoring.rounding_mode | HALF_UP | GLOBAL | Decimal rounding for every presented or banded value. |
| scoring.gap.build | 8.00 | GLOBAL | BUILD lower bound; also │gap│ significance. |
| scoring.gap.strengthen | 4.00 | GLOBAL | STRENGTHEN lower bound; MODERATE upper bound is the negative. |
| scoring.dominance.shared_lt | 1.00 | GLOBAL | Top-two difference below which dominance is shared. |
| scoring.strength.bands | 5, 10, 15 | GLOBAL | Culture-strength band edges. |
| scoring.congruence.bands | 5, 3 | GLOBAL | Minimum counts for HIGHLY and MODERATELY congruent. |
| scoring.likert.min_answered | 9 | GLOBAL | Items of 12 a respondent must answer to count in D7–D9. |
| scoring.eos.advocate_min / critic_max | 9 / 6 | GLOBAL | eOS band edges. |
| scoring.tps.weights | 0.35, 0.30, 0.20, 0.15 | GLOBAL | D9, D8, leadership alignment, D7; must sum to 1.00. |
| scoring.tps.bands | 2.50, 3.50, 4.00 | GLOBAL | TPS and LRI band edges. |
| scoring.tps.provisional_coverage_lt | 0.60 | GLOBAL | Coverage below which the TPS is labelled provisional. |
| scoring.lri.weights | 0.35, 0.30, 0.20, 0.15 | GLOBAL | H, F, target section, G. |
| scoring.360.min_raters | 3 | GLOBAL | Raters for a valid result and for a published group. |
| scoring.360.min_observed | 0.60 | GLOBAL | Share of a section’s items a rater must observe. |
| scoring.360.flags | E < 4.00; F < 3.00; H < 3.00 | GLOBAL | Integrity, safety and change-capacity flags. |
| scoring.360.gap_tiers | 0.50, 1.00 | GLOBAL | WATCH and BLIND_SPOT edges. |
| segments.floor | 5 | GLOBAL | Culture reporting floor; no role may lower it. |
| segments.qual_floor | 8 | GLOBAL | Verbatim extract floor. |
| segments.perception | 5.00, 7.00 | GLOBAL | WATCH and SHADOW_CULTURE edges. |
| segments.sdi_candidate | 12.00 | GLOBAL | Profile-divergence threshold. |
| segments.single_divergence | 8.00 | GLOBAL | Single-orientation divergence. |
| segments.readiness_divergence | 0.50 | GLOBAL | D8 / D9 divergence. |
| segments.significance_alpha | 0.05 | GLOBAL | Welch test level. |
| leaders.fit_bands | 85, 70, 55 | GLOBAL | Fit index band edges. |
| leaders.carrier_margin | 5.00 | GLOBAL | Carrier / blocker margin. |
| checks.alignment_bands | 80, 60 | GLOBAL | HIT and PARTIAL_HIT lower bounds. |
| checks.c2_intensity | 5.00, 15.00 | GLOBAL | MARGINAL / SUBSTANTIVE / ENTRENCHED edges. |
| checks.requirements | §1.5.1–§1.5.2 tables | GLOBAL | Goal-type and business-model lookups with thresholds. |
| gates.readiness_le | 3.0 | GLOBAL | D7, D8, D9 gate (1 dp). |
| plan.priority_caps | 2, 3, 4 | GLOBAL | By TPS band (first two bands, then the rest). |
| plan.action_caps | 6, 3, 3 | TENANT | Organisation actions per priority; unit actions per cycle; leader actions per six months. |
| plan.visible_signal_days | 30 | GLOBAL | Deadline for the visible signal and priority zero. |
| tracking.escalation_days | 7, 14, 21, 28 | TENANT | Reminder, sponsor, tier owner, ExCo. |
| tracking.rag_flat_band | 0.05 | GLOBAL | KPI progress ratio treated as flat. |
| survey.min_window_working_days | 10 | GLOBAL | Minimum survey window. |
| survey.reminders | D3, D6, close − 24 h, final | ENGAGEMENT | Reminder plan. |
| survey.speeding | max(480 s, median ÷ 3) | GLOBAL | Speeding threshold. |
| survey.completion_text | 35–45 minutes | ENGAGEMENT | Statement shown to respondents. |
| pulse.max_items | 10 | GLOBAL | Items per pulse. |
| pulse.triggers | 0.5, 15, 8.0 | GLOBAL | Likert, eOS, scenario movement. |
| retention.response_months | 24 | TENANT | Response-level destruction. |
| retention.aggregate_after_exit_months | 24 | TENANT | Aggregate retention after relationship ends. |
| quality.alpha_disclose_lt | 0.70 | GLOBAL | Internal-consistency disclosure. |
| ai.enabled · ai.region | true · tenant region | TENANT | AI narrative availability and processing region. |

# Appendix J  Error catalogue

Errors are RFC 7807 problem documents. The code is stable and is what client code and tests assert on; titles are localised.

**Table 120  ****Errors**

| **Code** | **HTTP** | **Raised when** |
| --- | --- | --- |
| VALIDATION_FAILED | 422 | Any field fails its validation; errors[] lists field paths. |
| CONSTANT_SUM_VIOLATION | 422 | A scenario does not total exactly 100 or contains a non-integer or negative value. |
| SCALE_OUT_OF_RANGE | 422 | A Likert, eOS or 360 value is outside its scale. |
| PREFLIGHT_FAILED | 422 | Launch attempted with a failing blocking pre-flight check; checks[] lists them. |
| SETUP_LOCKED | 409 | A scoring-relevant setup field is edited after launch. |
| WORKSHOP_RECORD_MISSING | 422 | A section is agreed without a workshop date and two executives. |
| SETUP_TIE_UNRESOLVED | 422 | Section F is agreed while its F1 tags tie and the consultant has not named a tie-break orientation with a recorded reason. |
| SETUP_SEQUENCE_VIOLATION | 409 | A setup section is captured or agreed out of order: B, C and D before E, F and G; Section I last; or E, F or G agreed without both an Executive and an HR entry saved. |
| TOKEN_INVALID | 410 | A survey token is expired, used or unknown. |
| ALREADY_SUBMITTED | 409 | A second submission on a token. |
| DATA_NOT_FROZEN | 409 | Scoring requested before the dataset is frozen. |
| BELOW_REPORTING_THRESHOLD | 409 | A segment, group or extract falls below a floor; rule names which. |
| VERSION_INCOMPARABLE | 409 | A trend crosses a major instrument version. |
| RELEASE_INCOMPLETE | 422 | Report release with an empty mandatory section or unaccepted AI text. |
| AI_INTEGRITY_BLOCKED | 422 | AI draft fails numeric, terminology, traceability, causal or attribution screens. |
| FINDING_REQUIRED | 422 | An action is created without a linked finding. |
| PLAN_INCOHERENT | 422 | A BUILD priority has no trade-off orientation. |
| MANDATORY_COMPANION_MISSING | 422 | A priority lacks a visible signal, a system lever or a trade-off action. |
| ILLEGAL_TRANSITION | 409 | An action or engagement state change not allowed from the current state. |
| BLOCKING_GATE_OPEN | 409 | Publication while a gate on the orientation or cohort is open; names the pre-condition. |
| EVIDENCE_REQUIRED | 409 | Closure without evidence; names the evidence type. |
| PULSE_INVALID | 422 | More than ten items or an item outside the watch-list. |
| EXPORT_FORBIDDEN | 403 | Export of an unreleased report, raw data, or a leader output into a prohibited context. |
| FORBIDDEN | 403 | The actor’s role or scope does not permit the operation. |

# Appendix K  Events and notifications

Services communicate state changes through domain events on an internal bus (at-least-once delivery, idempotent consumers keyed on event_id). Notifications are email plus in-app; the scheduler owns all time-based events.

**Table 121  ****Domain events**

| **Event** | **Emitted by** | **Key payload** | **Consumers and notifications** |
| --- | --- | --- | --- |
| engagement.state_changed | Engagement | engagement_id, from, to, actor | Dashboards; audit |
| setup.section_agreed | Setup | section, perspective, workshop_date | Requirement derivation |
| assessment.launched | Capture | assessment_id, window | Invitations sent; scheduler sets reminders |
| invitation.reminder_due | Scheduler | invitation_id, kind | Email to token holder |
| response.submitted | Capture | assessment_id, completion_state | Response monitor (counts only) |
| assessment.frozen | Capture | assessment_id, response_set_hash | Scoring may start |
| score.frozen | Scoring | assessment_id, version, payload_hash | Rules engine; segment cubes |
| findings.evaluated | Rules engine | assessment_id, checks, blocking[] | Debrief board; priority zero |
| report.released | Report | report_id, type, audience | Audience notified; leader reports notify coach only |
| priority_zero.created | Rules engine | items[], due | CEO and CHRO notified |
| action.transitioned | Action | action_id, from, to, actor | Owner, sponsor; RAG clock starts at PUBLISHED |
| action.overdue | Scheduler | action_id, days_overdue | Escalation ladder (§5.6.3) |
| visible_signal.missed | Scheduler | priority_id | CEO immediately |
| leader.flag_raised | Scoring | result_id, flag | Leader, coach, people-lead Client Admin |
| pulse.completed | Capture | pulse_id, triggers[] | Trigger monitor |
| trigger.raised | Re-assessment | type, source | PAC Consultant review |
| retention.notice_due | Scheduler | assessment_id, days_to_expiry | Client Admin at 90 and 30 days |
| retention.destroyed | Scheduler | assessment_id, certificate_id | Audit; Super Admin |

	www.pac.africa  ·  Culture Dynamics Profile (CDP)  ·  Proprietary and Confidential	Page  of