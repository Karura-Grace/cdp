// Unit checks for the launch slice (no database, no server):
//   Section I rules (I1 to I6, reminder plan), staff message templates, cohort projection, tenant calendar rules, reminder preview,
//   XLSX import with file row numbers, defect locations.
//   node scripts/check-launch.mjs
import ExcelJS from "exceljs";
import * as S from "../apps/web/lib/setup-sections.ts";
import * as I from "../apps/web/lib/section-i.mjs";
import * as M from "../apps/web/lib/staff-message.ts";
import * as C from "../apps/web/lib/cohorts.ts";
import * as K from "../apps/web/lib/calendar.ts";
import * as R from "../apps/web/lib/reminders.ts";
import * as X from "../apps/web/lib/xlsx-csv.ts";
import * as O from "../apps/web/lib/org-csv.ts";
import * as D from "../apps/web/lib/rater-defaults.ts";
import * as A from "../apps/web/lib/export/appendix.ts";
import * as W from "../apps/web/lib/rater-window.ts";
import * as T from "../apps/web/lib/tenant-fields.ts";

let fail = 0;
const ok = (n, c, x = "") => { if (!c) fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : x); };
const today = "2026-10-03";
const v = (p, complete) => S.validateSection("I", S.finalise("I", p), { complete, ctx: { today } });
const has = (errs, s) => errs.some((e) => e.includes(s));
const good = {
  cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }], anonymity: "FULL", languages: ["en"],
  staff_message: "Hello.", staff_message_checked: true, qualitative: "NONE", completion_estimate: "35–45 minutes", reminder_plan: "STANDARD",
};

