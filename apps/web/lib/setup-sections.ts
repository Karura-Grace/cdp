// Setup Sections A to I (spec §1.4.2, Table 16): one declarative schema that drives the guided form AND the server check.
// Pure TypeScript with no imports, so the browser bundle can use it (the engine needs node:crypto and cannot go there).
//
// Two strengths of check:
//   shape    (every save)  types, enums, lengths, list maximums. A draft may be half empty.
//   complete (to agree)    required fields present, list minimums met, cross-field rules.
// These are form-structure rules from Table 16. Scoring rules and thresholds stay in the engine.

export const MATURITY = ["START_UP", "GROWTH", "MATURE", "TURNAROUND", "POST_MERGER"] as const;
export const HORIZON = ["ONE_YEAR", "THREE_YEARS", "FIVE_YEARS"] as const;
export const GOAL_TYPES = ["RESULTS_GROWTH", "INNOVATION_NEW_MODELS", "PEOPLE_TALENT", "COMPLIANCE_PROCESS", "TRANSFORMATION"] as const;
export const POSITIONING = ["COST", "INNOVATION", "RELATIONSHIPS", "QUALITY", "SPEED", "OTHER"] as const;
export const MODELS = ["PRODUCT_B2B", "SERVICE_B2C", "PLATFORM_DIGITAL", "NGO_SOCIAL_IMPACT", "REGULATED"] as const;
export const UNITS = ["PERCENT", "COUNT", "CURRENCY", "RATIO", "DAYS", "SCORE", "OTHER"] as const;
export const DIRECTION = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER"] as const;
export const TREND = ["IMPROVING", "STABLE", "DECLINING"] as const;
export const ORIENTS = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
export const RISK = ["CONSERVATIVE", "MODERATE", "AMBITIOUS"] as const;
export const ANONYMITY = ["FULL", "CONFIDENTIAL_AGGREGATE"] as const;
export const QUALITATIVE = ["NONE", "INTERVIEWS", "FOCUS_GROUPS", "BOTH"] as const;
export const REMINDER = ["STANDARD", "CUSTOM"] as const;
export const LANGUAGES = ["en"] as const;                 // only locales with a published item bank (spec I3)

import { COHORT_AXES, REMINDER_AUDIENCE, REMINDER_KINDS, RECOMMENDED_QUALITATIVE, crossI } from "./section-i.mjs";

export type Leaf =
  | { t: "text"; max: number; rows?: number }
  | { t: "enum"; options: readonly string[] }
  | { t: "multi"; options: readonly string[] }
  | { t: "date" }
  | { t: "num"; min: number; max: number; int?: boolean; dp?: number }
  | { t: "bool" };
export type Field = { key: string; label: string; hint?: string; req?: boolean } & (
  | Leaf
  | { t: "group"; fields: Field[] }
  | { t: "list"; min: number; max: number; of: Leaf | { t: "group"; fields: Field[] }; addLabel?: string }
  | { t: "targets" }                                    // Section D: one row per Section C KPI (built by the form)
);
export type Json = Record<string, unknown>;

const T = (key: string, label: string, max: number, o: Partial<Field> & { rows?: number } = {}): Field => ({ key, label, t: "text", max, req: true, ...o }) as Field;
const E = (key: string, label: string, options: readonly string[], o: Partial<Field> = {}): Field => ({ key, label, t: "enum", options, req: true, ...o }) as Field;

export const SECTION_TITLES: Record<string, string> = {
  A: "Organisation context", B: "Strategy and business model", C: "Performance and scorecard", D: "Targets and standards",
  E: "Lived culture", F: "Target behaviours", G: "Stop, start and keep", H: "Processes and enablers", I: "Survey design",
};

const E_LABELS = ["Decisions", "Conflict", "Recognition", "Informal power", "Meetings", "Dysfunctional patterns"];
const H_LABELS = ["Performance management", "Onboarding", "Promotion criteria", "Reward", "Bottlenecks", "Planned changes"];
const list = (key: string, label: string, min: number, max: number, hint?: string): Field =>
  ({ key, label, hint, t: "list", min, max, req: min > 0, of: { t: "text", max: 300 }, addLabel: "Add another" });

