/**
 * @pac/cdp-engine — the deterministic core of the CDP Platform (instrument 1.1, rules 2.0).
 *
 * Pure functions only: no database, network, clock, randomness or AI. Callers (Next.js route handlers,
 * Supabase-scheduled jobs) load frozen inputs, call the engine, and persist the returned objects.
 */
export * as num from "./num.js";
export { D, Decimal, q, profileOf, ORIENTATIONS, DIMENSIONS_CS, LIKERT_DIMS } from "./num.js";
export type { Orientation, Dimension, LikertDim, Profile } from "./num.js";
export * as config from "./config.js";
export { RULES_VERSION, INSTRUMENT_VERSION, withRules, rulesVersion } from "./config.js";
export type { RulesVersion } from "./config.js";
export { toJsonable, canonicalJson, payloadHash } from "./canonical.js";
export * from "./types.js";
export * from "./scoring.js";
export * from "./checks.js";
export * from "./finding-text.js";
export * from "./playbook-data.js";
export * from "./planning.js";
export * from "./reassess.js";
export * from "./pulse.js";
export * from "./suppression.js";
export * from "./segments.js";
export * from "./capture.js";
export * from "./dates.js";
export { welchP } from "./stats.js";
export { RULES_2_0 } from "./rules-data.js";
export * from "./guardrails.js";
export * from "./advice.js";
