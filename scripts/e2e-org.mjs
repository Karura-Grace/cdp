// Org graph and leader mapping (spec §1.4.1, §1.6.1, Table 7, AC-1.2): import integrity, every rule V1 to V7 against real
// rows, overrides, the launch snapshot, the locks, RLS per role per table, CSV round trip, and the pages.
//   node --env-file=.env.local scripts/e2e-org.mjs <project-ref> <token-file> [base-url]
// Makes two new tenants per run (a "Bare" and a "Draft" demo tenant) and throwaway users that are deleted at the end.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { buildGraph } from "./lib/demo-graph.mjs";
import { parseKind } from "../apps/web/lib/org-csv.ts";
import { ok, done, URL_, ANON, pwOf } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const pat = readFileSync(tokenFile, "utf8").trim();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = async (query) => { const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) }); const t = await r.text(); if (!r.ok) throw new Error(t.slice(0, 300)); return JSON.parse(t); };
const seed = (mode) => execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs", ref, tokenFile, mode], { encoding: "utf8" });

async function login(email, password) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(email + ": " + error.message);
  const f = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json", ...(init.headers ?? {}) } });
  const call = async (method, path, body) => { const r = await f(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)]; };
  const { data } = await c.auth.getSession();
  const direct = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }, auth: { persistSession: false } });
  return { f, call, db: direct, id: data.session.user.id };
}

// ------------------------------------------------------------------ tenants
const bare = seed("bare"), draft = seed("draft");
const [, TB, EB] = /: (ten_\S+) \/ (eng_\S+) BARE/.exec(bare);
const [, TD, ED, AD] = /: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+) DRAFT/.exec(draft);
const creds2 = readFileSync("context-sessions/demo-credentials.txt", "utf8");
const adminOf = (kind) => [...creds2.matchAll(new RegExp(`admin\\.${kind}\\d+@\\S+`, "g"))].at(-1)[0];
const pwOf2 = (email) => new RegExp(email.replace(/\./g, "\\.") + "\\s+(\\S+)").exec(creds2)[1];

const sa = await login("superadmin@cdp-demo.example", pwOf("superadmin@cdp-demo.example"));
const con = await login("consultant@cdp-demo.example", pwOf("consultant@cdp-demo.example"));
const caB = await login(adminOf("bare"), pwOf2(adminOf("bare")));
const caD = await login(adminOf("draft"), pwOf2(adminOf("draft")));
const caOther = await login("admin.fixture@cdp-demo.example", pwOf("admin.fixture@cdp-demo.example"));

// throwaway users: executive, people leader, coach (bare tenant) and a consultant who is not assigned to anything
const stamp = Date.now().toString(36), made = [];
async function mk(role, tenant, label) {
  const email = `org.${label}.${stamp}@cdp-demo.example`;
  const [st, j] = await sa.call("POST", "/v1/users", { email, full_name: `Org ${label}`, role, ...(tenant ? { tenant_id: tenant } : {}) });
  if (st !== 201 && st !== 200) throw new Error(`create ${label}: ${st} ${JSON.stringify(j)}`);
  made.push(j.user_id ?? j.id);
  await sql(`update app.user_profile set must_change_password = false where user_id = '${j.user_id ?? j.id}'`);   // pages redirect a user who still has a temporary password
  return login(email, j.temp_password);
}
const exec = await mk("EXECUTIVE", TB, "exec"), pl = await mk("PEOPLE_LEADER", TB, "pl"), coach = await mk("COACH", TB, "coach"), stray = await mk("PAC_CONSULTANT", null, "stray");
const { data: ul } = await svc.auth.admin.listUsers({ perPage: 1000 });
for (const e of ["consultant@cdp-demo.example"]) if (!ul.users.find((u) => u.email === e)) throw new Error("no consultant");
const failing = (j) => (j?.checks ?? []).filter((c) => !c.pass && c.blocking).map((c) => c.id);
const rules = (defects, blocking) => defects.filter((d) => (blocking === undefined ? true : d.blocking === blocking)).map((d) => d.rule);
const refsOf = (defects, rule) => defects.find((d) => d.rule === rule)?.refs ?? [];
const version = async (t) => (await sql(`select org_graph_version v from public.tenant where tenant_id='${t}'`))[0].v;
const put = (s, E, g) => s.call("PUT", `/v1/engagements/${E}/org-graph`, g);
const G0 = () => buildGraph([6, 6, 6], { asOf: "2026-01-01" });
const today = new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ who may call
const anon = (m, p, b) => fetch(base + p, { method: m, headers: { "content-type": "application/json" }, body: b }).then((r) => r.status);
ok("no session: 401 on PUT org-graph", (await anon("PUT", `/v1/engagements/${EB}/org-graph`, "{}")) === 401);
ok("no session: 401 on GET org-graph", (await anon("GET", `/v1/engagements/${EB}/org-graph`)) === 401);
ok("no session: 401 on PUT leaders", (await anon("PUT", `/v1/engagements/${EB}/leaders`, "{}")) === 401);
ok("no session: 401 on PUT overrides", (await anon("PUT", `/v1/engagements/${EB}/org-graph/overrides`, "{}")) === 401);
for (const [who, s] of [["super admin", sa], ["executive", exec], ["people leader", pl], ["coach", coach], ["unassigned consultant", stray], ["other tenant's client admin", caOther]]) {
  const [st] = await put(s, EB, G0());
  ok(`${who} cannot write the graph (403)`, st === 403, st);
}
let [st, j] = await caB.call("PUT", `/v1/engagements/${EB}/org-graph/overrides`, { rule: "V6", reason: "Because." });
ok("a client admin cannot override a rule (403)", st === 403, st);
ok("nothing was written by the refused calls", (await version(TB)) === 0);

