// The whole demo path on a brand-new live tenant: seed -> survey submits -> early freeze refused -> window closes ->
// freeze -> score (hash cross-checked against the engine run locally on the same responses) -> freeze score ->
// findings -> report -> release -> the client admin reads it. Drives the dashboard's "next step" label at each stage.
//   node --env-file=.env.local scripts/e2e-live.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import * as E from "../packages/cdp-engine/dist/index.js";
import { ok, done, URL_, ANON } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const N = 6;
const out = execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "live", String(N), base, "1"], { encoding: "utf8" });
const tokens = [...out.matchAll(/#([0-9a-f]{32})/g)].map((m) => m[1]);
const email = /(admin\.live\d+@\S+?)\s/.exec(readFileSync("context-sessions/demo-credentials.txt", "utf8").split("\n").reverse().join("\n"))?.[1];
const pwd = new RegExp(email.replace(/\./g, "\\.") + "\\s+(\\S+)").exec(readFileSync("context-sessions/demo-credentials.txt", "utf8"))[1];
const cpw = /consultant@\S+\s+(\S+)/.exec(readFileSync("context-sessions/demo-credentials.txt", "utf8"))[1];
ok(`seeded ${N} links`, tokens.length === N);

const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id, name").like("name", "Live Demo Co%").order("created_at", { ascending: false }).limit(1).single();
const { data: asm } = await svc.from("assessment").select("assessment_id, window_close").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;

async function session(em, p) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email: em, password: p });
  if (error) throw new Error(em + ": " + error.message);
  return (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json", ...(init.headers ?? {}) } });
}
const consultant = await session("consultant@cdp-demo.example", cpw), admin = await session(email, pwd);
const post = async (s, path, body) => { const r = await s(path, { method: "POST", body: JSON.stringify(body ?? {}) }); return [r.status, await r.json().catch(() => null)]; };
const dash = async (s) => (await (await s("/dashboard")).text());

// consent (AC-2.3): no item is answerable and nothing is stored until AGREE; DECLINE stores no response data
const mgmt = readFileSync(tokenFile, "utf8").trim();
const sql = async (query) => { const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${mgmt}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) }); return { ok: r.ok, body: await r.text() }; };
const survey = (path, tok, init = {}) => fetch(base + path, { ...init, headers: { "content-type": "application/json", "x-survey-token": tok, ...(init.headers ?? {}) } });
const counts = async () => (await svc.rpc("rpc_fielding_counts", { p_assessment_id: A })).data;
const fx = JSON.parse(readFileSync("packages/cdp-engine/oracle/cases/fixture.json"));
const rs = fx.input.responses.slice(0, N);
const bodyOf = (i) => JSON.stringify({ payload: { alloc: rs[i].alloc, likert: rs[i].likert, eos: rs[i].eos }, duration: rs[i].duration });

let g = await survey("/v1/survey", tokens[0]); let gj = await g.json();
ok("survey GET returns the consent text, no decision yet", g.status === 200 && gj.consent?.decision === null && /hello@pac\.africa/.test(gj.consent.body) && /cannot be individually/.test(gj.consent.body), g.status);
let r0 = await survey("/v1/survey", tokens[0], { method: "PUT", body: bodyOf(0) });
ok("submit before consent refused (409 ILLEGAL_TRANSITION)", r0.status === 409 && (await r0.json()).code === "ILLEGAL_TRANSITION", r0.status);
ok("nothing stored by the refused submit", (await counts()).submitted === 0);
ok("bad decision refused (422)", (await survey("/v1/survey/consent", tokens[0], { method: "POST", body: JSON.stringify({ decision: "MAYBE" }) })).status === 422);
ok("consent with a bad token is the neutral 410", (await survey("/v1/survey/consent", "0".repeat(32), { method: "POST", body: JSON.stringify({ decision: "AGREE" }) })).status === 410);