// ---------------------------------------------------------------- Section I (S1.4.4 I1 to I6, reminder_plan)
ok("a complete Section I passes", v(good, true).length === 0, v(good, true).join("; "));
ok("an empty draft is valid at shape level", v({}, false).length === 0);
ok("I1: cohorts are required to agree", has(v({ ...good, cohorts: undefined }, true), "I1 Cohorts"));
ok("I1: a cohort needs a name, an axis and a value", has(v({ ...good, cohorts: [{ rollup_to_parent: true }] }, true), "Cohort name") && has(v({ ...good, cohorts: [{ name: "A" }] }, true), "Condition 1: axis"));
ok("I1: more than 12 cohorts refused", has(v({ ...good, cohorts: Array.from({ length: 13 }, (_, i) => ({ name: "C" + i, axis1: "GRADE", value1: "Manager" })) }, false), "at most 12"));
ok("I1: an axis outside the list is refused", has(v({ ...good, cohorts: [{ name: "A", axis1: "COLOUR", value1: "red" }] }, false), "listed values"));
ok("I1: Executive takes YES or NO only", has(v({ ...good, cohorts: [{ name: "A", axis1: "EXECUTIVE", value1: "maybe" }] }, false), "YES or NO"));
ok("I1: Demographic needs Attribute=Value", has(v({ ...good, cohorts: [{ name: "A", axis1: "DEMOGRAPHIC", value1: "Female" }] }, false), "attribute name"));
ok("I1: Demographic Attribute=Value is accepted", !has(v({ ...good, cohorts: [{ name: "A", axis1: "DEMOGRAPHIC", value1: "Gender=Female" }] }, false), "Demographic"));
ok("I1: two conditions on the same axis refused", has(v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis2: "GRADE", value2: "y" }] }, false), "different axes"));
ok("I1: a second condition needs both parts", has(v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis2: "DEPARTMENT" }] }, true), "second condition"));
ok("I1: duplicate cohort names refused", has(v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x" }, { name: "a", axis1: "GRADE", value1: "y" }] }, false), "different name"));
ok("I2: anonymity must be FULL or CONFIDENTIAL_AGGREGATE", has(v({ ...good, anonymity: "NONE" }, false), "listed values") && v({ ...good, anonymity: "CONFIDENTIAL_AGGREGATE" }, true).length === 0);
ok("I2: the default is FULL", S.DEFAULTS.I.anonymity === "FULL");
ok("I3: a language is required", has(v({ ...good, languages: [] }, true), "I3"));
ok("I5: the confirmation is required to agree", has(v({ ...good, staff_message_checked: false }, true), "confirm that it states"));
ok("I5: the message is at most 3000 characters", has(v({ ...good, staff_message: "x".repeat(3001) }, false), "3000"));
ok("I6: NONE with counts refused", has(v({ ...good, interviews_planned: 4 }, false), "remove the counts"));
ok("I6: INTERVIEWS needs an interview count to agree", has(v({ ...good, qualitative: "INTERVIEWS" }, true), "number of interviews") && v({ ...good, qualitative: "INTERVIEWS", interviews_planned: 8 }, true).length === 0);
ok("I6: FOCUS_GROUPS needs a focus group count; interviews not counted with it", has(v({ ...good, qualitative: "FOCUS_GROUPS" }, true), "focus groups") && has(v({ ...good, qualitative: "FOCUS_GROUPS", focus_groups_planned: 2, interviews_planned: 3 }, false), "only with Interviews"));
ok("I6: BOTH needs both counts", has(v({ ...good, qualitative: "BOTH", interviews_planned: 8 }, true), "focus groups") && v({ ...good, qualitative: "BOTH", interviews_planned: 8, focus_groups_planned: 2 }, true).length === 0);
ok("I6: counts must be whole numbers within range", has(v({ ...good, qualitative: "INTERVIEWS", interviews_planned: 2.5 }, false), "whole number") && has(v({ ...good, qualitative: "INTERVIEWS", interviews_planned: 501 }, false), "between"));
ok("I6: the recommended minimum is 8 interviews and 2 focus groups", I.RECOMMENDED_QUALITATIVE.interviews === 8 && I.RECOMMENDED_QUALITATIVE.focus_groups === 2);
ok("I6: below the minimum gives a hint and no error", I.qualitativeHints({ qualitative: "BOTH", interviews_planned: 3, focus_groups_planned: 1 }).length === 2 && v({ ...good, qualitative: "BOTH", interviews_planned: 3, focus_groups_planned: 1 }, true).length === 0);
ok("I6: at the minimum gives no hint", I.qualitativeHints({ qualitative: "BOTH", interviews_planned: 8, focus_groups_planned: 2 }).length === 0);
ok("completion statement is at most 60 characters", has(v({ ...good, completion_estimate: "x".repeat(61) }, false), "60"));
ok("reminder plan: custom needs a reminder and the approval", has(v({ ...good, reminder_plan: "CUSTOM" }, true), "at least one reminder") && has(v({ ...good, reminder_plan: "CUSTOM", reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }] }, true), "approval"));
ok("reminder plan: an approved custom plan passes", v({ ...good, reminder_plan: "CUSTOM", reminder_custom_approved: true, reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }] }, true).length === 0);
ok("reminder plan: custom reminders with STANDARD refused", has(v({ ...good, reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }] }, false), "remove the custom"));
ok("reminder plan: a duplicate reminder and an out of range count refused", has(v({ ...good, reminder_plan: "CUSTOM", reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }, { kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }] }, false), "twice") && has(v({ ...good, reminder_plan: "CUSTOM", reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 99, audience: "NOT_SUBMITTED" }] }, false), "at most 60"));
ok("reminder plan: an unknown plan is refused", has(v({ ...good, reminder_plan: "WEEKLY" }, false), "listed values"));

// ---------------------------------------------------------------- staff message templates (I2, I5)
const ctx = { org: "Acme Bank", purpose: null };
const full = M.staffMessage("FULL", ctx), agg = M.staffMessage("CONFIDENTIAL_AGGREGATE", ctx);
ok("I2: the two anonymity commitments give different wording", full !== agg && full.includes("anonymous") && agg.includes("confidential"));
ok("I2: the wording differs only in the commitment paragraph", full.split("\n\n").filter((p, i) => p !== agg.split("\n\n")[i]).length === 1);
ok("I5: every template states purpose, use of results, anonymity and next steps", [full, agg].every((t) => /purpose/i.test(t) && /results will be used/i.test(t) && /(anonymous|confidential)/i.test(t) && /What happens next/.test(t)));
ok("I5: the organisation name and the purpose are filled in", full.includes("Acme Bank") && M.staffMessage("FULL", { org: "Acme Bank", purpose: "Prepare for a merger." }).includes("The purpose of this survey is: Prepare for a merger."));
ok("I5: both templates are well under 3000 characters", full.length < 3000 && agg.length < 3000);
ok("I5: no dashes in the template text", !/[-–—]/.test(full + agg));
ok("I5: a template is recognised word for word", M.templateInUse(full, ctx) === "FULL" && M.templateInUse(agg + "\r\n", ctx) === "CONFIDENTIAL_AGGREGATE");
ok("I5: an edited message is the consultant's own text", M.templateInUse(full + " Please reply by Friday.", ctx) === null && M.templateInUse(undefined, ctx) === null);
ok("owner approval: a template version is named, so a wording change needs a new approval", typeof M.STAFF_TEMPLATE_VERSION === "string" && M.STAFF_TEMPLATE_VERSION.length > 0);
ok("launch stays consultant only for now (one constant)", M.LAUNCH_NEEDS_SEPARATE_APPROVAL === false);

