/**
 * Journey 3 (owner approved 21 October 2026): the threshold edges that had no test, now read from configuration.
 * Rows: S3.6-007, S3.6-016, S3.6-011, S3.5.9-004 to 006, S3.5.13-008 to 014, S3.5.12-006.
 */
import { describe, it, expect } from "vitest";
import { fixture } from "./helpers.js";
import { evaluate, toJsonable } from "../src/index.js";
import { D, ORIENTATIONS, config, eosBand, eosRoute, transition, transitionsFor, WorkflowError, overridePlain, steppingStone, ORIENTATION_PLAYBOOK, PLAYBOOK_VERSION, C2_RESPONSE, C3_RESPONSE, readinessBandIndex, sdi, fitBand, carrierClass, profileOf } from "../src/index.js";

describe("thresholds come from configuration", () => {
  it("holds the published values", () => {
    expect(config.get("scoring.eos.band_edges")).toEqual([0, 30, 50]);
    expect(config.get("scoring.readiness.band_edges").map((e) => e.toFixed(1))).toEqual(["2.0", "3.0", "3.5", "4.0"]);
    expect(config.get("leaders.carrier_lri_min").toFixed(2)).toBe("3.50");
  });
});

describe("eOS bands (S3.6-007, S3.5.9-004 to 006)", () => {
  it("bands on the integer at each edge", () => {
    expect(eosBand(-1)).toBe("NEGATIVE");
    expect(eosBand(0)).toBe("ACCEPTABLE");
    expect(eosBand(30)).toBe("ACCEPTABLE");
    expect(eosBand(31)).toBe("GOOD");
    expect(eosBand(50)).toBe("GOOD");
    expect(eosBand(51)).toBe("EXCELLENT");
  });
});

describe("readiness bands (S3.6-016)", () => {
  it("bands the value rounded to 1 dp at each edge", () => {
    expect(readinessBandIndex("2.04")).toBe(0);   // rounds to 2.0
    expect(readinessBandIndex("2.05")).toBe(1);   // rounds to 2.1
    expect(readinessBandIndex("3.04")).toBe(1);   // the spec's own example: 3.04 is band 2
    expect(readinessBandIndex("3.5")).toBe(2);
    expect(readinessBandIndex("3.96")).toBe(3);   // rounds to 4.0
    expect(readinessBandIndex("4.05")).toBe(4);
  });
});

describe("SDI (S3.5.12-006, S3.6-011)", () => {
  it("is half the summed absolute difference, to 2 dp", () => {
    const org = profileOf([22, 14, 34, 30]);
    const seg = profileOf([30, 16, 32, 22]);
    expect(sdi(seg, org).toFixed(2)).toBe("10.00");   // (8 + 2 + 2 + 8) / 2
    expect(sdi(org, org).toFixed(2)).toBe("0.00");
  });
  it("reaches the 12.00 candidate line exactly", () => {
    const org = profileOf([25, 25, 25, 25]);
    const seg = profileOf([37, 25, 25, 13]);
    expect(sdi(seg, org).gte(D("12.00"))).toBe(true);
  });
});

describe("fit bands (S3.5.13-008, 009)", () => {
  it("bands at 85, 70 and 55", () => {
    expect(fitBand(D("85"))).toBe("MIRRORED");
    expect(fitBand(D("84.99"))).toBe("ALIGNED");
    expect(fitBand(D("70"))).toBe("ALIGNED");
    expect(fitBand(D("69.99"))).toBe("DIVERGENT");
    expect(fitBand(D("55"))).toBe("DIVERGENT");
    expect(fitBand(D("54.99"))).toBe("COUNTER_CULTURAL");
  });
});

