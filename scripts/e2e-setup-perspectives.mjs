// Journey 1, block 26: Executive and HR perspectives, comparison, workshop record (facilitator, person ids), sequencing, the tie break reason,
// derived requirements, the stored setup output, the Section field rules, A1 to A4 for the Client Admin, contradiction flags, G5 write back and V2.
//   node --env-file=.env.local scripts/e2e-setup-perspectives.mjs <project-ref> <token-file> [base-url]
// Needs migrations 20261018104500_setup_flags and 20261019020000_setup_confirm_facilitator applied. Seeds a bare and a draft tenant (new each run) and uses the launched fixture tenant for role cells.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { buildGraph } from "./lib/demo-graph.mjs";
import { ok, done, signIn, URL_, ANON, pwOf, passwords } from "./lib/e2e.mjs";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const seed = (mode, re) => re.exec(execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs", ref, tokenFile, mode], { encoding: "utf8" }));
const [, tenantId, E] = seed("bare", /: (ten_\S+) \/ (eng_\S+) BARE/);
const [, dTenant, dEng, dAsm] = seed("draft", /: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+) DRAFT/);
const adminEmail = Object.keys(passwords()).filter((e) => /^admin\.bare\d+@/.test(e)).at(-1);
const dAdminEmail = Object.keys(passwords()).filter((e) => /^admin\.draft\d+@/.test(e)).at(-1);
const fx = JSON.parse(readFileSync("packages/cdp-engine/oracle/cases/fixture.json"));
const s = fx.input.setup;

const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function session(em, pw = pwOf(em)) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email: em, password: pw });
  if (error) throw new Error(em + ": " + error.message);
  const f = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "), "x-cdp-csrf": "1", "content-type": "application/json", ...(init.headers ?? {}) } });
  const call = async (method, path, body) => { const r = await f(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)]; };
  return { f, call };
}
const con = await session("consultant@cdp-demo.example"), adm = await session(adminEmail), dAdm = await session(dAdminEmail);
const exec = await session("exec.fixture@cdp-demo.example"), lead = await session("peoplelead.fixture@cdp-demo.example"), root = await session("superadmin@cdp-demo.example");
const { data: ften } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const F = (await svc.from("engagement").select("engagement_id").eq("tenant_id", ften.tenant_id).single()).data.engagement_id;   // launched fixture engagement
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const token = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
const sql = async (query) => (await (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json());
const SET = `/v1/engagements/${E}/setup`;
const errs = (j) => (j?.errors ?? []).join(" | ") + " " + (j?.title ?? "");

// ---- who may call (no session, then the roles of Table 7 on the launched fixture engagement)
const noAuth = (m, p) => fetch(base + p, { method: m, headers: { "content-type": "application/json" }, body: m === "GET" ? undefined : "{}" }).then((r) => r.status);
for (const [m, p] of [["PUT", `${SET}/E/perspectives/HR`], ["GET", `${SET}/E/comparison`], ["PUT", `${SET}/E/comparison`], ["GET", `${SET}/requirements`], ["GET", `${SET}/output`],
  ["GET", `${SET}/contradictions`], ["PUT", `${SET}/contradictions`], ["GET", `/v1/engagements/${E}/organisation`], ["PUT", `/v1/engagements/${E}/organisation`]])
  ok(`no session: ${m} ${p.split("/").slice(4).join("/")} is 401`, (await noAuth(m, p)) === 401);
const FS = `/v1/engagements/${F}/setup`;
for (const p of [`${FS}/E/comparison`, `${FS}/requirements`, `${FS}/output`, `/v1/engagements/${F}/organisation`]) { const [st] = await exec.call("GET", p); ok(`executive reads ${p.split("/").slice(4).join("/")} (200)`, st === 200, st); }
let [st, j] = await exec.call("PUT", `${FS}/E/perspectives/HR`, { payload: {} }); ok("executive cannot write a perspective (403)", st === 403, st);
[st] = await exec.call("PUT", `${FS}/E/comparison`, { flags: { e1: true } }); ok("executive cannot flag a difference (403)", st === 403, st);
[st] = await exec.call("PUT", `/v1/engagements/${F}/organisation`, {}); ok("executive cannot edit A1 to A4 (403)", st === 403, st);
[st] = await exec.call("PUT", `${FS}/contradictions`, { h1: true }); ok("executive cannot set contradiction flags (403)", st === 403, st);
for (const [n, x] of [["people leader", lead], ["super admin", root], ["a Client Admin of another tenant", adm]]) {
  [st] = await x.call("GET", `${FS}/requirements`); ok(`${n} cannot read requirements (403)`, st === 403, st);
  [st] = await x.call("GET", `${FS}/E/comparison`); ok(`${n} cannot read the comparison (403)`, st === 403, st);
  [st] = await x.call("GET", `${FS}/output`); ok(`${n} cannot read the setup output (403)`, st === 403, st);
}
[st, j] = await root.call("PUT", `/v1/engagements/${E}/organisation`, {}); ok("super admin may edit A1 to A4: an empty body is refused as invalid (422), not as forbidden", st === 422, st);
[st, j] = await con.call("PUT", `${FS}/E/perspectives/HR`, { payload: {} }); ok("a launched engagement refuses a perspective: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
[st, j] = await con.call("PUT", `${FS}/E/comparison`, { flags: { e1: true } }); ok("a launched engagement refuses a flag: 409 SETUP_LOCKED", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);

// ---- A1 to A4: the Client Admin and the Super Admin edit them
[st, j] = await adm.call("GET", `/v1/engagements/${E}/organisation`); ok("Client Admin reads A1 to A4 and may edit", st === 200 && j.can_edit === true, JSON.stringify(j));
[st] = await con.call("PUT", `/v1/engagements/${E}/organisation`, { name: "X", sector: "OTHER", headcount: 10, geographies: ["KE"] }); ok("the consultant cannot edit A1 to A4 (403)", st === 403, st);
[st, j] = await root.call("GET", `/v1/engagements/${E}/organisation`); ok("super admin reads A1 to A4 and may edit", st === 200 && j.can_edit === true, JSON.stringify(j));
const A = { name: "Bare Demo Renamed", sector: "TECHNOLOGY", headcount: 750, geographies: ["ke", "UG"] };
for (const [label, over, re] of [["empty name", { name: "  " }, /Name/], ["name over 200", { name: "x".repeat(201) }, /Name/], ["unknown sector", { sector: "MINING" }, /sector/],
  ["headcount 0", { headcount: 0 }, /Headcount/], ["headcount 1.5", { headcount: 1.5 }, /Headcount/], ["headcount as text", { headcount: "7" }, /Headcount/],
  ["country name instead of code", { geographies: ["Kenya"] }, /two-letter/], ["no country", { geographies: [] }, /two-letter/]]) {
  [st, j] = await adm.call("PUT", `/v1/engagements/${E}/organisation`, { ...A, ...over });
  ok(`A1 to A4 refused: ${label} (422)`, st === 422 && re.test(j.title), `${st} ${j?.title}`);
}
[st, j] = await adm.call("PUT", `/v1/engagements/${E}/organisation`, A); ok("Client Admin saves A1 to A4", st === 200, `${st} ${j?.title}`);
const t1 = (await svc.from("tenant").select("name, sector, headcount, geographies").eq("tenant_id", tenantId).single()).data;
[st, j] = await root.call("PUT", `/v1/engagements/${E}/organisation`, { ...A, headcount: 760 }); ok("Super Admin saves A1 to A4 too", st === 200, `${st} ${j?.title}`);
await adm.call("PUT", `/v1/engagements/${E}/organisation`, A);
ok("the tenant record now holds the Client Admin's values", t1.name === A.name && t1.sector === "TECHNOLOGY" && t1.headcount === 750 && t1.geographies.join() === "KE,UG", JSON.stringify(t1));

// ---- organisation and people (person ids for the workshop record)
[st, j] = await con.call("PUT", `/v1/engagements/${E}/org-graph`, buildGraph([10, 10, 10, 10, 10], { asOf: day(-60) }));
ok("organisation loaded", st === 200 && j.blocking.length === 0, JSON.stringify(j.blocking ?? j));
const { data: grades } = await svc.from("grade_band").select("grade_id, name, is_executive").eq("tenant_id", tenantId);
const gname = new Map(grades.map((g) => [g.grade_id, g.name]));
const { data: ppl } = await svc.from("person_of_record").select("person_id, employee_ref, grade_id").eq("tenant_id", tenantId).order("employee_ref");
const X = ppl.filter((p) => gname.get(p.grade_id) === "Executive").map((p) => p.person_id), N = ppl.filter((p) => gname.get(p.grade_id) === "Staff").map((p) => p.person_id);
ok("the demo organisation has executive and staff people", X.length >= 4 && N.length >= 2, `${X.length} ${N.length}`);
const { data: fpeople } = await svc.from("person_of_record").select("person_id").eq("tenant_id", dTenant).limit(1);

// ---- the payloads (what the guided forms send)
const O = Object.keys(s.kpi_for);
const kpis = [
  ...O.map((o) => ({ name: s.kpi_for[o].name, unit: "PERCENT", direction: s.kpi_for[o].target < s.kpi_for[o].baseline ? "LOWER_IS_BETTER" : "HIGHER_IS_BETTER", baseline_value: s.kpi_for[o].baseline, baseline_date: "2026-06-30", source: "HR system", orientation: o })),
  { name: "Revenue growth (%)", unit: "PERCENT", direction: "HIGHER_IS_BETTER", baseline_value: 4, baseline_date: "2026-06-30", source: "Finance" },
  { name: "Customer satisfaction", unit: "SCORE", direction: "HIGHER_IS_BETTER", baseline_value: 70, baseline_date: "2026-06-30", source: "Survey" },
];
const targets = [{ kpi_id: "K1", target_12m: s.kpi_for[O[0]].target }, { kpi_id: "K2", target_12m: s.kpi_for[O[1]].target }, { kpi_id: "K3", target_12m: s.kpi_for[O[2]].target }, { kpi_id: "K4", target_12m: 6 }, { kpi_id: "K5", target_12m: 75 }];
const beh = (t, o) => ({ text: t, orientation: o });
const five = (tags) => tags.map((o, i) => beh("Asks the team for their view before deciding " + (i + 1), o));
const lines = (p, n = 3) => Array.from({ length: n }, (_, i) => p + " " + (i + 1));
const sec = {
  A: { maturity: "GROWTH", trigger: "Digital transformation under way; leadership wants a baseline." },
  B: { intent: "Grow digital channels while keeping service quality.", horizon: "THREE_YEARS", priorities: s.priorities.map((p) => ({ text: p.text, goal_type: p.goal_type })), positioning: ["QUALITY", "INNOVATION"], business_model: s.business_model },
  C: { kpis, trend: "IMPROVING", biggest_gap: "Speed of decisions.", attrition_pct: 19, time_to_hire_days: 45 },
  D: { targets, winning: "Be the bank of choice.", board_metrics: "Attrition, adoption.", non_negotiables: "Compliance." },
  E: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ["e" + i, "Lived culture note " + i])),
  F: { behaviours: five(s.f1_tags), staff_behaviours: five(s.f1_tags), decision_making: "Consultative.", collaboration: "Cross-functional.", risk_appetite: "MODERATE" },
  G: { stop_leadership: lines("Stop"), stop_practices: lines("Stop practice"), start_leadership: lines("Start"), start_practices: lines("Start practice") },
  H: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ["h" + i, "Process note " + i])),
};
const put = (k, over = {}) => con.call("PUT", `${SET}/${k}`, { payload: sec[k], workshop_date: day(-30), participants: [X[0], X[1]], ...over });
const agree = (k) => con.call("POST", `${SET}/${k}/agree`);
const row = async (k, p = "AGREED") => (await svc.from("setup_record").select("*").eq("engagement_id", E).eq("section", k).eq("perspective", p).maybeSingle()).data;
const refuse = async (label, k, payload, re) => { const [c, r] = await put(k, { payload: { ...sec[k], ...payload } }); ok(`refused: ${label}`, c === 422 && re.test(errs(r)), `${c} ${errs(r)}`); };
const required = async (label, k, drop, re) => { const p = { ...sec[k] }; for (const d of drop) delete p[d]; const [c, r] = await put(k, { payload: p }); ok(`required to agree: ${label}`, c === 200 && re.test((r.missing ?? []).join(" | ")), `${c} ${(r?.missing ?? []).join(" | ")}`); };
const accepted = async (label, k, payload) => { const [c, r] = await put(k, { payload: { ...sec[k], ...payload } }); ok(`accepted: ${label}`, c === 200, `${c} ${errs(r)}`); return r; };