export const SECTIONS: Record<string, Field[]> = {
  A: [
    E("maturity", "A5 Maturity stage", MATURITY),
    T("trigger", "A6 Why the organisation is doing this assessment", 2000, { rows: 4, hint: "Shown in the method section of the report." }),
    T("sponsor_name", "Staff message signed by: name", 120, { req: false, hint: "The CEO or MD. The staff message is written in their voice and ends with their name." }),
    T("sponsor_role", "Staff message signed by: job title", 120, { req: false }),
    T("help_name", "Help contact for staff: name", 120, { req: false, hint: "Usually the Client Admin. Staff are told to write to this person and to the PAC mailbox." }),
    T("help_email", "Help contact for staff: email", 200, { req: false }),
  ],
  B: [
    T("intent", "B1 Strategic intent", 1000, { rows: 3, hint: "One to three sentences." }),
    E("horizon", "B2 Strategic horizon", HORIZON),
    { key: "priorities", label: "B3 Top strategic priorities", t: "list", min: 1, max: 3, req: true, addLabel: "Add a priority",
      hint: "Each priority has exactly one goal type; the goal type sets the culture requirement.",
      of: { t: "group", fields: [T("text", "Priority", 300), E("goal_type", "Goal type", GOAL_TYPES)] } },
    { key: "positioning", label: "B4 Competitive positioning", t: "multi", options: POSITIONING, req: true },
    T("market_shift", "B5 Market or customer shift", 1000, { req: false, rows: 3 }),
    E("business_model", "B6 Business model today", MODELS),
    E("planned_model", "Planned business model", MODELS, { req: false, hint: "Only if the organisation is moving to a different model." }),
    { key: "planned_by", label: "Planned by", t: "date", hint: "Within the strategic horizon. Required with a planned model." },
  ],
  C: [
    { key: "kpis", label: "C1 to C2 Key performance indicators and baselines", t: "list", min: 5, max: 8, req: true, addLabel: "Add a KPI",
      hint: "Five to eight KPIs. Optionally link a KPI to the orientation it should move; at most one KPI per orientation.",
      of: { t: "group", fields: [
        T("name", "KPI", 120), E("unit", "Unit", UNITS), E("direction", "Direction", DIRECTION),
        { key: "baseline_value", label: "Baseline value", t: "num", min: -1e12, max: 1e12, req: true },
        { key: "baseline_date", label: "Baseline date", t: "date", req: true },
        T("source", "Source", 200), E("orientation", "Orientation it tracks", ORIENTS, { req: false }),
      ] } },
    E("trend", "C3 Performance trend", TREND),
    T("biggest_gap", "C4 Biggest performance gap", 1000, { rows: 3 }),
    { key: "attrition_pct", label: "C5 Voluntary attrition (%)", t: "num", min: 0, max: 100, dp: 2, req: true, hint: "Up to two decimal places." },
    { key: "time_to_hire_days", label: "C6 Average time to hire (days)", t: "num", min: 0, max: 365, int: true },
  ],
  D: [
    { key: "targets", label: "D1 to D2 Targets for each KPI", t: "targets", req: true },
    T("winning", "D3 Definition of winning", 1000, { rows: 3 }),
    T("board_metrics", "D4 Board metrics", 1000, { rows: 3 }),
    T("non_negotiables", "D5 Non-negotiable standards", 1000, { rows: 3, hint: "Feeds the Keep and protect narrative for Govern." }),
  ],
  E: E_LABELS.map((l, i) => T(`e${i + 1}`, `E${i + 1} ${l}`, 2000, { rows: 3 })),
  F: [
    { key: "behaviours", label: "F1 Target leadership behaviours", t: "list", min: 5, max: 5, req: true, addLabel: "Add a behaviour",
      hint: "Describe what someone would see the leader do. Tag each with the orientation it belongs to.",
      of: { t: "group", fields: [T("text", "Observable behaviour", 300), E("orientation", "Orientation", ORIENTS)] } },
    { key: "staff_behaviours", label: "F2 Target staff behaviours", t: "list", min: 5, max: 5, req: true, addLabel: "Add a behaviour",
      of: { t: "group", fields: [T("text", "Behaviour", 300), E("orientation", "Orientation (optional)", ORIENTS, { req: false })] } },
    T("decision_making", "F3 Decision-making model", 1000, { rows: 3 }),
    T("collaboration", "F4 Collaboration model", 1000, { rows: 3 }),
    E("risk_appetite", "F5 Innovation risk appetite", RISK, { hint: "Shown beside Innovate results. It does not change any threshold." }),
    E("tie_break", "Tie-break orientation", ORIENTS, { req: false, hint: "Only if two orientations tie among the F1 tags." }),
    T("tie_break_reason", "Tie-break reason", 500, { req: false, rows: 2, hint: "Required with a tie-break: why this orientation decides it." }),
    { key: "f1_overrides", label: "F1 wording warnings accepted", t: "multi", options: ["1", "2", "3", "4", "5"], hint: "Tick the F1 behaviours whose wording warning you accept as written." },
  ],
  G: [
    list("stop_leadership", "G1 Stop: leadership behaviours", 3, 5), list("stop_practices", "G2 Stop: practices", 3, 5),
    list("start_leadership", "G3 Start: leadership behaviours", 3, 5), list("start_practices", "G4 Start: practices", 3, 5),
    list("keep_protect", "G5 Keep and protect (workshop entries)", 0, 10, "The system adds its own entries after scoring."),
  ],
  H: [
    ...H_LABELS.map((l, i) => T(`h${i + 1}`, `H${i + 1} ${l}`, 2000, { rows: 3 })),
    { key: "contradiction_h1", label: "H1 contradicts what happens in practice", t: "bool" },
    { key: "contradiction_h3", label: "H3 contradicts what happens in practice", t: "bool" },
    { key: "contradiction_h4", label: "H4 contradicts what happens in practice", t: "bool" },
  ],
  I: [
    { key: "cohorts", label: "I1 Cohorts", t: "list", min: 1, max: 12, req: true, addLabel: "Add a cohort",
      hint: "Named groups of staff the results will be cut by. Each has one to five conditions, and all of them must hold; the size is projected from the organisation record and must be at least 5 unless the cohort rolls up to its parent. For Executive the value is YES or NO; for Demographic write Attribute=Value; otherwise write the name as it appears in the organisation record.",
      of: { t: "group", fields: [
        T("name", "Cohort name", 80), E("axis1", "Condition 1: axis", COHORT_AXES), T("value1", "Condition 1: value", 120),
        E("axis2", "Condition 2: axis (optional)", COHORT_AXES, { req: false }), T("value2", "Condition 2: value", 120, { req: false }),
        E("axis3", "Condition 3: axis (optional)", COHORT_AXES, { req: false }), T("value3", "Condition 3: value", 120, { req: false }),
        E("axis4", "Condition 4: axis (optional)", COHORT_AXES, { req: false }), T("value4", "Condition 4: value", 120, { req: false }),
        E("axis5", "Condition 5: axis (optional)", COHORT_AXES, { req: false }), T("value5", "Condition 5: value", 120, { req: false }),
        { key: "rollup_to_parent", label: "Roll up to parent if too small", t: "bool" },
      ] } },
    { key: "demographics", label: "I1 Demographic attributes", t: "list", min: 0, max: 10, req: false, addLabel: "Add an attribute",
      hint: "Optional attributes the results can be cut by, declared here and recorded for the organisation when Section I is agreed. Each has a closed list of values (separated by semicolons) and a stated analytical purpose. A sensitive attribute always offers \"Prefer not to say\". A cohort can use one as Demographic with Attribute=Value.",
      of: { t: "group", fields: [
        T("name", "Attribute name", 60), T("values", "Values (separated by semicolons)", 900),
        { key: "is_sensitive", label: "Sensitive attribute", t: "bool" }, T("analytical_purpose", "Analytical purpose (why it is needed)", 500, { rows: 2 }),
      ] } },
    E("anonymity", "I2 Anonymity commitment", ANONYMITY, { hint: "Full is recommended. Both apply the same reporting floors; the choice changes only the wording of the staff message." }),
    { key: "languages", label: "I3 Languages", t: "multi", options: LANGUAGES, req: true },
    T("staff_message", "I5 Message to staff", 3000, { rows: 8, hint: "State the purpose, how results will be used, the anonymity commitment and what happens next. A template for the chosen anonymity commitment is offered under Launch checks, marked DRAFT until the owner approves it." }),
    { key: "staff_message_checked", label: "I5 This message states the purpose, how results are used, the anonymity commitment and what happens next", t: "bool" },
    E("qualitative", "I6 Qualitative complement", QUALITATIVE),
    { key: "interviews_planned", label: "I6 Interviews planned", t: "num", min: 0, max: 500, int: true, hint: "Recommended minimum: " + RECOMMENDED_QUALITATIVE.interviews + " interviews." },
    { key: "focus_groups_planned", label: "I6 Focus groups planned", t: "num", min: 0, max: 100, int: true, hint: "Recommended minimum: " + RECOMMENDED_QUALITATIVE.focus_groups + " focus groups." },
    T("completion_estimate", "Completion-time statement", 60),
    E("reminder_plan", "Reminder plan", REMINDER, { hint: "Standard: working day 3, working day 6, 24 hours before close, and a final reminder to people who started and have not submitted. A custom plan needs the consultant's approval." }),
    { key: "reminder_custom", label: "Custom reminders", t: "list", min: 0, max: 6, req: false, addLabel: "Add a reminder",
      of: { t: "group", fields: [E("kind", "When", REMINDER_KINDS), { key: "n", label: "How many", t: "num", min: 1, max: 168, int: true, req: true }, E("audience", "Sent to", REMINDER_AUDIENCE)] } },
    { key: "reminder_custom_approved", label: "I approve this custom reminder plan", t: "bool" },
  ],
};

