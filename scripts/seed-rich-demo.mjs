// Seeds one richer, made up client for partner demos: "Ostravane Logistics (demo)", 45 people (under 50, like the first client),
// five departments, three grades, tenure spread, named invitations (so segments work), 41 of 45 answered, Leadership 360 for
// ten leaders, frozen, scored, evaluated and with a released organisational report, through the same RPCs and routes the app uses.
//   node --env-file=apps/web/.env.local scripts/seed-rich-demo.mjs <project-ref> <token-file> [base-url=http://localhost:3100] [name] [full|open]
// Needs the app running on base-url (score, freeze, evaluate and report are API calls) and context-sessions/demo-credentials.txt.
// DEMO SHORTCUTS (a real tenant gets none): the data is frozen with the window still open; the transfer basis is an unsigned
// placeholder; the consent text is approved with an empty approver; setup sections are inserted already agreed.
// The answers are generated (seeded random numbers), not real people's. Two tenure bands are kept small, so the segments
// screen shows a real suppression next to groups that report.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { URL_, ANON, pwOf } from "./lib/e2e.mjs";
import { day, must, seedKit, demoSections, draftAssessment, setWorkshopExecutives, preflightOrThrow, launch, freezeNow } from "./lib/seed.mjs";

const [ref, tokenFile, base = "http://localhost:3100", NAME = "Ostravane Logistics (demo)", MODE = "full"] = process.argv.slice(2);
if (!ref || !tokenFile || !["full", "open", "released", "scored"].includes(MODE)) { console.error("usage: seed-rich-demo.mjs <project-ref> <token-file> [base-url] [name] [full|open|released|scored]"); process.exit(2); }
// released: stops once the report is released (no action plan) and gives this client its own logins (used by e2e-plan.mjs).
// scored: like released, but stops after the findings, before any report exists.
// Client logins: the Ostravane demo (full) uses *.meridian@; other runs use admin.<slug>@ and exec.<slug>@ from the name.
const SLUG = MODE === "full" ? "meridian" : NAME.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
// open: stops after the survey answers and the 360 nominations, with the assessment still open (used by e2e-360.mjs).
const { db, sql, user, writeCreds } = seedKit(ref, tokenFile);
const fx = JSON.parse(readFileSync(new URL("../packages/cdp-engine/oracle/cases/fixture.json", import.meta.url)));

// ---------------------------------------------------------------- seeded random numbers (so a run is repeatable)
let seed = 20261011;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ---------------------------------------------------------------- the organisation
if (must(await db.from("tenant").select("tenant_id").eq("name", NAME), "tenant lookup").length) { console.error(`${NAME} already exists; nothing seeded.`); process.exit(1); }
const DEPTS = [
  { key: "OPS", name: "Operations", teams: [5, 5, 4] },
  { key: "FIN", name: "Finance", teams: [4, 4] },
  { key: "PEO", name: "People and Culture", teams: [6] },
  { key: "SAL", name: "Sales", teams: [5, 4] },
  { key: "TEC", name: "Technology", teams: [4, 4] },
];
const grades = [{ name: "Executive", rank_order: 1, is_executive: true }, { name: "Manager", rank_order: 2, is_executive: false }, { name: "Staff", rank_order: 3, is_executive: false }];
const units = [{ unit_key: "ORG", name: NAME.replace(/ \(demo\)$/, ""), type: "DIVISION", parent_key: null, rollup_to_parent: false }];
const people = [], leaders = [];
const asOf = day(-400).slice(0, 10);
const today = Date.now();
// Made up names. Tenure is set so two small bands (under 1 year, over 10 years) are hidden in segments and the rest show.
const FIRST = ["Amina", "Brian", "Cynthia", "David", "Esther", "Felix", "Grace", "Hassan", "Irene", "James", "Kevin", "Lucy", "Moses", "Njeri", "Otieno",
  "Purity", "Quentin", "Ruth", "Samuel", "Tabitha", "Umar", "Violet", "Wanjiru", "Xavier", "Yusuf", "Zawadi", "Abdi", "Beatrice", "Collins", "Diana",
  "Eric", "Faith", "George", "Halima", "Isaac", "Joy", "Kamau", "Linet", "Mercy", "Nelson", "Olive", "Peter", "Rose", "Stephen", "Teresa", "Victor", "Wambui"];
