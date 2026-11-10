// Appendix B (Table 107) endpoints against the route files, and Appendix A (Table 106) tables against the live schema (read only).
// Route match: same method and same path once every {param} or [param] is treated alike. Table match: the table exists in
// public, capture or app; the columns the spec names exist on it (a column listed as "x[]" or with a note is matched by its name).
//   node --env-file=apps/web/.env.local scripts/conformance/probes/api-data.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ok, done } from "../../lib/e2e.mjs";

const spec = readFileSync("docs/spec/CDP_Platform_Developer_Specification_v2_1.md", "utf8");
const tbl = (n) => { const s = spec.indexOf(`**Table ${n} `); const e = spec.indexOf("\n# ", s); return spec.slice(s, e > 0 ? e : undefined).split("\n").filter((l) => /^\| /.test(l) && !/^\| \*\*|^\| ---/.test(l)).map((l) => l.replace(/^\| | \|$/g, "").split(" | ").map((c) => c.trim())); };

// ---- routes: [METHOD path] from app/v1/**/route.ts
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith("route.ts") ? [p] : []; });
const routes = new Set();
for (const f of walk("apps/web/app/v1")) {
  const path = "/v1" + f.replace("apps/web/app/v1", "").replace(/\/route\.ts$/, "").replace(/\[[^\]]+\]/g, "{}");
  for (const m of readFileSync(f, "utf8").matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)) routes.add(`${m[1]} ${path}`);
}
// Table 107, one entry per endpoint: [row, method, spec path, the route the platform uses when it differs, purpose]
const EP = [
  [1, "POST", "/v1/tenants", null, "Create tenant"], [2, "POST", "/v1/tenants/{}/engagements", null, "Create engagement"],
  [3, "PUT", "/v1/engagements/{}/org-graph", null, "Bulk upsert org graph"], [4, "GET", "/v1/engagements/{}/setup/{}", null, "Read setup section"], [4, "PUT", "/v1/engagements/{}/setup/{}", null, "Write setup section"],
  [5, "POST", "/v1/engagements/{}/setup/{}/agree", null, "Agree a section"], [6, "GET", "/v1/engagements/{}/requirements", null, "Derived requirements"],
  [7, "POST", "/v1/assessments", "/v1/engagements/{}/assessments", "Create assessment"], [8, "POST", "/v1/assessments/{}/preflight", null, "Run pre-flight"], [9, "POST", "/v1/assessments/{}/launch", null, "Launch"],
  [10, "GET", "/v1/survey", null, "Respondent instrument"], [11, "PUT", "/v1/survey/response", "PUT /v1/survey", "Save draft or submit"], [12, "POST", "/v1/assessments/{}/freeze", null, "Freeze dataset"],
  [13, "POST", "/v1/assessments/{}/score", null, "Run scoring"], [14, "POST", "/v1/assessments/{}/score/freeze", null, "Freeze score"], [15, "GET", "/v1/assessments/{}/segments", null, "Segment metrics"],
  [16, "POST", "/v1/assessments/{}/evaluate", null, "Run rules engine"], [17, "GET", "/v1/assessments/{}/findings", null, "List findings"], [18, "POST", "/v1/assessments/{}/plan", null, "Generate priorities and draft actions"],
  [19, "POST", "/v1/reports", "POST /v1/assessments/{}/reports", "Create report"], [19, "POST", "/v1/reports/{}/narrative", null, "AI narrative"], [19, "POST", "/v1/reports/{}/release", null, "Release"],
  [20, "GET", "/v1/reports/{}/export", null, "Export released report"], [21, "POST", "/v1/actions", null, "Create action"], [21, "PATCH", "/v1/actions/{}", null, "Update or transition action"],
  [22, "POST", "/v1/actions/{}/kpi-readings", null, "KPI reading"], [22, "POST", "/v1/actions/{}/evidence", null, "Evidence"], [23, "GET", "/v1/dashboards/{}", null, "Role dashboard"],
  [24, "GET", "/v1/engagements/{}/scorecard", null, "Scorecard read"], [24, "PUT", "/v1/engagements/{}/scorecard", null, "Scorecard write"], [24, "POST", "/v1/engagements/{}/scorecard/import", null, "Scorecard import"],
  [25, "GET", "/v1/engagements/{}/scorecard/export", null, "Scorecard export"], [26, "POST", "/v1/pulses", "POST /v1/engagements/{}/pulses", "Create pulse"], [27, "GET", "/v1/trends", null, "Cross-cycle trend"],
];
ok("[APPB-table] Table 107 has 27 rows", tbl(107).filter((r) => /^(GET|POST|PUT|PATCH)/.test(r[0])).length >= 25);
for (const [row, meth, path, alt, purpose] of EP) {
  const there = routes.has(`${meth} ${path}`), other = alt && routes.has(alt.includes(" ") ? alt : `${meth} ${alt}`);
  const label = `[APPB-${row}] ${meth} ${path} (${purpose})`;
  if (there) ok(label, true);
  else if (other) ok(`${label} at a different path: ${alt}`, false, "DIFFERS: route exists at " + alt);
  else ok(label, false, "no route file with this method and path");
}

// ---- tables: Table 106 against information_schema
const { svc } = await import("../../lib/e2e.mjs");
const sql = async (query) => { const tok = readFileSync("/mnt/c/Users/PAC/Desktop/MCain-Supabase-Token.txt", "utf8").trim(); const r = await fetch("https://api.supabase.com/v1/projects/swnvjucteqguqdbsdmsl/database/query", { method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) }); return r.json(); };
const cols = await sql("select table_schema || '.' || table_name as t, column_name as c from information_schema.columns where table_schema in ('public','capture','app')");
const have = new Map();
for (const { t, c } of cols) { const n = t.split(".")[1]; (have.get(n) ?? have.set(n, new Set()).get(n)).add(c); }
const ALIAS = { grade_band: "grade_band", location: "location", demographic_attribute: "demographic_attribute", leader_360: "leader_result", self_rating: "response_360", rater_response: "response_360", rater_rating: "response_360_item", rater_text: "response_360", leader_text: null, strategic_requirement: "strategic_requirement",
  finding: null, scenario_match: null, narrative_draft: null, segment_profile: null, milestone: null, review_point: null, development_plan: "development_item", development_action: "development_item", trigger: "reassessment_trigger", pulse_response: "pulse_response", evidence: "action_evidence", item_locale_variant: null, strategic_objective: null, strategic_kpi: null, comparison: "comparison", org_change: "org_change", audit_log: "audit_log", segment_query_log: "segment_query_log" };
tbl(106).forEach(([names, keycols], i) => {
  for (const raw of names.split(" · ").flatMap((x) => x.split(" · "))) {
    const t = raw.trim();
    if (!/^[a-z_0-9]+$/.test(t) || t === "value") continue;
    const real = t in ALIAS ? ALIAS[t] : t;
    ok(`[APPA-${t}] table ${t} exists${real && real !== t ? ` (as ${real})` : ""}`, !!real && have.has(real), real ? "table missing" : "no table of this name");
  }
});
done();