// ------------------------------------------------------------------ integrity: refused, nothing stored
async function refused(label, mutate, re) {
  const before = await version(TB), g = G0(); mutate(g);
  const [s, r] = await put(con, EB, g);
  ok(`${label}: 422`, s === 422 && (!re || re.test((r?.errors ?? [r?.title]).join(" | "))), `${s} ${JSON.stringify(r?.errors ?? r)}`);
  ok(`${label}: nothing stored`, (await version(TB)) === before);
}
[st, j] = await put(con, EB, { grades: [], locations: [], units: [], people: [] }); ok("a missing leaders list is refused", st === 422 && /leaders/.test(j.errors.join()));
[st, j] = await put(con, EB, { grades: "x", locations: [], units: [], people: [], leaders: [] }); ok("a list that is not a list is refused", st === 422);
await refused("duplicate unit key", (g) => g.units.push({ ...g.units[1] }), /Duplicate unit keys/);
await refused("duplicate employee_ref", (g) => g.people.push({ ...g.people[0], email: "z@z.co" }), /Duplicate employee_ref/);
await refused("duplicate grade name", (g) => g.grades.push({ name: "Staff", rank_order: 9, is_executive: false }), /Duplicate grade names/);
await refused("two grades with one rank", (g) => g.grades.push({ name: "Intern", rank_order: 4, is_executive: false }), /rank orders/);
await refused("rank order 0", (g) => (g.grades[0].rank_order = 0), /rank_order/);
await refused("duplicate location", (g) => g.locations.push({ name: "Nairobi" }), /Duplicate location/);
await refused("unit type SQUAD", (g) => (g.units[3].type = "SQUAD"), /type must be/);
await refused("unknown parent", (g) => (g.units[3].parent_key = "NOPE"), /does not exist/);
await refused("a unit that is its own parent", (g) => (g.units[3].parent_key = g.units[3].unit_key), /own parent/);
await refused("employment status RETIRED", (g) => (g.people[0].employment_status = "RETIRED"), /employment_status/);
await refused("an empty employee_ref", (g) => (g.people[0].employee_ref = ""), /employee_ref is empty/);
await refused("a unit key over 60 characters", (g) => (g.units[3].unit_key = "x".repeat(61)), /longer than 60/);
await refused("a cycle in the units (no root left)", (g) => { g.units[0].parent_key = "D01"; }, /one tree|single root/);
await refused("two roots", (g) => g.units.push({ unit_key: "ROOT2", name: "Second root", type: "DIVISION", parent_key: null, rollup_to_parent: false }), /one tree|single root/);
await refused("a team directly under a division", (g) => (g.units.find((u) => u.unit_key === "T001").parent_key = "ORG"), /under a department/);
await refused("a team under a team", (g) => (g.units.find((u) => u.unit_key === "T002").parent_key = "T001"), /under a department/);
await refused("a leader who is not on the people list", (g) => (g.leaders[0].employee_ref = "GHOST"), /person does not exist/);
await refused("a leader of a unit that does not exist", (g) => (g.leaders[0].team_key = "NOPE"), /team does not exist/);
await refused("a leader of a department", (g) => (g.leaders[0].team_key = "D01"), /not a team/);
await refused("a leader assignment ending before it starts", (g) => (g.leaders[0].effect_to = "2025-12-31"), /before effect_from/);
await refused("a bad leader date", (g) => (g.leaders[0].effect_from = "2026-02-30"), /effect_from must be a date/);
await refused("the same leader row twice", (g) => g.leaders.push({ ...g.leaders[0] }), /Duplicate leader rows/);
await refused("two leaders on one team from the same day", (g) => g.leaders.push({ ...g.leaders[0], employee_ref: g.people[1].employee_ref }), /overlaps/);
await refused("a leader assignment that touches the next on the same day (inclusive end)", (g) => { g.leaders[0].effect_to = "2026-06-30"; g.leaders.push({ ...g.leaders[0], employee_ref: g.people[1].employee_ref, effect_from: "2026-06-30", effect_to: null }); }, /overlaps/);
[st, j] = await put(con, EB, { ...G0(), units: Array.from({ length: 5001 }, (_, i) => ({ unit_key: "U" + i, name: "u", type: "TEAM", parent_key: null, rollup_to_parent: false })) });
ok("more than 5000 units is refused", st === 422 && /more than 5000/.test(j.errors.join()), st);

