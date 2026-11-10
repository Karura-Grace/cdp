// Seeds demo engagements through the same paths the app uses (RPCs, engine checks).
//   node --env-file=.env.local scripts/seed-demo.mjs <project-ref> <token-file> fixture
//   node --env-file=.env.local scripts/seed-demo.mjs <project-ref> <token-file> draft|bare
//   node --env-file=.env.local scripts/seed-demo.mjs <project-ref> <token-file> live [invitations=5] [base-url] [closes-in-minutes=30]
//
// fixture: the oracle fixture (475 responses) submitted through capture.submit_response, frozen, then
//          scored with the engine; the run must reproduce the hash stored in oracle/cases/fixture.json.
// live:    a launched engagement with unused survey links for the demo. Its window opened 15 days ago (so it passes the
//          real 10-working-day pre-flight rule) and closes in a few minutes, so the data can be frozen live in the demo.
//          Each run makes a new tenant, so the demo can be repeated.
//
// The token file is only needed for the app.* rows (membership, assignments); the app schema is not
// exposed over REST, so those go through the Management API as SQL.
//
// DEMO SHORTCUTS (a real tenant gets none of these):
//   * the fixture assessment is frozen while its window is still open (the freeze route will refuse that);
//   * the tenant gets an unsigned placeholder transfer basis (D-04), so pre-flight L6 passes;
//   * the consent text is approved with an empty approved_by (the app's approve button records the approver);
//   * setup sections are inserted already agreed, and the pre-flight here is the engine's with the graph asserted valid (the graph
//     is built valid; the app runs the real V1 to V7 on it). Launch itself goes through the same function the app calls.
// bare: a tenant and an engagement with a consultant and a client admin, no setup; the app does the rest.
// draft: same as live but stops before launch and issues no links; the launch endpoint does the rest.
import { readFileSync } from "node:fs";
import * as E from "../packages/cdp-engine/dist/index.js";
import { day, must, seedKit, demoSections, draftAssessment, setWorkshopExecutives, preflightOrThrow, launch, freezeNow } from "./lib/seed.mjs";
import { buildGraph } from "./lib/demo-graph.mjs";

const [ref, tokenFile, mode, ...rest] = process.argv.slice(2);
if (!ref || !tokenFile || !["fixture", "live", "draft", "bare"].includes(mode)) {
  console.error("usage: seed-demo.mjs <project-ref> <token-file> fixture|live|draft|bare [invitations] [base-url]");
  process.exit(2);
}
const { db, sql, user, writeCreds } = seedKit(ref, tokenFile);
const fx = JSON.parse(readFileSync(new URL("../packages/cdp-engine/oracle/cases/fixture.json", import.meta.url)));

// ---------------------------------------------------------------- tenant, engagement, setup
const stamp = new Date().toISOString().slice(2, 19).replace(/\D/g, "");   // yymmddhhmmss: repeat runs never collide
const name = mode === "fixture" ? "Demo Retail Bank (fixture)" : mode === "draft" ? `Draft Demo Co ${stamp}` : mode === "bare" ? `Bare Demo Co ${stamp}` : `Live Demo Co ${stamp}`;
if (must(await db.from("tenant").select("tenant_id").eq("name", name), "tenant lookup").length) {
  console.error(`${name} already exists; nothing seeded.`);
  process.exit(1);
}
const tenant = must(await db.from("tenant").insert({
  name, legal_name: name, services: ["LEADERSHIP_360", "CLIENT_LOGO", "PULSE", "GROUP_RESULTS"], sector: "Financial services", headcount: 600, geographies: ["KE"], privacy_regime: "KE_DPA_2019",
  dpia_recorded_at: new Date().toISOString(),   // demo only; a real tenant needs a recorded DPIA before launch (spec 1.4.5)
  ...(mode === "bare" ? {} : { transfer_basis_ref: "DEMO (unsigned placeholder)", transfer_basis_recorded_at: new Date().toISOString() }),   // demo only; the real basis needs a signer
}).select().single(), "tenant");
const eng = must(await db.from("engagement").insert({ tenant_id: tenant.tenant_id, cycle_no: 1 }).select().single(), "engagement");
const tag = mode === "fixture" ? "fixture" : `${mode}${stamp}`;

