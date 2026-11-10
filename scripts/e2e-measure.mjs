// Measure stage (spec chapter 6, step A) on the Ostravane demo's second cycle (scripts/seed-measure-demo.mjs).
//   node --env-file=apps/web/.env.local scripts/e2e-measure.mjs [base-url]
import { ok, done, signIn, svc } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", "Ostravane Logistics (demo)").single();
const { data: engs } = await db.from("engagement").select("engagement_id, cycle_no").eq("tenant_id", ten.tenant_id).order("cycle_no");
const [E1, E2] = engs.map((e) => e.engagement_id);
const who = {};
for (const [k, e] of Object.entries({ consultant: "consultant@cdp-demo.example", admin: "admin.meridian@cdp-demo.example", exec: "exec.meridian@cdp-demo.example", lead: "lead.meridian@cdp-demo.example", other: "admin.fixture@cdp-demo.example" })) who[k] = await signIn(e);
const api = async (k, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[k].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};

// reads: the comparison is there for the consultant, and for client roles because the cycle 2 report is released
for (const k of ["consultant", "admin", "exec", "lead"]) {
  const { data } = await who[k].c.from("comparison").select("comparison_id, version_relation").eq("engagement_id", E2);
  ok(`${k} reads the stored comparison`, data?.length === 1 && data[0].version_relation === "SAME", JSON.stringify(data));
}
const { data: leak } = await who.other.c.from("comparison").select("comparison_id").eq("engagement_id", E2);
ok("another organisation's client admin sees nothing", (leak ?? []).length === 0);
const { data: leak2 } = await who.other.c.from("org_change").select("org_change_id").eq("engagement_id", E2);
ok("another organisation cannot read org changes", (leak2 ?? []).length === 0);

// the comparison is built from the two frozen scores and cannot be rewritten
const { data: cmp } = await db.from("comparison").select("deltas_json, comparison_id").eq("engagement_id", E2).single();
ok("deltas carry engine numbers for all four orientations", ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"].every((o) => /^-?\d+\.\d{2}$/.test(cmp.deltas_json.now[o])));
ok("movement is towards Engage and Innovate in the demo", Number(cmp.deltas_json.now.ENGAGE) > 0 && Number(cmp.deltas_json.now.PERFORM) < 0);
const upd = await db.from("comparison").update({ version_relation: "MINOR" }).eq("comparison_id", cmp.comparison_id);
ok("a stored comparison cannot be changed", !!upd.error && /APPEND_ONLY|permission denied/.test(upd.error.message), upd.error?.message);
let [s, j] = await api("consultant", "POST", `/v1/engagements/${E2}/comparison`);
ok("storing the same comparison again is accepted and adds nothing", s === 201, s);
const { count } = await db.from("comparison").select("*", { count: "exact", head: true }).eq("engagement_id", E2);
ok("still exactly one stored comparison", count === 1, count);
[s, j] = await api("consultant", "POST", `/v1/engagements/${E1}/comparison`);
ok("the baseline cycle has nothing to compare with: 409", s === 409, `${s} ${j?.code}`);
[s] = await api("admin", "POST", `/v1/engagements/${E2}/comparison`);
ok("a client admin cannot store a comparison", s === 403, s);

// org changes
[s] = await api("exec", "POST", `/v1/engagements/${E2}/org-changes`, { type: "MERGER", effective_date: "2026-09-01", description: "x" });
ok("an executive cannot record an organisational change", s === 403, s);
[s, j] = await api("admin", "POST", `/v1/engagements/${E2}/org-changes`, { type: "NOT_A_TYPE", effective_date: "2026-09-01", description: "x" });
ok("an unknown type is 422", s === 422, s);
[s, j] = await api("admin", "POST", `/v1/engagements/${E2}/org-changes`, { type: "RESTRUCTURE", effective_date: "2026-09-01", description: "Two departments merged (e2e)" });
ok("the client admin records an organisational change", s === 201, `${s} ${j?.code}`);
const del = await db.from("org_change").delete().eq("org_change_id", j?.org_change_id ?? "x");
ok("an organisational change cannot be deleted", !!del.error && /APPEND_ONLY|permission denied/.test(del.error.message), del.error?.message);

// triggers
[s] = await api("admin", "POST", `/v1/engagements/${E2}/triggers`, {});
ok("a client admin cannot raise triggers", s === 403, s);
[s, j] = await api("consultant", "POST", `/v1/engagements/${E2}/triggers`, { board_request: true });
ok("the consultant checks triggers", s === 200 && j.checked >= 2, `${s} ${JSON.stringify(j)}`);
[s, j] = await api("consultant", "POST", `/v1/engagements/${E2}/triggers`, { board_request: true });
ok("a trigger is raised only once", s === 200 && j.raised.length === 0, JSON.stringify(j));
// each run decides one trigger, so raise a fresh one first: the test does not depend on what earlier runs left open
const { data: cu } = await who.consultant.c.auth.getUser();
const fresh = await db.rpc("rpc_trigger_raise", { p_actor: cu.user.id, p_engagement: E2, p_type: "BOARD_REQUEST", p_ref: "e2e " + Date.now() });
ok("the consultant can raise a trigger for the test", !fresh.error && !!fresh.data, fresh.error?.message);
const { data: trg } = await db.from("reassessment_trigger").select("trigger_id, type, decision").eq("engagement_id", E2).is("decision", null).order("raised_at");
ok("open triggers exist", (trg ?? []).length >= 1);
const T = trg[0].trigger_id;
[s] = await api("admin", "PATCH", `/v1/triggers/${T}`, { decision: "ACCEPTED" });
ok("a client admin cannot decide a trigger", s === 403, s);
[s] = await api("consultant", "PATCH", `/v1/triggers/${T}`, { decision: "DISMISSED" });
ok("a dismissal without a reason is 422", s === 422, s);
[s] = await api("consultant", "PATCH", `/v1/triggers/${T}`, { decision: "DISMISSED", reason: "Reviewed with the sponsor (e2e)" });
ok("the consultant dismisses it with a reason", s === 200, s);
[s, j] = await api("consultant", "PATCH", `/v1/triggers/${T}`, { decision: "ACCEPTED" });
ok("a decided trigger cannot be decided again: 409", s === 409, `${s} ${j?.code}`);
const reup = await db.from("reassessment_trigger").update({ type: "ANNUAL" }).eq("trigger_id", T);
ok("a trigger's own details cannot be edited", !!reup.error, reup.error?.message);
const { data: aud } = await db.from("audit_log").select("action").eq("tenant_id", ten.tenant_id).in("action", ["comparison.stored", "org_change.recorded", "trigger.raised", "trigger.dismissed"]);
ok("every step wrote an audit row", new Set((aud ?? []).map((a) => a.action)).size === 4, JSON.stringify([...new Set((aud ?? []).map((a) => a.action))]));
done();
