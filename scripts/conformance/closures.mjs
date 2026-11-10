// Applies docs/spec-crosscheck/closures/*.json on top of the merged matrix. Each file is a list of
// { id, status, severity?, evidence_code, evidence_test, notes? } written by the person who closed the row.
// merge.mjs calls applyClosures(rows) after merging the parts, so a re merge keeps every closure.
import { readFileSync, readdirSync, existsSync } from "node:fs";

const DIR = "docs/spec-crosscheck/closures";
export function applyClosures(rows) {
  if (!existsSync(DIR)) return [];
  const byId = new Map(rows.map((r) => [r.id, r])), problems = [], SEV = { Medium: "Important", Low: "Minor" };
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
    for (const c of JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))) {
      let r = byId.get(c.id);
      if (!r) {   // a requirement found while building (not in the first extraction): added with the stage of its prefix
        if (!c.requirement) { problems.push(`${f}: unknown id ${c.id} (add a requirement sentence to create it)`); continue; }
        r = { id: c.id, spec_ref: c.spec_ref ?? "", stage: c.stage ?? "", kind: c.kind ?? "rule", requirement: c.requirement, status: "", severity: "", evidence_code: "", evidence_test: "", decision_ref: "", notes: "", status_auto: "", last_run: "" };
        rows.push(r); byId.set(c.id, r);
      }
      if (c.status === "Built" && (!c.evidence_code || !c.evidence_test)) { problems.push(`${f}: ${c.id} Built needs evidence_code and evidence_test`); continue; }
      r.status = c.status; r.severity = c.status === "Built" ? "" : (SEV[c.severity] ?? c.severity ?? r.severity);
      if (c.evidence_code) r.evidence_code = c.evidence_code;
      if (c.evidence_test) r.evidence_test = c.evidence_test;
      r.notes = c.notes ?? (c.status === "Built" ? `Closed in ${f.replace(/\.json$/, "")}.` : r.notes);
      if (c.decision_ref) r.decision_ref = c.decision_ref;
    }
  }
  return problems;
}