// ---- requirements before anything is agreed
[st, j] = await adm.call("GET", `${SET}/requirements`);
ok("requirements: nothing derived before B, C and D are agreed", st === 200 && j.ready === false && j.c1 === null && j.c4 === null && j.leadership_target_orientation === null, JSON.stringify(j));

// ---- Section field rules (S1.4.2 rows). Each refusal and each requirement is its own check.
const long = (n) => "x".repeat(n);
await refuse("A5 maturity not in the list", "A", { maturity: "OLD" }, /A5/); await refuse("A6 over 2000 characters", "A", { trigger: long(2001) }, /A6/);
await required("A6 trigger", "A", ["trigger"], /A6/); await required("A5 maturity", "A", ["maturity"], /A5/);
await refuse("B1 four sentences", "B", { intent: "One. Two. Three. Four." }, /B1.*one to three sentences/); await refuse("B1 over 1000 characters", "B", { intent: long(1001) }, /B1/);
await accepted("B1 one sentence", "B", { intent: "Grow." }); await accepted("B1 three sentences", "B", { intent: "Grow digital. Keep quality? Hire well!" });
await required("B1 intent", "B", ["intent"], /B1/);
await refuse("B4 value not in the list", "B", { positioning: ["FASHION"] }, /B4/); await required("B4 at least one value", "B", ["positioning"], /B4/);
await put("B", { payload: { ...sec.B, positioning: [] } }).then(([c, r]) => ok("required to agree: B4 empty list", c === 200 && /B4/.test(r.missing.join()), JSON.stringify(r.missing)));
await refuse("B5 over 1000 characters", "B", { market_shift: long(1001) }, /B5/);
await accepted("B5 text", "B", { market_shift: "Mobile money is growing." });
{ const r = await accepted("B5 left out", "B", { market_shift: undefined }); ok("B5 is optional: not listed as missing", !r.missing.some((m) => /B5/.test(m)), JSON.stringify(r.missing)); }
await refuse("C3 trend not in the list", "C", { trend: "FLAT" }, /C3/); await required("C3 trend", "C", ["trend"], /C3/);
await refuse("C4 over 1000 characters", "C", { biggest_gap: long(1001) }, /C4/); await required("C4 biggest gap", "C", ["biggest_gap"], /C4/);
await refuse("C5 with three decimals", "C", { attrition_pct: 19.256 }, /C5.*2 decimal places/); await refuse("C5 above 100", "C", { attrition_pct: 100.5 }, /C5/); await refuse("C5 below 0", "C", { attrition_pct: -1 }, /C5/);
await refuse("C5 as text", "C", { attrition_pct: "high" }, /C5.*number/); await accepted("C5 with two decimals", "C", { attrition_pct: 19.25 }); await accepted("C5 at 100", "C", { attrition_pct: 100 });
await required("C5 attrition", "C", ["attrition_pct"], /C5/);
await refuse("C6 above 365", "C", { time_to_hire_days: 366 }, /C6/); await refuse("C6 with a fraction", "C", { time_to_hire_days: 1.5 }, /C6.*whole/); await refuse("C6 below 0", "C", { time_to_hire_days: -1 }, /C6/);
await accepted("C6 at 365", "C", { time_to_hire_days: 365 });
{ const r = await accepted("C6 left out", "C", { time_to_hire_days: undefined }); ok("C6 is optional: not listed as missing", !r.missing.some((m) => /C6/.test(m)), JSON.stringify(r.missing)); }
await put("C");   // KPIs must exist in C before D can name them
await refuse("D3 over 1000 characters", "D", { winning: long(1001) }, /D3/); await required("D3 winning", "D", ["winning"], /D3/);
await refuse("D4 over 1000 characters", "D", { board_metrics: long(1001) }, /D4/); await required("D4 board metrics", "D", ["board_metrics"], /D4/);
await refuse("D5 over 1000 characters", "D", { non_negotiables: long(1001) }, /D5/); await required("D5 non negotiables", "D", ["non_negotiables"], /D5/);
for (let i = 1; i <= 6; i++) { await refuse(`E${i} over 2000 characters`, "E", { ["e" + i]: long(2001) }, new RegExp(`E${i}`)); await required(`E${i}`, "E", ["e" + i], new RegExp(`E${i}`)); }
await refuse("F1 six behaviours", "F", { behaviours: five(["ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE"]) }, /F1.*at most 5/);
await refuse("F1 orientation not in the list", "F", { behaviours: five(["ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE", "SPEED"]) }, /Orientation/);
await refuse("F2 six behaviours", "F", { staff_behaviours: five(["ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE"]) }, /F2.*at most 5/);
await put("F", { payload: { ...sec.F, staff_behaviours: five(["ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE"]) } }).then(([c, r]) => ok("required to agree: F2 needs five", c === 200 && /F2.*at least 5/.test(r.missing.join()), JSON.stringify(r.missing)));
await accepted("F2 tag left out", "F", { staff_behaviours: sec.F.staff_behaviours.map((b) => ({ text: b.text })) });
await refuse("F3 over 1000 characters", "F", { decision_making: long(1001) }, /F3/); await required("F3 decision making", "F", ["decision_making"], /F3/);
await refuse("F4 over 1000 characters", "F", { collaboration: long(1001) }, /F4/); await required("F4 collaboration", "F", ["collaboration"], /F4/);
await refuse("F5 not in the list", "F", { risk_appetite: "RECKLESS" }, /F5/); await required("F5 risk appetite", "F", ["risk_appetite"], /F5/);
await refuse("F tie break not in the list", "F", { tie_break: "SPEED" }, /Tie-break/); await refuse("F tie break reason over 500 characters", "F", { tie_break_reason: long(501) }, /Tie-break reason/);
for (const [k, label] of [["stop_leadership", "G1"], ["stop_practices", "G2"], ["start_leadership", "G3"], ["start_practices", "G4"]]) {
  await refuse(`${label} six entries`, "G", { [k]: lines("x", 6) }, new RegExp(`${label}.*at most 5`));
  await put("G", { payload: { ...sec.G, [k]: lines("x", 2) } }).then(([c, r]) => ok(`required to agree: ${label} needs three entries (two given)`, c === 200 && new RegExp(`${label}.*at least 3`).test(r.missing.join()), JSON.stringify(r.missing)));
  await required(`${label}`, "G", [k], new RegExp(label));
}
await refuse("G5 eleven entries", "G", { keep_protect: lines("Keep", 11) }, /G5.*at most 10/); await accepted("G5 workshop entries", "G", { keep_protect: lines("Keep", 2) });
for (let i = 1; i <= 6; i++) { await refuse(`H${i} over 2000 characters`, "H", { ["h" + i]: long(2001) }, new RegExp(`H${i}`)); await required(`H${i}`, "H", ["h" + i], new RegExp(`H${i}`)); }
await refuse("H1 contradiction flag as text", "H", { contradiction_h1: "yes" }, /H1.*yes or no/);
await put("A"); await put("B"); await put("C"); await put("D"); await put("E"); await put("F"); await put("G"); await put("H");

