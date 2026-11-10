// Unit checks for the setup section schema and rules (no database, no server).
//   node scripts/check-setup-sections.mjs
import * as S from "../apps/web/lib/setup-sections.ts";

let fail = 0;
const ok = (n, c, x = "") => { if (!c) fail++; console.log(c ? "PASS" : "FAIL", n, c ? "" : x); };
const today = "2026-10-03";
const ctx = (kpis) => ({ today, kpis });
const v = (sec, p, complete, kpis) => S.validateSection(sec, S.finalise(sec, p), { complete, ctx: ctx(kpis) });
const has = (errs, s) => errs.some((e) => e.includes(s));

const kpi = (n, o, dir = "HIGHER_IS_BETTER", base = 10) => ({ name: n, unit: "PERCENT", direction: dir, baseline_value: base, baseline_date: "2026-06-30", source: "HR system", orientation: o });
const goodC = { kpis: [kpi("A", "ENGAGE"), kpi("B", "INNOVATE"), kpi("C", "GOVERN"), kpi("D"), kpi("E")], trend: "STABLE", biggest_gap: "Speed.", attrition_pct: 12.5 };

// shape
ok("an empty draft is valid at shape level", v("B", {}, false).length === 0);
ok("unknown keys are dropped", !("junk" in S.finalise("A", { junk: 1, maturity: "GROWTH" })));
ok("text is trimmed and empty strings dropped", JSON.stringify(S.finalise("A", { maturity: "GROWTH", trigger: "  " })) === '{"maturity":"GROWTH"}');
ok("bad enum is refused", has(v("A", { maturity: "WRONG" }, false), "listed values"));
ok("text over the limit is refused", has(v("B", { intent: "x".repeat(1001) }, false), "1000"));
ok("more than 3 priorities refused", has(v("B", { priorities: [1, 2, 3, 4].map(() => ({ text: "t", goal_type: "RESULTS_GROWTH" })) }, false), "at most 3"));
ok("a priority needs a valid goal type", has(v("B", { priorities: [{ text: "t", goal_type: "X" }] }, false), "Goal type"));
ok("priorities get refs B3.1, B3.2", JSON.stringify(S.finalise("B", { priorities: [{ text: "a", goal_type: "RESULTS_GROWTH" }, { text: "b", goal_type: "PEOPLE_TALENT" }] }).priorities.map((p) => p.ref)) === '["B3.1","B3.2"]');
ok("a number field refuses text", has(v("C", { attrition_pct: "12" }, false), "must be a number"));
ok("attrition above 100 refused", has(v("C", { attrition_pct: 101 }, false), "between 0 and 100"));
ok("time to hire must be a whole number", has(v("C", { time_to_hire_days: 10.5 }, false), "whole number"));
ok("impossible date refused", has(v("C", { kpis: [{ ...kpi("A"), baseline_date: "2026-02-31" }] }, false), "date"));

// block 26 rules
ok("B1 refuses four sentences", has(v("B", { intent: "One. Two. Three. Four." }, false), "one to three sentences"));
ok("B1 accepts one and three sentences", v("B", { intent: "Grow." }, false).length === 0 && v("B", { intent: "Grow digital. Keep quality? Hire well!" }, false).length === 0);
ok("C5 refuses three decimal places", has(v("C", { attrition_pct: 19.256 }, false), "2 decimal places"));
ok("C5 accepts two decimal places and whole numbers", v("C", { attrition_pct: 19.25 }, false).length === 0 && v("C", { attrition_pct: 19 }, false).length === 0);
ok("F tie break reason is limited to 500 characters", has(v("F", { tie_break_reason: "x".repeat(501) }, false), "500"));
ok("F1 wording choice must name a real behaviour", has(v("F", { f1_overrides: ["9"] }, false), "listed values"));

