// Privacy and data protection (spec 1.4.5, 1.4.1, 1.4.6, Table 6) against a running server and the live project.
// Seeds two throwaway clients (draft and released), creates throwaway users, and removes the users at the end.
// Covers: DPIA, processing register, sub processors, 72 hour breach clock, data subject requests, closed list demographics, purpose in consent and
// exports, DPIA launch block, coach assignment and the Coach read rule (RLS), the retention routes, and data subject self service by survey link.
// The database level destruction test (UT-44) is scripts/e2e-retention.mjs.
//   node --env-file=apps/web/.env.local scripts/e2e-privacy.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { ok, done, svc, signIn, pwOf, URL_, ANON, approveTemplates } from "./lib/e2e.mjs";
import { seedKit } from "./lib/seed.mjs";
import { surveyPayload } from "./lib/rehearsal-data.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const stamp = Date.now().toString(36);
const { sql } = seedKit(ref, tokenFile);   // read only questions about invitations and schema, and the one fixture insert for a locked scorecard
const seed = (script, ...a) => execFileSync("node", ["--env-file=apps/web/.env.local", script, ref, tokenFile, ...a], { encoding: "utf8" });
const draft = seed("scripts/seed-demo.mjs", "draft");
const [, TD, ED, AD] = /: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+) DRAFT/.exec(draft);
const RN = `Privacy test ${new Date().toISOString().slice(2, 19).replace(/\D/g, "")}`;
const rich = seed("scripts/seed-rich-demo.mjs", base, RN, "released");
const [, TR, ER, AR] = /Released\. .+?: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+)/.exec(rich);
const SLUG = RN.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
const db = svc();
// Migration 20261019010000 (objection tasks, ODPC, About you, due date default, breach contact, scorecard links) must be applied for the cells marked (migration).
const NEW = await Promise.all([db.from("consultant_task").select("task_id").limit(1), db.from("tenant").select("odpc_registration_ref").limit(1), db.from("platform_setting").select("value").eq("key", "breach_contact").maybeSingle(), db.from("scorecard_kpi_reading").select("reading_id").limit(1),
  db.rpc("rpc_action_link_kpi", { p_actor: "00000000-0000-0000-0000-000000000000", p_kpi: "kpi_none", p_actions: ["act_none"] }).then((r) => ({ error: /Could not find the function/.test(r.error?.message ?? "") ? r.error : null }))]);
ok("schema: migrations 20261019010000 and 20261019010100 are applied (consultant_task, tenant ODPC columns, breach_contact, scorecard_kpi_reading, rpc_action_link_kpi)", !NEW.some((r) => r.error) && !!NEW[2].data, NEW.map((r) => r.error?.message).filter(Boolean).join("; ") || "breach_contact setting missing");
if (NEW.some((r) => r.error) || !NEW[2].data) done();
// the seed names the Client Admin after the stamp in the tenant name; reading "the last admin.draft line" picks up another run's account when scripts run in parallel
const adminD = `admin.draft${(await db.from("tenant").select("name").eq("tenant_id", TD).single()).data.name.split(" ").at(-1)}@cdp-demo.example`;

const who = { con: await signIn("consultant@cdp-demo.example"), sa: await signIn("superadmin@cdp-demo.example"), caD: await signIn(adminD), caR: await signIn(`admin.${SLUG}@cdp-demo.example`),
  execR: await signIn(`exec.${SLUG}@cdp-demo.example`), other: await signIn("admin.fixture@cdp-demo.example") };
const call = async (w, method, path, body, raw) => {
  const r = await fetch(base + path, { method, headers: { ...(w ? { authorization: `Bearer ${who[w].t}` } : {}), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return raw ? r : [r.status, await r.json().catch(() => null)];
};
const created = [];
// a signed in browser session, for the pages
async function page(email) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password: pwOf(email) });
  if (error) throw new Error(email + ": " + error.message);
  return async (path) => { const r = await fetch(base + path, { redirect: "manual", headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } }); return [r.status, await r.text()]; };
}
async function mkUser(w, name, role) {
  const email = `${name}.${stamp}@cdp-demo.example`;
  const [s, j] = await call(w, "POST", "/v1/users", { email, full_name: `Test ${name}`, role });
  if (s !== 201) throw new Error(`user ${name}: ${s} ${JSON.stringify(j)}`);
  created.push(j.user_id);
  return { id: j.user_id, ...(await signIn(email, j.temp_password)) };
}
const P = (e) => `/v1/engagements/${e}/privacy`;
let s, j;

// ---------------------------------------------------------------- who may read
const execD = await mkUser("caD", `exec${stamp}`, "EXECUTIVE"), leadD = await mkUser("caD", `lead${stamp}`, "PEOPLE_LEADER"), coachD = await mkUser("caD", `coach${stamp}`, "COACH");
who.execD = execD; who.leadD = leadD; who.coachD = coachD;
const KINDS = ["dpia", "register", "breaches", "requests", "demographics", "coach-assignments"];
[s] = await call(null, "GET", `${P(ED)}/dpia`); ok("no session: 401", s === 401, s);
for (const k of KINDS) {
  for (const w of ["con", "caD"]) { [s] = await call(w, "GET", `${P(ED)}/${k}`); ok(`${k}: ${w} can read (200)`, s === 200, s); }
  for (const w of ["execD", "leadD", "coachD", "other"]) { [s] = await call(w, "GET", `${P(ED)}/${k}`); ok(`${k}: ${w} cannot read (403)`, s === 403, s); }
}
[s] = await call("con", "GET", `${P(ED)}/nonsense`); ok("an unknown record type is 404", s === 404, s);

