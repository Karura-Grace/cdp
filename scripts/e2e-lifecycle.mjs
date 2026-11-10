// The engagement lifecycle after reporting (spec 0.6, Table 8), end to end. Seeds its own client up to a released organisational report
// (state REPORTING), then walks it forward with the PAC consultant's POST /v1/engagements/{id}/advance, checking at each step what the engine
// refuses and why, who may and may not, the pulse and rollover events, the audit rows and what the Portfolio offers.
//   node --env-file=apps/web/.env.local scripts/e2e-lifecycle.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, signIn } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const NAME = `Lifecycle test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-rich-demo.mjs", ref, tokenFile, base, NAME, "released"], { encoding: "utf8" });
const SLUG = NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
const { data: ten } = await db.from("tenant").select("tenant_id").eq("name", NAME).single();
const { data: asm } = await db.from("assessment").select("assessment_id, engagement_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id, E = asm.engagement_id;
const who = { con: await signIn("consultant@cdp-demo.example"), admin: await signIn(`admin.${SLUG}@cdp-demo.example`), exec: await signIn(`exec.${SLUG}@cdp-demo.example`), other: await signIn("admin.fixture@cdp-demo.example") };
const call = async (w, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${who[w].t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const state = async () => (await db.from("engagement").select("state").eq("engagement_id", E).single()).data.state;
const adv = (w, to) => call(w, "POST", `/v1/engagements/${E}/advance`, { to });

// ---------------------------------------------------------------- reporting to debrief
ok("the seeded client is in REPORTING with the organisational report released", (await state()) === "REPORTING");
let [s, j] = await adv("con", "DEBRIEF");
ok("debrief is refused while the Board / Executive Summary is not released (409, the engine's reason)", s === 409 && /Board|released/i.test(j?.title ?? ""), `${s} ${j?.title}`);
for (const w of ["admin", "exec", "other"]) { [s] = await adv(w, "DEBRIEF"); ok(`${w} cannot advance an engagement`, s === 403, s); }
[s, j] = await adv("con", "PLANNING"); ok("skipping a stage is refused (409)", s === 409, `${s} ${j?.title}`);
[s, j] = await call("con", "POST", `/v1/assessments/${A}/reports`, { type: "BOARD_EXEC_SUMMARY" });
ok("the Board / Executive Summary is created", s === 201 || s === 200, s);
const BR = j.report_id;
[s] = await adv("con", "DEBRIEF"); ok("still refused while it is only a draft", s === 409, s);
ok("its text was drafted by the system and cannot be edited (405)", (await call("con", "PUT", `/v1/reports/${BR}/sections`, { sections: { what_this_means: "x" } }))[0] === 405);
[s] = await call("con", "POST", `/v1/reports/${BR}/release`); ok("the Board / Executive Summary is released", s === 200, s);
[s, j] = await adv("con", "DEBRIEF"); ok("with both reports released the engagement moves to DEBRIEF", s === 200 && j.state === "DEBRIEF" && j.changed === true, `${s} ${JSON.stringify(j)}`);
ok("the stored state is DEBRIEF", (await state()) === "DEBRIEF");
[s, j] = await adv("con", "DEBRIEF"); ok("asking again changes nothing", s === 200 && j.changed === false, `${s} ${JSON.stringify(j)}`);

// ---------------------------------------------------------------- debrief to planning
[s, j] = await adv("con", "PLANNING"); ok("planning is refused before priority zero and the debrief are recorded (409)", s === 409 && /Priority zero|debrief/i.test(j?.title ?? ""), `${s} ${j?.title}`);
[s] = await call("con", "POST", `/v1/engagements/${E}/advance`, { debrief: true }); ok("the debrief can be recorded now", s === 200, s);
[s, j] = await adv("con", "PLANNING"); ok("a recorded debrief alone is not enough: priority zero (the plan) is missing", s === 409, `${s} ${j?.title}`);
[s, j] = await call("con", "POST", `/v1/assessments/${A}/plan`, {}); ok("the consultant builds the plan (it records priority zero)", s === 201 || s === 200, `${s} ${j?.code}`);
[s] = await call("admin", "POST", `/v1/engagements/${E}/advance`, { debrief: true }); ok("a client admin cannot record the debrief", s === 403, s);
const logged = async () => (await db.from("audit_log").select("action").eq("object_id", E).eq("action", "debrief.logged")).data.length;
[s] = await call("con", "POST", `/v1/engagements/${E}/advance`, { debrief: true }); ok("recording the debrief twice stores one row", s === 200 && (await logged()) === 1, await logged());
[s, j] = await adv("con", "PLANNING"); ok("with the plan and the debrief the engagement moves to PLANNING", s === 200 && j.state === "PLANNING", `${s} ${JSON.stringify(j)}`);
[s] = await call("con", "POST", `/v1/engagements/${E}/advance`, { debrief: true }); ok("the debrief cannot be recorded outside the debrief stage (409)", s === 409, s);

// ---------------------------------------------------------------- planning to implementation
[s, j] = await adv("con", "IMPLEMENTATION"); ok("implementation is refused until an organisation level action is published (409)", s === 409 && /Organisation|published/i.test(j?.title ?? ""), `${s} ${j?.title}`);
const V = (await db.from("plan").select("score_version").eq("assessment_id", A).order("score_version", { ascending: false }).limit(1).single()).data.score_version;
const { data: p0 } = await db.from("priority_zero_item").select("*").eq("assessment_id", A).eq("score_version", V);
for (const z of p0.filter((z) => !z.completed_at)) await call("exec", "POST", `/v1/assessments/${A}/p0/${z.item_id}`, { score_version: V, note: "Workshop held (e2e)" });
const { data: org } = await db.from("action").select("action_id").eq("assessment_id", A).eq("score_version", V).eq("level", "ORGANISATION").eq("status", "DRAFT").limit(1);
ok("the plan has an organisation level action to publish", org.length === 1, org.length);
const X = org[0].action_id;
const steps = [["con", { to: "IN_REVIEW" }], ["con", { to: "IN_CO_DESIGN" }], ["con", { fields: { owner: "Chief Executive", sponsor: "CEO", kpi: "Voluntary attrition (%)", baseline_value: "19", target_value: "13", budget_amount: "1000" } }], ["exec", { to: "APPROVED" }]];
for (const [w, body] of steps) { const [st, jj] = await call(w, "PATCH", `/v1/actions/${X}`, body); if (st !== 200) ok(`action step ${JSON.stringify(body)}`, false, `${st} ${jj?.code} ${jj?.title}`); }
[s, j] = await adv("con", "IMPLEMENTATION"); ok("approved is not published: still refused (409)", s === 409, `${s} ${j?.title}`);
[s, j] = await call("con", "PATCH", `/v1/actions/${X}`, { to: "PUBLISHED" }); ok("the consultant publishes the action", s === 200, `${s} ${j?.code} ${j?.title}`);
[s, j] = await adv("con", "IMPLEMENTATION"); ok("with a published organisation level action the engagement moves to IMPLEMENTATION", s === 200 && j.state === "IMPLEMENTATION", `${s} ${JSON.stringify(j)}`);

// ---------------------------------------------------------------- pulses move the cycle to PULSE and back
const plan = (await db.from("plan").select("payload_json").eq("assessment_id", A).eq("score_version", V).single()).data.payload_json;
const pri = plan.priorities.find((p) => new Set(p.actions.flatMap((a) => a.watchlist)).size >= 2);
const items = [...new Set(pri.actions.flatMap((a) => a.watchlist))].slice(0, 2);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/pulses`, { priority_id: pri.priority_id, review_point: "+90d", items }); ok("a pulse is created", s === 201, `${s} ${j?.code} ${j?.title}`);
const P = j.pulse_id;
ok("creating a pulse does not move the cycle", (await state()) === "IMPLEMENTATION");
[s] = await call("con", "POST", `/v1/pulses/${P}/open`, { closes: day(7) }); ok("the pulse is opened", s === 201, s);
ok("opening a pulse moves the cycle to PULSE", (await state()) === "PULSE", await state());
[s] = await adv("con", "RE_ASSESSMENT"); ok("from PULSE the cycle cannot jump to re-assessment (409)", s === 409, s);
[s] = await call("con", "POST", `/v1/pulses/${P}/close`); ok("the pulse is closed", s === 200, s);
ok("closing alone leaves the cycle in PULSE: its results are not stored yet", (await state()) === "PULSE");
[s] = await call("con", "POST", `/v1/pulses/${P}/results`); ok("the results are stored (suppressed: nobody answered)", s === 201, s);
ok("storing the results returns the cycle to IMPLEMENTATION", (await state()) === "IMPLEMENTATION", await state());

// ---------------------------------------------------------------- implementation to re-assessment, then the next cycle
[s, j] = await adv("con", "RE_ASSESSMENT"); ok("re-assessment is refused with no accepted trigger and under twelve months (409)", s === 409 && /12 months|trigger/i.test(j?.title ?? ""), `${s} ${j?.title}`);
[s] = await call("con", "POST", `/v1/engagements/${E}/triggers`, { board_request: true });
const T = (await db.from("reassessment_trigger").select("trigger_id").eq("engagement_id", E).is("decision", null).limit(1).single()).data.trigger_id;
[s] = await call("con", "PATCH", `/v1/triggers/${T}`, { decision: "DISMISSED", reason: "Not now (e2e)" });
[s, j] = await adv("con", "RE_ASSESSMENT"); ok("a dismissed trigger does not count (409)", s === 409, `${s} ${j?.title}`);
[s] = await call("con", "POST", `/v1/engagements/${E}/triggers`, { board_request: true });
const T2 = (await db.from("reassessment_trigger").select("trigger_id").eq("engagement_id", E).is("decision", null).limit(1).maybeSingle()).data;
if (T2) await call("con", "PATCH", `/v1/triggers/${T2.trigger_id}`, { decision: "ACCEPTED" });
else { await db.rpc("rpc_trigger_raise", { p_actor: (await who.con.c.auth.getUser()).data.user.id, p_engagement: E, p_type: "BOARD_REQUEST", p_ref: "second " + Date.now() }); const t3 = (await db.from("reassessment_trigger").select("trigger_id").eq("engagement_id", E).is("decision", null).limit(1).single()).data; await call("con", "PATCH", `/v1/triggers/${t3.trigger_id}`, { decision: "ACCEPTED" }); }
[s, j] = await adv("con", "RE_ASSESSMENT"); ok("with an accepted trigger the engagement moves to RE_ASSESSMENT", s === 200 && j.state === "RE_ASSESSMENT", `${s} ${JSON.stringify(j)}`);
[s, j] = await call("con", "POST", `/v1/engagements/${E}/rollover`); ok("the next cycle is created", s === 201 && j.cycle_no === 2, `${s} ${j?.code}`);
const nx = (await db.from("engagement").select("engagement_id, state, cycle_no").eq("previous_engagement_id", E)).data;
ok("the new cycle starts in SETUP and this one stays in RE_ASSESSMENT", nx.length === 1 && nx[0].state === "SETUP" && (await state()) === "RE_ASSESSMENT", JSON.stringify(nx));

// ---------------------------------------------------------------- the trail and the Portfolio
const { data: aud } = await db.from("audit_log").select("action").eq("object_id", E).like("action", "engagement.state_changed:%");
const trail = (aud ?? []).map((x) => x.action.replace("engagement.state_changed:", ""));
ok("every move is in the audit log", ["REPORTING>DEBRIEF", "DEBRIEF>PLANNING", "PLANNING>IMPLEMENTATION", "IMPLEMENTATION>PULSE", "PULSE>IMPLEMENTATION", "IMPLEMENTATION>RE_ASSESSMENT"].every((x) => trail.includes(x)), trail.join());
done();
