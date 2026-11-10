// Savanna Ridge Microfinance: the sample organisation of the PAC reference platform (CDP v6), rebuilt for this platform.
// Made up. Setup text, cohort profiles, readiness levels, employee voice mix and leader styles follow the reference demo;
// the organisation is cut to 48 people (40 answer: 6 executives, 10 managers, 24 staff) so it runs like a first client.
// Used by scripts/seed-savanna.mjs.

export const NAME = "Savanna Ridge Microfinance (demo)";
export const TENANT = { name: NAME, legal_name: "Savanna Ridge Microfinance Limited", sector: "Financial services", geographies: ["KE", "UG"], privacy_regime: "KE_DPA_2019" };

export const DEPTS = [["OPS", "Operations"], ["SAL", "Sales"], ["CRE", "Credit"], ["ITD", "IT"], ["HCM", "Human Capital"], ["FIN", "Finance"]];
const FIRST = ["Amina", "David", "Grace", "Peter", "Wanjiku", "Hassan", "Faith", "Brian", "Achieng", "Moses", "Zawadi", "Kevin", "Esther", "Otieno", "Mercy", "Samuel",
  "Halima", "Collins", "Njeri", "Joseph", "Ruth", "Ibrahim", "Lilian", "Victor", "Purity", "Daniel", "Naliaka", "George", "Winnie", "Abdi", "Janet", "Kiprono",
  "Mary", "Tom", "Rehema", "Paul", "Agnes", "Musa", "Lucy", "Eric", "Sarah", "Juma", "Beatrice", "Felix", "Irene", "Charles", "Asha", "Simon"];
const LAST = ["Odhiambo", "Kimani", "Mutua", "Wanjala", "Nyaga", "Omondi", "Chebet", "Mwangi", "Akinyi", "Kariuki", "Barasa", "Ndungu", "Atieno", "Kiplagat", "Wairimu", "Owino"];

// 8 per department: one executive (who leads the team), two managers, five staff. Tenure spread for the tenure cut.
export function orgGraph(today = Date.now()) {
  const grades = [{ name: "Executive", rank_order: 1, is_executive: true }, { name: "Manager", rank_order: 2, is_executive: false }, { name: "Staff", rank_order: 3, is_executive: false }];
  const units = [{ unit_key: "ORG", name: "Savanna Ridge Microfinance", type: "DIVISION", parent_key: null, rollup_to_parent: false }];
  const people = [], leaders = [];
  let n = 0;
  for (const [key, name] of DEPTS) {
    units.push({ unit_key: key, name, type: "DEPARTMENT", parent_key: "ORG", rollup_to_parent: false });
    units.push({ unit_key: `${key}-T1`, name: `${name} team`, type: "TEAM", parent_key: key, rollup_to_parent: false });
    for (let k = 0; k < 8; k++) {
      const months = [8, 20, 44, 70, 130][(n * 3 + k) % 5];
      people.push({ employee_ref: `S${String(++n).padStart(3, "0")}`, email: `s${String(n).padStart(3, "0")}@savannaridge.example`, unit_key: `${key}-T1`,
        grade: k === 0 ? "Executive" : k < 3 ? "Manager" : "Staff", location: n % 5 < 3 ? "Nairobi" : "Kampala", employment_status: "ACTIVE",
        display_name: `${FIRST[n - 1]} ${LAST[(n * 5) % LAST.length]}`, start_date: new Date(today - months * 30.4 * 864e5).toISOString().slice(0, 10), _dept: key, _k: k });
    }
    leaders.push({ employee_ref: people[n - 8].employee_ref, team_key: `${key}-T1`, effect_from: "2025-01-01", effect_to: null });
  }
  // the two leaders of the reference demo keep their names
  people[0].display_name = "Amina Odhiambo"; people[8].display_name = "David Kimani";
  return { grades, locations: [{ name: "Nairobi" }, { name: "Kampala" }], units, people, leaders };
}

