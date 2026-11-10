import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSetup, scoreLeaders, scoreAssessment, evaluate, buildPlan, toJsonable, withRules } from "../src/index.js";
import type { ResponseInput, SetupInput, LeaderInput, RulesVersion } from "../src/index.js";

export const CASES = join(dirname(fileURLToPath(import.meta.url)), "..", "oracle", "cases");
export const loadCase = (name: string) => JSON.parse(readFileSync(join(CASES, `${name}.json`), "utf8"));
export const manifest = () => JSON.parse(readFileSync(join(CASES, "manifest.json"), "utf8")) as { cases: string[] };

export function runCase(input: { responses: ResponseInput[]; setup: SetupInput; leaders: LeaderInput[]; scope: { headcount_led: number }[]; rules?: RulesVersion }, start: string) {
  return withRules(input.rules ?? "2.0", () => runCase20(input, start));
}
function runCase20(input: { responses: ResponseInput[]; setup: SetupInput; leaders: LeaderInput[]; scope: { headcount_led: number }[] }, start: string) {
  const setup = deriveSetup(input.setup);
  const leaders = scoreLeaders(input.leaders, setup.leadership_target_orientation);
  const s = scoreAssessment(input.responses, setup, leaders, input.scope);
  const ev = evaluate(s.obj, setup);
  const plan = buildPlan(s.obj, ev, setup, start);
  return { setup, leaders, ...s, ev, plan, jsonable: { setup_derived: toJsonable(setup), evaluation: toJsonable(ev), plan: toJsonable(plan) } };
}

/** The fixture run shared by the UT-xx tests. */
let cached: ReturnType<typeof runCase> | null = null;
export function fixture() {
  if (!cached) { const c = loadCase("fixture"); cached = runCase(c.input, c.start); }
  return cached;
}
