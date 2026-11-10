// End-to-end check of score -> freeze -> evaluate -> report -> release against a running dev server and the
// seeded fixture engagement. Asserts the fixture hash and the release gate for every demo role.
//   node --env-file=.env.local scripts/e2e-release.mjs [base-url]
// Needs the fixture seeded (seed-demo.mjs fixture) and context-sessions/demo-credentials.txt. Run once per seed.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const fx = JSON.parse(readFileSync(new URL("../packages/cdp-engine/oracle/cases/fixture.json", import.meta.url)));
const pw = passwords();

const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const A = asm.assessment_id;

const tokens = {};
async function login(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: pw[email] });
  if (error) throw new Error(`${email}: ${error.message}`);
  tokens[email] = data.session.access_token;
  return c;
}
const ROLES = { consultant: "consultant@cdp-demo.example", admin: "admin.fixture@cdp-demo.example", exec: "exec.fixture@cdp-demo.example",
  lead: "peoplelead.fixture@cdp-demo.example", root: "superadmin@cdp-demo.example", other: "admin.live@cdp-demo.example" };
const sb = {};
for (const [k, e] of Object.entries(ROLES)) sb[k] = await login(e);

const call = async (role, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${tokens[ROLES[role]]}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const rows = async (role, table) => (await sb[role].from(table).select("*").eq("assessment_id", A)).data?.length ?? -1;


// --- guards before any score exists
let [s, j] = await call("admin", "POST", `/v1/assessments/${A}/score`);
ok("client admin cannot score", s === 403, `${s} ${j?.code}`);
[s, j] = await call("other", "POST", `/v1/assessments/${A}/score`);
ok("other tenant cannot score", s === 403, `${s}`);
[s] = await fetch(`${base}/v1/assessments/${A}/score`, { method: "POST" }).then((r) => [r.status]);
ok("no token -> 401", s === 401, `${s}`);

// --- score
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/score`);
ok("consultant scores (201 or idempotent 200)", (s === 201 || s === 200) && j.payload_hash === fx.expected.hash, `${s} ${j?.payload_hash}`);
ok("fixture hash through the API", j?.payload_hash === fx.expected.hash);
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/score`);
ok("re-score is idempotent (same hash, no new version)", s === 200 && j.created === false && j.version === 1, `${s} v${j?.version}`);

// --- evaluate before freeze, freeze, evaluate
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/evaluate`);
ok("evaluate refuses before freeze", s === 422, `${s}`);
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/score/freeze`);
ok("freeze score + engagement -> REPORTING", s === 200, `${s} ${j?.code}`);
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/score/freeze`);
ok("freeze is idempotent", s === 200 && j.changed === false, `${s}`);
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/evaluate`);
ok("evaluate stores findings", s === 201 || s === 200, `${s} ${j?.code}`);
const { data: ev } = await svc.from("evaluation").select("payload_json").eq("assessment_id", A).single();
ok("evaluation has findings", Array.isArray(ev?.payload_json?.findings) && ev.payload_json.findings.length > 0);
const { data: engS } = await svc.from("engagement").select("state").eq("tenant_id", ten.tenant_id).single();
ok("engagement state REPORTING", engS.state === "REPORTING", engS.state);

// --- report: draft, incomplete release refused
[s, j] = await call("consultant", "POST", `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" });
ok("report draft created", s === 201 || s === 200, `${s} ${j?.code}`);
const R = j.report_id;
[s, j] = await call("admin", "POST", `/v1/reports/${R}/release`);
ok("client admin cannot release", s === 403, `${s}`);
[s, j] = await call("consultant", "POST", `/v1/reports/${R}/release`);
ok("release refused while sections empty", s === 422 && j.code === "RELEASE_INCOMPLETE", `${s} ${j?.code}`);

// --- BEFORE release: every client role sees nothing
for (const role of ["admin", "exec", "lead", "other", "root"]) {
  ok(`pre-release ${role}: no score_object`, (await rows(role, "score_object")) === 0);
  ok(`pre-release ${role}: no evaluation`, (await rows(role, "evaluation")) === 0);
  ok(`pre-release ${role}: no report`, (await rows(role, "report")) === 0);
  [s, j] = await call(role, "GET", `/v1/assessments/${A}/reports`);
  ok(`pre-release ${role}: GET reports empty`, s === 200 && j.length === 0, `${s} ${JSON.stringify(j)?.slice(0, 80)}`);
}
ok("pre-release consultant sees score, evaluation, report", (await rows("consultant", "score_object")) === 1 && (await rows("consultant", "evaluation")) === 1 && (await rows("consultant", "report")) === 1);

// --- sections, accept, release
[s, j] = await call("admin", "PUT", `/v1/reports/${R}/sections`, { sections: { what_this_means: "x" }, accept: [] });
ok("client admin cannot edit sections", s === 403, `${s}`);
[s, j] = await call("consultant", "PUT", `/v1/reports/${R}/sections`, { sections: {
  what_this_means: "The organisation operates as a Perform and Govern culture today (34 and 30). Leadership wants more Engage and Innovate, which the stated priorities require.",
  what_to_do_next: "Agree priority zero with the executive team, then build the Engage and Innovate capability before the next pulse." }, accept: ["what_this_means", "what_to_do_next"] });
ok("sections written and accepted", s === 200 && j.accepted.length === 2, `${s} ${j?.code}`);
[s, j] = await call("consultant", "POST", `/v1/reports/${R}/release`);
ok("consultant releases", s === 200 && j.status === "RELEASED", `${s} ${j?.code}`);
[s, j] = await call("consultant", "POST", `/v1/reports/${R}/release`);
ok("release is idempotent", s === 200 && j.changed === false, `${s}`);
[s, j] = await call("consultant", "PUT", `/v1/reports/${R}/sections`, { sections: { what_this_means: "changed" } });
ok("released report cannot be edited", s === 409, `${s} ${j?.code}`);
const direct = await sb.consultant.from("report").update({ status: "DRAFT" }).eq("report_id", R);
ok("direct REST write to report refused", !!direct.error || direct.status >= 400, JSON.stringify(direct));

// --- AFTER release
for (const role of ["admin", "exec"]) {
  ok(`released ${role}: sees score_object`, (await rows(role, "score_object")) === 1);
  ok(`released ${role}: sees evaluation`, (await rows(role, "evaluation")) === 1);
  ok(`released ${role}: sees report`, (await rows(role, "report")) === 1);
}
ok("released lead: sees ORGANISATIONAL report only", (await rows("lead", "report")) === 1);
ok("released lead: no score_object", (await rows("lead", "score_object")) === 0);
ok("released lead: no evaluation", (await rows("lead", "evaluation")) === 0);
for (const role of ["other", "root"]) {
  ok(`released ${role}: no score_object`, (await rows(role, "score_object")) === 0);
  ok(`released ${role}: no report`, (await rows(role, "report")) === 0);
}
const { data: aud } = await svc.from("audit_log").select("action").eq("tenant_id", ten.tenant_id);
ok("audit: report.released and state changes logged", aud.some((a) => a.action === "report.released") && aud.some((a) => a.action.startsWith("engagement.state_changed")), JSON.stringify(aud));

done();