const consultant = await user("consultant@cdp-demo.example", "PAC Consultant");
const admin = await user(`admin.${tag}@cdp-demo.example`, `Client Admin (${tag})`);
const staffSql = [
  `insert into app.membership (user_id, tenant_id, role) values ('${admin}', '${tenant.tenant_id}', 'CLIENT_ADMIN') on conflict do nothing`,
  `insert into app.engagement_assignment (user_id, engagement_id, valid_to) values ('${consultant}', '${eng.engagement_id}', now() + interval '90 days')`,
];
if (mode === "fixture") {
  const exec = await user("exec.fixture@cdp-demo.example", "Executive");
  const lead = await user("peoplelead.fixture@cdp-demo.example", "People Leader");
  const root = await user("superadmin@cdp-demo.example", "Super Admin");
  staffSql.push(
    `insert into app.membership (user_id, tenant_id, role) values ('${exec}', '${tenant.tenant_id}', 'EXECUTIVE') on conflict do nothing`,
    `insert into app.membership (user_id, tenant_id, role, is_people_lead) values ('${lead}', '${tenant.tenant_id}', 'PEOPLE_LEADER', true) on conflict do nothing`,
    `insert into app.platform_admin (user_id) values ('${root}') on conflict do nothing`,
  );
}
// every account gets a profile row, as rpc_user_create would; without it the user list and manage checks cannot see them
staffSql.push(`insert into app.user_profile (user_id, full_name) select id, split_part(email, '@', 1) from auth.users where email like '%@cdp-demo.example' on conflict do nothing`);
for (const q of staffSql) await sql(q);

// bare: a tenant, an engagement and a consultant, nothing else. Setup, assessment, consent and launch go through the app.
if (mode === "bare") {
  console.log(`${name}: ${tenant.tenant_id} / ${eng.engagement_id} BARE (no assessment)`);
  writeCreds();
  process.exit(0);
}

// ---------------------------------------------------------------- assessment and launch (engine pre-flight)
const sections = demoSections(fx, "Mid-sized retail bank, East Africa, 600 staff, digital transformation under way.");
const closeMin = Number(rest[2] ?? 30);
const window = mode === "fixture" ? { open: day(-14), close: day(3) } : { open: day(-15), close: new Date(Date.now() + closeMin * 60e3).toISOString() };
const { asm, workshop } = await draftAssessment(db, { tenant, eng, sections, window });

// Org graph through the same function the app uses (as the assigned consultant). The fixture's leaders in scope are 63 teams of
// 10 and one of 140; building the graph from those sizes gives the engine the same headcount_led values as before.
const graph = buildGraph(mode === "draft" ? [6, 6, 6] : fx.input.scope.map((l) => l.headcount_led), { asOf: day(-60).slice(0, 10) });
const gr = await db.rpc("rpc_org_graph_replace", { p_actor: consultant, p_engagement: eng.engagement_id, p_graph: graph });
if (gr.error) throw new Error("org graph: " + gr.error.message);
await setWorkshopExecutives(db, tenant, eng);

const { derived, checks } = preflightOrThrow({ sections, workshop, window, transferBasisRecorded: !!tenant.transfer_basis_recorded_at });

if (mode === "draft") {   // stops before launch: the launch endpoint does that part
  console.log(`${name}: ${tenant.tenant_id} / ${eng.engagement_id} / ${asm.assessment_id} DRAFT (not launched)`);
} else {
  await launch(db, sql, { tenant, asm, consultant, window });
  console.log(`${name}: ${tenant.tenant_id} / ${eng.engagement_id} / ${asm.assessment_id} launched (preflight ${checks} checks pass)`);
}

// ---------------------------------------------------------------- live: unused links
if (mode === "live") {
  const n = Number(rest[0] ?? 5);
  const base = rest[1] ?? "http://localhost:3000";
  const toks = must(await db.rpc("rpc_issue_invitations", { p_assessment_id: asm.assessment_id, p_count: n }), "invitations");
  console.log("\nSurvey links (each works once):");
  for (const t of toks) console.log(`  ${base}/respond#${t}`);
}

// ---------------------------------------------------------------- fixture: submit, freeze, score, compare hash
if (mode === "fixture") {
  const rs = fx.input.responses;
  for (let i = 0; i < rs.length; i += 10) {
    await Promise.all(rs.slice(i, i + 10).map(async (r) => {
      const [tok] = must(await db.rpc("rpc_issue_invitations", { p_assessment_id: asm.assessment_id, p_count: 1, p_snapshot: r.snapshot }), "invite");
      must(await db.rpc("rpc_record_consent", { p_token: tok, p_decision: "AGREE" }), "consent");
      must(await db.rpc("rpc_submit_response", { p_token: tok, p_payload: { alloc: r.alloc, likert: r.likert, eos: r.eos }, p_duration: r.duration }), "submit");
    }));
  }
  const counts = must(await db.rpc("rpc_fielding_counts", { p_assessment_id: asm.assessment_id }), "counts");
  console.log("fielding:", JSON.stringify(counts));

  const set = await freezeNow(db, { asm, eng });   // seed shortcut: frozen with the window still open

  // the leaders in scope come from the snapshot the launch took from the org graph, as in the app
  const snap = must(await db.from("org_graph_snapshot").select("scope_json").eq("engagement_id", eng.engagement_id).single(), "snapshot");
  const out = E.scoreAssessment(set, derived, [], snap.scope_json);
  const ok = out.hash === fx.expected.hash;
  console.log(`frozen set: ${set.length} responses; score hash ${out.hash}\nexpected          ${fx.expected.hash}\n${ok ? "PASS: hash reproduced through the database" : "FAIL: hash differs"}`);
  if (!ok) process.exitCode = 1;
}

writeCreds();
