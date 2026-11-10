/**
 * Configuration registry (spec Appendix I). Engine code reads thresholds from here, never literals.
 * A rules version is an immutable value of this shape; GLOBAL keys change only by publishing a new rules version.
 * TENANT keys may be overridden per tenant by a PAC Consultant (D-05).
 */
import { D, Decimal, Orientation, ORIENTATIONS } from "./num.js";

export const RULES_VERSION = "2.0" as const;   // the default; see withRules for 2.1
export const INSTRUMENT_VERSION = "1.1";

export const GLOBAL = {
  "scoring.gap.build": D("8.00"),
  "scoring.gap.strengthen": D("4.00"),
  "scoring.dominance.shared_lt": D("1.00"),
  "scoring.strength.bands": [D(5), D(10), D(15)] as const,
  "scoring.congruence.bands": [5, 3] as const,
  "scoring.likert.min_answered": 9,
  "scoring.eos.advocate_min": 9,
  "scoring.eos.critic_max": 6,
  "scoring.tps.weights": [D("0.35"), D("0.30"), D("0.20"), D("0.15")] as const,
  "scoring.tps.bands": [D("2.50"), D("3.50"), D("4.00")] as const,
  "scoring.tps.provisional_coverage_lt": D("0.60"),
  "scoring.lri.weights": [D("0.35"), D("0.30"), D("0.20"), D("0.15")] as const,
  "scoring.360.min_raters": 3,
  "scoring.360.min_observed": D("0.60"),
  "scoring.360.min_observed_items": null as number | null,   // 2.1: a count per section replaces the share
  "quality.exclusion_rule": "SPEEDING_PLUS_ONE" as "SPEEDING_PLUS_ONE" | "ANY_TWO",
  "scoring.360.flag.integrity_lt": D("4.00"),
  "scoring.360.flag.safety_lt": D("3.00"),
  "scoring.360.flag.change_lt": D("3.00"),
  "scoring.360.gap_tiers": [D("0.50"), D("1.00")] as const,
  "scoring.360.default_shared_lt": D("0.10"),
  "scoring.360.range_lt": D("0.50"),
  "segments.floor": 5,
  "segments.qual_floor": 8,
  "segments.perception": [D("5.00"), D("7.00")] as const,
  "segments.sdi_candidate": D("12.00"),
  "segments.single_divergence": D("8.00"),
  "segments.readiness_divergence": D("0.50"),
  "segments.significance_alpha": D("0.05"),
  "leaders.fit_bands": [D(85), D(70), D(55)] as const,
  "leaders.carrier_margin": D("5.00"),
  "leaders.carrier_lri_min": D("3.50"),                      // LRI at or above this, no hard flag: CULTURE_CARRIER; also splits the contribution quadrant
  "scoring.readiness.band_edges": [D("2.0"), D("3.0"), D("3.5"), D("4.0")] as const,   // upper edges (inclusive) of the first four D7 to D9 bands, on 1 dp
  "scoring.eos.band_edges": [0, 30, 50] as const,            // below 0 NEGATIVE; to 30 ACCEPTABLE; to 50 GOOD; above EXCELLENT
  "checks.alignment_bands": [D(80), D(60)] as const,
  "checks.c2_intensity": [D("5.00"), D("15.00")] as const,
  "gates.readiness_le": D("3.0"),
  "plan.priority_caps": [2, 3, 4] as const,
  "plan.visible_signal_days": 30,
  "tracking.rag_flat_band": D("0.05"),
  "survey.min_window_working_days": 10,
  "setup.min_workshop_executives": 2,
  "survey.speeding_min_seconds": 480,
  "survey.speeding_median_fraction": D(1).div(D(3)),
  "pulse.max_items": 10,
  "pulse.triggers": [D("0.5"), D(15), D("8.0")] as const,
  "quality.alpha_disclose_lt": D("0.70"),
  "quality.uniform_min": 12,
  "quality.duplicate_min": 16,
  // reading aids and indices from the PAC reference platform (CDP v6); see docs/REFERENCE_REVIEW_2026-10.md
  "analytics.gap_bands": [D(4), D(8), D(16)] as const,
  "analytics.entropy_bands": [D(6), D(12), D(20)] as const,
  "analytics.risk.weights": [D("0.40"), D("0.30"), D("0.30")] as const,
  "analytics.risk.scale": [D(20), D(12), D(12)] as const,
  "analytics.risk.bands": [D(35), D(60)] as const,
  "analytics.risk.misalignment_default": D(5),
  "analytics.tension.factor": D("0.8"),
  "analytics.tension.bands": [D(4), D(7)] as const,
  // PAC default targets for the risk dashboard in the full report: [measure, "lt" | "gte" | "gt", target]
  // report wording only (owner Q-AL27, Q-AL38, 1 Nov 2026): orientation sums within this many points read as balanced on an axis;
  // KPI targets sit this share better than the baseline at 12 and 18 months
  "analytics.axis_balance": D(5),
  "kpi.target_step": [D("0.10"), D("0.20")] as const,
  // AI polish of report chapters (owner Q-AL26, Q-AL39, plain chat 1 Nov 2026): Haiku by default, Sonnet when the consultant asks, always at
  // medium effort; refuse once the month's estimated spend reaches the cap. Prices are US dollars per million tokens, input then output.
  "ai.model": "claude-sonnet-5-5",
  "ai.models": { "claude-haiku-5-5": [D("0.10"), D("0.50")], "claude-sonnet-5-5": [D("2.00"), D("10.00")] } as const,
  "ai.effort": "low",
  "ai.prompt_version": "polish-1",
  "ai.monthly_cap_usd": D(35),
  "analytics.targets": [["entropy", "lt", D(6)], ["risk_index", "lt", D(35)], ["d8", "gte", D("3.5")], ["d9", "gte", D("3.5")], ["eos_index", "gt", D(20)], ["perception_gap", "lt", D(5)]] as const,
} as const;

