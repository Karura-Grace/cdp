// Adds an ILLUSTRATIVE second cycle to the Ostravane Logistics demo so the Measure stage has real computed numbers:
// engagement cycle 2 (previous cycle linked), a generated survey with a believable shift towards Engage and Innovate,
// scored and frozen through the app's own routes, a released report, one recorded organisational change (a new CEO), the stored
// comparison, and the triggers it raises left open for the consultant to decide. All answers are generated, not real people's.
//   node --env-file=apps/web/.env.local scripts/seed-measure-demo.mjs <project-ref> <token-file> [base-url=http://localhost:3100] [name]
// Needs the app running on base-url and the consultant's password in context-sessions/demo-credentials.txt.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { consentText } from "../apps/web/lib/consent-template.mjs";
import { URL_, ANON, pwOf } from "./lib/e2e.mjs";
import { day, isoDate, must, executiveIds, seedKit, demoSections, preflightOrThrow, launch, freezeNow } from "./lib/seed.mjs";

const [ref, tokenFile, base = "http://localhost:3100", NAME = "Ostravane Logistics (demo)"] = process.argv.slice(2);
if (!ref || !tokenFile) { console.error("usage: seed-measure-demo.mjs <project-ref> <token-file> [base-url] [name]"); process.exit(2); }
const { db, sql, user } = seedKit(ref, tokenFile);
const fx = JSON.parse(readFileSync(new URL("../packages/cdp-engine/oracle/cases/fixture.json", import.meta.url)));
let seed = 20261013;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const tenant = must(await db.from("tenant").select("*").eq("name", NAME).single(), "tenant");
const eng1 = must(await db.from("engagement").select("*").eq("tenant_id", tenant.tenant_id).eq("cycle_no", 1).single(), "cycle 1");
const old = await db.from("engagement").select("engagement_id").eq("tenant_id", tenant.tenant_id).eq("cycle_no", 2).maybeSingle();
if (old.data) { console.log("cycle 2 already exists:", old.data.engagement_id); process.exit(0); }
const eng = must(await db.from("engagement").insert({ tenant_id: tenant.tenant_id, cycle_no: 2, previous_engagement_id: eng1.engagement_id }).select().single(), "cycle 2");
const consultant = await user("consultant@cdp-demo.example", "PAC Consultant");
await sql(`insert into app.engagement_assignment (user_id, engagement_id, valid_to) select id, '${eng.engagement_id}', now() + interval '90 days' from auth.users where email in ('consultant@cdp-demo.example', 'consultant.a@cdp-demo.example', 'consultant.b@cdp-demo.example')`);

// setup (agreed), consent v2, assessment, launch, through the same helpers the first cycle used
const sections = demoSections(fx, `${NAME.replace(/ \(.*\)$/, "")}, East Africa, second cycle (illustrative), growing its digital freight platform.`);
const window = { open: day(-14), close: day(3) };
const workshop = isoDate(day(-30));
const execIds = await executiveIds(db, tenant);   // the tenant's organisation is already loaded (cycle 1)
must(await db.from("setup_record").insert(Object.entries(sections).map(([section, payload_json]) => ({ tenant_id: tenant.tenant_id, engagement_id: eng.engagement_id, section, perspective: "AGREED", payload_json, status: "AGREED", workshop_date: workshop, participants: execIds }))), "setup_record");
const ct = consentText({ orgName: tenant.name, privacyRegime: tenant.privacy_regime });
const consent = must(await db.from("consent_text").insert({ tenant_id: tenant.tenant_id, privacy_regime: tenant.privacy_regime, version: 2, title: ct.title, body: ct.body, status: "APPROVED", approved_at: new Date().toISOString() }).select().single(), "consent_text");
const asm = must(await db.from("assessment").insert({ tenant_id: tenant.tenant_id, engagement_id: eng.engagement_id, instrument_version_id: "ins_v1_1", rules_version_id: "rul_v2_0", consent_text_id: consent.consent_text_id, window_open: window.open, window_close: window.close }).select().single(), "assessment");
preflightOrThrow({ sections, workshop, window, transferBasisRecorded: true });
await launch(db, sql, { tenant, asm, consultant, window });
console.log("cycle 2 launched");

// who answers: the roster with each person's department (from the team key) and grade
const people = await sql(`select p.person_id, p.employee_ref, g.name as grade, split_part(u.unit_key, '-', 1) as dept
  from public.person_of_record p join public.org_unit u on u.unit_id = p.unit_id left join public.grade_band g on g.grade_id = p.grade_id
  where p.tenant_id = '${tenant.tenant_id}' and p.employment_status = 'ACTIVE'`);
const byPerson = Object.fromEntries(people.map((p) => [p.person_id, p]));
const invited = must(await db.rpc("rpc_issue_person_invitations", { p_assessment_id: asm.assessment_id, p_people: people.map((p) => p.person_id) }), "invitations");