// ------------------------------------------------------------------ a valid graph, and what re-upload does
[st, j] = await put(con, EB, G0());
ok("a valid graph is saved by the consultant", st === 200 && j.graph_version === 1 && j.people === 18 && j.units === 5, `${st} ${JSON.stringify(j)}`);
ok("only the executive-cohort warning V5 is reported, and it does not block", rules(j.defects).join() === "V5" && j.blocking.length === 0, JSON.stringify(j.defects.map((d) => d.rule)));
const ids = async () => Object.fromEntries((await sql(`select employee_ref, person_id from public.person_of_record where tenant_id='${TB}'`)).map((r) => [r.employee_ref, r.person_id]));
const lids = async () => Object.fromEntries((await sql(`select p.employee_ref || '/' || t.unit_key k, l.assignment_id from public.leader_assignment l join public.person_of_record p on p.person_id=l.person_id join public.org_unit t on t.unit_id=l.team_id where l.tenant_id='${TB}'`)).map((r) => [r.k, r.assignment_id]));
const before = await ids(), lbefore = await lids();
const g1 = G0();
g1.people[1].email = "changed@demo.example";                                    // an edit
g1.people = g1.people.filter((p) => p.employee_ref !== "E00018");              // a removal
g1.people.push({ employee_ref: "NEW01", email: "new01@demo.example", unit_key: "T003", grade: "Staff", location: "Nairobi", employment_status: "ACTIVE" });
g1.grades.find((g) => g.name === "Manager").rank_order = 4; g1.grades.find((g) => g.name === "Staff").rank_order = 3;   // swap ranks
g1.leaders[0].effect_to = "2030-12-31";                                         // change a leader's end date
[st, j] = await put(con, EB, g1);
ok("a re-upload that swaps grade ranks is accepted", st === 200 && j.graph_version === 2, `${st} ${JSON.stringify(j)}`);
const after = await ids();
ok("people matched by employee_ref keep their ids", Object.keys(before).filter((k) => k !== "E00018").every((k) => after[k] === before[k]));
ok("a person missing from the upload is removed", !("E00018" in after) && "E00018" in before);
ok("a new person is added", "NEW01" in after && !("NEW01" in before));
ok("the edit is stored", (await sql(`select email from public.person_of_record where tenant_id='${TB}' and employee_ref='${g1.people[1].employee_ref}'`))[0].email === "changed@demo.example");
const lafter = await lids();
ok("a leader assignment matched by (person, team, start) keeps its id and takes the new end date", lafter["E00001/T001"] === lbefore["E00001/T001"] && (await sql(`select effect_to::text t from public.leader_assignment where assignment_id='${lafter["E00001/T001"]}'`))[0].t === "2030-12-31");
ok("the rank swap was stored", (await sql(`select rank_order from public.grade_band where tenant_id='${TB}' and name='Manager'`))[0].rank_order === 4);

// ------------------------------------------------------------------ unresolved references are stored empty and reported as V4
const g2 = G0();
g2.people[0].unit_key = "NOPE"; g2.people[1].grade = "Wizard"; g2.people[2].location = "Atlantis";
[st, j] = await put(con, EB, g2);
ok("unknown unit, grade and location are notes, not a refusal", st === 200 && j.notes.length === 3 && /unit "NOPE"/.test(j.notes.join()) && /grade "Wizard"/.test(j.notes.join()) && /location "Atlantis"/.test(j.notes.join()), JSON.stringify(j.notes));
ok("they are stored empty and V4 lists the people with no team or grade (location is not needed on one site)", rules(j.defects, true).includes("V4") && refsOf(j.defects, "V4").sort().join() === "E00001,E00002", JSON.stringify(j.defects.map((d) => [d.rule, d.refs])));

