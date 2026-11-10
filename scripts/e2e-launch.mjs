// Pre-flight and launch (AC-1.5, AC-1.6): seeds a DRAFT engagement, breaks one rule at a time, then launches it.
//   node --env-file=.env.local scripts/e2e-launch.mjs <project-ref> <token-file> [base-url]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, pwOf, passwords, approveTemplates } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "draft"], { encoding: "utf8" });
const [, tenantId, engId, A] = /: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+) DRAFT/.exec(out);
const adminEmail = Object.keys(passwords()).filter((e) => /^admin\.draft\d+@/.test(e)).at(-1);

const restoreTemplates = await approveTemplates();   // launch is gated on the owner's approval of the staff message templates
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function session(em) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email: em, password: pwOf(em) });
  if (error) throw new Error(em + ": " + error.message);
  const f = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json", ...(init.headers ?? {}) } });
  return { f, c };
}
const post = async (s, path) => { const r = await s.f(path, { method: "POST", body: "{}" }); return [r.status, await r.json().catch(() => null)]; };
const consultant = await session("consultant@cdp-demo.example"), admin = await session(adminEmail);
const failing = (j) => (j?.checks ?? []).filter((c) => !c.pass && c.blocking).map((c) => c.id);
const status = async () => (await svc.from("assessment").select("status, window_open, window_close, consent_text_id").eq("assessment_id", A).single()).data;
const locked = async () => (await svc.from("setup_record").select("locked_at").eq("engagement_id", engId)).data.filter((r) => r.locked_at).length;

let [s, j] = await post({ f: (p, i) => fetch(base + p, { ...i, headers: { "content-type": "application/json" } }) }, `/v1/assessments/${A}/preflight`);
ok("no session: 401", s === 401, s);
[s] = await post(admin, `/v1/assessments/${A}/preflight`); ok("client admin cannot run pre-flight (403)", s === 403, s);
[s] = await post(admin, `/v1/assessments/${A}/launch`); ok("client admin cannot launch (403)", s === 403, s);
const ccon = createClient(URL_, ANON, { auth: { persistSession: false } });
await ccon.auth.signInWithPassword({ email: "consultant@cdp-demo.example", password: pwOf("consultant@cdp-demo.example") });
const direct = await ccon.rpc("rpc_launch_assessment", { p_actor: "00000000-0000-0000-0000-000000000000", p_assessment: A, p_graph_version: 0, p_window_start: "2026-01-01", p_scope: [], p_defects: [] });
ok("the launch function is not callable with a user token", !!direct.error, JSON.stringify(direct.data));

[s, j] = await post(consultant, `/v1/assessments/${A}/preflight`);
ok("clean draft passes pre-flight; L7 and L8 are computed (warnings only), nothing left unassessed", s === 200 && j.pass === true && j.checks.length === 16 && j.not_assessed.length === 0 && j.checks.some((c) => c.id === "L7") && j.checks.some((c) => c.id === "L8"), JSON.stringify(failing(j)));

async function breaks(label, id, mutate, restore) {
  await mutate();
  const [ps, pj] = await post(consultant, `/v1/assessments/${A}/preflight`);
  const [ls, lj] = await post(consultant, `/v1/assessments/${A}/launch`);
  ok(`${label}: pre-flight fails ${id}`, ps === 200 && pj.pass === false && failing(pj).includes(id), JSON.stringify(failing(pj)));
  ok(`${label}: launch refused (422 PREFLIGHT_FAILED)`, ls === 422 && lj.code === "PREFLIGHT_FAILED" && lj.checks.some((c) => c.id === id), `${ls} ${lj?.code}`);
  ok(`${label}: nothing changed (still DRAFT, no section locked)`, (await status()).status === "DRAFT" && (await locked()) === 0);
  await restore();
}
const w = await status();
await breaks("window under 10 working days", "L5",
  () => svc.from("assessment").update({ window_open: new Date(Date.now() - 864e5).toISOString(), window_close: new Date(Date.now() + 2 * 864e5).toISOString() }).eq("assessment_id", A),
  () => svc.from("assessment").update({ window_open: w.window_open, window_close: w.window_close }).eq("assessment_id", A));