// ---------------------------------------------------------------- setup A to I (reference demo wording, in the guided form shape)
const KPIS = [
  { name: "Active customers", unit: "COUNT", direction: "HIGHER_IS_BETTER", baseline_value: 298000, baseline_date: "2026-06-30", source: "Core banking", target_12m: 340000, target_3y: 600000 },
  { name: "Portfolio at risk, 30 days (%)", unit: "PERCENT", direction: "LOWER_IS_BETTER", baseline_value: 5.1, baseline_date: "2026-06-30", source: "Credit risk", orientation: "GOVERN", target_12m: 4.5, target_3y: 4 },
  { name: "Digital transaction share (%)", unit: "PERCENT", direction: "HIGHER_IS_BETTER", baseline_value: 22, baseline_date: "2026-06-30", source: "Channels", orientation: "INNOVATE", target_12m: 35, target_3y: 60 },
  { name: "Voluntary attrition (%)", unit: "PERCENT", direction: "LOWER_IS_BETTER", baseline_value: 18, baseline_date: "2026-06-30", source: "HR system", orientation: "ENGAGE", target_12m: 14, target_3y: 10 },
  { name: "Loan processing (days)", unit: "DAYS", direction: "LOWER_IS_BETTER", baseline_value: 9, baseline_date: "2026-06-30", source: "Loan system", orientation: "PERFORM", target_12m: 5 },
];
export const F1_TAGS = ["ENGAGE", "ENGAGE", "INNOVATE", "ENGAGE", "ENGAGE"];
export const SECTIONS = {
  A: { maturity: "MATURE", context: "Savanna Ridge Microfinance, Kenya and Uganda, 412 staff (48 in this demo).",
    trigger: "New three year digital first strategy approved by the board; attrition rising in field roles; two failed change programmes in the past four years." },
  B: { intent: "Become East Africa's most trusted digital first microfinance institution: double the active customer base to 600,000 while keeping portfolio at risk under 4%.",
    horizon: "THREE_YEARS",
    priorities: [{ ref: "B3.1", text: "Digital channel migration: 60% of transactions digital by year 3", goal_type: "TRANSFORMATION" },
      { ref: "B3.2", text: "SME lending growth in secondary towns", goal_type: "RESULTS_GROWTH" },
      { ref: "B3.3", text: "Talent retention and frontline capability", goal_type: "PEOPLE_TALENT" }],
    positioning: ["RELATIONSHIPS", "QUALITY"], business_model: "SERVICE_B2C", planned_model: "PLATFORM_DIGITAL" },
  C: { kpis: KPIS.map(({ target_12m, target_3y, ...k }) => k), trend: "DECLINING",
    biggest_gap: "Digital transaction share (22% against a 35% target) and loan processing speed (9 days against 5): both losing customers to mobile first competitors.", attrition_pct: 18, time_to_hire_days: 64 },
  D: { targets: KPIS.map((k, i) => ({ kpi_id: `K${i + 1}`, target_12m: k.target_12m, ...(k.target_3y ? { target_3y: k.target_3y } : {}) })),
    winning: "600,000 active customers served at over 90% satisfaction, with portfolio at risk under 4% and half of all lending decisions automated.",
    board_metrics: "EBITDA margin; portfolio quality; customer growth; regulator standing.", non_negotiables: "Central Bank prudential ratios; zero tolerance on fraud; data protection compliance; loan loss provisioning floors." },
  E: { e1: "Top down and slow. Anything above KES 50,000 goes to head office; branch managers wait days for approvals that competitors make in hours.",
    e2: "Suppressed. Disagreement is read as disloyalty; issues travel as corridor whispers, not agenda items. Two exit interviews this year cited fear of speaking up.",
    e3: "Sales numbers get the podium at the annual awards; careful risk work and people development are invisible. Overtime is worn as a badge.",
    e4: "Long tenured branch managers and the head of credit hold great informal influence; the analytics team has ideas but no voice.",
    e5: "Meetings are briefings, not discussions. Seniors speak first and last; real decisions happen after the meeting.",
    e6: "Blame after losses; weekend work glorified; a manager known for intimidation tolerated for years because his branch hits target." },
  F: { f1_tags: F1_TAGS, tie_break: null,
    behaviours: [["Holds a monthly coaching conversation with each direct report", "ENGAGE"], ["Opens key meetings by inviting dissenting views", "ENGAGE"],
      ["Delegates approval authority to defined limits", "INNOVATE"], ["Shares the reason behind every major decision within 48 hours", "ENGAGE"], ["Publicly credits teams, not just individuals", "ENGAGE"]].map(([text, orientation]) => ({ text, orientation })),
    staff_behaviours: ["Raises problems within 24 hours of spotting them", "Proposes one improvement each quarter", "Shares customer insight across departments weekly", "Uses the new digital tools as the default channel", "Takes annual leave fully"].map((text) => ({ text })),
    decision_making: "Delegated within clear risk limits: branch managers decide to KES 250,000; credit automation for standard products; committee only for exceptions.",
    collaboration: "Cross functional squads for each strategic priority with shared objectives, meeting monthly.", risk_appetite: "MODERATE" },
  G: { stop_leadership: ["Overriding delegated decisions", "Midnight emails and weekend calls", "Shooting the messenger who brings bad news"],
    stop_practices: ["The triple signature approval chain for routine spend", "The annual only appraisal cycle", "Turf based budget allocation"],
    start_leadership: ["Monthly one to one coaching", "Pre mortems on major decisions", "Publishing the reasons for decisions"],
    start_practices: ["Delegated approval limits", "Quarterly pulse surveys with published responses", "Cross functional squads"],
    keep_protect: ["Customer trust and community reputation", "Audit discipline and portfolio quality", "The loyalty and knowledge of long serving staff"],
    objectives: [{ ref: "B3.1", text: "Digital channel migration" }, { ref: "B3.2", text: "SME lending growth" }, { ref: "B3.3", text: "Talent retention" }],
    kpi_for: { INNOVATE: { name: "Digital transaction share (%)", baseline: 22, target: 35 }, ENGAGE: { name: "Voluntary attrition (%)", baseline: 18, target: 14 }, GOVERN: { name: "Portfolio at risk, 30 days (%)", baseline: 5.1, target: 4.5 } } },
  H: { h1: "Annual appraisal against sales and portfolio targets; a five point rating drives the bonus pool. No development component.",
    h2: "One week induction at head office focused on compliance and products.", h3: "Tenure plus target achievement; people leadership is not assessed.",
    h4: "Quarterly sales incentives for field staff; head office bonus tied to profit. Nothing rewards collaboration, digital adoption or team development.",
    h5: "Loan approvals stall at the credit committee (median 6 days); procurement takes 3 weeks.", h6: "Core banking replacement begins in 14 months; agent network rollout in year 2.",
    contradiction_h1: true, contradiction_h3: true, contradiction_h4: true },
  I: { cohorts: [{ name: "Executives", axis1: "EXECUTIVE", value1: "YES", rollup_to_parent: true }], staff_message_checked: true, anonymity: "FULL", languages: ["en"], consent_text_version: 1, qualitative: "OPEN_QUESTIONS", completion_estimate: "35 to 45 minutes", reminder_plan: "STANDARD",
    staff_message: "We are measuring our culture honestly: where it is today and where it must be to deliver our digital first strategy. Responses are anonymous and reported only in groups. Leadership commits to publishing the findings and the first three actions within 30 days of closing." },
};

