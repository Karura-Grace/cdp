// Maps conformance check results to matrix rows and writes status_auto and last_run (used by scripts/conformance.mjs, or alone):
//   node scripts/conformance/map.mjs      re-maps docs/spec-crosscheck/last-run.json onto requirements.csv without running anything
// A row matches by its own id in brackets at the start of a check label ("[APPI-segments.floor] ..."); only if no check carries
// its id does it fall back to the labels named in evidence_test ("e2e-ui.mjs: login page renders", "spec.test.ts UT-29").
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseCsv, toCsv } from "./csv.mjs";

const refs = (s) => String(s ?? "").split(/;\s*/).map((e) => { const m = /([\w.-]+\.(?:mjs|ts))[:>\s]+(.+)/.exec(e.trim()); return m ? { file: m[1], label: m[2].replace(/^["']|["']$/g, "").trim() } : null; })
  .filter((x) => x && x.label.length >= 12);

export function mapResults(results, started, matrix = "docs/spec-crosscheck/requirements.csv") {
  const rows = parseCsv(readFileSync(matrix, "utf8"));
  const cols = [...Object.keys(rows[0])];
  let mapped = 0;
  for (const row of rows) {
    const own = results.filter((x) => x.label.startsWith(`[${row.id}]`));
    const hits = own.length ? own : results.filter((x) => refs(row.evidence_test).some((ref) => x.suite.includes(ref.file) && x.label.toLowerCase().includes(ref.label.toLowerCase())));
    row.status_auto = ""; row.last_run = "";
    if (!hits.length) continue;
    mapped++;
    row.status_auto = hits.every((h) => h.pass) ? "PASS" : `FAIL (${hits.filter((h) => !h.pass).length} of ${hits.length})`;
    row.last_run = started.slice(0, 10);
  }
  writeFileSync(matrix, toCsv(rows, cols));
  return { mapped, total: rows.length };
}

if (process.argv[1].endsWith("map.mjs") && existsSync("docs/spec-crosscheck/last-run.json")) {
  const run = JSON.parse(readFileSync("docs/spec-crosscheck/last-run.json", "utf8"));
  const r = mapResults(run.results, run.started);
  console.log(`matrix: ${r.mapped} of ${r.total} rows proved or disproved by the run of ${run.started.slice(0, 10)}`);
}
