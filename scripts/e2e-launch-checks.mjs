// Launch slice end to end (journey 1, blocks 28, 33, 34): tenant calendar, Section I rules, cohorts, L5, L7, L8, the DRAFT staff message
// templates and the owner's approval, rater proposals and approval, the launch approval record, assessment versions after launch, the
// completion time statement, and the staff message and statement shown to respondents. Seeds its own draft client.
//   node --env-file=apps/web/.env.local scripts/e2e-launch-checks.mjs <project-ref> <token-file> [base-url]
// Needs the app running at base-url and the accounts that seed-demo.mjs fixture creates (superadmin@, admin.fixture@).
// It flips the platform wide template approval during the run and puts it back at the end.
// j1b cells: strict template gate, staff message scan, three conditions and demographics in Section I, DPIA in the engine check list, rater windows,
// peers 3 to 8 on the nomination routes, calendar and staff message edits after launch, cover colour.
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { ok, done, svc, signIn, passwords, pwOf, URL_, ANON } from "./lib/e2e.mjs";
import { seedKit } from "./lib/seed.mjs";
import { staffMessage, STAFF_TEMPLATE_VERSION } from "../apps/web/lib/staff-message.ts";

const [ref, tokenFile, base = "http://localhost:3100"] = process.argv.slice(2);
const out = execFileSync("node", ["--env-file=apps/web/.env.local", "scripts/seed-demo.mjs", ref, tokenFile, "draft"], { encoding: "utf8" });
const [, tenantId, engId, A] = /: (ten_\S+) \/ (eng_\S+) \/ (asm_\S+) DRAFT/.exec(out);
const adminEmail = Object.keys(passwords()).filter((e) => /^admin\.draft\d+@/.test(e)).at(-1);
const db = svc();
const { sql, user, writeCreds } = seedKit(ref, tokenFile);
const w = { con: await signIn("consultant@cdp-demo.example"), admin: await signIn(adminEmail), other: await signIn("admin.fixture@cdp-demo.example"), root: await signIn("superadmin@cdp-demo.example") };
const call = async (who, method, path, body, headers = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(who ? { authorization: `Bearer ${w[who].t}` } : {}), "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
};
async function page(email, path) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((x) => jar.set(x.name, x.value)) } });
  await c.auth.signInWithPassword({ email, password: pwOf(email) });
  const r = await fetch(base + path, { redirect: "manual", headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
  return [r.status, await r.text()];
}
const pre = async () => (await call("con", "POST", `/v1/assessments/${A}/preflight`, {}))[1];
const chk = (j, id) => j.checks.find((c) => c.id === id);
const failing = (j) => j.checks.filter((c) => !c.pass && c.blocking).map((c) => c.id);
const state = async () => (await call("con", "GET", `/v1/assessments/${A}/launch-state`))[1];
const iso = (d) => d.toISOString().slice(0, 10);
const addD = (d, n) => new Date(d.getTime() + n * 864e5);

// ---------------------------------------------------------------- the draft as seeded
const asm0 = (await db.from("assessment").select("window_open, window_close").eq("assessment_id", A).single()).data;
const setWin = (open, close) => db.from("assessment").update({ window_open: `${open}T00:00:00Z`, window_close: `${close}T23:59:59Z` }).eq("assessment_id", A);
const iRow = (await db.from("setup_record").select("setup_id, payload_json, workshop_date, participants").eq("engagement_id", engId).eq("section", "I").eq("perspective", "AGREED").single()).data;
const setI = (p) => db.from("setup_record").update({ payload_json: p, status: "AGREED" }).eq("setup_id", iRow.setup_id);
const base0 = iRow.payload_json;
const tmpl0 = (await db.from("platform_setting").select("value").eq("key", "staff_templates_approved").single()).data.value;
const setTmpl = (v) => db.from("platform_setting").update({ value: v }).eq("key", "staff_templates_approved");
await setTmpl({ approved_version: STAFF_TEMPLATE_VERSION });   // strict gate: a clean draft needs the owner approval, so approve for the first checks
let j = await pre();
ok("a clean draft passes pre-flight and names no failing blocking check", j.pass === true && failing(j).length === 0, JSON.stringify(failing(j)));

// ================================================================ tenant calendar: S1-01, I4a, I4c, L5
let s, r;
[s] = await call(null, "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [] });
ok("calendar: no session is refused (401)", s === 401, s);
[s] = await call("other", "GET", `/v1/engagements/${engId}/calendar`);
ok("calendar: another organisation's admin cannot read it (403)", s === 403, s);
[s, r] = await call("admin", "GET", `/v1/engagements/${engId}/calendar`);
ok("calendar: the Client Admin can read it, and nothing is pre filled", s === 200 && r.holidays.length === 0 && r.review_start === null, `${s} ${JSON.stringify(r)}`);
[s] = await call("admin", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [] });
ok("calendar: the Client Admin cannot change it (403)", s === 403, s);
ok("calendar: with no holidays pre-flight warns (HOL), and the warning does not block", chk(j, "HOL").pass === false && chk(j, "HOL").blocking === false && j.pass === true);
for (const [label, body] of [["a date that does not exist", { holidays: [{ day: "2026-02-30", label: "x" }] }], ["a holiday with no name", { holidays: [{ day: "2026-12-25", label: " " }] }],
  ["the same date twice", { holidays: [{ day: "2026-12-25", label: "a" }, { day: "2026-12-25", label: "b" }] }], ["a review period with one end", { holidays: [], review_period_start: "2026-11-01" }],
  ["a review period that ends before it starts", { holidays: [], review_period_start: "2026-11-30", review_period_end: "2026-11-01" }]]) {
  [s] = await call("con", "PUT", `/v1/engagements/${engId}/calendar`, body);
  ok(`calendar: ${label} is refused (422)`, s === 422, s);
}
const mon = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d; })();
const open = iso(mon), close = iso(addD(mon, 11)), wed = iso(addD(mon, 2));
await setWin(open, close);
j = await pre();
ok("L5: a window of exactly 10 working days passes with no holidays", chk(j, "L5").pass === true && chk(j, "L5").detail.working_days === 10, JSON.stringify(chk(j, "L5")));
let st0 = (await state()).reminders.map((x) => x.on);
[s, r] = await call("con", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [{ day: wed, label: "Test holiday" }] });
ok("calendar: the consultant saves a holiday", s === 200 && r.holidays.length === 1 && r.holidays[0].day === wed, `${s} ${JSON.stringify(r)}`);
j = await pre();
ok("I4a, L5: the holiday takes the window to 9 working days and blocks launch", chk(j, "L5").pass === false && chk(j, "L5").detail.working_days === 9 && failing(j).includes("L5"), JSON.stringify(chk(j, "L5")));
[s, r] = await call("con", "POST", `/v1/assessments/${A}/launch`, {});
ok("I4a: launch is refused with 422 PREFLIGHT_FAILED naming L5", s === 422 && r.code === "PREFLIGHT_FAILED" && r.checks.some((c) => c.id === "L5"), `${s} ${r?.code}`);
ok("HOL: the warning clears once a holiday is recorded", chk(j, "HOL").pass === true);
const st1 = (await state()).reminders.map((x) => x.on);
ok("the holiday moves the working day 3 reminder from Thursday to Friday", st0[0] === iso(addD(mon, 3)) && st1[0] === iso(addD(mon, 4)), `${st0[0]} -> ${st1[0]}`);
[s] = await call("con", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [] });
j = await pre();
ok("L5: removing the holiday restores 10 working days", s === 200 && chk(j, "L5").pass === true, JSON.stringify(chk(j, "L5")));
// performance review period (I4c)
for (const [label, a, b, overlap] of [["a review period inside the window", iso(addD(mon, 3)), iso(addD(mon, 5)), true], ["one that ends on the first day of the window", iso(addD(mon, -30)), open, true],
  ["one that starts on the last day of the window", close, iso(addD(mon, 40)), true], ["one that ends the day before the window", iso(addD(mon, -30)), iso(addD(mon, -1)), false], ["one that starts the day after the window", iso(addD(mon, 12)), iso(addD(mon, 40)), false]]) {
  await call("con", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [], review_period_start: a, review_period_end: b });
  j = await pre();
  ok(`I4c: ${label}: ${overlap ? "warns" : "no warning"}, and the warning never blocks`, chk(j, "I4").pass === !overlap && chk(j, "I4").blocking === false && (overlap ? j.pass === true : true), JSON.stringify(chk(j, "I4")));
}
await call("con", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [] });
await setWin(asm0.window_open.slice(0, 10), asm0.window_close.slice(0, 10));
await db.from("assessment").update({ window_open: asm0.window_open, window_close: asm0.window_close }).eq("assessment_id", A);

