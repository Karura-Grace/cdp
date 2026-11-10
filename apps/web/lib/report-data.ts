import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "./supabase/admin";
import type { Database } from "./supabase/database.types";
import { appendixParts, type AppendixPart } from "./release-gate";

type Prof = Record<string, string>;
export interface Score {
  instrument_version: string; rules_version: string;
  orientation_scores: { now: Prof; preferred: Prof; gap: Prof };
  classification: Record<string, string>;
  dominance: { dominant: string[]; secondary: string; shared: boolean };
  culture_strength: string; strength_band: string;
  dimension_now: Record<string, Prof>;
  readiness: { d7: string | null; d8: string | null; d9: string | null; d7_band?: string; d8_band?: string; d9_band?: string; tps: string | null; tps_band: string | null; provisional: boolean; coverage: string };
  eos: { index: string | null } & Partial<Record<"Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8", number | null>>;
  /** Present on scores frozen from October 2026 (engine analytics block). */
  analytics?: {
    gap_bands: Record<string, string>; entropy: { score: string; band: string };
    tensions: { pair: string; a: string; b: string; score: string; band: string }[];
    dispersion: (Record<string, Record<string, string>> & { overall: string }) | null;
    risk: { index: string; band: string; gap: string; dispersion: string; misalignment: string; misalignment_source: string } | null;
  };
  perception_gap: Prof | null; perception_flags: Record<string, string> | null; perception_not_computed_reason: string | null;
  cohorts: { executive?: { n: number }; staff?: { n: number } };
  counts: { now: number; preferred: number };
}
export interface Finding { finding_id: string; type: string; verdict: string; severity: string; orientation?: string[]; category?: string; blocking: boolean }
export interface Evaluation { checks: Record<string, string>; findings: Finding[]; scenarios: { scenario_id: string; name: string; severity: string; diagnosis: string; hypotheses: string[] }[] }

export interface LoadedReport {
  rep: Database["public"]["Tables"]["report"]["Row"];
  score: Score; scoreHash: string; frozenAt: string | null;
  evaluation: Evaluation | undefined; evaluationHash: string | null;
  role: string | null; tenantName: string | null;
  /** The assessment purpose stored on the engagement (spec 1.4.5); exports print it. */
  purpose: string | null;
  /** Org graph checks as they stood at launch (no names or emails). `recorded` is false for engagements launched before the graph existed. */
  org: { recorded: boolean; overrides: Record<string, string>; warnings: string[] };
  /** The assessment version (spec 1.6.2): the setup version, and the reason and predecessor when a scoring relevant change made a new version. */
  version?: { setup_version: number; reason: string | null; supersedes: string | null };
  /** The technical appendix parts (release gate, S8): response rate, exclusions, suppression, substitutions, extensions. */
  appendixParts: AppendixPart[];
}

/**
 * Loads one report with the score and evaluation it is pinned to. `db` must be the caller's own client: the
 * report row is read through RLS and is the entitlement. For a RELEASED report the pinned score and evaluation are
 * then read with the service role, strictly by this report's (assessment, version), because People Leaders may
 * read the organisational report but not score_object itself. Returns null when the caller may not see it.
 */
export async function loadReport(db: SupabaseClient<Database>, id: string): Promise<LoadedReport | null> {
  const { data: rep } = await db.from("report").select("*").eq("report_id", id).maybeSingle();
  if (!rep) return null;
  const reader = rep.status === "RELEASED" ? admin() : db;
  const [sc, ev, asm, ten] = await Promise.all([
    reader.from("score_object").select("payload_json, payload_hash, frozen_at").eq("assessment_id", rep.assessment_id).eq("version", rep.score_version).maybeSingle(),
    reader.from("evaluation").select("payload_json, payload_hash").eq("assessment_id", rep.assessment_id).eq("score_version", rep.score_version).maybeSingle(),
    db.from("assessment").select("engagement_id, supersedes_assessment_id, version_reason").eq("assessment_id", rep.assessment_id).maybeSingle(),
    db.from("tenant").select("name").eq("tenant_id", rep.tenant_id).maybeSingle(),
  ]);
  if (!sc.data) return null;
  const role = asm.data ? (await db.rpc("rpc_actor_role", { p_engagement: asm.data.engagement_id })).data : null;
  // the launch snapshot holds only rules, reasons and counts, so a released report may show it to any role that may read the report
  const engRow = asm.data ? (await admin().from("engagement").select("purpose, setup_version").eq("engagement_id", asm.data.engagement_id).maybeSingle()).data : null;
  const purpose = engRow?.purpose ?? null;
  const snap = asm.data ? (await admin().from("org_graph_snapshot").select("defects_json, overrides_json").eq("engagement_id", asm.data.engagement_id).maybeSingle()).data : null;
  const left = ((snap?.defects_json ?? []) as { rule: string; blocking: boolean; message: string }[]).filter((d) => !d.blocking);
  return {
    rep, score: sc.data.payload_json as unknown as Score, scoreHash: sc.data.payload_hash, frozenAt: sc.data.frozen_at,
    evaluation: ev.data?.payload_json as unknown as Evaluation | undefined, evaluationHash: ev.data?.payload_hash ?? null,
    role, tenantName: ten.data?.name ?? null, purpose,
    org: { recorded: !!snap, overrides: (snap?.overrides_json ?? {}) as Record<string, string>, warnings: left.map((d) => d.message) },
    appendixParts: await appendixParts(rep.assessment_id, rep.score_version, !!sc.data.frozen_at, (sc.data.payload_json as { readiness?: { alpha?: Record<"D7" | "D8" | "D9", string | null> } }).readiness?.alpha),
    version: engRow ? { setup_version: engRow.setup_version, reason: asm.data?.version_reason ?? null, supersedes: asm.data?.supersedes_assessment_id ?? null } : undefined,
  };
}