const consentOf = (i, decision) => survey("/v1/survey/consent", tokens[i], { method: "POST", body: JSON.stringify({ decision }) });
ok("decline recorded", (await consentOf(5, "DECLINE")).status === 200 && (await counts()).consent_decline === 1);
ok("declined link cannot submit", (await survey("/v1/survey", tokens[5], { method: "PUT", body: bodyOf(5) })).status === 409 && (await counts()).submitted === 0);
ok("survey GET reports the decline", (await (await survey("/v1/survey", tokens[5])).json()).consent.decision === "DECLINE");
ok("a declined respondent can change their mind (one row per link)", (await consentOf(5, "AGREE")).status === 200 && (await counts()).consent_decline === 0 && (await counts()).consent_agree === 1);
await consentOf(0, "AGREE"); await consentOf(0, "AGREE");
ok("repeating AGREE adds no row", (await counts()).consent_agree === 2);

// responses: the first N from the oracle fixture, submitted through the public survey route
for (let i = 0; i < N; i++) {
  await consentOf(i, "AGREE");
  const r = await survey("/v1/survey", tokens[i], { method: "PUT", body: bodyOf(i) });
  if (r.status !== 200) ok(`survey submit ${i}`, false, r.status);
}
ok("six responses submitted", true);
{
  const c = await counts();
  ok("counts: 6 agree, 0 decline, 6 submitted", c.consent_agree === 6 && c.consent_decline === 0 && c.submitted === 6, JSON.stringify(c));
  const q = await sql(`select count(*) as n, count(invitation_id) as linked, count(*) filter (where decided_at <> date_trunc('day', decided_at)) as exact_time from capture.consent_record where assessment_id = '${A}'`);
  const row = JSON.parse(q.body)[0];
  ok("after submit: 6 consent rows, none linked to an invitation, none with a time finer than the day", row?.n === 6 && row.linked === 0 && row.exact_time === 0, q.body);
  ok("consent after submit is the neutral 410", (await consentOf(0, "DECLINE")).status === 410);
  const w = await sql("update capture.consent_record set decision = 'DECLINE' where assessment_id = '" + A + "'");
  ok("consent_record rows cannot be rewritten after unlink (IMMUTABLE_ROW)", !w.ok && w.body.includes("IMMUTABLE_ROW"), w.body.slice(0, 120));
  const d = await sql("delete from capture.consent_record where assessment_id = '" + A + "'");
  ok("consent_record rows cannot be deleted (IMMUTABLE_ROW)", !d.ok && d.body.includes("IMMUTABLE_ROW"), d.body.slice(0, 120));
  const pr = await sql("select has_table_privilege('anon','capture.consent_record','select') or has_table_privilege('authenticated','capture.consent_record','select') or has_table_privilege('service_role','capture.consent_record','select') as capture_open, has_table_privilege('anon','public.consent_text','select') or has_table_privilege('authenticated','public.consent_text','select') as text_open");
  const pj = JSON.parse(pr.body)[0];
  ok("no role but definer functions can read consent_record; anon and authenticated cannot read consent_text", pj?.capture_open === false && pj?.text_open === false, pr.body);
  const l = await sql(`begin; insert into public.assessment (tenant_id, engagement_id, instrument_version_id, rules_version_id) select tenant_id, engagement_id, instrument_version_id, rules_version_id from public.assessment where assessment_id = '${A}'; update public.assessment set status = 'LAUNCHED' where assessment_id <> '${A}' and tenant_id = (select tenant_id from public.assessment where assessment_id = '${A}') and status = 'DRAFT'; rollback;`);
  ok("an assessment without an approved consent text cannot launch (CONSENT_TEXT_REQUIRED)", !l.ok && l.body.includes("CONSENT_TEXT_REQUIRED"), l.body.slice(0, 160));
}

// response monitor (S2-15, S2.6.5-005): counts by cohort, small cohorts summed into one suppressed figure, never who answered
{ const r = await consultant(`/v1/assessments/${A}/monitor`); const m = await r.json().catch(() => null); const body = JSON.stringify(m ?? {});
  ok("the response monitor gives counts by cohort only (no person, no token, no response)", r.status === 200 && Array.isArray(m?.cohorts) && !/person|token|rsp_|employee/.test(body), `${r.status} ${body.slice(0, 200)}`);
  ok("no cohort in the monitor shows fewer than five invited", (m?.cohorts ?? []).every((c) => c.invited >= 5), body.slice(0, 200));
  const anon = await fetch(`${base}/v1/assessments/${A}/monitor`); ok("the monitor needs a session (401)", anon.status === 401, anon.status); }

