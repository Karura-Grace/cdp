// Merges docs/spec-crosscheck/parts/*.csv into docs/spec-crosscheck/requirements.csv (the matrix), checks ids and values,
// and prints counts by status and stage. Keeps status_auto and last_run from an existing matrix.
//   node scripts/conformance/merge.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { parseCsv, toCsv } from "./csv.mjs";
import { applyClosures } from "./closures.mjs";

const COLS = ["id", "spec_ref", "stage", "kind", "requirement", "status", "severity", "evidence_code", "evidence_test", "decision_ref", "notes", "status_auto", "last_run"];
const STATUS = ["Built", "Partial", "Missing", "Differs by decision", "Not applicable", "Unverified"];
const SEV = ["", "Blocker", "Non negotiable", "Important", "Minor"];
const prev = existsSync("docs/spec-crosscheck/requirements.csv") ? Object.fromEntries(parseCsv(readFileSync("docs/spec-crosscheck/requirements.csv", "utf8")).map((r) => [r.id, r])) : {};
const seen = new Map(), rows = [], problems = [];
// rows the verifier could not back (scripts/conformance/verify-claims.mjs writes verify-report.json): a missing test reference
// downgrades Built to Unverified; a bad code line only adds a note
const vr = existsSync("docs/spec-crosscheck/verify-report.json") ? Object.fromEntries(JSON.parse(readFileSync("docs/spec-crosscheck/verify-report.json", "utf8")).map((x) => [x.id, x.problems])) : {};
for (const f of readdirSync("docs/spec-crosscheck/parts").filter((x) => x.endsWith(".csv")).sort()) {
  for (const r of parseCsv(readFileSync(`docs/spec-crosscheck/parts/${f}`, "utf8"))) {
    if (!r.id) { problems.push(`${f}: row without id`); continue; }
    if (seen.has(r.id)) { problems.push(`duplicate id ${r.id} in ${f} and ${seen.get(r.id)}`); r.id = `${r.id}~${f.slice(0, 3)}`; }
    seen.set(r.id, f);
    const vp = vr[r.id] ?? vr[r.id.replace(/~.*$/, "")];
    if (vp && r.status === "Built" && vp.some((p) => !p.startsWith("code file") && !p.startsWith("line "))) { r.status = "Unverified"; r.notes = (r.notes ? r.notes + " " : "") + "Downgraded by the verifier: " + vp.filter((p) => !p.startsWith("line ")).join("; "); }
    else if (vp) r.notes = (r.notes ? r.notes + " " : "") + "Check the cited line: " + vp.join("; ");
    // a row with code but no test that a passing check of the conformance run now proves becomes Built
    if (r.status === "Unverified" && prev[r.id]?.status_auto === "PASS") { r.status = "Built"; r.severity = ""; r.notes = (r.notes ? r.notes + " " : "") + "Proved by the conformance run."; }
    if (r.status === "Unverified" && !r.severity) r.severity = ["ac", "rule", "calc", "api", "role", "ut", "data", "error"].includes(r.kind) ? "Important" : "Minor";
    if (!STATUS.includes(r.status)) problems.push(`${r.id}: bad status "${r.status}"`);
    if (!SEV.includes(r.severity)) problems.push(`${r.id}: bad severity "${r.severity}"`);
    if (["Partial", "Missing", "Unverified"].includes(r.status) && !r.severity) problems.push(`${r.id}: ${r.status} without severity`);
    if (r.status === "Differs by decision" && !r.decision_ref) problems.push(`${r.id}: Differs without decision_ref`);
    rows.push({ ...r, status_auto: prev[r.id]?.status_auto ?? "", last_run: prev[r.id]?.last_run ?? "" });
  }
}
problems.push(...applyClosures(rows));
writeFileSync("docs/spec-crosscheck/requirements.csv", toCsv(rows, COLS));
const tally = (key) => rows.reduce((m, r) => ({ ...m, [r[key]]: (m[r[key]] ?? 0) + 1 }), {});
console.log(`${rows.length} requirements`, JSON.stringify(tally("status")));
console.log("severity of not built:", JSON.stringify(rows.filter((r) => ["Partial", "Missing", "Unverified"].includes(r.status)).reduce((m, r) => ({ ...m, [r.severity]: (m[r.severity] ?? 0) + 1 }), {})));
console.log(problems.length ? `\n${problems.length} problems:\n${problems.slice(0, 40).join("\n")}` : "\nno problems");
