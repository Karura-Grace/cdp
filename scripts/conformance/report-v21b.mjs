// Writes docs/SPEC_CROSSCHECK_V21B_2026-10.md: the cross check against the 17 October spec variant (rows with ids N*).
// PAC house style for prose: no dashes, no hyphenated words; ids and file names in backticks.
//   node scripts/conformance/report-v21b.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "./csv.mjs";

const rows = parseCsv(readFileSync("docs/spec-crosscheck/requirements.csv", "utf8"));
const isNew = (r) => /^N\d/.test(r.id);
const nw = rows.filter(isNew), old = rows.filter((r) => !isNew(r));
const clean = (s) => { const ids = []; const t = String(s ?? "").replace(/\b[A-Z]{1,4}\d*(?:\.\d+)?-[A-Za-z0-9_.]*\d[A-Za-z0-9_.]*\b/g, (m) => { ids.push(m.replace(/\.$/, "")); return `⟦${ids.length - 1}⟧`; })
  .replace(/[–—]/g, ",").replace(/(?<=[A-Za-z0-9])-(?=[A-Za-z0-9])/g, " ").replace(/->/g, "gives").replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  return t.replace(/⟦(\d+)⟧/g, (_, i) => "`" + ids[i] + "`"); };
const cut = (s, n) => { const t = clean(s); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, "") + "..." : t; };
const count = (xs, k) => xs.reduce((m, r) => ({ ...m, [r[k]]: (m[r[k]] ?? 0) + 1 }), {});
const ST = ["Built", "Partial", "Missing", "Unverified", "Differs by decision", "Not applicable"];
const table = (head, body) => `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${body.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
const CH = { N0: "About this document", N1: "System set up", N2: "Organisational culture assessment", N3: "Sub culture and slice and dice", N4: "Leadership assessment",
  N5: "Linking leader reports to culture", N6: "Scenario reporting and guidance engine", N7: "Reports", N8: "Action planning module", N9: "Advisory roadmap",
  N10: "Build artefacts", N11: "Action planning reference (Part B)", N12: "Report composition engine (Part B)" };

const s = count(nw, "status"), so = count(old, "status");
const open = (r) => ["Partial", "Missing", "Unverified"].includes(r.status);
const sev = count(nw.filter(open), "severity");
const changed = nw.filter((r) => /CHANGED/.test(r.notes));
const nonneg = nw.filter((r) => open(r) && ["Blocker", "Non negotiable"].includes(r.severity));

let md = `# Cross check against the 17 October specification variant
**Date:** 18 October 2026
**Scope:** The Culture Dynamics Profile platform against the technical development document dated 17 October 2026 (PAC/CDP/TECH/001, final build baseline, Part A chapters 1 to 10 and Part B chapters 11 and 12), every requirement row by row
**Status:** Report only. No fixes have been made. Your rulings are in \`docs/designs/V21B-decisions-2026-10-18.md\`. The fix order is at the end for your approval.
**Matrix:** \`docs/spec-crosscheck/requirements.csv\`, ${rows.length} requirements (${old.length} from the 1 October specification, ${nw.length} new rows with ids starting N)
---
## Summary

The new document is not a small edit of version 2.1. It is organised by topic instead of by stage, it adds the report composition engine and the action planning reference (Part B), and it changes about ${changed.length} rules. Where the two conflict you ruled that the new text governs. Appendices C, I and K of the old specification still hold, and the new section 10.2 replaces appendix J.

${table(["Status", "New rows (17 October)", "Old rows (1 October)"], ST.map((k) => [k, s[k] ?? 0, so[k] ?? 0]).concat([["Total", nw.length, old.length]]))}
Of the ${nw.filter(open).length} new rows that are not built: ${sev["Blocker"] ?? 0} Blocker, ${sev["Non negotiable"] ?? 0} Non negotiable, ${sev["Important"] ?? 0} Important and ${sev["Minor"] ?? 0} Minor.

The automated conformance run on 18 October covered 1720 checks and 55 failed. The failures sit in probes written for the old text, for example the speeding fraction, the 6 of 10 minimum for the 360 and Override 3. They are the same gaps this report lists, so they clear when the rules version 2.1 below is built.

## By chapter

${table(["Chapter", "Name", "Rows", "Built", "Partial", "Missing", "Unverified", "Differs", "N/A"],
  Object.keys(CH).map((k) => { const x = nw.filter((r) => r.stage === k), c = count(x, "status"); return [k.slice(1), CH[k], x.length, c.Built ?? 0, c.Partial ?? 0, c.Missing ?? 0, c.Unverified ?? 0, c["Differs by decision"] ?? 0, c["Not applicable"] ?? 0]; }))}
## What changed in the rules

These are the value level changes the code must follow. Each one is decided in the rulings document.

${table(["Rule", "Old text and code", "New text", "Ruling"], [
  ["Speeding", "One third of the median", "40% of the median, or 8 minutes if higher", "Adopt (V-02)"],
  ["Quality exclusion", "Speeding plus one other flag", "Any two flags", "Adopt, duplication counts (V-02)"],
  ["Override 3", "Three overrides", "Two overrides", "Remove (V-03)"],
  ["TPS precision", "4 decimals, unrounded", "2 decimals, half up", "Switch (V-04)"],
  ["360 minimum, sections A to D", "6 of 10", "3", "Lower to 3 (V-05)"],
  ["LRI alignment term", "Section F target", "BUILD, then STRENGTHEN, then Section F", "Implement (V-06)"],
  ["Leader reports", "All Client Admins and Executives", "CHRO designate; Executives see directs only, no section 6", "Build, Client Admins keep access until a CHRO is named (V-01)"],
  ["C3 STRENGTHEN", "Supportive", "Neutral", "Neutral (V-12)"],
  ["GOVERN trade off", "Third priority", "Trade off row only", "Engine changes (V-14)"],
  ["Survey labels", "Neutral A to D chips", "Orientation names", "Show names (V-08)"],
  ["Respondent bands", "Promoters, Passives, Detractors", "Advocates, Neutrals, Critics", "Replace everywhere (V-16)"],
  ["eOS display bands", "Switch at 20", "Switch at 30", "Follow the new text"],
  ["Sector and maturity drive C4", "B6 business model only", "Sector and maturity drive C4", "Parked, owner supplies the mapping (V-30)"],
])}
## Non negotiable and Blocker gaps (new rows)

${table(["Row", "Status", "Requirement"], nonneg.map((r) => [`\`${r.id}\``, r.status, cut(r.requirement, 130)]))}
## Part B, the new material