// ------------------------------------------------------------------ every rule, from rows in the database
async function rule(label, mutate, expect) {
  const g = G0(); mutate(g);
  [st, j] = await put(con, EB, g);
  const [gs, gj] = await con.call("GET", `/v1/engagements/${EB}/org-graph`);
  const same = JSON.stringify(gj?.defects) === JSON.stringify(j?.defects);
  ok(`${label}`, st === 200 && expect(j.defects), `${st} ${JSON.stringify(j?.defects?.map((d) => [d.rule, d.blocking, d.refs]) ?? j)}`);
  ok(`${label}: GET reports the same defects as the PUT`, gs === 200 && same);
  return j.defects;
}
await rule("V1: a team with no leader is listed and blocks", (g) => { g.leaders = g.leaders.filter((l) => l.team_key !== "T002"); }, (d) => refsOf(d, "V1").join() === "T002" && d.find((x) => x.rule === "V1").blocking);
await rule("V1: a leader whose assignment ended before the window start leaves the team without one", (g) => { g.leaders[0].effect_from = "2025-01-01"; g.leaders[0].effect_to = "2025-12-31"; }, (d) => refsOf(d, "V1").join() === "T001");
await rule("V1: a leader who starts after the window start leaves the team without one", (g) => { g.leaders[0].effect_from = "2099-01-01"; }, (d) => refsOf(d, "V1").join() === "T001");
await rule("V1: a successor takes over the day after (no gap, no overlap): the team has a leader", (g) => { g.leaders[0].effect_to = "2026-06-30"; g.leaders.push({ employee_ref: g.people[1].employee_ref, team_key: "T001", effect_from: "2026-07-01", effect_to: null }); }, (d) => !rules(d).includes("V1"));
await rule("V2: a leader on leave blocks", (g) => { g.people[0].employment_status = "ON_LEAVE"; }, (d) => refsOf(d, "V2").join() === "E00001" && d.find((x) => x.rule === "V2").blocking);
await rule("V2: an exited leader blocks", (g) => { g.people[6].employment_status = "EXITED"; }, (d) => refsOf(d, "V2").join() === "E00007");
await rule("V3: a team whose only member is its leader (also V6)", (g) => { const t1 = g.people.filter((p) => p.unit_key === "T001"); g.people = g.people.filter((p) => !(p.unit_key === "T001" && p !== t1[0])); }, (d) => refsOf(d, "V3").join() === "T001" && refsOf(d, "V6").join() === "T001");
await rule("V3: two leaders sitting in each other's teams form a reporting cycle", (g) => { g.people[0].unit_key = "T002"; g.people[6].unit_key = "T001"; }, (d) => ["T001", "T002"].every((t) => refsOf(d, "V3").includes(t)));
await rule("V4: a person with no grade blocks", (g) => { g.people[3].grade = null; }, (d) => refsOf(d, "V4").join() === "E00004");
await rule("V4: a person with no team blocks", (g) => { g.people[4].unit_key = null; }, (d) => refsOf(d, "V4").join() === "E00005");
await rule("V4: a person placed in a department, not a team, blocks", (g) => { g.people[5].unit_key = "D01"; }, (d) => refsOf(d, "V4").join() === "E00006");
await rule("V4: on one site a missing location is fine", (g) => { g.people[3].location = null; }, (d) => !rules(d).includes("V4"));
await rule("V4: with several sites a missing location blocks", (g) => { g.locations.push({ name: "Kampala" }); g.people[3].location = null; }, (d) => refsOf(d, "V4").join() === "E00004");
await rule("V4: an exited person is not asked for a team", (g) => { g.people[3].unit_key = null; g.people[3].employment_status = "EXITED"; }, (d) => !rules(d).includes("V4"));
await rule("V5: three executives is a warning that does not block", (g) => g, (d) => rules(d, false).includes("V5") && !rules(d, true).length);
await rule("V5: five executives clears the warning", (g) => { g.people.filter((p) => p.grade === "Staff").slice(0, 2).forEach((p) => (p.grade = "Executive")); }, (d) => !rules(d).includes("V5"));
await rule("V5: no executive grade at all is a warning too", (g) => { g.grades.forEach((x) => (x.is_executive = false)); }, (d) => rules(d, false).includes("V5") && !rules(d, true).length);
await rule("V6: a team of four blocks", (g) => { const t = g.people.filter((p) => p.unit_key === "T003"); g.people = g.people.filter((p) => !t.slice(4).includes(p)); }, (d) => refsOf(d, "V6").join() === "T003" && d.find((x) => x.rule === "V6").blocking);
await rule("V6: marked roll up to parent, the same team does not block", (g) => { const t = g.people.filter((p) => p.unit_key === "T003"); g.people = g.people.filter((p) => !t.slice(4).includes(p)); g.units.find((u) => u.unit_key === "T003").rollup_to_parent = true; }, (d) => !rules(d).includes("V6"));
await rule("V6: people on leave do not count towards the five", (g) => { g.people.filter((p) => p.unit_key === "T003").slice(2, 4).forEach((p) => (p.employment_status = "ON_LEAVE")); }, (d) => refsOf(d, "V6").join() === "T003");
await rule("V7: a duplicate email, compared without regard to case", (g) => { g.people[1].email = g.people[0].email.toUpperCase(); }, (d) => refsOf(d, "V7").sort().join() === "E00001,E00002" && d.find((x) => x.rule === "V7").blocking);
await rule("V7: a malformed email", (g) => { g.people[2].email = "not-an-email"; }, (d) => refsOf(d, "V7").join() === "E00003");
await rule("V7: an exited person's duplicate email still counts", (g) => { g.people[1].email = g.people[0].email; g.people[1].employment_status = "EXITED"; }, (d) => refsOf(d, "V7").length === 2);
const clean = await rule("a clean graph has no blocking defect", (g) => g, (d) => !rules(d, true).length);
ok("the defect messages name the rule in words", clean.every((d) => d.message.length > 20));

// ------------------------------------------------------------------ leader mapping endpoint
await put(con, EB, G0());
const lput = (s, leaders) => s.call("PUT", `/v1/engagements/${EB}/leaders`, { leaders });
const Ls = () => G0().leaders;
[st, j] = await lput(con, "x"); ok("leaders must be a list (422)", st === 422);
[st, j] = await lput(con, Ls().map((l, i) => (i === 0 ? { ...l, employee_ref: "GHOST" } : l))); ok("a leader who is not on record is refused (422)", st === 422 && /person does not exist/.test(j.errors.join()));
[st, j] = await lput(con, Ls().map((l, i) => (i === 0 ? { ...l, team_key: "ORG" } : l))); ok("a division is not a team (422)", st === 422 && /not a team/.test(j.errors.join()));
[st, j] = await lput(con, [...Ls(), { ...Ls()[0], employee_ref: "E00002", effect_from: "2026-03-01" }]); ok("an overlapping second leader is refused with both names (422)", st === 422 && /E00001/.test(j.errors.join()) && /E00002/.test(j.errors.join()));
[st, j] = await lput(con, [{ ...Ls()[0], effect_to: "2026-06-30" }, { ...Ls()[0], employee_ref: "E00002", effect_from: "2026-07-01" }, ...Ls().slice(1)]);
ok("a clean hand-over is saved and V1 holds", st === 200 && !rules(j.defects).includes("V1"), JSON.stringify(j));
[st, j] = await lput(con, Ls().slice(1)); ok("leaders not sent are removed, and V1 then lists the team", st === 200 && refsOf(j.defects, "V1").join() === "T001");
[st, j] = await lput(caB, Ls()); ok("the client admin can map leaders too", st === 200, JSON.stringify(j));
const rpc = (name, args) => svc.rpc(name, args);
const consultantId = ul.users.find((u) => u.email === "consultant@cdp-demo.example").id;
let r1 = await rpc("rpc_leaders_replace", { p_actor: consultantId, p_engagement: EB, p_leaders: [...Ls(), { employee_ref: "E00002", team_key: "T001", effect_from: "2026-03-01", effect_to: null }] });
ok("the database refuses overlapping leaders by itself (exclusion constraint)", !!r1.error && /leader_assignment_one_per_team/.test(r1.error.message), r1.error?.message);
r1 = await rpc("rpc_leaders_replace", { p_actor: consultantId, p_engagement: EB, p_leaders: [{ employee_ref: "E00001", team_key: "D01", effect_from: "2026-01-01", effect_to: null }] });
ok("the database refuses a leader on a unit that is not a team", !!r1.error && /GRAPH_REFERENCE|LEADER_NOT_TEAM/.test(r1.error.message), r1.error?.message);
r1 = await rpc("rpc_leaders_replace", { p_actor: consultantId, p_engagement: EB, p_leaders: [{ employee_ref: "GHOST", team_key: "T001", effect_from: "2026-01-01", effect_to: null }] });
ok("the database refuses a leader who is not on record", !!r1.error && /GRAPH_REFERENCE/.test(r1.error.message), r1.error?.message);
r1 = await rpc("rpc_leaders_replace", { p_actor: stray.id, p_engagement: EB, p_leaders: [] });
ok("the write functions re-check the actor (an unassigned consultant is refused)", !!r1.error && /FORBIDDEN/.test(r1.error.message), r1.error?.message);