describe("carrier classes, first match wins (S3.5.13-010, 013, 014)", () => {
  const classes = { ENGAGE: "BUILD", INNOVATE: "BUILD", PERFORM: "MODERATE", GOVERN: "MODERATE" } as const;
  it("CRITICAL_BLOCKER: 5 below the organisation with an integrity or safety flag, or LRI under 2.50", () => {
    expect(carrierClass(20, 30, ["INTEGRITY"], "3.9", ["PERFORM"], classes)).toBe("CRITICAL_BLOCKER");
    expect(carrierClass(20, 30, [], "2.4", ["PERFORM"], classes)).toBe("CRITICAL_BLOCKER");
  });
  it("CULTURE_BLOCKER, then LAGGING", () => {
    expect(carrierClass(24, 30, [], "3.0", ["PERFORM"], classes)).toBe("CULTURE_BLOCKER");
    expect(carrierClass(24, 30, [], "3.0", ["ENGAGE"], classes)).toBe("LAGGING");
  });
  it("CULTURE_CARRIER needs LRI of 3.50 or more and no hard flag; otherwise EMERGING_CARRIER", () => {
    expect(carrierClass(36, 30, [], "3.50", ["PERFORM"], classes)).toBe("CULTURE_CARRIER");
    expect(carrierClass(36, 30, [], "3.49", ["PERFORM"], classes)).toBe("EMERGING_CARRIER");
    expect(carrierClass(36, 30, ["SAFETY"], "3.9", ["PERFORM"], classes)).toBe("EMERGING_CARRIER");
  });
  it("NEUTRAL inside the margin", () => {
    expect(carrierClass(33, 30, [], "3.9", ["PERFORM"], classes)).toBe("NEUTRAL");
  });
  it("covers every orientation key", () => { expect(ORIENTATIONS.length).toBe(4); });
});

describe("eOS routing (spec Table 48, S3.6-008)", () => {
  it("routes each category, and Q2 follows the leadership target", () => {
    expect(eosRoute("Q1", "PERFORM")).toEqual({ primary: "ENGAGE", secondary: "ALL", why: "overall health" });
    expect(eosRoute("Q2", "PERFORM")?.primary).toBe("PERFORM");
    expect(eosRoute("Q2", "INNOVATE")?.primary).toBe("INNOVATE");
    expect(eosRoute("Q2", null)?.primary).toBeNull();
    expect(eosRoute("Q3", null)).toMatchObject({ primary: "INNOVATE", secondary: "ENGAGE" });
    expect(eosRoute("Q8", null)).toMatchObject({ primary: "PERFORM", secondary: "GOVERN" });
    expect(eosRoute("Q9", null)).toBeNull();
  });
});

describe("finding wording (Journey 4 F2, F5)", () => {
  it("says the decisive override in plain words", () => {
    expect(overridePlain("OVERRIDE_2_LOWEST", ["ENGAGE"])).toBe("Engage is the lowest orientation Now, so this is capped at Miss.");
    expect(overridePlain("OVERRIDE_1_BELOW_THRESHOLD", ["ENGAGE", "PERFORM"])).toBe("Engage and Perform have not passed the required level, so this is capped at Partial hit.");
    expect(overridePlain("OVERRIDE_3_NOT_DOMINANT", ["INNOVATE"])).toBe("Innovate is not the dominant orientation Now, so this is capped at Partial hit.");
    expect(overridePlain("UNKNOWN", ["ENGAGE"])).toBe("");
  });
  it("has a response for every C2 intensity and C3 verdict", () => {
    expect(Object.keys(C2_RESPONSE).sort()).toEqual(["ENTRENCHED", "MARGINAL", "SUBSTANTIVE"]);
    expect(Object.keys(C3_RESPONSE).sort()).toEqual(["HIT", "PARTIAL_HIT", "SYSTEMIC_MISS"]);
    expect(C3_RESPONSE.SYSTEMIC_MISS).toMatch(/90 days/);
  });
});

