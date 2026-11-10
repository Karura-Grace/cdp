// Client owned action plan end to end (rules 2.2, design docs/designs/J4b-client-owned-plan.md). Seeds its own client on rules 2.2 up to a released report, then:
// the system proposes at release, who may edit, mark, accept, publish and rank (consultant, client admin, executive, people leader, other tenant),
// the P0 gate, the client's order of priorities, and the database locks. The consultant flow on 2.0 stays covered by e2e-plan.
//   node --env-file=apps/web/.env.local scripts/e2e-client-plan.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Client plan ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"],
  { encoding: "utf8", env: { ...process.env, SEED_RULES_VERSION: "rul_v2_2" } });
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id, rules_version(semver)").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;
ok("the assessment pins rules 2.2", asm.rules_version?.semver === "2.2", JSON.stringify(asm.rules_version));
const who = {
  con: await signIn("consultant@cdp-demo.example"),
  admin: await signIn(`admin.${SLUG}@cdp-demo.example`),
  exec: await signIn(`exec.${SLUG}@cdp-demo.example`),
  lead: await signIn(`lead.${SLUG}@cdp-demo.example`),
  other: await signIn("admin.fixture@cdp-demo.example"),
};
const call = async (w, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[w].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const seen = async (w, table, q = (x) => x) => (await q(who[w].c.from(table).select("*").eq("assessment_id", A))).data ?? [];
const row = async (id) => (await db.from("action").select("*").eq("action_id", id).single()).data;

// ---------------------------------------------------------------- the system proposes
let [s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {});
ok("consultant builds the plan", s === 201 && j.created === true, `${s} ${j?.code} ${j?.title}`);
const V = j.score_version;
const { data: acts } = await db.from("action").select("*").eq("assessment_id", A).eq("score_version", V).order("engine_ref");
const { data: pris } = await db.from("priority").select("*").eq("assessment_id", A).eq("score_version", V).order("sequence");
ok("actions and priorities stored", acts.length > 0 && pris.length > 1, `${acts.length} ${pris.length}`);
ok("the report was already released, so every action is proposed (In co design) at once", acts.every((x) => x.status === "IN_CO_DESIGN"), [...new Set(acts.map((x) => x.status))].join());
ok("each action starts with the priority's owner role as its owner", acts.every((x) => !!x.owner && x.owner === pris.find((p) => p.priority_id === x.priority_id).owner_role));
const first = acts[0];
const { data: ev0 } = await db.from("action_event").select("from_status, to_status, actor_id").eq("action_id", first.action_id).order("at");
ok("history shows the two system steps, with no person", ev0.map((e) => e.to_status).join(">") === "IN_REVIEW>IN_CO_DESIGN" && ev0.every((e) => e.actor_id === null), JSON.stringify(ev0));
const again = await db.rpc("rpc_plan_propose", { p_assessment: A, p_version: V });
ok("proposing again changes nothing", again.data === 0, JSON.stringify(again));
ok("the client sees the proposed actions", (await seen("exec", "action")).length === acts.length && (await seen("admin", "action")).length === acts.length);
ok("another tenant sees nothing", (await seen("other", "action")).length === 0 && (await seen("other", "plan_client_order")).length === 0);

// pick an action whose priority is held by an open P0 item
const { data: p0 } = await db.from("priority_zero_item").select("*").eq("assessment_id", A).eq("score_version", V);
const gated = pris.find((p) => p.blocked_by.length && p0.some((z) => !z.completed_at && p.blocked_by.some((f) => z.finding_ids.includes(f))));
ok("the engine held at least one priority behind an open P0 item (so the gate is tested)", !!gated);
const X = acts.find((x) => x.priority_id === gated?.priority_id) ?? acts[0];
const Z = acts.find((x) => x.action_id !== X.action_id);
const path = `/v1/actions/${X.action_id}`;

// ---------------------------------------------------------------- the consultant no longer moves or edits
[s] = await call("con", "PATCH", path, { fields: { sponsor: "CEO" } });
ok("the consultant cannot edit plan fields on 2.2", s === 403, `${s}`);
[s] = await call("con", "PATCH", path, { to: "APPROVED" });
ok("the consultant cannot accept", s === 403, `${s}`);
[s] = await call("con", "PATCH", path, { client: { horizon: "NOW" } });
ok("the consultant cannot mark an action", s === 403, `${s}`);
[s] = await call("con", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: pris.map((p) => p.priority_id) });
ok("the consultant cannot set the client's order", s === 403, `${s}`);