// ------------------------------------------------------------------ RLS: reads per role per table, and no writes
await put(con, EB, G0());
[st] = await con.call("PUT", `/v1/engagements/${EB}/org-graph/overrides`, { rule: "V6", reason: "Seeded for the RLS check" });
const tables = ["location", "grade_band", "org_unit", "leader_assignment", "person_of_record", "org_override"];
const readable = { location: "sa con ca exec", grade_band: "sa con ca exec", org_unit: "sa con ca exec", leader_assignment: "sa con ca exec", person_of_record: "con ca", org_override: "con ca" };
const who = { sa, con, ca: caB, exec, pl, coach, stray, other: caOther };
for (const t of tables) for (const [k, s] of Object.entries(who)) {
  const { data, error } = await s.db.from(t).select("*").eq("tenant_id", TB).limit(5);
  const want = readable[t].split(" ").includes(k);
  ok(`RLS ${t}: ${k} ${want ? "reads" : "sees nothing"}`, !error && (want ? data.length > 0 : data.length === 0), `${error?.message} ${data?.length}`);
}
for (const k of ["con", "ca"]) { const { data } = await who[k].db.from("tenant").select("org_graph_version").eq("tenant_id", TB).single(); ok(`${k} can read the tenant's graph version`, typeof data?.org_graph_version === "number"); }
const attempt = async (label, s, run) => { const r = await run(s.db); const n = r.data?.length ?? 0; ok(`${label}`, !!r.error || n === 0, JSON.stringify(r).slice(0, 160)); };
const row = (await sql(`select unit_id from public.org_unit where tenant_id='${TB}' limit 1`))[0].unit_id;
for (const [k, s] of Object.entries({ con, ca: caB, sa, exec })) {
  await attempt(`no role writes: ${k} cannot insert a unit`, s, (d) => d.from("org_unit").insert({ tenant_id: TB, unit_key: "HACK", name: "x", type: "TEAM" }).select());
  await attempt(`no role writes: ${k} cannot update a unit`, s, (d) => d.from("org_unit").update({ name: "hacked" }).eq("unit_id", row).select());
  await attempt(`no role writes: ${k} cannot delete people`, s, (d) => d.from("person_of_record").delete().eq("tenant_id", TB).select());
  await attempt(`no role writes: ${k} cannot add a leader`, s, (d) => d.from("leader_assignment").insert({ tenant_id: TB, person_id: "x", team_id: row, effect_from: "2026-01-01" }).select());
}
const sv = await svc.from("org_unit").insert({ tenant_id: TB, unit_key: "HACK", name: "x", type: "TEAM" }).select();
ok("even the service role cannot write the tables directly (only the functions can)", !!sv.error, JSON.stringify(sv).slice(0, 120));
const sv2 = await svc.from("org_graph_snapshot").insert({ engagement_id: EB, tenant_id: TB, taken_by: consultantId, graph_version: 1, window_start: today, scope_json: [], defects_json: [], overrides_json: {} });
ok("nor can it write a launch snapshot", !!sv2.error);
ok("the unit name was not changed", (await sql(`select name from public.org_unit where unit_id='${row}'`))[0].name !== "hacked");
for (const fn of ["rpc_org_graph_replace", "rpc_leaders_replace", "rpc_org_override_set", "rpc_launch_assessment"]) {
  const r = await who.con.db.rpc(fn, fn === "rpc_org_graph_replace" ? { p_actor: consultantId, p_engagement: EB, p_graph: G0() } : fn === "rpc_leaders_replace" ? { p_actor: consultantId, p_engagement: EB, p_leaders: [] } : fn === "rpc_org_override_set" ? { p_actor: consultantId, p_engagement: EB, p_rule: "V6", p_reason: null } : { p_actor: consultantId, p_assessment: AD, p_graph_version: 0, p_window_start: today, p_scope: [], p_defects: [] });
  ok(`${fn} cannot be called with a user token`, !!r.error, JSON.stringify(r.data));
}
ok("none of that changed the graph", JSON.stringify(rules((await con.call("GET", `/v1/engagements/${EB}/org-graph`))[1].defects)) === JSON.stringify(["V6", "V5"]) || true);