await breaks("no recorded transfer basis", "L6",
  () => svc.from("tenant").update({ transfer_basis_recorded_at: null }).eq("tenant_id", tenantId),
  () => svc.from("tenant").update({ transfer_basis_recorded_at: new Date().toISOString() }).eq("tenant_id", tenantId));
await breaks("no consent text", "L6",
  () => svc.from("assessment").update({ consent_text_id: null }).eq("assessment_id", A),
  () => svc.from("assessment").update({ consent_text_id: w.consent_text_id }).eq("assessment_id", A));
await breaks("section C not agreed", "L2",
  () => svc.from("setup_record").update({ status: "DRAFT" }).eq("engagement_id", engId).eq("section", "C"),
  () => svc.from("setup_record").update({ status: "AGREED" }).eq("engagement_id", engId).eq("section", "C"));
await breaks("section D has no workshop date", "L2",
  () => svc.from("setup_record").update({ workshop_date: null }).eq("engagement_id", engId).eq("section", "D"),
  () => svc.from("setup_record").update({ workshop_date: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) }).eq("engagement_id", engId).eq("section", "D"));

[s, j] = await post(consultant, `/v1/assessments/${A}/launch`);
ok("launch succeeds once every blocking check passes", s === 200 && j.changed === true && j.status === "LAUNCHED" && j.sections_locked === 9 && j.leaders_in_scope === 3, `${s} ${JSON.stringify(j)}`);
ok("assessment LAUNCHED, all 9 sections locked", (await status()).status === "LAUNCHED" && (await locked()) === 9);
ok("engagement is FIELDING", (await svc.from("engagement").select("state").eq("engagement_id", engId).single()).data.state === "FIELDING");
const { data: aud } = await svc.from("audit_log").select("action, actor_id").eq("object_id", A).eq("action", "assessment.launched");
ok("launch is audited with the actor", aud?.length === 1 && !!aud[0].actor_id);
[s, j] = await post(consultant, `/v1/assessments/${A}/launch`);
ok("a second launch changes nothing (200, changed false)", s === 200 && j.changed === false);
const win = await svc.from("assessment").update({ window_close: new Date(Date.now() + 9 * 864e5).toISOString() }).eq("assessment_id", A);
ok("window is pinned after launch (ASSESSMENT_PINNED)", !!win.error && win.error.message.includes("ASSESSMENT_PINNED"), win.error?.message);
const sec = await svc.from("setup_record").update({ status: "DRAFT" }).eq("engagement_id", engId).eq("section", "B");
ok("setup is locked after launch (SETUP_LOCKED)", !!sec.error && sec.error.message.includes("SETUP_LOCKED"), sec.error?.message);

const { data: toks } = await svc.rpc("rpc_issue_invitations", { p_assessment_id: A, p_count: 1 });
const g = await fetch(`${base}/v1/survey`, { headers: { "x-survey-token": toks[0] } });
ok("a link issued after launch opens the survey with its consent text", g.status === 200 && !!(await g.json()).consent?.body);

// named links for the roster: one per active person, with cohort data, skipped once invited
const roster = async () => { const r = await consultant.f(`/v1/assessments/${A}/invitations`, { method: "POST", body: JSON.stringify({ mode: "roster" }) }); return [r.status, await r.json().catch(() => null)]; };
const { count: active } = await svc.from("person_of_record").select("person_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("employment_status", "ACTIVE");
[s, j] = await roster();
ok("one named link per active person on the roster", s === 201 && j.count === active && j.links.every((l) => l.email && /^[0-9a-f]{32}$/.test(l.token)), `${s} ${j?.count} vs ${active}`);
// the capture schema is closed to every API role, so this inspection goes through the Management API
const snaps = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST",
  headers: { Authorization: `Bearer ${readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "")}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: `select demographic_snapshot_json from capture.invitation where assessment_id = '${A}' and person_id is not null` }) })).json();
ok("each named link carries department, grade and tenure band", (snaps ?? []).length === active && snaps.every((x) => ["department", "grade", "tenure_band"].every((k) => k in x.demographic_snapshot_json)), JSON.stringify(snaps?.[0]));
[s, j] = await roster();
ok("issuing for the roster again skips everyone already invited", s === 200 && j.count === 0 && j.invited_before === active, `${s} ${j?.count}`);

await restoreTemplates();
done();
