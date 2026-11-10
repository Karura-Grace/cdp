// Strategic scorecard (spec 1.4.3, S1-09, L4): objectives and KPIs, every validation, CSV and JSON import, export, the roles
// of Table 7, L4 reading the scorecard, and the lock after launch. Seeds a DRAFT engagement and uses the fixture tenant for role cells.
//   node --env-file=.env.local scripts/e2e-scorecard.mjs <project-ref> <token-file> [base-url]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, pwOf, approveTemplates } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "draft"], { encoding: "utf8" });
const [, tenantId, E, A] = /: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+) DRAFT/.exec(out);
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// the seed names the Client Admin after the stamp in the tenant name; "the last admin.draft line" would pick up another run's account when scripts run in parallel
const adminEmail = `admin.draft${(await svc.from("tenant").select("name").eq("tenant_id", tenantId).single()).data.name.split(" ").at(-1)}@cdp-demo.example`;

// the seeded Section B has two priorities; the checks below use three
{ const { data: b } = await svc.from("setup_record").select("setup_id, payload_json").eq("engagement_id", E).eq("section", "B").eq("perspective", "AGREED").single();
  const p = b.payload_json.priorities; if (p.length < 3) await svc.from("setup_record").update({ payload_json: { ...b.payload_json, priorities: [...p, { ref: `B3.${p.length + 1}`, text: "Retain and grow our people", goal_type: p[0].goal_type }] } }).eq("setup_id", b.setup_id); }

// Migration 20261019010000 (external_ref, readings, action link) must be applied for everything below that saves a scorecard.
{ const p = await svc.from("scorecard_kpi_reading").select("reading_id").limit(1), q = await svc.from("scorecard_kpi").select("external_ref").limit(1);
  ok("schema: migration 20261019010000 is applied (external_ref and scorecard_kpi_reading exist)", !p.error && !q.error, (p.error ?? q.error)?.message);
  if (p.error || q.error) done(); }

async function session(em) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email: em, password: pwOf(em) });
  if (error) throw new Error(em + ": " + error.message);
  const f = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json", ...(init.headers ?? {}) } });
  const call = async (method, path, body, type) => {
    const r = await f(path, { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), headers: type ? { "content-type": type } : undefined });
    return [r.status, await r.json().catch(() => null)];
  };
  return { f, call };
}
const con = await session("consultant@cdp-demo.example"), adm = await session(adminEmail);
const exec = await session("exec.fixture@cdp-demo.example"), lead = await session("peoplelead.fixture@cdp-demo.example"), root = await session("superadmin@cdp-demo.example");
const { data: ften } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const F = (await svc.from("engagement").select("engagement_id").eq("tenant_id", ften.tenant_id).single()).data.engagement_id;   // launched fixture engagement
const SC = `/v1/engagements/${E}/scorecard`;
const failing = (j) => (j?.checks ?? []).filter((c) => !c.pass && c.blocking).map((c) => c.id);
const errs = (j) => (j?.errors ?? []).join(" | ");
const stored = async () => (await svc.from("objective").select("objective_id").eq("engagement_id", E)).data.length;