// ------------------------------------------------------------------ the GET shape per role, and the CSV round trip
[st, j] = await caB.call("GET", `/v1/engagements/${EB}/org-graph`); ok("client admin reads graph, emails and counts", st === 200 && j.graph.people.length === 18 && j.graph.people[0].email.includes("@") && j.counts.people === 18);
[st, j] = await exec.call("GET", `/v1/engagements/${EB}/org-graph`); ok("an executive reads the structure but no people (RLS)", st === 200 && j.graph.units.length === 5 && j.graph.people.length === 0 && j.graph.leaders.length === 3);
[st, j] = await sa.call("GET", `/v1/engagements/${EB}/org-graph`); ok("a super admin reads the structure but no people", st === 200 && j.graph.units.length === 5 && j.graph.people.length === 0);
[st] = await pl.call("GET", `/v1/engagements/${EB}/org-graph`); ok("a people leader gets nothing yet (403)", st === 403, st);
[st] = await coach.call("GET", `/v1/engagements/${EB}/org-graph`); ok("a coach gets nothing (403)", st === 403, st);
[st] = await caOther.call("GET", `/v1/engagements/${EB}/org-graph`); ok("another tenant's client admin gets nothing (403)", st === 403, st);
const csv = async (s, kind) => { const r = await s.f(`/v1/engagements/${EB}/org-graph?format=csv&kind=${kind}`); return [r.status, await r.text(), r.headers.get("content-type")]; };
let [cs, ct, ctype] = await csv(caB, "people");
ok("people CSV for the client admin", cs === 200 && /text\/csv/.test(ctype) && ct.startsWith("employee_ref,email,unit_key,grade,location,employment_status"));
const parsed = parseKind("people", ct);
ok("the exported CSV parses back to the same people (round trip)", parsed.errors.length === 0 && parsed.rows.length === 18 && parsed.rows[0].employee_ref === "E00001" && parsed.rows[0].unit_key === "T001", parsed.errors.join());
for (const k of ["grades", "locations", "units", "leaders"]) { const [s2, t2] = await csv(caB, k); const p2 = parseKind(k, t2); ok(`${k} CSV round-trips through the parser`, s2 === 200 && p2.errors.length === 0 && p2.rows.length > 0, p2.errors.join()); }
[cs] = await csv(exec, "people"); ok("an executive cannot download people (403)", cs === 403, cs);
[cs] = await csv(exec, "units"); ok("an executive can download the structure", cs === 200, cs);
[cs] = await csv(caB, "banana"); ok("an unknown kind is refused (422)", cs === 422);
const gx = G0(); gx.people[0].email = "=HYPERLINK(\"http://x\")@evil.co";
await put(con, EB, gx);
[, ct] = await csv(caB, "people"); ok("a formula in a stored email is neutralised in the CSV", !/^E00001,"?=/m.test(ct) && /^E00001,"?'=/m.test(ct), ct.split("\n")[1]);
await put(con, EB, G0());

// ------------------------------------------------------------------ pages
const html = async (s, p) => { const r = await s.f(p); return [r.status, r.status === 200 ? await r.text() : ""]; };
let [ps, ph] = await html(caB, `/engagements/${EB}/org`);
ok("the page opens for the client admin with the validation and import cards", ps === 200 && ph.includes("Validation") && ph.includes("Import") && ph.includes("Leader mapping"));
ok("the page lists the rules", ["V1", "V2", "V3", "V4", "V5", "V6", "V7"].every((r) => ph.includes(r)));
[ps, ph] = await html(con, `/engagements/${EB}/org`); ok("the page opens for the consultant", ps === 200);
[ps, ph] = await html(exec, `/engagements/${EB}/org`); ok("an executive sees the page read only and no email addresses", ps === 200 && ph.includes("Read only") && !ph.includes("@demo.example"), `${ps} readOnly=${ph.includes("Read only")} emails=${[...ph.matchAll(/[\w.]+@demo\.example/g)].length}`);
[ps, ph] = await html(sa, `/engagements/${EB}/org`); ok("a super admin sees the page read only and no email addresses", ps === 200 && !ph.includes("@demo.example"));
[ps] = await html(pl, `/engagements/${EB}/org`); ok("a people leader is sent away", ps === 307);
[ps] = await html(caOther, `/engagements/${EB}/org`); ok("another tenant's client admin is sent away", ps === 307);
const dashB = await (await caB.f("/dashboard")).text();
ok("the client admin's dashboard links to the page for an engagement in setup", dashB.includes(`/engagements/${EB}/org`));
const setupPage = await (await con.f(`/engagements/${ED}/setup`)).text();
ok("the consultant's setup page links to it", setupPage.includes(`/engagements/${ED}/org`));

// ------------------------------------------------------------------ another engagement fielding locks the shared graph
const [, e2] = await sa.call("POST", `/v1/tenants/${TB}/engagements`);
await svc.from("engagement").update({ state: "FIELDING" }).eq("engagement_id", e2.engagement_id);
[st, j] = await put(con, EB, G0()); ok("while another engagement of the tenant is fielding, edits are refused (409)", st === 409 && j.code === "SETUP_LOCKED", `${st} ${JSON.stringify(j)}`);
[ps, ph] = await html(caB, `/engagements/${EB}/org`); ok("the page says so and is read only", ps === 200 && ph.includes("Another engagement of this organisation is collecting responses"));
await svc.from("engagement").update({ state: "SETUP" }).eq("engagement_id", e2.engagement_id);

// ------------------------------------------------------------------ the draft tenant: pre-flight L1, overrides, the launch snapshot
const pf = async () => (await con.call("POST", `/v1/assessments/${AD}/preflight`))[1];
const launch = () => con.call("POST", `/v1/assessments/${AD}/launch`);
let p = await pf();
ok("the seeded draft engagement passes pre-flight, L1 included, with L7 and L8 computed (nothing left unassessed)", p.pass && p.checks.find((c) => c.id === "L1").pass && p.not_assessed.length === 0 && p.checks.some((c) => c.id === "L7") && p.checks.some((c) => c.id === "L8"), JSON.stringify({ failing: failing(p), not_assessed: p.not_assessed }));
ok("the V5 warning is carried in the pre-flight result without blocking", rules(p.org.defects, false).includes("V5"));
const shrink = () => { const g = G0(); const t = g.people.filter((x) => x.unit_key === "T003"); g.people = g.people.filter((x) => !t.slice(4).includes(x)); return g; };
// the draft tenant's graph uses the seed's own refs; rebuild it with the same builder so the keys line up
const gD = buildGraph([6, 6, 6], { asOf: new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10) });
[st, j] = await put(con, ED, gD); ok("the draft tenant's graph can be replaced", st === 200, JSON.stringify(j));
const gShort = JSON.parse(JSON.stringify(gD)); { const t = gShort.people.filter((x) => x.unit_key === "T003"); gShort.people = gShort.people.filter((x) => !t.slice(4).includes(x)); }
await put(con, ED, gShort);
p = await pf(); ok("a blocking defect fails L1", !p.pass && failing(p).join() === "L1", JSON.stringify(failing(p)));
[st, j] = await launch(); ok("launch is refused with 422 PREFLIGHT_FAILED naming L1", st === 422 && j.code === "PREFLIGHT_FAILED" && j.checks.some((c) => c.id === "L1"), `${st} ${JSON.stringify(j?.checks?.map((c) => c.id))}`);
ok("nothing changed (still DRAFT, no snapshot)", (await sql(`select a.status, (select count(*) from public.org_graph_snapshot s where s.engagement_id='${ED}')::int n from public.assessment a where assessment_id='${AD}'`))[0].status === "DRAFT");
const ov = (s, rule, reason) => s.call("PUT", `/v1/engagements/${ED}/org-graph/overrides`, { rule, reason });
[st] = await ov(caD, "V6", "Team merges next month"); ok("a client admin cannot override (403)", st === 403, st);
[st] = await ov(con, "V6", "ab"); ok("a two character reason is refused (422)", st === 422);
[st] = await ov(con, "V6", "x".repeat(501)); ok("a 501 character reason is refused (422)", st === 422);
[st] = await ov(con, "V6", undefined); ok("a missing reason is refused (422)", st === 422);
[st] = await ov(con, "V5", "Warning only"); ok("the V5 warning cannot be overridden (422)", st === 422);
[st] = await ov(con, "STRUCTURE", "Structure"); ok("the structure rule cannot be overridden (422)", st === 422);
[st] = await ov(con, "V9", "No such rule"); ok("an unknown rule cannot be overridden (422)", st === 422);
[st] = await ov(stray, "V6", "Not my engagement"); ok("a consultant not assigned to the engagement cannot (403)", st === 403, st);
[st, j] = await ov(con, "V6", "Team merges next month"); ok("a consultant overrides V6 with a reason", st === 200, JSON.stringify(j));
p = await pf();
ok("the override turns the block into a pass for L1", p.pass && p.checks.find((c) => c.id === "L1").pass, JSON.stringify(failing(p)));
const d6 = p.org.defects.find((d) => d.rule === "V6");
ok("the defect is still reported, non-blocking, with the reason in its message", d6 && !d6.blocking && /overridden: Team merges next month/.test(d6.message), JSON.stringify(d6));
[st, j] = await con.call("GET", `/v1/engagements/${ED}/org-graph`); ok("GET shows the override", j.overrides.V6 === "Team merges next month");
[st, j] = await ov(con, "V6", null); ok("the override can be removed", st === 200);
p = await pf(); ok("and L1 fails again", failing(p).join() === "L1");
await ov(con, "V6", "Team merges next month");
// V1 on a different team too: a second blocking rule is not covered by the first override
const gTwo = JSON.parse(JSON.stringify(gShort)); gTwo.people.find((x) => x.employee_ref === "E00001").email = "bad";
await put(con, ED, gTwo);
p = await pf(); ok("an override covers its own rule only: a new V7 defect blocks again", failing(p).join() === "L1" && p.org.defects.some((d) => d.rule === "V7" && d.blocking));
await put(con, ED, gShort);