// ---------------------------------------------------------------- cohort projection (I1, S1.5.4-003)
const refs = {
  units: [{ unit_id: "u0", name: "Head office", type: "DIVISION", parent_unit_id: null }, { unit_id: "d1", name: "Finance", type: "DEPARTMENT", parent_unit_id: "u0" }, { unit_id: "t1", name: "Payables", type: "TEAM", parent_unit_id: "d1" }, { unit_id: "t2", name: "Ops team", type: "TEAM", parent_unit_id: "u0" }],
  grades: [{ grade_id: "g1", name: "Executive", is_executive: true }, { grade_id: "g2", name: "Staff", is_executive: false }],
  bands: [{ name: "Under 1 year", min_months: 0, max_months: 12 }, { name: "1 to 3 years", min_months: 12, max_months: 36 }, { name: "Over 3 years", min_months: 36, max_months: null }],
  demographics: new Map([["p1", { gender: "Female" }], ["p2", { gender: "Male" }]]), at: "2026-10-05",
};
const people = [
  { person_id: "p1", unit_id: "t1", grade_id: "g1", start_date: "2026-01-15" }, { person_id: "p2", unit_id: "t1", grade_id: "g2", start_date: "2023-10-05" },
  { person_id: "p3", unit_id: "t2", grade_id: "g2", start_date: null }, { person_id: "p4", unit_id: null, grade_id: null, start_date: "2020-01-01" },
];
const size = (c) => C.projectCohort({ name: "x", rollup_to_parent: false, ...c }, people, refs);
ok("cohort: department is the nearest department above the team", size({ axis1: "DEPARTMENT", value1: "finance" }) === 2);
ok("cohort: a team with no department above counts under its own name", size({ axis1: "DEPARTMENT", value1: "Ops team" }) === 1);
ok("cohort: executive flag", size({ axis1: "EXECUTIVE", value1: "YES" }) === 1 && size({ axis1: "EXECUTIVE", value1: "NO" }) === 3);
ok("cohort: grade by name, unknown grade as UNKNOWN", size({ axis1: "GRADE", value1: "Staff" }) === 2 && size({ axis1: "GRADE", value1: "UNKNOWN" }) === 1);
ok("cohort: tenure band measured at the window start, whole months", size({ axis1: "TENURE_BAND", value1: "Under 1 year" }) === 1 && size({ axis1: "TENURE_BAND", value1: "1 to 3 years" }) === 0 && size({ axis1: "TENURE_BAND", value1: "Over 3 years" }) === 2 && C.monthsBetween("2023-10-05", "2026-10-05") === 36 && C.monthsBetween("2023-10-06", "2026-10-05") === 35);
ok("cohort: no start date is UNKNOWN tenure", size({ axis1: "TENURE_BAND", value1: "UNKNOWN" }) === 1);
ok("cohort: demographic attribute", size({ axis1: "DEMOGRAPHIC", value1: "Gender=Female" }) === 1 && size({ axis1: "DEMOGRAPHIC", value1: "Gender=Other" }) === 0);
ok("cohort: two conditions both apply", size({ axis1: "DEPARTMENT", value1: "Finance", axis2: "EXECUTIVE", value2: "YES" }) === 1);
ok("cohort: a value that matches nobody is size 0", size({ axis1: "GRADE", value1: "Nobody" }) === 0);