// ---------------------------------------------------------------- DPIA, register, sub processors
[s] = await call("caD", "POST", `${P(ED)}/dpia`, { reference: "x", transfer_basis: "y" }); ok("DPIA: Client Admin cannot record (403)", s === 403, s);
[s] = await call("execD", "POST", `${P(ED)}/dpia`, { reference: "x", transfer_basis: "y" }); ok("DPIA: Executive cannot record (403)", s === 403, s);
[s] = await call("con", "POST", `${P(ED)}/dpia`, { reference: "x" }); ok("DPIA: transfer basis is required (422)", s === 422, s);
await db.from("tenant").update({ dpia_recorded_at: null }).eq("tenant_id", TD);
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/preflight`);
ok("pre-flight shows the DPIA check failing and blocking", j?.checks?.find((c) => c.id === "DPIA")?.pass === false && j.pass === false, `${s} ${JSON.stringify(j).slice(0, 250)}`);
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/launch`);
ok("launch is blocked by the DPIA check (422 PREFLIGHT_FAILED)", s === 422 && j?.code === "PREFLIGHT_FAILED" && j.checks.some((c) => c.id === "DPIA"), `${s} ${JSON.stringify(j?.checks?.map((c) => c.id))}`);
[s, j] = await call("con", "POST", `${P(ED)}/dpia`, { reference: "DPIA-2026-01, held by PAC legal", transfer_basis: "Standard contractual clauses, EU hosting" });
ok("the consultant records the DPIA (201)", s === 201 && j.dpia_id, s);
ok("the DPIA sets tenant.dpia_recorded_at", !!(await db.from("tenant").select("dpia_recorded_at").eq("tenant_id", TD).single()).data.dpia_recorded_at);
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/preflight`);
ok("the DPIA check now passes", j?.checks?.find((c) => c.id === "DPIA")?.pass === true);

[s] = await call("caD", "POST", `${P(ED)}/register`, { activity: "a", purpose: "b", data_categories: "c", legal_basis: "d", retention: "e" }); ok("register: Client Admin cannot add (403)", s === 403, s);
[s] = await call("con", "POST", `${P(ED)}/register`, { activity: "a", purpose: "b" }); ok("register: missing fields (422)", s === 422, s);
[s] = await call("con", "POST", `${P(ED)}/register`, { activity: "Culture survey", purpose: "Understand culture", data_categories: "Survey answers, work email", legal_basis: "Consent", retention: "24 months after close" }); ok("register: entry added (201)", s === 201, s);

const spName = `Test processor ${stamp}`;
[s] = await call("con", "POST", "/v1/sub-processors", { name: spName, purpose: "p", region: "EU", transfer_basis: "t" }); ok("sub processor: a consultant cannot add (403)", s === 403, s);
[s] = await call("caD", "POST", "/v1/sub-processors", { name: spName, purpose: "p", region: "EU", transfer_basis: "t" }); ok("sub processor: a Client Admin cannot add (403)", s === 403, s);
[s] = await call("sa", "POST", "/v1/sub-processors", { name: spName, purpose: "p" }); ok("sub processor: missing fields (422)", s === 422, s);
[s] = await call("sa", "POST", "/v1/sub-processors", { name: spName, purpose: "Hosting", region: "EU West", transfer_basis: "Contract clauses" }); ok("sub processor: Super Admin adds (201)", s === 201, s);
[s] = await call("sa", "POST", "/v1/sub-processors", { name: spName, purpose: "Hosting", region: "EU West", transfer_basis: "Contract clauses" }); ok("sub processor: duplicate name (422)", s === 422, s);
[s, j] = await call("con", "GET", "/v1/sub-processors"); ok("sub processor: a consultant can read the list", s === 200 && j.some((x) => x.name === spName), s);
await db.from("sub_processor").delete().eq("name", spName);

// ---------------------------------------------------------------- breaches: the 72 hour clock
[s] = await call("caD", "POST", `${P(ED)}/breaches`, { summary: "x" }); ok("breach: Client Admin cannot open (403)", s === 403, s);
[s] = await call("con", "POST", `${P(ED)}/breaches`, {}); ok("breach: summary required (422)", s === 422, s);
[s, j] = await call("con", "POST", `${P(ED)}/breaches`, { summary: "Test: a laptop with an export was lost." });
ok("breach: opened with notify_by exactly 72 hours after opened_at", s === 201 && new Date(j.notify_by) - new Date(j.opened_at) === 72 * 3600e3, `${s} ${j?.opened_at} ${j?.notify_by}`);
const inc = j.incident_id;
[s] = await call("caD", "PATCH", `${P(ED)}/breaches/${inc}`, {}); ok("breach: Client Admin cannot record notification (403)", s === 403, s);
[s] = await call("con", "PATCH", `${P(ED)}/breaches/${inc}`, { regulator_ref: "ODPC-TEST-1" }); ok("breach: consultant records the notification (200)", s === 200, s);
[s] = await call("con", "PATCH", `${P(ED)}/breaches/${inc}`, {}); ok("breach: a second notification is refused (409)", s === 409, s);
[s] = await call("con", "PATCH", `${P(ED)}/breaches/inc_nope`, {}); ok("breach: unknown incident (404)", s === 404, s);

// ---------------------------------------------------------------- data subject requests
const dsr = { kind: "ACCESS", subject_ref: "E-1001", due_on: "2026-12-31" };
for (const w of ["execD", "leadD", "coachD", "other"]) { [s] = await call(w, "POST", `${P(ED)}/requests`, dsr); ok(`request: ${w} cannot log (403)`, s === 403, s); }
const plus30 = (iso) => new Date(new Date(iso).getTime() + 30 * 864e5).toISOString().slice(0, 10);
[s, j] = await call("caD", "POST", `${P(ED)}/requests`, { ...dsr, due_on: undefined });
ok("request: with no due_on it is due 30 days after it was opened (201)", s === 201 && j.due_on === plus30(j.opened_at), `${s} ${j?.opened_at} ${j?.due_on}`);
const rqDefault = j?.request_id;
[s, j] = await call("caD", "PATCH", `${P(ED)}/requests/${rqDefault}`, { due_on: "2027-01-15" });
ok("request: the due date can be changed (200) and the change is stored", s === 200 && (await db.from("data_subject_request").select("due_on").eq("request_id", rqDefault).single()).data.due_on === "2027-01-15", `${s}`);
[s] = await call("caD", "PATCH", `${P(ED)}/requests/${rqDefault}`, { due_on: "15 January" }); ok("request: a due date that is not a date is refused (422)", s === 422, s);
[s, j] = await call("caD", "POST", `${P(ED)}/requests`, { ...dsr, due_on: "" });
ok("request: an empty due_on also means 30 days from opening (201)", s === 201 && j.due_on === plus30(j.opened_at), `${s} ${j?.due_on}`);
const trig = await db.from("data_subject_request").insert({ tenant_id: TD, kind: "ACCESS", subject_ref: "TRIG-1", due_on: null }).select("opened_at, due_on").single();
ok("database: a request inserted with no due date gets one 30 days after opening (trigger) (migration)", !trig.error && trig.data.due_on === plus30(trig.data.opened_at), trig.error?.message ?? JSON.stringify(trig.data));
await db.from("data_subject_request").delete().eq("subject_ref", "TRIG-1");
[s] = await call("caD", "POST", `${P(ED)}/requests`, { ...dsr, due_on: "31/12/2026" }); ok("request: bad date (422)", s === 422, s);
[s] = await call("caD", "POST", `${P(ED)}/requests`, { ...dsr, kind: "DELETE" }); ok("request: unknown kind (422)", s === 422, s);
[s, j] = await call("caD", "POST", `${P(ED)}/requests`, dsr); ok("request: Client Admin logs one (201)", s === 201 && j.status === "OPEN", s);
const rq = j.request_id;
[s] = await call("con", "POST", `${P(ED)}/requests`, { ...dsr, kind: "RECTIFY" }); ok("request: consultant logs one (201)", s === 201, s);
[s] = await call("caD", "PATCH", `${P(ED)}/requests/${rq}`, { status: "DONE" }); ok("request: closing needs a note (422)", s === 422, s);
[s] = await call("caD", "PATCH", `${P(ED)}/requests/${rq}`, { status: "OPEN", note: "x" }); ok("request: status must be DONE or REFUSED (422)", s === 422, s);
[s] = await call("execD", "PATCH", `${P(ED)}/requests/${rq}`, { status: "DONE", note: "x" }); ok("request: Executive cannot close (403)", s === 403, s);
[s] = await call("caD", "PATCH", `${P(ED)}/requests/${rq}`, { status: "DONE", note: "Sent the person their record." }); ok("request: Client Admin closes it (200)", s === 200, s);
[s] = await call("caD", "PATCH", `${P(ED)}/requests/${rq}`, { status: "REFUSED", note: "again" }); ok("request: a closed request does not reopen or close twice (409)", s === 409, s);

// ---------------------------------------------------------------- demographics (closed list, purpose required, no free text)
const att = { name: "Employment type", analytical_purpose: "Compare engagement between permanent and contract staff.", values: ["Permanent", "Contract"], is_sensitive: false };
for (const w of ["execD", "leadD", "coachD", "other"]) { [s] = await call(w, "POST", `${P(ED)}/demographics`, att); ok(`demographics: ${w} cannot define (403)`, s === 403, s); }
[s] = await call("caD", "POST", `${P(ED)}/demographics`, { ...att, analytical_purpose: "" }); ok("demographics: analytical purpose is required (422)", s === 422, s);
[s] = await call("caD", "POST", `${P(ED)}/demographics`, { ...att, analytical_purpose: "short" }); ok("demographics: a one word purpose is refused (422)", s === 422, s);
[s] = await call("caD", "POST", `${P(ED)}/demographics`, { ...att, values: ["Only one"] }); ok("demographics: fewer than two values (422)", s === 422, s);
[s] = await call("caD", "POST", `${P(ED)}/demographics`, { ...att, values: "Permanent, Contract" }); ok("demographics: values must be a list, not free text (422)", s === 422, s);
[s] = await call("caD", "POST", `${P(ED)}/demographics`, { ...att, values: ["Permanent", 5] }); ok("demographics: a non text value (422)", s === 422, s);
[s] = await call("caD", "POST", `${P(ED)}/demographics`, { ...att, values: Array.from({ length: 31 }, (_, i) => `v${i}`) }); ok("demographics: more than 30 values (422)", s === 422, s);
[s, j] = await call("caD", "POST", `${P(ED)}/demographics`, att); ok("demographics: Client Admin defines an attribute (201)", s === 201, s);
const A1 = j.attr_id;
[s] = await call("con", "POST", `${P(ED)}/demographics`, att); ok("demographics: a duplicate name is refused (422)", s === 422, s);
[s, j] = await call("con", "POST", `${P(ED)}/demographics`, { name: "Gender", analytical_purpose: "Check that results do not hide a gender gap.", values: ["Woman", "Man"], is_sensitive: true });
ok("demographics: a sensitive attribute always offers Prefer not to say", s === 201 && j.values_list.includes("Prefer not to say") && j.is_sensitive === true, `${s} ${JSON.stringify(j?.values_list)}`);
const A2 = j.attr_id;
const people = (await db.from("person_of_record").select("person_id").eq("tenant_id", TD).limit(2)).data;
const foreign = (await db.from("person_of_record").select("person_id").neq("tenant_id", TD).limit(1).single()).data;
const val = (w, p, a, v) => call(w, "PUT", `${P(ED)}/values`, { person_id: p, attr_id: a, value: v });
[s] = await val("execD", people[0].person_id, A1, "Permanent"); ok("person value: Executive cannot set (403)", s === 403, s);
[s] = await val("caD", people[0].person_id, A1, "Freelance"); ok("person value: a value outside the closed list is refused (422)", s === 422, s);
[s] = await val("caD", people[0].person_id, A1, "permanent"); ok("person value: matching is exact, so a different case is refused (422)", s === 422, s);
[s] = await val("caD", foreign.person_id, A1, "Permanent"); ok("person value: a person of another client is refused (422)", s === 422, s);
[s] = await val("caD", people[0].person_id, "dem_nope", "Permanent"); ok("person value: unknown attribute (422)", s === 422, s);
[s] = await val("caD", people[0].person_id, A1, "Permanent"); ok("person value: set from the list (200)", s === 200, s);
[s] = await val("caD", people[0].person_id, A1, "Contract"); ok("person value: changed (200)", s === 200 && (await db.from("person_demographic").select("value").eq("person_id", people[0].person_id).eq("attr_id", A1)).data[0].value === "Contract", s);
[s] = await val("caD", people[0].person_id, A2, null); ok("person value: clearing a sensitive value is allowed, it reads as Prefer not to say (200)", s === 200, s);
const bad = await db.from("person_demographic").insert({ person_id: people[1].person_id, attr_id: A1, tenant_id: TD, value: "Freelance" });
ok("database: a value outside the list is refused by the trigger too", !!bad.error && /DEMOGRAPHIC_VALUE_NOT_IN_LIST/.test(bad.error.message), bad.error?.message);

// ---------------------------------------------------------------- purpose in the consent text
[s] = await call("caD", "PUT", `${P(ED)}/purpose`, { purpose: "x" }); ok("purpose: Client Admin cannot set (403)", s === 403, s);
[s] = await call("con", "PUT", `${P(ED)}/purpose`, { purpose: "  " }); ok("purpose: empty is refused (422)", s === 422, s);
[s] = await call("con", "PUT", `${P(ED)}/purpose`, { purpose: "x".repeat(1001) }); ok("purpose: over 1000 characters is refused (422)", s === 422, s);
const PURPOSE = `Find where the culture blocks the 2027 growth plan (${stamp})`;
[s, j] = await call("con", "PUT", `${P(ED)}/purpose`, { purpose: PURPOSE });
ok("purpose: the consultant sets it (200) and it is stored on the engagement", s === 200 && (await db.from("engagement").select("purpose").eq("engagement_id", ED).single()).data.purpose === PURPOSE, `${s} ${JSON.stringify(j)}`);
// a new engagement's assessment reproduces the stored purpose in its consent text
const bare = seed("scripts/seed-demo.mjs", "bare");
const [, TB, EB] = /: (ten_\S+) \/ (eng_\S+) BARE/.exec(bare);
const caB = await signIn(`admin.bare${(await db.from("tenant").select("name").eq("tenant_id", TB).single()).data.name.split(" ").at(-1)}@cdp-demo.example`); who.caB = caB;
await call("con", "PUT", `${P(EB)}/purpose`, { purpose: PURPOSE });
[s, j] = await call("con", "POST", `/v1/engagements/${EB}/assessments`, { window_open: "2026-11-02", window_close: "2026-11-27" });
const body = (await db.from("consent_text").select("body").eq("consent_text_id", j.consent_text_id).single()).data.body;
ok("consent text of a new assessment states the stored purpose", s === 201 && body.includes(`The purpose of this assessment is: ${PURPOSE}.`), `${s}`);
[s, j] = await call("con", "PUT", `${P(EB)}/purpose`, { purpose: PURPOSE + " and the 2028 plan" });
const body2 = (await db.from("consent_text").select("body").eq("consent_text_id", (await db.from("assessment").select("consent_text_id").eq("engagement_id", EB).single()).data.consent_text_id).single()).data.body;
ok("changing the purpose updates a draft consent text in place", s === 200 && j.consent_updated === true && body2.includes("and the 2028 plan.") && !body2.includes(`${PURPOSE}.`), JSON.stringify(j));

// ---------------------------------------------------------------- launch, then the purpose is locked; data subject self service
const restoreTemplates = await approveTemplates();   // launch is gated on the owner's approval of the staff message templates
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/launch`);
ok("with the DPIA recorded the assessment launches", s === 200 && j.changed === true, `${s} ${JSON.stringify(j?.checks?.map((c) => c.id) ?? j?.title)}`);
[s] = await call("con", "PUT", `${P(ED)}/purpose`, { purpose: "changed after launch" }); ok("purpose: refused after launch (409 SETUP_LOCKED)", s === 409, s);
// objection: open and done block further links, refused does not; the staff route and the database function both skip, a task is opened, only the consultant sees tasks
const ob = (await db.from("person_of_record").select("person_id, employee_ref").eq("tenant_id", TD).eq("employment_status", "ACTIVE").order("employee_ref").limit(3)).data;
const activeN = (await db.from("person_of_record").select("person_id", { count: "exact", head: true }).eq("tenant_id", TD).eq("employment_status", "ACTIVE")).count;
const objReq = async (p) => (await call("caD", "POST", `${P(ED)}/requests`, { kind: "OBJECT", subject_ref: p.employee_ref, detail: "Objection test" }))[1];
const o1 = await objReq(ob[0]), o2 = await objReq(ob[1]), o3 = await objReq(ob[2]);
ok("objection logged by the Client Admin: due 30 days after opening", o1.kind === "OBJECT" && o1.due_on === plus30(o1.opened_at), JSON.stringify(o1));
await call("caD", "PATCH", `${P(ED)}/requests/${o2.request_id}`, { status: "DONE", note: "Agreed: no further links." });
await call("caD", "PATCH", `${P(ED)}/requests/${o3.request_id}`, { status: "REFUSED", note: "The objection was about something else." });
const tasks = (await db.from("consultant_task").select("*").eq("tenant_id", TD).eq("kind", "OBJECTION")).data ?? [];
ok("an objection logged by staff also opens a consultant task (migration)", [o1, o2, o3].every((o) => tasks.some((t) => t.source_ref === o.request_id && t.status === "OPEN")), JSON.stringify(tasks.map((t) => t.source_ref)));
// the objections report (owner ruling 22 Oct 2026, Erick Ngala comment 25): counts only, consultant and Super Admin
[s, j] = await call("con", "GET", `${P(ED)}/objections-report`);
ok("objections report: the consultant reads counts that match the tasks", s === 200 && j.total === tasks.length && j.open === tasks.filter((t) => t.status === "OPEN").length && j.done === tasks.filter((t) => t.status === "DONE").length, `${s} ${JSON.stringify(j)}`);
ok("objections report: counts only, no names, references or detail anywhere in it", Object.keys(j).sort().join() === "by_month,done,open,total" && !/employee|person|subject|detail|title|@/i.test(JSON.stringify(j)), JSON.stringify(j));
[s, j] = await call("sa", "GET", `${P(ED)}/objections-report`);
ok("objections report: the Super Admin can read it too", s === 200 && typeof j.total === "number", `${s}`);
[s] = await call("caD", "GET", `${P(ED)}/objections-report`);
ok("objections report: the Client Admin cannot read it (403)", s === 403, s);
[s] = await call("caR", "GET", `${P(ER)}/objections-report`);
ok("objections report: another client's Client Admin cannot read it (403)", s === 403, s);
const direct = await db.rpc("rpc_issue_person_invitations", { p_assessment_id: AD, p_people: [ob[0].person_id, ob[1].person_id] });
ok("database: issuing links for people with an open or done objection returns nothing and invites nobody (migration)", !direct.error && direct.data.length === 0 && (await db.from("invitation_roster").select("person_id").eq("assessment_id", AD).in("person_id", [ob[0].person_id, ob[1].person_id])).data.length === 0, direct.error?.message ?? JSON.stringify(direct.data));
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/invitations`, { mode: "roster" });
const links = j?.links ?? [];
ok("person linked survey links are issued", s === 201 && links.length > 2, `${s} ${links.length}`);
ok("the roster run skips people with an open or done objection and reports how many (migration not needed for the route)", j.skipped_objection === 2 && links.length === activeN - 2, `${j?.skipped_objection} ${links.length} of ${activeN}`);
{ const invited = (await db.from("invitation_roster").select("person_id").eq("assessment_id", AD)).data.map((r) => r.person_id);
  ok("the person whose objection was refused is invited, the other two are not", invited.includes(ob[2].person_id) && !invited.includes(ob[0].person_id) && !invited.includes(ob[1].person_id), `${invited.length}`); }
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/invitations`, { mode: "roster" });
ok("running the roster again still issues nothing for the objecting people", s === 200 || s === 201 ? (j.count === 0 && j.skipped_objection === 2) : false, `${s} ${JSON.stringify(j)}`);
{
  const mine = (await who.con.c.from("consultant_task").select("task_id")).data ?? [];
  ok("tasks: the consultant can read them (RLS)", mine.length >= 3, mine.length);
  for (const w of ["caD", "execR", "other"]) ok(`tasks: ${w} reads none (RLS)`, ((await who[w].c.from("consultant_task").select("task_id")).data ?? []).length === 0);
  const tid = tasks.find((t) => t.source_ref === o1.request_id)?.task_id ?? "tsk_missing";
  [s] = await call("caD", "PATCH", `${P(ED)}/tasks/${tid}`, {}); ok("tasks: Client Admin cannot mark one done (403)", s === 403, s);
  [s] = await call("con", "PATCH", `${P(ED)}/tasks/tsk_nope`, {}); ok("tasks: an unknown task (404)", s === 404, s);
  [s] = await call("con", "PATCH", `${P(ED)}/tasks/${tid}`, {}); ok("tasks: the consultant marks it done (200)", s === 200 && (await db.from("consultant_task").select("status, done_by").eq("task_id", tid).single()).data.status === "DONE", s);
  [s] = await call("con", "PATCH", `${P(ED)}/tasks/${tid}`, {}); ok("tasks: done twice is refused (409)", s === 409, s);
}
const tok = (i) => links[i].token;
const rights = async (t, method = "GET", body) => { const r = await fetch(base + "/v1/survey/rights", { method, headers: { "x-survey-token": t ?? "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null)]; };
[s] = await rights(null); ok("rights: no token (410)", s === 410, s);
[s] = await rights("0".repeat(32)); ok("rights: an unknown token (410)", s === 410, s);
[s, j] = await rights(tok(0));
ok("rights access: the person sees what is held (reference, email, their demographic answers)", s === 200 && j.state === "OPEN" && j.person?.employee_ref && j.demographics.some((d) => d.attr_id === A1), `${s} ${JSON.stringify(j)}`);
ok("rights access: the sensitive attribute is offered with the Prefer not to say choice", j.demographics.find((d) => d.attr_id === A2)?.values_list.includes("Prefer not to say"));
[s] = await rights(tok(0), "PUT", { attr_id: A1, value: "Freelance" }); ok("rights rectify: a value outside the list is refused (422)", s === 422, s);
[s] = await rights(tok(0), "PUT", { attr_id: "dem_nope", value: "x" }); ok("rights rectify: an attribute of nobody's survey (422)", s === 422, s);
[s] = await rights(tok(0), "PUT", { attr_id: A1, value: "Permanent" });
const pOf = (await db.from("person_of_record").select("person_id, employee_ref").eq("tenant_id", TD)).data;
ok("rights rectify: the person corrects their own demographic answer", s === 200, s);
[s, j] = await rights(tok(0));
ok("rights rectify: the correction shows when read back", j.demographics.find((d) => d.attr_id === A1).value === "Permanent", JSON.stringify(j.demographics));
[s, j] = await rights(tok(1), "POST", { kind: "OBJECT", detail: "I do not want my data used." });
{ const row = (await db.from("data_subject_request").select("due_on, kind, opened_at, subject_ref").eq("request_id", j.request_id).single()).data;
  ok("rights object: recorded as an open request due 30 days after opening", s === 201 && j.status === "OPEN" && row.kind === "OBJECT" && row.due_on === plus30(row.opened_at), `${s} ${JSON.stringify(row)}`);
  const t = (await db.from("consultant_task").select("*").eq("tenant_id", TD).eq("source_ref", j.request_id)).data ?? [];
  ok("rights object: a visible consultant task is opened for the objection (migration)", t.length === 1 && t[0].kind === "OBJECTION" && t[0].status === "OPEN" && t[0].title.includes(row.subject_ref) && t[0].detail === "I do not want my data used.", JSON.stringify(t)); }
[s] = await rights(tok(1)); ok("rights object: the objecting person's own link is ended at once (410, owner ruling 19 Oct)", s === 410, s);
[s] = await rights(tok(0), "POST", { kind: "OTHER" }); ok("rights: an unknown kind (422)", s === 422, s);
[s, j] = await rights(tok(2), "POST", { kind: "ERASE" });
ok("rights erase: the invitation record is erased and the request recorded as done", s === 201 && j.status === "DONE", `${s}`);
[s] = await rights(tok(2)); ok("rights erase: the erased link no longer works (410)", s === 410, s);
[s] = await rights(tok(2), "POST", { kind: "ERASE" }); ok("rights erase: a second erasure is refused (410)", s === 410, s);
[s, j] = await call("con", "POST", `/v1/assessments/${AD}/invitations`, { count: 1 });
[s, j] = await rights(j.tokens[0]); ok("rights: an anonymous seat holds nothing about a person", s === 200 && j.state === "ANONYMOUS", `${s} ${JSON.stringify(j)}`);
const { data: reqs } = await db.from("data_subject_request").select("kind, status").eq("tenant_id", TD);
ok("every self service action left a request record", ["RECTIFY", "OBJECT", "ERASE"].every((k) => reqs.some((r) => r.kind === k)), JSON.stringify(reqs));

// ---------------------------------------------------------------- ODPC registration (migration), breach contact, and what the page shows
{
  const od = { odpc_registration_ref: `ODPC/REG/${stamp}`, odpc_confirmed_on: "2026-09-15" };
  for (const w of ["caD", "execD", "leadD", "coachD", "other"]) { [s] = await call(w, "PUT", `${P(ED)}/odpc`, od); ok(`ODPC: ${w} cannot set it (403)`, s === 403, s); }
  [s] = await call("con", "PUT", `${P(ED)}/odpc`, { odpc_confirmed_on: "2026-09-15" }); ok("ODPC: the reference is required (422)", s === 422, s);
  [s] = await call("con", "PUT", `${P(ED)}/odpc`, { odpc_registration_ref: "x" }); ok("ODPC: the confirmed date is required with the reference (422)", s === 422, s);
  [s] = await call("con", "PUT", `${P(ED)}/odpc`, { ...od, odpc_confirmed_on: "2999-01-01" }); ok("ODPC: a date in the future is refused (422)", s === 422, s);
  [s] = await call("con", "PUT", `${P(ED)}/odpc`, { ...od, odpc_confirmed_on: "2026-02-31" }); ok("ODPC: 31 February is refused (422)", s === 422, s);
  [s] = await call("con", "PUT", `${P(ED)}/odpc`, { ...od, odpc_registration_ref: "r".repeat(101) }); ok("ODPC: a reference over 100 characters is refused (422)", s === 422, s);
  ok("ODPC: nothing was stored by the refusals", (await db.from("tenant").select("odpc_registration_ref").eq("tenant_id", TD).single()).data.odpc_registration_ref === null);
  [s, j] = await call("con", "PUT", `${P(ED)}/odpc`, od); const tn = (await db.from("tenant").select("odpc_registration_ref, odpc_confirmed_on").eq("tenant_id", TD).single()).data;
  ok("ODPC: the consultant sets the reference and the confirmed date (200)", s === 200 && tn.odpc_registration_ref === od.odpc_registration_ref && tn.odpc_confirmed_on === od.odpc_confirmed_on, `${s} ${JSON.stringify(tn)}`);
  [s] = await call("con", "PUT", `${P(ED)}/odpc`, { ...od, odpc_registration_ref: od.odpc_registration_ref + "-B" }); ok("ODPC: it can be corrected (200)", s === 200, s);
  const dbOnly = await db.from("tenant").update({ odpc_confirmed_on: null }).eq("tenant_id", TD);
  ok("database: a reference without a confirmed date is refused", !!dbOnly.error, dbOnly.error?.message);
  const bc = (await db.from("platform_setting").select("value").eq("key", "breach_contact").single()).data.value;
  ok("breach contact is a platform setting: cdp@pac.africa and Imran Issa", bc.email === "cdp@pac.africa" && bc.name === "Imran Issa", JSON.stringify(bc));
  ok("nobody but a Super Admin can read platform settings from a user token", ((await who.con.c.from("platform_setting").select("key")).data ?? []).length === 0 && ((await who.caD.c.from("platform_setting").select("key")).data ?? []).length === 0);
  const seeCon = await page("consultant@cdp-demo.example"), seeCa = await page(adminD);
  const [ps, html] = await seeCon(`/engagements/${ED}/privacy`);
  ok("the privacy page shows the ODPC reference and date, the breach contact, the tasks and the 30 day rule", ps === 200 && html.includes(`${od.odpc_registration_ref}-B`) && html.includes("Imran Issa") && html.includes("cdp@pac.africa") && html.includes("Objection from") && html.includes("30 days"), ps);
  const [cs, chtml] = await seeCa(`/engagements/${ED}/privacy`);
  ok("the Client Admin sees the breach contact and the ODPC reference but no tasks", cs === 200 && chtml.includes("Imran Issa") && chtml.includes(`${od.odpc_registration_ref}-B`) && !chtml.includes("Objection from"), cs);
}

// ---------------------------------------------------------------- response rate is submitted divided by invited, never headcount
{
  const { data: fc } = await db.rpc("rpc_fielding_counts", { p_assessment_id: AR });
  const hc = (await db.from("tenant").select("headcount").eq("tenant_id", TR).single()).data.headcount;
  const pct = Math.round((fc.submitted / fc.invited) * 100), wrong = Math.round((fc.submitted / hc) * 100);
  const seeCon2 = await page("consultant@cdp-demo.example");
  const plain = (h) => h.replace(/<!-- -->/g, "");
  const [, eh] = await seeCon2(`/engagements/${ER}`);
  ok("response rate on the engagement page is submitted of invited (not the declared headcount)", plain(eh).includes(`${pct}% response rate`) && (pct === wrong || !plain(eh).includes(`${wrong}% response rate`)), `${fc.submitted} of ${fc.invited}, headcount ${hc}`);
  // the web report no longer has a Method section (owner J5 ruling, 25 Oct 2026: no Method chapter), so the rate is checked on the engagement page only
}

// ---------------------------------------------------------------- About you (S2-04): attributes answered on the survey link, stored in the invitation snapshot only
{
  const H = (t) => ({ "x-survey-token": t, "content-type": "application/json" });
  const get = async (t) => { const r = await fetch(base + "/v1/survey", { headers: H(t) }); return [r.status, await r.json().catch(() => null)]; };
  const put = async (t, body) => { const r = await fetch(base + "/v1/survey", { method: "PUT", headers: H(t), body: JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)]; };
  const T = tok(4), T2 = tok(5);
  [s, j] = await get(T);
  const a1 = j?.about?.find((a) => a.attr_id === A1), a2 = j?.about?.find((a) => a.attr_id === A2);
  ok("About you: the survey offers the organisation's attributes as closed lists", s === 200 && !!a1 && !!a2 && j.about.length === 2, `${s} ${JSON.stringify(j?.about)}`);
  ok("About you: every list ends with Prefer not to say, exactly once", a1.values.join() === "Permanent,Contract,Prefer not to say" && a2.values.join() === "Woman,Man,Prefer not to say", JSON.stringify([a1.values, a2.values]));
  ok("About you: grade and unit come from the invitation (department and grade, nothing else)", Object.keys(j.prefill).every((k) => ["department", "team", "grade"].includes(k)) && !!(j.prefill.department || j.prefill.grade), JSON.stringify(j.prefill));
  const anon = (await call("con", "POST", `/v1/assessments/${AD}/invitations`, { count: 1 }))[1].tokens[0];
  ok("About you: an anonymous seat has no grade or unit to show", Object.keys((await get(anon))[1].prefill).length === 0);
  await fetch(base + "/v1/survey/consent", { method: "POST", headers: H(T), body: JSON.stringify({ decision: "AGREE" }) });
  const good = { payload: surveyPayload("staff", 77), language: "en", duration: 1800 };
  [s] = await put(T, { ...good, about: { [A1]: "Freelance" } }); ok("About you: a value outside the closed list is refused (422)", s === 422, s);
  [s] = await put(T, { ...good, about: { dem_nope: "Permanent" } }); ok("About you: an attribute that is not the organisation's is refused (422)", s === 422, s);
  [s] = await put(T, { ...good, about: { [A1]: 5 } }); ok("About you: a value that is not text is refused (422)", s === 422, s);
  [s] = await put(T, { ...good, about: [A1] }); ok("About you: answers that are not an object are refused (422)", s === 422, s);
  [s] = await put(T, { ...good, about: { [A1]: "permanent" } }); ok("About you: a different case is refused, matching is exact (422)", s === 422, s);
  const snapOf = async (t) => (await sql(`select demographic_snapshot_json as s, person_id from capture.invitation where token_hash = extensions.digest('${t}', 'sha256')`))[0];
  ok("About you: refused answers left nothing in the invitation snapshot", !("attributes" in (await snapOf(T)).s), JSON.stringify((await snapOf(T)).s));
  // the database function on its own: only a valid, unused link takes answers, and they land in the invitation snapshot under "attributes"
  const setA = (t, a) => db.rpc("rpc_set_invitation_attributes", { p_token: t, p_attrs: a });
  const r0 = await setA("0".repeat(32), { [A1]: "Contract" }); ok("About you: an unknown link takes no answers (false)", !r0.error && r0.data === false, JSON.stringify(r0));
  const r1 = await setA(T2, { [A1]: "Contract", [A2]: "Prefer not to say" });
  ok("About you: a valid link takes the answers into its snapshot, next to the group labels", !r1.error && r1.data === true && (await snapOf(T2)).s.attributes?.[A1] === "Contract" && (await snapOf(T2)).s.attributes?.[A2] === "Prefer not to say" && !!(await snapOf(T2)).s.grade, JSON.stringify((await snapOf(T2)).s));
  const r2 = await setA(T2, { [A1]: "Freelance" }); ok("About you: the function itself refuses a value outside the list", !!r2.error || r2.data !== true, JSON.stringify(r2));
  [s] = await put(T, { ...good, about: { [A1]: "Contract", [A2]: "Prefer not to say" } });
  ok("About you: the submit with answers succeeds (200)", s === 200, s);
  const after = await snapOf(T);
  ok("About you: after submit the invitation's snapshot is emptied and its person link destroyed, as before", JSON.stringify(after.s) === "{}" && after.person_id === null, JSON.stringify(after));
  const cnt = async (cond) => Number((await sql(`select count(*)::int as n from capture.response where assessment_id = '${AD}' ${cond}`))[0].n);
  ok("About you: the response carries the answers in its group snapshot (counted, never read one by one)", (await cnt("and demographic_snapshot_json -> 'attributes' ->> '" + A1 + "' = 'Contract'")) === 1);
  ok("About you: no column of any response table can join to a person, an invitation or a token", Number((await sql("select count(*)::int as n from information_schema.columns where table_schema = 'capture' and table_name like 'response%' and column_name in ('person_id', 'invitation_id', 'token_hash', 'email', 'employee_ref')"))[0].n) === 0);
  [s] = await put(T, { ...good, about: { [A1]: "Contract" } }); ok("About you: a link that has submitted cannot submit or add answers again (410)", s === 410, s);
  const T3 = tok(6);
  await fetch(base + "/v1/survey/consent", { method: "POST", headers: H(T3), body: JSON.stringify({ decision: "AGREE" }) });
  [s] = await put(T3, good); ok("About you: a submit with no answers at all still works (the screen is optional)", s === 200, s);
  const rl = await (await fetch(base + "/respond")).text();
  ok("the survey page footer links to the rights page", rl.includes('href="/respond/rights"') || rl.includes("/respond/rights"), "no link in /respond");
}

// ---------------------------------------------------------------- scorecard readings and action links after launch (released client; migration)
{
  const sc = `/v1/engagements/${ER}/scorecard`, OBJ = `obj_pt_${stamp}`, KPI = `kpi_pt_${stamp}`;   // ids made per run: a crashed run cannot block the next
  await sql(`alter table public.objective disable trigger objective_lock; alter table public.scorecard_kpi disable trigger scorecard_kpi_lock;
    insert into public.objective (objective_id, tenant_id, engagement_id, title, priority_keys, external_ref) values ('${OBJ}', '${TR}', '${ER}', 'Privacy test objective', '{}', 'P-OBJ');
    insert into public.scorecard_kpi (kpi_id, tenant_id, engagement_id, objective_id, name, unit, direction, baseline_value, baseline_date, baseline_source, target_12m, external_ref)
      values ('${KPI}', '${TR}', '${ER}', '${OBJ}', 'Privacy test KPI', 'PERCENT', 'UP', 10, '2026-01-01', 'test', 20, 'P-KPI');
    alter table public.objective enable trigger objective_lock; alter table public.scorecard_kpi enable trigger scorecard_kpi_lock;`);
  const [sp, jp] = await call("con", "POST", `/v1/assessments/${AR}/plan`, {});   // the released seed has no action plan: build it through the route
  ok("the action plan is built for the released client", sp === 200 || sp === 201, `${sp} ${JSON.stringify(jp).slice(0, 200)}`);
  [s, j] = await call("con", "POST", `/v1/assessments/${AR}/plan`, {});   // the plan gives the actions to link (201 now, 200 if it exists)
  ok("the released client has an action plan", s === 201 || s === 200, `${s} ${j?.title}`);
  const acts = (await db.from("action").select("action_id, objective").eq("assessment_id", AR).limit(2)).data;
  ok("the released client has actions to link", acts.length === 2, acts.length);
  const rd = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const file = (extra = {}) => ({ objectives: [{ title: "x", external_ref: "P-OBJ", priority_keys: [], kpis: [{ external_ref: "P-KPI", readings: [{ read_on: rd, value: 12 }], linked_actions: [acts[0].action_id], ...extra }] }] });
  [s, j] = await call("con", "POST", `${sc}/import`, file());
  ok("after release: readings and an action link are accepted for a KPI matched by external_ref (200, locked)", s === 200 && j.locked === true, `${s} ${JSON.stringify(j).slice(0, 200)}`);
  ok("the action now carries the KPI id (Table 77 scorecard_kpi_id)", (await db.from("action").select("scorecard_kpi_id").eq("action_id", acts[0].action_id).single()).data.scorecard_kpi_id === KPI && (await db.from("action").select("scorecard_kpi_id").eq("action_id", acts[1].action_id).single()).data.scorecard_kpi_id === null);
  [s, j] = await call("con", "POST", `${sc}/import`, file());
  ok("importing the same file again changes nothing", s === 200 && (await db.from("scorecard_kpi_reading").select("reading_id").eq("kpi_id", KPI)).data.length === 1);
  [s, j] = await call("con", "POST", `${sc}/import`, file({ linked_actions: [acts[0].action_id, acts[1].action_id] }));
  ok("a second action can be linked, the first stays linked", s === 200 && (await db.from("action").select("action_id").eq("scorecard_kpi_id", KPI)).data.length === 2);
  [s, j] = await call("con", "GET", sc);
  const k = j?.objectives?.find((o) => o.external_ref === "P-OBJ")?.kpis?.[0];
  ok("the scorecard JSON lists the readings and the linked actions with their status", s === 200 && k?.readings.length === 1 && k.actions.length === 2 && k.actions.every((a) => a.status && a.level && a.objective) && k.linked_actions.length === 2, JSON.stringify(k));
  [s, j] = await call("execR", "GET", sc);
  ok("an Executive reads the scorecard but sees no DRAFT action (RLS: only published actions of a released report)", s === 200 && j.objectives[0].kpis[0].actions.length === 0 && j.objectives[0].kpis[0].readings.length === 1, `${s} ${j?.objectives?.[0]?.kpis?.[0]?.actions?.length}`);
  [s] = await call("other", "GET", sc); ok("a Client Admin of another client cannot read it (403)", s === 403, s);
  const ec = await fetch(base + sc + "/export?format=csv", { headers: { authorization: `Bearer ${who.con.t}` } }).then((r) => r.text()).catch(() => "");
  ok("the CSV export carries the linked action ids", ec.includes(acts[0].action_id) && ec.includes(acts[1].action_id) && ec.includes(`${rd}=12`), ec.slice(0, 300));
  [s, j] = await call("con", "POST", `${sc}/import`, file({ linked_actions: ["act_doesnotexist"] })); ok("an action id that does not exist cannot be linked (422)", s === 422, `${s} ${j?.title}`);
  [s, j] = await call("con", "POST", `${sc}/import`, { objectives: [{ title: "New", priority_keys: [], kpis: [{ name: "New KPI" }] }] }); ok("after release a new objective is still refused: 409 SETUP_LOCKED", s === 409 && j.code === "SETUP_LOCKED", `${s} ${j?.code}`);
  [s] = await call("execR", "POST", `${sc}/import`, file()); ok("after release an Executive cannot import (403)", s === 403, s);
  await sql(`alter table public.objective disable trigger objective_lock; alter table public.scorecard_kpi disable trigger scorecard_kpi_lock;
    delete from public.objective where objective_id = '${OBJ}';
    alter table public.objective enable trigger objective_lock; alter table public.scorecard_kpi enable trigger scorecard_kpi_lock;`);
  ok("deleting a KPI unlinks its actions and removes its readings", (await db.from("action").select("action_id").eq("scorecard_kpi_id", KPI)).data.length === 0 && (await db.from("scorecard_kpi_reading").select("reading_id").eq("kpi_id", KPI)).data.length === 0);
}

// ---------------------------------------------------------------- coach assignment and the Coach read rule (released client)
const coachR = await mkUser("caR", `coachr${stamp}`, "COACH"); who.coachR = coachR;
const las = (await db.from("leader_assignment").select("assignment_id, person_id").eq("tenant_id", TR)).data;
const results = (await db.from("leader_result").select("assignment_id").eq("assessment_id", AR)).data.map((r) => r.assignment_id);
const withResult = [...new Set(las.filter((l) => results.includes(l.assignment_id)).map((l) => l.person_id))];
const [L1, L2] = withResult;
ok("the released client has leaders with results", !!L2, withResult.length);
const mineOf = (p) => las.filter((l) => l.person_id === p).map((l) => l.assignment_id);
const seen = async () => ({ lr: (await coachR.c.from("leader_result").select("assignment_id")).data ?? [], di: (await coachR.c.from("development_item").select("assignment_id")).data ?? [] });
let v = await seen();
ok("a Coach with no assignment reads no leader result and no development item", v.lr.length === 0 && v.di.length === 0, `${v.lr.length} ${v.di.length}`);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const asg = (w, body) => call(w, "POST", `${P(ER)}/coach-assignments`, body);
const body0 = { coach_user_id: coachR.id, leader_person_ids: [L1], from_date: day(-1), to_date: day(30) };
[s] = await asg("caR", body0); ok("coach assignment: Client Admin cannot create (403)", s === 403, s);
[s] = await asg("execR", body0); ok("coach assignment: Executive cannot create (403)", s === 403, s);
[s] = await asg("con", { ...body0, coach_user_id: who.caR.t && (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === `exec.${SLUG}@cdp-demo.example`).id }); ok("coach assignment: the user must be a Coach (422)", s === 422, s);
[s] = await asg("con", { ...body0, leader_person_ids: [foreign.person_id] }); ok("coach assignment: a leader of another client is refused (422)", s === 422, s);
[s] = await asg("con", { ...body0, leader_person_ids: [] }); ok("coach assignment: at least one leader (422)", s === 422, s);
[s] = await asg("con", { ...body0, from_date: day(5), to_date: day(1) }); ok("coach assignment: to before from (422)", s === 422, s);
[s, j] = await asg("con", body0); ok("coach assignment: the consultant creates it (201)", s === 201, `${s} ${JSON.stringify(j)}`);
const ca1 = j.coach_assignment_id;
v = await seen();
ok("the Coach now reads results of the assigned leader only", v.lr.length > 0 && v.lr.every((r) => mineOf(L1).includes(r.assignment_id)), `${v.lr.length}`);
ok("the Coach reads development items of the assigned leader only", v.di.every((r) => mineOf(L1).includes(r.assignment_id)), `${v.di.length}`);
ok("the Coach cannot see the other leader's result", !v.lr.some((r) => mineOf(L2).includes(r.assignment_id)));
[s, j] = await asg("con", { ...body0, leader_person_ids: [L2], from_date: day(2), to_date: day(9) });
v = await seen();
ok("an assignment that has not started yet grants nothing", !v.lr.some((r) => mineOf(L2).includes(r.assignment_id)), `${v.lr.length}`);
[s] = await call("caR", "PATCH", `${P(ER)}/coach-assignments/${ca1}`, {}); ok("coach assignment: Client Admin cannot end it (403)", s === 403, s);
[s] = await call("con", "PATCH", `${P(ER)}/coach-assignments/${ca1}`, {}); ok("coach assignment: the consultant ends it (200)", s === 200, s);
[s] = await call("con", "PATCH", `${P(ER)}/coach-assignments/${ca1}`, {}); ok("coach assignment: ending twice is refused (409)", s === 409, s);
v = await seen();
ok("after the assignment ends the Coach reads nothing again", v.lr.length === 0 && v.di.length === 0, `${v.lr.length} ${v.di.length}`);
ok("other roles keep their existing reads (Executive still reads released leader results)", ((await who.execR.c.from("leader_result").select("assignment_id")).data ?? []).length > 0);
ok("a Coach cannot read the assignment table of other coaches", ((await coachR.c.from("coach_assignment").select("coach_user_id")).data ?? []).every((r) => r.coach_user_id === coachR.id));

// ---------------------------------------------------------------- exports carry the purpose
await db.from("engagement").update({ purpose: PURPOSE }).eq("engagement_id", ER);
const rep = (await db.from("report").select("report_id").eq("assessment_id", AR).eq("status", "RELEASED").eq("type", "ORGANISATIONAL").limit(1).single()).data;
const ex = await call("con", "GET", `/v1/reports/${rep.report_id}/export?format=pptx`, null, true);
const dir = mkdtempSync(join(tmpdir(), "priv-")), file = join(dir, "r.pptx");
writeFileSync(file, Buffer.from(await ex.arrayBuffer()));
const xml = execFileSync("unzip", ["-p", file, "ppt/slides/slide1.xml"], { encoding: "utf8" });
ok("a released PPTX export carries the stored purpose on its cover", ex.status === 200 && xml.includes(`Purpose: ${PURPOSE}`), ex.status);

// ---------------------------------------------------------------- retention routes (released client)
[s] = await call("caR", "POST", `${P(ER)}/retention/schedule`); ok("retention: Client Admin cannot schedule (403)", s === 403, s);
[s, j] = await call("con", "POST", `${P(ER)}/retention/schedule`);
const close = (await db.from("assessment").select("window_close").eq("assessment_id", AR).single()).data.window_close.slice(0, 10);
const E = await import("@pac/cdp-engine");
ok("retention: the schedule comes from the window close through the engine (201)", s === 201 && j.close_date === close && j.destroy_on === E.retentionSchedule(close).destroy_on && j.notice_90_on === E.retentionSchedule(close).notice_90, `${s} ${JSON.stringify(j)}`);
[s, j] = await call("con", "POST", `${P(ER)}/retention/schedule`); ok("retention: scheduling again changes nothing (200, created false)", s === 200 && j.created === false, s);
[s] = await call("caR", "GET", `${P(ER)}/dpia`);
ok("retention: the Client Admin can read the schedule", ((await who.caR.c.from("retention_schedule").select("engagement_id")).data ?? []).length === 1);
[s] = await call("execR", "POST", `${P(ER)}/retention/notices`); ok("retention: Executive cannot send notices (403)", s === 403, s);
[s, j] = await call("con", "POST", `${P(ER)}/retention/notices`);
ok("retention: notices not yet due are not sent (200 with none sent, or 503 when email is not configured)", (s === 200 && j.sent.length === 0) || s === 503, `${s} ${JSON.stringify(j)}`);
[s, j] = await call("con", "POST", `${P(ER)}/retention/destroy`); ok("retention: destroying before the date is refused (409)", s === 409, `${s} ${j?.title}`);
[s] = await call("caR", "POST", `${P(ER)}/retention/destroy`); ok("retention: Client Admin cannot destroy (403)", s === 403, s);
await db.from("retention_schedule").update({ destroy_on: day(-1), notice_90_on: day(-92), notice_30_on: day(-32) }).eq("engagement_id", ER);
[s, j] = await call("con", "POST", `${P(ER)}/retention/destroy`);
ok("retention: after the date the responses are destroyed and the certificate is returned (200)", s === 200 && /^dcr_/.test(j.cert_id) && j.cert_hash?.length === 64, `${s} ${JSON.stringify(j)}`);
[s] = await call("con", "POST", `${P(ER)}/retention/destroy`); ok("retention: a second destruction is refused (409)", s === 409, s);
ok("retention: the Client Admin can read the certificate", ((await who.caR.c.from("destruction_certificate").select("cert_id")).data ?? []).length === 1);
ok("retention: the score object of the destroyed engagement is still there", (await db.from("score_object").select("assessment_id", { count: "exact", head: true }).eq("assessment_id", AR)).count >= 1);
const aud = (await db.from("audit_log").select("action").eq("tenant_id", TR).like("action", "retention.%")).data.map((a) => a.action);
ok("retention: scheduling and destruction are audited", aud.includes("retention.scheduled") && aud.includes("retention.destroyed"), JSON.stringify(aud));
const audD = (await db.from("audit_log").select("action").eq("tenant_id", TD).like("action", "privacy.%")).data.map((a) => a.action);
ok("privacy writes are audited", ["privacy.dpia.created", "privacy.breaches.created", "privacy.requests.created", "privacy.demographics.created", "privacy.purpose.set"].every((a) => audD.includes(a)), JSON.stringify([...new Set(audD)]));

await restoreTemplates();
for (const id of created) await db.auth.admin.deleteUser(id);
done(`\nClients to remove with cleanup-test-tenants: ${TD}, ${TR}, ${TB}`);
