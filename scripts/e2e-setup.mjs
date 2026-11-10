// Setup endpoints and the launch path from a bare engagement, as the consultant would do it in the app:
// create assessment -> sections -> consent -> transfer basis -> links -> launch. Re-runnable (new tenant each run).
//   node --env-file=.env.local scripts/e2e-setup.mjs <project-ref> <token-file> [base-url]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { buildGraph } from "./lib/demo-graph.mjs";
import { ok, done, URL_, ANON, pwOf, passwords } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "bare"], { encoding: "utf8" });
const [, tenantId, E] = /: (ten_\S+) \/ (eng_\S+) BARE/.exec(out);
const adminEmail = Object.keys(passwords()).filter((e) => /^admin\.bare\d+@/.test(e)).at(-1);
const fx = JSON.parse(readFileSync("packages/cdp-engine/oracle/cases/fixture.json"));
const s = fx.input.setup;

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
const con = await session("consultant@cdp-demo.example"), adm = await session(adminEmail);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const failing = (j) => (j?.checks ?? []).filter((c) => !c.pass && c.blocking).map((c) => c.id);

// ---- who may call (before any assessment exists, with a dummy assessment id where one is needed)
const noAuth = (path, method = "POST") => fetch(base + path, { method, headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.status);
ok("no session: 401 on create assessment", (await noAuth(`/v1/engagements/${E}/assessments`)) === 401);
for (const [m, p] of [["POST", `/v1/engagements/${E}/assessments`], ["PUT", `/v1/engagements/${E}/setup/B`], ["POST", `/v1/engagements/${E}/setup/B/agree`]]) {
  const [st] = await adm.call(m, p, {});
  ok(`client admin: ${m} ${p.split("/").slice(3).join("/")} is 403`, st === 403, st);
}
ok("setup page redirects a client admin", (await adm.f(`/engagements/${E}/setup`)).status === 307);
const dash0 = await (await con.f("/dashboard?all=1")).text();
ok("dashboard offers 'Set up the assessment'", dash0.includes("Set up the assessment") && dash0.includes(`/engagements/${E}/setup`));
const page0 = await con.f(`/engagements/${E}/setup`);
ok("setup page opens for the consultant (create form)", page0.status === 200 && (await page0.text()).includes("Create the assessment"));

// ---- create the assessment
let [st, j] = await con.call("POST", `/v1/engagements/${E}/assessments`, { window_open: "nope", window_close: day(1) });
ok("bad date refused (422)", st === 422, st);
[st] = await con.call("POST", `/v1/engagements/${E}/assessments`, { window_open: day(5), window_close: day(1) });
ok("window that closes before it opens refused (422)", st === 422, st);
[st, j] = await con.call("POST", `/v1/engagements/${E}/assessments`, { window_open: day(-15), window_close: day(1) });
ok("assessment created", st === 201 && /^asm_/.test(j?.assessment_id), `${st} ${JSON.stringify(j)}`);
const A = j.assessment_id;
[st] = await con.call("POST", `/v1/engagements/${E}/assessments`, { window_open: day(-15), window_close: day(1) });
ok("a second assessment is refused (409)", st === 409, st);
const { data: a0 } = await svc.from("assessment").select("status, instrument_version_id, rules_version_id, consent_text_id").eq("assessment_id", A).single();
ok("assessment is DRAFT with the published versions and a draft consent text pinned", a0.status === "DRAFT" && a0.instrument_version_id === "ins_v1_1" && a0.rules_version_id === "rul_v2_2" && !!a0.consent_text_id);
for (const [m, p] of [["PUT", `/v1/assessments/${A}/consent-text`], ["POST", `/v1/assessments/${A}/consent-text/approve`], ["PUT", `/v1/assessments/${A}/transfer-basis`], ["POST", `/v1/assessments/${A}/invitations`], ["POST", `/v1/assessments/${A}/launch`]]) {
  const [c] = await adm.call(m, p, {});
  ok(`client admin: ${m} ${p.split("/").slice(4).join("/")} is 403`, c === 403, c);
}

// ---- pre-flight on an empty setup
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`);
ok("empty setup fails L2, L3, L4, L5 (Section I not agreed), L6", st === 200 && j.pass === false && ["L2", "L3", "L4", "L5", "L6"].every((x) => failing(j).includes(x)), JSON.stringify(failing(j)));
[st, j] = await con.call("POST", `/v1/assessments/${A}/launch`);
ok("launch refused (422 PREFLIGHT_FAILED)", st === 422 && j.code === "PREFLIGHT_FAILED", `${st} ${j?.code}`);

// ---- sections (guided forms: the payloads below are what the forms send)
const O = Object.keys(s.kpi_for);                                   // INNOVATE, ENGAGE, GOVERN
const kpis = [
  ...O.map((o) => ({ name: s.kpi_for[o].name, unit: "PERCENT", direction: s.kpi_for[o].target < s.kpi_for[o].baseline ? "LOWER_IS_BETTER" : "HIGHER_IS_BETTER", baseline_value: s.kpi_for[o].baseline, baseline_date: "2026-06-30", source: "HR system", orientation: o })),
  { name: "Revenue growth (%)", unit: "PERCENT", direction: "HIGHER_IS_BETTER", baseline_value: 4, baseline_date: "2026-06-30", source: "Finance" },
  { name: "Customer satisfaction", unit: "SCORE", direction: "HIGHER_IS_BETTER", baseline_value: 70, baseline_date: "2026-06-30", source: "Survey" },
];
const targets = [{ kpi_id: "K1", target_12m: s.kpi_for[O[0]].target }, { kpi_id: "K2", target_12m: s.kpi_for[O[1]].target }, { kpi_id: "K3", target_12m: s.kpi_for[O[2]].target, target_3y: s.kpi_for[O[2]].target - 1 }, { kpi_id: "K4", target_12m: 6 }, { kpi_id: "K5", target_12m: 75, target_3y: 80 }];
const beh = (t, o) => ({ text: t, orientation: o });
const five = (tags) => tags.map((o, i) => beh("Asks the team for their view before deciding " + (i + 1), o));
const lines = (p) => [1, 2, 3].map((i) => p + " " + i);
const sec = {
  A: { maturity: "GROWTH", trigger: "Digital transformation under way; leadership wants a baseline." },
  B: { intent: "Grow digital channels while keeping service quality.", horizon: "THREE_YEARS", priorities: s.priorities.map((p) => ({ text: p.text, goal_type: p.goal_type })), positioning: ["QUALITY", "INNOVATION"], business_model: s.business_model },
  C: { kpis, trend: "IMPROVING", biggest_gap: "Speed of decisions.", attrition_pct: 19, time_to_hire_days: 45 },
  D: { targets, winning: "Be the bank of choice.", board_metrics: "Attrition, adoption.", non_negotiables: "Compliance." },
  E: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ["e" + i, "Lived culture note " + i])),
  F: { behaviours: five(s.f1_tags), staff_behaviours: five(s.f1_tags), decision_making: "Consultative.", collaboration: "Cross-functional.", risk_appetite: "MODERATE" },
  G: { stop_leadership: lines("Stop"), stop_practices: lines("Stop practice"), start_leadership: lines("Start"), start_practices: lines("Start practice") },
  H: { ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ["h" + i, "Process note " + i])) },
  I: { cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }], staff_message_checked: true, anonymity: "FULL", languages: ["en"], staff_message: "We are running the Culture Dynamics Profile to understand how things work.", qualitative: "NONE", completion_estimate: "35–45 minutes", reminder_plan: "STANDARD" },
};
// the organisation first: the workshop record counts person ids in an executive grade only (typed names do not count)
[st, j] = await con.call("PUT", `/v1/engagements/${E}/org-graph`, buildGraph(fx.input.scope.map((l) => l.headcount_led), { asOf: day(-60) }));
ok("the org graph is loaded (64 teams, the fixture's sizes)", st === 200 && j.blocking.length === 0 && j.units === 64 + 8 + 1, JSON.stringify(j.blocking ?? j));
const execGrade = (await svc.from("grade_band").select("grade_id").eq("tenant_id", tenantId).eq("is_executive", true)).data.map((g) => g.grade_id);
const people = (await svc.from("person_of_record").select("person_id").eq("tenant_id", tenantId).in("grade_id", execGrade).order("employee_ref").limit(3)).data.map((p) => p.person_id);
ok("three executive person ids are on the record", people.length === 3, people.length);
[st, j] = await con.call("PUT", `/v1/engagements/${E}/setup/B`, { payload: {}, workshop_date: day(-30), participants: ["Chief Executive"] });
ok("a typed name is refused as a participant (422)", st === 422 && /person ids/.test(j.title), `${st} ${j?.title}`);
const put = (k, over = {}) => con.call("PUT", `/v1/engagements/${E}/setup/${k}`, { payload: sec[k], workshop_date: day(-30), participants: people, ...over });
const agree = (k) => con.call("POST", `/v1/engagements/${E}/setup/${k}/agree`);
[st] = await con.call("PUT", `/v1/engagements/${E}/setup/Z`, { payload: {} }); ok("section Z refused (422)", st === 422, st);
[st] = await con.call("PUT", `/v1/engagements/${E}/setup/B`, { payload: [1] }); ok("array payload refused (422)", st === 422, st);
[st] = await con.call("PUT", `/v1/engagements/${E}/setup/B`, { payload: {}, workshop_date: "30/09/2026" }); ok("bad workshop date refused (422)", st === 422, st);
[st, j] = await agree("B"); ok("agree before save refused (422)", st === 422, st);

// shape checks on save (errors[] lists the fields)
[st, j] = await put("B", { payload: { ...sec.B, horizon: "TEN_YEARS" } }); ok("bad enum refused on save (422 with errors[])", st === 422 && Array.isArray(j.errors) && /Strategic horizon/.test(j.errors[0]), `${st} ${JSON.stringify(j?.errors)}`);
[st, j] = await put("B", { payload: { ...sec.B, priorities: [1, 2, 3, 4].map(() => ({ text: "p", goal_type: "RESULTS_GROWTH" })) } }); ok("four priorities refused (422)", st === 422 && /at most 3/.test(j.errors[0]));
[st, j] = await put("C", { payload: { attrition_pct: 140 } }); ok("attrition 140 refused (422)", st === 422);
[st, j] = await put("B", { payload: { ...sec.B, planned_model: s.business_model, planned_by: day(100) } }); ok("planned model equal to current refused (422)", st === 422 && /must differ/.test(j.errors.join()));
[st, j] = await put("A", { payload: { ...sec.A, injected: "<script>" } });
ok("unknown fields are dropped, not stored", st === 200 && !("injected" in j.payload));
[st, j] = await put("B");
ok("save returns what is still missing (nothing for a complete B) and the priority refs", st === 200 && j.missing.length === 0 && j.payload.priorities.map((p) => p.ref).join() === "B3.1,B3.2", JSON.stringify(j));
[st, j] = await put("A", { payload: { maturity: "GROWTH" } });
ok("a half-empty draft saves and lists what is missing", st === 200 && j.missing.some((m) => /A6/.test(m)), JSON.stringify(j.missing));
[st, j] = await agree("A"); ok("agreeing an incomplete section: 422 naming the gap", st === 422 && /not complete/.test(j.title) && /A6/.test(j.title), `${st} ${j?.title}`);
await put("A");

// workshop rule
await put("B", { workshop_date: null });
[st, j] = await agree("B"); ok("agree without a workshop date: 422 WORKSHOP_RECORD_MISSING", st === 422 && j.code === "WORKSHOP_RECORD_MISSING", `${st} ${j?.code}`);
await put("B", { participants: [people[0]] });
[st, j] = await agree("B"); ok("agree with one executive: 422 WORKSHOP_RECORD_MISSING", st === 422 && j.code === "WORKSHOP_RECORD_MISSING");
await put("B", { workshop_date: day(2) });
[st, j] = await agree("B"); ok("agree with a workshop date in the future: 422", st === 422 && j.code === "WORKSHOP_RECORD_MISSING");
await put("B");
[st, j] = await agree("B"); ok("agree with a date and three executives", st === 200 && j.status === "AGREED" && j.changed === true);
[st, j] = await agree("B"); ok("agreeing again changes nothing", st === 200 && j.changed === false);
await put("B", { payload: { ...sec.B, intent: "Changed intent." } });
ok("editing an agreed section returns it to DRAFT", (await svc.from("setup_record").select("status").eq("engagement_id", E).eq("section", "B").single()).data.status === "DRAFT");
await put("B");

// Section D depends on C
[st, j] = await put("D", { payload: { ...sec.D, targets: [{ kpi_id: "K1", target_12m: 1 }] } });
ok("D saved before C: refused, its KPIs do not exist (422)", st === 422 && /not in Section C/.test(j.errors.join()), `${st} ${JSON.stringify(j?.errors)}`);
[st] = await put("C"); ok("C saves", st === 200, st);
[st, j] = await put("D", { payload: { ...sec.D, targets: sec.D.targets.map((t) => t.kpi_id === "K1" ? { ...t, target_12m: -999 } : t) } });
ok("D: a target on the wrong side of the baseline saves but is not complete", st === 200 && j.missing.some((m) => /above|below/.test(m)), JSON.stringify(j.missing));
[st, j] = await agree("D"); ok("D with a bad target is not agreed (422)", st === 422 && /baseline/.test(j.title), `${st} ${j?.title}`);
await put("D");
[st] = await agree("C"); ok("C agrees", st === 200, st);
[st] = await agree("D"); ok("D agrees", st === 200, st);
[st, j] = await put("C", { payload: { ...sec.C, biggest_gap: "Changed gap." } });
ok("saving C sends an agreed D back to draft", st === 200 && j.reopened.join() === "D", JSON.stringify(j.reopened));
await put("C"); await put("D"); await agree("B"); await agree("C"); await agree("D");
// E, F and G need an Executive and an HR entry saved before the agreed record can be agreed (decision 18 Oct 2026)
await put("E");
[st, j] = await agree("E"); ok("E without Executive and HR entries: 409 SETUP_SEQUENCE_VIOLATION", st === 409 && j.code === "SETUP_SEQUENCE_VIOLATION" && /Executive and an HR/.test(j.title), `${st} ${j?.code} ${j?.title}`);
for (const k of ["E", "F", "G"]) for (const p of ["EXECUTIVE", "HR"]) { [st] = await con.call("PUT", `/v1/engagements/${E}/setup/${k}/perspectives/${p}`, { payload: sec[k] }); if (st !== 200) ok(`${k} ${p} entry saves`, false, st); }
// Section F: warnings, tie, completeness (after B, C and D are agreed: spec 1.1 puts E, F and G after them)
[st, j] = await put("F", { payload: { ...sec.F, behaviours: [beh("Honest", "ENGAGE"), ...sec.F.behaviours.slice(1)] } });
ok("a value statement in F1 saves with a wording warning", st === 200 && j.warnings.some((w) => /F1 behaviour 1/.test(w)), JSON.stringify(j.warnings));
await put("F", { payload: { ...sec.F, behaviours: five(["ENGAGE", "ENGAGE", "INNOVATE", "INNOVATE", "PERFORM"]) } });
[st, j] = await agree("F"); ok("Section F with an unresolved tie is not agreed (422)", st === 422 && /tie/.test(j.title), `${st} ${j?.title}`);
await put("F", { payload: { ...sec.F, behaviours: five(["ENGAGE", "ENGAGE", "INNOVATE", "INNOVATE", "PERFORM"]), tie_break: "ENGAGE", tie_break_reason: "The team asked for people first." } });
[st] = await agree("F"); ok("Section F agrees once the tie is broken", st === 200, st);
await put("F", { payload: { ...sec.F, behaviours: sec.F.behaviours.slice(0, 4) } });
[st, j] = await agree("F"); ok("Section F with four behaviours is not complete (422)", st === 422 && /at least 5|five/.test(j.title + (j.errors ?? []).join()), `${st} ${j?.title}`);
await put("F");
const f1 = (await svc.from("setup_record").select("payload_json").eq("engagement_id", E).eq("section", "F").eq("perspective", "AGREED").single()).data.payload_json;
ok("F stores f1_tags derived from the behaviours", f1.f1_tags.join() === s.f1_tags.join(), JSON.stringify(f1.f1_tags));


for (const k of Object.keys(sec)) { await put(k); [st] = await agree(k); if (st !== 200) ok(`agree ${k}`, false, st); }
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`);
ok("without the Executive ticks on A to D, EXT blocks", failing(j).includes("EXT"), JSON.stringify(failing(j)));
// the ticks themselves are tested in e2e-setup-perspectives; here they are recorded directly under a placeholder user
await svc.from("setup_confirmation").insert(["A", "B", "C", "D"].map((section) => ({ engagement_id: E, tenant_id: tenantId, section, user_id: "00000000-0000-4000-8000-000000000e1e" })));
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`);
ok("all sections agreed: L2, L3 and L4 now pass (KPIs derived from C and D)", !failing(j).some((x) => ["L2", "L3", "L4"].includes(x)), JSON.stringify(failing(j)));
ok("with the org graph loaded, L1 and L2 pass (two executive person ids on every section)", !failing(j).some((x) => ["L1", "L2"].includes(x)), JSON.stringify(failing(j)));
ok("what still blocks is L6 (consent text not approved, no transfer basis)", failing(j).join() === "L6", JSON.stringify(failing(j)));

// ---- consent text
const ct0 = (await svc.from("consent_text").select("*").eq("consent_text_id", a0.consent_text_id).single()).data;
ok("the drafted consent text carries the template statements", ct0.status === "DRAFT" && ct0.version === 1 && /cannot be individually/.test(ct0.body) && /hello@pac\.africa/.test(ct0.body));
[st] = await con.call("PUT", `/v1/assessments/${A}/consent-text`, { title: "", body: "x" }); ok("empty title refused (422)", st === 422, st);
[st, j] = await con.call("PUT", `/v1/assessments/${A}/consent-text`, { title: ct0.title, body: ct0.body + "\n\nDraft edit." });
ok("a draft consent text is edited in place", st === 200 && j.consent_text_id === a0.consent_text_id && j.status === "DRAFT");
[st, j] = await con.call("POST", `/v1/assessments/${A}/consent-text/approve`); ok("approve", st === 200 && j.changed === true);
const ct1 = (await svc.from("consent_text").select("status, approved_by, approved_at").eq("consent_text_id", a0.consent_text_id).single()).data;
ok("approval records who and when", ct1.status === "APPROVED" && !!ct1.approved_by && !!ct1.approved_at);
[st, j] = await con.call("POST", `/v1/assessments/${A}/consent-text/approve`); ok("approving again changes nothing", st === 200 && j.changed === false);
const lock = await svc.from("consent_text").update({ body: "tampered" }).eq("consent_text_id", a0.consent_text_id);
ok("an approved text cannot be edited in the database (CONSENT_TEXT_LOCKED)", !!lock.error && lock.error.message.includes("CONSENT_TEXT_LOCKED"), lock.error?.message);
[st, j] = await con.call("PUT", `/v1/assessments/${A}/consent-text`, { title: ct0.title, body: ct0.body + "\n\nSecond edit." });
ok("editing an approved text makes version 2 and pins it as a draft", st === 201 && j.version === 2 && j.status === "DRAFT" && j.consent_text_id !== a0.consent_text_id, `${st} ${JSON.stringify(j)}`);
ok("version 1 is unchanged and still APPROVED", (await svc.from("consent_text").select("status, body").eq("consent_text_id", a0.consent_text_id).single()).data.status === "APPROVED");
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`); ok("the unapproved new version blocks L6 again", failing(j).includes("L6"));
await con.call("POST", `/v1/assessments/${A}/consent-text/approve`);

