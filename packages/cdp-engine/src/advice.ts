/**
 * Advice library matching (Erick Ngala comment 197; owner rounds Q-AL1 to Q-AL25, 31 October 2026).
 * The library itself lives in the database (advice_library_version, advice_item). Each item carries a rule over a flat map of
 * facts read from a report's frozen numbers: the canonical score payload, the stored evaluation and, for a group or a leader,
 * that scope's own results. Rules combine conditions with all / any / not (Q-AL6). Bands come from the payload (the engine's
 * own classifications), so items need no threshold literals of their own.
 * Wording only, no calculation, so the oracle has no copy (same as playbook-data.ts). Findings stay the engine's (Q-AL13).
 */
import { D, ORIENTATIONS, DIMENSIONS_CS } from "./num.js";
import { eosBand, valuesReality } from "./scoring.js";
import * as config from "./config.js";

export type FactValue = string | number | boolean | null | string[];
export type Facts = Record<string, FactValue>;
export type Op = "eq" | "ne" | "in" | "has" | "gt" | "gte" | "lt" | "lte";
export type Rule = { all: Rule[] } | { any: Rule[] } | { not: Rule } | { fact: string; op: Op; value: FactValue } | Record<string, never>;

type J = Record<string, unknown>;
const obj = (x: unknown): J => (x && typeof x === "object" && !Array.isArray(x) ? (x as J) : {});
const scalar = (x: unknown): FactValue => (x === undefined ? null : typeof x === "object" && x !== null ? String(x) : (x as FactValue));

/** Organisation facts from the canonical score payload and the stored evaluation. Keys are the names faculty use in rules. */
export function adviceFacts(payload: J, evaluation: J, org: { sector?: string | null; business_model?: string | null; size?: string | null } = {}): Facts {
  const f: Facts = {};
  const put = (prefix: string, o: unknown) => { for (const [k, v] of Object.entries(obj(o))) f[`${prefix}.${k}`] = scalar(v); };
  const os = obj(payload.orientation_scores);
  put("now", os.now); put("pref", os.preferred); put("gap", os.gap);
  put("class", payload.classification);
  const an = obj(payload.analytics);
  put("gap_band", an.gap_bands);
  const dom = obj(payload.dominance);
  f.dominant = scalar((dom.dominant as string[] | undefined)?.[0]);
  f.secondary = scalar(dom.secondary);
  f.shared_dominance = scalar(dom.shared);
  f.strength = scalar(payload.culture_strength);
  f.strength_band = scalar(payload.strength_band);
  for (const [d, prof] of Object.entries(obj(payload.dimension_now))) {
    put(`dim.${d}`, prof);
    const top = Object.entries(obj(prof)).sort((a, b) => D(String(b[1])).cmp(D(String(a[1]))))[0];
    f[`dim.${d}.top`] = top ? top[0] : null;
    f[`dim.${d}.diverges`] = top ? top[0] !== f.dominant : null;            // this part of working life leads with another orientation
  }
  // the orientation people most want more of, and most want less of (the pathway and the rebalance the plan works on)
  const gapsSorted = Object.entries(obj(os.gap)).sort((a, b) => D(String(b[1])).cmp(D(String(a[1]))) || (a[0] < b[0] ? -1 : 1));
  f.largest_gap = gapsSorted.length && D(String(gapsSorted[0][1])).gt(0) ? gapsSorted[0][0] : null;
  f.largest_drop = gapsSorted.length && D(String(gapsSorted[gapsSorted.length - 1][1])).lt(0) ? gapsSorted[gapsSorted.length - 1][0] : null;
  const rd = obj(payload.readiness);
  for (const k of ["d7", "d8", "d9", "tps", "d7_band", "d8_band", "d9_band", "tps_band", "leadership_alignment", "provisional"]) f[`readiness.${k}`] = scalar(rd[k]);
  put("eos", payload.eos);
  put("perception", payload.perception_flags);
  put("perception_gap", payload.perception_gap);
  const risk = obj(an.risk);
  f["risk.band"] = scalar(risk.band); f["risk.index"] = scalar(risk.index);
  f["entropy.band"] = scalar(obj(an.entropy).band);
  for (const t of (an.tensions as J[] | undefined) ?? []) f[`tension.${t.pair}`] = scalar(t.band);
  f["congruence.band"] = scalar(obj(payload.congruence).band);
  put("check", evaluation.checks);
  f.scenario = ((evaluation.scenarios as J[] | undefined) ?? []).map((s) => String(s.scenario_id));
  f.finding = [...new Set(((evaluation.findings as J[] | undefined) ?? []).map((x) => String(x.type)))];
  const c2 = obj(evaluation.c2); f["c2.severity"] = scalar(c2.severity); f["c2.intensity"] = scalar(obj(c2.metrics).intensity);
  deeperFacts(f, payload);
  f["org.sector"] = org.sector ?? null; f["org.business_model"] = org.business_model ?? null; f["org.size"] = org.size ?? null;
  return f;
}