// ---------------------------------------------------------------- tenant calendar (I4, S1-01)
const okCal = K.checkCalendar({ holidays: [{ day: "2026-12-25", label: " Christmas Day " }, { day: "2026-10-20", label: "Mashujaa Day" }], review_period_start: "2026-11-01", review_period_end: "2026-11-30" });
ok("calendar: holidays are trimmed and sorted", "ok" in okCal && okCal.ok.holidays[0].day === "2026-10-20" && okCal.ok.holidays[1].label === "Christmas Day");
ok("calendar: an empty list is valid (no lists are seeded)", "ok" in K.checkCalendar({ holidays: [] }) && K.checkCalendar({ holidays: [] }).ok.review_period_start === null);
ok("calendar: a fake date refused", "errors" in K.checkCalendar({ holidays: [{ day: "2026-02-30", label: "x" }] }));
ok("calendar: a missing name refused", "errors" in K.checkCalendar({ holidays: [{ day: "2026-12-25", label: " " }] }));
ok("calendar: the same date twice refused", "errors" in K.checkCalendar({ holidays: [{ day: "2026-12-25", label: "a" }, { day: "2026-12-25", label: "b" }] }));
ok("calendar: more than 200 refused", "errors" in K.checkCalendar({ holidays: Array.from({ length: 201 }, (_, i) => ({ day: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), label: "h" })) }));
ok("calendar: the review period needs both ends, in order", "errors" in K.checkCalendar({ holidays: [], review_period_start: "2026-11-01" }) && "errors" in K.checkCalendar({ holidays: [], review_period_start: "2026-11-30", review_period_end: "2026-11-01" }));
ok("calendar: overlap is inclusive at both ends", K.reviewOverlaps("2026-10-05", "2026-10-19", "2026-10-19", "2026-11-30") && K.reviewOverlaps("2026-10-05", "2026-10-19", "2026-09-01", "2026-10-05") && !K.reviewOverlaps("2026-10-05", "2026-10-19", "2026-10-20", "2026-11-30") && !K.reviewOverlaps("2026-10-05", "2026-10-19", null, null));

// ---------------------------------------------------------------- reminders scheduled (reminder_plan, Appendix K)
const std = R.reminderPreview({ reminder_plan: "STANDARD" }, "2026-10-05", "2026-10-19", []);
ok("reminders: the standard plan is day 3, day 6, 24 h before close, final", std.map((r) => r.kind).join("|") === "Working day 3|Working day 6|24 hours before close|Final reminder" && std[0].on === "2026-10-08" && std[1].on === "2026-10-13");
ok("reminders: a holiday moves the working day dates", R.reminderPreview({ reminder_plan: "STANDARD" }, "2026-10-05", "2026-10-19", ["2026-10-07"])[0].on === "2026-10-09");
ok("reminders: the final reminder goes to people who started and have not submitted", std.find((r) => r.kind === "Final reminder").audience === "STARTED_NOT_SUBMITTED" && std.filter((r) => r.audience === "NOT_SUBMITTED").length === 3);
const cust = R.reminderPreview({ reminder_plan: "CUSTOM", reminder_custom: [{ kind: "WORKING_DAY_AFTER_OPEN", n: 2, audience: "NOT_SUBMITTED" }, { kind: "HOURS_BEFORE_CLOSE", n: 48, audience: "STARTED_NOT_SUBMITTED" }, { kind: "WORKING_DAY_AFTER_OPEN", n: 30, audience: "NOT_SUBMITTED" }] }, "2026-10-05", "2026-10-19", []);
ok("reminders: a custom plan is turned into dates and one outside the window is flagged", cust.length === 3 && cust[0].on === "2026-10-07" && cust.find((r) => r.kind === "48 hours before close").on === "2026-10-17" && cust.at(-1).outside_window === true && cust[0].outside_window === false);

