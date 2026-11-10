// Segments API on the Ostravane demo (seed-rich-demo.mjs): heatmaps per axis, suppression of a small group, 409 on a
// parent below the floor, role guard, and the insert-only query log.
//   node --env-file=apps/web/.env.local scripts/e2e-segments.mjs [base-url]
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const pw = passwords();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Ostravane Logistics (demo)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).order("created_at").limit(1).single();
const A = asm.assessment_id;
const tok = {};
for (const e of ["consultant@cdp-demo.example", "admin.meridian@cdp-demo.example"]) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: e, password: pw[e] });
  if (error) throw new Error(e + ": " + error.message);
  tok[e] = data.session.access_token;
}
const get = async (who, q) => { const r = await fetch(`${base}/v1/assessments/${A}/segments?${q}`, { headers: { authorization: `Bearer ${tok[who]}` } }); return [r.status, await r.json().catch(() => null)]; };
const C = "consultant@cdp-demo.example";

const before = (await svc.from("segment_query_log").select("query_id", { count: "exact", head: true }).eq("assessment_id", A)).count;
let [s, j] = await get(C, "axis=department");
ok("department heatmap 200", s === 200, `${s} ${j?.code} ${j?.title}`);
ok("every department (5 or more answers) is reported", j?.cells?.length === 5 && j.cells.every((c) => !c.suppressed && c.n >= 5 && c.metrics), JSON.stringify(j?.cells?.map((c) => [c.value, c.n])));
[s, j] = await get(C, "axis=grade");
ok("grade heatmap 200 with every grade reported", s === 200 && j.cells.length === 3 && j.cells.every((c) => !c.suppressed && c.metrics), `${s}`);
[s, j] = await get(C, "axis=tenure_band");
const small = j?.cells?.filter((c) => c.suppressed) ?? [];
ok("the two small tenure bands are hidden with a roll-up, the rest reported", s === 200 && small.length === 2 && small.every((c) => c.n === null && !c.metrics && c.rollup_label) && j.cells.filter((c) => !c.suppressed).length === 3, JSON.stringify(j?.cells?.map((c) => [c.value, c.n])));
[s, j] = await get(C, "axis=department&parent_axis=tenure_band&parent_value=Under%201%20year");
ok("parent below floor -> 409 BELOW_REPORTING_THRESHOLD", s === 409 && j?.code === "BELOW_REPORTING_THRESHOLD", `${s} ${j?.code}`);
[s, j] = await get(C, "axis=salary");
ok("unknown axis -> 422", s === 422, `${s}`);
// Journey 3 S1: the executive flag reads as Executive or Staff; division and location are cuts too (seeded links predate them, so one UNKNOWN group)
[s, j] = await get(C, "axis=executive");
ok("executive axis 200, values read Executive or Staff", s === 200 && j.cells.every((c) => ["Executive", "Staff"].includes(c.value) || c.suppressed), `${s} ${JSON.stringify(j?.cells?.map((c) => c.value))}`);
for (const ax of ["division", "location"]) { [s, j] = await get(C, `axis=${ax}`); ok(`${ax} is an accepted cut (200)`, s === 200, `${s} ${j?.code}`); }
[s, j] = await get(C, "axis=grade&parent_axis=grade&parent_value=Staff");
ok("parent axis equal to axis -> 422", s === 422, `${s}`);
[s, j] = await get("admin.meridian@cdp-demo.example", "axis=department");
ok("client admin cannot query segments", s === 403, `${s}`);
const after = (await svc.from("segment_query_log").select("query_id", { count: "exact", head: true }).eq("assessment_id", A)).count;
ok("7 allowed or refused queries logged (4 earlier ones, executive, division, location)", after - before === 7, `${after - before}`);
const del = await svc.from("segment_query_log").delete().eq("assessment_id", A);
ok("query log refuses delete", !!del.error, "deleted");
done();
