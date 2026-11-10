/**
 * Cross-engine check: the TypeScript engine must reproduce the Python oracle exactly on the §0.7 fixture,
 * a fixture variant with a valid 360, and 120 seeded random datasets. Score payloads must hash byte-for-byte
 * identically; evaluations and plans must be deep-equal in canonical form. Regenerate with `npm run oracle:generate`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CASES, loadCase, manifest, runCase } from "./helpers.js";
import { welchP } from "../src/index.js";

describe("oracle parity", () => {
  for (const name of manifest().cases) {
    it(name, () => {
      const c = loadCase(name);
      const r = runCase(c.input, c.start);
      expect(r.jsonable.setup_derived).toEqual(c.expected.setup_derived);
      expect(r.payload).toEqual(c.expected.score);
      expect(r.hash).toBe(c.expected.hash);
      expect(r.jsonable.evaluation).toEqual(c.expected.evaluation);
      expect(r.jsonable.plan).toEqual(c.expected.plan);
    });
  }
});

describe("Welch t-test matches scipy", () => {
  const cases = JSON.parse(readFileSync(join(CASES, "welch.json"), "utf8")) as { a: number[]; b: number[]; p: number }[];
  it(`${cases.length} cases to 1e-9`, () => {
    for (const c of cases) expect(Math.abs(welchP(c.a, c.b)! - c.p)).toBeLessThan(1e-9);
  });
});
