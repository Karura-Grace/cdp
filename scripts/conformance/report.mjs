// Writes docs/SPEC_CROSSCHECK_2026-10.md from docs/spec-crosscheck/requirements.csv (the matrix). PAC house style for prose:
// no dashes, no hyphenated words; ids and file names go in backticks. Row text from the matrix is cleaned on the way in.
//   node scripts/conformance/report.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseCsv } from "./csv.mjs";

const rows = parseCsv(readFileSync("docs/spec-crosscheck/requirements.csv", "utf8"));
const run = existsSync("docs/spec-crosscheck/last-run.json") ? JSON.parse(readFileSync("docs/spec-crosscheck/last-run.json", "utf8")) : null;
// ids such as S6-01, AC-6.4 or UT-44 go in backticks; every other dash or hyphen is removed from prose
const clean = (s) => { const ids = []; const t = String(s ?? "").replace(/\b[A-Z]{1,4}\d*(?:\.\d+)?-[A-Za-z0-9_.]*\d[A-Za-z0-9_.]*\b/g, (m) => { ids.push(m.replace(/\.$/, "")); return `\u27e6${ids.length - 1}\u27e7`; })
  .replace(/[–—]/g, ",").replace(/(?<=[A-Za-z0-9])-(?=[A-Za-z0-9])/g, " ").replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  return t.replace(/\u27e6(\d+)\u27e7/g, (_, i) => "`" + ids[i] + "`"); };
