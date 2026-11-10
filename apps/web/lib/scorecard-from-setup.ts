import * as E from "@pac/cdp-engine";
import type { KpiIn, ObjIn } from "./scorecard-types";

// "Import from Sections C and D" (owner decision of 18 October 2026): one objective per Section B priority, and every Section C KPI placed under one of them.
//
// The rule, in full:
//   1. Objectives: one per Section B priority, in Section B order, titled with the priority text (cut to 200 characters; a repeated text gets its ref added), linked to that priority.
//   2. A Section C KPI that names an orientation goes under the FIRST priority (Section B order) whose goal type needs that orientation. The goal type to orientation table is the
//      engine's own (config.GOAL_TYPES: RESULTS_GROWTH Perform, INNOVATION_NEW_MODELS Innovate, PEOPLE_TALENT Engage, COMPLIANCE_PROCESS Govern, TRANSFORMATION Engage and Innovate).
//   3. A KPI with no orientation, or whose orientation no priority needs, has no data link to a priority. It goes under the objective of the first priority.
//   4. Targets come from Section D (the entry whose kpi_id is the KPI's id). A KPI with no 12 month target in D is not imported and is reported back as skipped.
//      A CURRENCY KPI is in US dollars (owner ruling 22 October 2026, which replaced the per client currency of 19 October): the platform does not convert.
// Nothing else is invented: baseline, unit, direction, source and orientation are Section C's own values.
type Json = Record<string, unknown>;
export interface Skipped { kpi: string; reason: string }

export function buildFromSections(b: { priorities: { ref: string; text: string; goal_type?: string }[] }, c: Json | undefined, d: Json | undefined, currency: string | null = null): { objectives: ObjIn[]; skipped: Skipped[] } {
  const ps = b.priorities, skipped: Skipped[] = [];
  const seen = new Map<string, number>();
  const objectives: ObjIn[] = ps.map((p) => {
    const base = (p.text || p.ref).trim().slice(0, 200), n = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), n);
    return { title: n > 1 ? `${base.slice(0, 190)} (${p.ref})` : base, priority_keys: [p.ref], kpis: [] };
  });
  if (!objectives.length) return { objectives, skipped };
  const needs = (goal?: string): string[] => ((E.config.GOAL_TYPES as unknown as Record<string, [string, string[]]>)[goal ?? ""]?.[1] ?? []);
  const targets = (d?.targets as Json[] | undefined) ?? [];
  for (const k of (c?.kpis as Json[] | undefined) ?? []) {
    const name = String(k.name ?? k.id ?? "KPI");
    const t = targets.find((x) => x.kpi_id === k.id);
    if (!t || typeof t.target_12m !== "number") { skipped.push({ kpi: name, reason: "Section D has no 12 month target for it." }); continue; }
    if (k.unit === "CURRENCY" && !currency) { skipped.push({ kpi: name, reason: "Its unit is CURRENCY and the client has no currency set. Set it on the Organisations screen, or add the KPI by hand here." }); continue; }
    const at = k.orientation ? ps.findIndex((p) => needs(p.goal_type).includes(String(k.orientation))) : -1;
    const kpi: KpiIn = { name: String(k.name), unit: String(k.unit), currency_code: k.unit === "CURRENCY" ? currency : null, direction: String(k.direction), baseline_value: k.baseline_value as number, baseline_date: String(k.baseline_date),
      baseline_source: String(k.source ?? ""), target_12m: t.target_12m, target_3y: typeof t.target_3y === "number" ? t.target_3y : null, orientation: (k.orientation as string | undefined) || null };
    objectives[at >= 0 ? at : 0].kpis.push(kpi);
  }
  return { objectives, skipped };
}