// ---------------------------------------------------------------- a People Leader acts only on their unit (organisation actions have none)
[s] = await call("lead", "PATCH", `/v1/actions/${Z.action_id}`, { fields: { sponsor: "CEO" } });
ok("a people leader cannot edit an organisation wide action", s === 403, `${s}`);
[s] = await call("lead", "PATCH", `/v1/actions/${Z.action_id}`, { client: { horizon: "NEXT" } });
ok("a people leader cannot mark an organisation wide action", s === 403, `${s}`);
// fill Z in as the client admin first, so the engine passes and it is the database unit scope that refuses
[s] = await call("admin", "PATCH", `/v1/actions/${Z.action_id}`, { fields: { sponsor: "CEO", kpi: Z.kpi ?? "Voluntary attrition (%)", baseline_value: Z.baseline_value ?? "19", target_value: Z.target_value ?? "13", budget_amount: "1000" } });
ok("client admin fills in a second action", s === 200, `${s}`);
[s] = await call("lead", "PATCH", `/v1/actions/${Z.action_id}`, { to: "APPROVED" });
ok("a people leader cannot accept an organisation wide action", s === 403, `${s}`);
[s] = await call("lead", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: pris.map((p) => p.priority_id) });
ok("a people leader cannot set the order of priorities", s === 403, `${s}`);
[s] = await call("other", "PATCH", path, { client: { horizon: "NOW" } });
ok("another tenant cannot mark the action", s === 403, `${s}`);

// ---------------------------------------------------------------- the client marks, defers and fills in
[s] = await call("admin", "PATCH", path, { client: { horizon: "SOON" } });
ok("an unknown horizon is refused", s === 422, `${s}`);
[s] = await call("admin", "PATCH", path, { client: { decision: "ACCEPTED" } });
ok("accepting is the move to Approved, not a mark", s === 422, `${s}`);
[s] = await call("admin", "PATCH", path, { client: { horizon: "NOW" } });
ok("client admin marks it Now", s === 200, `${s}`);
[s] = await call("admin", "PATCH", path, { client: { decision: "DEFERRED" } });
ok("client admin defers it", s === 200, `${s}`);
let r = await row(X.action_id);
ok("the mark, the deferral, who and when are stored", r.client_horizon === "NOW" && r.client_decision === "DEFERRED" && !!r.decided_by && !!r.decided_at && r.status === "IN_CO_DESIGN", JSON.stringify(r));
[s] = await call("exec", "PATCH", path, { client: { decision: null, horizon: "NEXT" } });
ok("the executive undoes the deferral and moves it to Next", s === 200, `${s}`);
r = await row(X.action_id);
ok("it is back on the plan as Next", r.client_decision === null && r.client_horizon === "NEXT", JSON.stringify(r));
const { data: evm } = await db.from("action_event").select("reason").eq("action_id", X.action_id).like("reason", "CLIENT:%");
ok("every client mark is in the history", evm.length === 3, `${evm.length}`);
const raw = await db.from("action").update({ client_horizon: "LATER" }).eq("action_id", X.action_id);
ok("a raw update of a client mark is refused by the database", !!raw.error, "updated");

[s] = await call("admin", "PATCH", path, { fields: { status: "PUBLISHED" } });
ok("status cannot be set as a field", s === 422, `${s}`);
[s] = await call("admin", "PATCH", path, { to: "APPROVED" });
ok("accepting is refused until sponsor, KPI, baseline and target are set", s === 422, `${s}`);
[s] = await call("admin", "PATCH", path, { fields: { sponsor: "CEO", kpi: X.kpi ?? "Voluntary attrition (%)", baseline_value: X.baseline_value ?? "19", target_value: X.target_value ?? "13", budget_amount: "1000" } });
ok("client admin fills in the mandatory fields", s === 200, `${s}`);
[s] = await call("admin", "PATCH", path, { fields: { owner: "x".repeat(300) } });
ok("an over long owner is refused", s === 422, `${s}`);
[s] = await call("admin", "PATCH", path, { to: "PUBLISHED" });
ok("publishing before accepting is refused", s === 409, `${s}`);