const LAST = ["Achieng", "Barasa", "Chege", "Duale", "Ekiru", "Gitau", "Hamisi", "Imbuga", "Juma", "Kiprop", "Langat", "Mwangi", "Nyambura", "Ochieng", "Rotich", "Wekesa"];
const TENURE = (i) => (i % 15 === 3 ? ri(2, 10) : i % 15 === 9 ? ri(125, 160) : [ri(14, 34), ri(38, 58), ri(62, 118)][i % 3]);
let n = 0;
for (const d of DEPTS) {
  units.push({ unit_key: d.key, name: d.name, type: "DEPARTMENT", parent_key: "ORG", rollup_to_parent: false });
  d.teams.forEach((size, ti) => {
    const tkey = `${d.key}-T${ti + 1}`;
    units.push({ unit_key: tkey, name: `${d.name} team ${ti + 1}`, type: "TEAM", parent_key: d.key, rollup_to_parent: false });
    for (let k = 0; k < size; k++) {
      n++;
      const grade = k === 0 ? (ti === 0 ? "Executive" : "Manager") : "Staff";
      const months = TENURE(n);
      people.push({ employee_ref: `M${String(n).padStart(4, "0")}`, email: `m${String(n).padStart(4, "0")}@meridian.example`, unit_key: tkey, grade,
        display_name: `${FIRST[(n - 1) % FIRST.length]} ${LAST[(n * 7) % LAST.length]}`, _team: tkey, _k: k,
        location: "Nairobi", employment_status: "ACTIVE", start_date: new Date(today - months * 30.4 * 864e5).toISOString().slice(0, 10), _dept: d.key });
    }
    leaders.push({ employee_ref: people[n - size].employee_ref, team_key: tkey, effect_from: asOf, effect_to: null });
  });
}
const graph = { grades, locations: [{ name: "Nairobi" }], units, people: people.map(({ _dept, _team, _k, ...p }) => p), leaders };
console.log(`${NAME}: ${people.length} people, ${leaders.length} teams`);

const tenant = must(await db.from("tenant").insert({
  name: NAME, legal_name: NAME, services: ["LEADERSHIP_360", "CLIENT_LOGO", "PULSE", "GROUP_RESULTS"], sector: "Logistics", headcount: people.length, geographies: ["KE"], privacy_regime: "KE_DPA_2019",
  transfer_basis_ref: "DEMO (unsigned placeholder)", transfer_basis_recorded_at: new Date().toISOString(), dpia_recorded_at: new Date().toISOString(),
}).select().single(), "tenant");
const eng = must(await db.from("engagement").insert({ tenant_id: tenant.tenant_id, cycle_no: 1 }).select().single(), "engagement");
const consultant = await user("consultant@cdp-demo.example", "PAC Consultant");
const admin = await user(`admin.${SLUG}@cdp-demo.example`, `Client Admin (${SLUG})`);
const exec = await user(`exec.${SLUG}@cdp-demo.example`, `Executive (${SLUG})`);
// full mode makes this the current Ostravane demo: its client logins (and the per-role placeholders) move here from any earlier
// copy, and the placeholder consultants are assigned. open mode (tests) only uses the shared consultant.
const moveLogins = MODE === "full" ? `update app.membership set tenant_id = '${tenant.tenant_id}', person_id = null where user_id in (select id from auth.users where email like '%.meridian@cdp-demo.example');
  insert into app.engagement_assignment (user_id, engagement_id, valid_to) select id, '${eng.engagement_id}', now() + interval '90 days' from auth.users where email in ('consultant.a@cdp-demo.example', 'consultant.b@cdp-demo.example');` : "";