// ================================================================ I1 cohorts: S1.5.4-003
const cohortsOf = async () => (await pre()).cohorts;
await setI({ ...base0, cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES" }] });
j = await pre();
ok("I1: an executive cohort of 3 is below the floor and blocks launch", chk(j, "I1").pass === false && j.cohorts[0].size === 3 && failing(j).includes("I1"), JSON.stringify(j.cohorts));
[s, r] = await call("con", "POST", `/v1/assessments/${A}/launch`, {});
ok("I1: launch is refused (422 PREFLIGHT_FAILED naming I1)", s === 422 && r.checks.some((c) => c.id === "I1"), `${s}`);
await setI({ ...base0, cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }] });
j = await pre();
ok("I1: the same cohort marked roll up to parent passes", chk(j, "I1").pass === true && j.cohorts[0].rollup === true, JSON.stringify(j.cohorts));
await setI({ ...base0, cohorts: [{ name: "Department one", axis1: "DEPARTMENT", value1: "Department 1" }] });
ok("I1, S1.5.4-003: the projected size counts active people matching (18 in the department)", (await cohortsOf())[0].size === 18 && (await pre()).checks.find((c) => c.id === "I1").pass === true);
await setI({ ...base0, cohorts: [{ name: "Nobody", axis1: "GRADE", value1: "Nobody" }] });
ok("I1: a cohort that matches nobody has size 0 and blocks", (await cohortsOf())[0].size === 0 && chk(await pre(), "I1").pass === false);
await setI({ ...base0, cohorts: [{ name: "Exec in dept", axis1: "DEPARTMENT", value1: "Department 1", axis2: "EXECUTIVE", value2: "YES" }] });
ok("I1: two conditions are both applied (3 executives in the department)", (await cohortsOf())[0].size === 3);
await setI({ ...base0, cohorts: undefined });
ok("I1: no cohorts blocks launch", chk(await pre(), "I1").pass === false);
await setI(base0);
ok("I1: the seeded section passes again", chk(await pre(), "I1").pass === true);

// ================================================================ Section I through the API: I1 to I6, reminder plan
const putI = (payload) => call("con", "PUT", `/v1/engagements/${engId}/setup/I`, { payload, workshop_date: iRow.workshop_date, participants: iRow.participants });
const agreeI = () => call("con", "POST", `/v1/engagements/${engId}/setup/I/agree`, {});
const good = { cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }], anonymity: "FULL", languages: ["en"], staff_message: "Why we are doing this.", staff_message_checked: true,
  qualitative: "NONE", completion_estimate: "35–45 minutes", reminder_plan: "STANDARD" };
[s, r] = await putI({ ...good, cohorts: undefined });
ok("I1: saved as a draft without cohorts, with the gap listed", s === 200 && r.missing.some((m) => m.includes("I1 Cohorts")), `${s}`);
[s, r] = await agreeI();
ok("I1: Section I cannot be agreed without cohorts (422)", s === 422 && r.errors.some((m) => m.includes("I1 Cohorts")), `${s} ${r?.title}`);
for (const [label, p, text] of [["an Executive cohort value that is not YES or NO", { ...good, cohorts: [{ name: "A", axis1: "EXECUTIVE", value1: "maybe" }] }, "YES or NO"],
  ["two conditions on one axis", { ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis2: "GRADE", value2: "y" }] }, "different axes"], ["the same cohort name twice", { ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x" }, { name: "a", axis1: "GRADE", value1: "y" }] }, "different name"],
  ["an anonymity value outside the two", { ...good, anonymity: "NONE" }, "listed values"], ["interviews counted with no complement", { ...good, interviews_planned: 4 }, "remove the counts"],
  ["a custom reminder under the standard plan", { ...good, reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }] }, "remove the custom"], ["an unknown reminder plan", { ...good, reminder_plan: "WEEKLY" }, "listed values"]]) {
  [s, r] = await putI(p);
  ok(`I1 to I6: ${label} is refused on save (422)`, s === 422 && JSON.stringify(r.errors ?? r.title).includes(text), `${s} ${JSON.stringify(r?.errors)}`);
}
await putI({ ...good, staff_message_checked: false });
[s, r] = await agreeI();
ok("I5: agreeing needs the confirmation that the message states the four things (422)", s === 422 && r.errors.some((m) => m.includes("confirm that it states")), `${s}`);
await putI({ ...good, qualitative: "INTERVIEWS" });
[s, r] = await agreeI();
ok("I6: interviews chosen with no count cannot be agreed (422)", s === 422 && r.errors.some((m) => m.includes("number of interviews")), `${s}`);
await putI({ ...good, reminder_plan: "CUSTOM", reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }] });
[s, r] = await agreeI();
ok("reminder plan: a custom plan without the consultant's approval cannot be agreed (422)", s === 422 && r.errors.some((m) => m.includes("approval")), `${s}`);
await putI({ ...good, qualitative: "BOTH", interviews_planned: 3, focus_groups_planned: 1, reminder_plan: "CUSTOM", reminder_custom_approved: true,
  reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }, { kind: "HOURS_BEFORE_CLOSE", n: 48, audience: "STARTED_NOT_SUBMITTED" }] });