// ---- workshop record: person ids, executive grade, facilitator
[st, j] = await put("B", { participants: [X[0], "per_0000000000000000"] }); ok("a person id that is not on the organisation record is refused (422)", st === 422 && j.unknown?.length === 1, `${st} ${j?.title}`);
[st, j] = await put("B", { participants: [X[0], fpeople[0].person_id] }); ok("a person id of another organisation is refused (422)", st === 422, st);
[st, j] = await put("B", { facilitator: "Dr Wanjiku Mwangi" }); ok("typed facilitator text is refused: the facilitator is a user reference (422)", st === 422 && /facilitator_user_id/.test(j.title), `${st} ${j?.title}`);
[st, j] = await put("B", { facilitator_user_id: 7 }); ok("a facilitator id that is not a user id is refused (422)", st === 422, st);
const consId = (await sql(`select id from auth.users where email = 'consultant@cdp-demo.example'`))[0].id, admId = (await sql(`select id from auth.users where email = '${adminEmail}'`))[0].id;
[st, j] = await put("B", { facilitator_user_id: admId }); ok("a user who is not an assigned consultant (the Client Admin) is refused as facilitator (422)", st === 422, st);
[st, j] = await put("B", { facilitator_user_id: "00000000-0000-4000-8000-000000000000" }); ok("an unknown user id is refused as facilitator (422)", st === 422, st);
[st, j] = await con.call("GET", `${SET}/facilitators`); const facName = j?.consultants?.find((u) => u.user_id === consId)?.name;
ok("the facilitator pick list holds the consultants assigned to this engagement", st === 200 && !!facName, `${st} ${JSON.stringify(j)}`);
[st] = await adm.call("GET", `${SET}/facilitators`); ok("the pick list is the consultant's only (Client Admin 403)", st === 403, st);
[st, j] = await put("B", { participants: [X[0], N[0]] });
ok("an executive and a non executive id save; one verified executive is reported", st === 200 && j.participants.verified === 1 && j.participants.not_executive === 1, JSON.stringify(j?.participants));
ok("the facilitating consultant defaults to the person saving, stored as a user id with the name shown", (await row("B")).facilitator_user_id === consId && (await row("B")).facilitator === facName, JSON.stringify(await row("B")));
[st, j] = await agree("B"); ok("agree with one verified executive and one staff member: 422 WORKSHOP_RECORD_MISSING", st === 422 && j.code === "WORKSHOP_RECORD_MISSING", `${st} ${j?.code}`);
await put("B", { participants: [N[0], N[1]] });
[st, j] = await agree("B"); ok("agree with two staff ids (no executive grade): 422 WORKSHOP_RECORD_MISSING", st === 422 && j.code === "WORKSHOP_RECORD_MISSING", `${st} ${j?.code}`);
[st, j] = await put("B", { participants: [X[0], "Chief Executive"] }); ok("a typed name is refused: only person ids count (422)", st === 422 && /person ids/.test(j.title), `${st} ${j?.title}`);
const otherC = (await sql(`select id from auth.users where email = 'consultant.a@cdp-demo.example'`))[0]?.id;
if (otherC) {
  [st] = await put("B", { participants: [X[0], X[1]], facilitator_user_id: otherC }); ok("a consultant not assigned to this engagement is refused as facilitator (422)", st === 422, st);
  await sql(`insert into app.engagement_assignment (user_id, engagement_id, valid_to) values ('${otherC}', '${E}', now() + interval '30 days')`);
}
[st] = await put("B", { participants: [X[0], X[1]], facilitator_user_id: otherC ?? consId });
const facList = (await con.call("GET", `${SET}/facilitators`))[1].consultants;
ok("an explicit facilitator is stored as a user id and shown by name", st === 200 && (await row("B")).facilitator_user_id === (otherC ?? consId) && (await row("B")).facilitator === facList.find((u) => u.user_id === (otherC ?? consId)).name, JSON.stringify(await row("B")));
await svc.from("setup_record").update({ facilitator: null, facilitator_user_id: null }).eq("engagement_id", E).eq("section", "B").eq("perspective", "AGREED");
[st, j] = await agree("B"); ok("agree without a facilitating consultant: 422 WORKSHOP_RECORD_MISSING", st === 422 && j.code === "WORKSHOP_RECORD_MISSING" && /facilitating/.test(j.title), `${st} ${j?.title}`);

