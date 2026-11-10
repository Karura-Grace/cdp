// Runs Part A of the rehearsal guide end to end through the app's own routes, on a throwaway client, using exactly the data the guide gives
// (scripts/lib/rehearsal-data.mjs): organisation, setup A to I, consent, transfer basis, launch checks, launch, links, 40 surveys,
// freeze, score, findings, report, release. Prints the headline figures the guide quotes. The window is shortened before launch (allowed
// while the assessment is a draft) so the run does not wait for days.
//   node --env-file=apps/web/.env.local scripts/rehearsal-verify.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { ok, done, svc, signIn } from "./lib/e2e.mjs";
import { orgGraph, SECTIONS, SECTION_ORDER, TRANSFER_REFERENCE, PERSONAS } from "./lib/rehearsal-data.mjs";
import { fillAll } from "./lib/rehearsal-fill.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "bare"], { encoding: "utf8" });
const [, tenantId, E] = /: (ten_\S+) \/ (eng_\S+) BARE/.exec(out);
const db = svc();
const con = await signIn("consultant@cdp-demo.example");
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { authorization: `Bearer ${con.t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return [r.status, await r.json().catch(() => null)];
};
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const failing = (j) => (j?.checks ?? []).filter((c) => !c.pass && c.blocking).map((c) => c.id);

// the client's organisation (people step: the Client Admin does this through Organisation and leaders; same route and same data)
const G = orgGraph();
let [s, j] = await call("PUT", `/v1/engagements/${E}/org-graph`, G);
ok("the organisation graph (40 people, 5 teams, 5 executives) loads with no blocking defect", s === 200 && j.blocking.length === 0, `${s} ${JSON.stringify(j?.blocking ?? j)}`);
ok("five executives, so the executive cohort reaches the floor of five", G.people.filter((p) => p.grade === "Executive").length === 5);

// the workshop record counts person ids in an executive grade only (typed names do not count)
const execGrades = (await db.from("grade_band").select("grade_id").eq("tenant_id", tenantId).eq("is_executive", true)).data.map((g) => g.grade_id);
const EXECUTIVES = (await db.from("person_of_record").select("person_id").eq("tenant_id", tenantId).in("grade_id", execGrades).order("employee_ref").limit(3)).data.map((p) => p.person_id);
ok("three executive person ids are on the organisation record", EXECUTIVES.length === 3, EXECUTIVES.length);

[s, j] = await call("POST", `/v1/engagements/${E}/assessments`, { window_open: day(-16), window_close: day(0) });
ok("the assessment is created (window opens 16 days ago, closes today)", s === 201, `${s} ${JSON.stringify(j)}`);
const A = j.assessment_id;

for (const k of SECTION_ORDER) {
  [s, j] = await call("PUT", `/v1/engagements/${E}/setup/${k}`, { payload: SECTIONS[k], workshop_date: day(-30), participants: EXECUTIVES });
  if (s !== 200 || j.missing?.length) ok(`section ${k} saves complete`, false, `${s} ${JSON.stringify(j?.errors ?? j?.missing ?? j)}`);
  if ("EFG".includes(k)) for (const p of ["EXECUTIVE", "HR"]) {   // E, F and G need an Executive and an HR entry before they can be agreed
    [s, j] = await call("PUT", `/v1/engagements/${E}/setup/${k}/perspectives/${p}`, { payload: SECTIONS[k] });
    if (s !== 200) ok(`section ${k} ${p} entry saves`, false, `${s} ${JSON.stringify(j?.errors ?? j)}`);
  }
  [s, j] = await call("POST", `/v1/engagements/${E}/setup/${k}/agree`);
  ok(`section ${k} agrees`, s === 200 && j.status === "AGREED", `${s} ${j?.title}`);
}
[s, j] = await call("POST", `/v1/assessments/${A}/consent-text/approve`); ok("the consent text is approved", s === 200, s);
[s] = await call("PUT", `/v1/assessments/${A}/transfer-basis`, { reference: TRANSFER_REFERENCE }); ok("the transfer basis is recorded", s === 200, s);
[s, j] = await call("POST", `/v1/assessments/${A}/preflight`);
ok("the launch checks pass", s === 200 && j.pass === true, JSON.stringify(failing(j)));
for (const c of j.checks ?? []) console.log("   ", c.id, c.pass ? "pass" : "NOT PASS", c.blocking ? "" : "(warns only)");

// shorten the close time while still a draft, so the run can freeze a few minutes after launch (the guide tells the reader to ask for the same)
const closeAt = new Date(Date.now() + 120000).toISOString();
await db.from("assessment").update({ window_close: closeAt }).eq("assessment_id", A);
[s, j] = await call("POST", `/v1/assessments/${A}/launch`);
ok("launch", s === 200 || s === 201, `${s} ${j?.code} ${j?.title}`);

[s, j] = await call("POST", `/v1/assessments/${A}/invitations`, { mode: "roster" });
ok("one link per person on the roster (40)", s === 201 && j.links.length === 40, `${s} ${j?.count}`);
const links = j.links;
const isExec = new Map(G.people.map((p) => [p.email, p.grade === "Executive"]));
const t0 = Date.now();
const n = await fillAll(base, links, (email) => (isExec.get(email) ? "exec" : "staff"));
ok("all 40 surveys are answered through the same routes the survey page uses", n === 40, n);
console.log(`   (${Math.round((Date.now() - t0) / 1000)} s)`);
const dup = await fetch(`${base}/v1/survey/consent`, { method: "POST", headers: { "content-type": "application/json", "x-survey-token": links[0].token }, body: JSON.stringify({ decision: "AGREE" }) });
ok("a used link is dead (410)", dup.status === 410, dup.status);

const wait = new Date(closeAt).getTime() - Date.now() + 2000;
if (wait > 0) { console.log(`   waiting ${Math.ceil(wait / 1000)} s for the window to close`); await new Promise((r) => setTimeout(r, wait)); }
[s, j] = await call("POST", `/v1/assessments/${A}/freeze`); ok("freeze the data", s === 200 && j.responses === 40, `${s} ${JSON.stringify(j)}`);
[s, j] = await call("POST", `/v1/assessments/${A}/score`); ok("run scoring", s === 201 || s === 200, `${s} ${j?.code} ${j?.title}`);
[s] = await call("POST", `/v1/assessments/${A}/score/freeze`); ok("freeze the score", s === 200, s);
[s] = await call("POST", `/v1/assessments/${A}/evaluate`); ok("run findings", s === 201 || s === 200, s);
[s, j] = await call("POST", `/v1/assessments/${A}/reports`, { type: "ORGANISATIONAL" }); ok("create the organisational report", s === 201, s);
const R = j.report_id;
const sec = { what_this_means: "The organisation is led by Perform and Govern today. People want more Engage and Innovate.", what_to_do_next: "Agree priority zero with the executive team, then build Engage and Innovate capability." };
[s] = await call("PUT", `/v1/reports/${R}/sections`, { sections: sec }); ok("the report text cannot be edited (405)", s === 405, s);
[s] = await call("POST", `/v1/reports/${R}/release`); ok("release the report", s === 200, s);

const sc = (await db.from("score_object").select("payload_json").eq("assessment_id", A).single()).data.payload_json;
const os = sc.orientation_scores, rd = sc.readiness;
console.log("\nHEADLINE (40 generated responses):");
console.log(" now      ", JSON.stringify(os.now), "\n preferred", JSON.stringify(os.preferred), "\n gap      ", JSON.stringify(os.gap));
console.log(" readiness", JSON.stringify({ d7: rd.d7, d8: rd.d8, d9: rd.d9, tps: rd.tps, band: rd.tps_band, provisional: rd.provisional }));
console.log(" eOS index", sc.eos?.index, "| counts", JSON.stringify(sc.counts), "| perception", JSON.stringify(sc.perception_gap), JSON.stringify(sc.perception_flags));
console.log(" classes  ", JSON.stringify(sc.classification), "| dominance", JSON.stringify(sc.dominance), "| strength", sc.culture_strength, sc.strength_band);
const ev = (await db.from("evaluation").select("payload_json").eq("assessment_id", A).single()).data.payload_json;
console.log(" checks   ", JSON.stringify(ev.checks), "| findings", ev.findings.length, "| scenarios", ev.scenarios.map((x) => x.name).join("; "));
console.log("\nRESULT_IDS", JSON.stringify({ tenantId, E, A, R }));
done();