[s, r] = await agreeI();
ok("reminder plan and I6: an approved custom plan and counts below the recommendation are agreed", s === 200 && r.status === "AGREED", `${s} ${r?.title}`);
let ls = await state();
ok("I6: counts below the recommended minimum give hints, not errors", ls.section_i.hints.length === 2 && ls.section_i.hints[0].includes("recommended minimum is 8"), JSON.stringify(ls.section_i.hints));
ok("reminders scheduled: the custom plan shows its two dates, inside the window", ls.reminders.length === 2 && ls.reminders.every((x) => !x.outside_window), JSON.stringify(ls.reminders));
await putI({ ...good, reminder_plan: "STANDARD" }); await agreeI();
// j1b: three or more conditions, and demographic attributes declared inside Section I
[s] = await putI({ ...good, cohorts: [{ name: "Three", axis1: "GRADE", value1: "x", axis2: "DEPARTMENT", value2: "y", axis3: "TENURE_BAND", value3: "Under 1 year", rollup_to_parent: true }] });
ok("I1: a cohort with three conditions saves", s === 200, s);
[s, r] = await putI({ ...good, cohorts: [{ name: "Three", axis1: "GRADE", value1: "x", axis2: "DEPARTMENT", value2: "y", axis3: "GRADE", value3: "z" }] });
ok("I1: a repeated axis among three conditions is refused (422)", s === 422 && JSON.stringify(r.errors).includes("different axes"), `${s}`);
const dem = { name: "Gender", values: "Female; Male", is_sensitive: true, analytical_purpose: "Compare engagement across gender groups" };
[s, r] = await putI({ ...good, demographics: [{ ...dem, values: "Female" }] });
ok("I1: a demographic attribute with one value is refused (422)", s === 422 && JSON.stringify(r.errors).includes("2 to 30 values"), `${s}`);
[s, r] = await putI({ ...good, demographics: [{ ...dem, analytical_purpose: "short" }] });
ok("I1: a demographic attribute without a stated purpose is refused (422)", s === 422 && JSON.stringify(r.errors).includes("why the attribute is needed"), `${s}`);
ok("I1: nothing is written to the organisation's list before Section I is agreed", ((await db.from("demographic_attribute").select("attr_id").eq("tenant_id", tenantId)).data ?? []).length === 0);
await putI({ ...good, demographics: [dem], cohorts: [{ name: "Women", axis1: "DEMOGRAPHIC", value1: "Gender=Female", axis2: "EXECUTIVE", value2: "NO", axis3: "GRADE", value3: "Staff", rollup_to_parent: true }] });
[s, r] = await agreeI();
let attrs = (await db.from("demographic_attribute").select("name, values_list, is_sensitive, analytical_purpose").eq("tenant_id", tenantId)).data;
ok("I1: agreeing Section I writes the declared attribute to demographic_attribute (sensitive adds Prefer not to say)", s === 200 && attrs.length === 1 && attrs[0].name === "Gender" && attrs[0].is_sensitive === true
  && attrs[0].values_list.includes("Prefer not to say") && attrs[0].values_list.includes("Female") && attrs[0].analytical_purpose.startsWith("Compare"), `${s} ${JSON.stringify(attrs)} ${r?.title}`);
await putI({ ...good, demographics: [{ ...dem, values: "Female; Male; Other" }] }); await agreeI();
attrs = (await db.from("demographic_attribute").select("name, values_list").eq("tenant_id", tenantId)).data;
ok("I1: agreeing again updates the same attribute and does not add a second", attrs.length === 1 && attrs[0].values_list.includes("Other"), JSON.stringify(attrs));
await putI({ ...good, reminder_plan: "STANDARD" }); await agreeI();
ls = await state();
ok("reminders scheduled: the standard plan shows day 3, day 6, 24 hours before close and the final reminder", ls.reminders.length === 4 && ls.reminders.some((x) => x.kind === "Final reminder" && x.audience === "STARTED_NOT_SUBMITTED"), JSON.stringify(ls.reminders));
[s] = await call("admin", "GET", `/v1/assessments/${A}/launch-state`); ok("launch state: the Client Admin cannot read it (403)", s === 403, s);
[s] = await call(null, "GET", `/v1/assessments/${A}/launch-state`); ok("launch state: no session (401)", s === 401, s);
await setI(base0);

// ================================================================ I2, I5 staff message templates and the owner's approval
const { data: ten } = await db.from("tenant").select("name, legal_name").eq("tenant_id", tenantId).single();
const { data: eng } = await db.from("engagement").select("purpose").eq("engagement_id", engId).single();
const ctx = { org: ten.legal_name ?? ten.name, purpose: eng.purpose };
ls = await state();
ok("I2: the two drafts differ and match the shared wording", ls.template.drafts.FULL === staffMessage("FULL", ctx) && ls.template.drafts.CONFIDENTIAL_AGGREGATE === staffMessage("CONFIDENTIAL_AGGREGATE", ctx) && ls.template.drafts.FULL !== ls.template.drafts.CONFIDENTIAL_AGGREGATE);
await setTmpl({ approved_version: null });
ls = await state();
ok("the templates start unapproved", ls.template.approved === false);
await setI({ ...base0, anonymity: "FULL", staff_message: staffMessage("FULL", ctx), staff_message_checked: true });
j = await pre();
ok("I5: a template message with no owner approval blocks launch", chk(j, "I5").pass === false && chk(j, "I5").detail.template === "FULL" && failing(j).includes("I5"), JSON.stringify(chk(j, "I5")));
[s, r] = await call("con", "POST", `/v1/assessments/${A}/launch`, {});
ok("I5: launch is refused (422 PREFLIGHT_FAILED naming I5)", s === 422 && r.checks.some((c) => c.id === "I5"), `${s}`);
[s] = await call("con", "PUT", "/v1/platform/staff-templates", { approved: true }); ok("approval: the consultant cannot approve the templates (403)", s === 403, s);
[s] = await call("admin", "PUT", "/v1/platform/staff-templates", { approved: true }); ok("approval: a Client Admin cannot approve them (403)", s === 403, s);
[s] = await call(null, "PUT", "/v1/platform/staff-templates", { approved: true }); ok("approval: no session (401)", s === 401, s);
[s] = await call("root", "PUT", "/v1/platform/staff-templates", { approved: "yes" }); ok("approval: a value that is not true or false is refused (422)", s === 422, s);
[s, r] = await call("root", "PUT", "/v1/platform/staff-templates", { approved: true });
ok("approval: the Super Admin approves", s === 200 && r.approved === true, `${s} ${JSON.stringify(r)}`);
[s, r] = await call("con", "GET", "/v1/platform/staff-templates"); ok("approval: the consultant can read the status", s === 200 && r.approved === true, `${s}`);
ok("I5: with the approval a template message passes", chk(await pre(), "I5").pass === true);
await setI({ ...base0, anonymity: "CONFIDENTIAL_AGGREGATE", staff_message: staffMessage("FULL", ctx), staff_message_checked: true });
j = await pre();
ok("I2: a message that states a different anonymity commitment than I2 blocks even when approved", chk(j, "I5").pass === false && chk(j, "I5").detail.matches_i2 === false, JSON.stringify(chk(j, "I5")));
await setI({ ...base0, anonymity: "CONFIDENTIAL_AGGREGATE", staff_message: staffMessage("CONFIDENTIAL_AGGREGATE", ctx), staff_message_checked: true });
ok("I2: the matching wording passes", chk(await pre(), "I5").pass === true);
await call("root", "PUT", "/v1/platform/staff-templates", { approved: false });
ok("approval: withdrawing it blocks a template message again", chk(await pre(), "I5").pass === false);
await setI({ ...base0, anonymity: "FULL", staff_message: staffMessage("FULL", ctx) + " Please reply to HR with questions.", staff_message_checked: true });
ok("I5 strict gate: a message the consultant edited is held too, until the owner approves both templates", chk(await pre(), "I5").pass === false && chk(await pre(), "I5").detail.template === null && chk(await pre(), "I5").detail.approved === false);
await setI({ ...base0, staff_message: "Hello.", staff_message_checked: true });
j = await pre();
ok("I5 scan: a message that leaves out the four things warns (I5W), and the warning does not block", chk(j, "I5W").pass === false && chk(j, "I5W").blocking === false && chk(j, "I5W").detail.missing.length === 4 && !failing(j).includes("I5W"), JSON.stringify(chk(j, "I5W")));
await setI({ ...base0, anonymity: "FULL", staff_message: staffMessage("FULL", ctx), staff_message_checked: true });
ok("I5 scan: the template wording passes the scan", chk(await pre(), "I5W").pass === true);
ok("DPIA: the check is part of the engine list and passes for the seeded organisation", chk(await pre(), "DPIA").pass === true && chk(await pre(), "DPIA").blocking === true);
await db.from("tenant").update({ dpia_recorded_at: null }).eq("tenant_id", tenantId);
j = await pre();
ok("DPIA: without a recorded impact assessment the check fails and blocks launch", chk(j, "DPIA").pass === false && failing(j).includes("DPIA") && j.pass === false, JSON.stringify(chk(j, "DPIA")));
await db.from("tenant").update({ dpia_recorded_at: new Date().toISOString() }).eq("tenant_id", tenantId);
[s, r] = await call("root", "PUT", "/v1/platform/staff-templates", { approved: true });
await setI({ ...base0, anonymity: "FULL", staff_message: staffMessage("FULL", ctx) + " Please reply to HR with questions.", staff_message_checked: true });
ok("I5 strict gate: with both templates approved an edited message passes", chk(await pre(), "I5").pass === true);
// use the template through the panel's own path (Section I save), and the wording lands in Section I
[s, r] = await putI({ ...good, anonymity: "CONFIDENTIAL_AGGREGATE", staff_message: ls.template.drafts.CONFIDENTIAL_AGGREGATE });
ok("I5: the template text fits Section I (3000 characters) and saves", s === 200 && ls.template.drafts.CONFIDENTIAL_AGGREGATE.length < 3000, `${s}`);
await setI(base0);