describe("the in depth playbook (Journey 4 F6)", () => {
  it("holds all four orientations with the full structure", () => {
    expect(PLAYBOOK_VERSION).toBe("1.0");
    for (const o of ORIENTATIONS) {
      const p = ORIENTATION_PLAYBOOK[o];
      expect(p.tagline.length).toBeGreaterThan(10);
      expect(p.profile.map((r) => r.attribute)).toEqual(expect.arrayContaining(["Core focus", "Values", "Leader type", "Relationship to other orientations", "Where it shows in CDP results"]));
      expect(p.matrix.columns).toHaveLength(4);
      expect(p.matrix.rows).toHaveLength(4);
      expect(p.metrics.columns).toHaveLength(2);
      expect(p.metrics.rows.map((r) => r.label)).toEqual(expect.arrayContaining(["Headline performance metric", "Supporting indicators", "Typical contexts"]));
      expect(p.actions.rows.map((r) => r.label.split(" ")[0])).toEqual(["Actions", "Priorities", "HR", "Visible", "CDP"]);
      expect(p.actions.rows[2].values[0].length).toBeGreaterThanOrEqual(4);   // the four system levers
    }
  });
  it("agrees with the planning rules on the system levers and the 30 day signal", () => {
    for (const o of ORIENTATIONS) {
      const levers = ORIENTATION_PLAYBOOK[o].actions.rows[2].values[0].map((l) => l.split(":")[0].trim().toUpperCase().replace(/ /g, "_"));
      expect(levers.length).toBe(4);
      expect(ORIENTATION_PLAYBOOK[o].actions.rows[3].values[0][0]).toMatch(/30 days/);
    }
  });
});

describe("segment and leader signals in the findings (Journey 4 F4, spec 4.5.4)", () => {
  const base = fixture();
  const extra = {
    segments: [{ segment: "department: Operations", significance: "CONFIRMED" as const, dominance_divergence: true, is_subculture: true, eos_negative: ["Q6"] },
      { segment: "grade: Staff", significance: "INDICATIVE" as const, dominance_divergence: false, is_subculture: false, eos_negative: [] }],
  };
  it("appends them after the organisation findings and never moves an organisation finding id", () => {
    const withExtra = evaluate(base.obj, base.setup, extra);
    const n = base.ev.findings.length;
    expect(withExtra.findings.slice(0, n).map((f) => f.finding_id)).toEqual(base.ev.findings.map((f) => f.finding_id));
    expect(withExtra.findings.slice(0, n).map((f) => f.type)).toEqual(base.ev.findings.map((f) => f.type));
    expect(withExtra.findings.length).toBeGreaterThan(n);
    expect(withExtra.findings.slice(n).every((f, i) => f.finding_id === `fnd_${String(n + i + 1).padStart(4, "0")}`)).toBe(true);
  });
  it("names a confirmed sub-culture and a negative engagement category in its group, and ignores an indicative group with no signal", () => {
    const added = evaluate(base.obj, base.setup, extra).findings.slice(base.ev.findings.length);
    expect(added.some((f) => f.type === "SUBCULTURE" && f.segment_definition === "department: Operations" && f.verdict === "CONFIRMED")).toBe(true);
    expect(added.some((f) => f.type === "ENGAGEMENT_MISS" && f.category === "Q6" && f.segment_definition === "department: Operations" && f.blocking)).toBe(true);
    expect(added.some((f) => f.segment_definition === "grade: Staff")).toBe(false);
  });
  it("is the same evaluation, byte for byte, when run twice with the same extras", () => {
    expect(JSON.stringify(toJsonable(evaluate(base.obj, base.setup, extra)))).toBe(JSON.stringify(toJsonable(evaluate(base.obj, base.setup, extra))));
  });
});

describe("stepping stones for a diagonal shift (spec 6.5.1, owner ruling 24 Oct 2026: a move is never drawn straight across)", () => {
  const prof = (e: string, i: string, p: string, g: string) => ({ ENGAGE: D(e), INNOVATE: D(i), PERFORM: D(p), GOVERN: D(g) });
  it("routes Govern to Innovate through the stronger of Perform and Engage", () => {
    expect(steppingStone("GOVERN", "INNOVATE", prof("10", "10", "40", "40"))).toBe("PERFORM");
    expect(steppingStone("GOVERN", "INNOVATE", prof("40", "10", "10", "40"))).toBe("ENGAGE");
  });
  it("breaks a tie towards the same adaptive or structured side as the target", () => {
    expect(steppingStone("GOVERN", "INNOVATE", prof("25", "10", "25", "40"))).toBe("ENGAGE");   // Innovate is adaptive, so Engage
    expect(steppingStone("INNOVATE", "GOVERN", prof("25", "40", "25", "10"))).toBe("PERFORM");  // Govern is structured, so Perform
  });
  it("covers all four diagonals and agrees with the pathway rule", () => {
    for (const [o, t] of [["GOVERN", "INNOVATE"], ["INNOVATE", "GOVERN"], ["PERFORM", "ENGAGE"], ["ENGAGE", "PERFORM"]] as const) {
      const s = steppingStone(o, t, prof("25", "25", "25", "25"));
      expect([o, t]).not.toContain(s);
    }
  });
});