export const DEFAULTS: Record<string, Json> = {
  I: { anonymity: "FULL", languages: ["en"], qualitative: "NONE", completion_estimate: "35–45 minutes", reminder_plan: "STANDARD" },
};

// ---------------------------------------------------------------- sanitize: keep only schema fields, trim text, drop empties

const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
function clean(f: Field | Leaf | { t: "group"; fields: Field[] }, v: unknown): unknown {
  switch (f.t) {
    case "text": return typeof v === "string" ? v.trim() : v;
    case "group": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return v;
      const out: Json = {};
      for (const g of f.fields) { const c = clean(g, (v as Json)[g.key]); if (!empty(c)) out[g.key] = c; }
      return out;
    }
    case "list": {
      if (!Array.isArray(v)) return v;
      return v.map((x) => clean(f.of, x)).filter((x) => !empty(x) && !(typeof x === "object" && x !== null && !Array.isArray(x) && Object.keys(x).length === 0));
    }
    case "multi": return Array.isArray(v) ? [...new Set(v)] : v;
    default: return v;
  }
}
export function sanitize(section: string, payload: Json): Json {
  const out: Json = {};
  for (const f of SECTIONS[section] ?? []) { const c = clean(f, payload[f.key]); if (!empty(c) || f.t === "bool") if (c !== undefined) out[f.key] = c; }
  return out;
}