/**
 * Facts for one group (a department that met the reporting floor): the organisation's facts, plus the group's own culture now
 * (`seg.now.X`), its difference from the organisation (`seg.diff.X`, group minus organisation), its dominant orientation and
 * whether that differs from the organisation's (`seg.diverges`).
 */
export function groupFacts(org: Facts, now: Record<string, string>): Facts {
  const f: Facts = { ...org };
  for (const [o, v] of Object.entries(now)) {
    f[`seg.now.${o}`] = v;
    if (org[`now.${o}`] !== null && org[`now.${o}`] !== undefined) f[`seg.diff.${o}`] = D(v).minus(D(String(org[`now.${o}`]))).toFixed(2);
  }
  const top = Object.entries(now).sort((a, b) => D(b[1]).cmp(D(a[1])))[0]?.[0] ?? null;
  f["seg.dominant"] = top;
  f["seg.diverges"] = top !== null && top !== org.dominant;
  f["seg.opposes"] = top !== null && OPPOSITE[top] === org.dominant;            // leads with the diagonal opposite of the organisation
  return f;
}

/**
 * The facts behind the deeper analysis (owner Q-AL27, 1 Nov 2026), all read from the frozen payload: answer spread per orientation
 * (mean over the six dimensions), the two axes of the framework, espoused against lived values, the executive and staff views, the
 * employee voice band per question and the shift people want in each dimension. Values are fixed point strings, so library text
 * can quote them through fillFacts.
 */