// ================================================================ L7 difference report
const people = (await db.from("person_of_record").select("person_id, employee_ref, email, unit_id").eq("tenant_id", tenantId).eq("employment_status", "ACTIVE")).data;
j = await pre();
ok("L7: the invitation list matches the active people (no difference)", chk(j, "L7").pass === true && j.l7.count === 0 && j.l7.active === people.length, JSON.stringify(j.l7));
const victim = people.find((p) => p.unit_id);
await sql(`update public.person_of_record set email = 'not-an-email' where person_id = '${victim.person_id}'`);   // service role has no UPDATE grant on this table
j = await pre();
ok("L7: an active person with no usable email is a difference, reported by employee reference, and it only warns", chk(j, "L7").pass === false && chk(j, "L7").blocking === false && j.l7.missing_email.includes(victim.employee_ref) && !failing(j).includes("L7"), JSON.stringify(j.l7));
await sql(`update public.person_of_record set email = '${victim.email.replace(/'/g, "''")}' where person_id = '${victim.person_id}'`);
ok("L7: fixing it clears the difference", chk(await pre(), "L7").pass === true);

// ================================================================ L8 and rater proposals: S1.4.6-002, S1-11, L8
const leaders = (await db.from("leader_assignment").select("assignment_id, person_id, team_id").eq("tenant_id", tenantId).order("assignment_id")).data;
const [L1, L2, L3] = leaders;
const others = (L) => people.filter((p) => p.person_id !== L.person_id && p.unit_id !== L.team_id);
const peers = (L, n = 3) => others(L).slice(0, n).map((p) => ({ person_id: p.person_id, rater_group: "PEER" }));
const nomRows = async (L) => (await db.from("rater_nomination").select("rater_person_id, rater_group, status, proposed_by, approved_by, approved_at").eq("assessment_id", A).eq("assignment_id", L.assignment_id)).data;
const P = (who, L, raters) => call(who, "PUT", `/v1/assessments/${A}/l360/proposals`, { assignment_id: L.assignment_id, raters });
const D = (who, L, decision) => call(who, "POST", `/v1/assessments/${A}/l360/proposals`, { assignment_id: L.assignment_id, decision });
j = await pre();
ok("L8: leaders are in scope and none has raters yet, so L8 warns (and does not block)", chk(j, "L8").pass === false && chk(j, "L8").blocking === false && j.l8.inScope === true && j.l8.leaders.length === 3 && j.l8.leaders.every((l) => !l.ok) && j.pass === true, JSON.stringify(j.l8));
[s] = await P(null, L1, peers(L1)); ok("proposals: no session (401)", s === 401, s);
[s] = await P("other", L1, peers(L1)); ok("proposals: another organisation's admin cannot propose (403)", s === 403, s);
[s] = await P("con", L1, [{ person_id: others(L1)[0].person_id, rater_group: "BOSS" }]); ok("proposals: an unknown relationship is refused (422)", s === 422, s);
[s] = await P("con", L1, [{ person_id: L1.person_id, rater_group: "PEER" }]); ok("proposals: a leader cannot be their own rater (422)", s === 422, s);
[s] = await P("con", L1, peers(L1, 9)); ok("proposals: more than 8 peers is refused (422)", s === 422, s);
[s, r] = await P("con", L1, peers(L1));
ok("proposals: the consultant proposes on a leader's behalf, and the rows wait as PROPOSED", s === 200 && r.proposed === 3 && (await nomRows(L1)).every((n) => n.status === "PROPOSED" && n.proposed_by.startsWith("user:") && n.approved_by === null), `${s} ${JSON.stringify(r)}`);
j = await pre();
ok("L8: proposals waiting for approval keep L8 at warning", j.l8.leaders.find((l) => l.assignment_id === L1.assignment_id).reasons.some((m) => m.includes("waiting for approval")), JSON.stringify(j.l8.leaders[0]));
[s] = await D("con", L1, "APPROVE"); ok("approval: the consultant cannot approve (403)", s === 403, s);
[s] = await D("other", L1, "APPROVE"); ok("approval: another organisation's admin cannot approve (403)", s === 403, s);
[s] = await D("admin", L1, "MAYBE"); ok("approval: a decision other than APPROVE or REJECT is refused (422)", s === 422, s);
await P("admin", L1, peers(L1, 2));
[s, r] = await D("admin", L1, "APPROVE");
ok("approval: fewer than 3 peers cannot be approved (422)", s === 422 && (await nomRows(L1)).every((n) => n.status === "PROPOSED"), `${s}`);
[s, r] = await P("admin", L1, peers(L1));
ok("proposals: the Client Admin proposes on the leader's behalf", s === 200 && r.proposed === 3, `${s}`);
[s, r] = await D("admin", L1, "APPROVE");
const rowsL1 = await nomRows(L1);
ok("approval: the Client Admin approves; rows become NOMINATED with the approver and time recorded", s === 200 && r.approved === true && rowsL1.length === 3 && rowsL1.every((n) => n.status === "NOMINATED" && n.approved_by && n.approved_at), `${s} ${JSON.stringify(rowsL1)}`);
[s] = await D("admin", L1, "APPROVE"); ok("approval: nothing waiting gives 422", s === 422, s);
j = await pre();
ok("L8: a leader with approved raters (3 peers) is complete", j.l8.leaders.find((l) => l.assignment_id === L1.assignment_id).ok === true && chk(j, "L8").pass === false, JSON.stringify(j.l8.leaders[0]));
await P("admin", L2, peers(L2));
[s, r] = await D("admin", L2, "REJECT");
ok("approval: the Client Admin sends a proposal back and the waiting rows are removed", s === 200 && r.approved === false && (await nomRows(L2)).length === 0, `${s} ${JSON.stringify(r)}`);

