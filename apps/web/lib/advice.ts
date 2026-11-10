// Advice library (Erick #197, owner rounds Q-AL1 to Q-AL25): propose advice for a report from its frozen numbers, and read back
// what the consultant accepted. Matching is the engine's (adviceFacts, matchAdvice); this file only loads and stores rows.
// Reads and writes use the service role after the caller passed the route's role checks.
import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";

export type AdviceAction = { text: string; owner_role?: string; horizon?: string; lever?: string };
export interface AdviceView {
  item_id: string; section: string; level: string; scope_key: string; rank: number; topic: string;
  title: string; diagnosis: string; why: string; risks: string[]; actions: AdviceAction[]; questions: string[];
  signal: string; watch: string[]; good: string[]; traps: string[];
}
type Item = { item_id: string; section: string; level: string; priority: number; rule: E.Rule; tags: Record<string, string[]> | null };

/** The library version an assessment uses: the one pinned on it, otherwise the published one (then pinned, Q-AL3). */
async function versionFor(assessmentId: string, override?: string): Promise<string | null> {
  const sa = admin();
  const { data: a } = await sa.from("assessment").select("advice_version_id").eq("assessment_id", assessmentId).single();
  if (a?.advice_version_id) return a.advice_version_id;
  const v = override ?? (await sa.from("advice_library_version").select("version_id").eq("status", "PUBLISHED").maybeSingle()).data?.version_id;
  if (!v) return null;
  await sa.from("assessment").update({ advice_version_id: v }).eq("assessment_id", assessmentId);
  return v;
}

/**
 * Propose advice for a report: organisation level from the score payload and evaluation, group level for each department that
 * meets the reporting floor. Existing decisions are kept; only new matches are added as PROPOSED. Returns the number added.
 * `version` lets a review run use a DRAFT library version (owner Q-AL25); normal runs use the published one.
 */
export async function proposeAdvice(reportId: string, actorId: string, opts: { version?: string; depts?: { label: string; suppressed: boolean; now?: Record<string, string>; dominant?: string }[] | null } = {}): Promise<number> {
  const sa = admin();
  const { data: rep } = await sa.from("report").select("report_id, tenant_id, assessment_id, score_version, status").eq("report_id", reportId).single();
  if (!rep || rep.status === "RELEASED") return 0;
  const version = await versionFor(rep.assessment_id, opts.version);
  if (!version) return 0;
  const [so, ev, ten, items, have] = await Promise.all([
    sa.from("score_object").select("payload_json").eq("assessment_id", rep.assessment_id).eq("version", rep.score_version).single(),
    sa.from("evaluation").select("payload_json").eq("assessment_id", rep.assessment_id).eq("score_version", rep.score_version).maybeSingle(),
    sa.from("tenant").select("sector").eq("tenant_id", rep.tenant_id).single(),
    sa.from("advice_item").select("item_id, section, level, priority, rule, tags").eq("version_id", version).neq("status", "RETIRED"),
    sa.from("report_advice").select("item_id, scope_key").eq("report_id", reportId),
  ]);
  if (!so.data) return 0;
  const facts = E.adviceFacts(so.data.payload_json as Record<string, unknown>, (ev.data?.payload_json ?? {}) as Record<string, unknown>, { sector: ten.data?.sector });
  const all = (items.data ?? []) as unknown as Item[];
  const rows: { item: Item; scope: string; section: string; rank: number }[] = [];
  for (const p of E.matchAdvice(all.filter((i) => i.level === "ORG"), facts, E.ADVICE_CAPS)) rows.push({ item: p.item, scope: "", section: p.section, rank: p.rank });
  for (const d of opts.depts ?? []) {
    if (d.suppressed || !d.now) continue;                                   // below the reporting floor: no group advice (Q-AL7)
    const g = E.groupFacts(facts, d.now);
    for (const p of E.matchAdvice(all.filter((i) => i.level === "GROUP"), g, E.ADVICE_CAPS)) rows.push({ item: p.item, scope: d.label, section: p.section, rank: p.rank });
  }
  const seen = new Set((have.data ?? []).map((h) => `${h.item_id}|${h.scope_key}`));
  const fresh = rows.filter((r) => !seen.has(`${r.item.item_id}|${r.scope}`)).map((r) => ({
    report_id: reportId, item_id: r.item.item_id, tenant_id: rep.tenant_id, version_id: version, level: r.item.level, scope_key: r.scope,
    section: r.section, proposed_rank: r.rank, created_by: actorId,
  }));
  if (fresh.length) { const ins = await sa.from("report_advice").insert(fresh); if (ins.error) throw new Error(ins.error.message); }
  return fresh.length;
}

/** The advice a report shows: accepted rows only, with the consultant's rewording laid over the library text. Config placeholders
 *  ({{scoring.gap.build}}) are filled under the report's rules version, so definitions quote the cut points the score used; fact
 *  slots ({{f:now.ENGAGE}}) take this report's own numbers (owner Q-AL26), a department's own for group advice. An item whose
 *  slot has no number is left out rather than printed with a hole. */
export async function reportAdvice(reportId: string, rules: string | null = null, facts: E.Facts = {}, groups: Record<string, E.Facts> = {}): Promise<AdviceView[]> {
  const sa = admin();
  const { data } = await sa.from("report_advice").select("item_id, section, level, scope_key, proposed_rank, edited, advice_item(*)")
    .eq("report_id", reportId).eq("decision", "ACCEPTED").order("section").order("proposed_rank");
  return (data ?? []).map((r) => {
    const it = r.advice_item as unknown as Record<string, unknown>;
    const ed = (r.edited ?? {}) as Record<string, unknown>;
    const f = r.scope_key ? groups[r.scope_key] ?? facts : facts;
    const fill = (t: unknown): unknown => (typeof t === "string" ? E.fillFacts(E.withRules((rules ?? "2.0") as E.RulesVersion, () => E.fillConfig(t)), f)
      : Array.isArray(t) ? t.map(fill) : t && typeof t === "object" ? Object.fromEntries(Object.entries(t).map(([k, x]) => [k, fill(x)])) : t);
    const v = <T,>(k: string) => fill(ed[k] ?? it[k]) as T;
    return { item_id: r.item_id, section: r.section, level: r.level, scope_key: r.scope_key, rank: r.proposed_rank, topic: String(it.topic),
      title: v<string>("title"), diagnosis: v<string>("diagnosis"), why: v<string>("why"), risks: v<string[]>("risks"), actions: v<AdviceAction[]>("actions"),
      questions: v<string[]>("questions"), signal: v<string>("signal"), watch: v<string[]>("watch"), good: v<string[]>("good"), traps: v<string[]>("traps") };
  }).filter((x) => !JSON.stringify(x).includes("{{f:"));
}
