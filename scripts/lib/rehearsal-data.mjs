// Data for the rehearsal: a made up client, "Kilima Foods (rehearsal)", with an organisation of 40 people, the answers for setup
// Sections A to I, and survey answers. Nothing here is real. The same module writes the files the user types or uploads
// (scripts/rehearsal-files.mjs) and drives the end to end check (scripts/rehearsal-verify.mjs), so the guide and the check cannot differ.

export const CLIENT = {
  name: "Kilima Foods (rehearsal)", legal: "Kilima Foods Limited", sector: "Retail", headcount: 40, countries: "KE", tz: "Africa/Nairobi", regime: "KE_DPA_2019", region: "eu-west-1",
};

// ---------------------------------------------------------------- organisation: 3 departments, 5 teams of 8, 5 executives (the floor is 5)
const pad = (n, w = 3) => String(n).padStart(w, "0");
const TEAMS = [["OPS-1", "Warehouse", "OPS"], ["OPS-2", "Delivery", "OPS"], ["FIN-1", "Accounts", "FIN"], ["SAL-1", "Key accounts", "SAL"], ["SAL-2", "Online orders", "SAL"]];
export function orgGraph({ domain = "kilima-rehearsal.example", from = "2026-01-01" } = {}) {
  const grades = [{ name: "Board", rank_order: 1, is_executive: true }, { name: "Executive", rank_order: 2, is_executive: true }, { name: "Manager", rank_order: 3, is_executive: false }, { name: "Staff", rank_order: 4, is_executive: false }];
  const locations = [{ name: "Nairobi" }, { name: "Mombasa" }];
  const units = [{ unit_key: "ORG", name: "Head office", type: "DIVISION", parent_key: null, rollup_to_parent: false },
    { unit_key: "OPS", name: "Operations", type: "DEPARTMENT", parent_key: "ORG", rollup_to_parent: false },
    { unit_key: "FIN", name: "Finance", type: "DEPARTMENT", parent_key: "ORG", rollup_to_parent: false },
    { unit_key: "SAL", name: "Sales", type: "DEPARTMENT", parent_key: "ORG", rollup_to_parent: false },
    ...TEAMS.map(([k, n, p]) => ({ unit_key: k, name: n, type: "TEAM", parent_key: p, rollup_to_parent: false }))];
  const people = [], leaders = [];
  let n = 0;
  TEAMS.forEach(([key], t) => {
    for (let k = 0; k < 8; k++) {
      n++;
      people.push({ employee_ref: `K${pad(n)}`, email: `k${pad(n)}@${domain}`, unit_key: key, grade: k === 0 ? "Executive" : k === 1 ? "Manager" : "Staff", location: t < 2 ? "Mombasa" : "Nairobi", employment_status: "ACTIVE" });
    }
    leaders.push({ employee_ref: people[n - 8].employee_ref, team_key: key, effect_from: from, effect_to: null });
  });
  return { grades, locations, units, people, leaders };
}
const csvCell = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const toCsv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
export const CSV_COLUMNS = { grades: ["name", "rank_order", "is_executive"], locations: ["name"], units: ["unit_key", "name", "type", "parent_key", "rollup_to_parent"],
  people: ["employee_ref", "email", "unit_key", "grade", "location", "employment_status"], leaders: ["employee_ref", "team_key", "effect_from", "effect_to"] };