// ---- sequence: B, C and D first; E, F and G after; Section I last (spec 1.1)
await put("E");
await con.call("PUT", `${SET}/I`, { payload: { anonymity: "FULL", languages: ["en"], staff_message: "We are running the profile.", qualitative: "NONE", completion_estimate: "35 minutes", reminder_plan: "STANDARD" }, workshop_date: day(-30), participants: [X[0], X[1]] });
[st, j] = await agree("E"); ok("Section E cannot be agreed before B, C and D (409 SETUP_SEQUENCE_VIOLATION)", st === 409 && j.code === "SETUP_SEQUENCE_VIOLATION" && /B, C, D/.test(j.title), `${st} ${j?.code} ${j?.title}`);
[st, j] = await agree("F"); ok("Section F cannot be agreed before B, C and D (409)", st === 409, st);
[st, j] = await agree("G"); ok("Section G cannot be agreed before B, C and D (409)", st === 409, st);
[st, j] = await agree("I"); ok("Section I cannot be agreed before the others (409)", st === 409 && /last/.test(j.title), `${st} ${j?.title}`);
for (const p of ["EXECUTIVE", "HR"]) { [st, j] = await con.call("PUT", `${SET}/E/perspectives/${p}`, { payload: sec.E }); ok(`${p} entry cannot be captured before B, C and D are agreed (409 SETUP_SEQUENCE_VIOLATION)`, st === 409 && j.code === "SETUP_SEQUENCE_VIOLATION", `${st} ${j?.code}`); }
[st] = await adm.call("PUT", `${SET}/E/perspectives/HR`, { payload: sec.E }); ok("Client Admin: the same sequence rule applies (409)", st === 409, st);
await put("A"); [st] = await agree("A"); ok("Section A has no ordering rule in the spec sentence: it agrees at once", st === 200, st);
await put("B"); [st] = await agree("B"); ok("B agrees with a date, two verified executives and a facilitator", st === 200, st);
await put("C"); [st] = await agree("C"); ok("C agrees", st === 200, st);
await put("D"); [st] = await agree("D"); ok("D agrees", st === 200, st);

// ---- Client Admin drafts of A to D (decision 18 Oct 2026): EXECUTIVE rows with status DRAFT; the AGREED record is not touched
[st, j] = await adm.call("PUT", `${SET}/B/perspectives/EXECUTIVE`, { payload: { ...sec.B, intent: "Client draft intent." } });
ok("Client Admin drafts Section B (EXECUTIVE perspective, DRAFT)", st === 200 && j.status === "DRAFT", `${st} ${j?.title}`);
ok("the draft is its own row; the agreed B is unchanged and still AGREED", (await row("B", "EXECUTIVE")).payload_json.intent === "Client draft intent." && (await row("B")).payload_json.intent === sec.B.intent && (await row("B")).status === "AGREED");
for (const k of ["A", "C", "D"]) { [st, j] = await adm.call("PUT", `${SET}/${k}/perspectives/EXECUTIVE`, { payload: sec[k] }); ok(`Client Admin drafts Section ${k}`, st === 200 && j.status === "DRAFT", `${st} ${j?.title}`); }
[st, j] = await adm.call("PUT", `${SET}/D/perspectives/EXECUTIVE`, { payload: { ...sec.D, targets: [{ kpi_id: "K9", target_12m: 1 }] } }); ok("a Section D draft naming a KPI that is not in C is refused (422)", st === 422 && /not in Section C/.test(errs(j)), `${st} ${errs(j)}`);
[st, j] = await adm.call("PUT", `${SET}/D/perspectives/EXECUTIVE`, { payload: { ...sec.D, winning: long(1001) } }); ok("a draft is checked like the section (D3 over 1000: 422)", st === 422 && /D3/.test(errs(j)), `${st} ${errs(j)}`);
await svc.from("setup_record").delete().eq("engagement_id", E).eq("perspective", "EXECUTIVE").in("section", ["A", "B", "C", "D"]);

