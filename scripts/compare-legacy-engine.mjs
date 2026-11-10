// Side by side: the legacy prototype's scoring (lib/scoring.mjs) against this platform's engine, on the same responses.
//   node scripts/compare-legacy-engine.mjs "<path to cdp-legacy-prototype-v1-main>"
// The reference fixture (packages/cdp-engine/oracle/cases/fixture.json) holds 475 responses and the engine's expected score. The legacy code
// is loaded from the folder given and never modified. Responses are converted to the legacy shape; the engine counts NOW and PREFERRED
// separately and drops incomplete ones, so the legacy runs on the same set the engine used for each figure.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/compare-legacy-engine.mjs "<legacy folder>"'); process.exit(2); }
const L = await import(pathToFileURL(`${dir}/lib/scoring.mjs`).href);
const DATA = JSON.parse(readFileSync(`${dir}/lib/instrument-data.json`, "utf8"));
const fx = JSON.parse(readFileSync(new URL("../packages/cdp-engine/oracle/cases/fixture.json", import.meta.url)));
const exp = fx.expected.score;
const O = { ENGAGE: "E", INNOVATE: "I", PERFORM: "P", GOVERN: "G" };

const persp = (r, p) => {
  const dims = ["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => r.alloc?.[p]?.[d]);
  return dims.every((sets) => Array.isArray(sets) && sets.length === 3 && sets.every((s) => s && Object.keys(s).length === 4))
    ? dims.map((sets) => sets.map((s) => ({ E: s.ENGAGE, I: s.INNOVATE, P: s.PERFORM, G: s.GOVERN }))) : null;
};
const lik = (r, d) => (Array.isArray(r.likert?.[d]) && r.likert[d].length === 12 && r.likert[d].every((v) => v !== null && v !== undefined) ? r.likert[d] : null);
const rows = fx.input.responses.map((r) => ({
  id: r.id, cohort: r.snapshot?.is_executive ? "Executive Leadership" : "Staff",
  now: persp(r, "NOW"), pref: persp(r, "PREFERRED"), d7: lik(r, "D7"), d8: lik(r, "D8"), d9: lik(r, "D9"),
  eos: Array.isArray(r.eos) && r.eos.length === 8 && r.eos.every((v) => v !== null) ? r.eos : null, qual: ["", "", ""],
}));
const withNow = rows.filter((r) => r.now), withPref = rows.filter((r) => r.pref);
const complete = rows.filter((r) => r.now && r.pref && r.d7 && r.d8 && r.d9 && r.eos);
console.log(`responses in fixture ${rows.length}; with complete NOW ${withNow.length} (engine ${exp.counts.now}); with complete PREFERRED ${withPref.length} (engine ${exp.counts.preferred}); fully complete ${complete.length}`);

let fail = 0;
const same = (name, legacy, ours, tol) => {
  const a = Number(legacy), b = Number(ours), d = Math.abs(a - b), ok = d <= tol;
  if (!ok) fail++;
  console.log(`${ok ? "SAME " : "DIFF "} ${name.padEnd(34)} legacy ${a.toFixed(4).padStart(9)}   ours ${b.toFixed(4).padStart(9)}   difference ${d.toFixed(4)}`);
};

// the legacy aggregates NOW and PREFERRED over one set of rows; run it on each set the engine used
const AN = L.analyse(complete, DATA), ANow = L.aggOrient(withNow, "now"), APref = L.aggOrient(withPref, "pref");
console.log("\n-- Orientation scores (points out of 100), each perspective on the responses the engine counted --");
for (const [k, c] of Object.entries(O)) {
  same(`NOW ${k}`, ANow[c], exp.orientation_scores.now[k], 0.005);
  same(`PREFERRED ${k}`, APref[c], exp.orientation_scores.preferred[k], 0.005);
  same(`GAP ${k}`, APref[c] - ANow[c], exp.orientation_scores.gap[k], 0.01);
}
console.log("\n-- Readiness (1 to 5) on fully complete responses --");
same("D7 digital readiness", AN.d7.mean, exp.readiness.d7, 0.05);
same("D8 psychological safety", AN.d8.mean, exp.readiness.d8, 0.05);
same("D9 adaptive capacity", AN.d9.mean, exp.readiness.d9, 0.05);
console.log("\n-- Employee Orientation Survey (net score, -100 to +100) --");
AN.eos.forEach((e, i) => same(`eOS Q${i + 1}`, e.score, exp.eos[`Q${i + 1}`], 1));
console.log("\n-- Executives against staff --");
if (AN.perc) for (const [k, c] of Object.entries(O)) same(`perception gap ${k}`, Math.abs(AN.perc.gaps[c].v), exp.perception_gap?.[k] ?? 0, 0.1);
else console.log("legacy: not computed (needs 5 or more in each group)");
console.log("\n-- Transformation Preparedness Score --");
console.log(`legacy leadership alignment ${AN.la.toFixed(3)} (from perception gap), ours ${exp.readiness.leadership_alignment} (source ${exp.readiness.leadership_alignment_source})`);
same("TPS", AN.tps, exp.readiness.tps, 0.05);
console.log("\n-- Things only one side has --");
console.log("legacy only: entropy, Culture Risk Index, tensions (hard coded formulas, not in spec v2.1)");
console.log("ours only: culture strength and congruence, rank and significance tests, response quality flags, C1 to C4 checks, leader results, reporting floors");
console.log(fail ? `\n${fail} figure(s) differ` : "\nall compared figures agree");
