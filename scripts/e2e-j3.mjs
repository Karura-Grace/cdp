// Journey 3 on the Ostravane demo (seed-rich-demo.mjs): the filter builder (AND of cuts, "fewer than 5", 409 on a small group alone),
// the exact resolved count in the query log (hidden from staff), the Excel export, and the role guards.
// node --env-file=apps/web/.env.local scripts/e2e-j3.mjs [base-url]
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const pw = passwords();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Ostravane Logistics (demo)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).order("created_at").limit(1).single();
const A = asm.assessment_id;
const C = "consultant@cdp-demo.example", ADM = "admin.meridian@cdp-demo.example";
const cl = {}, tok = {};
for (const e of [C, ADM]) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: e, password: pw[e] });
  if (error) throw new Error(e + ": " + error.message);
  cl[e] = c; tok[e] = data.session.access_token;
}
const f = async (who, qs, path = "filter") => { const r = await fetch(`${base}/v1/assessments/${A}/segments/${path}?${qs}`, { headers: { authorization: `Bearer ${tok[who]}` } }); return [r, r.headers.get("content-type")]; };
const fj = async (who, qs) => { const [r] = await f(who, qs); return [r.status, await r.json().catch(() => null)]; };

const { data: dep } = await (async () => { const r = await fetch(`${base}/v1/assessments/${A}/segments?axis=department`, { headers: { authorization: `Bearer ${tok[C]}` } }); return { data: await r.json() }; })();
const dept = dep.cells.find((c) => !c.suppressed).value;

let [s, j] = await fj(C, `p=department:${encodeURIComponent(dept)}&count_only=1`);
ok("count_only on a reported group: count, not below", s === 200 && j.below === false && j.count >= 5, `${s} ${JSON.stringify(j)}`);
[s, j] = await fj(C, "p=tenure_band:Under%201%20year&count_only=1");
ok('count_only on a small group: only "fewer than 5", no count', s === 200 && j.below === true && j.label === "fewer than 5" && !("count" in j), `${s} ${JSON.stringify(j)}`);
[s, j] = await fj(C, "p=tenure_band:Under%201%20year");
ok("a small group on its own -> 409 BELOW_REPORTING_THRESHOLD", s === 409 && j?.code === "BELOW_REPORTING_THRESHOLD", `${s} ${j?.code}`);
[s, j] = await fj(C, `p=department:${encodeURIComponent(dept)}`);
ok("a reported group returns its results and the sub-culture verdict inputs", s === 200 && j.metrics?.subculture && j.metrics.n === j.count, `${s}`);
[s, j] = await fj(C, `p=department:${encodeURIComponent(dept)}&p=grade:Staff&p=tenure_band:Under%201%20year`);
ok("AND of three cuts that is too small -> 409", s === 409, `${s}`);
[s] = await fj(C, "p=department:A&p=department:B");
ok("the same cut twice -> 422", s === 422, `${s}`);
[s] = await fj(C, "p=department:A&p=grade:B&p=team:C&p=location:D");
ok("four cuts -> 422", s === 422, `${s}`);
[s] = await fj(C, "p=salary:high");
ok("unknown axis -> 422", s === 422, `${s}`);
[s] = await fj(C, "");
ok("no cut -> 422", s === 422, `${s}`);
[s] = await fj(ADM, `p=department:${encodeURIComponent(dept)}&count_only=1`);
ok("client admin cannot use the filter", s === 403, `${s}`);

// the exact count is logged, and staff cannot read the column
const { data: logged } = await svc.from("segment_query_log").select("resolved_count, outcome").eq("assessment_id", A).order("at", { ascending: false }).limit(5);
ok("recent queries carry the exact resolved count", logged.length >= 3 && logged.every((r) => Number.isInteger(r.resolved_count)), JSON.stringify(logged));
ok("a suppressed query logged a count under the floor", logged.some((r) => r.outcome === "SUPPRESSED" && r.resolved_count < 5), JSON.stringify(logged));
const peek = await cl[C].from("segment_query_log").select("resolved_count").limit(1);
ok("the consultant cannot read resolved_count", !!peek.error, JSON.stringify(peek.data));
const okcols = await cl[C].from("segment_query_log").select("axis, outcome").limit(1);
ok("the consultant can still read the other log columns", !okcols.error, okcols.error?.message);

// export
const [r, ct] = await f(C, "", "export");
const buf = Buffer.from(await r.arrayBuffer());
ok("export is an xlsx file", r.status === 200 && /spreadsheetml/.test(ct ?? "") && buf[0] === 0x50 && buf[1] === 0x4b && buf.length > 2000, `${r.status} ${ct} ${buf.length}`);
const [r2] = await f(ADM, "", "export");
ok("client admin cannot export", r2.status === 403, `${r2.status}`);

// the J3 tables hide from client roles (no rows before release) and the consultant can read them
for (const t of ["segment_profile", "leader_link_result", "setup_system_note"]) {
  const a = await cl[ADM].from(t).select("*", { count: "exact", head: true }).eq("assessment_id", A);
  ok(`client admin reads no ${t} rows before release`, !a.error && a.count === 0 || (t === "setup_system_note" && !a.error), `${a.error?.message} ${a.count}`);
  const c = await cl[C].from(t).select("*", { count: "exact", head: true }).eq("assessment_id", A);
  ok(`consultant can query ${t}`, !c.error, c.error?.message);
}
done();