// ---- Executives confirm an agreed section with a recorded tick (decision 18 Oct 2026)
const exEmail = `exec.setup${Date.now()}@cdp-demo.example`, exPw = "Tmp-" + crypto.randomUUID();
const { data: cu, error: cuErr } = await svc.auth.admin.createUser({ email: exEmail, password: exPw, email_confirm: true });
if (cuErr) throw new Error("create test executive: " + cuErr.message);
await sql(`insert into app.user_profile (user_id, full_name) values ('${cu.user.id}', 'Setup Executive') on conflict do nothing; insert into app.membership (user_id, tenant_id, role) values ('${cu.user.id}', '${tenantId}', 'EXECUTIVE')`);
const tex = await session(exEmail, exPw), texC = await signIn(exEmail, exPw);
const ticks = async (k) => (await svc.from("setup_confirmation").select("user_id, confirmed_at").eq("engagement_id", E).eq("section", k)).data ?? [];
[st] = await tex.call("POST", `${SET}/Z/confirm`); ok("confirm: an unknown section is refused (422)", st === 422, st);
[st, j] = await tex.call("POST", `${SET}/H/confirm`); ok("confirm: a section that is not agreed yet is refused (409)", st === 409, `${st} ${j?.code}`);
[st] = await con.call("POST", `${SET}/B/confirm`); ok("confirm: the consultant cannot tick for the Executives (403)", st === 403, st);
[st] = await adm.call("POST", `${SET}/B/confirm`); ok("confirm: the Client Admin cannot tick for the Executives (403)", st === 403, st);
ok("confirm: no session is 401", (await noAuth("POST", `${SET}/B/confirm`)) === 401);
[st, j] = await tex.call("POST", `${SET}/B/confirm`); ok("an Executive confirms the agreed Section B", st === 200 && j.confirmed === true, `${st} ${JSON.stringify(j)}`);
[st] = await tex.call("POST", `${SET}/B/confirm`); ok("confirming twice records one tick", st === 200 && (await ticks("B")).length === 1);
const tk = (await ticks("B"))[0];
ok("the tick records who and when", tk.user_id === cu.user.id && !!tk.confirmed_at);
ok("the tick is audited", ((await svc.from("audit_log").select("action").eq("tenant_id", tenantId).eq("action", "setup.confirmed:B")).data ?? []).length >= 1);
[st, j] = await tex.call("GET", `${SET}/B/confirm`); ok("an Executive reads the ticks", st === 200 && j.confirmations.length === 1, `${st} ${JSON.stringify(j)}`);
[st, j] = await adm.call("GET", `${SET}/B/confirm`); ok("the Client Admin reads the ticks", st === 200 && j.confirmations.length === 1, st);
[st] = await tex.call("PUT", `${SET}/B`, { payload: sec.B }); ok("read only: an Executive cannot save a section (403)", st === 403, st);
[st] = await tex.call("POST", `${SET}/B/agree`); ok("read only: an Executive cannot agree a section (403)", st === 403, st);
[st] = await tex.call("PUT", `${SET}/B/perspectives/EXECUTIVE`, { payload: sec.B }); ok("read only: an Executive cannot write a draft (403)", st === 403, st);
{ const r = await texC.c.from("setup_confirmation").insert({ engagement_id: E, tenant_id: tenantId, section: "C", user_id: cu.user.id }); ok("RLS: an Executive cannot write a tick directly", !!r.error, JSON.stringify(r.error));
  const r2 = await texC.c.from("setup_confirmation").select("section").eq("engagement_id", E); ok("RLS: an Executive reads the ticks of their own organisation", !r2.error && r2.data.length === 1, JSON.stringify(r2)); }
await put("B", { payload: { ...sec.B, intent: "Changed after the tick." } });
ok("changing the section clears its ticks (it has to be confirmed again)", (await ticks("B")).length === 0);
await put("B"); [st] = await agree("B"); ok("B is agreed again", st === 200, st);

[st, j] = await agree("I"); ok("Section I still waits for E, F and G (409)", st === 409 && /E, F, G/.test(j.title), `${st} ${j?.title}`);

// ---- requirements once B, C and D are agreed
[st, j] = await adm.call("GET", `${SET}/requirements`);
ok("requirements: C1 and C4 are derived by the engine once B, C and D are agreed", st === 200 && j.ready === true && j.c1.length >= 1 && j.c1[0].source_refs.length >= 1 && j.c4.type !== undefined && j.c4.orientations.length >= 1, JSON.stringify(j));
ok("requirements: the leadership target is not final before Section F is agreed", j.leadership_target_basis === "DRAFT", JSON.stringify(j));   // a saved draft shows as a labelled reading, never as final

// ---- perspectives: Executive and HR entries, comparison, divergence
const exTags = ["ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE", "ENGAGE"], hrTags = ["ENGAGE", "ENGAGE", "ENGAGE", "INNOVATE", "INNOVATE"];
[st, j] = await con.call("PUT", `${SET}/B/perspectives/HR`, { payload: sec.B }); ok("Sections A to D take an EXECUTIVE draft only: an HR entry for B is refused (422)", st === 422, st);
[st] = await con.call("PUT", `${SET}/E/perspectives/AGREED`, { payload: sec.E }); ok("the AGREED perspective is not written through this route (422)", st === 422, st);
[st] = await con.call("PUT", `${SET}/E/perspectives/BOARD`, { payload: sec.E }); ok("an unknown perspective is refused (422)", st === 422, st);
[st] = await con.call("PUT", `${SET}/E/perspectives/HR`, { payload: [1] }); ok("a payload that is not an object is refused (422)", st === 422, st);
[st, j] = await con.call("PUT", `${SET}/E/perspectives/HR`, { payload: { e1: long(2001) } }); ok("a perspective entry is checked like the section (E1 over 2000: 422)", st === 422 && /E1/.test(errs(j)), `${st} ${errs(j)}`);
[st, j] = await con.call("PUT", `${SET}/F/perspectives/EXECUTIVE`, { payload: { ...sec.F, risk_appetite: "RECKLESS" } }); ok("a perspective entry refuses a value outside the list (F5: 422)", st === 422 && /F5/.test(errs(j)), `${st} ${errs(j)}`);
[st, j] = await con.call("PUT", `${SET}/E/perspectives/EXECUTIVE`, { payload: sec.E }); ok("consultant saves the Executive entry for E (draft)", st === 200 && j.status === "DRAFT" && j.missing.length === 0, `${st} ${JSON.stringify(j)}`);
[st, j] = await adm.call("PUT", `${SET}/E/perspectives/HR`, { payload: { ...sec.E, e2: "HR sees conflict handled differently." } }); ok("Client Admin saves the HR entry for E (draft, through the database policy)", st === 200 && j.status === "DRAFT", `${st} ${JSON.stringify(j?.title)}`);
[st, j] = await adm.call("PUT", `${SET}/F/perspectives/HR`, { payload: { ...sec.F, behaviours: five(hrTags), tie_break: "GOVERN", tie_break_reason: "ignored", f1_overrides: ["1"] } });
ok("Client Admin saves the HR entry for F; the tie break and wording choices are dropped (they belong to the agreed record)", st === 200 && !("tie_break" in j.payload) && !("f1_overrides" in j.payload), `${st} ${JSON.stringify(j?.payload)}`);
[st] = await con.call("PUT", `${SET}/F/perspectives/EXECUTIVE`, { payload: { ...sec.F, behaviours: five(exTags) } }); ok("consultant saves the Executive entry for F", st === 200, st);
for (const k of ["EXECUTIVE", "HR"]) ok(`database: the ${k} row for E exists with status DRAFT`, (await row("E", k))?.status === "DRAFT");
// database policy cells (a Client Admin's own token)
{ const ca = (await signIn(dAdminEmail)).c, mine = await signIn(adminEmail);
  let r = await mine.c.from("setup_record").insert({ tenant_id: tenantId, engagement_id: E, section: "G", perspective: "AGREED", payload_json: {}, status: "DRAFT", participants: [] });
  ok("RLS: a Client Admin cannot insert the AGREED perspective", !!r.error, JSON.stringify(r.error));
  r = await mine.c.from("setup_record").insert({ tenant_id: tenantId, engagement_id: E, section: "G", perspective: "HR", payload_json: {}, status: "DRAFT", participants: [] });
  ok("RLS: a Client Admin can insert an HR draft", !r.error, JSON.stringify(r.error));
  r = await mine.c.from("setup_record").update({ status: "AGREED" }).eq("engagement_id", E).eq("section", "G").eq("perspective", "HR");
  ok("RLS: a Client Admin cannot mark a perspective AGREED", !!r.error, JSON.stringify(r.error));
  r = await mine.c.from("setup_record").update({ payload_json: { x: 1 } }).eq("engagement_id", E).eq("section", "B").eq("perspective", "AGREED").select();
  ok("RLS: a Client Admin cannot change the AGREED record of B", !!r.error || (r.data ?? []).length === 0, JSON.stringify(r.error));
  r = await ca.from("setup_record").select("setup_id").eq("engagement_id", E);
  ok("RLS: a Client Admin of another tenant sees none of these rows", !r.error && (r.data ?? []).length === 0, JSON.stringify(r.error));
  const ex = await signIn("exec.fixture@cdp-demo.example");
  r = await ex.c.from("setup_record").insert({ tenant_id: ften.tenant_id, engagement_id: F, section: "G", perspective: "EXECUTIVE", payload_json: {}, status: "DRAFT", participants: [] });
  ok("RLS: an Executive cannot write a perspective", !!r.error, JSON.stringify(r.error));
  await svc.from("setup_record").delete().eq("engagement_id", E).eq("section", "G").eq("perspective", "HR");
}

