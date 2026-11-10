import { f1Divergence } from "@pac/cdp-engine";
import type { Orientation } from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { SECTIONS, type Json } from "./setup-sections";

// Perspective comparison for Sections E, F and G (spec 1.5.4 and S1-07): the EXECUTIVE, HR and AGREED entries side by side with a divergence
// flag per field. F1 behaviour tags are compared by the engine (f1Divergence). Every other field is a text field, and the consultant
// decides whether the two entries really differ (stored in setup_record.divergence_flags on the AGREED row).

export const PERSPECTIVE_SECTIONS = ["E", "F", "G"] as const;
export const PERSPECTIVES = ["EXECUTIVE", "HR"] as const;
/** Fields that belong to the agreed record only (the consultant's tie-break and wording choices), so they are not captured per perspective. */
export const AGREED_ONLY = ["tie_break", "tie_break_reason", "f1_overrides"];
/** Section fields that can be compared. */
export const comparable = (section: string) => (SECTIONS[section] ?? []).filter((f) => !AGREED_ONLY.includes(f.key));

export interface FieldCompare {
  key: string; label: string; executive: unknown; hr: unknown; agreed: unknown;
  kind: "tags" | "text";
  diverges: boolean;
  /** tags only: the engine's share of behaviours tagged differently (0 to 1), and which positions differ */
  share?: number; positions?: number[];
  /** text only: the consultant's flag */
  consultant_flag?: boolean;
}
export interface Finding { type: "SETUP_DIVERGENCE"; section: string; field: string; label: string; share?: number }

const tagsOf = (p: Json | undefined) => ((p?.behaviours as { orientation?: Orientation }[] | undefined) ?? []).map((b) => b.orientation).filter((o): o is Orientation => !!o);

export function compareRows(section: string, rows: { perspective: string; payload_json: unknown; status: string; divergence_flags?: unknown }[]) {
  const by = (p: string) => rows.find((r) => r.perspective === p);
  const exec = by("EXECUTIVE")?.payload_json as Json | undefined, hr = by("HR")?.payload_json as Json | undefined, agreed = by("AGREED")?.payload_json as Json | undefined;
  const flags = ((by("AGREED")?.divergence_flags ?? {}) as Record<string, boolean>);
  const both = !!exec && !!hr;
  const fields: FieldCompare[] = comparable(section).map((f) => {
    const base = { key: f.key, label: f.label, executive: exec?.[f.key] ?? null, hr: hr?.[f.key] ?? null, agreed: agreed?.[f.key] ?? null };
    if (section === "F" && f.key === "behaviours") {
      const e = tagsOf(exec), h = tagsOf(hr);
      const share = both ? f1Divergence(e, h) : 0;
      const positions = both ? e.flatMap((t, i) => (i < h.length && f1Divergence([t], [h[i]]) > 0 ? [i + 1] : [])) : [];
      return { ...base, kind: "tags" as const, share, positions, diverges: share > 0 };
    }
    const flag = flags[f.key] === true;
    return { ...base, kind: "text" as const, consultant_flag: flag, diverges: both && flag };
  });
  const findings: Finding[] = fields.filter((f) => f.diverges).map((f) => ({ type: "SETUP_DIVERGENCE", section, field: f.key, label: f.label, ...(f.share !== undefined ? { share: f.share } : {}) }));
  return {
    section, executive_status: by("EXECUTIVE")?.status ?? null, hr_status: by("HR")?.status ?? null, agreed_status: by("AGREED")?.status ?? null,
    both_captured: both, fields, findings,
  };
}

/** Comparison for one section, read with the service role (the caller has already passed its role check). */
export async function loadComparison(engagementId: string, section: string) {
  const { data } = await admin().from("setup_record").select("perspective, payload_json, status, divergence_flags").eq("engagement_id", engagementId).eq("section", section);
  return compareRows(section, data ?? []);
}
