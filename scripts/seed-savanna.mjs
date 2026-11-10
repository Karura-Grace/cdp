// Seeds the Savanna Ridge Microfinance showcase (the reference platform's sample organisation, data in scripts/lib/demo-savanna.mjs):
// 48 people in six departments, 40 answers, two leaders with a Leadership 360, frozen, scored, findings run, the organisational
// report released with the first 14 days and facilitation guide, and the action plan built. Through the same RPCs and routes the app uses.
// Gives one shared viewer login, demo@cdp-demo.example (Client Admin of this tenant only); its password goes to
// context-sessions/demo-credentials.txt and is never printed.
//   node --env-file=apps/web/.env.local scripts/seed-savanna.mjs <project-ref> <token-file> [base-url=http://localhost:3100]
// DEMO SHORTCUTS (a real tenant gets none): frozen with the window still open; unsigned transfer basis placeholder;
// consent text approved with an empty approver; setup sections inserted already agreed.
import { createClient } from "@supabase/supabase-js";
import { URL_, ANON, pwOf } from "./lib/e2e.mjs";
import { day, must, seedKit, draftAssessment, setWorkshopExecutives, preflightOrThrow, launch, freezeNow } from "./lib/seed.mjs";
import { NAME, TENANT, SECTIONS, PROFILES, PREF, EOS_MIX, QUAL, L360, REPORT_TEXT, orgGraph } from "./lib/demo-savanna.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
if (!ref || !tokenFile) { console.error("usage: seed-savanna.mjs <project-ref> <token-file> [base-url]"); process.exit(2); }
const { db, sql, user, writeCreds } = seedKit(ref, tokenFile);

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

if (must(await db.from("tenant").select("tenant_id").eq("name", NAME), "tenant lookup").length) { console.error(`${NAME} already exists; nothing seeded.`); process.exit(1); }
const g = orgGraph();
const graph = { ...g, people: g.people.map(({ _dept, _k, ...p }) => p) };
const tenant = must(await db.from("tenant").insert({ ...TENANT, services: ["LEADERSHIP_360", "CLIENT_LOGO", "PULSE", "GROUP_RESULTS"],  headcount: g.people.length, transfer_basis_ref: "DEMO (unsigned placeholder)", dpia_recorded_at: new Date().toISOString(), transfer_basis_recorded_at: new Date().toISOString() }).select().single(), "tenant");
const eng = must(await db.from("engagement").insert({ tenant_id: tenant.tenant_id, cycle_no: 1 }).select().single(), "engagement");
const consultant = await user("consultant@cdp-demo.example", "PAC Consultant");
const viewer = await user("demo@cdp-demo.example", "Savanna Ridge demo viewer");
await sql(`insert into app.membership (user_id, tenant_id, role) values ('${viewer}', '${tenant.tenant_id}', 'CLIENT_ADMIN') on conflict (user_id) do update set tenant_id = excluded.tenant_id, role = excluded.role;
  insert into app.engagement_assignment (user_id, engagement_id, valid_to) values ('${consultant}', '${eng.engagement_id}', now() + interval '365 days');
  insert into app.user_profile (user_id, full_name) select id, split_part(email, '@', 1) from auth.users where email like '%@cdp-demo.example' on conflict do nothing`);

const window = { open: day(-14), close: day(3) };
const { asm, workshop } = await draftAssessment(db, { tenant, eng, sections: SECTIONS, window });
must(await db.rpc("rpc_org_graph_replace", { p_actor: consultant, p_engagement: eng.engagement_id, p_graph: graph }), "org graph");
await setWorkshopExecutives(db, tenant, eng);
preflightOrThrow({ sections: SECTIONS, workshop, window, transferBasisRecorded: true });
await launch(db, sql, { tenant, asm, consultant, window });
console.log(`${NAME}: ${g.people.length} people, launched`);

// ---------------------------------------------------------------- answers: all executives, 10 of 12 managers, 24 of 30 staff
const roster = must(await db.from("person_of_record").select("person_id, employee_ref").eq("tenant_id", tenant.tenant_id), "roster");
const byRef = Object.fromEntries(g.people.map((p) => [p.employee_ref, p]));
const refOf = Object.fromEntries(roster.map((r) => [r.person_id, r.employee_ref]));
const pid = Object.fromEntries(roster.map((r) => [r.employee_ref, r.person_id]));
const invited = must(await db.rpc("rpc_issue_person_invitations", { p_assessment_id: asm.assessment_id, p_people: roster.map((r) => r.person_id) }), "invitations");
const ORI = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
const alloc = (base, j = 6) => {
  const raw = base.map((b) => Math.max(1, b + ri(-j, j))), tot = raw.reduce((a, b) => a + b, 0), out = raw.map((v) => Math.floor((v * 100) / tot));
  out[ri(0, 3)] += 100 - out.reduce((a, b) => a + b, 0);
  return Object.fromEntries(ORI.map((o, i) => [o, out[i]]));
};
const lik = (m) => Array.from({ length: 12 }, () => Math.max(1, Math.min(5, Math.round(m + (rnd() - 0.5) * 2.2))));
const eos = () => EOS_MIX.map(([pro, pas]) => { const u = rnd(); return u < pro ? (rnd() < 0.6 ? 9 : 10) : u < pro + pas ? (rnd() < 0.5 ? 7 : 8) : 3 + Math.floor(rnd() * 4); });
const silent = new Set([...g.people.filter((p) => p.grade === "Manager").filter((_, i) => i % 6 === 5), ...g.people.filter((p) => p.grade === "Staff" && p._k === 7)].map((p) => p.employee_ref));
let qi = 0, answered = 0;
for (const inv of invited) {
  const p = byRef[refOf[inv.person_id]];
  if (silent.has(p.employee_ref)) continue;
  const P = PROFILES[p.grade];
  const A = { NOW: {}, PREFERRED: {} };
  for (let d = 1; d <= 6; d++) { A.NOW[`D${d}`] = [0, 1, 2].map(() => alloc(P.now)); A.PREFERRED[`D${d}`] = [0, 1, 2].map(() => alloc(PREF)); }
  const payload = { alloc: A, likert: { D7: lik(P.d7), D8: lik(P.d8), D9: lik(P.d9) }, eos: eos(), ...(p.grade !== "Executive" && qi < QUAL.length ? { qual: QUAL[qi++] } : {}) };
  must(await db.rpc("rpc_record_consent", { p_token: inv.token, p_decision: "AGREE" }), "consent");
  must(await db.rpc("rpc_submit_response", { p_token: inv.token, p_payload: payload, p_duration: ri(1500, 2700) }), "submit");
  answered++;
}
console.log(`answered ${answered} of ${invited.length}`);