// ---------------------------------------------------------------- the client's order of priorities
const ids = pris.map((p) => p.priority_id);
const held = (p) => p.blocked_by.length > 0 && p0.some((z) => !z.completed_at && p.blocked_by.some((f) => z.finding_ids.includes(f)));
[s, j] = await call("admin", "GET", `/v1/assessments/${A}/plan/order`);
ok("no order is set at first", s === 200 && j.order === null, `${s}`);
[s] = await call("admin", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: ids.slice(1) });
ok("an order that leaves a priority out is refused", s === 422, `${s}`);
[s] = await call("admin", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: [...ids, ids[0]] });
ok("an order that repeats a priority is refused", s === 422, `${s}`);
const heldIds = pris.filter(held).map((p) => p.priority_id), freeIds = pris.filter((p) => !held(p)).map((p) => p.priority_id);
if (heldIds.length && freeIds.length) {
  [s, j] = await call("admin", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: [...heldIds, ...freeIds] });
  ok("a held priority cannot rank above one that is not held", s === 422, `${s} ${j?.title}`);
}
const mine = [...freeIds, ...heldIds].reverse().sort((a, b) => Number(held(pris.find((p) => p.priority_id === a))) - Number(held(pris.find((p) => p.priority_id === b))));
[s, j] = await call("admin", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: mine });
ok("client admin sets an order (held priorities last)", s === 200, `${s} ${j?.code} ${j?.title}`);
const swapped = [...mine]; if (swapped.length > 1 && held(pris.find((p) => p.priority_id === swapped[0])) === held(pris.find((p) => p.priority_id === swapped[1]))) [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
[s] = await call("exec", "PUT", `/v1/assessments/${A}/plan/order`, { version: V, ranking: swapped });
ok("the executive changes it", s === 200, `${s}`);
[s, j] = await call("exec", "GET", `/v1/assessments/${A}/plan/order`);
ok("the latest order wins", s === 200 && j.order?.ranking.join() === swapped.join(), JSON.stringify(j));
const { count: orders } = await db.from("plan_client_order").select("order_id", { count: "exact", head: true }).eq("assessment_id", A);
ok("every save is kept (insert only)", orders === 2, `${orders}`);
const del = await db.from("plan_client_order").delete().eq("assessment_id", A);
ok("the order history cannot be deleted", !!del.error);
const { data: pri1 } = await db.from("priority").select("priority_id, sequence").eq("assessment_id", A).eq("score_version", V).order("sequence");
ok("the engine's own sequence is untouched", pri1.map((p) => p.priority_id).join() === ids.join());

// ---------------------------------------------------------------- accept, gate, publish
[s, j] = await call("exec", "PATCH", path, { to: "APPROVED" });
ok("the executive accepts", s === 200, `${s} ${j?.code} ${j?.title}`);
r = await row(X.action_id);
ok("accepting records the decision beside the move", r.status === "APPROVED" && r.client_decision === "ACCEPTED", JSON.stringify(r));
[s] = await call("admin", "PATCH", path, { fields: { sponsor: "COO" } });
ok("fields are locked once accepted (database)", s === 409, `${s}`);
[s] = await call("admin", "PATCH", path, { client: { decision: null } });
ok("an accepted action cannot be un deferred or reset", s === 409, `${s}`);
const blockers = gated?.blocked_by ?? [];
if (blockers.length) {
  [s, j] = await call("admin", "PATCH", path, { to: "PUBLISHED" });
  ok("publishing is refused while a pre-condition is open (engine)", s === 409 && j.code === "BLOCKING_GATE_OPEN", `${s} ${j?.code}`);
  const uid = (await who.admin.c.auth.getUser()).data.user.id;
  const direct = await db.rpc("rpc_action_transition", { p_actor: uid, p_action: X.action_id, p_from: "APPROVED", p_to: "PUBLISHED", p_reason: "" });
  ok("and refused by the database when called directly", !!direct.error && /BLOCKING_GATE_OPEN/.test(direct.error.message), direct.error?.message);
  for (const z of p0.filter((z) => !z.completed_at && z.finding_ids.some((f) => blockers.includes(f)))) {
    [s, j] = await call("exec", "POST", `/v1/assessments/${A}/p0/${z.item_id}`, { score_version: V, note: "Perception gap workshop held with the executive team." });
    ok(`the executive completes ${z.item_id}`, s === 200, `${s} ${j?.code} ${j?.title}`);
  }
}
[s] = await call("con", "PATCH", path, { to: "PUBLISHED" });
ok("the consultant cannot publish", s === 403, `${s}`);
[s, j] = await call("admin", "PATCH", path, { to: "PUBLISHED" });
ok("client admin publishes once the gate is clear", s === 200, `${s} ${j?.code} ${j?.title}`);
[s, j] = await call("admin", "PATCH", path, { to: "IN_PROGRESS" });
ok("the client starts it (later moves are unchanged)", s === 200, `${s} ${j?.code}`);
const { data: evs } = await db.from("action_event").select("to_status, reason").eq("action_id", X.action_id).order("at");
ok("the history reads proposed, accepted, published, started", evs.filter((e) => !String(e.reason ?? "").startsWith("CLIENT:")).map((e) => e.to_status).join(">") === "IN_REVIEW>IN_CO_DESIGN>APPROVED>PUBLISHED>IN_PROGRESS", evs.map((e) => e.to_status).join(">"));

// ---------------------------------------------------------------- discard is the client's, and not a deferral
[s] = await call("admin", "PATCH", `/v1/actions/${Z.action_id}`, { to: "DISCARDED", reason: "Covered elsewhere" });
ok("an action in co design cannot be discarded, it is deferred (engine)", s === 409 || s === 403, `${s}`);
[s] = await call("admin", "PATCH", `/v1/actions/${Z.action_id}`, { client: { decision: "DEFERRED" } });
ok("it is deferred instead, with no reason needed", s === 200, `${s}`);
done();
