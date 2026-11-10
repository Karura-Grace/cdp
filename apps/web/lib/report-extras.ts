import { servicesOf } from "./services";
import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { fieldingCounts } from "./fielding";
import { segmentView } from "./segments";
import type { LoadedReport } from "./report-data";
import { contradictions } from "./setup-output";
import { reportAdvice, type AdviceView } from "./advice";

export interface Kpi { orientation?: string; name: string; unit?: string; baseline?: number | string; target_12m?: number | string; target_3y?: number | string; source?: string }
export interface DeptCell { label: string; n: number | null; suppressed: boolean; dominant?: string; now?: Record<string, string> }
export interface Logo { type: "image/png" | "image/jpeg"; base64: string }
export interface PlanView {
  priorities: { priority_id: string; sequence: number; orientation: string; classification: string; urgency_tier: string; owner_role: string | null; due: string | null; trade_off_orientation?: string | null; blocked_by?: string[] }[];
  actions: { priority_id: string; objective: string; intervention: string; horizon: string; owner: string | null; kpi: string | null; status: string; is_visible_signal: boolean; orientation?: string; system_lever?: string | null; priority_score?: string }[];
  zero: { item: string; completed: boolean }[];
}
export interface LeadersView { valid: number; scored: number; bands: Record<string, number>; growth: Record<string, number>; defaults: Record<string, number>; flags: Record<string, number> }
/** Agreed setup text the report shows: A6 trigger (method), F5 risk appetite (beside Innovate), D5 non negotiables (Keep and protect for Govern), H1 H3 H4 contradiction flags (C3 evidence). */
export interface SetupNotes { trigger?: string; riskAppetite?: string; nonNegotiables?: string; contradictions?: { h1: boolean; h3: boolean; h4: boolean } }
export interface Extras { setup?: SetupNotes; kpis: Kpi[]; depts: DeptCell[] | null; invited: number | null; submitted?: number | null; logo?: Logo | null; coverColour?: string | null; plan?: PlanView | null; leaders?: LeadersView | null; deptSdi?: Record<string, string>; itemText?: Record<string, string[]>; advice?: AdviceView[]; facts?: E.Facts }

/** The client logo for co branded reports (tenant row, migration 24). Read with the service role after the caller passed the report checks. */
export async function clientLogo(tenantId: string): Promise<Logo | null> {
  if (!(await servicesOf(tenantId)).includes("CLIENT_LOGO")) return null;   // the logo is a paid extra (owner ruling 22 Oct 2026)
  const { data } = await admin().from("tenant").select("logo_data, logo_type").eq("tenant_id", tenantId).maybeSingle();
  if (!data?.logo_data || !data.logo_type) return null;
  const hex = String(data.logo_data).replace(/^\\x/, "");
  return { type: data.logo_type as Logo["type"], base64: Buffer.from(hex, "hex").toString("base64") };
}

// What the organisational report adds beyond the score: the agreed KPIs (setup C and D), departments cut from the frozen set
// through the floor checked, logged segment view, and the number invited. Other report types get nothing.
/** The client cover colour (tenant.cover_colour, a six digit hex) added to whatever the report type reads. */
export async function reportExtras(l: LoadedReport, actorId: string): Promise<Extras> {
  const [x, { data: t }] = await Promise.all([reportExtrasBase(l, actorId), admin().from("tenant").select("cover_colour").eq("tenant_id", l.rep.tenant_id).maybeSingle()]);
  return { ...x, coverColour: t?.cover_colour ?? null };
}