// ---- who may call (Table 7, following Setup Sections: consultant and Client Admin write, Executive reads)
for (const [m, p] of [["GET", ""], ["PUT", ""], ["POST", "/import"], ["GET", "/export"]]) {
  const r = await fetch(base + SC + p, { method: m, headers: { "content-type": "application/json" }, body: m === "GET" ? undefined : "{}" });
  ok(`no session: ${m} scorecard${p} is 401`, r.status === 401, r.status);
}
let [st, j] = await exec.call("GET", `/v1/engagements/${F}/scorecard`); ok("executive reads the scorecard (200)", st === 200 && Array.isArray(j.objectives), st);
ok("executive may export CSV", (await exec.f(`/v1/engagements/${F}/scorecard/export?format=csv`)).status === 200);
[st] = await exec.call("PUT", `/v1/engagements/${F}/scorecard`, { objectives: [] }); ok("executive cannot write (403)", st === 403, st);
[st] = await exec.call("POST", `/v1/engagements/${F}/scorecard/import`, "objective\n", "text/csv"); ok("executive cannot import (403)", st === 403, st);
for (const [n, s] of [["people leader", lead], ["super admin", root]]) {
  [st] = await s.call("GET", `/v1/engagements/${F}/scorecard`); ok(`${n} cannot read (403)`, st === 403, st);
  [st] = await s.call("PUT", `/v1/engagements/${F}/scorecard`, { objectives: [] }); ok(`${n} cannot write (403)`, st === 403, st);
}
[st] = await adm.call("GET", `/v1/engagements/${F}/scorecard`); ok("a Client Admin of another tenant cannot read (403)", st === 403, st);
[st] = await adm.call("PUT", `/v1/engagements/${F}/scorecard`, { objectives: [] }); ok("a Client Admin of another tenant cannot write (403)", st === 403, st);
[st, j] = await con.call("PUT", `/v1/engagements/${F}/scorecard`, { objectives: [] });
ok("after launch the consultant is refused: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
[st, j] = await exec.call("GET", `/v1/engagements/${F}/scorecard`); ok("a launched engagement reads as locked", j.locked === true);
const lockedIns = await svc.from("objective").insert({ tenant_id: ften.tenant_id, engagement_id: F, title: "x", priority_keys: [] });
ok("the database refuses an objective on a launched engagement (SETUP_LOCKED)", !!lockedIns.error && lockedIns.error.message.includes("SETUP_LOCKED"), lockedIns.error?.message);

// ---- the draft engagement: starts empty, offers the Section B priorities
[st, j] = await con.call("GET", SC);
ok("GET: empty scorecard, three Section B priorities offered, not locked", st === 200 && j.objectives.length === 0 && j.priorities.map((p) => p.ref).join() === "B3.1,B3.2,B3.3" && j.locked === false, JSON.stringify(j));
[st, j] = await con.call("PUT", SC, []); ok("a non object body is refused (422)", st === 422, st);

// ---- every validation on PUT (a refusal stores nothing)
const kpi = (o = {}) => ({ name: "Digital share", unit: "PERCENT", currency_code: null, direction: "HIGHER_IS_BETTER", baseline_value: 22, baseline_date: "2026-06-30", baseline_source: "Finance report", target_12m: 35, target_3y: 45, orientation: null, ...o });
const obj = (o = {}, k = [kpi()]) => ({ title: "Grow digital revenue", priority_keys: ["B3.1"], kpis: k, ...o });
const bad = async (label, objs, re) => {
  const [s, r] = await con.call("PUT", SC, { objectives: objs });
  ok(`refused: ${label}`, s === 422 && r.code === "VALIDATION_FAILED" && re.test(errs(r)), `${s} ${errs(r) || JSON.stringify(r)}`);
};
await bad("objectives is not a list", "x", /list/);
await bad("empty title", [obj({ title: "  " })], /Objective 1: title is required/);
await bad("title over 200 characters", [obj({ title: "x".repeat(201) })], /title is required, up to 200/);
await bad("no linked priority", [obj({ priority_keys: [] })], /link at least one Section B priority/);
await bad("a priority that is not in Section B", [obj({ priority_keys: ["B3.9"] })], /"B3.9" is not a Section B priority \(use B3.1, B3.2, B3.3\)/);
await bad("the same priority linked twice", [obj({ priority_keys: ["B3.1", "B3.1"] })], /linked twice/);
await bad("two objectives with one title", [obj(), obj({ title: "GROW digital revenue" }, [kpi({ name: "Other" })])], /Objective 2: the objective title .* is used twice/);
await bad("no KPI anywhere", [obj({}, [])], /at least one KPI/);
await bad("empty KPI name", [obj({}, [kpi({ name: "" })])], /Objective 1, KPI 1: name is required/);
await bad("KPI name over 120 characters", [obj({}, [kpi({ name: "k".repeat(121) })])], /name is required, up to 120/);
await bad("two KPIs with one name", [obj({}, [kpi(), kpi({ name: "digital SHARE" })])], /KPI 2: the KPI name .* is used twice/);
await bad("unit outside the list", [obj({}, [kpi({ unit: "KILOS" })])], /unit must be one of PERCENT, COUNT, CURRENCY, RATIO, DAYS, SCORE, OTHER/);
await bad("CURRENCY without a currency code", [obj({}, [kpi({ unit: "CURRENCY" })])], /currency_code must be a three letter ISO 4217 code/);
await bad("CURRENCY with a lower case code", [obj({}, [kpi({ unit: "CURRENCY", currency_code: "kes" })])], /ISO 4217/);
await bad("CURRENCY with a four letter code", [obj({}, [kpi({ unit: "CURRENCY", currency_code: "KESS" })])], /ISO 4217/);
await bad("a currency code on a PERCENT KPI", [obj({}, [kpi({ currency_code: "KES" })])], /only for the CURRENCY unit/);
await bad("direction outside the list", [obj({}, [kpi({ direction: "UP" })])], /direction must be HIGHER_IS_BETTER or LOWER_IS_BETTER/);
await bad("baseline value is text", [obj({}, [kpi({ baseline_value: "22" })])], /baseline_value must be a number/);
await bad("baseline value out of range", [obj({}, [kpi({ baseline_value: 1e13 })])], /baseline_value must be a number/);
await bad("baseline date not a date", [obj({}, [kpi({ baseline_date: "30/06/2026" })])], /baseline_date must be a date/);
await bad("baseline date 31 February", [obj({}, [kpi({ baseline_date: "2026-02-31" })])], /baseline_date must be a date/);
const future = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
await bad("baseline date in the future", [obj({}, [kpi({ baseline_date: future })])], /baseline_date must not be in the future/);
await bad("empty baseline source", [obj({}, [kpi({ baseline_source: "" })])], /baseline_source is required/);
await bad("baseline source over 200 characters", [obj({}, [kpi({ baseline_source: "s".repeat(201) })])], /baseline_source is required, up to 200/);
await bad("no 12 month target", [obj({}, [kpi({ target_12m: undefined })])], /target_12m is required/);
await bad("12 month target below the baseline when higher is better", [obj({}, [kpi({ target_12m: 10 })])], /target_12m must be above the baseline \(22\)/);
await bad("12 month target equal to the baseline", [obj({}, [kpi({ target_12m: 22 })])], /target_12m must be above the baseline/);
await bad("12 month target above the baseline when lower is better", [obj({}, [kpi({ direction: "LOWER_IS_BETTER", target_12m: 30, target_3y: null })])], /target_12m must be below the baseline \(22\)/);
await bad("3 year target on the wrong side", [obj({}, [kpi({ target_3y: 20 })])], /target_3y must be above the baseline/);
await bad("3 year target is text", [obj({}, [kpi({ target_3y: "x" })])], /target_3y must be a number or empty/);
await bad("orientation outside the list", [obj({}, [kpi({ orientation: "SPEED" })])], /orientation must be ENGAGE, INNOVATE, PERFORM, GOVERN/);
await bad("two KPIs on one orientation", [obj({}, [kpi({ orientation: "ENGAGE" }), kpi({ name: "Second", orientation: "ENGAGE" })])], /only one KPI may track ENGAGE/);
ok("nothing was stored by any refusal", (await stored()) === 0);

// ---- ISO 4217, external_ref, readings and linked actions (shape refusals)
await bad("a three letter code that is not an ISO 4217 currency", [obj({}, [kpi({ unit: "CURRENCY", currency_code: "ZZZ" })])], /"ZZZ" is not an ISO 4217 currency code/);
await bad("XXX (ISO's code for no currency)", [obj({}, [kpi({ unit: "CURRENCY", currency_code: "XXX" })])], /"XXX" is not an ISO 4217 currency code/);
await bad("a code that was never issued (KSH)", [obj({}, [kpi({ unit: "CURRENCY", currency_code: "KSH" })])], /"KSH" is not an ISO 4217 currency code/);
// owner ruling 22 Oct 2026: money KPIs are in USD only, the platform does not convert
{ const [s2, r2] = await con.call("PUT", SC, { objectives: [obj({}, [kpi({ unit: "CURRENCY", currency_code: "USD" })])] }); ok("currency code USD is accepted", s2 === 200, `${s2} ${errs(r2)}`); }
for (const code of ["KES", "EUR", "ZAR", "XOF"]) await bad(`currency code ${code} is refused: USD only`, [obj({}, [kpi({ unit: "CURRENCY", currency_code: code })])], /US dollars \(USD\)/);
await svc.from("objective").delete().eq("engagement_id", E);
await bad("objective external_ref too long", [obj({ external_ref: "x".repeat(101) })], /external_ref must be text of up to 100 characters/);
await bad("objective external_ref empty text", [obj({ external_ref: "  " })], /external_ref must be text/);
await bad("two objectives with one external_ref", [obj({ external_ref: "R1" }), obj({ title: "Other", external_ref: "R1", kpis: [kpi({ name: "Other KPI" })] })], /external_ref "R1" is used twice/);
await bad("two KPIs with one external_ref", [obj({}, [kpi({ external_ref: "K9" }), kpi({ name: "Second", external_ref: "K9" })])], /external_ref "K9" is used twice/);
await bad("readings is not a list", [obj({}, [kpi({ readings: "x" })])], /readings must be a list/);
await bad("a reading on a date that is not a date", [obj({}, [kpi({ readings: [{ read_on: "2026-02-31", value: 1 }] })])], /reading 1: read_on must be a date/);
await bad("a reading in the future", [obj({}, [kpi({ readings: [{ read_on: "2999-01-01", value: 1 }] })])], /read_on must not be in the future/);
await bad("a reading with a text value", [obj({}, [kpi({ readings: [{ read_on: "2026-07-01", value: "high" }] })])], /value must be a number/);
await bad("two readings on one day", [obj({}, [kpi({ readings: [{ read_on: "2026-07-01", value: 1 }, { read_on: "2026-07-01", value: 2 }] })])], /two readings on 2026-07-01/);
await bad("a reading note over 500 characters", [obj({}, [kpi({ readings: [{ read_on: "2026-07-01", value: 1, note: "n".repeat(501) }] })])], /note is up to 500 characters/);
await bad("linked_actions that are not action ids", [obj({}, [kpi({ linked_actions: ["nope"] })])], /linked_actions must be a list of action ids/);
await bad("an action linked twice", [obj({}, [kpi({ linked_actions: ["act_a", "act_a"] })])], /an action is linked twice/);
await bad("an action id that is not an action of this engagement", [obj({}, [kpi({ linked_actions: ["act_doesnotexist"] })])], /"act_doesnotexist" is not an action of this engagement/);
ok("no refusal in this block stored anything", (await stored()) === 0);

// ---- Import from Sections C and D (rule: lib/scorecard-from-setup.ts)
{
  const secs = (await svc.from("setup_record").select("setup_id, section, payload_json").eq("engagement_id", E).eq("perspective", "AGREED").in("section", ["B", "C", "D"])).data;
  const sid = (n) => secs.find((r) => r.section === n).setup_id;
  const put = (n, payload) => svc.from("setup_record").update({ payload_json: payload }).eq("setup_id", sid(n));
  const restore = () => Promise.all(secs.map((r) => svc.from("setup_record").update({ payload_json: r.payload_json }).eq("setup_id", r.setup_id)));
  const K = (id, name, o) => ({ id, name, unit: "PERCENT", direction: "HIGHER_IS_BETTER", baseline_value: 10, baseline_date: "2026-03-31", source: "Finance", ...o });
  const FS = "/v1/engagements/" + E + "/scorecard/from-setup";
  await put("B", { priorities: [{ ref: "B3.1", text: "Grow the core", goal_type: "RESULTS_GROWTH" }, { ref: "B3.2", text: "Keep our people", goal_type: "PEOPLE_TALENT" }, { ref: "B3.3", text: "Launch new products", goal_type: "INNOVATION_NEW_MODELS" }] });
  await put("C", { kpis: [K("K1", "Revenue growth", { orientation: "PERFORM" }), K("K2", "Voluntary attrition", { direction: "LOWER_IS_BETTER", baseline_value: 18, orientation: "ENGAGE" }), K("K3", "New product revenue", { orientation: "INNOVATE" }),
    K("K4", "Customer complaints", { unit: "COUNT", direction: "LOWER_IS_BETTER", baseline_value: 400 }), K("K5", "Operating cost", { unit: "CURRENCY", direction: "LOWER_IS_BETTER", baseline_value: 9 }),
    K("K6", "Audit findings", { unit: "COUNT", direction: "LOWER_IS_BETTER", baseline_value: 12 }), K("K7", "Policy breaches", { unit: "COUNT", direction: "LOWER_IS_BETTER", baseline_value: 9, orientation: "GOVERN" })] });
  await put("D", { targets: [{ kpi_id: "K1", target_12m: 12 }, { kpi_id: "K2", target_12m: 14, target_3y: 10 }, { kpi_id: "K3", target_12m: 15 }, { kpi_id: "K4", target_12m: 300 }, { kpi_id: "K5", target_12m: 4 }, { kpi_id: "K7", target_12m: 5 }] });
  [st] = await exec.call("POST", FS); ok("from Sections C and D: an Executive of another tenant is refused (403)", st === 403, st);
  [st] = await lead.call("POST", FS); ok("from Sections C and D: a People Leader is refused (403)", st === 403, st);
  [st, j] = await adm.call("POST", FS);
  const where = (n) => j?.objectives?.find((o) => o.kpis.some((k) => k.name === n))?.priority_keys.join();
  ok("from Sections C and D: one objective per Section B priority, titled with the priority text", st === 200 && j.objectives.length === 3 && j.objectives.map((o) => o.title).join("|") === "Grow the core|Keep our people|Launch new products", `${st} ${errs(j)} ${j?.title}`);
  ok("a KPI goes under the first priority whose goal type needs its orientation (PERFORM to B3.1, ENGAGE to B3.2, INNOVATE to B3.3)", where("Revenue growth") === "B3.1" && where("Voluntary attrition") === "B3.2" && where("New product revenue") === "B3.3", JSON.stringify(j?.objectives?.map((o) => [o.title, o.kpis.map((k) => k.name)])));
  ok("a KPI with no orientation, or one no priority needs (GOVERN), goes under the first priority", where("Customer complaints") === "B3.1" && where("Policy breaches") === "B3.1");
  ok("targets come from Section D (12 month and 3 year) and the baseline from Section C", (() => { const k = j?.objectives?.flatMap((o) => o.kpis).find((x) => x.name === "Voluntary attrition"); return k?.target_12m === 14 && k.target_3y === 10 && k.baseline_value === 18 && k.baseline_source === "Finance" && k.direction === "LOWER_IS_BETTER" && k.orientation === "ENGAGE"; })());
  ok("the KPI with no Section D target is left out and reported with the reason; the CURRENCY KPI is imported in USD", j?.imported_kpis === 6 && j.skipped.length === 1 && j.skipped.some((x) => x.kpi === "Audit findings" && /no 12 month target/.test(x.reason)) && j.objectives.flatMap((o) => o.kpis).some((k) => k.name === "Operating cost" && k.currency_code === "USD"), JSON.stringify({ n: j?.imported_kpis, skipped: j?.skipped }));
  [st, j] = await adm.call("POST", FS);
  ok("running the import again changes nothing", st === 200 && j.objectives.length === 3 && j.objectives.flatMap((o) => o.kpis).length === 6 && (await stored()) === 3);
  await svc.from("objective").delete().eq("engagement_id", E);
  await put("C", {}); [st, j] = await adm.call("POST", FS); ok("from Sections C and D: Section C empty is refused (422)", st === 422 && /Section C/.test(j?.title), `${st} ${j?.title}`);
  await put("B", {}); [st, j] = await adm.call("POST", FS); ok("from Sections C and D: Section B empty is refused (422)", st === 422 && /Section B/.test(j?.title), `${st} ${j?.title}`);
  await restore();
  ok("from Sections C and D left nothing behind after the test", (await stored()) === 0);
  const rr = await adm.f(`/engagements/${E}/scorecard`); ok("the screen offers the Import from Sections C and D button", (await rr.text()).includes("Import from Sections C and D"));
}

// ---- L4: legacy reading while no scorecard is stored; then the scorecard decides
const restoreTemplates = await approveTemplates();   // pre-flight and launch are gated on the owner's approval of the staff message templates (I5)
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`);
ok("no scorecard yet: L4 passes from Sections C and D as before", st === 200 && j.pass === true && !failing(j).includes("L4"), JSON.stringify(failing(j)));
const cd = (await svc.from("setup_record").select("setup_id, section, payload_json").eq("engagement_id", E).eq("perspective", "AGREED").in("section", ["C", "D", "G"])).data;
// G holds the oldest shape of the KPIs (kpi_for) and is a fallback, so it is blanked too
const blankCD = () => Promise.all(cd.map((r) => svc.from("setup_record").update({ payload_json: {} }).eq("setup_id", r.setup_id)));
const restoreCD = () => Promise.all(cd.map((r) => svc.from("setup_record").update({ payload_json: r.payload_json }).eq("setup_id", r.setup_id)));
await blankCD();
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`);
ok("no scorecard and empty C, D and G: L4 fails (the 422 rule)", failing(j).includes("L4"), JSON.stringify(failing(j)));