await sql(`insert into app.membership (user_id, tenant_id, role) values ('${admin}', '${tenant.tenant_id}', 'CLIENT_ADMIN') on conflict do nothing;
  insert into app.membership (user_id, tenant_id, role) values ('${exec}', '${tenant.tenant_id}', 'EXECUTIVE') on conflict do nothing;
  ${moveLogins}
  insert into app.engagement_assignment (user_id, engagement_id, valid_to) values ('${consultant}', '${eng.engagement_id}', now() + interval '90 days');
  insert into app.user_profile (user_id, full_name) select id, split_part(email, '@', 1) from auth.users where email like '%@cdp-demo.example' on conflict do nothing`);

// ---------------------------------------------------------------- setup, assessment, launch
const sections = demoSections(fx, `${NAME.replace(/ \(.*\)$/, "")}, East Africa, ${people.length} staff, growing its digital freight platform.`);
const window = { open: day(-14), close: day(3) };
const { asm, workshop } = await draftAssessment(db, { tenant, eng, sections, window });
must(await db.rpc("rpc_org_graph_replace", { p_actor: consultant, p_engagement: eng.engagement_id, p_graph: graph }), "org graph");
await setWorkshopExecutives(db, tenant, eng);
preflightOrThrow({ sections, workshop, window, transferBasisRecorded: true });
await launch(db, sql, { tenant, asm, consultant, window });
console.log("launched");

// ---------------------------------------------------------------- named invitations and generated answers
const roster = must(await db.from("person_of_record").select("person_id, employee_ref").eq("tenant_id", tenant.tenant_id), "roster");
const byRef = Object.fromEntries(people.map((p) => [p.employee_ref, p]));
const invited = must(await db.rpc("rpc_issue_person_invitations", { p_assessment_id: asm.assessment_id, p_people: roster.map((r) => r.person_id) }), "invitations");
const refOf = Object.fromEntries(roster.map((r) => [r.person_id, r.employee_ref]));