const ORI = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
// twelve months on: the same shape as before, moved towards the preferred culture (Engage and Innovate up, Perform and Govern down)
const NOW = { OPS: [24, 21, 29, 26], FIN: [25, 19, 27, 29], PEO: [38, 28, 18, 16], SAL: [29, 31, 31, 9], TEC: [30, 38, 18, 14] };
const PREF = [34, 30, 20, 16];
function alloc(b, jitter = 9) {
  const raw = b.map((v) => Math.max(1, v + ri(-jitter, jitter)));
  const tot = raw.reduce((a, c) => a + c, 0);
  const out = raw.map((v) => Math.floor((v * 100) / tot));
  out[ri(0, 3)] += 100 - out.reduce((a, c) => a + c, 0);
  return Object.fromEntries(ORI.map((o, i) => [o, out[i]]));
}
const sets = (b) => [0, 1, 2].map(() => alloc(b));
const lik = (mean) => Array.from({ length: 12 }, () => Math.max(1, Math.min(5, Math.round(mean + (rnd() - 0.5) * 2.4))));
function answer(p) {
  const execBias = p.grade === "Executive" ? [-5, 4, 3, -2] : [0, 0, 0, 0];
  const nowBase = (NOW[p.dept] ?? [25, 25, 25, 25]).map((v, i) => Math.max(3, v + execBias[i]));
  const A = { NOW: {}, PREFERRED: {} };
  for (let d = 1; d <= 6; d++) { A.NOW[`D${d}`] = sets(nowBase); A.PREFERRED[`D${d}`] = sets(PREF); }
  const safety = p.dept === "OPS" || p.dept === "FIN" ? 3.1 : 3.9;
  return { alloc: A, likert: { D7: lik(3.7), D8: lik(p.grade === "Executive" ? 4.2 : safety), D9: lik(3.5) },
    eos: Array.from({ length: 8 }, (_, i) => Math.max(0, Math.min(10, (i === 7 ? 5 : 8) + ri(-2, 2)))) };
}
let n = 0;
for (const inv of invited) {
  const p = byPerson[inv.person_id];
  if (p.grade === "Staff" && Number(p.employee_ref.slice(1)) % 11 === 5) continue;       // a few hold back, as in cycle 1
  must(await db.rpc("rpc_record_consent", { p_token: inv.token, p_decision: "AGREE" }), "consent");
  must(await db.rpc("rpc_submit_response", { p_token: inv.token, p_payload: answer(p), p_duration: ri(900, 2400) }), "submit");
  n++;
}
console.log(`answered ${n} of ${invited.length}`);

await freezeNow(db, { asm, eng });
const c = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: sess, error: le } = await c.auth.signInWithPassword({ email: "consultant@cdp-demo.example", password: pwOf("consultant@cdp-demo.example") });
if (le) throw new Error("consultant sign in: " + le.message);
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${sess.session.access_token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const A = asm.assessment_id;
for (const [label, method, path] of [["score", "POST", `/v1/assessments/${A}/score`], ["freeze score", "POST", `/v1/assessments/${A}/score/freeze`], ["findings", "POST", `/v1/assessments/${A}/evaluate`]]) {
  const [st, j] = await call(method, path);
  if (st >= 300) throw new Error(`${label}: ${st} ${j?.code ?? ""} ${j?.title ?? ""}`);
  console.log(`${label}: ${st}`);
}
const [st, rep] = await call("POST", `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" });
if (st >= 300) throw new Error(`report: ${st} ${rep?.code}`);
// the report text is drafted by the system at creation (owner ruling 22 Oct 2026); nobody writes or edits it
if (st2 >= 300) throw new Error(`sections: ${st2}`);
const [rs, rj] = await call("POST", `/v1/reports/${rep.report_id}/release`);
if (rs >= 300) throw new Error(`release: ${rs} ${rj?.code} ${rj?.title}`);
console.log("cycle 2 report released");

// the measure stage itself: a recorded change, the stored comparison, and the triggers it raises
must(await db.rpc("rpc_org_change_add", { p_actor: consultant, p_engagement: eng.engagement_id, p_type: "NEW_CEO", p_effective: isoDate(day(-60)), p_description: "A new Chief Executive joined (illustrative demo event)." }), "org change");
const [cs, cj] = await call("POST", `/v1/engagements/${eng.engagement_id}/comparison`);
if (cs >= 300) throw new Error(`comparison: ${cs} ${cj?.code} ${cj?.title}`);
const [ts, tj] = await call("POST", `/v1/engagements/${eng.engagement_id}/triggers`, {});
console.log(`comparison ${cs}; triggers ${ts} ${JSON.stringify(tj)}`);
console.log(`\nDone. Cycle 2 of ${NAME}: ${eng.engagement_id} / ${A}`);