// ---- save, as the Client Admin (write role)
const good = [
  obj({}, [kpi({ orientation: "INNOVATE" }), kpi({ name: "Operating cost", unit: "CURRENCY", currency_code: "USD", direction: "LOWER_IS_BETTER", baseline_value: 5.1, target_12m: 4.5, target_3y: 4, baseline_date: "2026-05-01" })]),
  obj({ title: "Keep our people", priority_keys: ["B3.2", "B3.3"] }, [kpi({ name: "Voluntary attrition", direction: "LOWER_IS_BETTER", baseline_value: 18, target_12m: 14, target_3y: null, orientation: "ENGAGE" })]),
];
[st, j] = await adm.call("PUT", SC, { objectives: good });
ok("Client Admin saves a valid scorecard", st === 200 && j.objectives.length === 2 && j.objectives[0].kpis.length === 2, `${st} ${errs(j)} ${j?.title}`);
const rows = (await svc.from("scorecard_kpi").select("name, unit, currency_code, direction, baseline_value, target_3y, orientation").eq("engagement_id", E)).data;
ok("stored with UP and DOWN directions, the currency code and a decimal baseline", rows.length === 3 && rows.some((r) => r.name === "Operating cost" && r.direction === "DOWN" && r.currency_code === "USD" && Number(r.baseline_value) === 5.1) && rows.some((r) => r.direction === "UP"), JSON.stringify(rows));
[st, j] = await con.call("GET", SC);
ok("consultant reads it back in the API words (HIGHER_IS_BETTER), with ids", st === 200 && j.objectives[0].kpis[0].direction === "HIGHER_IS_BETTER" && /^kpi_/.test(j.objectives[0].kpis[0].kpi_id) && /^obj_/.test(j.objectives[0].objective_id), JSON.stringify(j).slice(0, 300));
[st, j] = await con.call("PUT", SC, { objectives: good });
ok("saving the same scorecard again keeps the same content", st === 200 && j.objectives.length === 2 && (await stored()) === 2);
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`);
ok("with the scorecard stored (C, D and G empty): L4 passes, unlinked KPIs count", !failing(j).includes("L4"), JSON.stringify(failing(j)));
await restoreCD();

// ---- export
let r = await con.f(`${SC}/export`); j = await r.json();
ok("export JSON lists objectives with KPIs", r.status === 200 && j.objectives.length === 2);
r = await adm.f(`${SC}/export?format=csv`); const csv = await r.text();
ok("export CSV: header, one line per KPI, direction in API words, currency code", r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && csv.startsWith("objective,priority_keys,kpi,unit,currency_code,direction,baseline_value,baseline_date,baseline_source,target_12m,target_3y,orientation") && csv.trim().split("\r\n").length === 4 && csv.includes("B3.2;B3.3") && csv.includes(",USD,LOWER_IS_BETTER,5.1,"), csv);

// ---- CSV import: every refusal names the file row
const HEAD = "objective,priority_keys,kpi,unit,currency_code,direction,baseline_value,baseline_date,baseline_source,target_12m,target_3y,orientation\r\n";
const imp = (body, type = "text/csv") => con.call("POST", `${SC}/import`, body, type);
const badCsv = async (label, body, re) => { const [s, r2] = await imp(body); ok(`import refused: ${label}`, s === 422 && r2.code === "VALIDATION_FAILED" && re.test(errs(r2)), `${s} ${errs(r2) || JSON.stringify(r2)}`); };
await badCsv("empty file", "", /empty/);
await badCsv("unknown column", "objective,colour\r\nx,y\r\n", /Unknown column "colour"/);
await badCsv("missing required column", "objective,priority_keys,kpi\r\nx,B3.1,y\r\n", /Missing column "unit"/);
await badCsv("a column twice", HEAD.trim() + ",unit\r\n", /twice/);
await badCsv("an unclosed quote", HEAD + '"Grow,B3.1\r\n', /not closed/);
await badCsv("a number that is not a number", HEAD + "Brand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,abc,2026-01-01,Survey,100,,\r\n", /Row 2: baseline_value must be a number/);
await badCsv("empty objective cell", HEAD + ",B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /Row 2: objective is empty/);
await badCsv("KPI details with no KPI name", HEAD + "Brand,B3.1,,COUNT,,,,,,,,\r\n", /Row 2: has KPI details but no kpi name/);
await badCsv("more fields than the header", HEAD + "Brand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,,extra\r\n", /Row 2: has more fields/);
await badCsv("a priority outside Section B on row 3", HEAD + "Brand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\nBrand 2,B3.7,Reach 2,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /Row 3: "B3.7" is not a Section B priority/);
await badCsv("priority keys that differ between rows of one objective", HEAD + "Brand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\nBrand,B3.2,Reach 2,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /Row 3: priority_keys differ/);
await badCsv("a target on the wrong side, row 2", HEAD + "Brand,B3.1,Reach,COUNT,,LOWER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /Row 2: target_12m must be below the baseline/);
await badCsv("a future baseline date, row 2", HEAD + `Brand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,${future},Survey,100,,\r\n`, /Row 2: baseline_date must not be in the future/);
await badCsv("a unit outside the list, row 2", HEAD + "Brand,B3.1,Reach,TONNES,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /Row 2: unit must be one of/);
await badCsv("CURRENCY without a code, row 2", HEAD + "Brand,B3.1,Reach,CURRENCY,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /Row 2: currency_code must be/);
await badCsv("a KPI name that already exists under another objective", HEAD + "Brand,B3.1,Digital share,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,\r\n", /the KPI name .* is used twice/);
await badCsv("a second KPI on an orientation already taken", HEAD + "Brand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,INNOVATE\r\n", /only one KPI may track INNOVATE/);
[st, j] = await con.call("POST", `${SC}/import`, "{not json", "application/json"); ok("import refused: a JSON body that is not JSON", st === 422, st);
[st] = await con.call("POST", `${SC}/import`, { objectives: "x" }); ok("import refused: JSON without an objectives list", st === 422, st);
[st] = await con.call("POST", `${SC}/import`, "x".repeat(300 * 1024), "text/csv"); ok("import refused: a file over 256 KB", st === 422, st);
ok("no refused import changed anything", (await stored()) === 2 && (await svc.from("scorecard_kpi").select("kpi_id").eq("engagement_id", E)).data.length === 3);

// ---- CSV import: merge, idempotent, update by name
const file = HEAD + "Win SME lending,B3.2,SME loan book,CURRENCY,USD,HIGHER_IS_BETTER,1200,2026-03-31,Credit system,1800,2400,PERFORM\r\nWin SME lending,,SME clients,COUNT,,HIGHER_IS_BETTER,300,2026-03-31,CRM,450,,\r\nBrand awareness,B3.1,,,,,,,,,,\r\n";
[st, j] = await imp(file);
ok("import adds two objectives and two KPIs to the stored scorecard", st === 200 && j.objectives.length === 4 && j.objectives.flatMap((o) => o.kpis).length === 5, `${st} ${errs(j)} ${j?.title}`);
[st, j] = await imp(file);
ok("importing the same file again changes nothing (idempotent)", st === 200 && j.objectives.length === 4 && j.objectives.flatMap((o) => o.kpis).length === 5 && (await stored()) === 4);
[st, j] = await imp(HEAD + "Win SME lending,B3.2,sme loan book,CURRENCY,USD,HIGHER_IS_BETTER,1200,2026-03-31,Credit system,2000,,PERFORM\r\n");
const sme = j.objectives.find((o) => o.title === "Win SME lending").kpis.find((k) => k.name === "sme loan book");
ok("a KPI matched by name (any case) is updated, not duplicated", st === 200 && j.objectives.flatMap((o) => o.kpis).length === 5 && sme?.target_12m === 2000 && sme.target_3y === null, JSON.stringify(sme));
[st, j] = await con.call("POST", `${SC}/import`, { objectives: [{ title: "Keep our people", priority_keys: [], kpis: [kpi({ name: "Engagement score", unit: "SCORE", baseline_value: 3.4, target_12m: 3.9, target_3y: null })] }] });
ok("JSON import merges into an existing objective by title and keeps its priorities", st === 200 && j.objectives.find((o) => o.title === "Keep our people").kpis.length === 2 && j.objectives.find((o) => o.title === "Keep our people").priority_keys.join() === "B3.2,B3.3", `${st} ${errs(j)} ${j?.title}`);
[st, j] = await adm.call("POST", `${SC}/import`, HEAD + "Retain talent,B3.3,Time to hire,DAYS,,LOWER_IS_BETTER,45,2026-04-01,HR system,30,,\r\n", "text/csv");
ok("Client Admin may import", st === 200 && j.objectives.length === 5, `${st} ${errs(j)}`);

// ---- external_ref, readings, and idempotent import on external_ref
{
  const kid = async () => (await svc.from("scorecard_kpi").select("kpi_id, name, external_ref").eq("engagement_id", E).eq("external_ref", "KPI-ATTR")).data?.[0];
  const readings = async () => (await svc.from("scorecard_kpi_reading").select("read_on, value").eq("engagement_id", E).order("read_on")).data ?? [];
  const J = (title, name, rds, extra = {}) => ({ objectives: [{ title, external_ref: "OBJ-KEEP", priority_keys: ["B3.2", "B3.3"], kpis: [kpi({ name, external_ref: "KPI-ATTR", direction: "LOWER_IS_BETTER", baseline_value: 18, target_12m: 14, target_3y: null, orientation: "ENGAGE", readings: rds, ...extra })] }] });
  // the stored "Keep our people" / "Voluntary attrition" pair is matched by title and name the first time, and gets its references
  [st, j] = await con.call("POST", `${SC}/import`, J("Keep our people", "Voluntary attrition", [{ read_on: "2026-07-31", value: 17 }]));
  const first = await kid();
  ok("import gives an existing objective and KPI their external_ref (matched by title and name), with a reading", st === 200 && first && j.objectives.length === 5 && (await readings()).length === 1, `${st} ${errs(j)} ${j?.title}`);
  [st, j] = await con.call("POST", `${SC}/import`, J("Keep our people", "Voluntary attrition", [{ read_on: "2026-07-31", value: 17 }]));
  ok("importing the same JSON again changes nothing: same rows, same ids, one reading", st === 200 && j.objectives.length === 5 && (await kid())?.kpi_id === first.kpi_id && (await readings()).length === 1 && (await svc.from("scorecard_kpi").select("kpi_id").eq("engagement_id", E)).data.length === 7);
  [st, j] = await con.call("POST", `${SC}/import`, J("Keep and grow our people", "Voluntary attrition (all staff)", [{ read_on: "2026-07-31", value: 16 }]));
  const renamed = j?.objectives?.find((o) => o.external_ref === "OBJ-KEEP");
  ok("import matches on external_ref first: a changed title and name rename the rows, they are not duplicated, ids and readings stay", st === 200 && j.objectives.length === 5 && renamed?.title === "Keep and grow our people" && renamed.kpis.some((k) => k.name === "Voluntary attrition (all staff)" && k.kpi_id === first.kpi_id)
    && (await svc.from("scorecard_kpi").select("kpi_id").eq("engagement_id", E)).data.length === 7, `${st} ${errs(j)} ${JSON.stringify(renamed)}`);
  ok("a reading on the same day is replaced, not added", (await readings()).length === 1 && Number((await readings())[0].value) === 16, JSON.stringify(await readings()));
  [st, j] = await imp(HEAD.trim() + ",objective_ref,kpi_ref,readings,linked_actions\r\nKeep and grow our people,B3.2;B3.3,Voluntary attrition (all staff),PERCENT,,LOWER_IS_BETTER,18,2026-06-30,Finance report,14,,,OBJ-KEEP,KPI-ATTR,2026-08-31=15.5;2026-09-30=15,\r\n");
  ok("CSV import carries objective_ref, kpi_ref and readings (three readings now)", st === 200 && (await readings()).length === 3, `${st} ${errs(j)} ${j?.title}`);
  [st, j] = await imp(HEAD.trim() + ",objective_ref,kpi_ref,readings,linked_actions\r\nKeep and grow our people,B3.2;B3.3,Voluntary attrition (all staff),PERCENT,,LOWER_IS_BETTER,18,2026-06-30,Finance report,14,,,OBJ-KEEP,KPI-ATTR,2026-08-31=15.5;2026-09-30=15,\r\n");
  ok("the same CSV again changes nothing", st === 200 && (await readings()).length === 3);
  await badCsv("a reading that is not date=value", HEAD.trim() + ",readings\r\nBrand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,,2026-01-01\r\n", /readings must look like/);
  await badCsv("objective_ref that differs between rows of one objective", HEAD.trim() + ",objective_ref\r\nBrand,B3.1,Reach,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,,A\r\nBrand,,Reach 2,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,100,,,B\r\n", /objective_ref differs/);
  [st, j] = await con.call("POST", `${SC}/import`, { objectives: [{ title: "Dup A", external_ref: "OBJ-KEEP", priority_keys: ["B3.1"], kpis: [kpi({ name: "Dup KPI" })] }, { title: "Dup B", external_ref: "OBJ-KEEP", priority_keys: ["B3.1"], kpis: [kpi({ name: "Dup KPI 2" })] }] });
  ok("a file that reuses one external_ref is refused (422)", st === 422 && /external_ref "OBJ-KEEP" is used twice/.test(errs(j)), `${st} ${errs(j)}`);
  const dupRef = await svc.from("objective").insert({ tenant_id: tenantId, engagement_id: E, title: "Raw duplicate", priority_keys: [], external_ref: "OBJ-KEEP" });
  ok("the database keeps external_ref unique per engagement", !!dupRef.error && /unique|duplicate/i.test(dupRef.error.message), dupRef.error?.message);
  const nullTwice = await svc.from("objective").insert([{ tenant_id: tenantId, engagement_id: E, title: "No ref one", priority_keys: [] }, { tenant_id: tenantId, engagement_id: E, title: "No ref two", priority_keys: [] }]);
  ok("rows without an external_ref do not collide", !nullTwice.error, nullTwice.error?.message);
  await svc.from("objective").delete().eq("engagement_id", E).in("title", ["No ref one", "No ref two"]);
  [st, j] = await con.call("GET", SC);
  const ex = j?.objectives?.find((o) => o.external_ref === "OBJ-KEEP")?.kpis?.[0];
  ok("GET and export JSON carry external_ref, readings and actions", st === 200 && ex?.external_ref === "KPI-ATTR" && ex.readings.length === 3 && Array.isArray(ex.actions) && Array.isArray(ex.linked_actions), JSON.stringify(ex));
  r = await con.f(`${SC}/export?format=csv`); const csv2 = await r.text();
  ok("export CSV has objective_ref, kpi_ref, readings and linked_actions columns, and the values", csv2.split("\r\n")[0].endsWith("orientation,objective_ref,kpi_ref,readings,linked_actions") && csv2.includes("OBJ-KEEP,KPI-ATTR,2026-07-31=16;2026-08-31=15.5;2026-09-30=15,"), csv2);
  [st] = await exec.call("GET", `/v1/engagements/${F}/scorecard/export`); ok("an Executive reads the export of its own engagement (200)", st === 200);
  [st, j] = await con.call("PUT", SC, { objectives: j.objectives.map((o) => ({ title: o.title, external_ref: o.external_ref, priority_keys: o.priority_keys, kpis: o.kpis })) });
  ok("saving a scorecard read back from the API keeps the KPI ids and the readings", st === 200 && (await kid())?.kpi_id === first.kpi_id && (await readings()).length === 3, `${st} ${errs(j)}`);
}

// ---- screen and tab
for (const [n, s] of [["consultant", con], ["Client Admin", adm]]) {
  r = await s.f(`/engagements/${E}/scorecard`); const html = await r.text();
  ok(`${n}: the Scorecard screen opens with the tab, the objectives and the priorities`, r.status === 200 && html.includes("Objectives and KPIs") && html.includes(`/engagements/${E}/scorecard`) && html.includes("Keep and grow our people"), r.status);
}
ok("a Client Admin of another tenant is sent away from the screen", (await adm.f(`/engagements/${F}/scorecard`)).status === 307);
ok("the tab shows on the setup page for the consultant", (await (await con.f(`/engagements/${E}/setup`)).text()).includes(`/engagements/${E}/scorecard`));

// ---- launch, then the lock
[st, j] = await con.call("POST", `/v1/assessments/${A}/launch`);
ok("launch passes with the scorecard stored (L4 satisfied by the scorecard)", st === 200 && j.changed === true, `${st} ${JSON.stringify(j).slice(0, 200)}`);
[st, j] = await con.call("PUT", SC, { objectives: good }); ok("after launch the consultant is refused: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
[st, j] = await adm.call("PUT", SC, { objectives: good }); ok("after launch the Client Admin is refused: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
[st, j] = await imp(HEAD + "Late,B3.1,Late KPI,COUNT,,HIGHER_IS_BETTER,1,2026-01-01,Survey,5,,\r\n"); ok("after launch an import is refused: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
[st, j] = await con.call("GET", SC); ok("after launch the scorecard still reads, marked locked", st === 200 && j.locked === true && j.objectives.length === 5);
{
  const rd = async () => (await svc.from("scorecard_kpi_reading").select("read_on, value").eq("engagement_id", E).order("read_on")).data ?? [];
  const keep = { objectives: [{ title: "x", external_ref: "OBJ-KEEP", priority_keys: [], kpis: [{ external_ref: "KPI-ATTR", readings: [{ read_on: "2026-10-01", value: 14.5 }] }] }] };
  [st, j] = await con.call("POST", `${SC}/import`, keep);
  ok("after launch readings can still be added to a KPI matched by external_ref (200)", st === 200 && j.locked === true && (await rd()).length === 4, `${st} ${errs(j)} ${j?.title}`);
  [st, j] = await con.call("POST", `${SC}/import`, keep);
  ok("after launch the same readings again change nothing", st === 200 && (await rd()).length === 4);
  [st, j] = await adm.call("POST", `${SC}/import`, { objectives: [{ title: "x", external_ref: "NOPE", priority_keys: [], kpis: [] }] });
  ok("after launch an objective with an unknown external_ref is refused: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
  [st, j] = await con.call("POST", `${SC}/import`, { objectives: [{ title: "x", external_ref: "OBJ-KEEP", priority_keys: [], kpis: [{ external_ref: "KPI-ATTR", readings: [{ read_on: "2999-01-01", value: 1 }] }] }] });
  ok("after launch a reading in the future is refused (422)", st === 422 && (await rd()).length === 4, `${st} ${errs(j)}`);
  [st, j] = await con.call("POST", `${SC}/import`, { objectives: [{ title: "x", external_ref: "OBJ-KEEP", priority_keys: [], kpis: [{ external_ref: "KPI-ATTR", linked_actions: ["act_doesnotexist"] }] }] });
  ok("after launch an unknown action cannot be linked (422)", st === 422 && /not an action of this engagement/.test(errs(j)), `${st} ${errs(j)}`);
  [st] = await exec.call("POST", `${SC}/import`, keep); ok("after launch an Executive still cannot import (403)", st === 403, st);
}
r = await con.f(`${SC}/export?format=csv`); ok("after launch export still works", r.status === 200);
const del = await svc.from("objective").delete().eq("engagement_id", E);
ok("the database refuses deleting objectives after launch (SETUP_LOCKED)", !!del.error && del.error.message.includes("SETUP_LOCKED"), del.error?.message);
const upd = await svc.from("scorecard_kpi").update({ target_12m: 1 }).eq("engagement_id", E);
ok("the database refuses editing a KPI after launch (SETUP_LOCKED)", !!upd.error && upd.error.message.includes("SETUP_LOCKED"), upd.error?.message);
const html2 = await (await con.f(`/engagements/${E}/scorecard`)).text();
ok("the screen says the scorecard is locked", html2.includes("The scorecard is locked"));

const { data: aud } = await svc.from("audit_log").select("action").eq("tenant_id", tenantId);
const acts = new Set((aud ?? []).map((a) => a.action));
ok("saves and imports are audited", acts.has("scorecard.saved") && acts.has("scorecard.imported"), [...acts].join(", "));

await restoreTemplates();
done();
