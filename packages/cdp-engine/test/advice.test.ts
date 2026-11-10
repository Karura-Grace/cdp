// Advice library matching (owner rounds Q-AL1 to Q-AL25, 31 October 2026).
import { describe, it, expect } from "vitest";
import { adviceFacts, groupFacts, fillConfig, fillFacts, kpiTargets, matchAdvice, ruleMatches, specificity, ADVICE_CAPS, toJsonable } from "../src/index.js";
import type { Rule } from "../src/index.js";
import { fixture } from "./helpers.js";

const f = () => {
  const x = fixture();
  return adviceFacts(x.payload as Record<string, unknown>, toJsonable(x.ev) as Record<string, unknown>, { sector: "BANKING" });
};

describe("advice facts", () => {
  it("reads the frozen numbers, bands, checks and scenarios", () => {
    const facts = f();
    const x = fixture();
    expect(facts.dominant).toBe(x.obj.dominance.dominant[0]);
    expect(facts["class.ENGAGE"]).toBe(x.obj.classification.ENGAGE);
    expect(facts["check.C1"]).toBe(x.ev.checks.C1);
    expect(facts.scenario).toEqual(x.ev.scenarios.map((s) => s.scenario_id));
    expect(typeof facts["gap.ENGAGE"]).toBe("string");          // numbers stay decimal strings, never JS floats
    expect(facts["dim.D1.top"]).toMatch(/^(ENGAGE|INNOVATE|PERFORM|GOVERN)$/);
    expect(facts["org.sector"]).toBe("BANKING");
  });
});

describe("group facts", () => {
  it("adds the group's difference from the organisation and whether its dominant differs", () => {
    const org = { dominant: "PERFORM", "now.ENGAGE": "22.36", "now.PERFORM": "30.14" };
    const g = groupFacts(org, { ENGAGE: "31.00", PERFORM: "25.00" });
    expect(g["seg.diff.ENGAGE"]).toBe("8.64");
    expect(g["seg.diff.PERFORM"]).toBe("-5.14");
    expect(g["seg.dominant"]).toBe("ENGAGE");
    expect(g["seg.diverges"]).toBe(true);
    expect(g.dominant).toBe("PERFORM");                                             // organisation facts stay available
  });
});

describe("rules", () => {
  const facts = { "gap.ENGAGE": "12.02", "class.ENGAGE": "BUILD", "check.C2": "MISS", scenario: ["SC-06"], "eos.Q8": -100, missing: null };
  it("compares numbers as decimals and bands as text", () => {
    expect(ruleMatches({ fact: "gap.ENGAGE", op: "gte", value: "12.02" }, facts)).toBe(true);
    expect(ruleMatches({ fact: "gap.ENGAGE", op: "gt", value: 12.02 }, facts)).toBe(false);
    expect(ruleMatches({ fact: "eos.Q8", op: "lt", value: 0 }, facts)).toBe(true);
    expect(ruleMatches({ fact: "class.ENGAGE", op: "in", value: ["BUILD", "STRENGTHEN"] }, facts)).toBe(true);
    expect(ruleMatches({ fact: "scenario", op: "has", value: "SC-06" }, facts)).toBe(true);
  });
  it("combines with all, any and not; a missing number never fires", () => {
    const r: Rule = { all: [{ fact: "class.ENGAGE", op: "eq", value: "BUILD" }, { any: [{ fact: "check.C2", op: "eq", value: "HIT" }, { not: { fact: "check.C2", op: "eq", value: "HIT" } }] }] };
    expect(ruleMatches(r, facts)).toBe(true);
    expect(ruleMatches({ fact: "missing", op: "ne", value: "x" }, facts)).toBe(false);
    expect(ruleMatches({ fact: "nowhere", op: "lt", value: 1 }, facts)).toBe(false);
    expect(ruleMatches({}, facts)).toBe(true);
    expect(specificity(r)).toBe(2);
  });
});