// a People Leader login for the leader, and one for the line manager (L2 is moved under L1's team for this test)
const tag = Date.now().toString(36);
const pl1Email = `pl1.${tag}@cdp-demo.example`, pl2Email = `pl2.${tag}@cdp-demo.example`;
const pl1 = await user(pl1Email, "People Leader"), pl2 = await user(pl2Email, "People Leader");
for (const [id, L] of [[pl1, L1], [pl2, L2]]) await sql(`insert into app.membership (user_id, tenant_id, role, is_people_lead, person_id) values ('${id}', '${tenantId}', 'PEOPLE_LEADER', true, '${L.person_id}') on conflict (user_id) do update set tenant_id = excluded.tenant_id, person_id = excluded.person_id`);
await sql("insert into app.user_profile (user_id, full_name) select id, split_part(email, '@', 1) from auth.users where email like '%@cdp-demo.example' on conflict do nothing");
writeCreds();
w.pl1 = await signIn(pl1Email); w.pl2 = await signIn(pl2Email);
const l2Unit = (await db.from("person_of_record").select("unit_id").eq("person_id", L2.person_id).single()).data.unit_id;
await sql(`update public.person_of_record set unit_id = '${L1.team_id}' where person_id = '${L2.person_id}'`);
[s, r] = await P("pl2", L2, peers(L2));
const rowsL2 = await nomRows(L2);
ok("proposals: a leader proposes for themselves, recorded under their own person", s === 200 && rowsL2.length === 3 && rowsL2.every((n) => n.proposed_by === L2.person_id && n.status === "PROPOSED"), `${s} ${JSON.stringify(rowsL2[0])}`);
[s] = await P("pl2", L1, peers(L1)); ok("proposals: a leader cannot propose for another leader (403)", s === 403, s);
[s] = await P("pl1", L2, peers(L2)); ok("proposals: a leader cannot propose for a leader they only manage (403)", s === 403, s);
[s] = await D("pl2", L2, "APPROVE"); ok("approval: the leader cannot approve their own proposal (403)", s === 403, s);
[s] = await D("pl1", L3, "APPROVE"); ok("approval: a leader who is not the line manager cannot approve (403)", s === 403, s);
[s, r] = await D("pl1", L2, "APPROVE");
ok("approval: the line manager approves", s === 200 && r.approved === true && (await nomRows(L2)).every((n) => n.status === "NOMINATED" && n.approved_by), `${s} ${JSON.stringify(r)}`);
[s, r] = await P("pl1", L1, [{ person_id: others(L1)[3].person_id, rater_group: "OTHER" }]);
ok("proposals: a leader proposes more raters for themselves", s === 200 && r.proposed === 1, `${s}`);
[s] = await D("pl1", L1, "APPROVE"); ok("approval: a leader with no line manager cannot approve their own proposal (403)", s === 403, s);
[s, r] = await D("admin", L1, "APPROVE"); ok("approval: the Client Admin approves on the line manager's behalf", s === 200, `${s} ${JSON.stringify(r)}`);
await sql(`update public.person_of_record set unit_id = '${l2Unit}' where person_id = '${L2.person_id}'`);
await P("admin", L3, peers(L3)); await D("admin", L3, "APPROVE");
j = await pre();
ok("L8: every leader has approved raters, so L8 passes and the pre-flight has no warning left on 360", chk(j, "L8").pass === true && j.l8.leaders.every((l) => l.ok), JSON.stringify(j.l8));
// j1b: peers 3 to 8 on the older consultant nominate route as well
const NOM = (who, L, raters) => call(who, "PUT", `/v1/assessments/${A}/l360/nominations`, { assignment_id: L.assignment_id, raters });
[s] = await NOM("con", L3, peers(L3, 2)); ok("nominations: two peers are refused (422)", s === 422, s);
[s] = await NOM("con", L3, peers(L3, 9)); ok("nominations: nine peers are refused (422)", s === 422, s);
[s] = await NOM("con", L3, [{ person_id: others(L3)[0].person_id, rater_group: "SUPERIOR" }]); ok("nominations: no peers at all is refused when raters are listed (422)", s === 422, s);
[s] = await NOM("con", L3, peers(L3, 3)); ok("nominations: three peers are accepted", s === 200, s);
[s] = await NOM("admin", L3, peers(L3, 8)); ok("nominations: eight peers are accepted", s === 200, s);
await NOM("admin", L3, peers(L3, 3));
[s] = await P("con", L3, peers(L3, 9)); ok("proposals: nine peers are refused on the proposal route as well (422)", s === 422, s);

// j1b: rater window per leader (own table rater_window), validated inside the assessment window
// the seeded draft closes within the hour, so a window that opens tomorrow would sit outside it: give the window ten more days (open date unchanged)
const aw0 = asm0.window_open.slice(0, 10), aw1 = iso(addD(new Date(), 10));
await db.from("assessment").update({ window_close: `${aw1}T23:59:59Z` }).eq("assessment_id", A);
const RW = (who, L, body) => call(who, "PUT", `/v1/assessments/${A}/l360/windows`, { assignment_id: L.assignment_id, ...body });
[s] = await RW(null, L1, { opens_on: aw0, closes_on: aw1 }); ok("rater window: no session (401)", s === 401, s);
[s] = await RW("other", L1, { opens_on: aw0, closes_on: aw1 }); ok("rater window: another organisation's admin cannot set it (403)", s === 403, s);
[s] = await RW("pl1", L1, { opens_on: aw0, closes_on: aw1 }); ok("rater window: a People Leader cannot set it (403)", s === 403, s);
[s] = await RW("con", L1, { opens_on: iso(addD(new Date(aw0 + "T00:00:00Z"), -1)), closes_on: aw1 }); ok("rater window: opening before the assessment window is refused (422)", s === 422, s);
[s] = await RW("con", L1, { opens_on: aw0, closes_on: iso(addD(new Date(aw1 + "T00:00:00Z"), 1)) }); ok("rater window: closing after the assessment window is refused (422)", s === 422, s);
[s] = await RW("con", L1, { opens_on: aw1, closes_on: aw0 }); ok("rater window: closing before opening is refused (422)", s === 422, s);
[s] = await RW("con", L1, { opens_on: "2026-02-30", closes_on: aw1 }); ok("rater window: a fake date is refused (422)", s === 422, s);
[s] = await call("con", "PUT", `/v1/assessments/${A}/l360/windows`, { assignment_id: "lea_nobody", opens_on: aw0, closes_on: aw1 }); ok("rater window: an unknown leader is refused (422)", s === 422, s);
const tomorrow = iso(addD(new Date(), 1)), today0 = iso(new Date());
[s] = await RW("con", L1, { opens_on: tomorrow, closes_on: aw1 }); ok("rater window: the consultant sets a window that opens tomorrow (L1)", s === 200, s);
[s, r] = await RW("admin", L2, { opens_on: aw0, closes_on: aw1 }); ok("rater window: the Client Admin sets one (L2)", s === 200 && r.closes_on === aw1, `${s}`);
ok("rater window: both are stored with their audit entries", (await db.from("rater_window").select("assignment_id").eq("assessment_id", A)).data.length >= 1 && (await db.from("audit_log").select("action").eq("object_id", L2.assignment_id).like("action", "l360.rater_window_set%")).data.length === 1);
[s, r] = await call("con", "GET", `/v1/assessments/${A}/l360/windows`); ok("rater window: the consultant reads the windows", s === 200 && r.some((x) => x.assignment_id === L2.assignment_id), `${s}`);
[s, r] = await call("other", "GET", `/v1/assessments/${A}/l360/windows`); ok("rater window: another organisation reads none (RLS)", s === 200 && r.length === 0, `${s}`);
let st;
[st] = await page(adminEmail, `/engagements/${engId}/raters`); ok("the rater page opens for the Client Admin", st === 200, st);
[st] = await page("consultant@cdp-demo.example", `/engagements/${engId}/raters`); ok("the rater page opens for the consultant", st === 200, st);
[st] = await page(pl1Email, `/engagements/${engId}/raters`); ok("the rater page opens for a People Leader", st === 200, st);
[st] = await page("admin.fixture@cdp-demo.example", `/engagements/${engId}/raters`); ok("the rater page does not open for another organisation's admin (redirect)", [302, 303, 307].includes(st), st);

