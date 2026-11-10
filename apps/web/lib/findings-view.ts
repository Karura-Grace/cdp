import * as E from "@pac/cdp-engine";
import { ORIENT_NAME, dp, human, type Orientation } from "./format";

export type FindingRow = {
  finding_id: string; type: string; verdict: string; severity: string; blocking: boolean; orientation?: string[]; category?: string; segment_definition?: string;
  metrics?: Record<string, unknown>; evidence?: Record<string, unknown>; escalated_with?: string | null;
};
export type EvalPayload = {
  checks: Record<"C1" | "C2" | "C3" | "C4", string>; c1: FindingRow[]; c2: FindingRow; c3: FindingRow; c4: FindingRow; findings: FindingRow[];
  scenarios: { scenario_id: string; name: string; severity: string; diagnosis: string; risks?: string[]; hypotheses: string[] }[];
};

export type Tile = { key: "C1" | "C2" | "C3" | "C4"; name: string; verdict: string; figure: string; why: string; response: string };

const NAMES = { C1: "Strategy fit", C2: "Leadership behaviour", C3: "What to stop and start", C4: "Business-model readiness" } as const;
const orientNames = (o?: string[]) => (o ?? []).map((x) => ORIENT_NAME[x as Orientation] ?? x);

/** The decisive override of a C1 or C4 finding in plain words. Override 2 (lowest orientation) decides first, as it sets the verdict to Miss. */
function decisive(f: FindingRow): string {
  const codes = ((f.evidence?.overrides as string[] | undefined) ?? []);
  const code = codes.find((c) => c === "OVERRIDE_2_LOWEST") ?? codes[0];
  return code ? E.overridePlain(code, f.orientation ?? []) : "";
}

/** Four tiles for the alignment scorecard: verdict word, percentage or rank, and the decisive override in plain words. */
export function checkTiles(e: EvalPayload): Tile[] {
  const worst = [...(e.c1 ?? [])].sort((a, b) => Number(a.metrics?.alignment_pct) - Number(b.metrics?.alignment_pct))[0];
  const pct = (f?: FindingRow) => (f?.metrics?.alignment_pct !== undefined ? `${dp(String(f.metrics.alignment_pct), 1)}%` : "n/a");
  const c2 = e.c2, c3 = e.c3, c4 = e.c4;
  const intensity = c2?.metrics?.intensity as keyof typeof E.C2_RESPONSE | undefined;
  const c3v = c3?.verdict as keyof typeof E.C3_RESPONSE | undefined;
  return [
    { key: "C1", name: NAMES.C1, verdict: e.checks.C1, figure: worst ? `${pct(worst)}${(e.c1?.length ?? 0) > 1 ? ` (lowest of ${e.c1.length} requirements)` : ""}` : "n/a",
      why: worst ? decisive(worst) : "", response: "" },
    { key: "C2", name: NAMES.C2, verdict: e.checks.C2, figure: c2?.metrics?.rank !== undefined ? `Rank ${String(c2.metrics.rank)} of 4, ${dp(String(c2.metrics.behaviour_gap_points ?? 0), 1)} points from the target` : "n/a",
      why: c2?.escalated_with === "SHADOW_CULTURE" ? "This orientation also carries a shadow culture, so this is the strongest single finding for the board." : "",
      response: intensity && c2.verdict === "MISS" ? E.C2_RESPONSE[intensity] : "" },
    { key: "C3", name: NAMES.C3, verdict: e.checks.C3, figure: c3?.metrics?.moderate_count !== undefined ? `${String(c3.metrics.moderate_count)} of 2 mechanisms work against the culture wanted` : "n/a",
      why: c3?.metrics?.identity_risk ? "The bonding narrative is itself part of the problem, so frame the change as keeping it while redirecting its energy." : "",
      response: c3v && E.C3_RESPONSE[c3v] ? E.C3_RESPONSE[c3v] + (c3?.metrics?.identity_risk ? ` ${E.C3_IDENTITY_RISK}` : "") : "" },
    { key: "C4", name: NAMES.C4, verdict: e.checks.C4, figure: pct(c4), why: c4 ? decisive(c4) : "", response: "" },
  ];
}

export const label = (f: FindingRow) =>
  `${human(f.type)}${f.orientation?.length ? ` (${orientNames(f.orientation).join(", ")})` : ""}${f.category ? ` ${f.category}` : ""}${f.segment_definition ? `: ${f.segment_definition}` : ""}`;

export const GROUPS: { key: string; title: string; help: string; types: string[] }[] = [
  { key: "checks", title: "The four checks", help: "Whether the culture carries the strategy, the business model, the leadership the strategy needs, and the stop and start list agreed in the workshop. A blocking finding holds its priority until the pre condition is done.", types: ["C1_PERFORMANCE_ALIGNMENT", "C4_MODEL_READINESS", "C2_BEHAVIOUR_GAP", "C3_STOP_START"] },
  { key: "signals", title: "Signals", help: "Warnings beside the four checks: executives and staff seeing things differently, a voice score below the line, or a readiness reading that limits how much change to plan at once.", types: ["PERCEPTION_GAP", "ENGAGEMENT_MISS", "READINESS_SIGNAL"] },
  { key: "groups", title: "Groups", help: "Groups whose culture differs enough from the organisation to be treated as their own sub culture. Only groups at or above the reporting floor appear.", types: ["SUBCULTURE"] },
];
const SEV = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export const bySeverity = (rows: FindingRow[]) => SEV.map((s) => ({ severity: s, rows: rows.filter((r) => r.severity === s) })).filter((g) => g.rows.length);