let [s, j] = await post(consultant, `/v1/assessments/${A}/freeze`);
ok("freeze refused while the window is open (409 ILLEGAL_TRANSITION)", s === 409 && j.code === "ILLEGAL_TRANSITION", `${s} ${j?.code}`);
ok("dashboard says the survey is open", (await dash(consultant)).includes("Survey open until"));

const wait = new Date(asm.window_close).getTime() - Date.now() + 1500;
if (wait > 0) await new Promise((r) => setTimeout(r, wait));
ok("dashboard offers 'Freeze the data' after close", (await dash(consultant)).includes("Freeze the data"));
[s, j] = await post(admin, `/v1/assessments/${A}/freeze`);
ok("client admin cannot freeze", s === 403, s);
[s, j] = await post(consultant, `/v1/assessments/${A}/freeze`);
ok("consultant freezes the data", s === 200 && j.changed && j.responses === N && /^sha256:/.test(j.response_set_hash), `${s} ${JSON.stringify(j)}`);
{ const fm = (await svc.from("assessment").select("freeze_manifest, response_set_hash").eq("assessment_id", A).single()).data;
  const m = fm?.freeze_manifest;
  ok("the freeze manifest records versions, counts, extensions and the hash (S2.7-001)", !!m && m.submitted === N && m.invited >= N && m.voided === 0 && Array.isArray(m.extensions) && m.response_set_hash === fm.response_set_hash && !!m.counts_by_state, JSON.stringify(m).slice(0, 300)); }
[s] = await post(consultant, `/v1/assessments/${A}/freeze`);
ok("freeze is idempotent", s === 200);
const late = await fetch(`${base}/v1/survey`, { method: "PUT", headers: { "content-type": "application/json", "x-survey-token": tokens[0] }, body: JSON.stringify({ payload: { alloc: rs[0].alloc } }) });
ok("survey link is dead after freeze", late.status === 410, late.status);

ok("dashboard offers 'Run scoring'", (await dash(consultant)).includes("Run scoring"));
[s, j] = await post(consultant, `/v1/assessments/${A}/score`);
// independent check: the engine run locally on the same six responses (empty roster snapshots, as issued) and the same agreed setup
const setupIn = { priorities: fx.input.setup.priorities, business_model: fx.input.setup.business_model, planned_model: fx.input.setup.planned_model, f1_tags: fx.input.setup.f1_tags, tie_break: null, kpi_for: fx.input.setup.kpi_for };
const local = E.scoreAssessment(rs.map((r, i) => ({ ...r, id: `x${i}`, snapshot: {} })), E.deriveSetup(setupIn), [], fx.input.scope);
ok("score stored; hash equals the engine run locally on the same responses", s === 201 && j.payload_hash === local.hash, `${s} ${j?.payload_hash} vs ${local.hash}`);
ok("dashboard offers 'Freeze the score'", (await dash(consultant)).includes("Freeze the score"));
[s, j] = await post(consultant, `/v1/assessments/${A}/score/freeze`);
ok("score frozen", s === 200 && j.changed, s);
ok("dashboard offers 'Run findings'", (await dash(consultant)).includes("Run findings"));
[s] = await post(consultant, `/v1/assessments/${A}/evaluate`);
ok("findings stored", s === 201, s);
ok("dashboard offers report creation", (await dash(consultant)).includes("Create the organisational report"));
[s, j] = await post(consultant, `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" });
ok("report drafted", s === 201, s);
const R = j.report_id;
ok("client admin sees nothing yet", (await admin(`/reports/${R}`)).status === 404);
let r = await consultant(`/v1/reports/${R}/sections`, { method: "PUT", body: JSON.stringify({ sections: { what_this_means: "x" } }) });
ok("the report text is drafted by the system and cannot be edited (405)", r.status === 405, r.status);
[s] = await post(consultant, `/v1/reports/${R}/release`);
ok("report released", s === 200, s);
r = await admin(`/reports/${R}`);
ok("client admin now reads the report", r.status === 200 && (await r.text()).includes("What this means"), r.status);
const { data: eng } = await svc.from("engagement").select("state").eq("tenant_id", ten.tenant_id).single();
ok("engagement is REPORTING", eng.state === "REPORTING", eng.state);
done(`\n(tenant: ${ten.name})`);