Chapter 11 (the action planning reference with four playbooks) and chapter 12 (the report composition engine) are mostly new. ${nw.filter((r) => ["N11", "N12"].includes(r.stage)).length} rows were checked: ${nw.filter((r) => ["N11", "N12"].includes(r.stage) && r.status === "Built").length} are built. Thresholds, the stepping stone rule, the business model pairs and the worked example numbers already match. The library is still a code constant, with no library tables, no commitment matrix, no commitment charter or ExCo pack renderers and no outcome learning. You ruled that the first client needs the library as data and the structured section object, with fit scoring after.

## Proposed fix order

For your approval. Nothing below has been started.

**1. Rules version 2.1 and the engine (decisions V-02 to V-07, V-12, V-14, V-16)**
Speeding and exclusion, Override 3 removed, 2 decimal TPS, the 360 minimum of 3, the LRI chain, the C3 STRENGTHEN rule, GOVERN trade off, the Advocates, Neutrals and Critics terms, and the terminology gate failing closed when its secret is missing. Both the engine and the Python oracle, oracle regenerated, a new rules version so every frozen result keeps its stored version.

**2. Leader access and privacy (V-01)**
CHRO designate column set by the consultant, Executives limited to directs and no section 6, audit of every read, the integrity flag escalation to the CHRO and the 360 consent wording, the ethical use statement and carrier visibility, the export guard on every leader export path, and RLS tests for \`UT-54\` and \`UT-55\`. Needs your approval of the schema change.

**3. Respondent and launch screens**
Orientation names on the survey (V-08), eOS bands, executive grade flag required before launch, reminders and window extension, void response and exclusion log, 360 free text items (V-11, needs your wording).

**4. Reports and exports (V-41)**
Findings wired to segments and leaders in the app, then the Sub culture, Leader, Leadership team and Action plan reports, the seven slide sub culture export, Excel, then Word. New palette and NOW and PREFERRED colours, footer wording without the dash (V-15), release gate of 8 checks.

**5. Action planning gaps**
Action record fields (milestones, linked finding, closure outcome, stored and declared RAG), unit level actions, four level commitments, readiness gate fixes (D7 blocks nothing, D9 blocks everything), reminders and the escalation ladder as jobs, role dashboards, the KPI culture alignment finding (V-13), the fifth lever (V-23), Leader Development Plan links.

**6. Chapter 12 library as data (V-40)**
Library tables, \`reference_library_id\` on actions, faculty edit with version pinning, the structured section object.

**7. Go live hardening**
Two step sign in (needs your written yes), 5,000 respondent load test, penetration test, accessibility audit, backup and restore test, rate limiting.

## Open points for the owner

- Wording for the 360 free text items (V-11).
- The sector and maturity to business model mapping (V-30).
- Rows that the new text supersedes keep their old ids and are noted with old: in the matrix notes.
- Reminder: hand over the second developer specification for a full cross check after all journeys end.
`;
md = md.replace(/(?<!`)\bV-(\d+)\b/g, "`V-$1`");
writeFileSync("docs/SPEC_CROSSCHECK_V21B_2026-10.md", md);
console.log(`wrote ${md.split(/\s+/).length} words, ${nonneg.length} non negotiable rows`);