// ---------------------------------------------------------------- answers (reference demo profiles)
export const PROFILES = {
  Executive: { now: [30, 20, 28, 22], d7: 3.4, d8: 3.4, d9: 3.5 },
  Manager: { now: [22, 18, 28, 32], d7: 2.9, d8: 2.7, d9: 3.0 },
  Staff: { now: [19, 17, 28, 36], d7: 2.7, d8: 2.4, d9: 2.9 },
};
export const PREF = [28, 27, 24, 21];
// share of promoters and passives per employee voice question (the rest score 3 to 6)
export const EOS_MIX = [[0.35, 0.45], [0.20, 0.45], [0.12, 0.38], [0.25, 0.40], [0.15, 0.45], [0.10, 0.30], [0.35, 0.45], [0.18, 0.47]];
export const QUAL = [
  ["The way this team pulls together when a client is in trouble is remarkable.", "Every decision, however small, must go up the chain. It exhausts initiative.", "Give managers real decision authority within clear limits."],
  ["Our compliance record: five clean audits in a row.", "Speaking up in meetings is risky.", "Create a safe way to raise problems without being marked as a troublemaker."],
  ["Colleagues genuinely help each other.", "We punish mistakes instead of learning from them, so people hide problems.", "Replace the annual appraisal with honest quarterly conversations about growth."],
  ["The organisation honours its commitments to customers even when it costs us.", "New ideas die in committees. The mobile lending pilot took fourteen months.", "Modernise the core system."],
  ["Long serving staff share their knowledge willingly.", "I spend more time documenting work than doing it.", "Celebrate the people who prevent problems, not only those who hit sales numbers."],
  ["We deliver what we promise. Targets are met and the numbers are honest.", "Credit and Sales barely speak except to blame each other.", "Let branches pilot small experiments without head office sign off."],
  ["Loyalty is real here.", "Promotion rewards tenure and compliance, not contribution or ideas.", "Stop the midnight emails. Leaders should model the balance they preach."],
  ["The credit team's discipline is exceptional.", "We hear the what, never the why.", "Give Credit and Sales shared targets so they win together."],
  ["Our branches reach customers other institutions ignore.", "The core banking system is from 2009 and keeps being patched.", "Involve staff in decisions that affect their daily work."],
  ["Training is taken seriously and the budget is protected.", "Month end means midnight emails and weekend calls, every month.", "Reward managers for developing people, not just for output."],
];

// ---------------------------------------------------------------- Leadership 360 for the two leaders of the reference demo
// section means A to H (1 to 5), self and as raters see them
export const L360 = {
  OPS: { self: [4.4, 3.4, 3.8, 4.5, 4.6, 4.0, 3.8, 4.4], raters: [4.2, 2.6, 3.6, 4.4, 4.5, 3.2, 3.4, 4.3] },
  SAL: { self: [3.6, 4.3, 4.7, 3.4, 4.3, 4.0, 4.2, 3.6], raters: [2.8, 3.9, 4.6, 2.7, 3.8, 3.3, 4.0, 3.1] },
};
export const REPORT_TEXT = {
  what_this_means: "Savanna Ridge runs on Govern and Perform today, most strongly among staff, while executives see a warmer, more people centred culture than staff experience. People across every level want more Engage and Innovate, which the digital first strategy depends on. Psychological safety is the weakest readiness measure.",
  what_to_do_next: "Agree the pre conditions with the executive team, then start where the gap and the speaking up concern are largest: delegate approval limits, publish the reasons for decisions, and open meetings to challenge. Pulse at 90 days.",
};