// completeness
ok("A needs both fields to be complete", v("A", {}, true).length === 2);
ok("A complete", v("A", { maturity: "GROWTH", trigger: "Merger." }, true).length === 0);
ok("C needs five KPIs", has(v("C", { ...goodC, kpis: goodC.kpis.slice(0, 4) }, true), "at least 5"));
ok("C complete with five KPIs", v("C", goodC, true).length === 0, JSON.stringify(v("C", goodC, true)));
ok("C: nine KPIs refused even as a draft", has(v("C", { kpis: Array.from({ length: 9 }, (_, i) => kpi("K" + i)) }, false), "at most 8"));
ok("C: duplicate KPI names refused", has(v("C", { ...goodC, kpis: [...goodC.kpis.slice(0, 4), kpi("a")] }, true), "different"));
ok("C: two KPIs on one orientation refused", has(v("C", { ...goodC, kpis: [...goodC.kpis.slice(0, 4), kpi("Z", "ENGAGE")] }, true), "one KPI per orientation"));
ok("C: baseline date in the future refused", has(v("C", { ...goodC, kpis: [{ ...kpi("A"), baseline_date: "2026-12-01" }, ...goodC.kpis.slice(1)] }, true), "future"));
ok("C KPIs get ids K1..K5", S.finalise("C", goodC).kpis.map((k) => k.id).join() === "K1,K2,K3,K4,K5");
ok("E needs six entries", v("E", {}, true).length === 6);
ok("G needs three entries in each list", v("G", { stop_leadership: ["a", "b"] }, true).some((e) => e.includes("at least 3")));
ok("I: languages required to be complete", has(v("I", { anonymity: "FULL" }, true), "Languages"));
ok("I complete", v("I", { ...S.DEFAULTS.I, staff_message: "Why we are doing this.", staff_message_checked: true, cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES" }] }, true).length === 0);

// B cross rules
const B = { intent: "i", horizon: "THREE_YEARS", priorities: [{ text: "p", goal_type: "RESULTS_GROWTH" }], positioning: ["COST"], business_model: "SERVICE_B2C" };
ok("B complete without a planned model", v("B", B, true).length === 0);
ok("planned model equal to current refused", has(v("B", { ...B, planned_model: "SERVICE_B2C", planned_by: "2027-06-01" }, true), "must differ"));
ok("planned model needs planned_by", has(v("B", { ...B, planned_model: "PLATFORM_DIGITAL" }, true), "Planned by: required"));
ok("planned_by without a planned model refused", has(v("B", { ...B, planned_by: "2027-06-01" }, false), "remove it"));
ok("planned_by in the past refused", has(v("B", { ...B, planned_model: "PLATFORM_DIGITAL", planned_by: "2026-01-01" }, true), "past"));
ok("planned_by outside a three-year horizon refused", has(v("B", { ...B, planned_model: "PLATFORM_DIGITAL", planned_by: "2030-01-01" }, true), "horizon"));
ok("planned_by inside the horizon accepted", v("B", { ...B, planned_model: "PLATFORM_DIGITAL", planned_by: "2029-10-03" }, true).length === 0);
ok("a one-year horizon is tighter", has(v("B", { ...B, horizon: "ONE_YEAR", planned_model: "PLATFORM_DIGITAL", planned_by: "2028-01-01" }, true), "horizon"));

// D targets
const kc = S.finalise("C", goodC).kpis;
const kp = [{ ...kc[0], direction: "HIGHER_IS_BETTER", baseline_value: 10 }, { ...kc[1], direction: "LOWER_IS_BETTER", baseline_value: 20 }];
const D = (targets) => ({ targets, winning: "w", board_metrics: "b", non_negotiables: "n" });
ok("D complete with targets in the right direction", v("D", D([{ kpi_id: "K1", target_12m: 15, target_3y: 20 }, { kpi_id: "K2", target_12m: 15 }]), true, kp).length === 0, JSON.stringify(v("D", D([{ kpi_id: "K1", target_12m: 15 }, { kpi_id: "K2", target_12m: 15 }]), true, kp)));
ok("D: a missing 12-month target refused", has(v("D", D([{ kpi_id: "K1", target_12m: 15 }]), true, kp), "12-month target for"));
ok("D: higher-is-better target below baseline refused", has(v("D", D([{ kpi_id: "K1", target_12m: 5 }, { kpi_id: "K2", target_12m: 15 }]), true, kp), "above the baseline"));
ok("D: lower-is-better target above baseline refused", has(v("D", D([{ kpi_id: "K1", target_12m: 15 }, { kpi_id: "K2", target_12m: 25 }]), true, kp), "below the baseline"));
ok("D: target equal to baseline refused", has(v("D", D([{ kpi_id: "K1", target_12m: 10 }, { kpi_id: "K2", target_12m: 15 }]), true, kp), "above the baseline"));
ok("D: target for an unknown KPI refused", has(v("D", D([{ kpi_id: "K9", target_12m: 1 }]), false, kp), "not in Section C"));
ok("D: text target refused", has(v("D", D([{ kpi_id: "K1", target_12m: "15" }]), false, kp), "number"));
ok("D cannot be agreed with no KPIs in C", has(v("D", D([]), true, []), "agree Section C first"));

// F
const beh = (o) => ({ text: "Asks the team before deciding", orientation: o });
const F = (tags, extra = {}) => ({ behaviours: tags.map(beh), staff_behaviours: tags.map(beh), decision_making: "d", collaboration: "c", risk_appetite: "MODERATE", ...extra });
ok("F complete with five tagged behaviours", v("F", F(["ENGAGE", "ENGAGE", "PERFORM", "ENGAGE", "GOVERN"]), true).length === 0);
ok("F: six behaviours refused", has(v("F", F(["ENGAGE", "ENGAGE", "PERFORM", "ENGAGE", "GOVERN", "GOVERN"]), false), "at most 5"));
ok("F: four behaviours not complete", has(v("F", F(["ENGAGE", "ENGAGE", "PERFORM", "ENGAGE"]), true), "at least 5"));
ok("F: f1_tags derived in order", S.finalise("F", F(["ENGAGE", "INNOVATE", "PERFORM", "ENGAGE", "GOVERN"])).f1_tags.join() === "ENGAGE,INNOVATE,PERFORM,ENGAGE,GOVERN");
ok("F: no f1_tags until every behaviour is tagged", !("f1_tags" in S.finalise("F", { behaviours: [{ text: "x y", orientation: "ENGAGE" }, { text: "no tag" }] })));

// kpi_for
const c = S.finalise("C", goodC), d = S.finalise("D", D([{ kpi_id: "K1", target_12m: 15 }, { kpi_id: "K2", target_12m: 20 }]));
const kf = S.deriveKpiFor(c, d);
ok("kpi_for maps orientation to name, baseline, 12-month target", JSON.stringify(kf) === '{"ENGAGE":{"name":"A","baseline":10,"target":15},"INNOVATE":{"name":"B","baseline":10,"target":20}}', JSON.stringify(kf));
ok("kpi_for is undefined with no linked KPI", S.deriveKpiFor(S.finalise("C", { ...goodC, kpis: goodC.kpis.map((k) => ({ ...k, orientation: undefined })) }), d) === undefined);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
