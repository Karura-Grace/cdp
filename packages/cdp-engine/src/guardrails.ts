/**
 * AI narrative guardrails (spec §4.8, Table 72). Pure screens run server-side on every draft before a
 * consultant sees it: numeric integrity, terminology, traceability, causal language, attribution.
 * The model itself is called by the narrative service; this module never calls it.
 */
import { decString, isDecimal } from "./num.js";

export interface DraftSection { text: string; cites: string[] }
export interface ScreenResult { ok: boolean; blocked: string[]; stripped: string[]; text: string }

const NUM = /-?\d+(?:[.,]\d+)?/g;
const CAUSAL = /\b(caused|causes|causing|because of (?:the )?culture|drove|drives|driven by|resulted in|results in|led to|leads to|due to (?:the )?culture)\b/i;

/** Normalise a number token: "9.0" ≡ "9", "86.70" ≡ "86.7", "1,200" ≡ "1200". */
export function normaliseNumber(s: string): string {
  let t = s.replace(/,(?=\d{3}\b)/g, "");
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  if (t === "-0") t = "0";
  return t;
}

/** Every number present anywhere in the findings payload (strings, ints, Decimals), normalised. */
export function payloadNumbers(payload: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (x === null || x === undefined) return;
    if (isDecimal(x)) { out.add(normaliseNumber(decString(x))); return; }
    if (typeof x === "number") { out.add(normaliseNumber(String(x))); return; }
    if (typeof x === "string") { for (const m of x.match(NUM) ?? []) out.add(normaliseNumber(m)); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === "object") Object.values(x as object).forEach(walk);
  };
  walk(payload);
  return out;
}

/** Split into sentences; cite markers after the full stop ("… 3.09. [fnd_0009] Next …") stay with the sentence they follow. */
const sentences = (t: string) => t.split(/(?<=[.!?](?:\s*\[[^\]]+\])*)\s+(?!\[)/).map((s) => s.trim()).filter(Boolean);

/**
 * Screen one drafted section. `findingIds` are the IDs the payload contains; `denyList` is the restricted
 * terminology list; `smallGroupNames` are names/segments below the floor (attribution screen).
 * Uncited sentences are stripped (traceability); any numeric, terminology, causal or attribution hit blocks.
 */
export function screenSection(section: DraftSection, o: { allowedNumbers: Set<string>; findingIds: Set<string>; denyList: string[]; smallGroupNames?: string[];
  citePattern?: RegExp }): ScreenResult {
  const blocked: string[] = [];
  const stripped: string[] = [];
  const citeRe = o.citePattern ?? /\[(fnd_\d+|pri_\d+|sc_\d+|SC-\d+)\]/g;
  const unknownCites = section.cites.filter((c) => !o.findingIds.has(c));
  if (!section.cites.length) blocked.push("TRACEABILITY: section cites no finding");
  if (unknownCites.length) blocked.push("TRACEABILITY: cites unknown IDs " + unknownCites.join(", "));
  // Traceability at sentence level when inline cite markers are used: sentences without a marker are stripped.
  let kept = sentences(section.text);
  if (citeRe.test(section.text)) {
    citeRe.lastIndex = 0;
    const out: string[] = [];
    for (const s of kept) { const ms = [...s.matchAll(new RegExp(citeRe.source, "g"))].map((m) => m[1]); if (ms.length && ms.every((m) => o.findingIds.has(m))) out.push(s); else stripped.push(s); }
    kept = out;
  }
  const text = kept.join(" ");
  const textNoCites = text.replace(new RegExp(citeRe.source, "g"), "");
  for (const m of textNoCites.match(NUM) ?? []) { const n = normaliseNumber(m); if (!o.allowedNumbers.has(n) && !o.allowedNumbers.has(n.replace(/^-/, ""))) blocked.push(`NUMERIC_INTEGRITY: ${m} is not in the findings payload`); }
  const low = textNoCites.toLowerCase();
  for (const t of o.denyList) if (t && low.includes(t.toLowerCase())) blocked.push("TERMINOLOGY: deny-listed term");
  if (CAUSAL.test(textNoCites)) blocked.push("CAUSAL_LANGUAGE: use associational wording");
  for (const nme of o.smallGroupNames ?? []) if (nme && low.includes(nme.toLowerCase())) blocked.push("ATTRIBUTION: refers to an individual or a group below the reporting floor");
  return { ok: blocked.length === 0, blocked: [...new Set(blocked)], stripped, text };
}

/** Screen a whole output contract ({ sections: { key: {text, cites} } }). */
export function screenDraft(draft: { sections: Record<string, DraftSection> }, o: Parameters<typeof screenSection>[1]) {
  const results = Object.fromEntries(Object.entries(draft.sections).map(([k, s]) => [k, screenSection(s, o)]));
  return { ok: Object.values(results).every((r) => r.ok), sections: results };
}

/** Build-time terminology gate (§0.2): scan file contents; any hit fails the build. Returns hits as {file, line}. */
export function terminologyScan(files: { path: string; content: string }[], denyList: string[]): { path: string; line: number }[] {
  const terms = denyList.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const hits: { path: string; line: number }[] = [];
  for (const f of files) f.content.split("\n").forEach((ln, i) => { const l = ln.toLowerCase(); if (terms.some((t) => l.includes(t))) hits.push({ path: f.path, line: i + 1 }); });
  return hits;
}