[st, j] = await adm.call("GET", `${SET}/E/comparison`);
ok("comparison: both entries captured, six fields side by side, nothing flagged yet", st === 200 && j.both_captured === true && j.fields.length === 6 && j.findings.length === 0 && j.fields.every((f) => f.kind === "text" && f.diverges === false), JSON.stringify(j));
ok("comparison: the entries are shown in their columns", j.fields[1].executive === "Lived culture note 2" && j.fields[1].hr === "HR sees conflict handled differently." && j.fields[1].agreed === "Lived culture note 2");
[st, j] = await adm.call("PUT", `${SET}/E/comparison`, { flags: { e2: true } }); ok("Client Admin cannot flag a difference (403): it is the consultant's judgement", st === 403, st);
for (const [label, flags] of [["no flags", {}], ["a field that is not in the section", { zz: true }], ["a flag that is not true or false", { e2: "yes" }], ["a list", []]]) {
  [st] = await con.call("PUT", `${SET}/E/comparison`, { flags }); ok(`flags refused: ${label} (422)`, st === 422, st);
}
[st] = await con.call("PUT", `${SET}/B/comparison`, { flags: { intent: true } }); ok("flags refused: Section B is not compared (422)", st === 422, st);
[st] = await con.call("GET", `${SET}/B/comparison`); ok("comparison of Section B refused (422)", st === 422, st);
[st, j] = await con.call("PUT", `${SET}/E/comparison`, { flags: { e2: true } });
ok("consultant flags E2 as different: a SETUP_DIVERGENCE finding for E2", st === 200 && j.fields.find((f) => f.key === "e2").diverges === true && j.findings.length === 1 && j.findings[0].type === "SETUP_DIVERGENCE" && j.findings[0].field === "e2", JSON.stringify(j?.findings));
[st, j] = await con.call("PUT", `${SET}/E/comparison`, { flags: { e2: false } }); ok("the consultant can clear the flag", j.findings.length === 0);
[st, j] = await con.call("GET", `${SET}/F/comparison`);
const f1 = j.fields.find((f) => f.key === "behaviours");
ok("comparison F1: the engine's divergence share for the tags (2 of 5 differ = 0.4) and the positions", f1.kind === "tags" && f1.share === 0.4 && f1.positions.join() === "4,5" && f1.diverges === true, JSON.stringify(f1));
ok("comparison F1: raised as a SETUP_DIVERGENCE finding with the share", j.findings.some((x) => x.field === "behaviours" && x.share === 0.4 && x.type === "SETUP_DIVERGENCE"), JSON.stringify(j.findings));
[st] = await con.call("PUT", `${SET}/F/comparison`, { flags: { behaviours: true } }); ok("flags refused for F1: tags are compared by the engine (422)", st === 422, st);
[st] = await con.call("PUT", `${SET}/F/perspectives/HR`, { payload: { ...sec.F, behaviours: five(exTags) } });
[st, j] = await con.call("GET", `${SET}/F/comparison`); ok("comparison F1: the same tags give no divergence", j.fields.find((f) => f.key === "behaviours").share === 0 && !j.findings.some((x) => x.field === "behaviours"), JSON.stringify(j.fields.find((f) => f.key === "behaviours")));
[st, j] = await con.call("GET", `${SET}/G/comparison`); ok("comparison G: only one side captured, so nothing can diverge", st === 200 && j.both_captured === false && j.fields.length === 5 && j.findings.length === 0);

// ---- Section F: the tie break needs a reason, error code SETUP_TIE_UNRESOLVED
const tie = five(["ENGAGE", "ENGAGE", "INNOVATE", "INNOVATE", "PERFORM"]);
await put("F", { payload: { ...sec.F, behaviours: tie } });
[st, j] = await agree("F"); ok("a tie with no tie break: 422 SETUP_TIE_UNRESOLVED", st === 422 && j.code === "SETUP_TIE_UNRESOLVED", `${st} ${j?.code}`);
[st, j] = await adm.call("GET", `${SET}/requirements`);
ok("requirements: the tie is shown with the orientations to choose from", j.tie.tied === true && j.tie.options.join() === "ENGAGE,INNOVATE" && j.leadership_target_orientation === null, JSON.stringify(j.tie));
await put("F", { payload: { ...sec.F, behaviours: tie, tie_break: "GOVERN", tie_break_reason: "Because." } });
[st, j] = await agree("F"); ok("a tie break outside the tied orientations: 422 SETUP_TIE_UNRESOLVED", st === 422 && j.code === "SETUP_TIE_UNRESOLVED", `${st} ${j?.code}`);
await put("F", { payload: { ...sec.F, behaviours: tie, tie_break: "ENGAGE" } });
[st, j] = await agree("F"); ok("a tie break with no recorded reason: 422 SETUP_TIE_UNRESOLVED", st === 422 && j.code === "SETUP_TIE_UNRESOLVED" && /reason/.test(j.title), `${st} ${j?.code} ${j?.title}`);
await put("F", { payload: { ...sec.F, behaviours: tie, tie_break: "ENGAGE", tie_break_reason: "   " } });
[st, j] = await agree("F"); ok("a blank reason does not count (422 SETUP_TIE_UNRESOLVED)", st === 422 && j.code === "SETUP_TIE_UNRESOLVED", `${st} ${j?.code}`);
[st, j] = await adm.call("GET", `${SET}/requirements`);
ok("requirements: before F is agreed the target is a reading of the draft and is labelled so", j.leadership_target_orientation === "ENGAGE" && j.leadership_target_basis === "DRAFT", JSON.stringify(j));
await put("F", { payload: { ...sec.F, behaviours: tie, tie_break: "ENGAGE", tie_break_reason: "People first, as the board asked." } });
[st, j] = await agree("F"); ok("a tie break with a reason: Section F agrees", st === 200, `${st} ${j?.code}`);
[st, j] = await adm.call("GET", `${SET}/requirements`);
ok("requirements: leadership target ENGAGE (the tie break), the reason shown", j.leadership_target_orientation === "ENGAGE" && j.leadership_target_basis === "AGREED" && j.tie.reason === "People first, as the board asked." && j.sections.F === "AGREED", JSON.stringify(j));
ok("requirements: derived by deriveSetup with the same C1 and C4", j.c1.length >= 1 && !!j.c4);