async function reportExtrasBase(l: LoadedReport, actorId: string): Promise<Extras> {
  const logo = await clientLogo(l.rep.tenant_id);
  if (l.rep.type !== "ORGANISATIONAL") return { kpis: [], depts: null, invited: null, logo };
  const sa = admin();
  const { data: asm } = await sa.from("assessment").select("engagement_id, frozen_at").eq("assessment_id", l.rep.assessment_id).single();
  if (!asm) return { kpis: [], depts: null, invited: null, logo };
  const [rows, fl, seg] = await Promise.all([
    sa.from("setup_record").select("section, payload_json").eq("engagement_id", asm.engagement_id).eq("perspective", "AGREED").in("section", ["A", "C", "D", "F"]),
    fieldingCounts(l.rep.assessment_id),
    segmentView(l.rep.assessment_id, asm.engagement_id, !!asm.frozen_at, actorId, "department", null, null).catch(() => null),
  ]);
  const sec = (k: string) => (rows.data ?? []).find((r) => r.section === k)?.payload_json as { kpis?: (Kpi & { baseline_value?: number })[]; targets?: { kpi_id: string; target_12m?: number; target_3y?: number }[] } | undefined;
  const note = (k: string, f: string) => ((rows.data ?? []).find((r) => r.section === k)?.payload_json as Record<string, string> | undefined)?.[f];
  const c = await contradictions(asm.engagement_id);
  const setup: SetupNotes = { trigger: note("A", "trigger"), riskAppetite: note("F", "risk_appetite"), nonNegotiables: note("D", "non_negotiables"), contradictions: { h1: c.h1, h3: c.h3, h4: c.h4 } };
  const kpis = (sec("C")?.kpis ?? []).map((k, i) => {
    const t = sec("D")?.targets?.find((x) => x.kpi_id === `K${i + 1}`);
    return { name: k.name, orientation: (k as { orientation?: string }).orientation, unit: k.unit, source: k.source, baseline: k.baseline_value, target_12m: t?.target_12m, target_3y: t?.target_3y };
  });
  const depts = seg && seg.ok ? seg.cells.map((c) => {
    const m = c.metrics ? (E.toJsonable(c.metrics) as { now: Record<string, string>; dominance: { dominant: string[] } }) : null;
    return { label: c.value === "UNKNOWN" ? "Not recorded" : c.value, n: c.n, suppressed: c.suppressed || !m, dominant: m?.dominance.dominant[0], now: m?.now };
  }) : null;
  // the stored plan for this score version (built after the report, so it may not exist yet) and a leader summary with no names
  const v = l.rep.score_version;
  const [pr, ac, pz, lr, it] = await Promise.all([
    sa.from("priority").select("priority_id, sequence, orientation, classification, urgency_tier, owner_role, due, trade_off_orientation, blocked_by").eq("assessment_id", l.rep.assessment_id).eq("score_version", v).order("sequence"),
    sa.from("action").select("priority_id, objective, intervention, horizon, owner, kpi, status, is_visible_signal, engine_ref, orientation, system_lever, priority_score").eq("assessment_id", l.rep.assessment_id).eq("score_version", v).order("engine_ref"),
    sa.from("priority_zero_item").select("item, completed_at").eq("assessment_id", l.rep.assessment_id).eq("score_version", v).order("item_id"),
    sa.from("leader_result").select("payload_json").eq("assessment_id", l.rep.assessment_id).eq("score_version", v),
    sa.from("item").select("item_id, dimension, sequence, canonical_text").eq("block", "LIKERT").in("dimension", ["D7", "D8", "D9"]).order("sequence"),
  ]);
  const itemText: Record<string, string[]> = {};
  for (const x of it.data ?? []) (itemText[x.dimension as string] ??= [])[x.sequence - 1] = x.canonical_text;
  const plan = pr.data?.length ? { priorities: pr.data, actions: (ac.data ?? []).filter((a) => !["DISCARDED", "RETIRED"].includes(a.status)), zero: (pz.data ?? []).map((z) => ({ item: z.item, completed: !!z.completed_at })) } : null;
  const results = (lr.data ?? []).map((r) => r.payload_json as { valid?: boolean; lri_band?: string; growth?: string; default?: string[]; flags?: string[] });
  const tally = (xs: (string | undefined)[]) => xs.reduce<Record<string, number>>((m, k) => (k ? { ...m, [k]: (m[k] ?? 0) + 1 } : m), {});
  const valid = results.filter((r) => r.valid);
  const leaders = results.length ? { valid: valid.length, scored: results.length, bands: tally(valid.map((r) => r.lri_band)), growth: tally(valid.map((r) => r.growth)),
    defaults: tally(valid.flatMap((r) => r.default ?? [])), flags: tally(valid.flatMap((r) => r.flags ?? [])) } : null;
  const facts = E.adviceFacts(l.score as unknown as Record<string, unknown>, (l.evaluation ?? {}) as unknown as Record<string, unknown>);
  const deptSdi = seg && seg.ok ? Object.fromEntries(seg.cells.filter((c) => c.metrics).map((c) => [c.value, String((E.toJsonable(c.metrics) as { sdi: string }).sdi)])) : {};
  return { setup, kpis, depts, invited: fl?.invited ?? null, submitted: fl?.submitted ?? null, logo, plan, leaders, deptSdi, itemText, facts, advice: await reportAdvice(l.rep.report_id, (l.score as { rules_version?: string }).rules_version ?? null, facts,
    Object.fromEntries((depts ?? []).filter((d) => !d.suppressed && d.now).map((d) => [d.label, E.groupFacts(facts, d.now!)]))) };
}
