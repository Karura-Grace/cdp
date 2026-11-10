// Adjust or retire reviews end to end (Measure stage, step C). Seeds its own client up to a released report (seed-rich-demo.mjs), builds the plan,
// drives three actions to UNDER_REVIEW with KPI readings, then: who may see the recommendation and record a review; the engine's recommendation
// (toward, away, finding superseded); override needs a reason; where the action moves next; one review per point; append only; client reads; audit.
//   node --env-file=apps/web/.env.local scripts/e2e-adjust.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Adjust test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;
const who = {
  con: await signIn("consultant@cdp-demo.example"),
  admin: await signIn(`admin.${SLUG}@cdp-demo.example`),
  exec: await signIn(`exec.${SLUG}@cdp-demo.example`),
  other: await signIn("admin.fixture@cdp-demo.example"),
};
const call = async (w, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[w].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- plan, pre-conditions, three actions under review
let [s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {});
ok("consultant builds the plan", s === 201 || s === 200, `${s} ${j?.code}`);
const V = (await db.from("plan").select("score_version").eq("assessment_id", A).order("score_version", { ascending: false }).limit(1).single()).data.score_version;
const { data: p0 } = await db.from("priority_zero_item").select("*").eq("assessment_id", A).eq("score_version", V);
for (const z of p0.filter((z) => !z.completed_at)) await call("exec", "POST", `/v1/assessments/${A}/p0/${z.item_id}`, { score_version: V, note: "Workshop held (e2e)" });
const { data: acts } = await db.from("action").select("*").eq("assessment_id", A).eq("score_version", V).eq("status", "DRAFT").order("engine_ref").limit(3);
ok("three draft actions to review", acts.length === 3, acts.length);
const [X1, X2, X3] = acts.map((a) => a.action_id);

async function toUnderReview(id, reading) {
  const steps = [["con", { to: "IN_REVIEW" }], ["con", { to: "IN_CO_DESIGN" }],
    ["con", { fields: { owner: "Head of Operations", sponsor: "CEO", kpi: "Voluntary attrition (%)", baseline_value: "19", target_value: "13", budget_amount: "1000" } }],
    ["exec", { to: "APPROVED" }], ["con", { to: "PUBLISHED" }], ["exec", { to: "IN_PROGRESS" }]];
  for (const [w, body] of steps) { const [st, jj] = await call(w, "PATCH", `/v1/actions/${id}`, body); if (st !== 200) return `${JSON.stringify(body)} -> ${st} ${jj?.code} ${jj?.title}`; }
  const [rs] = await call("admin", "POST", `/v1/actions/${id}/kpi-readings`, { value: reading, read_on: today });
  if (rs !== 201) return `reading ${rs}`;
  const [st, jj] = await call("exec", "PATCH", `/v1/actions/${id}`, { to: "UNDER_REVIEW" });
  return st === 200 ? null : `review ${st} ${jj?.code}`;
}
for (const [id, r, label] of [[X1, "14", "moving towards target"], [X2, "22", "moving away from target"], [X3, "16", "mid way"]]) {
  const e = await toUnderReview(id, r);
  ok(`action ${label} reaches UNDER_REVIEW`, e === null, e);
}
const q = (m, f) => `milestones_on_track=${m}&finding_supported=${f}`;

// ---------------------------------------------------------------- who and when
for (const w of ["admin", "exec", "other"]) {
  [s] = await call(w, "GET", `/v1/actions/${X1}/review?${q(1, 1)}`);
  ok(`${w} cannot see the recommendation`, s === 403, s);
  [s] = await call(w, "POST", `/v1/actions/${X1}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true });
  ok(`${w} cannot record a review`, s === 403, s);
}
[s] = await call("con", "GET", `/v1/actions/${X1}/review?milestones_on_track=1`);
ok("the recommendation needs both judgements (422)", s === 422, s);
[s] = await call("con", "POST", `/v1/actions/${X1}/review`, { review_point: "+30d", milestones_on_track: true, finding_supported: true });
ok("only the 90 and 180 day points exist (422)", s === 422, s);
[s] = await call("con", "POST", `/v1/actions/${X1}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true, decision: "WINGS" });
ok("a decision the engine does not know is refused (422)", s === 422, s);
const draft = acts[0] && (await db.from("action").select("action_id").eq("assessment_id", A).eq("status", "DRAFT").limit(1).single()).data;
if (draft) { [s, j] = await call("con", "POST", `/v1/actions/${draft.action_id}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true }); ok("an action that is not under review cannot be reviewed (409)", s === 409, `${s} ${j?.code}`); }

// ---------------------------------------------------------------- the engine's recommendation
[s, j] = await call("con", "GET", `/v1/actions/${X1}/review?${q(1, 1)}`);
ok("towards the target and on track: the engine says CONTINUE", s === 200 && j.decision === "CONTINUE" && j.inputs.kpi_direction === "TOWARDS" && j.inputs.owner_present === true, `${s} ${JSON.stringify(j)}`);
ok("the inputs show progress, readings and the earlier adjustments", /^\d/.test(j.inputs.progress) && j.inputs.readings === 1 && j.inputs.adjustments_without_movement === 0, JSON.stringify(j?.inputs));
[s, j] = await call("con", "GET", `/v1/actions/${X2}/review?${q(1, 1)}`);
ok("moving away: the engine says SUSPEND_AND_REDIAGNOSE", j?.decision === "SUSPEND_AND_REDIAGNOSE" && j.inputs.kpi_direction === "AWAY", JSON.stringify(j));
[s, j] = await call("con", "GET", `/v1/actions/${X3}/review?${q(1, 0)}`);
ok("a finding that is no longer supported: RETIRE_SUPERSEDED", j?.decision === "RETIRE_SUPERSEDED", JSON.stringify(j));

// ---------------------------------------------------------------- record: confirm the engine
[s, j] = await call("con", "POST", `/v1/actions/${X1}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true });
ok("the consultant records CONTINUE (engine confirmed)", s === 201 && j.final_decision === "CONTINUE" && j.engine_decision === "CONTINUE" && j.status === "IN_PROGRESS", `${s} ${JSON.stringify(j)}`);
let st = (await db.from("action").select("status").eq("action_id", X1).single()).data.status;
ok("the action went back to work through the engine transition", st === "IN_PROGRESS", st);
[s, j] = await call("con", "POST", `/v1/actions/${X1}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true });
ok("it is no longer under review, so a second review is refused (409)", s === 409, `${s} ${j?.code}`);
await call("exec", "PATCH", `/v1/actions/${X1}`, { to: "UNDER_REVIEW" });
[s, j] = await call("con", "POST", `/v1/actions/${X1}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true });
ok("one review per action and point, even when it is back under review (409)", s === 409, `${s} ${j?.code}`);
[s, j] = await call("con", "POST", `/v1/actions/${X1}/review`, { review_point: "+180d", milestones_on_track: true, finding_supported: true });
ok("the 180 day review of the same action is allowed", s === 201, `${s} ${j?.code} ${j?.title}`);

