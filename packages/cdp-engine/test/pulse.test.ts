import { describe, it, expect } from "vitest";
import { commonReading, parsePulseRef, pulseAnswersFromResponse, pulseReading, pulseTriggers, validatePulseAnswers, SHORT_FORM_ITEM_IDS } from "../src/index.js";
import type { ResponseInput } from "../src/index.js";

const alloc = (e: number, i: number, p: number, g: number) => ({ ENGAGE: e, INNOVATE: i, PERFORM: p, GOVERN: g });
const resp = (id: string, eos0: number, d8: number, s2: ReturnType<typeof alloc>): ResponseInput => ({
  id, snapshot: {}, alloc: { NOW: { D2: [null, s2, null] } },
  likert: { D8: Array.from({ length: 12 }, (_, i) => ([1, 2, 4, 10].includes(i) ? d8 : 1)) }, eos: [eos0, 5, 5, 5, 5, 5, 5, 5],
});
const ITEMS = ["D2 S2", "D8", "eOS Q1"];

describe("pulse answers and readings", () => {
  it("parses the three reference kinds and rejects others", () => {
    expect(parsePulseRef("D2 S2")).toEqual({ kind: "scenario", dim: "D2", set: 2 });
    expect(parsePulseRef("D8")).toEqual({ kind: "dimension", dim: "D8" });
    expect(parsePulseRef("eOS Q1")).toEqual({ kind: "eos", q: 1 });
    expect(parsePulseRef("D10")).toBeNull();
  });
  it("validates shape, constant sum and scales", () => {
    const ok = { "D2 S2": alloc(40, 20, 20, 20), D8: Object.fromEntries(SHORT_FORM_ITEM_IDS.D8.map((k) => [k, 3])), "eOS Q1": 8 };
    expect(validatePulseAnswers(ITEMS, ok)).toEqual([]);
    expect(validatePulseAnswers(ITEMS, { ...ok, "D2 S2": alloc(40, 20, 20, 10) })).toHaveLength(1);
    expect(validatePulseAnswers(ITEMS, { ...ok, "eOS Q1": 11 })).toHaveLength(1);
    expect(validatePulseAnswers(ITEMS, { ...ok, D8: { "D8-01": 3 } })).toHaveLength(1);
    expect(validatePulseAnswers(ITEMS, { ...ok, "eOS Q2": 3 })).toHaveLength(1);
    expect(validatePulseAnswers(ITEMS, { "eOS Q1": 8 })).toEqual([]);                 // skipping an item is allowed
  });
  it("reads the baseline and the pulse on the same items and raises movement triggers", () => {
    const base = [resp("a", 9, 2, alloc(20, 20, 40, 20)), resp("b", 3, 3, alloc(30, 20, 30, 20))].map((r) => pulseAnswersFromResponse(r, ITEMS));
    const cur = [resp("c", 9, 4, alloc(40, 20, 20, 20)), resp("d", 9, 4, alloc(40, 20, 20, 20))].map((r) => pulseAnswersFromResponse(r, ITEMS));
    const b = pulseReading(base, ITEMS, "PERFORM"), c = pulseReading(cur, ITEMS, "PERFORM");
    expect(b.reading.scenario!["D2 S2"].toString()).toBe("35");
    expect(c.reading.scenario!["D2 S2"].toString()).toBe("20");
    expect(b.reading.likert!.D8.toString()).toBe("2.5");
    expect(c.n["D8"]).toBe(2);
    const [x, y] = commonReading(b.reading, c.reading);
    expect(pulseTriggers(x, y).map((t) => t.ref)).toEqual(["D8", "eOS Q1", "D2 S2"]);
  });
  it("leaves out references nobody answered, so no baseline value is invented", () => {
    const r = pulseReading([{}, {}], ITEMS, "ENGAGE");
    expect(r.reading).toEqual({ likert: {}, eos: {}, scenario: {} });
    expect(r.n).toEqual({});
  });
});