export const TENANT_DEFAULTS = {
  "plan.action_caps": [6, 3, 3] as const,
  "tracking.escalation_days": [7, 14, 21, 28] as const,
  "retention.response_months": 24,
  "retention.aggregate_after_exit_months": 24,
  "ai.enabled": true,
} as const;

type Registry = typeof GLOBAL & typeof TENANT_DEFAULTS;
export type ConfigKey = keyof Registry;
export type TenantOverrides = Partial<{ [K in keyof typeof TENANT_DEFAULTS]: (typeof TENANT_DEFAULTS)[K] | readonly number[] | number | boolean }>;

let tenantOverrides: TenantOverrides = {};

/** Rules version 2.1 (17 October 2026 spec, owner decisions V-02 and V-05): only the GLOBAL keys it changes. Assessments
 *  pinned to 2.1 score under it; everything pinned to 2.0 keeps the values above. */
export type RulesVersion = "2.0" | "2.1" | "2.2";   // 2.2 scores exactly as 2.1: it only changes who moves an action (see planning.ts TRANSITIONS_2_2)
const RULES_2_1: { [K in keyof typeof GLOBAL]?: (typeof GLOBAL)[K] } = {
  "survey.speeding_median_fraction": D("0.40"),
  "quality.exclusion_rule": "ANY_TWO",
  "scoring.360.min_observed_items": 3,
};
let activeRules: RulesVersion = RULES_VERSION;
export const rulesVersion = (): RulesVersion => activeRules;

/** Run `fn` under a rules version (as withTenant: an explicit input, restored afterwards). */
export function withRules<T>(version: RulesVersion, fn: () => T): T {
  const prev = activeRules;
  activeRules = version;
  try {
    return fn();
  } finally {
    activeRules = prev;
  }
}

/** Read a configuration key. Tenant overrides apply only to TENANT-scoped keys. */
export function get<K extends ConfigKey>(key: K, overrides?: TenantOverrides): Registry[K] {
  const o = overrides ?? tenantOverrides;
  if ((activeRules === "2.1" || activeRules === "2.2") && key in RULES_2_1) return (RULES_2_1 as Record<string, unknown>)[key] as Registry[K];
  if (key in TENANT_DEFAULTS && o && key in o) return (o as Record<string, unknown>)[key] as Registry[K];
  if (key in GLOBAL) return (GLOBAL as Record<string, unknown>)[key] as Registry[K];
  return (TENANT_DEFAULTS as Record<string, unknown>)[key] as Registry[K];
}

/** Run `fn` with tenant overrides in force (engine stays pure: overrides are an explicit input). */
export function withTenant<T>(overrides: TenantOverrides, fn: () => T): T {
  const prev = tenantOverrides;
  tenantOverrides = overrides;
  try {
    return fn();
  } finally {
    tenantOverrides = prev;
  }
}

export function registry(): Record<string, unknown> {
  return { ...GLOBAL, ...TENANT_DEFAULTS };
}

// C1 requirement lookup (§1.5.1) and C4 business-model lookup (§1.5.2)
export const SINGLE_THRESHOLD: Record<Orientation, Decimal> = { ENGAGE: D(30), PERFORM: D(30), INNOVATE: D(28), GOVERN: D(28) };
export type RequirementType = "SINGLE" | "JOINT" | "PAIRED" | "DOMINANT" | "BALANCED";
export const GOAL_TYPES: Record<string, [RequirementType, Orientation[], Partial<Record<Orientation, Decimal>>]> = {
  RESULTS_GROWTH: ["SINGLE", ["PERFORM"], { PERFORM: D(30) }],
  INNOVATION_NEW_MODELS: ["SINGLE", ["INNOVATE"], { INNOVATE: D(28) }],
  PEOPLE_TALENT: ["SINGLE", ["ENGAGE"], { ENGAGE: D(30) }],
  COMPLIANCE_PROCESS: ["SINGLE", ["GOVERN"], { GOVERN: D(28) }],
  TRANSFORMATION: ["JOINT", ["ENGAGE", "INNOVATE"], { ENGAGE: D(26), INNOVATE: D(26) }],
};
export const BUSINESS_MODELS: Record<string, [RequirementType, Orientation[]]> = {
  PRODUCT_B2B: ["PAIRED", ["PERFORM", "INNOVATE"]],
  SERVICE_B2C: ["PAIRED", ["ENGAGE", "PERFORM"]],
  PLATFORM_DIGITAL: ["DOMINANT", ["INNOVATE"]],
  NGO_SOCIAL_IMPACT: ["PAIRED", ["ENGAGE", "INNOVATE"]],
  REGULATED: ["PAIRED", ["GOVERN", "PERFORM"]],
};
export const BALANCED_THRESHOLD = D(24);

/** UT-12: weight vectors must sum to exactly 1.00; any other vector is a configuration error. */
export function assertWeights(weights: readonly Decimal[] = GLOBAL["scoring.tps.weights"]): void {
  const s = weights.reduce((a, b) => a.plus(b), D(0));
  if (!s.eq(D("1.00"))) throw new Error(`CONFIGURATION_ERROR: weights must sum to 1.00 (got ${s.toFixed()})`);
}
assertWeights(GLOBAL["scoring.tps.weights"]);
assertWeights(GLOBAL["scoring.lri.weights"]);
export { ORIENTATIONS };