// ---------------------------------------------------------------- XLSX import with file row numbers (S1-03, AC-1.2)
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("People");
ws.addRow(["employee_ref", "email", "unit_key", "grade", "location", "employment_status"]);
ws.addRow(["E001", "a@x.org", "T1", "Manager", "Nairobi", "ACTIVE"]);
ws.addRow([]);                                             // a blank row 3 stays row 3
ws.addRow(["E002", { text: "b@x.org", hyperlink: "mailto:b@x.org" }, "T1", "Staff", "Nairobi", "ACTIVE"]);
ws.addRow(["E003", "c@x.org", "T2", "Staff", "Nairobi", "RETIRED"]);
ws.addRow(["-5", "d@x.org", "", "", "", "ACTIVE"]);
const xbuf = Buffer.from(await wb.xlsx.writeBuffer());
const csv = await X.xlsxToCsv(xbuf);
const parsed = O.parseKind("people", csv);
ok("xlsx: the first sheet becomes CSV that the importer reads", csv.startsWith("employee_ref,email,unit_key") && csv.includes("b@x.org") && !csv.includes("mailto"), csv);
ok("xlsx: a bad value is reported at the row Excel shows (blank row counted)", parsed.errors.length === 1 && parsed.errors[0].startsWith("Row 5:") && parsed.errors[0].includes("employment_status"), parsed.errors.join("; "));
const goodWb = new ExcelJS.Workbook(); const gs = goodWb.addWorksheet("p");
gs.addRow(["employee_ref", "email", "employment_status", "unit_key"]); gs.addRow(["E001", "a@x.org", "ACTIVE", "T1"]); gs.addRow(["", "", "", ""]); gs.addRow(["E002", "b@x.org", "ACTIVE", "T1"]); gs.addRow(["=1+1", "c@x.org", "ACTIVE", "T2"]);
const gp = O.parseKind("people", await X.xlsxToCsv(Buffer.from(await goodWb.xlsx.writeBuffer())));
ok("xlsx: rows parse, keys map to file rows, text that looks like a formula is kept as text", gp.errors.length === 0 && gp.rows.length === 3 && gp.rowOf.E001 === 2 && gp.rowOf.E002 === 4 && gp.rowOf["=1+1"] === 5, JSON.stringify(gp));
const dwb = new ExcelJS.Workbook(); const dws = dwb.addWorksheet("p");
dws.addRow(["employee_ref", "email", "employment_status", "unit_key"]); dws.addRow(["E9", "z@x.org", "ACTIVE", "T1"]);
const dcell = dws.getCell("A2"); dcell.value = "E9"; dws.addRow(["E10", { formula: "A2&\"@x.org\"", result: "E9@x.org" }, "ACTIVE", "T1"]);
const dq = O.parseKind("people", await X.xlsxToCsv(Buffer.from(await dwb.xlsx.writeBuffer())));
ok("xlsx: a formula cell gives its result, not the formula", dq.rows[1]?.email === "E9@x.org", JSON.stringify(dq.rows));
const leadWb = new ExcelJS.Workbook(); const ls = leadWb.addWorksheet("l"); ls.addRow(["employee_ref", "team_key", "effect_from", "effect_to"]); ls.addRow(["E1", "T1", new Date(Date.UTC(2026, 0, 1)), null]);
const lp = O.parseKind("leaders", await X.xlsxToCsv(Buffer.from(await leadWb.xlsx.writeBuffer())));
ok("xlsx: a date cell becomes YYYY-MM-DD", lp.errors.length === 0 && lp.rows[0].effect_from === "2026-01-01", JSON.stringify(lp));
const refuse = async (b) => { try { await X.xlsxToCsv(b); return false; } catch (e) { return e.message; } };
ok("xlsx: a file that is not a workbook is refused with a plain message", (await refuse(Buffer.from("employee_ref,email\nE1,a@b.c\n"))).includes("not an XLSX") && (await refuse(Buffer.concat([Buffer.from("PK"), Buffer.from("garbage garbage")]))).includes("could not be read"));
ok("xlsx: a file over 3 MB is refused", (await refuse(Buffer.alloc(X.MAX_XLSX_BYTES + 1))).includes("3 MB"));

