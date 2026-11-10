/**
 * Reading aids and indices from the PAC reference platform (CDP v6): gap bands, cultural entropy, tensions, answer spread
 * and the Culture Risk Index. Expected values are worked by hand from the reference formulas.
 */
import { describe, it, expect } from "vitest";
import { D, profileOf, gaps, gapBand, entropy, tensions, dispersion, cultureRisk, scoreAssessment, valuesReality, leaderHighlights } from "../src/index.js";
import { fixture, loadCase } from "./helpers.js";
import type { ResponseInput } from "../src/index.js";

const G = gaps(profileOf([22, 14, 34, 30]), profileOf([31, 25, 28, 16]));   // +9, +11, -6, -14

describe("gap bands", () => {
  it("bands by absolute size at 4, over 8 and 16", () => {
    expect(["3.99", "4", "8", "8.01", "15.99", "16", "-16"].map(gapBand)).toEqual(["LOW", "MODERATE", "MODERATE", "SIGNIFICANT", "SIGNIFICANT", "CRITICAL", "CRITICAL"]);
  });
});

describe("cultural entropy", () => {
  it("is the mean absolute gap: (9 + 11 + 6 + 14) / 4 = 10.00, MODERATE", () => {
    const e = entropy(G);
    expect(e.score.toFixed(2)).toBe("10.00");
    expect(e.band).toBe("MODERATE");
  });
  it("bands at 6, 12 and 20", () => {
    expect(entropy(profileOf([5.99, 5.99, 5.99, 5.99])).band).toBe("LOW");
    expect(entropy(profileOf([12, -12, 12, -12])).band).toBe("HIGH");
    expect(entropy(profileOf([20, -20, 20, -20])).band).toBe("CRITICAL");
  });
});

describe("tensions", () => {
  it("opposite directions add: ENGAGE +9 and PERFORM -6 give (9 + 6) x 0.8 = 12, capped at 10, HIGH", () => {
    const [ep, ig] = tensions(G);
    expect(ep.pair).toBe("ENGAGE_PERFORM");
    expect(ep.score.toFixed(1)).toBe("10.0");
    expect(ep.band).toBe("HIGH");
    expect(ig.score.toFixed(1)).toBe("10.0");   // (11 + 14) x 0.8 = 20, capped
  });
  it("same direction averages: +5 and +3 give (5 + 3) / 2 x 0.8 = 3.2, LOW", () => {
    const t = tensions(profileOf([5, 0, 3, 0]))[0];
    expect(t.score.toFixed(1)).toBe("3.2");
    expect(t.band).toBe("LOW");
  });
});

