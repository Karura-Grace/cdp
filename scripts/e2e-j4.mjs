// Journey 4 on the Ostravane demo (seed-rich-demo.mjs): finding annotations (never change a verdict, insert only, consultant only),
// the findings console and scorecard pages, and what the stored evaluation holds (no per leader findings, ids in order).
// node --env-file=apps/web/.env.local scripts/e2e-j4.mjs [base-url]
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const pw = passwords();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Ostravane Logistics (demo)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).order("created_at").limit(1).single();
const A = asm.assessment_id;
const C = "consultant@cdp-demo.example", ADM = "admin.meridian@cdp-demo.example", EXE = "exec.meridian@cdp-demo.example";
const cl = {}, tok = {};
for (const e of [C, ADM, EXE]) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: e, password: pw[e] });
  if (error) throw new Error(e + ": " + error.message);
  cl[e] = c; tok[e] = data.session.access_token;
}
const call = async (who, method, path, body) => { const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${tok[who]}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null)]; };

const { data: ev } = await svc.from("evaluation").select("score_version, payload_json, payload_hash").eq("assessment_id", A).order("score_version", { ascending: false }).limit(1).single();
const F = ev.payload_json.findings;
ok("the demo has an evaluation with findings", F.length > 0, `${F.length}`);
ok("finding ids run in order from fnd_0001", F.every((f, i) => f.finding_id === `fnd_${String(i + 1).padStart(4, "0")}`), JSON.stringify(F.map((f) => f.finding_id)));
ok("the stored evaluation names no leader (no LEADER_FLAG findings)", F.every((f) => f.type !== "LEADER_FLAG" && !("leader" in f)), JSON.stringify(F.filter((f) => f.type === "LEADER_FLAG")));
const fid = F[0].finding_id, verdict = F[0].verdict;

let [s, j] = await call(C, "POST", `/v1/assessments/${A}/annotations`, { finding_id: fid, body: "Ask the CEO whether this matches what the board sees." });
ok("consultant adds a note (201)", s === 201 && j.finding_id === fid, `${s} ${j?.code} ${j?.title}`);
[s, j] = await call(C, "GET", `/v1/assessments/${A}/annotations`);
ok("the note is listed for the latest score version", s === 200 && j.score_version === ev.score_version && j.annotations.some((n) => n.finding_id === fid), `${s}`);
[s, j] = await call(C, "POST", `/v1/assessments/${A}/annotations`, { finding_id: "fnd_9999", body: "x" });
ok("a note on an unknown finding is refused (422)", s === 422, `${s}`);
[s] = await call(C, "POST", `/v1/assessments/${A}/annotations`, { finding_id: "nope", body: "x" });
ok("a malformed finding id is refused (422)", s === 422, `${s}`);
[s] = await call(C, "POST", `/v1/assessments/${A}/annotations`, { finding_id: fid, body: "   " });
ok("an empty note is refused (422)", s === 422, `${s}`);
[s] = await call(C, "POST", `/v1/assessments/${A}/annotations`, { finding_id: fid, body: "x".repeat(2001) });
ok("a note over 2000 characters is refused (422)", s === 422, `${s}`);
for (const who of [ADM, EXE]) {
  [s] = await call(who, "POST", `/v1/assessments/${A}/annotations`, { finding_id: fid, body: "client note" });
  ok(`${who.split("@")[0]} cannot add a note (403)`, s === 403, `${s}`);
  [s] = await call(who, "GET", `/v1/assessments/${A}/annotations`);
  ok(`${who.split("@")[0]} cannot read notes (403)`, s === 403, `${s}`);
  const r = await cl[who].from("finding_annotation").select("annotation_id", { count: "exact", head: true }).eq("assessment_id", A);
  ok(`${who.split("@")[0]} reads no annotation rows by table either`, !r.error && r.count === 0, `${r.error?.message} ${r.count}`);
}
const upd = await svc.from("finding_annotation").update({ body: "changed" }).eq("assessment_id", A);
ok("notes are immutable (update refused)", !!upd.error, "updated");
const del = await svc.from("finding_annotation").delete().eq("assessment_id", A);
ok("notes cannot be deleted", !!del.error, "deleted");
const { data: ev2 } = await svc.from("evaluation").select("payload_hash, payload_json").eq("assessment_id", A).eq("score_version", ev.score_version).single();
ok("a note leaves the evaluation and its hash untouched", ev2.payload_hash === ev.payload_hash && ev2.payload_json.findings[0].verdict === verdict, "changed");

// pages
const page = async (path) => { const r = await fetch(base + path, { headers: { cookie: "" , authorization: `Bearer ${tok[C]}` }, redirect: "manual" }); return r.status; };
const st = await page(`/assessments/${A}/findings`);
ok("the findings page answers (200, or a redirect to sign in without a cookie)", [200, 302, 307].includes(st), `${st}`);
done();
