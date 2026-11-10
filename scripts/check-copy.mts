// The web text in apps/web/lib/report-copy.ts: every meaning and advice pair is filled in, says Now (never today), has no dashes or hyphenated words, and never explains a calculation.
// Run (report-copy imports the engine and extensionless paths, so bundle it first):
//   packages/cdp-engine/node_modules/.bin/esbuild scripts/check-copy.mts --bundle --platform=node --format=esm --outfile=/tmp/check-copy.mjs && node /tmp/check-copy.mjs
import assert from "node:assert/strict";
import * as C from "../apps/web/lib/report-copy.ts";
import { ORIENTATIONS } from "../apps/web/lib/format.ts";
import * as L from "../apps/web/lib/report-library.ts";

const CALC = /\b(formula|weighted|weights?|average[ds]?|mean|median|standard deviation|calculated|computed|divided by|multiplied|sum of|percentile|coefficient)\b/i;
const say: [string, C.Say][] = [];
const add = (where: string, rec: Record<string, C.Say>) => Object.entries(rec).forEach(([k, s]) => say.push([`${where}.${k}`, s]));
add("MEASURE_SAY", C.MEASURE_SAY); add("FINDING_SAY", C.FINDING_SAY); add("PLAN_SAY", C.PLAN_SAY); add("LEADER_SAY", C.LEADER_SAY); add("TEAM_SAY", C.TEAM_SAY); add("ENG_SAY", C.ENG_SAY);
for (const o of ORIENTATIONS) for (const cls of ["BUILD", "STRENGTHEN", "KEEP_AND_PROTECT", "MODERATE"]) say.push([`orientationSay(${o}, ${cls})`, C.orientationSay(o, cls)]);
for (const k of ["now", "preferred", "alignment", "readiness", "strength"] as const) for (const verdict of ["HIT", "PARTIAL_HIT", "MISS"]) say.push([`headlineSay(${k}, ${verdict})`, C.headlineSay(k, { o: "ENGAGE", verdict, band: "Moderate", strengthBand: "Strong" })]);

const plain = (where: string, text: string) => {
  assert.ok(!/[–—]/.test(text), `dash in ${where}`);
  assert.ok(!/\b[A-Za-z]+-[A-Za-z]+\b/.test(text), `hyphenated word in ${where}: ${text.match(/\b[A-Za-z]+-[A-Za-z]+\b/)?.[0]}`);
  assert.ok(!/\btoday\b/i.test(text), `say Now, not today: ${where}`);
  assert.ok(!CALC.test(text), `calculation word in ${where}: ${text.match(CALC)?.[0]}`);
};
for (const [where, s] of say) {
  assert.ok(s.meaning.trim().length >= 20, `meaning missing or too short: ${where}`);
  assert.ok(s.advice.trim().length >= 20, `advice missing or too short: ${where}`);
  plain(`${where} meaning`, s.meaning); plain(`${where} advice`, s.advice);
}
for (const [k, s] of Object.entries(C.SECTION_SAY)) { assert.ok(s.read && s.todo, `strip text missing: ${k}`); plain(`SECTION_SAY.${k}`, s.read + " " + s.todo); }
for (const [k, t] of Object.entries(C.FINDING_TITLE)) plain(`FINDING_TITLE.${k}`, t);
// the full report's result rules (Erick review, 29 Oct 2026): what more or less of an orientation means, and the executive and staff difference
for (const [o, m] of Object.entries(L.ORIENT_MORE)) for (const k of ["more", "less"] as const) { assert.ok(m[k].length >= 40, `ORIENT_MORE.${o}.${k} too short`); plain(`ORIENT_MORE.${o}.${k}`, m[k]); }
for (const [k, t] of Object.entries(L.CHAPTER_INTRO)) { assert.ok(t.length >= 120, `CHAPTER_INTRO.${k} too short`); plain(`CHAPTER_INTRO.${k}`, t); }
for (const [e, s] of [[30, 29], [30, 26], [30, 22], [22, 30]]) plain(`perceptionText(${e}, ${s})`, L.perceptionText("ENGAGE", e, s));
console.log(`copy ok (${say.length} meaning and advice pairs, ${Object.keys(C.SECTION_SAY).length} strips)`);