const cut = (s, n) => { const t = clean(s); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, "") + "..." : t; };
const by = (f) => rows.filter(f);
const count = (xs, k) => xs.reduce((m, r) => ({ ...m, [r[k]]: (m[r[k]] ?? 0) + 1 }), {});
const ST = ["Built", "Partial", "Missing", "Unverified", "Differs by decision", "Not applicable"];
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const table = (head, body) => `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${body.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;

const total = rows.length, s = count(rows, "status");
const applicable = total - (s["Not applicable"] ?? 0);
const STAGES = [["0", "Foundations"], ["1", "Setup"], ["2", "Assessment"], ["3", "Scoring"], ["4", "Reporting"], ["5", "Advisory and action planning"], ["6", "Re assessment"],
  ["A", "Appendix A, data model"], ["B", "Appendix B, API"], ["C", "Appendix C, item bank"], ["D", "Appendix D, formulas and unit tests"], ["E", "Appendix E, delivery plan"], ["F", "Appendix F, QA and UAT"],
  ["G", "Appendix G, glossary"], ["H", "Appendix H, decisions"], ["I", "Appendix I, configuration"], ["J", "Appendix J, errors"], ["K", "Appendix K, events"]];
const DECISIONS = {
  "D-R2": "Evidence files are stored in Cloudflare R2, not Supabase Storage (11 October 2026).", "D-LOGO": "The client logo is held on the tenant record (17 October 2026).",
  "D-ANALYTICS": "An extra analytics block, and payload versions 1 to 3, were added to the score (16 and 17 October 2026).", "D-COHORT": "Cohorts come from the organisation file by grade; people do not pick their own (17 October 2026).",
  "D-MFA": "Two step sign in is parked until the owner gives a written yes.", "D-LAUNCH": "The PAC consultant launches; the split with the Client Admin is planned.",
  "D-NARRATIVE": "Report text is written by the consultant plus a rule based PAC library; AI narrative comes after the first client.", "D-LANG": "English only for the first client.",
  "D-SCORINGKEY": "A separate scoring key reads the frozen responses; the service role cannot (migration 23).", "D-SIGNUP": "Public sign up stays on by the owner's choice.",
  "D-FULLREPORT": "The organisational report has a full version and an executive brief (17 October 2026).", "D-NEUTRAL410": "A used, expired or unknown survey link all answer 410 with one neutral message, so a link cannot be probed.",
};

let md = `# Developer specification cross check
**Date:** 17 October 2026
**Scope:** The Culture Dynamics Profile platform against the developer specification v2.1 (PAC/CDP/TECH/001), every requirement row by row, chapters 0 to 6 and appendices A to K
**Status:** Report only. No fixes have been made. A proposed fix order is at the end for your approval.
**Matrix:** \`docs/spec-crosscheck/requirements.csv\`, ${total} requirements
---
## Summary

The specification was split into **${total} requirements**: every table row, every rule that says shall, must or never, every screen, field, calculation, acceptance criterion, unit test, configuration key, error code and event. Each was given a status and, where it is not built, a severity tied to the first client (under 50 people, English, live within four weeks).

${table(["Status", "Requirements", "Share"], ST.map((k) => [k, String(s[k] ?? 0), `${pct(s[k] ?? 0, total)}%`]))}
**${s.Built ?? 0} of ${applicable} applicable requirements (${pct(s.Built ?? 0, applicable)}%) are built and backed by a test or a check.** A further ${s["Differs by decision"] ?? 0} differ from the specification on purpose, with the decision recorded. ${s.Unverified ?? 0} have code but no test yet, and ${(s.Partial ?? 0) + (s.Missing ?? 0)} are partial or missing.

What this means in plain terms:

- **The engine is the strongest part.** All 62 unit tests from Appendix D pass by their ids, the scoring and the four alignment checks are tested, and the TypeScript engine matches the independent Python version on 122 datasets.
- **The core loop works end to end** from setup to a released report and a plan, and from there to the next cycle.
- **The weakest parts are the surroundings of the loop:** scheduled work (reminders, escalation, retention and destruction, automatic pulses), the events that should drive them, the data protection records, role scoping for leader results, and several screens the specification names (debrief board, workshop mode, priority builder, findings console, score review).
- **Nothing found makes the first client impossible to start,** but ${by((r) => r.severity === "Non negotiable").length} gaps are in the non negotiable group (privacy, anonymity, terminology, release gate, audit) and should be closed before real staff answers are collected.

`;
md += `## How the check was done

1. The specification was divided into blocks and each block read line by line. Every requirement became one row.
2. For each row the code (file and line) and the test or check that exercises it were found. **Built** needs both. A row with code and no test is **Unverified**.
3. The automated runner (\`node scripts/conformance.mjs\`) runs the engine tests, ${run ? new Set(run.results.map((x) => x.suite)).size : "the"} test suites and probes, and marks each row it can prove or disprove. A verifier checks that every cited line and test exists, and downgrades a Built row whose test it cannot find.
4. Some rows were checked by reading the code myself, and ten random Built rows were opened by hand: eight were exact; two were weak (a blank cited line, a duplicate with the wrong code) and were corrected.
5. Live checks ran against a local build on the live database (throwaway clients, removed afterwards with a backup) and, read only, on culture.pac.africa.

Severity: **Blocker** means the first client cannot go live; **Non negotiable** means a rule from section 0.8 or a privacy, anonymity or security requirement; **Important** means a feature or acceptance criterion is incomplete; **Minor** means wording, layout or a nice to have.

`;
md += `## Status by stage

${table(["Stage", "Built", "Partial", "Missing", "Unverified", "By decision", "Not applicable", "Total"], STAGES.map(([k, name]) => { const x = count(by((r) => r.stage === k), "status"); const n = by((r) => r.stage === k).length;
  return [name, ...["Built", "Partial", "Missing", "Unverified", "Differs by decision", "Not applicable"].map((q) => String(x[q] ?? 0)), String(n)]; }).filter((r) => r[7] !== "0"))}
`;
const ac = by((r) => /^AC-/.test(r.id));
md += `## Acceptance criteria

${table(["Criterion", "What it requires", "Status", "Severity"], ac.map((r) => [`\`${r.id}\``, cut(r.requirement, 110), r.status, r.severity || ""]))}
${ac.filter((r) => r.status === "Built").length} of ${ac.length} acceptance criteria are fully built. The others are partial because a part is missing; each is explained in the matrix notes.

`;
const nn = by((r) => ["Blocker", "Non negotiable"].includes(r.severity) && r.status !== "Not applicable");
md += `## Blockers and non negotiable gaps

${nn.length} rows. The single Blocker is the hardening exit (penetration test, load test, accessibility audit), which is required before a go live and is on the go live checklist. The rest are non negotiable.

${table(["Id", "Status", "Requirement", "What is missing"], nn.map((r) => [`\`${r.id}\``, r.status, cut(r.requirement, 90), cut(r.notes, 170)]))}
`;
md += `## Important gaps by stage

The ${by((r) => r.severity === "Important").length} important gaps are in the matrix. These are the ones that matter most in each stage (missing first).