// ---------------------------------------------------------------- Leadership 360: Amina Odhiambo (Operations) and David Kimani (Sales)
const las = must(await db.from("leader_assignment").select("assignment_id, person_id").eq("tenant_id", tenant.tenant_id), "leaders");
const execOf = (d) => g.people.find((p) => p._dept === d && p.grade === "Executive");
const plan = ["OPS", "SAL"].map((d) => {
  const lead = execOf(d), la = las.find((l) => l.person_id === pid[lead.employee_ref]);
  const reports = g.people.filter((p) => p._dept === d && p !== lead).slice(0, 4).map((p) => ({ person_id: pid[p.employee_ref], rater_group: "DIRECT_REPORT" }));
  const peer = execOf(d === "OPS" ? "CRE" : "FIN");
  return { d, la, raters: [...reports, { person_id: pid[peer.employee_ref], rater_group: "PEER" }] };
});
for (const x of plan) must(await db.rpc("rpc_nominations_replace", { p_actor: consultant, p_assessment: asm.assessment_id, p_assignment: x.la.assignment_id, p_noms: x.raters }), "nominate");
const items = plan.flatMap((x) => [{ assignment_id: x.la.assignment_id, person_id: x.la.person_id, kind: "SELF" },
  ...x.raters.map((r) => ({ assignment_id: x.la.assignment_id, person_id: r.person_id, kind: "RATER", rater_group: r.rater_group }))]);
const links = must(await db.rpc("rpc_issue_360_invitations", { p_assessment_id: asm.assessment_id, p_items: items }), "360 links");
const SEC = [[0, 10], [10, 20], [20, 30], [30, 40], [40, 45], [45, 50], [50, 55], [55, 60]];
const form = (means, self) => { const r = Array(60).fill(null); SEC.forEach(([a, b], si) => { for (let i = a; i < b; i++) { if (!self && rnd() < 0.06) continue; r[i] = Math.max(1, Math.min(5, Math.round(means[si] + (rnd() - 0.5) * 1.4))); } }); return r; };
const KNOWN = ["LT1Y", "Y1_3", "Y3P"], CONTACT = ["DAILY", "WEEKLY", "MONTHLY"];
for (const l of links) {
  const x = plan.find((y) => y.la.assignment_id === l.assignment_id), self = l.kind === "SELF";
  must(await db.rpc("rpc_submit_360", { p_token: l.token, p_ratings: form(self ? L360[x.d].self : L360[x.d].raters, self), p_meta: self ? {} : { known_for: KNOWN[ri(0, 2)], contact: CONTACT[ri(0, 2)] } }), "360 submit");
}
console.log(`360: ${links.length} forms returned for 2 leaders`);

// ---------------------------------------------------------------- freeze, score, findings, report, plan through the API
await freezeNow(db, { asm, eng });
writeCreds();
const c = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: sess, error: le } = await c.auth.signInWithPassword({ email: "consultant@cdp-demo.example", password: pwOf("consultant@cdp-demo.example") });
if (le) throw new Error("consultant sign in: " + le.message);
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${sess.session.access_token}`, "content-type": "application/json", "x-cdp-csrf": "1" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${j?.code ?? ""} ${j?.title ?? ""}`);
  return j;
};
const A = asm.assessment_id;
await call("POST", `/v1/assessments/${A}/score`);
await call("POST", `/v1/assessments/${A}/score/freeze`);
await call("POST", `/v1/assessments/${A}/evaluate`);
const rep = await call("POST", `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" });
// the facilitation guide as the PAC template has it (apps/web/lib/report-story.ts), shortened for the demo
// the report text is drafted by the system at creation (owner ruling 22 Oct 2026); nobody writes or edits it
await call("POST", `/v1/reports/${rep.report_id}/release`);
await call("POST", `/v1/assessments/${A}/plan`, {});
console.log(`report released (${rep.report_id}) and plan built`);
console.log(`\nDone. ${NAME}: ${tenant.tenant_id} / ${eng.engagement_id} / ${A}\nViewer: demo@cdp-demo.example (password in context-sessions/demo-credentials.txt).`);