// ---- transfer basis
[st] = await con.call("PUT", `/v1/assessments/${A}/transfer-basis`, { reference: "x" }); ok("a too-short reference is refused (422)", st === 422, st);
[st, j] = await con.call("POST", `/v1/assessments/${A}/preflight`); ok("L6 still blocks: no transfer basis", failing(j).join() === "L6", JSON.stringify(failing(j)));
[st] = await con.call("PUT", `/v1/assessments/${A}/transfer-basis`, { reference: "Test transfer agreement (placeholder)" }); ok("transfer basis recorded", st === 200);

// ---- window rule (L5) then links
const win = (await svc.from("assessment").select("window_open, window_close").eq("assessment_id", A).single()).data;
await svc.from("assessment").update({ window_open: new Date(Date.now() - 864e5).toISOString(), window_close: new Date(Date.now() + 2 * 864e5).toISOString() }).eq("assessment_id", A);
[st, j] = await con.call("POST", `/v1/assessments/${A}/launch`); ok("a short window blocks launch on L5", st === 422 && failing(j).join() === "L5", `${st} ${JSON.stringify(failing(j))}`);
await svc.from("assessment").update(win).eq("assessment_id", A);
[st] = await con.call("POST", `/v1/assessments/${A}/invitations`, { count: 0 }); ok("0 links refused (422)", st === 422);
[st] = await con.call("POST", `/v1/assessments/${A}/invitations`, { count: 501 }); ok("501 links refused (422)", st === 422);
[st, j] = await con.call("POST", `/v1/assessments/${A}/invitations`, { count: 2 });
ok("two links issued, 128-bit hex", st === 201 && j.tokens.length === 2 && j.tokens.every((t) => /^[0-9a-f]{32}$/.test(t)), `${st}`);
const early = await fetch(`${base}/v1/survey`, { headers: { "x-survey-token": j.tokens[0] } });
ok("a link does not open before launch (410)", early.status === 410, early.status);
const stored = await svc.rpc("rpc_fielding_counts", { p_assessment_id: A });
ok("only the count is visible; tokens are not stored", stored.data.invited === 2 && !JSON.stringify(stored.data).includes(j.tokens[0]));