// ---------------------------------------------------------------- setup Sections A to I, as the guided forms send them
const five = (tags, stem) => tags.map((o, i) => ({ text: `${stem} ${i + 1}`, orientation: o }));
export const F1_TAGS = ["ENGAGE", "ENGAGE", "ENGAGE", "PERFORM", "ENGAGE"];
export const BEHAVIOURS = [
  ["Asks the team for their view before deciding", "ENGAGE"], ["Thanks a person by name for good work each week", "ENGAGE"], ["Explains the reason behind a decision in the team meeting", "ENGAGE"],
  ["Reviews the weekly numbers with the team and agrees one action", "PERFORM"], ["Spends time on the shop floor listening to staff", "ENGAGE"],
];
export const STAFF_BEHAVIOURS = ["Raises a problem early instead of hiding it", "Shares what they learn with the team", "Tries a new way of working on a small scale", "Asks for help when stuck", "Keeps customers informed of delays"];
export const KPIS = [
  { name: "Voluntary attrition (%)", unit: "PERCENT", direction: "LOWER_IS_BETTER", baseline_value: 19, baseline_date: "2026-06-30", source: "HR system", orientation: "ENGAGE", target_12m: 13 },
  { name: "Share of orders placed online (%)", unit: "PERCENT", direction: "HIGHER_IS_BETTER", baseline_value: 28, baseline_date: "2026-06-30", source: "Order system", orientation: "INNOVATE", target_12m: 45 },
  { name: "Order to delivery time (days)", unit: "DAYS", direction: "LOWER_IS_BETTER", baseline_value: 21, baseline_date: "2026-06-30", source: "Operations log", orientation: "GOVERN", target_12m: 7 },
  { name: "Revenue growth (%)", unit: "PERCENT", direction: "HIGHER_IS_BETTER", baseline_value: 4, baseline_date: "2026-06-30", source: "Finance", target_12m: 6 },
  { name: "Customer satisfaction score", unit: "SCORE", direction: "HIGHER_IS_BETTER", baseline_value: 70, baseline_date: "2026-06-30", source: "Customer survey", target_12m: 75 },
];
export const SECTIONS = {
  A: { maturity: "GROWTH", trigger: "The business is moving more orders online and leadership wants a baseline of how people experience the culture before the change." },
  B: { intent: "Grow online ordering while keeping the freshness and service customers trust us for.", horizon: "THREE_YEARS",
    priorities: [{ text: "Grow online ordering", goal_type: "INNOVATION_NEW_MODELS" }, { text: "Differentiate on freshness and service through new digital journeys", goal_type: "INNOVATION_NEW_MODELS" }],
    positioning: ["QUALITY", "INNOVATION"], business_model: "SERVICE_B2C" },
  C: { kpis: KPIS.map(({ target_12m, ...k }) => k), trend: "IMPROVING", biggest_gap: "Decisions take too long to reach the shop floor.", attrition_pct: 19, time_to_hire_days: 45 },
  D: { targets: KPIS.map((k, i) => ({ kpi_id: `K${i + 1}`, target_12m: k.target_12m, ...(i === 2 ? { target_3y: 6 } : {}) })), winning: "Be the first choice for fresh produce ordered online in our cities.", board_metrics: "Attrition, online share and delivery time.", non_negotiables: "Food safety and on time delivery." },
  E: Object.fromEntries([["e1", "Managers decide, staff are told afterwards."], ["e2", "Disagreement is kept quiet and shows up as slow delivery."], ["e3", "Recognition is for hitting the number, rarely for helping someone."],
    ["e4", "A few long serving supervisors hold real influence."], ["e5", "Weekly meetings are long and one way."], ["e6", "Information is held back until it is too late to act."]]),
  F: { behaviours: BEHAVIOURS.map(([text, orientation]) => ({ text, orientation })), staff_behaviours: STAFF_BEHAVIOURS.map((text) => ({ text })), decision_making: "Consultative, with a clear owner for the final call.", collaboration: "Across warehouse, delivery and sales in one weekly huddle.", risk_appetite: "MODERATE" },
  G: { stop_leadership: ["Deciding without asking the team", "Correcting people in front of others", "Holding back bad news"], stop_practices: ["Long one way weekly meetings", "Approvals that need three signatures", "Paper delivery notes"],
    start_leadership: ["Asking for the team's view first", "Thanking people by name", "Sharing numbers openly each week"], start_practices: ["A short weekly huddle across teams", "One page decision rights", "Online delivery confirmation"], keep_protect: ["Our food safety standards"] },
  H: { ...Object.fromEntries([["h1", "Annual review with a yearly rating."], ["h2", "A one day induction, then on the job."], ["h3", "Promotion goes to the best sales or delivery numbers."], ["h4", "Bonuses are paid on volume only."], ["h5", "Approvals wait for the finance manager."], ["h6", "A new online ordering system next year."]]),
    contradiction_h1: false, contradiction_h3: true, contradiction_h4: true },
  I: { cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }], staff_message_checked: true, anonymity: "FULL", languages: ["en"], staff_message: "We are running the Culture Dynamics Profile to understand how work really happens here and how we want it to be. It takes about 40 minutes. Your answers are anonymous: your name is separated from them when you submit, and results are only shown for groups of five or more. Thank you for being honest.", qualitative: "NONE", completion_estimate: "35 to 45 minutes", reminder_plan: "STANDARD" },
};
export const SECTION_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
export const TRANSFER_REFERENCE = "Data transfer agreement with the hosting provider, signed 2 October 2026 (rehearsal placeholder)";

// ---------------------------------------------------------------- survey answers
// Executives see more Engage than staff do, so the Executives and staff panel shows a gap. Staff and executive NOW and PREFERRED follow the
// reference fixture, so the headline figures are recognisable. Everything is deterministic from a seed.
export const PROFILES = {
  staff: { now: [22, 14, 34, 30], pref: [31, 25, 28, 16] },
  exec: { now: [30, 16, 32, 22], pref: [32, 24, 28, 16] },
};
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ORI = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
function alloc(base, r) {
  const w = base.map((b) => Math.max(1, b + Math.round((r() - 0.5) * 10)));
  const s = w.reduce((x, y) => x + y, 0);
  const v = w.map((x) => Math.floor((x / s) * 100));
  v[v.indexOf(Math.max(...v))] += 100 - v.reduce((x, y) => x + y, 0);
  return Object.fromEntries(ORI.map((o, i) => [o, v[i]]));
}
export function surveyPayload(kind, seed) {
  const r = rng(seed), P = PROFILES[kind];
  const sets = (base) => Object.fromEntries(["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => [d, [0, 1, 2].map(() => alloc(base, r))]));
  const lik = (mean) => Array.from({ length: 12 }, () => Math.min(5, Math.max(1, Math.round(mean + (r() - 0.5) * 2.2))));
  return {
    alloc: { NOW: sets(P.now), PREFERRED: sets(P.pref) },
    likert: { D7: lik(3.2), D8: lik(2.8), D9: lik(3.1) },
    eos: Array.from({ length: 8 }, () => Math.min(10, Math.max(0, Math.round(7 + (r() - 0.5) * 6)))),
    qual: ["People care about each other here.", "Decisions are slow and made far from the work.", "Let the people doing the job make more of the decisions."],
  };
}

// the three people the user answers for, by hand
export const PERSONAS = [
  { ref: "K001", name: "Persona A, an executive (Operations leader)", kind: "exec" },
  { ref: "K002", name: "Persona B, a manager", kind: "staff" },
  { ref: "K003", name: "Persona C, a member of staff", kind: "staff" },
];