// ---------------------------------------------------------------- validate

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

function leaf(f: Leaf, v: unknown, label: string, out: string[]) {
  switch (f.t) {
    case "text": if (typeof v !== "string") out.push(`${label}: must be text`); else if (v.length > f.max) out.push(`${label}: at most ${f.max} characters`); break;
    case "enum": if (typeof v !== "string" || !f.options.includes(v)) out.push(`${label}: choose one of the listed values`); break;
    case "multi": if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !f.options.includes(x))) out.push(`${label}: choose from the listed values`); break;
    case "date": if (!isDay(v)) out.push(`${label}: must be a date (YYYY-MM-DD)`); break;
    case "num":
      if (typeof v !== "number" || !Number.isFinite(v)) out.push(`${label}: must be a number`);
      else if (v < f.min || v > f.max) out.push(`${label}: must be between ${f.min} and ${f.max}`);
      else if (f.int && !Number.isInteger(v)) out.push(`${label}: must be a whole number`);
      else if (f.dp !== undefined && Math.abs(v * 10 ** f.dp - Math.round(v * 10 ** f.dp)) > 1e-6) out.push(`${label}: at most ${f.dp} decimal places`);
      break;
    case "bool": if (typeof v !== "boolean") out.push(`${label}: must be yes or no`); break;
  }
}

function walk(fields: Field[], obj: Json, complete: boolean, prefix: string, out: string[]) {
  for (const f of fields) {
    const v = obj[f.key], label = prefix + f.label;
    if (f.t === "targets") continue;                  // checked by the Section D cross rule
    if (empty(v) && !(f.t === "bool" && v === false)) { if (complete && f.req) out.push(`${label}: required`); continue; }
    if (f.t === "group") {
      if (typeof v !== "object" || Array.isArray(v)) out.push(`${label}: invalid`);
      else walk(f.fields, v as Json, complete, label + " / ", out);
    } else if (f.t === "list") {
      if (!Array.isArray(v)) { out.push(`${label}: must be a list`); continue; }
      if (v.length > f.max) out.push(`${label}: at most ${f.max} entries`);
      if (complete && v.length < f.min) out.push(`${label}: at least ${f.min} entries (has ${v.length})`);
      v.forEach((it, i) => {
        const l = `${label} ${i + 1}`;
        if (f.of.t === "group") {
          if (!it || typeof it !== "object" || Array.isArray(it)) out.push(`${l}: invalid`);
          else walk(f.of.fields, it as Json, complete, l + " / ", out);
        } else leaf(f.of, it, l, out);
      });
    } else leaf(f, v, label, out);
  }
}