const ORI = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
// Today's culture leans Perform and Govern, more so in Operations and Finance; the preferred culture leans Engage and Innovate.
const NOW = { OPS: [18, 16, 34, 32], FIN: [20, 14, 30, 36], PEO: [34, 24, 22, 20], SAL: [24, 26, 36, 14], TEC: [26, 34, 22, 18] };
const PREF = [34, 30, 20, 16];
function alloc(base, jitter = 9) {
  const raw = base.map((b) => Math.max(1, b + ri(-jitter, jitter)));
  const tot = raw.reduce((a, b) => a + b, 0);
  const out = raw.map((v) => Math.floor((v * 100) / tot));
  out[ri(0, 3)] += 100 - out.reduce((a, b) => a + b, 0);
  return Object.fromEntries(ORI.map((o, i) => [o, out[i]]));
}
const sets = (base) => [0, 1, 2].map(() => alloc(base));
const lik = (mean) => Array.from({ length: 12 }, () => Math.max(1, Math.min(5, Math.round(mean + (rnd() - 0.5) * 2.4))));
// Each part of working life leans its own way (owner Q-AL29, 1 Nov 2026: a realistic sample, not six identical dimensions): leaders
// coach (D2), management develops people (D3), results hold the place together (D4), strategy bets on stability (D5) and success
// celebrates new ideas (D6). Shifts are added to the department's base, in the order Engage, Innovate, Perform, Govern.
const DIM_NOW = { D1: [0, 0, 4, 0], D2: [9, 0, -5, -4], D3: [7, 0, 0, -7], D4: [-5, -2, 9, -2], D5: [-4, -3, -2, 9], D6: [-5, 11, -2, -4] };
const DIM_PREF = { D1: [0, 2, 0, -2], D2: [4, 0, -2, -2], D3: [4, 2, -4, -2], D4: [2, -2, 2, -2], D5: [-2, 4, 0, -2], D6: [-2, 4, 2, -4] };
// employee voice, mean answer per question out of 10: weak on leadership, innovation and growth, stronger on inclusion
const EOS_MEAN = [9, 8, 7, 7, 8, 8, 9, 8];
function answer(p) {
  const exec = p.grade === "Executive";
  const execBias = exec ? [6, 0, -4, -2] : [0, 0, 0, 0];       // leaders see a warmer, less driven culture than staff do
  const A = { NOW: {}, PREFERRED: {} };
  for (let d = 1; d <= 6; d++) {
    A.NOW[`D${d}`] = sets(NOW[p._dept].map((v, i) => Math.max(3, v + execBias[i] + DIM_NOW[`D${d}`][i])));
    A.PREFERRED[`D${d}`] = sets(PREF.map((v, i) => Math.max(3, v + DIM_PREF[`D${d}`][i])));
  }
  const safety = p._dept === "OPS" || p._dept === "FIN" ? 2.6 : 3.6;
  return { alloc: A, likert: { D7: lik(p._dept === "TEC" ? 3.9 : 3.3), D8: lik(exec ? 4.1 : safety), D9: lik(p._dept === "SAL" ? 3.6 : 3.1) },
    eos: EOS_MEAN.map((m) => Math.max(0, Math.min(10, m + (exec ? 1 : 0) + ri(-3, 2)))) };
}
// 42 of 46 answer. The four who hold back are staff in the larger departments and in the middle tenure bands, so every
// department keeps at least five answers and the two small tenure bands stay small.
const midBand = (p) => { const i = Number(p.employee_ref.slice(1)); return i % 15 !== 3 && i % 15 !== 9; };
const staffOf = (d) => people.filter((p) => p._dept === d && p.grade === "Staff" && midBand(p));
const silent = new Set([...staffOf("OPS").slice(0, 2), ...staffOf("SAL").slice(0, 1), ...staffOf("TEC").slice(0, 1)].map((p) => p.employee_ref));
let answered = 0;
for (const inv of invited) {
  const p = byRef[refOf[inv.person_id]];
  if (silent.has(p.employee_ref)) continue;
  must(await db.rpc("rpc_record_consent", { p_token: inv.token, p_decision: "AGREE" }), "consent");
  must(await db.rpc("rpc_submit_response", { p_token: inv.token, p_payload: answer(p), p_duration: ri(900, 2400) }), "submit");
  answered++;
}
console.log(`answered ${answered} of ${invited.length}`);

// People Leader logins linked to a team leader: one on a team with 5 or more answers (shows results), and in the Ostravane demo
// the placeholder login on a smaller team (shows "too few to report"). Passwords of lead.* are in demo-credentials.txt.
{
  const answeredRefs = new Set(invited.filter((i) => !silent.has(byRef[refOf[i.person_id]].employee_ref)).map((i) => byRef[refOf[i.person_id]].employee_ref));
  const perTeam = {};
  for (const x of people) { (perTeam[x._team] ??= { n: 0, lead: null }); if (answeredRefs.has(x.employee_ref)) perTeam[x._team].n++; if (x._k === 0) perTeam[x._team].lead = x.employee_ref; }
  const teamsByN = Object.entries(perTeam).sort((x, y) => y[1].n - x[1].n);
  const big = teamsByN[0], small = [...teamsByN].reverse().find(([, v]) => v.n < 5);
  const personOf = (ref) => roster.find((r) => r.employee_ref === ref).person_id;
  const lead = await user(`lead.${SLUG}@cdp-demo.example`, `People Leader (${SLUG})`);
  await sql(`insert into app.membership (user_id, tenant_id, role, is_people_lead, person_id) values ('${lead}', '${tenant.tenant_id}', 'PEOPLE_LEADER', true, '${personOf(big[1].lead)}') on conflict (user_id) do update set tenant_id = excluded.tenant_id, person_id = excluded.person_id;
    insert into app.user_profile (user_id, full_name) select id, split_part(email, '@', 1) from auth.users where email like '%@cdp-demo.example' on conflict do nothing`);
  if (MODE === "full" && small) await sql(`update app.membership set person_id = '${personOf(small[1].lead)}' where user_id in (select id from auth.users where email = 'peopleleader.meridian@cdp-demo.example')`);
  console.log(`people leaders: lead.${SLUG} leads ${big[0]} (${big[1].n} answers)${small ? `; small team ${small[0]} (${small[1].n} answers)${MODE === "full" ? " led by peopleleader.meridian" : ""}` : ""}; leader ${small ? small[1].lead : "-"}`);
}

