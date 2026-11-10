// Tenant and engagement creation (Table 13: Super Admin only), the residency lock, and the hand-off to a consultant.
//   node --env-file=.env.local scripts/e2e-orgs.mjs [base-url]
// Leaves one "E2E Org" tenant behind per run (audit rows reference it, so it cannot be deleted); the assignment is revoked.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { ok, done, URL_, ANON, pwOf } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function session(em) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email: em, password: pwOf(em) });
  if (error) throw new Error(em + ": " + error.message);
  const f = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json", ...(init.headers ?? {}) } });
  const call = async (method, path, body) => { const r = await f(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)]; };
  return { f, call };
}
const sa = await session("superadmin@cdp-demo.example"), con = await session("consultant@cdp-demo.example"), adm = await session("admin.fixture@cdp-demo.example");
const stamp = Date.now().toString(36);
const good = { name: `E2E Org ${stamp}`, legal_name: `E2E Org ${stamp} Ltd`, sector: "TECHNOLOGY", headcount: 250, geographies: ["ke", "UG"], privacy_regime: "UG_DPPA_2019", residency_region: "eu-west-1", timezone: "Africa/Nairobi" };

// ---- who may call
const anon = await fetch(base + "/v1/tenants", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
ok("no session: 401", anon.status === 401, anon.status);
for (const [who, s] of [["consultant", con], ["client admin", adm]]) {
  const [st] = await s.call("POST", "/v1/tenants", good);
  ok(`${who} cannot create a tenant (403)`, st === 403, st);
}
ok("a client admin cannot open /organisations (redirect)", (await adm.f("/organisations")).status === 307);
ok("a consultant cannot open /organisations (redirect)", (await con.f("/organisations")).status === 307);
const page = await sa.f("/organisations");
ok("super admin opens /organisations", page.status === 200 && (await page.text()).includes("Add an organisation"));
ok("super admin dashboard links to Organisations", (await (await sa.f("/dashboard")).text()).includes('href="/organisations"'));

// ---- validation
const bad = async (label, over, re) => { const [st, j] = await sa.call("POST", "/v1/tenants", { ...good, name: `E2E bad ${stamp}`, ...over }); ok(`${label}: 422`, st === 422 && (!re || re.test((j.errors ?? []).join())), `${st} ${JSON.stringify(j?.errors)}`); };
await bad("no name", { name: "" }, /Name/);
await bad("unknown sector", { sector: "SPACE" }, /sector/);
await bad("headcount 0", { headcount: 0 }, /Headcount/);
await bad("headcount as text", { headcount: "250" }, /Headcount/);
await bad("country name instead of code", { geographies: ["Kenya"] }, /two-letter/);
await bad("no country", { geographies: [] }, /two-letter/);
await bad("unknown regime", { privacy_regime: "XX" }, /regime/);
await bad("regime OTHER without a name", { privacy_regime: "OTHER" }, /Name the privacy regime/);
await bad("unknown hosting region", { residency_region: "af-south-1" }, /hosting region/);
await bad("bad time zone", { timezone: "Mars/Olympus" }, /Time zone/);

// ---- create
let [st, j] = await sa.call("POST", "/v1/tenants", good);
ok("tenant created", st === 201 && /^ten_/.test(j?.tenant_id), `${st} ${JSON.stringify(j)}`);
const T = j.tenant_id;
const row = (await svc.from("tenant").select("*").eq("tenant_id", T).single()).data;
ok("stored as entered, countries upper-cased", row.sector === "TECHNOLOGY" && row.headcount === 250 && row.geographies.join() === "KE,UG" && row.privacy_regime === "UG_DPPA_2019" && row.legal_name.endsWith("Ltd"));
ok("no transfer basis yet", row.transfer_basis_recorded_at === null);
[st] = await sa.call("POST", "/v1/tenants", { ...good, name: good.name.toUpperCase() });
ok("a duplicate name (any case) is refused (422)", st === 422, st);
[st, j] = await sa.call("POST", "/v1/tenants", { ...good, name: `E2E Other ${stamp}`, legal_name: "", privacy_regime: "OTHER", regime_name: "Botswana DPA 2024" });
ok("regime OTHER keeps its name", st === 201 && (await svc.from("tenant").select("privacy_regime, legal_name").eq("tenant_id", j.tenant_id).single()).data.privacy_regime === "OTHER:Botswana DPA 2024");
ok("a blank legal name defaults to the name", (await svc.from("tenant").select("legal_name").eq("tenant_id", j.tenant_id).single()).data.legal_name === `E2E Other ${stamp}`);

// ---- engagements
[st, j] = await sa.call("POST", `/v1/tenants/${T}/engagements`);
ok("first engagement is cycle 1, no previous", st === 201 && j.cycle_no === 1 && /^eng_/.test(j.engagement_id));
const E1 = j.engagement_id;
ok("it starts in SETUP", (await svc.from("engagement").select("state, previous_engagement_id").eq("engagement_id", E1).single()).data.state === "SETUP");
[st, j] = await sa.call("POST", `/v1/tenants/${T}/engagements`);
ok("second engagement is cycle 2 linked to cycle 1", st === 201 && j.cycle_no === 2 && (await svc.from("engagement").select("previous_engagement_id").eq("engagement_id", j.engagement_id).single()).data.previous_engagement_id === E1);
[st] = await sa.call("POST", "/v1/tenants/ten_doesnotexist/engagements"); ok("engagement for an unknown tenant: 404", st === 404, st);
for (const [who, s] of [["consultant", con], ["client admin", adm]]) { [st] = await s.call("POST", `/v1/tenants/${T}/engagements`); ok(`${who} cannot create an engagement (403)`, st === 403, st); }

// ---- edit and the residency lock
[st] = await sa.call("PATCH", `/v1/tenants/${T}`, { ...good, headcount: 300, privacy_regime: "KE_DPA_2019" });
ok("before launch: details and regime can change", st === 200 && (await svc.from("tenant").select("headcount, privacy_regime").eq("tenant_id", T).single()).data.privacy_regime === "KE_DPA_2019");
[st] = await sa.call("PATCH", `/v1/tenants/${T}`, { ...good, name: `E2E Org ${stamp}` }); ok("editing a tenant to its own name is allowed", st === 200, st);
for (const [who, s] of [["consultant", con], ["client admin", adm]]) { [st] = await s.call("PATCH", `/v1/tenants/${T}`, good); ok(`${who} cannot edit a tenant (403)`, st === 403, st); }
[st] = await sa.call("PATCH", "/v1/tenants/ten_doesnotexist", { ...good, name: `E2E ghost ${stamp}` }); ok("editing an unknown tenant: 404", st === 404, st);
await svc.from("engagement").update({ state: "FIELDING" }).eq("engagement_id", E1);
[st, j] = await sa.call("PATCH", `/v1/tenants/${T}`, { ...good, privacy_regime: "NG_NDPA_2023" });
ok("after a launch the privacy regime is locked (409)", st === 409 && j.code === "ILLEGAL_TRANSITION" && /cannot change/.test(j.title), `${st} ${JSON.stringify(j)}`);
[st, j] = await sa.call("PATCH", `/v1/tenants/${T}`, { ...good, headcount: 400 });
ok("after a launch the other details still change", st === 200 && (await svc.from("tenant").select("headcount").eq("tenant_id", T).single()).data.headcount === 400);
await svc.from("engagement").update({ state: "SETUP" }).eq("engagement_id", E1);

// ---- Section A across clients (owner ruling 19 Oct 2026): A1 to A4 only, Super Admin only, locked once the latest engagement launched
const secA = { name: `E2E Org ${stamp}`, sector: "HEALTH", headcount: 410, geographies: ["ke", "TZ"] };
ok("super admin opens the Section A page and it lists the new client", (await (await sa.f("/organisations/section-a")).text()).includes(`E2E Org ${stamp}`));
ok("a consultant cannot open the Section A page (redirect)", (await con.f("/organisations/section-a")).status === 307);
for (const [who, s] of [["consultant", con], ["client admin", adm]]) { [st] = await s.call("PUT", `/v1/tenants/${T}/section-a`, secA); ok(`${who} cannot use the Section A page route (403)`, st === 403, st); }
[st, j] = await sa.call("PUT", `/v1/tenants/${T}/section-a`, { ...secA, headcount: 0 }); ok("Section A: headcount 0 refused (422)", st === 422, st);
const regimeBefore = (await svc.from("tenant").select("privacy_regime").eq("tenant_id", T).single()).data.privacy_regime;
[st, j] = await sa.call("PUT", `/v1/tenants/${T}/section-a`, secA);
const sa1 = (await svc.from("tenant").select("sector, headcount, geographies, privacy_regime").eq("tenant_id", T).single()).data;
ok("Section A saved: A2 to A4 change, nothing else does", st === 200 && sa1.sector === "HEALTH" && sa1.headcount === 410 && sa1.geographies.join() === "KE,TZ" && sa1.privacy_regime === regimeBefore, `${st} ${JSON.stringify(sa1)}`);
const last = (await svc.from("engagement").select("engagement_id").eq("tenant_id", T).order("cycle_no", { ascending: false }).limit(1).single()).data.engagement_id;
await svc.from("engagement").update({ state: "FIELDING" }).eq("engagement_id", last);
[st, j] = await sa.call("PUT", `/v1/tenants/${T}/section-a`, { ...secA, headcount: 420 }); ok("Section A is locked once the latest engagement launched (409)", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
await svc.from("engagement").update({ state: "SETUP" }).eq("engagement_id", last);

// ---- hand-off: assign a consultant, who then sees "Set up the assessment"
const { data: users } = await svc.auth.admin.listUsers({ perPage: 1000 });
const consultant = users.users.find((u) => u.email === "consultant@cdp-demo.example");
const before = await (await con.f("/dashboard?all=1")).text();
ok("a consultant not assigned does not see the new engagement", !before.includes(E1));
[st, j] = await sa.call("POST", `/v1/users/${consultant.id}/assignments`, { engagement_id: E1, valid_to: new Date(Date.now() + 7 * 864e5).toISOString() });
ok("super admin assigns the consultant", st === 200 || st === 201, `${st} ${JSON.stringify(j)}`);
const after = await (await con.f("/dashboard?all=1")).text();
ok("the consultant's dashboard offers 'Set up the assessment' for it", after.includes("Set up the assessment") && after.includes(`/engagements/${E1}/setup`));
const sp = await con.f(`/engagements/${E1}/setup`);
ok("the setup page opens for the consultant", sp.status === 200 && (await sp.text()).includes("Create the assessment"));
[st, j] = await con.call("POST", `/v1/engagements/${E1}/assessments`, { window_open: new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10), window_close: new Date(Date.now() + 864e5).toISOString().slice(0, 10) });
ok("the consultant creates its assessment; the consent text follows the tenant's regime", st === 201);
const ct = (await svc.from("consent_text").select("body, privacy_regime").eq("consent_text_id", j.consent_text_id).single()).data;
ok("consent text uses the Uganda Act and the legal name", ct.privacy_regime === "UG_DPPA_2019" && /Uganda Data Protection and Privacy Act, 2019/.test(ct.body) && ct.body.includes(`E2E Org ${stamp} Ltd`), ct.body.slice(0, 160));
const asg = (await svc.rpc("rpc_users_list", { p_actor: (users.users.find((u) => u.email === "superadmin@cdp-demo.example")).id })).data.find((u) => u.user_id === consultant.id).assignments.find((a) => a.engagement_id === E1);
[st] = await sa.call("DELETE", `/v1/assignments/${asg.assignment_id}`); ok("the assignment is revoked again", st === 200 || st === 204, st);

const { data: aud } = await svc.from("audit_log").select("action, actor_id").eq("tenant_id", T);
const acts = (aud ?? []).map((a) => a.action);
ok("tenant and engagement creation, edits and the assignment are audited with an actor", ["tenant.created", "tenant.updated", "engagement.created", "assessment.created", "assignment.created:" + E1].every((x) => acts.includes(x)) && (aud ?? []).filter((a) => !a.action.startsWith("engagement.state_changed")).every((a) => a.actor_id), acts.join());

done();
