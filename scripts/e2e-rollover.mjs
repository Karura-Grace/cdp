// Cycle rollover end to end (Measure stage, step D). Seeds its own client up to a released report (seed-rich-demo.mjs), builds the plan, discards one
// action, then: who may preview and create; the engine's gate (an accepted trigger or twelve months); what carries (agreed setup as drafts, open
// actions, not the discarded one); that nothing of the baseline changes; once only; insert only; reads; audit; and that the next cycle is linked so
// a comparison can be made once it has been scored.
//   node --env-file=apps/web/.env.local scripts/e2e-rollover.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Rollover test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id, engagement_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id, E = asm.engagement_id;
const who = {
  con: await signIn("consultant@cdp-demo.example"),
  admin: await signIn(`admin.${SLUG}@cdp-demo.example`),
  exec: await signIn(`exec.${SLUG}@cdp-demo.example`),
  other: await signIn("admin.fixture@cdp-demo.example"),
};
const uid = { con: (await who.con.c.auth.getUser()).data.user.id, exec: (await who.exec.c.auth.getUser()).data.user.id };
const call = async (w, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[w].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const nextOf = async () => (await db.from("engagement").select("engagement_id, cycle_no, state, previous_engagement_id").eq("previous_engagement_id", E)).data ?? [];

// ---------------------------------------------------------------- the baseline: plan, one discarded action
let [s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {});
ok("consultant builds the plan", s === 201 || s === 200, `${s} ${j?.code}`);
const V = (await db.from("plan").select("score_version").eq("assessment_id", A).order("score_version", { ascending: false }).limit(1).single()).data.score_version;
const { data: acts } = await db.from("action").select("action_id, status").eq("assessment_id", A).eq("score_version", V).order("engine_ref");
ok("the plan has actions to carry", acts.length >= 3, acts.length);
const gone = acts[0].action_id;
[s, j] = await call("con", "PATCH", `/v1/actions/${gone}`, { to: "DISCARDED", reason: "Not needed in this organisation (e2e)" });
ok("one action is discarded, so it must not carry", s === 200, `${s} ${j?.code} ${j?.title}`);
const open = acts.length - 1;
const { data: setup0 } = await db.from("setup_record").select("section, payload_json, status, workshop_date").eq("engagement_id", E).eq("perspective", "AGREED").eq("status", "AGREED");
ok("the baseline has agreed setup sections", setup0.length >= 3, setup0.length);
const before = { eng: (await db.from("engagement").select("state").eq("engagement_id", E).single()).data.state, acts: JSON.stringify((await db.from("action").select("action_id, status").eq("assessment_id", A).order("action_id")).data) };

// ---------------------------------------------------------------- who
for (const w of ["admin", "exec", "other"]) {
  [s] = await call(w, "GET", `/v1/engagements/${E}/rollover`);
  ok(`${w} cannot preview the rollover`, s === 403, s);
  [s] = await call(w, "POST", `/v1/engagements/${E}/rollover`);
  ok(`${w} cannot create the next cycle`, s === 403, s);
}

// ---------------------------------------------------------------- preview and the gate
[s, j] = await call("con", "GET", `/v1/engagements/${E}/rollover`);
ok("the preview lists what carries: agreed setup sections and the open actions", s === 200 && j.carries.setup_sections.length === setup0.length && j.carries.actions.length === open, `${s} ${JSON.stringify(j?.carries?.actions?.length)}/${open}`);
ok("the discarded action is not in the preview", !j.carries.actions.some((a) => a.action_id === gone));
ok("before a trigger is accepted the engine's guard blocks it", j.canCreate === false && /12 months|accepted trigger/i.test(j.blocker), j?.blocker);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/rollover`);
ok("creating the next cycle is refused with 409", s === 409 && j.code === "ILLEGAL_TRANSITION", `${s} ${j?.code}`);
ok("nothing was created by the refusal", (await nextOf()).length === 0);

[s] = await call("con", "POST", `/v1/engagements/${E}/triggers`, { board_request: true });
ok("a board request is recorded", s === 200, s);
const T = (await db.from("reassessment_trigger").select("trigger_id").eq("engagement_id", E).is("decision", null).limit(1).single()).data.trigger_id;
[s] = await call("con", "PATCH", `/v1/triggers/${T}`, { decision: "ACCEPTED" });
ok("the consultant accepts the trigger", s === 200, s);
[s, j] = await call("con", "GET", `/v1/engagements/${E}/rollover`);
ok("with an accepted trigger the guard is met", j.canCreate === true && j.blocker === null && /trigger/i.test(j.reason), JSON.stringify(j));

// ---------------------------------------------------------------- database rules before the real call
let r = await db.rpc("rpc_rollover_create", { p_actor: uid.exec, p_previous: E, p_actions: [], p_carry: {} });
ok("the database refuses a rollover by an executive", !!r.error && /FORBIDDEN/.test(r.error.message), r.error?.message);
r = await db.rpc("rpc_rollover_create", { p_actor: uid.con, p_previous: E, p_actions: [gone], p_carry: {} });
ok("the database refuses to carry a discarded action", !!r.error && /VALIDATION_FAILED/.test(r.error.message), r.error?.message);
r = await db.rpc("rpc_rollover_create", { p_actor: uid.con, p_previous: E, p_actions: ["act_does_not_exist"], p_carry: {} });
ok("the database refuses an action that does not exist", !!r.error && /VALIDATION_FAILED/.test(r.error.message), r.error?.message);
ok("those refusals created nothing", (await nextOf()).length === 0);

// ---------------------------------------------------------------- create
[s, j] = await call("con", "POST", `/v1/engagements/${E}/rollover`);
ok("the consultant creates the next cycle", s === 201 && j.cycle_no === 2 && j.setup_sections === setup0.length && j.actions_carried === open, `${s} ${JSON.stringify(j)}`);
const N = j?.engagement_id;
const nx = await nextOf();
ok("exactly one next engagement, cycle 2, in SETUP, linked to the baseline", nx.length === 1 && nx[0].engagement_id === N && nx[0].cycle_no === 2 && nx[0].state === "SETUP");
const { data: setup1 } = await db.from("setup_record").select("section, perspective, payload_json, status, workshop_date, participants, locked_at").eq("engagement_id", N);
ok("every agreed section was copied", setup1.length === setup0.length && setup0.every((a) => setup1.some((b) => b.section === a.section)));
ok("the copies are drafts to be agreed again: no workshop date, no participants, not locked", setup1.every((x) => x.status === "DRAFT" && x.perspective === "AGREED" && x.workshop_date === null && x.participants.length === 0 && x.locked_at === null));
ok("the content was copied unchanged", setup0.every((a) => JSON.stringify(setup1.find((b) => b.section === a.section).payload_json) === JSON.stringify(a.payload_json)));
const { data: car } = await db.from("carried_action").select("source_action_id, status_at_carry, disposition, snapshot_json").eq("new_engagement_id", N);
ok("the open actions were carried and the discarded one was not", car.length === open && !car.some((c) => c.source_action_id === gone), `${car.length}/${open}`);
ok("each carried action waits as PENDING with its plan fields and history", car.every((c) => c.disposition === "PENDING" && c.snapshot_json.objective && Array.isArray(c.snapshot_json.history)));
const { data: rl } = await db.from("rollover").select("*").eq("new_engagement_id", N).single();
ok("the rollover record holds the counts and the carried backlog", rl.setup_sections === setup0.length && rl.actions_carried === open && "backlog" in rl.carry_json && rl.previous_engagement_id === E);

// ---------------------------------------------------------------- the baseline is untouched
const after = { eng: (await db.from("engagement").select("state").eq("engagement_id", E).single()).data.state, acts: JSON.stringify((await db.from("action").select("action_id, status").eq("assessment_id", A).order("action_id")).data) };
ok("the baseline engagement state and its actions did not change", after.eng === before.eng && after.acts === before.acts);
const { data: setupStill } = await db.from("setup_record").select("status").eq("engagement_id", E).eq("perspective", "AGREED");
ok("the baseline setup is still agreed", setupStill.filter((x) => x.status === "AGREED").length === setup0.length);
ok("the baseline assessment is still frozen", (await db.from("assessment").select("status").eq("assessment_id", A).single()).data.status === "FROZEN");

// ---------------------------------------------------------------- once only, append only
[s, j] = await call("con", "POST", `/v1/engagements/${E}/rollover`);
ok("a second rollover is refused (409)", s === 409, `${s} ${j?.code}`);
r = await db.rpc("rpc_rollover_create", { p_actor: uid.con, p_previous: E, p_actions: [], p_carry: {} });
ok("and refused by the database too", !!r.error && /ILLEGAL_TRANSITION/.test(r.error.message), r.error?.message);
ok("still exactly one next engagement", (await nextOf()).length === 1);
for (const [t, patch] of [["rollover", { setup_sections: 0 }], ["carried_action", { status_at_carry: "CLOSED" }]]) {
  r = await db.from(t).update(patch).eq("new_engagement_id", N);
  ok(`${t} cannot be changed`, !!r.error && /APPEND_ONLY|permission denied/.test(r.error.message), r.error?.message);
  r = await db.from(t).delete().eq("new_engagement_id", N);
  ok(`${t} cannot be deleted`, !!r.error && /APPEND_ONLY|permission denied/.test(r.error.message), r.error?.message);
}

// ---------------------------------------------------------------- reads, linkage, audit
const seen = async (w, t) => (await who[w].c.from(t).select("*").eq("new_engagement_id", N)).data ?? [];
ok("the consultant, client admin and executive read the rollover record", (await seen("con", "rollover")).length === 1 && (await seen("admin", "rollover")).length === 1 && (await seen("exec", "rollover")).length === 1);
ok("they read the carried actions too", (await seen("con", "carried_action")).length === open && (await seen("admin", "carried_action")).length === open && (await seen("exec", "carried_action")).length === open);
ok("another organisation reads nothing", (await seen("other", "rollover")).length === 0 && (await seen("other", "carried_action")).length === 0);
const { data: mine } = await who.con.c.from("engagement").select("engagement_id").eq("engagement_id", N);
ok("the consultant who created it can open the next cycle", mine?.length === 1);
[s, j] = await call("con", "POST", `/v1/engagements/${N}/comparison`);
ok("the next cycle is linked to its baseline: comparing waits until it is scored (409)", s === 409 && j.code === "DATA_NOT_FROZEN", `${s} ${j?.code}`);
[s, j] = await call("con", "GET", `/v1/engagements/${N}/rollover`);
ok("the next cycle has no baseline of its own yet, so it cannot be rolled over again", s === 200 && j.canCreate === false, `${s} ${j?.blocker}`);
const { data: aud } = await db.from("audit_log").select("action").eq("tenant_id", ten.tenant_id).eq("object_id", N);
ok("the rollover is audited", (aud ?? []).some((x) => x.action.startsWith("rollover.created:")), JSON.stringify(aud));

done();