/** Sentences in a text, split after . ! or ?. ponytail: an abbreviation such as "e.g." counts as a break; use a proper splitter if PAC writes long intents. */
export const sentenceCount = (t: string) => t.trim().split(/(?<=[.!?])\s+/).filter(Boolean).length;

const YEARS = { ONE_YEAR: 1, THREE_YEARS: 3, FIVE_YEARS: 5 } as const;
const plusYears = (day: string, y: number) => `${+day.slice(0, 4) + y}${day.slice(4)}`;

export interface Ctx { today: string; kpis?: Json[] }

/** Cross-field rules. `complete` rules only apply when agreeing. */
function cross(section: string, p: Json, complete: boolean, ctx: Ctx, out: string[]) {
  if (section === "B") {
    if (typeof p.intent === "string" && sentenceCount(p.intent) > 3) out.push("B1 Strategic intent: one to three sentences");
    const cur = p.business_model, plan = p.planned_model, by = p.planned_by;
    if (plan && cur && plan === cur) out.push("Planned business model: must differ from the model today");
    if (plan && complete && !by) out.push("Planned by: required with a planned model");
    if (!plan && by) out.push("Planned by: remove it, or choose a planned model");
    if (plan && isDay(by)) {
      if (by < ctx.today) out.push("Planned by: must not be in the past");
      const years = YEARS[p.horizon as keyof typeof YEARS];
      if (years && by > plusYears(ctx.today, years)) out.push("Planned by: must fall inside the strategic horizon");
    }
  }
  if (section === "C") {
    const ks = (p.kpis as Json[] | undefined) ?? [];
    const names = ks.map((k) => String(k.name ?? "").toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) out.push("KPIs: each KPI name must be different");
    const os = ks.map((k) => k.orientation).filter(Boolean);
    if (new Set(os).size !== os.length) out.push("KPIs: at most one KPI per orientation");
    ks.forEach((k, i) => { if (isDay(k.baseline_date) && (k.baseline_date as string) > ctx.today) out.push(`KPIs ${i + 1}: baseline date must not be in the future`); });
  }
  if (section === "D") {
    const kpis = ctx.kpis ?? [];
    const ts = (p.targets as Json[] | undefined) ?? [];
    const ids = new Set(kpis.map((k) => k.id));
    for (const t of ts) if (!ids.has(t.kpi_id)) out.push("Targets: a target refers to a KPI that is not in Section C");
    if (complete) {
      if (!kpis.length) out.push("Targets: agree Section C first so there are KPIs to set targets for");
      for (const k of kpis) {
        const t = ts.find((x) => x.kpi_id === k.id);
        if (!t || typeof t.target_12m !== "number") { out.push(`Targets: the 12-month target for "${k.name}" is required`); continue; }
        const up = k.direction === "HIGHER_IS_BETTER", base = k.baseline_value as number;
        for (const [key, name] of [["target_12m", "12-month"], ["target_3y", "3-year"]] as const) {
          const x = t[key];
          if (typeof x === "number" && !(up ? x > base : x < base)) out.push(`Targets: the ${name} target for "${k.name}" must be ${up ? "above" : "below"} the baseline (${base})`);
        }
      }
    }
    for (const t of ts) for (const key of ["target_12m", "target_3y"] as const) if (t[key] !== undefined && typeof t[key] !== "number") out.push("Targets: must be numbers");
  }
  if (section === "F" && complete) {
    const tags = ((p.behaviours as Json[] | undefined) ?? []).map((b) => b.orientation);
    if (tags.length !== 5 || tags.some((t) => !ORIENTS.includes(t as never))) out.push("F1: five behaviours, each tagged with an orientation");
  }
  if (section === "I") {
    if (complete && !(p.languages as string[] | undefined)?.length) out.push("I3 Languages: choose at least one");
    crossI(p, complete, out);
  }
}

/** Errors for a payload. Pass `complete` when agreeing. */
export function validateSection(section: string, payload: Json, opts: { complete: boolean; ctx: Ctx }): string[] {
  const fields = SECTIONS[section];
  if (!fields) return ["Unknown section"];
  const out: string[] = [];
  if (section === "D") validateTargets(payload, out);
  walk(fields, payload, opts.complete, "", out);
  cross(section, payload, opts.complete, opts.ctx, out);
  return out;
}

