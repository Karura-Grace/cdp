/**
 * Pulse answers and readings (spec §6.5.1). A pulse item is a watch-list reference: a scenario ("D2 S2", the NOW
 * constant-sum block), a dimension short form ("D7", four fixed items) or an eOS question ("eOS Q1").
 * The same reading is computed for the baseline (from the frozen response set) and for the pulse, so the two are always
 * compared on the same items. Results are INDICATIVE and never replace a full assessment score.
 */
import { mean, ORIENTATIONS, Orientation } from "./num.js";
import { eosCategory } from "./scoring.js";
import { SHORT_FORMS, SHORT_FORM_ITEM_IDS, type PulseReading } from "./reassess.js";
import type { ResponseInput } from "./types.js";

/** One respondent's pulse answers, keyed by watch-list reference. Scenario: 4 orientation points; dimension: item id to 1-5; eOS: 0-10. */
export type PulseAnswers = Record<string, Record<string, number> | number>;

export type PulseRef = { kind: "scenario"; dim: string; set: number } | { kind: "dimension"; dim: "D7" | "D8" | "D9" } | { kind: "eos"; q: number };

export function parsePulseRef(ref: string): PulseRef | null {
  let m = /^D([1-6]) S([1-3])$/.exec(ref);
  if (m) return { kind: "scenario", dim: `D${m[1]}`, set: Number(m[2]) };
  m = /^D([7-9])$/.exec(ref);
  if (m) return { kind: "dimension", dim: `D${m[1]}` as "D7" | "D8" | "D9" };
  m = /^eOS Q([1-8])$/.exec(ref);
  return m ? { kind: "eos", q: Number(m[1]) } : null;
}

/** Shape check of one respondent's answers against the pulse's items; returns one message per problem. */
export function validatePulseAnswers(items: string[], answers: PulseAnswers): string[] {
  const errs: string[] = [];
  for (const k of Object.keys(answers)) if (!items.includes(k)) errs.push(`Not part of this pulse: ${k}`);
  const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
  for (const ref of items) {
    const p = parsePulseRef(ref), a = answers[ref];
    if (!p) { errs.push(`Unknown item: ${ref}`); continue; }
    if (a === undefined) continue;                                   // skipping an item is allowed; it is left out of the reading
    if (p.kind === "eos") { if (!int(a, 0, 10)) errs.push(`${ref}: a whole number from 0 to 10`); }
    else if (typeof a !== "object") errs.push(`${ref}: answers missing`);
    else if (p.kind === "scenario") {
      const vals = ORIENTATIONS.map((o) => a[o]);
      if (Object.keys(a).length !== 4 || !vals.every((v) => int(v, 0, 100)) || vals.reduce((s, v) => s + v, 0) !== 100) errs.push(`${ref}: four values that add up to 100`);
    } else {
      const ids = SHORT_FORM_ITEM_IDS[p.dim];
      if (Object.keys(a).some((k) => !ids.includes(k)) || !Object.values(a).every((v) => int(v, 1, 5))) errs.push(`${ref}: items from the short form, each 1 to 5`);
    }
  }
  return errs;
}

/** The baseline respondent's answers to the same items, taken from a frozen response. Nothing is invented: an unanswered item is absent. */
export function pulseAnswersFromResponse(r: ResponseInput, items: string[]): PulseAnswers {
  const out: PulseAnswers = {};
  for (const ref of items) {
    const p = parsePulseRef(ref);
    if (!p) continue;
    if (p.kind === "eos") { const v = r.eos?.[p.q - 1]; if (v !== null && v !== undefined) out[ref] = v; }
    else if (p.kind === "scenario") { const s = r.alloc.NOW?.[p.dim as keyof NonNullable<ResponseInput["alloc"]["NOW"]>]?.[p.set - 1]; if (s) out[ref] = { ...s }; }
    else {
      const row = r.likert?.[p.dim] ?? [], got: Record<string, number> = {};
      SHORT_FORMS[p.dim].forEach((ix, n) => { const v = row[ix]; if (v !== null && v !== undefined) got[SHORT_FORM_ITEM_IDS[p.dim][n]] = v; });
      out[ref] = got;
    }
  }
  return out;
}

export interface PulseReadingResult { reading: PulseReading; n: Record<string, number> }

/**
 * The reading for a group of respondents. Dimension: mean of each respondent's short-form mean (respondents who answered all four);
 * eOS: category score of that question; scenario: mean points given to `orientation` in the NOW block.
 * `n` is how many respondents counted for each reference.
 */
export function pulseReading(group: PulseAnswers[], items: string[], orientation: Orientation): PulseReadingResult {
  const reading: PulseReading = { likert: {}, eos: {}, scenario: {} };
  const n: Record<string, number> = {};
  for (const ref of items) {
    const p = parsePulseRef(ref);
    if (!p) continue;
    const got = group.map((g) => g[ref]).filter((v) => v !== undefined);
    if (p.kind === "eos") {
      const c = eosCategory(got as number[]);
      if (c !== null) { reading.eos![`Q${p.q}`] = c; n[ref] = got.length; }
    } else if (p.kind === "scenario") {
      const m = mean((got as Record<string, number>[]).map((a) => a[orientation]));
      if (m) { reading.scenario![ref] = m; n[ref] = got.length; }
    } else {
      const per = (got as Record<string, number>[]).filter((a) => Object.keys(a).length === 4).map((a) => mean(Object.values(a))!);
      const m = mean(per);
      if (m) { reading.likert![p.dim] = m; n[ref] = per.length; }
    }
  }
  return { reading, n };
}

/** Keep only the references present in both readings, so the comparison never reaches for a baseline value that does not exist. */
export function commonReading(base: PulseReading, cur: PulseReading): [PulseReading, PulseReading] {
  const pick = <T,>(a: Record<string, T> | undefined, b: Record<string, T> | undefined) => Object.keys(b ?? {}).filter((k) => a && k in a);
  const out: [PulseReading, PulseReading] = [{ likert: {}, eos: {}, scenario: {} }, { likert: {}, eos: {}, scenario: {} }];
  for (const f of ["likert", "eos", "scenario"] as const) for (const k of pick(base[f] as Record<string, unknown>, cur[f] as Record<string, unknown>)) {
    (out[0][f] as Record<string, unknown>)[k] = (base[f] as Record<string, unknown>)[k];
    (out[1][f] as Record<string, unknown>)[k] = (cur[f] as Record<string, unknown>)[k];
  }
  return out;
}