// ---------------------------------------------------------------- Leadership 360: nominations, then (full mode) forms
const pid = Object.fromEntries(roster.map((r) => [r.employee_ref, r.person_id]));
const las = must(await db.from("leader_assignment").select("assignment_id, person_id, team_id").eq("tenant_id", tenant.tenant_id), "leaders");
const unitKey = Object.fromEntries(must(await db.from("org_unit").select("unit_id, unit_key").eq("tenant_id", tenant.tenant_id), "units").map((u) => [u.unit_id, u.unit_key]));
const execOf = (d) => people.find((p) => p._dept === d && p.grade === "Executive");
const plan = las.map((la) => {
  const team = unitKey[la.team_id];
  const lead = people.find((p) => pid[p.employee_ref] === la.person_id);
  const reports = people.filter((p) => p._team === team && p !== lead).slice(0, 4).map((p) => ({ person_id: pid[p.employee_ref], rater_group: "DIRECT_REPORT" }));
  const boss = lead.grade === "Manager" ? execOf(lead._dept) : lead._dept === "OPS" ? null : execOf("OPS");
  const peer = people.find((p) => p !== lead && p._k === 0 && p._dept !== lead._dept && p.grade === lead.grade);
  const raters = [...reports, ...(boss ? [{ person_id: pid[boss.employee_ref], rater_group: "SUPERIOR" }] : []), ...(peer && peer !== boss ? [{ person_id: pid[peer.employee_ref], rater_group: "PEER" }] : [])];
  return { la, team, lead, raters };
});
for (const x of plan) must(await db.rpc("rpc_nominations_replace", { p_actor: consultant, p_assessment: asm.assessment_id, p_assignment: x.la.assignment_id, p_noms: x.raters }), "nominate");
console.log(`360: ${plan.length} leaders nominated, ${plan.reduce((t, x) => t + x.raters.length, 0)} raters`);
if (MODE === "open") { console.log(`\nOpen. ${NAME}: ${tenant.tenant_id} / ${eng.engagement_id} / ${asm.assessment_id}`); writeCreds(); process.exit(0); }

const items = plan.flatMap((x) => [{ assignment_id: x.la.assignment_id, person_id: x.la.person_id, kind: "SELF" },
  ...x.raters.map((r) => ({ assignment_id: x.la.assignment_id, person_id: r.person_id, kind: "RATER", rater_group: r.rater_group }))]);
const links = must(await db.rpc("rpc_issue_360_invitations", { p_assessment_id: asm.assessment_id, p_items: items }), "360 links");
// Leaders in a department share a style: section means A to H (1 to 5). Self ratings run higher on section A (a blind spot).
const STYLE = { OPS: [2.9, 2.7, 4.1, 4.2, 4.0, 3.2, 3.5, 3.9], FIN: [3.0, 2.6, 3.8, 4.4, 4.3, 3.1, 3.6, 4.2], PEO: [4.3, 3.4, 3.2, 3.3, 4.4, 4.1, 3.3, 3.5],
  SAL: [3.4, 3.6, 4.4, 2.9, 3.7, 3.9, 3.8, 3.4], TEC: [3.6, 4.3, 3.5, 3.2, 3.9, 3.4, 4.0, 3.6] };