function validateTargets(p: Json, out: string[]) {
  const ts = p.targets;
  if (ts === undefined) return;
  if (!Array.isArray(ts) || ts.length > 8) { out.push("Targets: invalid"); return; }
  for (const t of ts) {
    if (!t || typeof t !== "object" || typeof (t as Json).kpi_id !== "string") { out.push("Targets: invalid row"); continue; }
    for (const key of ["target_12m", "target_3y"]) {
      const x = (t as Json)[key];
      if (x !== undefined && (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > 1e12)) out.push(`Targets: ${key} must be a number`);
    }
  }
}

/** Sanitize, then fill what the engine reads: priority refs, KPI ids, F1 tags. */
export function finalise(section: string, raw: Json): Json {
  if (section === "D") {
    const ts = Array.isArray(raw.targets) ? (raw.targets as Json[]) : [];
    const p = sanitize(section, { ...raw, targets: undefined });
    p.targets = ts.filter((t) => t && typeof t === "object" && typeof t.kpi_id === "string").map((t) => {
      const o: Json = { kpi_id: t.kpi_id };
      if (t.target_12m !== undefined && t.target_12m !== null && t.target_12m !== "") o.target_12m = t.target_12m;
      if (t.target_3y !== undefined && t.target_3y !== null && t.target_3y !== "") o.target_3y = t.target_3y;
      return o;
    });
    return p;
  }
  const p = sanitize(section, raw);
  if (section === "B" && Array.isArray(p.priorities)) p.priorities = (p.priorities as Json[]).map((x, i) => ({ ref: `B3.${i + 1}`, ...x }));
  if (section === "C" && Array.isArray(p.kpis)) p.kpis = (p.kpis as Json[]).map((x, i) => ({ id: `K${i + 1}`, ...x }));
  if (section === "F" && Array.isArray(p.behaviours)) {
    const tags = (p.behaviours as Json[]).map((b) => b.orientation);
    if (tags.every((t) => ORIENTS.includes(t as never))) p.f1_tags = tags;
  }
  return p;
}

/** Engine input kpi_for (orientation -> KPI) from Sections C and D. The 12-month target is the one the engine reads. */
export function deriveKpiFor(c: Json | undefined, d: Json | undefined): Record<string, { name: string; baseline: number; target: number }> | undefined {
  const kpis = (c?.kpis as Json[] | undefined) ?? [], ts = (d?.targets as Json[] | undefined) ?? [];
  const out: Record<string, { name: string; baseline: number; target: number }> = {};
  for (const k of kpis) {
    const t = ts.find((x) => x.kpi_id === k.id);
    if (k.orientation && t && typeof t.target_12m === "number" && typeof k.baseline_value === "number")
      out[k.orientation as string] = { name: k.name as string, baseline: k.baseline_value, target: t.target_12m };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Engine kpi_for from Sections C and D, else the older Section G shape. A decimal such as 5.1 goes to the engine as the string "5.1":
 *  the canonical payload refuses binary floats. Whole numbers stay numbers, so stored evaluation hashes do not change. */
export function kpiForInput(c: Json | undefined, d: Json | undefined, g: Json | undefined): Record<string, { name: string; baseline: number | string; target: number | string }> | undefined {
  const k = (deriveKpiFor(c, d) ?? g?.kpi_for) as Record<string, { name: string; baseline: number | string; target: number | string }> | undefined;
  if (!k) return undefined;
  const fix = (v: number | string) => (typeof v === "number" && !Number.isInteger(v) ? String(v) : v);
  return Object.fromEntries(Object.entries(k).map(([o, x]) => [o, { ...x, baseline: fix(x.baseline), target: fix(x.target) }]));
}

/** Placeholder list for the F1 wording warning (spec §1.4.2). ponytail: move to rules data when PAC supplies the list. */
export const OBSERVABLE_VERBS = [
  "ask", "asks", "listen", "listens", "explain", "explains", "decide", "decides", "delegate", "delegates", "recognise", "recognises", "recognize", "recognizes",
  "thank", "thanks", "share", "shares", "meet", "meets", "give", "gives", "set", "sets", "review", "reviews", "invite", "invites", "admit", "admits",
  "coach", "coaches", "challenge", "challenges", "praise", "praises", "hold", "holds", "publish", "publishes", "visit", "visits", "make", "makes",
  "involve", "involves", "approve", "approves", "escalate", "escalates", "test", "tests", "try", "tries", "stop", "stops", "agree", "agrees", "respond", "responds",
];