// F1 wording warning: the consultant may accept it, and the choice is recorded
[st, j] = await put("F", { payload: { ...sec.F, behaviours: [beh("Honest", "ENGAGE"), ...sec.F.behaviours.slice(1)] } });
ok("F1 wording: a value statement warns", st === 200 && j.warnings.some((w) => /F1 behaviour 1/.test(w)) && j.overridden.length === 0, JSON.stringify(j?.warnings));
[st, j] = await put("F", { payload: { ...sec.F, behaviours: [beh("Honest", "ENGAGE"), ...sec.F.behaviours.slice(1)], f1_overrides: ["1"] } });
ok("F1 wording: accepting the warning clears it and records the choice in the section", st === 200 && j.warnings.length === 0 && j.overridden.length === 1 && j.payload.f1_overrides.join() === "1", JSON.stringify(j));
ok("F1 wording: the override is audited", ((await svc.from("audit_log").select("action").eq("tenant_id", tenantId).like("action", "setup.f1_override:%")).data ?? []).length >= 1);
[st] = await put("F", { payload: { ...sec.F, f1_overrides: ["9"] } }); ok("F1 wording: an override for a behaviour that does not exist is refused (422)", st === 422, st);
await put("F", { payload: { ...sec.F, behaviours: tie, tie_break: "ENGAGE", tie_break_reason: "People first, as the board asked." } }); await agree("F");

// E, G and H agree; I last
await put("E"); [st] = await agree("E"); ok("E agrees after B, C and D", st === 200, st);
[st] = await agree("G"); ok("G cannot be agreed with no Executive and HR entry (409 SETUP_SEQUENCE_VIOLATION)", st === 409, st);
for (const p of ["EXECUTIVE", "HR"]) { [st] = await con.call("PUT", `${SET}/G/perspectives/${p}`, { payload: sec.G }); ok(`${p} entry for G saves`, st === 200, st); }
await put("G"); [st, j] = await agree("G"); ok("G agrees once both entries are saved", st === 200, `${st} ${j?.title}`);
[st, j] = await agree("I"); ok("Section I is agreed last: once B to G are agreed the order no longer stops it (it agrees, or is refused only for its own incomplete fields)", st === 200 || (st === 422 && /not complete/.test(j?.title ?? "")), `${st} ${j?.title}`);
await put("H"); [st] = await agree("H"); ok("H agrees", st === 200, st);
ok("every agreed section reads back in the list the engine uses", ((await svc.from("setup_record").select("section").eq("engagement_id", E).eq("perspective", "AGREED").eq("status", "AGREED")).data ?? []).length >= 7);

// ---- contradiction flags after the debrief (spec Table 16)
[st, j] = await con.call("GET", `${SET}/contradictions`); ok("contradiction flags start from Section H (all false)", st === 200 && j.h1 === false && j.h3 === false && j.h4 === false && j.from_debrief === false, JSON.stringify(j));
[st, j] = await con.call("PUT", `${SET}/contradictions`, { h1: true }); ok("flags cannot be set before reporting (409 ILLEGAL_TRANSITION)", st === 409 && j.code === "ILLEGAL_TRANSITION", `${st} ${j?.code}`);
let stateUp = await svc.from("engagement").update({ state: "SCORING" }).eq("engagement_id", E);
ok("(test set up) the throwaway engagement moves to SCORING", !stateUp.error, stateUp.error?.message);
[st, j] = await con.call("PUT", `${SET}/contradictions`, { h1: true }); ok("flags cannot be set while scoring (409)", st === 409, st);
stateUp = await svc.from("engagement").update({ state: "REPORTING" }).eq("engagement_id", E);
ok("(test set up) the throwaway engagement moves to REPORTING", !stateUp.error, stateUp.error?.message);
[st, j] = await tex.call("POST", `${SET}/C/confirm`); ok("confirm outside SETUP is refused (409 SETUP_LOCKED)", st === 409 && j.code === "SETUP_LOCKED", `${st} ${j?.code}`);
[st] = await adm.call("PUT", `${SET}/contradictions`, { h1: true }); ok("Client Admin cannot set contradiction flags (403)", st === 403, st);
for (const [label, body] of [["nothing", {}], ["a value that is not true or false", { h1: "yes" }], ["a field that has no flag", { h2: true }], ["an extra field", { h1: true, h2: true }]]) {
  [st] = await con.call("PUT", `${SET}/contradictions`, body); ok(`flags refused: ${label} (422)`, st === 422, st);
}
[st, j] = await con.call("PUT", `${SET}/contradictions`, { h1: true, h4: true });
ok("from REPORTING the consultant sets H1 and H4 (decision 18 Oct 2026, was after the debrief)", st === 200 && j.h1 === true && j.h3 === false && j.h4 === true && j.from_debrief === true && !!j.set_at && !!j.set_by, JSON.stringify(j));
[st, j] = await con.call("PUT", `${SET}/contradictions`, { h4: false }); ok("a flag can be cleared without touching the others", j.h1 === true && j.h4 === false);
ok("setting the flags is audited", ((await svc.from("audit_log").select("action").eq("tenant_id", tenantId).like("action", "setup.contradiction_flags:%")).data ?? []).length === 2);