function deeperFacts(f: Facts, payload: J) {
  const an = obj(payload.analytics), disp = obj(an.dispersion);
  const mean = (xs: string[]) => xs.reduce((s, x) => s.plus(D(x)), D(0)).div(xs.length);
  if (Object.keys(disp).length) {
    for (const o of ORIENTATIONS) {
      const xs = DIMENSIONS_CS.map((d) => obj(disp[d])[o]).filter((v) => v !== undefined && v !== null).map(String);
      if (xs.length) f[`spread.${o}`] = mean(xs).toFixed(2);
    }
    f["spread.overall"] = scalar(disp.overall);
    f["spread.top"] = topOf(ORIENTATIONS.map((o) => [o, f[`spread.${o}`]]));
  }
  const now = obj(obj(payload.orientation_scores).now);
  for (const k of ["dominant", "secondary"]) if (f[k] && now[String(f[k])] !== undefined) f[`${k}_value`] = D(String(now[String(f[k])])).toFixed(1);
  f["build_count"] = Object.values(obj(payload.classification)).filter((c) => c === "BUILD").length;
  f["entropy.score"] = scalar(obj(an.entropy).score);
  for (const t of (an.tensions as J[] | undefined) ?? []) f[`tension_score.${t.pair}`] = scalar(t.score);
  if (ORIENTATIONS.every((o) => now[o] !== undefined)) {
    const v = (o: string) => D(String(now[o])), bal = config.get("analytics.axis_balance");
    const inward = v("ENGAGE").plus(v("GOVERN")), outward = v("INNOVATE").plus(v("PERFORM"));
    const flexible = v("ENGAGE").plus(v("INNOVATE")), structured = v("PERFORM").plus(v("GOVERN"));
    Object.assign(f, {
      "axis.inward": inward.toFixed(1), "axis.outward": outward.toFixed(1), "axis.flexible": flexible.toFixed(1), "axis.structured": structured.toFixed(1),
      "axis.focus": inward.minus(outward).abs().lt(bal) ? "BALANCED" : inward.gt(outward) ? "INWARD" : "OUTWARD",
      "axis.style": flexible.minus(structured).abs().lt(bal) ? "BALANCED" : flexible.gt(structured) ? "FLEXIBLE" : "STRUCTURED",
    });
  }
  const dn = obj(payload.dimension_now), dpr = obj(payload.dimension_preferred);
  if (dn.D1 && dn.D4 && dn.D6) {
    const vr = valuesReality(dn as never);
    for (const o of ORIENTATIONS) { f[`vr.espoused.${o}`] = vr[o].espoused.toFixed(1); f[`vr.lived.${o}`] = vr[o].lived.toFixed(1); f[`vr.delta.${o}`] = vr[o].delta.toFixed(1); }
    const w = [...ORIENTATIONS].sort((p, q) => vr[q].delta.abs().cmp(vr[p].delta.abs()))[0];
    f["vr.widest"] = w; f["vr.widest_delta"] = vr[w].delta.toFixed(1); f["vr.widest_abs"] = vr[w].delta.abs().toFixed(1);
  }
  const at = (p: J, o: string) => D(String(p[o]));
  for (const d of DIMENSIONS_CS) {
    const a = obj(dn[d]), b = obj(dpr[d]);
    if (!Object.keys(a).length) continue;
    const top = f[`dim.${d}.top`];
    if (top) f[`dim.${d}.top_value`] = at(a, String(top)).toFixed(1);
    if (!Object.keys(b).length) continue;
    const s = [...ORIENTATIONS].sort((p, q) => at(b, q).minus(at(a, q)).abs().cmp(at(b, p).minus(at(a, p)).abs()))[0];
    Object.assign(f, { [`dim.${d}.shift`]: s, [`dim.${d}.shift_from`]: at(a, s).toFixed(1), [`dim.${d}.shift_to`]: at(b, s).toFixed(1), [`dim.${d}.shift_by`]: at(b, s).minus(at(a, s)).toFixed(1) });
  }
  const co = obj(payload.cohorts), ex = obj(obj(co.executive).now), st = obj(obj(co.staff).now);
  if (Object.keys(ex).length && Object.keys(st).length) {
    for (const o of ORIENTATIONS) { f[`exec.now.${o}`] = at(ex, o).toFixed(1); f[`staff.now.${o}`] = at(st, o).toFixed(1); f[`exec_minus_staff.${o}`] = at(ex, o).minus(at(st, o)).toFixed(1); }
    const w = [...ORIENTATIONS].sort((p, q) => at(ex, q).minus(at(st, q)).abs().cmp(at(ex, p).minus(at(st, p)).abs()))[0];
    f["perception.widest"] = w; f["perception.widest_by"] = at(ex, w).minus(at(st, w)).abs().toFixed(1); f["perception.leaders_higher"] = at(ex, w).gt(at(st, w));
    f["perception.exec_value"] = at(ex, w).toFixed(1); f["perception.staff_value"] = at(st, w).toFixed(1);
  }
  for (const [k, v] of Object.entries(obj(payload.eos))) if (/^Q\d$/.test(k) && v !== null && v !== undefined) f[`eos_band.${k}`] = eosBand(Number(v));
}
const topOf = (xs: [string, FactValue][]) => xs.filter(([, v]) => v !== null && v !== undefined).sort((p, q) => D(String(q[1])).cmp(D(String(p[1]))))[0]?.[0] ?? null;
const OPPOSITE: Record<string, string> = { ENGAGE: "PERFORM", PERFORM: "ENGAGE", INNOVATE: "GOVERN", GOVERN: "INNOVATE" };

function test(rule: Rule, f: Facts): boolean {
  if ("all" in rule) return rule.all.every((r) => test(r, f));
  if ("any" in rule) return rule.any.some((r) => test(r, f));
  if ("not" in rule) return !test(rule.not, f);
  if (!("fact" in rule)) return true;                                          // {} always matches (profiles, definitions)
  const v = f[rule.fact];
  if (v === undefined || v === null) return false;                              // a missing number never fires advice
  const want = rule.value;
  switch (rule.op) {
    case "eq": return String(v) === String(want);
    case "ne": return String(v) !== String(want);
    case "in": return Array.isArray(want) && want.map(String).includes(String(v));
    case "has": return Array.isArray(v) && v.includes(String(want));
    default: {
      if (Array.isArray(v) || want === null || Array.isArray(want)) return false;
      const c = D(String(v)).cmp(D(String(want)));
      return rule.op === "gt" ? c > 0 : rule.op === "gte" ? c >= 0 : rule.op === "lt" ? c < 0 : c <= 0;
    }
  }
}
export const ruleMatches = (rule: Rule, f: Facts) => test(rule, f);

/** Number of conditions in a rule: the more specific advice ranks first when priorities tie. */
export function specificity(rule: Rule): number {
  if ("all" in rule) return rule.all.reduce((s, r) => s + specificity(r), 0);
  if ("any" in rule) return rule.any.length ? Math.min(...rule.any.map(specificity)) : 0;
  if ("not" in rule) return specificity(rule.not);
  return "fact" in rule ? 1 : 0;
}

