// Turns the probe results of the last conformance run into matrix rows for Appendices C, I, J and K (one row per requirement id).
//   node scripts/conformance/probe-rows.mjs   -> docs/spec-crosscheck/parts/p09-appendix-C-I-J-K.csv
import { readFileSync, writeFileSync } from "node:fs";
import { toCsv } from "./csv.mjs";
import { AB } from "./appendix-ab-overrides.mjs";

const { results } = JSON.parse(readFileSync("docs/spec-crosscheck/last-run.json", "utf8"));
const by = new Map();
for (const r of results) {
  const m = /^\[(APP[ABCIJK]-[^\]]+)\]\s*(.*)$/.exec(r.label);
  if (!m) continue;
  if (!by.has(m[1])) by.set(m[1], []);
  by.get(m[1]).push({ ...r, text: m[2] });
}
const SECT = { A: "A L2109", B: "B L2146", C: "C", I: "I L2627", J: "J L2680", K: "K L2711" };
const rows = [];
for (const [id, checks] of by) {
  const app = id[3], all = checks.every((c) => c.pass), none = checks.every((c) => !c.pass), probe = checks[0].suite;
  const ev = checks.map((c) => `${probe}: ${c.text}`).join("; ");
  let status, severity = "", notes = checks.filter((c) => !c.pass).map((c) => c.text).join("; ");
  if (all) status = "Built";
  else if (app === "J") {
    const raised = checks.find((c) => c.text.startsWith("raised in"))?.pass;
    status = !raised ? "Missing" : "Partial";
    severity = ["AI_INTEGRITY_BLOCKED"].some((k) => id.includes(k)) ? "Important" : "Important";
  } else if (app === "K") { status = notes.includes("audit log") || checks.some((c) => !c.pass && /audit/.test(c.text)) ? "Partial" : "Missing"; severity = "Important"; }
  else if (app === "C") { status = "Partial"; severity = "Minor"; }
  else { status = none && notes.includes("present") ? "Missing" : "Partial"; severity = "Important"; }
  rows.push({ id, spec_ref: id.startsWith("APPC-D") || id.startsWith("APPC-T108") || id.startsWith("APPC-T109") ? "C.1" : id.startsWith("APPC-D7") || id.startsWith("APPC-T110") ? "C.2" : id.startsWith("APPC-EOS") || id.startsWith("APPC-QUAL") || id.startsWith("APPC-T11") ? "C.3" : id.startsWith("APPC-L") || id.startsWith("APPC-T113") ? "C.4" : SECT[app] ?? app,
    stage: app, kind: { A: "data", B: "api", C: "data", I: "config", J: "error", K: "event" }[app], requirement: checks[0].text.replace(/ (present|matches.*|default.*)$/, "") || id,
    status, severity: all ? "" : severity, evidence_code: "", evidence_test: ev, decision_ref: "", notes: all ? "" : notes });
}
// requirement text in spec terms, and the one deliberate departure
for (const r of rows) {
  const k = r.id.replace(/^APP[CIJK]-/, "");
  if (r.stage === "J") r.requirement = `Error ${k} is raised with its HTTP status from Table 120 and asserted by a test`;
  if (r.stage === "K") r.requirement = `Domain event ${k} is emitted to event_outbox for its consumers (Table 121)`;
  if (r.stage === "I") r.requirement = `Configuration key ${k} exists with the Table 119 default`;
  if (r.id === "APPJ-ALREADY_SUBMITTED") { r.status = "Differs by decision"; r.severity = ""; r.decision_ref = "D-NEUTRAL410"; r.notes = "A used link answers 410 TOKEN_INVALID with a neutral message, like an unknown or expired one, so a link cannot be probed (CLAUDE.md section 4). No test asserts it yet."; }
}
for (const r of rows) {
  if (r.id === "APPB-table" || r.id === "APPA-table") continue;
  const o = AB[r.id];
  if (o) { [r.status, r.severity, r.decision_ref, r.notes] = o; }
  if (r.stage === "A") r.requirement = `Table ${r.id.replace("APPA-", "")} exists with the Appendix A columns`;
  if (r.stage === "B") r.requirement = r.requirement.replace(/\s*\(.*$/, "") + " exists and behaves as Table 107 says";
}
for (const r of rows) if (r.id === "APPB-19" && r.status === "Built") r.status = "Built";
// readiness items D7 to D9 are C.2, the rest of the scenario ids are C.1
for (const r of rows) if (/^APPC-D[789]-/.test(r.id)) r.spec_ref = "C.2";
writeFileSync("docs/spec-crosscheck/parts/p09-appendix-C-I-J-K.csv", toCsv(rows, ["id", "spec_ref", "stage", "kind", "requirement", "status", "severity", "evidence_code", "evidence_test", "decision_ref", "notes"]));
const count = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
console.log(`${rows.length} rows`, JSON.stringify(count));