const resp = (e: number): ResponseInput => ({
  id: `r${e}`, duration: 2000, snapshot: { is_executive: false },
  alloc: { NOW: Object.fromEntries(["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => [d, [0, 1, 2].map(() => ({ ENGAGE: e, INNOVATE: 100 - e - 50, PERFORM: 25, GOVERN: 25 }))])) },
} as unknown as ResponseInput);

describe("answer spread", () => {
  it("is null below two respondents", () => expect(dispersion([resp(20)])).toBeNull());
  it("is the sample standard deviation across respondents: ENGAGE 20 and 30 give 7.07", () => {
    const d = dispersion([resp(20), resp(30)])!;
    expect(d.dims.D1.ENGAGE.toFixed(2)).toBe("7.07");
    expect(d.dims.D1.PERFORM.toFixed(2)).toBe("0.00");
    // ENGAGE and INNOVATE each 7.07, PERFORM and GOVERN 0: average 3.54 in every dimension
    expect(d.overall.toFixed(2)).toBe("3.54");
  });
});

describe("Culture Risk Index", () => {
  it("weights gap 40, spread 30, misalignment 30, each scaled to 100", () => {
    // gap 10 / 20 = 50; spread 6 / 12 = 50; misalignment (default 5) / 12 = 41.67 -> 20 + 15 + 12.5 = 47.5 -> 48, MEDIUM
    const r = cultureRisk(G, D(6), null)!;
    expect(r.index.toFixed(0)).toBe("48");
    expect(r.band).toBe("MEDIUM");
    expect(r.misalignment_source).toBe("DEFAULT");
  });
  it("uses the mean perception gap when present, and caps each part at 100", () => {
    const r = cultureRisk(profileOf([40, -40, 40, -40]), D(30), profileOf([24, 24, 24, 24]))!;
    expect(r.index.toFixed(0)).toBe("100");
    expect(r.band).toBe("HIGH");
  });
  it("is null without a spread", () => expect(cultureRisk(G, null, null)).toBeNull());
});

describe("scores frozen before the analytics block", () => {
  it("reproduce the hash they were frozen with when analytics is off", () => {
    const c = loadCase("fixture");
    const fx = fixture();
    const off = scoreAssessment(c.input.responses, fx.setup, fx.leaders, c.input.scope, { analytics: false });
    expect(off.payload.analytics).toBeUndefined();
    expect(off.hash).toBe("sha256:3366fa7d44dc320d6855e81602fcc41ce4a8fafabd760d2e7b06ac4657e69348");   // fixture hash under rules 2.0 before October 2026
    expect(fx.hash).not.toBe(off.hash);
  });
});

describe("values against reality", () => {
  it("compares D1 with the mean of D4 and D6", () => {
    const p = (e: number) => ({ ENGAGE: String(e), INNOVATE: "25", PERFORM: "25", GOVERN: String(50 - e) });
    const v = valuesReality({ D1: p(40), D2: p(0), D3: p(0), D4: p(20), D5: p(0), D6: p(30) } as never);
    expect(v.ENGAGE.lived.toFixed(2)).toBe("25.00");
    expect(v.ENGAGE.delta.toFixed(2)).toBe("-15.00");
    expect(v.GOVERN.delta.toFixed(2)).toBe("15.00");
  });
});

describe("leader highlights", () => {
  const rater = (v: (i: number) => number | null) => ({ group: "PEER", ratings: Array.from({ length: 60 }, (_, i) => v(i)) }) as never;
  it("needs the rater floor", () => expect(leaderHighlights(null, [rater(() => 3), rater(() => 3)])).toBeNull());
  it("ranks items by rater mean and leaves out items fewer than three raters observed", () => {
    const rs = [rater((i) => (i === 0 ? 5 : i === 1 ? 1 : 3)), rater((i) => (i === 0 ? 5 : i === 1 ? 2 : i === 2 ? null : 3)), rater((i) => (i === 0 ? 4 : i === 1 ? 1 : i === 2 ? null : 3))];
    const h = leaderHighlights(Array(60).fill(4), rs, 2)!;
    expect(h.top[0]).toMatchObject({ item: 1, observed: 3, self: 4 });
    expect(h.top[0].others.toFixed(2)).toBe("4.67");
    expect(h.bottom[0].item).toBe(2);
    expect(h.bottom[0].others.toFixed(2)).toBe("1.33");
    expect([...h.top, ...h.bottom].some((x) => x.item === 3)).toBe(false);
  });
});

describe("payload version 3: Preferred per dimension, employee voice counts, readiness items", () => {
  it("version 2 reproduces the hash scores were frozen with in October 2026", () => {
    const c = loadCase("fixture"), fx = fixture();
    const v2 = scoreAssessment(c.input.responses, fx.setup, fx.leaders, c.input.scope, { version: 2 });
    expect(v2.hash).toBe("sha256:8817990a04ebf6e4988ba137645d358a4f7f0b9a277b570c4e832e9f76a373e4");
    expect(v2.payload.dimension_preferred).toBeUndefined();
  });
  it("version 3 adds the three blocks and counts add up", () => {
    const p = fixture().payload as Record<string, any>;
    expect(Object.keys(p.dimension_preferred)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6"]);
    const q1 = p.eos_detail.Q1;
    expect(q1.promoters + q1.passives + q1.detractors).toBe(q1.n);
    expect(Math.round((100 * (q1.promoters - q1.detractors)) / q1.n)).toBe(p.eos.Q1);
    expect(p.readiness_items.D8).toHaveLength(12);
    expect(p.readiness_items.D8.every((v: string | null) => v === null || (Number(v) >= 1 && Number(v) <= 5))).toBe(true);
  });
});