`;
for (const [k, name] of STAGES.slice(0, 7)) {
  const xs = by((r) => r.stage === k && r.severity === "Important").sort((a, b) => (a.status === "Missing" ? 0 : 1) - (b.status === "Missing" ? 0 : 1));
  if (!xs.length) continue;
  md += `### ${name}\n\n${xs.length} important gaps. The first ${Math.min(8, xs.length)}:\n\n${xs.slice(0, 8).map((r) => `- \`${r.id}\` (${r.status.toLowerCase()}): ${cut(r.requirement, 90)}. ${cut(r.notes, 140)}`).join("\n")}\n\n`;
}
const un = by((r) => r.status === "Unverified");
md += `## Rows with code but no test

${un.length} requirements have code but no test or check that proves them. They are not known to be wrong; they are not yet proven. Most are role cells where access should be refused (Coach, audit log, anonymous respondents) and field validations. They are listed in the matrix with status Unverified, and closing them is mostly a matter of writing small probes.

${table(["Stage", "Unverified"], STAGES.map(([k, name]) => [name, String(un.filter((r) => r.stage === k).length)]).filter((r) => r[1] !== "0"))}
`;
const dd = by((r) => r.status === "Differs by decision");
const dg = dd.reduce((m, r) => ({ ...m, [r.decision_ref]: (m[r.decision_ref] ?? 0) + 1 }), {});
md += `## Departures by decision

${dd.length} requirements are built differently on purpose. They are not defects; each is tied to a recorded decision.

${table(["Decision", "Requirements", "What was decided"], Object.entries(dg).sort((a, b) => b[1] - a[1]).map(([k, n]) => [`\`${k}\``, String(n), DECISIONS[k] ?? "See the matrix notes."]))}
`;
md += `## Built beyond the specification

These exist in the platform and the specification does not ask for them (they are not counted above):

- The engagement console: an Overview with a tab bar across every engagement page, and the Start here path with the setup checklist.
- The survey and Leadership 360 preview pages for consultants.
- The analytics block: gap bands, cultural entropy, tensions, spread of answers, the Culture Risk Index, values against reality, and the risk dashboard against PAC targets.
- The full length organisational report (about 35 pages), the executive brief, a 30 slide deck, a consultant note per chapter, and the client logo on reports.
- The rater context questions, the strongest and weakest behaviours, and reflection questions in leader results.
- The value at stake calculator, the Culture Map, and the home page and entry boxes.
- The Savanna Ridge showcase, the rehearsal guide and data, and the cleanup and conformance tooling.

`;
md += `## Proposed fix order

For your approval. Nothing below has been started.

**1. Before any real staff answer is collected (non negotiable)**

- Replace the third party terms in the full report and the score payload with the PAC terms (Advocates, Neutrals, Critics), make the terminology gate fail when its secret is missing, and run it on the web build. The report terms are mine, added on 17 October.
- Scope leader results as the specification says: Client Admin only as people lead, Executive only self and direct reports, Coach by assignment and dates, every read audited, and the ethical use statement.
- Close the timing side channel between invitations and responses, and stop the Leadership 360 page showing who has responded for groups under five.
- Retention: the destruction job, the 90 and 30 day notices and the certificate, with a database test (needs your approval for a schema change).
- Data protection records: demographic attributes with an analytical purpose, the DPIA record checked at launch, the processing register and the data subject rights path (schema changes, written design first).
- Segment suppression returns 409 in every path and the query log records the resolved count; test that a score cannot be changed; release gate checks the technical appendix; leader reports release to the coach first.

**2. Before the first client sees results (the experience)**

- The D7 readiness gate never blocks a priority (a defect found in this check).
- Reminders, the launch split (consultant approves, Client Admin launches), the score review screen, window extension, and the findings console with annotations.
- Run findings with segments and leaders so sub culture and leader signals appear in the product; wire the priority builder rules (\`validatePriorityEdit\`, companions, caps); the requirements endpoint.
- The scheduler: escalation, automatic pulses at 90 and 180 days, and the event outbox for the Appendix K events.

**3. Soon after the first client**

- The remaining report types (sub culture, leader, leadership team, action plan), XLSX export, role dashboards, the scorecard entity with import and export, trends by segment, and 360 open text.

**4. Go live hardening**

- Two step sign in (needs your written yes), the load test (5,000 respondents), the penetration test, an accessibility audit, a backup and restore test, and rate limiting.

`;
md += `## Automated checks

\`node scripts/conformance.mjs\` runs the engine tests, the end to end suites and the probes, writes the result against the matrix rows it can prove, and removes the test clients it created. \`node scripts/conformance/merge.mjs\` rebuilds the matrix from its parts, \`verify-claims.mjs\` checks every cited line and test, and \`coverage.mjs\` compares matrix rows with the specification text. ${run ? `The last full run (${run.started.slice(0, 10)}) made ${run.results.length} checks; ${run.results.filter((x) => !x.pass).length} failed, and each failure is a row in the matrix.` : ""}
`;
writeFileSync("docs/SPEC_CROSSCHECK_2026-10.md", md);
console.log(`written ${md.split(/\s+/).length} words`);