export interface AdviceItemRef { item_id: string; section: string; priority: number; rule: Rule; tags?: Record<string, string[]> | null }
export interface Proposal<T> { item: T; section: string; rank: number; capped: boolean }

/**
 * The items whose rule matches, ranked within each report section by priority, then specificity, then id (stable), and capped
 * per section (Q-AL14). Items over the cap come back with capped = true for the consultant's "more" list. A tagged item fits
 * only an organisation with a matching tag, and ranks above untagged advice (Q-AL11).
 */
export function matchAdvice<T extends AdviceItemRef>(items: T[], f: Facts, caps: Record<string, number> & { default: number }): Proposal<T>[] {
  const tagFits = (t: T) => Object.entries(t.tags ?? {}).every(([k, vals]) => !vals?.length || vals.includes(String(f[`org.${k}`])));
  const tagged = (t: T) => Object.values(t.tags ?? {}).some((v) => v?.length);
  const hits = items.filter((t) => tagFits(t) && test(t.rule, f));
  const bySection = new Map<string, T[]>();
  for (const t of hits) bySection.set(t.section, [...(bySection.get(t.section) ?? []), t]);
  const out: Proposal<T>[] = [];
  for (const [section, list] of bySection) {
    list.sort((a, b) => b.priority - a.priority || Number(tagged(b)) - Number(tagged(a)) || specificity(b.rule) - specificity(a.rule) || (a.item_id < b.item_id ? -1 : 1));
    const cap = caps[section.split(".")[0]] ?? caps.default;
    list.forEach((item, i) => out.push({ item, section, rank: i + 1, capped: i >= cap }));
  }
  return out;
}

/** Default caps per section family (Q-AL14). Faculty can tune them with the library; the consultant always sees the rest. */
export const ADVICE_CAPS: Record<string, number> & { default: number } = { default: 3, definition: 99, profile: 99, check: 3, orientation: 2, scenario: 3 };

/**
 * Fill config placeholders in library text, so definitions quote the live cut points instead of copying them (no threshold is
 * written into the library): {{scoring.gap.build}} or {{analytics.gap_bands.1}} for one value of a list. Unknown keys stay as written.
 */
export function fillConfig(text: string): string {
  return text.replace(/\{\{([a-z0-9_.]+?)(?:\.(\d))?\}\}/g, (m, key: string, i?: string) => {
    try {
      const v = config.get(key as never) as unknown;
      const x = i !== undefined && Array.isArray(v) ? v[Number(i)] : v;
      return x === undefined || x === null || typeof x === "object" && !("toString" in (x as object)) ? m : String(x);
    } catch { return m; }
  });
}

/**
 * Fill fact slots in library text with this report's own numbers (owner Q-AL26): {{f:now.ENGAGE}}, {{f:dim.D6.top}}. A digit after a
 * bar fixes the decimals ({{f:gap.ENGAGE|1}}); a plus adds a sign to positive values ({{f:gap.ENGAGE|+1}}). A slot whose fact is
 * missing stays as written, so the report can drop the item rather than print a hole.
 */
export function fillFacts(text: string, f: Facts): string {
  return text.replace(/\{\{f:([A-Za-z0-9_.]+)(?:\|(\+?)(\d))?\}\}/g, (m, key: string, sign: string, dps?: string) => {
    const v = f[key];
    if (v === undefined || v === null || Array.isArray(v)) return m;
    if (dps === undefined || typeof v === "boolean" || !/^-?\d+(\.\d+)?$/.test(String(v))) return String(v);
    const d = D(String(v)), s = d.toFixed(Number(dps));
    return sign && d.gt(0) ? `+${s}` : s;
  });
}

/**
 * KPI targets at 12 and 18 months (owner Q-AL35, Q-AL38): a fixed share better than the baseline (config kpi.target_step), in the
 * direction that is better for that measure, kept inside the scale. A zero baseline steps by the same share of the scale's range.
 */
export function kpiTargets(baseline: string, better: "up" | "down", scale: [string, string], dps = 2): [string, string] {
  const b = D(baseline), lo = D(scale[0]), hi = D(scale[1]);
  return config.get("kpi.target_step").map((s) => {
    const step = (b.isZero() ? hi.minus(lo) : b.abs()).times(s);
    const v = better === "up" ? b.plus(step) : b.minus(step);
    return (v.gt(hi) ? hi : v.lt(lo) ? lo : v).toFixed(dps);
  }) as [string, string];
}
