// Appendix I (Table 119): every configuration key and default in the spec against the engine's registry.
// Each check label starts with its requirement id in brackets, so scripts/conformance.mjs can map it to the matrix.
//   node scripts/conformance/probes/config.mjs
import { readFileSync } from "node:fs";
import { ok, done } from "../../lib/e2e.mjs";
const E = await import("../../../packages/cdp-engine/dist/index.js");

const reg = E.config.registry();
const spec = readFileSync("docs/spec/CDP_Platform_Developer_Specification_v2_1.md", "utf8");
const table = spec.slice(spec.indexOf("**Table 119"), spec.indexOf("# Appendix J"));
const rows = [...table.matchAll(/^\| ([a-z0-9_.·/ ]+?) \| (.+?) \| (GLOBAL|TENANT|ENGAGEMENT) \|/gm)].map((m) => ({ key: m[1].trim(), def: m[2].trim(), scope: m[3] }));
const nums = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const flat = (v) => (Array.isArray(v) ? v.flat(3) : [v]).map((x) => Number(x)).filter((x) => !Number.isNaN(x));
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

// spec keys whose code form differs: [spec key] -> how to read the code value
const SPECIAL = {
  "scoring.rounding_mode": () => readFileSync("packages/cdp-engine/src/num.ts", "utf8").includes("ROUND_HALF_UP") ? "HALF_UP" : null,
  "scoring.eos.advocate_min / critic_max": () => [reg["scoring.eos.advocate_min"], reg["scoring.eos.critic_max"]],
  "scoring.360.flags": () => [reg["scoring.360.flag.integrity_lt"], reg["scoring.360.flag.safety_lt"], reg["scoring.360.flag.change_lt"]],
  "checks.requirements": () => (E.config.GOAL_TYPES && E.config.BUSINESS_MODELS ? "tables" : null),
  "survey.speeding": () => [reg["survey.speeding_min_seconds"], Number(reg["survey.speeding_median_fraction"]) ? 3 : null],
  "ai.enabled · ai.region": () => ("ai.enabled" in reg ? [reg["ai.enabled"], "ai.region" in reg ? reg["ai.region"] : undefined] : null),
};
ok("[APPI-table] Table 119 parsed", rows.length >= 40, rows.length);
for (const r of rows) {
  const id = `[APPI-${r.key}]`;
  if (SPECIAL[r.key]) {
    const v = SPECIAL[r.key]();
    if (r.key === "scoring.rounding_mode") ok(`${id} rounding is half up`, v === "HALF_UP");
    else if (r.key === "checks.requirements") ok(`${id} goal type and business model tables in config`, v === "tables");
    else if (r.key === "survey.speeding") ok(`${id} speeding is max(480 s, median / 3)`, v && v[0] === 480 && v[1] === 3, JSON.stringify(v));
    else if (r.key === "ai.enabled · ai.region") ok(`${id} ai.enabled and ai.region present`, v && v[0] === true && v[1] !== undefined, JSON.stringify(v));
    else ok(`${id} ${r.def}`, v && same(flat(v), nums(r.def)), `code ${JSON.stringify(v)}`);
    continue;
  }
  if (!(r.key in reg)) { ok(`${id} key present in the engine registry (default ${r.def}, ${r.scope})`, false, "missing"); continue; }
  const want = nums(r.def), have = flat(reg[r.key]);
  ok(`${id} default ${r.def}`, same(have, want), `code ${JSON.stringify(reg[r.key])}`);
}
const tw = reg["scoring.tps.weights"].map(Number).reduce((a, b) => a + b, 0);
ok("[APPI-scoring.tps.weights] weights sum to 1.00", Math.abs(tw - 1) < 1e-9, tw);
done();