// ---------------------------------------------------------------- file rows of defects (AC-1.2)
const peopleCsv = "employee_ref,email,employment_status\n\nE1,a@x.org,ACTIVE\nE2,b@x.org,ACTIVE\n";
const unitsCsv = "unit_key,name,type\nORG,Head,DIVISION\nT1,Team,TEAM\n";
const pp = O.parseKind("people", peopleCsv), uu = O.parseKind("units", unitsCsv);
ok("rows: file rows count blank lines, as a spreadsheet does", pp.rowOf.E1 === 3 && pp.rowOf.E2 === 4 && uu.rowOf.T1 === 3);
ok("rows: a defect is located by file row in the file it points into", O.defectLocations("V4", ["E2"], { people: pp.rowOf }).join() === "people file row 4" && O.defectLocations("V6", ["T1"], { units: uu.rowOf }).join() === "units file row 3");
ok("rows: V2 points at the leaders file and the people file", O.defectLocations("V2", ["E1"], { people: pp.rowOf, leaders: { E1: 7 } }).join() === "leaders file row 7,people file row 3");
ok("rows: a reference not in an uploaded file gives no location", O.defectLocations("V7", ["E9"], { people: pp.rowOf }).length === 0 && O.defectLocations("V5", [], {}).length === 0);
ok("rows: the old row errors still name the row of the file", O.parseKind("people", "employee_ref,email,employment_status\nE1,a@x.org,ACTIVE\n\n,b@x.org,ACTIVE\n").errors[0].startsWith("Row 4:"));

// ---------------------------------------------------------------- rater defaults (S1.4.6-002)
const g = {
  units: [{ unit_key: "ORG", parent_key: null }, { unit_key: "D1", parent_key: "ORG" }, { unit_key: "T1", parent_key: "D1" }, { unit_key: "T2", parent_key: "D1" }, { unit_key: "T3", parent_key: "D1" }, { unit_key: "T4", parent_key: "ORG" }],
  people: [{ employee_ref: "L1", unit_key: "T1", employment_status: "ACTIVE" }, { employee_ref: "A", unit_key: "T1", employment_status: "ACTIVE" }, { employee_ref: "B", unit_key: "T1", employment_status: "ACTIVE" }, { employee_ref: "X", unit_key: "T1", employment_status: "EXITED" },
    { employee_ref: "L2", unit_key: "T2", employment_status: "ACTIVE" }, { employee_ref: "L3", unit_key: "T3", employment_status: "ACTIVE" }, { employee_ref: "L4", unit_key: "T4", employment_status: "ACTIVE" }],
  leaders: [{ assignment_id: "a1", employee_ref: "L1", team_key: "T1", effect_from: "2026-01-01", effect_to: null }, { assignment_id: "a2", employee_ref: "L2", team_key: "T2", effect_from: "2026-01-01", effect_to: null },
    { assignment_id: "a3", employee_ref: "L3", team_key: "T3", effect_from: "2026-01-01", effect_to: "2026-06-30" }, { assignment_id: "a4", employee_ref: "L4", team_key: "T4", effect_from: "2026-01-01", effect_to: null }],
};
const per = new Map(["L1", "A", "B", "X", "L2", "L3", "L4", "MGR"].map((r) => [r, "per_" + r]));
const d1 = D.raterDefaults(g, "2026-10-05", "a1", ["L1", "MGR"], per);
ok("defaults: superior is the line manager, direct reports are the active team members, peers come from teams under the same parent", d1.superior === "per_MGR" && d1.direct_reports.join() === "per_A,per_B" && d1.peers.join() === "per_L2", JSON.stringify(d1));
ok("defaults: a leader with no manager has no superior, and a leader whose assignment has ended is not offered as a peer", D.raterDefaults(g, "2026-10-05", "a1", ["L1"], per).superior === null && !d1.peers.includes("per_L3"));
ok("defaults: an unknown leader gives nothing", D.raterDefaults(g, "2026-10-05", "zz", [], per) === null);

// ---------------------------------------------------------------- technical appendix (S1.6.1-ovr, AC-1.6)
const loaded = { rep: { score_version: 1, payload_hash: "sha256:r" }, score: { instrument_version: "1.1", rules_version: "2.0" }, scoreHash: "sha256:s", frozenAt: "2026-10-20T00:00:00Z", evaluationHash: null,
  org: { recorded: true, overrides: { V6: "Small team agreed with the client", V4: "Two contractors have no grade" }, warnings: ["Executive cohort projected at 3"] },
  version: { setup_version: 2, reason: "Business model changed after the board meeting", supersedes: "asm_old" } };