// ---- dashboard and page, then launch
const dash1 = await (await con.f("/dashboard?all=1")).text();
ok("dashboard offers 'Review setup and launch'", dash1.includes("Review setup and launch"));
const page1 = await (await con.f(`/engagements/${E}/setup`)).text();
ok("setup page shows the launch checks and the Launch button", page1.includes("Launch checks") && page1.includes("Launch assessment") && page1.includes("Ready to launch"));
const nRecords = (await svc.from("setup_record").select("setup_id", { count: "exact", head: true }).eq("engagement_id", E)).count;   // launch locks every setup record: the agreed ones and the perspective entries
[st, j] = await con.call("POST", `/v1/assessments/${A}/launch`);
ok("launch from the endpoint succeeds", st === 200 && j.changed === true && j.sections_locked === nRecords && nRecords >= 9 && j.leaders_in_scope === 64, `${st} ${JSON.stringify(j)}`);
const snap = (await svc.from("org_graph_snapshot").select("scope_json").eq("engagement_id", E).single()).data;
ok("launch took the snapshot: 64 leaders in scope with the fixture's headcounts (63 of 10, one of 140)", snap.scope_json.length === 64 && snap.scope_json.filter((x) => x.headcount_led === 10).length === 63 && snap.scope_json.filter((x) => x.headcount_led === 140).length === 1);
ok("engagement is FIELDING", (await svc.from("engagement").select("state").eq("engagement_id", E).single()).data.state === "FIELDING");
[st] = await put("B"); ok("after launch: section edit refused (409)", st === 409, st);
[st] = await con.call("PUT", `/v1/assessments/${A}/consent-text`, { title: "t", body: "b" }); ok("after launch: consent edit refused (409)", st === 409, st);
[st] = await con.call("PUT", `/v1/assessments/${A}/transfer-basis`, { reference: "changed after launch" }); ok("after launch: transfer basis refused (409)", st === 409, st);
[st] = await con.call("POST", `/v1/engagements/${E}/assessments`, { window_open: day(-15), window_close: day(1) }); ok("after launch: no second assessment (409)", st === 409, st);
const g = await fetch(`${base}/v1/survey`, { headers: { "x-survey-token": (await svc.rpc("rpc_issue_invitations", { p_assessment_id: A, p_count: 1 })).data[0] } });
const gj = await g.json();
ok("after launch: a link opens the survey with the approved consent text", g.status === 200 && gj.consent.version === 2 && /Second edit/.test(gj.consent.body));
const dash2 = await (await con.f("/dashboard?all=1")).text();
ok("dashboard no longer offers setup and shows the survey window (portfolio redesign: the journey strip replaced the Survey links button)", !new RegExp(`href="/engagements/${E}/setup"[^>]*>Review setup and launch`).test(dash2) && dash2.includes("survey window closes"));
const page2 = await (await con.f(`/engagements/${E}/setup`)).text();
ok("setup page shows Launched", page2.includes("Launched") && !page2.includes("Launch assessment"));

const { data: aud } = await svc.from("audit_log").select("action").eq("tenant_id", tenantId);
const acts = new Set((aud ?? []).map((a) => a.action));
ok("every step is audited with an actor",
  ["assessment.created", "setup.saved:B", "setup.agreed:B", "setup.agreed:F", "setup.agreed:D", "consent_text.edited", "consent_text.approved", "consent_text.new_version", "tenant.transfer_basis_recorded", "invitations.issued:2", "assessment.launched"].every((x) => acts.has(x)),
  [...acts].join(", "));

done();