describe("rules 2.2: the client owns the plan (owner ruling 22 Oct 2026, design J4b)", () => {
  const act = (status: string) => ({ status, horizon: "QUICK_WIN_0_3M", owner: "COO", sponsor: "CEO", kpi: "k", baseline_value: 1, target_value: 2, start_date: "2026-11-01", end_date: "2026-12-01" });
  const run = (status: string, to: string, role: string, rules?: string) => { try { return (transition(act(status) as never, to as never, role, { rules, reason: "r" }) as { status: string }).status; } catch (e) { return e instanceof WorkflowError ? e.code : "ERR"; } };
  it("under 2.0 and 2.1 the consultant moves the action and the Executive approves, as before", () => {
    expect(run("DRAFT", "IN_REVIEW", "PAC_CONSULTANT")).toBe("IN_REVIEW");
    expect(run("DRAFT", "IN_REVIEW", "SYSTEM")).toBe("FORBIDDEN");
    expect(run("APPROVED", "PUBLISHED", "PAC_CONSULTANT", "2.1")).toBe("PUBLISHED");
    expect(run("IN_CO_DESIGN", "APPROVED", "CLIENT_ADMIN", "2.1")).toBe("FORBIDDEN");
  });
  it("under 2.2 the system proposes and the consultant no longer moves an action", () => {
    expect(run("DRAFT", "IN_REVIEW", "SYSTEM", "2.2")).toBe("IN_REVIEW");
    expect(run("IN_REVIEW", "IN_CO_DESIGN", "SYSTEM", "2.2")).toBe("IN_CO_DESIGN");
    for (const [from, to] of [["DRAFT", "IN_REVIEW"], ["IN_REVIEW", "IN_CO_DESIGN"], ["APPROVED", "PUBLISHED"], ["DRAFT", "DISCARDED"]]) expect(run(from, to, "PAC_CONSULTANT", "2.2")).toBe("FORBIDDEN");
  });
  it("under 2.2 the client accepts, publishes and may discard a draft", () => {
    for (const r of ["CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER"]) expect(run("IN_CO_DESIGN", "APPROVED", r, "2.2")).toBe("APPROVED");
    for (const r of ["CLIENT_ADMIN", "EXECUTIVE"]) { expect(run("APPROVED", "PUBLISHED", r, "2.2")).toBe("PUBLISHED"); expect(run("DRAFT", "DISCARDED", r, "2.2")).toBe("DISCARDED"); }
    expect(run("APPROVED", "PUBLISHED", "PEOPLE_LEADER", "2.2")).toBe("FORBIDDEN");
  });
  it("the review moves after publication are unchanged under 2.2", () => {
    expect([...transitionsFor("2.2").get("UNDER_REVIEW>IN_PROGRESS")!].sort()).toEqual([...transitionsFor("2.1").get("UNDER_REVIEW>IN_PROGRESS")!].sort());
    expect([...transitionsFor("2.2").get("UNDER_REVIEW>CLOSED")!].sort()).toEqual(["EXECUTIVE", "PEOPLE_LEADER"]);
  });
  it("the mandatory fields still block acceptance", () => {
    expect(() => transition({ ...act("IN_CO_DESIGN"), owner: null } as never, "APPROVED", "CLIENT_ADMIN", { rules: "2.2" })).toThrow(/Missing mandatory/);
  });
});