const rows = A.appendixRows(loaded);
ok("appendix: every override is listed with its reason", rows.some(([k, v]) => k === "Override V6" && v.includes("Small team")) && rows.some(([k, v]) => k === "Override V4" && v.includes("contractors")) && rows.some(([k, v]) => k === "Organisation graph checks" && v.includes("2 blocking")));
ok("appendix: a new assessment version shows the version, the predecessor and the reason", rows.some(([k, v]) => k === "Setup version" && v === "2") && rows.some(([k, v]) => k === "Reason for this version" && v.includes("Business model")) && rows.some(([k, v]) => k === "Replaces assessment" && v === "asm_old"));
ok("appendix: the first version shows its number and no reason", (() => { const r = A.appendixRows({ ...loaded, version: { setup_version: 1, reason: null, supersedes: null } }); return r.some(([k, v]) => k === "Setup version" && v === "1") && !r.some(([k]) => k === "Reason for this version"); })());
ok("appendix: with no overrides the appendix says so", A.appendixRows({ ...loaded, org: { recorded: true, overrides: {}, warnings: [] } }).some(([k, v]) => k === "Organisation graph checks" && v.includes("No overrides")));

// ---------------------------------------------------------------- j1b: three or more conditions, demographics in Section I, message scan, rater window, cover colour
const demo = { name: "Gender", values: "Female; Male", is_sensitive: true, analytical_purpose: "Compare engagement across gender groups" };
ok("I1: three conditions are accepted", v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis2: "DEPARTMENT", value2: "y", axis3: "TENURE_BAND", value3: "Under 1 year" }] }, true).length === 0);
ok("I1: five conditions are accepted", v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis2: "DEPARTMENT", value2: "y", axis3: "TENURE_BAND", value3: "z", axis4: "EXECUTIVE", value4: "NO", axis5: "DEMOGRAPHIC", value5: "Gender=Female" }] }, true).length === 0);
ok("I1: a repeated axis among three conditions is refused", has(v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis2: "DEPARTMENT", value2: "y", axis3: "GRADE", value3: "z" }] }, false), "different axes"));
ok("I1: two different demographic attributes are two valid conditions; the same attribute twice is not", !has(v({ ...good, cohorts: [{ name: "A", axis1: "DEMOGRAPHIC", value1: "Gender=Female", axis2: "DEMOGRAPHIC", value2: "Disability=Yes" }] }, false), "different axes") && has(v({ ...good, cohorts: [{ name: "A", axis1: "DEMOGRAPHIC", value1: "Gender=Female", axis2: "DEMOGRAPHIC", value2: "gender=Male" }] }, false), "different axes"));
ok("I1: a third condition needs both parts", has(v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis3: "DEPARTMENT" }] }, true), "third condition"));
ok("I1: an axis outside the list is refused on the fifth condition", has(v({ ...good, cohorts: [{ name: "A", axis1: "GRADE", value1: "x", axis5: "COLOUR", value5: "red" }] }, false), "listed values"));
ok("cohort: three conditions all apply", size({ axis1: "DEPARTMENT", value1: "Finance", axis2: "EXECUTIVE", value2: "NO", axis3: "TENURE_BAND", value3: "Over 3 years" }) === 1 && size({ axis1: "DEPARTMENT", value1: "Finance", axis2: "EXECUTIVE", value2: "NO", axis3: "TENURE_BAND", value3: "Under 1 year" }) === 0);
ok("cohort: a demographic condition combines with the others", size({ axis1: "DEPARTMENT", value1: "Finance", axis2: "DEMOGRAPHIC", value2: "Gender=Female", axis3: "EXECUTIVE", value3: "YES" }) === 1);
ok("cohort: no condition at all matches nobody", size({}) === 0);
ok("I1 demographics: a complete attribute passes", v({ ...good, demographics: [demo] }, true).length === 0);
ok("I1 demographics: one value only is refused", has(v({ ...good, demographics: [{ ...demo, values: "Female" }] }, false), "2 to 30 values"));
ok("I1 demographics: more than 30 values refused", has(v({ ...good, demographics: [{ ...demo, values: Array.from({ length: 31 }, (_, i) => "v" + i).join(";") }] }, false), "2 to 30 values"));
ok("I1 demographics: the analytical purpose is required (10 characters)", has(v({ ...good, demographics: [{ ...demo, analytical_purpose: "short" }] }, false), "why the attribute is needed"));
ok("I1 demographics: a name twice is refused", has(v({ ...good, demographics: [demo, { ...demo, name: "gender" }] }, false), "different name"));
ok("I1 demographics: at most 10 attributes", has(v({ ...good, demographics: Array.from({ length: 11 }, (_, i) => ({ ...demo, name: "A" + i })) }, false), "at most 10"));
ok("I1 demographics: values split on semicolons and de duplicate", I.splitValues("Female; Male;; Female ;Other").join("|") === "Female|Male|Other");
ok("I5 scan: both templates leave nothing out", [full, agg].every((t) => I.messageGaps(t).length === 0), JSON.stringify([I.messageGaps(full), I.messageGaps(agg)]));
ok("I5 scan: a bare message names all four gaps", I.messageGaps("Hello.").length === 4 && I.messageGaps(undefined).length === 4);
ok("I5 scan: each gap is found on its own", I.messageGaps(full.replace(/The purpose of this survey[^.]*\./, "")).map((g) => g.topic).join() === "purpose" && I.messageGaps("The purpose of this survey is to understand our culture. Your answers are anonymous. What happens next: you will get a link.").map((g) => g.topic).join() === "use of results"
  && I.messageGaps(full.replace(/Your answers are anonymous[^\n]*/, "")).map((g) => g.topic).join() === "anonymity" && I.messageGaps(full.replace(/What happens next[^\n]*/, "")).map((g) => g.topic).join() === "next steps");