// ================================================================ launch approval record (the one switch stays off)
j = await pre();
ok("the pre-flight now passes with every warning cleared except none blocking", j.pass === true && failing(j).length === 0, JSON.stringify(failing(j)));
[s] = await call(null, "POST", `/v1/assessments/${A}/approve-launch`, {}); ok("launch approval: no session (401)", s === 401, s);
[s] = await call("admin", "POST", `/v1/assessments/${A}/approve-launch`, {}); ok("launch approval: the Client Admin cannot record it (403)", s === 403, s);
await db.from("setup_record").update({ status: "DRAFT" }).eq("engagement_id", engId).eq("section", "C");
[s, r] = await call("con", "POST", `/v1/assessments/${A}/approve-launch`, {});
ok("launch approval: refused while pre-flight fails (422)", s === 422 && r.code === "PREFLIGHT_FAILED", `${s}`);
await db.from("setup_record").update({ status: "AGREED" }).eq("engagement_id", engId).eq("section", "C");
[s, r] = await call("con", "POST", `/v1/assessments/${A}/approve-launch`, {});
const e1 = (await db.from("engagement").select("launch_approved_by, launch_approved_at").eq("engagement_id", engId).single()).data;
ok("launch approval: the consultant records it on the engagement, audited", s === 200 && !!e1.launch_approved_by && !!e1.launch_approved_at && (await db.from("audit_log").select("action").eq("object_id", A).eq("action", "assessment.launch_approved")).data.length === 1, `${s}`);
ok("launch approval: the launch state shows it, and says launch does not need it for now", (await state()).approval.approved_by === e1.launch_approved_by && (await state()).approval.needed === false);

// ================================================================ launch, then assessment versions (S1.6.2-lock, AC-1.6)
await setI({ ...base0, staff_message: "Welcome to the survey. This is the staff message.", staff_message_checked: true, completion_estimate: "35–45 minutes" });
[s, r] = await call("con", "POST", `/v1/assessments/${A}/launch`, {});
ok("launch by the consultant alone works (no second approver needed for now)", s === 200 && r.changed === true && r.sections_locked === 9, `${s} ${JSON.stringify(r)}`);
[s] = await call("admin", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [] }); ok("calendar after launch: the Client Admin still cannot change it (403)", s === 403, s);
[s, r] = await call("con", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [{ day: iso(addD(new Date(), 30)), label: "Added after launch" }], review_period_start: iso(addD(new Date(), 60)), review_period_end: iso(addD(new Date(), 70)) });
ok("calendar after launch: the consultant can edit holidays and the review period (text only)", s === 200 && r.holidays.length === 1 && !!r.review_start, `${s} ${r?.title}`);
ok("calendar after launch: the edit is audited as calendar.edited_after_launch", (await db.from("audit_log").select("action").eq("object_id", tenantId).like("action", "calendar.edited_after_launch%")).data.length === 1);
ok("calendar after launch: the survey window and the launched setup are untouched", (await db.from("assessment").select("window_open").eq("assessment_id", A).single()).data.window_open === asm0.window_open && (await db.from("setup_record").select("locked_at").eq("engagement_id", engId)).data.every((x) => x.locked_at));
await call("con", "PUT", `/v1/engagements/${engId}/calendar`, { holidays: [] });
// staff message wording after launch
const SM = (who, text) => call(who, "PUT", `/v1/assessments/${A}/staff-message`, { text });
[s] = await SM(null, "x"); ok("staff message after launch: no session (401)", s === 401, s);
[s] = await SM("admin", "New wording."); ok("staff message after launch: the Client Admin cannot (403)", s === 403, s);
[s] = await SM("other", "New wording."); ok("staff message after launch: another organisation's admin cannot (403)", s === 403, s);
[s] = await SM("con", "   "); ok("staff message after launch: an empty message is refused (422)", s === 422, s);
[s] = await SM("con", "x".repeat(3001)); ok("staff message after launch: over 3000 characters is refused (422)", s === 422, s);
[s, r] = await SM("con", "Updated wording for staff. Please take part.");
ok("staff message after launch: the consultant saves the wording, with the scan warnings (never a block)", s === 200 && r.warnings.length === 4, `${s} ${JSON.stringify(r)}`);
ok("staff message after launch: audited, and the locked Section I text is unchanged", (await db.from("audit_log").select("action").eq("object_id", A).like("action", "assessment.staff_message_edited%")).data.length === 1
  && (await db.from("setup_record").select("payload_json, locked_at").eq("engagement_id", engId).eq("section", "I").single()).data.payload_json.staff_message === "Welcome to the survey. This is the staff message.");