// ---------------------------------------------------------------- override needs a reason
[s, j] = await call("con", "POST", `/v1/actions/${X2}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true, decision: "CONTINUE" });
ok("choosing another decision without a reason is refused (422)", s === 422, `${s} ${j?.code}`);
st = (await db.from("action").select("status").eq("action_id", X2).single()).data.status;
ok("the refusal left the action under review and stored nothing", st === "UNDER_REVIEW" && (await db.from("action_review").select("*", { count: "exact", head: true }).eq("action_id", X2)).count === 0, st);
[s, j] = await call("con", "POST", `/v1/actions/${X2}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true, decision: "CONTINUE", reason: "Reading was late; the next one is already better (e2e)" });
ok("with a reason the override is recorded, engine decision kept beside it", s === 201 && j.final_decision === "CONTINUE" && j.engine_decision === "SUSPEND_AND_REDIAGNOSE", `${s} ${JSON.stringify(j)}`);

// ---------------------------------------------------------------- retire, and a decision that holds the action
[s, j] = await call("con", "POST", `/v1/actions/${X3}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: false, reason: "The finding no longer holds after the pulse." });
ok("RETIRE_SUPERSEDED retires the action", s === 201 && j.status === "RETIRED", `${s} ${JSON.stringify(j)}`);
st = (await db.from("action").select("status").eq("action_id", X3).single()).data.status;
const { data: ev3 } = await db.from("action_event").select("to_status, reason").eq("action_id", X3).eq("to_status", "RETIRED");
ok("the retirement is in the action's history with the reason", st === "RETIRED" && ev3.length === 1 && /finding no longer holds/.test(ev3[0].reason), JSON.stringify(ev3));
const e4 = await toUnderReview((await db.from("action").select("action_id").eq("assessment_id", A).eq("status", "DRAFT").limit(1).single()).data.action_id, "19");
ok("a fourth action (no movement) reaches UNDER_REVIEW", e4 === null, e4);
const X4 = (await db.from("action").select("action_id").eq("assessment_id", A).eq("status", "UNDER_REVIEW")).data[0].action_id;
[s, j] = await call("con", "POST", `/v1/actions/${X4}/review`, { review_point: "+90d", milestones_on_track: true, finding_supported: true });
ok("no movement and on track: the engine says ADJUST_INTERVENTION, and the action returns to work", s === 201 && j.final_decision === "ADJUST_INTERVENTION" && j.status === "IN_PROGRESS", `${s} ${JSON.stringify(j)}`);

// ---------------------------------------------------------------- database rules, reads, audit
const uid = { con: (await who.con.c.auth.getUser()).data.user.id, exec: (await who.exec.c.auth.getUser()).data.user.id };
let r = await db.rpc("rpc_action_review_record", { p_actor: uid.exec, p_action: X1, p_point: "+90d", p_engine: "CONTINUE", p_final: "CONTINUE", p_reason: "", p_inputs: {} });
ok("the database refuses a review recorded by an executive", !!r.error && /FORBIDDEN/.test(r.error.message), r.error?.message);
r = await db.rpc("rpc_action_review_record", { p_actor: uid.con, p_action: X1, p_point: "+90d", p_engine: "CONTINUE", p_final: "CONTINUE", p_reason: "", p_inputs: {} });
ok("the database refuses a review of an action that is not under review", !!r.error && /ILLEGAL_TRANSITION/.test(r.error.message), r.error?.message);
await call("exec", "PATCH", `/v1/actions/${X1}`, { to: "UNDER_REVIEW" }).catch(() => null);
r = await db.from("action_review").update({ final_decision: "CONTINUE" }).eq("action_id", X2);
ok("a stored review cannot be changed", !!r.error && /APPEND_ONLY|permission denied/.test(r.error.message), r.error?.message);
r = await db.from("action_review").delete().eq("action_id", X2);
ok("a stored review cannot be deleted", !!r.error && /APPEND_ONLY|permission denied/.test(r.error.message), r.error?.message);
const rows = async (w) => (await who[w].c.from("action_review").select("action_id, final_decision, engine_decision").eq("assessment_id", A)).data ?? [];
const all = await rows("con");
ok("the consultant reads all five reviews", all.length === 5, all.length);
ok("the client admin and executive read them (the report is released)", (await rows("admin")).length === 5 && (await rows("exec")).length === 5);
ok("another organisation reads none", (await rows("other")).length === 0);
const bad = await db.from("action_review").insert({ tenant_id: ten.tenant_id, engagement_id: (await db.from("assessment").select("engagement_id").eq("assessment_id", A).single()).data.engagement_id, assessment_id: A, score_version: V,
  action_id: X4, review_point: "+180d", engine_decision: "CONTINUE", final_decision: "RETIRE_NOT_ACHIEVED", inputs_json: {} });
ok("the table itself refuses an override with no reason", !!bad.error, "inserted");
const { data: aud } = await db.from("audit_log").select("action").eq("tenant_id", ten.tenant_id).eq("object_type", "action").like("action", "action_review.%");
ok("every recorded review is audited with its decision", (aud ?? []).length === 5 && aud.some((x) => x.action === "action_review.recorded:RETIRE_SUPERSEDED"), JSON.stringify(aud));

done();