const SEC = [[0, 10], [10, 20], [20, 30], [30, 40], [40, 45], [45, 50], [50, 55], [55, 60]];
const form = (dept, self) => {
  const r = Array(60).fill(null);
  SEC.forEach(([a, b], si) => { for (let i = a; i < b; i++) {
    if (!self && rnd() < 0.08) continue;
    const m = STYLE[dept][si] + (self ? (si === 0 ? 0.9 : 0.2) : 0);
    r[i] = Math.max(1, Math.min(5, Math.round(m + (rnd() - 0.5) * 1.6)));
  } });
  return r;
};
const thin = plan.find((x) => x.team === "TEC-T2");          // this leader gets only two rater forms back: no result
let forms = 0;
const back = new Map();
for (const l of links) {
  const x = plan.find((y) => y.la.assignment_id === l.assignment_id);
  if (l.kind === "RATER") { const k = back.get(x) ?? 0; if (x === thin && k >= 2) continue; back.set(x, k + 1); }
  must(await db.rpc("rpc_submit_360", { p_token: l.token, p_ratings: form(x.lead._dept, l.kind === "SELF") }), "360 submit");
  forms++;
}
console.log(`360: ${forms} of ${links.length} forms returned`);

// ---------------------------------------------------------------- freeze (seed shortcut), then score, findings and report through the API
await freezeNow(db, { asm, eng });
writeCreds();
const c = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: sess, error: le } = await c.auth.signInWithPassword({ email: "consultant@cdp-demo.example", password: pwOf("consultant@cdp-demo.example") });
if (le) throw new Error("consultant sign in: " + le.message);
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${sess.session.access_token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const A = asm.assessment_id;
for (const [label, method, path, body] of [["score", "POST", `/v1/assessments/${A}/score`], ["freeze score", "POST", `/v1/assessments/${A}/score/freeze`], ["findings", "POST", `/v1/assessments/${A}/evaluate`]]) {
  const [st, j] = await call(method, path, body);
  if (st >= 300) throw new Error(`${label}: ${st} ${j?.code ?? ""} ${j?.title ?? ""}`);
  console.log(`${label}: ${st}`);
}
// scored: stop before the report, so a report can be made later with advice proposed and reviewed before release (owner Q-AL25)
if (MODE === "scored") { console.log(`\nScored. ${NAME}: ${tenant.tenant_id} / ${eng.engagement_id} / ${A}`); process.exit(0); }
const [st, rep] = await call("POST", `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" });
if (st >= 300) throw new Error(`report: ${st} ${rep?.code}`);
// the report text is drafted by the system at creation (owner ruling 22 Oct 2026); nobody writes or edits it
const [rs, rj] = await call("POST", `/v1/reports/${rep.report_id}/release`);
if (rs >= 300) throw new Error(`release: ${rs} ${rj?.code} ${rj?.title}`);
console.log(`report released: ${rep.report_id}`);
if (MODE === "released") { console.log(`\nReleased. ${NAME}: ${tenant.tenant_id} / ${eng.engagement_id} / ${A}`); process.exit(0); }

// ---------------------------------------------------------------- action plan: built by the engine, then a few actions taken along
// as a real engagement would be, through the same routes (consultant edits and moves, the executive approves and tracks).
const ex = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: es } = await ex.auth.signInWithPassword({ email: `exec.${SLUG}@cdp-demo.example`, password: pwOf(`exec.${SLUG}@cdp-demo.example`) });
const as = async (tok, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${j?.code ?? ""} ${j?.title ?? ""}`);
  return j;
};
const CT = sess.session.access_token, ET = es.session.access_token;
const built = await as(CT, "POST", `/v1/assessments/${A}/plan`, {});
const V = built.score_version;
const { data: acts } = await db.from("action").select("action_id, priority_id, engine_ref, kpi, baseline_value, target_value, is_visible_signal, horizon").eq("assessment_id", A).eq("score_version", V).order("engine_ref");
const { data: zero } = await db.from("priority_zero_item").select("item_id").eq("assessment_id", A).eq("score_version", V).order("item_id");
const OWNERS = ["Head of Operations", "Chief People Officer", "Head of Sales", "Chief Technology Officer", "Finance Director"];
const move = async (id, steps) => { for (const [tok, to, reason] of steps) await as(tok, "PATCH", `/v1/actions/${id}`, { to, reason }); };
// the first P0 item is done; the rest stay open so the gate is visible
if (zero[0]) await as(ET, "POST", `/v1/assessments/${A}/p0/${zero[0].item_id}`, { score_version: V, note: "Perception-gap workshop held with the executive team on the findings." });
let k = 0;
for (const x of acts) {
  const i = k++;
  if (i >= 6) break;                                   // the rest stay in draft for the consultant to review
  await as(CT, "PATCH", `/v1/actions/${x.action_id}`, { fields: { owner: OWNERS[i % OWNERS.length], sponsor: "Chief Executive",
    kpi: x.kpi ?? "Voluntary attrition (%)", baseline_value: x.baseline_value ?? "19", target_value: x.target_value ?? "13",
    ...(x.horizon === "STRUCTURAL_12M_PLUS" ? { budget_amount: "2500000" } : {}) } });
  await move(x.action_id, [[CT, "IN_REVIEW"], [CT, "IN_CO_DESIGN"]]);
  if (i >= 4) continue;                                // two wait in co-design for the executive
  await move(x.action_id, [[ET, "APPROVED"]]);
  const pub = await fetch(base + `/v1/actions/${x.action_id}`, { method: "PATCH", headers: { authorization: `Bearer ${CT}`, "content-type": "application/json" }, body: JSON.stringify({ to: "PUBLISHED" }) });
  if (!pub.ok) continue;                               // blocked by an open pre-condition: stays approved
  await move(x.action_id, [[ET, "IN_PROGRESS"]]);
  const base0 = Number(x.baseline_value ?? 19), tgt = Number(x.target_value ?? 13);
  const step = (tgt - base0) * (i === 1 ? -0.2 : 0.35);  // one action is going the wrong way, so it shows red
  await as(ET, "POST", `/v1/actions/${x.action_id}/kpi-readings`, { value: String(Math.round((base0 + step) * 10) / 10), read_on: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), note: "Month one" });
}
console.log(`plan: ${acts.length} actions; 6 taken along (approved, published where the gate allows, tracked)`);