describe("matching", () => {
  const facts = { "class.ENGAGE": "BUILD", "org.sector": "BANKING" };
  const item = (id: string, priority: number, rule: Rule, tags: Record<string, string[]> | null = null) => ({ item_id: id, section: "orientation.ENGAGE", priority, rule, tags });
  const hit: Rule = { fact: "class.ENGAGE", op: "eq", value: "BUILD" };
  it("ranks by priority, then tag fit, then specificity; caps per section and keeps the rest", () => {
    const out = matchAdvice([item("a", 50, hit), item("b", 80, hit), item("c", 50, hit, { sector: ["BANKING"] }), item("d", 50, hit, { sector: ["NGO"] }),
      item("e", 90, { fact: "class.ENGAGE", op: "eq", value: "MODERATE" })], facts, ADVICE_CAPS);
    expect(out.map((p) => p.item.item_id)).toEqual(["b", "c", "a"]);              // d: wrong sector; e: rule does not match
    expect(out.map((p) => p.capped)).toEqual([false, false, true]);               // orientation cap is 2
    expect(out.map((p) => p.rank)).toEqual([1, 2, 3]);
  });
  it("is deterministic", () => {
    const items = [item("x", 50, hit), item("y", 50, hit)];
    expect(matchAdvice(items, facts, ADVICE_CAPS)).toEqual(matchAdvice([...items].reverse(), facts, ADVICE_CAPS));
  });
});

describe("config placeholders", () => {
  it("quotes the live cut points, and leaves unknown keys as written", () => {
    expect(fillConfig("Build from {{scoring.gap.build}} points")).toBe("Build from 8 points");
    expect(fillConfig("Moderate from {{analytics.gap_bands.0}}")).toBe("Moderate from 4");
    expect(fillConfig("{{no.such.key}}")).toBe("{{no.such.key}}");
  });
});

describe("deeper facts, fact slots and KPI targets (owner Q-AL26 to Q-AL38, 1 Nov 2026)", () => {
  it("reads spread, axes, espoused against lived, cohorts and voice bands from the payload", () => {
    const facts = f();
    expect(facts["spread.ENGAGE"]).toMatch(/^\d+\.\d{2}$/);
    expect(facts["spread.top"]).toMatch(/^(ENGAGE|INNOVATE|PERFORM|GOVERN)$/);
    expect(["INWARD", "OUTWARD", "BALANCED"]).toContain(facts["axis.focus"]);
    expect(["FLEXIBLE", "STRUCTURED", "BALANCED"]).toContain(facts["axis.style"]);
    expect(facts["vr.widest"]).toMatch(/^(ENGAGE|INNOVATE|PERFORM|GOVERN)$/);
    expect(facts["eos_band.Q1"]).toMatch(/^(NEGATIVE|ACCEPTABLE|GOOD|EXCELLENT)$/);
    const ax = (k: string) => Number(facts[`axis.${k}`]);
    expect(ax("inward") + ax("outward")).toBeCloseTo(100, 0);
  });
  it("marks a group that leads with the organisation's diagonal opposite", () => {
    expect(groupFacts({ dominant: "PERFORM" }, { ENGAGE: "31.00", PERFORM: "25.00" })["seg.opposes"]).toBe(true);
    expect(groupFacts({ dominant: "PERFORM" }, { GOVERN: "31.00", PERFORM: "25.00" })["seg.opposes"]).toBe(false);
  });
  it("fills fact slots with decimals and signs, and leaves a missing fact as written", () => {
    const facts = { "gap.ENGAGE": "12.04", dominant: "PERFORM", "gap.GOVERN": "-9.2" };
    expect(fillFacts("Engage {{f:gap.ENGAGE|+1}}, Govern {{f:gap.GOVERN|+1}}, led by {{f:dominant}}", facts)).toBe("Engage +12.0, Govern -9.2, led by PERFORM");
    expect(fillFacts("{{f:nope}}", facts)).toBe("{{f:nope}}");
  });
  it("sets KPI targets a fixed share better than baseline, inside the scale", () => {
    expect(kpiTargets("50", "down", ["0", "100"], 0)).toEqual(["45", "40"]);
    expect(kpiTargets("3.17", "up", ["1", "5"])).toEqual(["3.49", "3.80"]);
    expect(kpiTargets("-23", "up", ["-100", "100"], 0)).toEqual(["-21", "-18"]);
    expect(kpiTargets("0", "up", ["-100", "100"], 0)).toEqual(["20", "40"]);
    expect(kpiTargets("4.8", "up", ["1", "5"])).toEqual(["5.00", "5.00"]);
  });
});