const { data: tokx } = await db.rpc("rpc_issue_invitations", { p_assessment_id: A, p_count: 1 });
ok("staff message after launch: respondents see the new wording", (await (await fetch(`${base}/v1/survey`, { headers: { "x-survey-token": tokx[0] } })).json()).message === "Updated wording for staff. Please take part.");
await db.from("assessment").update({ staff_message_text: null }).eq("assessment_id", A);
// 360 links honour the rater window: L1 opens tomorrow (held back), L2 is inside its window (expires at its close), L3 has none
[s, r] = await call("con", "POST", `/v1/assessments/${A}/l360/invitations`, {});
const exp = async (L) => (await sql(`select distinct expires_at::text e from capture.invitation_360 where assessment_id = '${A}' and assignment_id = '${L.assignment_id}' and kind = 'RATER'`));
ok("rater window: links are issued only for raters inside their window (L1 held back)", s === 201 && r.skipped >= 1 && r.issued >= 6, `${s} ${JSON.stringify({ issued: r?.issued, skipped: r?.skipped })}`);
ok("rater window: L1 raters got no link", (await exp(L1)).length === 0, JSON.stringify(await exp(L1)));
const e2x = await exp(L2), e3x = await exp(L3);
ok("rater window: L2 links expire at the end of the closing day (a late answer gets the neutral 410), L3 links keep the assessment close", e2x.length === 1 && e2x[0].e.startsWith(`${aw1} 23:59:59`) && e3x.length === 1, JSON.stringify([e2x, e3x]));
[s] = await call("con", "PUT", `/v1/engagements/${engId}/setup/B`, { payload: {}, workshop_date: null, participants: [] }); ok("lock: a launched setup cannot be edited directly (409)", s === 409, s);
ls = await state();
ok("launch state: the first version has no predecessor", ls.assessment.status === "LAUNCHED" && ls.assessment.supersedes === null && ls.assessment.setup_version === 1);
const { data: toks } = await db.rpc("rpc_issue_invitations", { p_assessment_id: A, p_count: 2 });
const survey = (t) => fetch(`${base}/v1/survey`, { headers: { "x-survey-token": t } });
const sv0 = await (await survey(toks[0])).json();
ok("I5, CE: a link issued after launch opens with the staff message and the completion statement from Section I", sv0.message === "Welcome to the survey. This is the staff message." && sv0.estimate === "35–45 minutes", JSON.stringify([sv0.message, sv0.estimate]));
[s] = await call("admin", "POST", `/v1/assessments/${A}/new-version`, { reason: "Business model changed" }); ok("new version: the Client Admin cannot (403)", s === 403, s);
[s] = await call(null, "POST", `/v1/assessments/${A}/new-version`, { reason: "Business model changed" }); ok("new version: no session (401)", s === 401, s);
[s] = await call("con", "POST", `/v1/assessments/${A}/new-version`, { reason: "  " }); ok("new version: a reason is required (422)", s === 422, s);
const nomBefore = (await db.from("rater_nomination").select("nomination_id").eq("assessment_id", A)).data.length;
[s, r] = await call("con", "POST", `/v1/assessments/${A}/new-version`, { reason: "Business model changed after the board meeting" });
const A2 = r?.assessment_id;
ok("new version: the consultant creates it with a reason (201)", s === 201 && !!A2 && r.supersedes === A, `${s} ${JSON.stringify(r)}`);
const [oldA, newA] = await Promise.all([db.from("assessment").select("status").eq("assessment_id", A).single(), db.from("assessment").select("status, supersedes_assessment_id, version_reason, consent_text_id").eq("assessment_id", A2).single()]);
ok("new version: the launched assessment is SUPERSEDED, the new one is a DRAFT carrying the reason and the consent text", oldA.data.status === "SUPERSEDED" && newA.data.status === "DRAFT" && newA.data.supersedes_assessment_id === A && newA.data.version_reason.includes("board meeting") && !!newA.data.consent_text_id, JSON.stringify([oldA.data, newA.data]));
const e2 = (await db.from("engagement").select("state, setup_version, launch_approved_by").eq("engagement_id", engId).single()).data;
ok("new version: the engagement is back in SETUP, the setup version rose, the launch approval is cleared", e2.state === "SETUP" && e2.setup_version === 2 && e2.launch_approved_by === null, JSON.stringify(e2));
const recs = (await db.from("setup_record").select("locked_at, status").eq("engagement_id", engId)).data;
ok("new version: setup is unlocked and the sections need agreeing again", recs.every((x) => x.locked_at === null && x.status === "SUBMITTED"), JSON.stringify(recs.slice(0, 2)));
ok("new version: the raters carry over to the new assessment", (await db.from("rater_nomination").select("nomination_id").eq("assessment_id", A2)).data.length === nomBefore, `${nomBefore}`);
ok("new version: survey links of the replaced assessment stop working (410)", (await survey(toks[1])).status === 410);
[s] = await call("con", "POST", `/v1/assessments/${A}/new-version`, { reason: "Again" }); ok("new version: the replaced assessment cannot be versioned again (409)", s === 409, s);
const bRow = (await db.from("setup_record").select("payload_json, workshop_date, participants").eq("engagement_id", engId).eq("section", "B").single()).data;
[s, r] = await call("con", "PUT", `/v1/engagements/${engId}/setup/B`, { payload: bRow.payload_json, workshop_date: bRow.workshop_date, participants: bRow.participants });
ok("new version: setup can be edited again", s === 200, `${s} ${r?.title}`);
[s, r] = await call("con", "GET", `/v1/assessments/${A2}/launch-state`);
ok("new version: the launch state shows version 2, its reason and its predecessor", s === 200 && r.assessment.setup_version === 2 && r.assessment.supersedes === A && r.assessment.version_reason.includes("board meeting"), JSON.stringify(r?.assessment));
ok("new version: the rater windows carry over to the new assessment", (await db.from("rater_window").select("assignment_id").eq("assessment_id", A2)).data.length === (await db.from("rater_window").select("assignment_id").eq("assessment_id", A)).data.length);
// relaunch the new version (sections marked agreed directly, as the other launch checks do)
await db.from("setup_record").update({ status: "AGREED", workshop_date: iRow.workshop_date, participants: iRow.participants }).eq("engagement_id", engId);
{ const [s2, r2] = await call("con", "POST", `/v1/assessments/${A2}/preflight`, {}); ok("new version: editing B cleared its Executive tick, so EXT blocks", s2 === 200 && r2.checks.some((c) => c.id === "EXT" && !c.pass && c.detail.missing.join() === "B"), JSON.stringify(r2?.checks?.find((c) => c.id === "EXT"))); }
await db.from("setup_confirmation").upsert({ engagement_id: engId, tenant_id: tenantId, section: "B", user_id: "00000000-0000-4000-8000-000000000e1e" }, { onConflict: "engagement_id,section,user_id", ignoreDuplicates: true });
await db.from("assessment").update({ window_open: asm0.window_open, window_close: asm0.window_close }).eq("assessment_id", A2);
[s, r] = await call("con", "POST", `/v1/assessments/${A2}/preflight`, {});
ok("new version: pre-flight runs on the new draft", s === 200 && Array.isArray(r.checks), `${s}`);
[s, r] = await call("con", "POST", `/v1/assessments/${A2}/launch`, {});
ok("new version: the new assessment launches, with a fresh launch snapshot", s === 200 && r.changed === true && r.status === "LAUNCHED", `${s} ${JSON.stringify(r)}`);
const snap = (await db.from("org_graph_snapshot").select("taken_at").eq("engagement_id", engId)).data;
ok("new version: exactly one launch snapshot exists for the engagement", snap.length === 1);