// ---- the setup output object, before launch (live) and after (stored), V2 and the executive count in pre-flight
[st, j] = await con.call("GET", `${SET}/output`);
ok("setup output before launch is built from what is saved and says so (stored false)", st === 200 && j.stored === false && j.output.setup_version === 1 && j.output.engagement_id === E, JSON.stringify(j).slice(0, 300));
const D = `/v1/engagements/${dEng}/setup/output`;
[st, j] = await dAdm.call("GET", D); ok("draft engagement: output is live before launch", st === 200 && j.stored === false, st);
const dppl = (await svc.from("person_of_record").select("person_id, grade_id").eq("tenant_id", dTenant)).data, dgr = new Map((await svc.from("grade_band").select("grade_id, name").eq("tenant_id", dTenant)).data.map((g) => [g.grade_id, g.name]));
const dX = dppl.filter((p) => dgr.get(p.grade_id) === "Executive").map((p) => p.person_id), dN = dppl.filter((p) => dgr.get(p.grade_id) === "Staff").map((p) => p.person_id);
const failing = (r) => (r?.checks ?? []).filter((c) => !c.pass && c.blocking).map((c) => c.id);
const pre = () => con.call("POST", `/v1/assessments/${dAsm}/preflight`);
const setParts = (p) => svc.from("setup_record").update({ participants: p }).eq("engagement_id", dEng).eq("section", "D").eq("perspective", "AGREED");
await setParts([dN[0], dN[1]]); [st, j] = await pre(); ok("pre-flight: two staff person ids are not two executives (L2 blocks)", failing(j).includes("L2"), JSON.stringify(failing(j)));
await setParts([dX[0], dN[0]]); [st, j] = await pre(); ok("pre-flight: one executive id and one staff id is not enough (L2 blocks)", failing(j).includes("L2"), JSON.stringify(failing(j)));
await setParts([dX[0], dX[1]]); [st, j] = await pre(); ok("pre-flight: two executive ids pass L2", !failing(j).includes("L2"), JSON.stringify(failing(j)));
await setParts(["ceo", "chro", "cfo"]); [st, j] = await pre(); ok("pre-flight: typed names no longer count (L2 blocks)", failing(j).includes("L2"), JSON.stringify(failing(j)));
await setParts([dX[0], dX[1]]);
[st, j] = await con.call("POST", `/v1/assessments/${dAsm}/launch`); ok("launch (draft engagement)", st === 200 && j.changed === true, `${st} ${JSON.stringify(j)}`);
[st, j] = await dAdm.call("GET", D);
const out = j?.output;
ok("setup output after launch: stored, version 1, requirements derived", st === 200 && j.stored === true && out.setup_version === 1 && out.engagement_id === dEng && out.requirements.c1.length >= 1 && !!out.requirements.c4 && ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"].includes(out.requirements.leadership_target_orientation), JSON.stringify(out).slice(0, 400));
ok("setup output: executive grades, executive cohort size and survey settings (spec 1.7)", out.executive_grades.length >= 1 && out.cohorts[0].cohort_id === "coh_exec" && out.cohorts[0].predicate.is_executive === true && out.cohorts[0].projected_n >= 1
  && /^\d{4}-\d{2}-\d{2}$/.test(out.survey.window.open) && /^\d{4}-\d{2}-\d{2}$/.test(out.survey.window.close) && out.survey.languages.join() === "en" && !!out.survey.consent_text_version && !!out.survey.instrument_version && !!out.survey.rules_version, JSON.stringify(out));
const stored = (await svc.from("engagement").select("setup_snapshot, setup_version").eq("engagement_id", dEng).single()).data;
ok("the object is stored on the engagement at launch (setup_snapshot, setup_version 1)", JSON.stringify(stored.setup_snapshot) === JSON.stringify(out) && stored.setup_version === 1);
ok("what is stored does not drift: a second read returns the same object", JSON.stringify((await dAdm.call("GET", D))[1].output) === JSON.stringify(out));

// V2: once links exist, a leader with no link fails the invited respondent half
[st, j] = await con.call("POST", `/v1/assessments/${dAsm}/invitations`, { mode: "roster" }); ok("links issued for the roster", st === 201, st);
const leaders = (await svc.from("leader_assignment").select("person_id").eq("tenant_id", dTenant)).data;
const V2 = async () => ((await con.call("GET", `/v1/engagements/${dEng}/org-graph`))[1]?.defects ?? []).filter((d) => d.rule === "V2");
ok("V2: every leader has a link, so no V2 defect", (await V2()).length === 0, JSON.stringify(await V2()));
const gone = leaders[0].person_id;
await sql(`delete from public.invitation_roster where assessment_id = '${dAsm}' and person_id = '${gone}'`);
const v2 = await V2();
ok("V2: a leader who was not invited is a blocking defect (invited respondent half)", v2.length === 1 && v2[0].blocking === true && /invited respondent/.test(v2[0].message), JSON.stringify(v2));
await sql(`insert into public.invitation_roster (assessment_id, tenant_id, person_id) values ('${dAsm}', '${dTenant}', '${gone}') on conflict do nothing`);
ok("V2: the defect clears when the leader is invited", (await V2()).length === 0);

// ---- G5 system entries written back after scoring, and the contradiction flag as C3 evidence (fixture engagement)
const { data: fasm } = await svc.from("assessment").select("assessment_id").eq("engagement_id", F).eq("status", "FROZEN").maybeSingle();
if (fasm) {
  [st, j] = await con.call("POST", `/v1/assessments/${fasm.assessment_id}/evaluate`);
  const cls = (await svc.from("score_object").select("payload_json").eq("assessment_id", fasm.assessment_id).order("version", { ascending: false }).limit(1).single()).data.payload_json.classification;
  const want = Object.keys(cls).filter((o) => cls[o] === "KEEP_AND_PROTECT").sort().join();
  const g5 = (await svc.from("engagement").select("g5_system").eq("engagement_id", F).single()).data.g5_system;
  ok("G5: evaluation writes the KEEP AND PROTECT orientations back as system entries, labelled by source", (st === 200 || st === 201) && Array.isArray(g5) && g5.every((x) => x.source === "SYSTEM" && x.entry) && g5.map((x) => x.orientation).sort().join() === want, `${st} ${JSON.stringify(g5)} want ${want}`);
  const o = (await exec.call("GET", `${FS}/output`))[1].output;
  ok("G5: the setup output carries the workshop entries and the system entries side by side", Array.isArray(o.g5.workshop) && o.g5.system.length === g5.length);

  const { data: rp } = await svc.from("report").select("report_id").eq("assessment_id", fasm.assessment_id).eq("type", "ORGANISATIONAL").limit(1);
  let have = true; try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); } catch { have = false; }
  if (rp?.length && have) {
    const text = async () => { const r = await con.f(`/v1/reports/${rp[0].report_id}/export?format=pdf`); const d = mkdtempSync(join(tmpdir(), "cdp-setup-")); writeFileSync(join(d, "r.pdf"), Buffer.from(await r.arrayBuffer())); return execFileSync("pdftotext", [join(d, "r.pdf"), "-"]).toString().replace(/\s+/g, " "); };
    const before = (await svc.from("engagement").select("contradiction_flags").eq("engagement_id", F).single()).data.contradiction_flags;
    await svc.from("engagement").update({ contradiction_flags: { h1: true, h3: false, h4: true } }).eq("engagement_id", F);
    const t = await text();
    await svc.from("engagement").update({ contradiction_flags: before }).eq("engagement_id", F);
    ok("Hcf: the contradiction flags appear in the report as C3 evidence", /contradict what happens in practice/.test(t) && /performance management, reward/.test(t), "not found in the exported report");
    ok("Hcf: with no flag set the evidence sentence is absent", !/contradict what happens in practice/.test(await text()));
  } else console.log("SKIP report text checks: no ORGANISATIONAL report on the fixture or pdftotext missing");
} else console.log("SKIP G5 and report checks: no FROZEN assessment on the fixture engagement");

await sql(`delete from app.membership where user_id = '${cu.user.id}'`); await svc.auth.admin.deleteUser(cu.user.id).catch(() => {});
done();