// development plans: drafted by the engine for every leader with a result; two leaders' plans are completed and agreed
await as(CT, "POST", `/v1/assessments/${A}/development`, {});
const { data: dev } = await db.from("development_item").select("item_id, assignment_id, basis").eq("assessment_id", A).order("assignment_id").order("seq");
const BEH = { GROWTH: ["START", "Asks each direct report for one idea in every weekly meeting", "Team members say their ideas are asked for and used"],
  TARGET: ["START", "Explains the why behind each priority before assigning work", "People can say why their work matters to the strategy"],
  BLIND_SPOT: ["STOP", "Answering for the team in meetings before they speak", "Team members speak first in the weekly review"] };
for (const aid of [...new Set(dev.map((d) => d.assignment_id))].slice(0, 2)) {
  for (const d of dev.filter((x) => x.assignment_id === aid)) {
    const [ssk, behaviour, vis] = BEH[d.basis];
    await as(CT, "PATCH", `/v1/development/${d.item_id}`, { start_stop_keep: ssk, behaviour, visible_change_30d: vis });
  }
  await as(CT, "POST", `/v1/assessments/${A}/development`, { agree: aid });
}
console.log(`development: ${dev.length} items drafted; two leaders' plans agreed`);
console.log(`\nDone. ${NAME}: ${tenant.tenant_id} / ${eng.engagement_id} / ${A}\nSign in as consultant@cdp-demo.example (password in context-sessions/demo-credentials.txt).`);
