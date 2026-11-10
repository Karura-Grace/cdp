// Checks the evidence behind every Built and Differs claim in the cross check parts:
//  - each file:line in evidence_code exists (line within the file);
//  - each test reference in evidence_test names a file that exists, and its label text appears in that file
//    (an ok("...") label in a script, an it("...") or describe name in an engine test, or a probe id).
// Rows that fail are printed, and written to docs/spec-crosscheck/verify-report.json for manual review.
//   node scripts/conformance/verify-claims.mjs [part.csv ...]
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseCsv } from "./csv.mjs";

const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync("docs/spec-crosscheck/parts").filter((f) => f.endsWith(".csv")).map((f) => `docs/spec-crosscheck/parts/${f}`);
// every tracked file whose path ends with the name given (a bare "scoring.ts" matches the engine and the app copy)
const findFiles = (name) => {
  if (existsSync(name)) return [name];
  try { return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", `*${name.replace(/^.*\//, "")}`], { encoding: "utf8" }).split("\n").filter((p) => p && p.endsWith(name)); } catch { return []; }
};
// the label a reference points at: the first quoted text if any, without trailing dots, brackets and quotes
const labelOf = (t) => { const q = /["'“‘]([^"'”’]{6,})["'”’]/.exec(t); return norm((q ? q[1] : t).replace(/(\.\.\.|…).*$/, "").replace(/^[\s(:#-]*(check|test|ok|it)?\s*[:#(]?\s*/i, "").replace(/[()]/g, "")).slice(0, 40); };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const out = [];
let checked = 0;
for (const f of files) for (const r of parseCsv(readFileSync(f, "utf8"))) {
  if (!["Built", "Differs by decision"].includes(r.status)) continue;
  checked++;
  const problems = [];
  for (const m of (r.evidence_code ?? "").matchAll(/([\w./\[\]-]+\.(?:ts|tsx|mjs|sql|py|json)):(\d+)/g)) {
    const ps = findFiles(m[1]);
    if (!ps.length) problems.push(`code file not found: ${m[1]}`);
    else if (!ps.some((p) => readFileSync(p, "utf8").split("\n").length >= Number(m[2]))) problems.push(`line ${m[2]} beyond end of ${m[1]}`);
  }
  if (r.status === "Built") {
    const tests = String(r.evidence_test ?? "").split(/;\s*/).filter(Boolean);
    if (!tests.length) problems.push("no evidence_test");
    let last = null;   // a reference without a file name reuses the previous one ("e2e-ui.mjs: a; b")
    for (const t of tests) {
      const m = /([\w./-]+\.(?:mjs|ts|py))(.*)$/.exec(t.trim());
      const file = m ? m[1] : last;
      if (!file) { problems.push(`test reference names no file: ${t.slice(0, 80)}`); continue; }
      last = file;
      const ps = findFiles(file);
      if (!ps.length) { problems.push(`test file not found: ${file}`); continue; }
      // a unit test or acceptance test is matched by its id (UT-50, AC-2.2); the rest by the start of its label
      const idRef = /\b(UT-\d+|AC-\d\.\d+)\b/i.exec(m ? m[2] : t);
      const label = idRef ? norm(idRef[1]) : labelOf(m ? m[2] : t).split(" ").slice(0, 2).join(" ");
      if (label.length >= 6 && !ps.some((p) => norm(readFileSync(p, "utf8")).includes(label)) && !ps.some((p) => p.includes("probes/"))) problems.push(`label not found in ${file}: "${label}"`);
    }
  }
  if (problems.length) out.push({ file: f.split("/").pop(), id: r.id, status: r.status, problems });
}
writeFileSync("docs/spec-crosscheck/verify-report.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(`${o.file} ${o.id}: ${o.problems.join(" | ")}`);
console.log(`\n${checked} Built or Differs rows checked; ${out.length} need manual review`);
