import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { alphaNotes } from "./score-review";

/** One part of the technical appendix (spec 4.6 release gate): what it holds, and whether it can be shown. A missing part blocks release. */
export type AppendixPart = { key: string; label: string; present: boolean; rows: [string, string][] };

type Manifest = { invited?: number; submitted?: number; counts_by_state?: Record<string, number>; extensions?: { seq: number; old_close: string; new_close: string; working_days: number; reason: string }[]; voids_after_freeze?: unknown[] };

/** The parts the released report must carry, built only from the freeze record, the exclusion log and the score version's own stores
 *  (no names and no counts under the floor: substitutions are counted, never listed). Shared by the report view, the exports and the
 *  release route, so what the checklist says is missing is exactly what the report would lack. */
export async function appendixParts(assessmentId: string, scoreVersion: number, scoreFrozen: boolean, alpha: Parameters<typeof alphaNotes>[0]): Promise<AppendixPart[]> {
  const db = admin();
  const [{ data: asm }, { data: links }, { data: profiles }] = await Promise.all([
    db.from("assessment").select("freeze_manifest").eq("assessment_id", assessmentId).single(),
    db.from("leader_link_result").select("payload_json").eq("assessment_id", assessmentId).eq("score_version", scoreVersion),
    db.from("segment_profile").select("segment_key").eq("assessment_id", assessmentId).eq("score_version", scoreVersion),
  ]);
  const m = (asm?.freeze_manifest ?? null) as Manifest | null;
  const floor = E.config.get("segments.floor");
  const rate = m?.invited ? `${Math.round(100 * (m.submitted ?? 0) / m.invited)}%` : "n/a";
  const subs = (links ?? []).filter((l) => (l.payload_json as { team_basis_note?: string | null }).team_basis_note).length;
  const notes = alphaNotes(alpha);
  return [
    { key: "response_rate", label: "Response rate table", present: !!m && m.invited !== undefined && m.submitted !== undefined,
      rows: [["Response rate", m ? `${m.submitted ?? 0} of ${m.invited ?? 0} invited submitted (${rate})` : "Not recorded"]] },
    { key: "exclusions", label: "Exclusions", present: !!m && !!m.counts_by_state,
      rows: [["Responses by completion state", Object.entries(m?.counts_by_state ?? {}).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(", ") || "Not recorded"]] },
    { key: "suppression", label: "Suppression notes", present: scoreFrozen,
      rows: [["Reporting floor", `Groups with fewer than ${floor} valid responses are not reported and are merged into their parent group. ${(profiles ?? []).length} group profiles are reported.`]] },
    { key: "substitutions", label: "Substitutions", present: scoreFrozen,
      rows: [["Team profiles substituted", subs ? `${subs} leader team profile${subs === 1 ? " was" : "s were"} computed against a parent unit because the team is below the reporting threshold.` : "None"]] },
    { key: "extensions", label: "Window extensions", present: !!m && Array.isArray(m.extensions),
      rows: [["Survey window extensions", m?.extensions?.length ? m.extensions.map((x) => `${x.seq}: ${x.working_days} working days, ${x.reason}`).join("; ") : "None"]] },
    // overrides and the graph checks are always stated by appendixRows ("Not recorded" for an engagement launched before they existed)
    { key: "overrides", label: "Overrides", present: true, rows: [] },
    ...(notes.length ? [{ key: "consistency", label: "Answer consistency", present: true, rows: [["Answer consistency", notes.join(" ")] as [string, string]] }] : []),
  ];
}

export const missingParts = (parts: AppendixPart[]) => parts.filter((p) => !p.present).map((p) => p.label);