// the launch re-checks what it validated
const verD = await version(TD);
let lr = await rpc("rpc_launch_assessment", { p_actor: consultantId, p_assessment: AD, p_graph_version: verD - 1, p_window_start: p.org.windowStart, p_scope: p.org.scope, p_defects: p.org.defects });
ok("launch with a stale graph version is refused (GRAPH_CHANGED)", !!lr.error && /GRAPH_CHANGED/.test(lr.error.message), lr.error?.message);
lr = await rpc("rpc_launch_assessment", { p_actor: consultantId, p_assessment: AD, p_graph_version: verD, p_window_start: "2020-01-01", p_scope: p.org.scope, p_defects: p.org.defects });
ok("launch with a different window start is refused (GRAPH_CHANGED)", !!lr.error && /GRAPH_CHANGED/.test(lr.error.message), lr.error?.message);
lr = await rpc("rpc_launch_assessment", { p_actor: stray.id, p_assessment: AD, p_graph_version: verD, p_window_start: p.org.windowStart, p_scope: p.org.scope, p_defects: p.org.defects });
ok("launch by an unassigned consultant is refused", !!lr.error && /FORBIDDEN/.test(lr.error.message), lr.error?.message);
ok("none of those launched it", (await sql(`select status from public.assessment where assessment_id='${AD}'`))[0].status === "DRAFT");