const aw = { open: "2026-10-05T00:00:00Z", close: "2026-10-19T23:59:59Z" };
const we = (o, c) => W.raterWindowErrors({ opens_on: o, closes_on: c }, aw.open, aw.close);
ok("rater window: inside the assessment window passes, including both end days", we("2026-10-07", "2026-10-12").length === 0 && we("2026-10-05", "2026-10-19").length === 0);
ok("rater window: opening before the assessment window is refused", we("2026-10-04", "2026-10-12").some((e) => e.includes("before the assessment window")));
ok("rater window: closing after the assessment window is refused", we("2026-10-07", "2026-10-20").some((e) => e.includes("after the assessment window")));
ok("rater window: closing before opening is refused", we("2026-10-12", "2026-10-07").some((e) => e.includes("on or after")));
ok("rater window: a fake date or a missing date is refused", we("2026-02-30", "2026-10-07").length === 1 && W.raterWindowErrors({ opens_on: null, closes_on: "2026-10-07" }, aw.open, aw.close).length === 1);
ok("rater window: with no assessment window it cannot be set", W.raterWindowErrors({ opens_on: "2026-10-07", closes_on: "2026-10-09" }, null, null).length === 1);
const rw = { opens_on: "2026-10-07", closes_on: "2026-10-12" };
ok("rater window: no window means links are issued with the assessment's own close", W.raterWindowAction(undefined, "2026-10-01").issue === true && W.raterWindowAction(undefined, "2026-10-01").expires_at === null);
ok("rater window: before it opens nothing is issued", W.raterWindowAction(rw, "2026-10-06").issue === false);
ok("rater window: inside it links are issued and expire at the end of the closing day", W.raterWindowAction(rw, "2026-10-07").issue === true && W.raterWindowAction(rw, "2026-10-12").expires_at === "2026-10-12T23:59:59Z");
ok("rater window: after it closed nothing is issued", W.raterWindowAction(rw, "2026-10-13").issue === false);
ok("cover colour: six digit hex is kept and upper cased, empty clears, anything else is refused", T.cleanColour("#1f7a5c") === "#1F7A5C" && T.cleanColour("") === null && T.cleanColour(null) === null && T.cleanColour(undefined) === undefined && T.cleanColour("#12345") === undefined && T.cleanColour("red") === undefined && T.cleanColour("#GGGGGG") === undefined);
const tenantBody = { name: "Acme", sector: "OTHER", headcount: 10, geographies: ["KE"], privacy_regime: "KE_DPA_2019", residency_region: "eu-west-1", timezone: "Africa/Nairobi" };
ok("cover colour: the tenant record checks it, and leaves it out when not given", "errors" in T.checkTenant({ ...tenantBody, cover_colour: "blue" }) && T.checkTenant(tenantBody).ok.cover_colour === undefined && T.checkTenant({ ...tenantBody, cover_colour: "#abcdef" }).ok.cover_colour === "#ABCDEF");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