// ================================================================ completion time statement (S1.4.4-CE) and what respondents see (I5)
const { data: toks2 } = await db.rpc("rpc_issue_invitations", { p_assessment_id: A2, p_count: 1 });
let sv = await (await survey(toks2[0])).json();
ok("CE: the relaunched survey still carries the Section I statement", sv.estimate === "35–45 minutes" && sv.message === "Welcome to the survey. This is the staff message.", JSON.stringify([sv.estimate, sv.message]));
ls = (await call("con", "GET", `/v1/assessments/${A2}/launch-state`))[1];
ok("CE: no measurement yet, so no prompt", ls.completion.complete === 0 && ls.completion.median_seconds === null && ls.completion.needs_update === false, JSON.stringify(ls.completion));
const ins = (n, secs) => sql(`insert into capture.response (tenant_id, assessment_id, duration_seconds) select '${tenantId}', '${A2}', ${secs} from generate_series(1, ${n})`);
await ins(29, 3600);
ls = (await call("con", "GET", `/v1/assessments/${A2}/launch-state`))[1];
ok("CE: 29 responses are not enough to prompt, even with a long median", ls.completion.complete === 29 && ls.completion.median_seconds === 3600 && ls.completion.needs_update === false, JSON.stringify(ls.completion));
await ins(1, 3600);
ls = (await call("con", "GET", `/v1/assessments/${A2}/launch-state`))[1];
ok("CE: at 30 responses with a median of 60 minutes the engine function asks for an update", ls.completion.complete === 30 && ls.completion.needs_update === true, JSON.stringify(ls.completion));
const direct = await w.con.c.rpc("rpc_completion_stats", { p_assessment: A2, p_min: 1 });
ok("CE: the statistics function is closed to a user token", !!direct.error, JSON.stringify(direct.data));
[s] = await call(null, "PUT", `/v1/assessments/${A2}/completion-estimate`, { text: "40 to 50 minutes" }); ok("CE: no session (401)", s === 401, s);
[s] = await call("other", "PUT", `/v1/assessments/${A2}/completion-estimate`, { text: "40 to 50 minutes" }); ok("CE: another organisation's admin cannot (403)", s === 403, s);
[s] = await call("admin", "PUT", `/v1/assessments/${A2}/completion-estimate`, { text: "" }); ok("CE: an empty statement is refused (422)", s === 422, s);
[s] = await call("admin", "PUT", `/v1/assessments/${A2}/completion-estimate`, { text: "x".repeat(61) }); ok("CE: a statement over 60 characters is refused (422)", s === 422, s);
[s] = await call("admin", "PUT", `/v1/assessments/${A2}/completion-estimate`, { text: "55 to 65 minutes" });
ok("CE: the Client Admin updates the statement (audited)", s === 200 && (await db.from("audit_log").select("action").eq("object_id", A2).eq("action", "assessment.completion_estimate_updated")).data.length === 1, s);
sv = await (await survey(toks2[0])).json();
ok("CE: respondents now see the updated statement", sv.estimate === "55 to 65 minutes", JSON.stringify(sv.estimate));
ok("CE: Section I keeps its locked text (a text only change, not an edit of the locked setup)", (await db.from("setup_record").select("payload_json").eq("engagement_id", engId).eq("section", "I").single()).data.payload_json.completion_estimate === "35–45 minutes");

[s, r] = await call("con", "POST", `/v1/assessments/${A2}/new-version`, { reason: "Another change" });
ok("new version: refused once responses exist (409)", s === 409 && /responses/i.test(r.title), `${s} ${r?.title}`);

// ================================================================ I4b overlap with another live assessment, in a second engagement of the same tenant
const e2n = (await db.from("engagement").insert({ tenant_id: tenantId, cycle_no: 2 }).select().single()).data;
const a0 = (await db.from("assessment").select("instrument_version_id, rules_version_id").eq("assessment_id", A2).single()).data;
const conId = (await w.con.c.auth.getUser()).data.user.id;
await sql(`insert into app.engagement_assignment (user_id, engagement_id, valid_to) values ('${conId}', '${e2n.engagement_id}', now() + interval '90 days')`);
await db.from("setup_record").insert({ tenant_id: tenantId, engagement_id: e2n.engagement_id, section: "I", perspective: "AGREED", payload_json: base0, status: "AGREED", workshop_date: iRow.workshop_date, participants: iRow.participants });
const mk = async (a, b) => (await db.from("assessment").insert({ tenant_id: tenantId, engagement_id: e2n.engagement_id, instrument_version_id: a0.instrument_version_id, rules_version_id: a0.rules_version_id, window_open: a, window_close: b }).select().single());
const dd = (n) => new Date(Date.now() + n * 864e5).toISOString();
const second = await mk(dd(-1), dd(28));
const A3 = second.data?.assessment_id;
const pre3 = async () => (await call("con", "POST", `/v1/assessments/${A3}/preflight`, {}))[1];
j = await pre3();
ok("I4b: a window overlapping another live assessment of the tenant fails L5", !!A3 && chk(j, "L5").pass === false && failing(j).includes("L5"), JSON.stringify(chk(j, "L5") ?? second.error));
await db.from("assessment").update({ window_open: dd(40), window_close: dd(60) }).eq("assessment_id", A3);
j = await pre3();
ok("I4b: a window that starts after the live one closes passes L5", chk(j, "L5").pass === true, JSON.stringify(chk(j, "L5")));
await db.from("assessment").update({ window_open: dd(-40), window_close: dd(-20) }).eq("assessment_id", A3);
ok("I4b: a window that ended before the live one began passes L5", chk(await pre3(), "L5").pass === true);

// ================================================================ client cover colour (tenant.cover_colour)
const CC = (who, colour) => call(who, "PUT", `/v1/tenants/${tenantId}/cover-colour`, { colour });
[s] = await CC(null, "#1F7A5C"); ok("cover colour: no session (401)", s === 401, s);
[s] = await CC("admin", "#1F7A5C"); ok("cover colour: the Client Admin cannot set it (403)", s === 403, s);
[s] = await CC("other", "#1F7A5C"); ok("cover colour: another organisation's admin cannot (403)", s === 403, s);
[s] = await CC("con", "blue"); ok("cover colour: a value that is not six digit hex is refused (422)", s === 422, s);
[s] = await CC("con", "#12345"); ok("cover colour: five digits are refused (422)", s === 422, s);
[s, r] = await CC("con", "#1f7a5c"); ok("cover colour: the consultant sets it (stored upper case)", s === 200 && r.cover_colour === "#1F7A5C" && (await db.from("tenant").select("cover_colour").eq("tenant_id", tenantId).single()).data.cover_colour === "#1F7A5C", `${s}`);
[s, r] = await CC("root", "#0A0A0A"); ok("cover colour: the Super Admin sets it", s === 200 && r.cover_colour === "#0A0A0A", `${s}`);
[s, r] = await CC("root", null); ok("cover colour: null clears it, audited", s === 200 && r.cover_colour === null && (await db.from("audit_log").select("action").eq("object_id", tenantId).eq("action", "tenant.cover_colour_cleared")).data.length === 1, `${s}`);
const db0 = (await db.from("tenant").select("cover_colour").eq("tenant_id", tenantId).single()).data;
ok("cover colour: the database refuses a bad value directly", !!(await db.from("tenant").update({ cover_colour: "red" }).eq("tenant_id", tenantId)).error && db0.cover_colour === null);

// ================================================================ Client Admin completion time screen
[st] = await page(adminEmail, `/engagements/${engId}/completion`); ok("completion screen: opens for the Client Admin once the survey is open", st === 200, st);
[st] = await page("consultant@cdp-demo.example", `/engagements/${engId}/completion`); ok("completion screen: the consultant is sent away (redirect)", [302, 303, 307].includes(st), st);
[st] = await page("admin.fixture@cdp-demo.example", `/engagements/${engId}/completion`); ok("completion screen: another organisation's admin is sent away (redirect)", [302, 303, 307].includes(st), st);

// ---------------------------------------------------------------- put the platform wide approval back
await setTmpl(tmpl0);
done();