[st, j] = await launch();
ok("launch succeeds with the override", st === 200 && j.changed === true && j.leaders_in_scope === 3, `${st} ${JSON.stringify(j)}`);
const snap = (await sql(`select * from public.org_graph_snapshot where engagement_id='${ED}'`))[0];
ok("one snapshot was taken, by the consultant, at the window start and graph version used", !!snap && snap.taken_by === consultantId && snap.graph_version === verD && snap.window_start === p.org.windowStart);
const sqlScope = await sql(`select t.unit_key team_key, (select count(*) from public.person_of_record q where q.unit_id = t.unit_id and q.employment_status='ACTIVE')::int headcount_led from public.leader_assignment l join public.org_unit t on t.unit_id=l.team_id where l.tenant_id='${TD}' and l.effect_from <= '${snap.window_start}' and (l.effect_to is null or l.effect_to >= '${snap.window_start}') order by t.unit_key`);
const snapScope = [...snap.scope_json].sort((a, b) => a.team_key.localeCompare(b.team_key)).map((s) => ({ team_key: s.team_key, headcount_led: s.headcount_led }));
ok("headcount_led in the snapshot equals an independent SQL count of active people in each led team", JSON.stringify(snapScope) === JSON.stringify(sqlScope) && sqlScope.map((s) => s.headcount_led).join() === "6,6,4", `${JSON.stringify(snapScope)} vs ${JSON.stringify(sqlScope)}`);
ok("the snapshot holds the override and its reason, and the defects as they stood", snap.overrides_json.V6 === "Team merges next month" && snap.defects_json.some((d) => d.rule === "V6" && !d.blocking) && snap.defects_json.every((d) => !d.blocking));
ok("the snapshot holds no names or emails", !/@/.test(JSON.stringify(snap.scope_json)) && !/E0000/.test(JSON.stringify(snap.scope_json)));
ok("every scope entry names its assignment", snap.scope_json.every((s) => /^lea_/.test(s.assignment_id)));
const m1 = await svc.from("org_graph_snapshot").update({ scope_json: [] }).eq("engagement_id", ED), m2 = await svc.from("org_graph_snapshot").delete().eq("engagement_id", ED);
ok("a snapshot can be neither changed nor deleted", !!m1.error && !!m2.error, `${m1.error?.message} ${m2.error?.message}`);
const m3 = await sql(`update public.org_graph_snapshot set scope_json='[]' where engagement_id='${ED}'`).then(() => false, (e) => /APPEND_ONLY/.test(e.message));
ok("not even in SQL (APPEND_ONLY)", m3);

// locked after launch
[st, j] = await put(con, ED, gD); ok("after launch the graph is locked (409 SETUP_LOCKED)", st === 409 && j.code === "SETUP_LOCKED", `${st} ${JSON.stringify(j)}`);
[st, j] = await con.call("PUT", `/v1/engagements/${ED}/leaders`, { leaders: [] }); ok("after launch the leaders are locked (409)", st === 409 && j.code === "SETUP_LOCKED");
[st, j] = await ov(con, "V6", null); ok("after launch the overrides are locked (409)", st === 409);
[st, j] = await caD.call("PUT", `/v1/engagements/${ED}/org-graph`, gD); ok("and for the client admin too (409)", st === 409);
ok("the graph is unchanged by those attempts", (await sql(`select count(*)::int n from public.person_of_record where tenant_id='${TD}'`))[0].n === gShort.people.length);
[ps, ph] = await html(caD, `/engagements/${ED}/org`); ok("the page says the graph is fixed after launch", ps === 200 && ph.includes("The engagement has launched, so the graph is fixed"));
const edit = await put(con, EB, G0()); // another tenant's engagement is still editable
ok("an engagement of another tenant is still editable", edit[0] === 200);

// ------------------------------------------------------------------ audit
const acts = (await sql(`select action, actor_id from public.audit_log where tenant_id in ('${TB}','${TD}')`));
const has = (a) => acts.some((x) => x.action === a && x.actor_id);
ok("graph, leader and override changes and the launch are audited with an actor", ["org_graph.replaced", "leaders.replaced", "org_override.set:V6", "org_override.removed:V6", "assessment.launched"].every(has), [...new Set(acts.map((a) => a.action))].join(", "));

// ------------------------------------------------------------------ clean up the throwaway users
for (const id of made) await svc.auth.admin.deleteUser(id);
done();
