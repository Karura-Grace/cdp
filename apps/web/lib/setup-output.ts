import * as E from "@pac/cdp-engine";
import type { Orientation } from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { kpiForInput, type Json } from "./setup-sections";
import { PERSPECTIVE_SECTIONS, loadComparison } from "./setup-compare";

// What setup derives (spec 1.5 and 1.7). The engine does the derivation (deriveSetup, c1Requirements, c4Requirement, leadershipTarget);
// this file only reads the agreed sections and shapes the answer. Only AGREED rows count.

type Row = { section: string; status: string; payload_json: unknown; locked_at: string | null };
const isAgreed = (r?: Row) => !!r && (r.status === "AGREED" || !!r.locked_at);

async function agreedRows(engagementId: string) {
  const { data } = await admin().from("setup_record").select("section, status, payload_json, locked_at").eq("engagement_id", engagementId).eq("perspective", "AGREED");
  return new Map((data ?? []).map((r) => [r.section, r as Row]));
}
const pl = (r?: Row) => (r?.payload_json ?? {}) as Json;

/** What the rules derive from the agreed sections. c1 and c4 appear once B, C and D are agreed; the leadership target needs the F1 tags. */
export async function requirements(engagementId: string) {
  const rows = await agreedRows(engagementId);
  const st = (s: string) => (isAgreed(rows.get(s)) ? "AGREED" : rows.get(s) ? "DRAFT" : "NOT_STARTED");
  const ready = ["B", "C", "D"].every((s) => st(s) === "AGREED");
  const B = pl(rows.get("B")), F = pl(rows.get("F"));
  const tags = (F.f1_tags as Orientation[] | undefined) ?? [];
  const tieBreak = (F.tie_break as Orientation | undefined) ?? null;

  let tied = false, target: Orientation | null = null;
  if (tags.length) { try { target = E.leadershipTarget(tags, tieBreak); } catch { tied = true; } }
  // the engine's own answer for a tie: which orientations the tie break may choose from (asked of the engine, not counted here)
  const options = tied ? E.ORIENTATIONS.filter((o) => { try { E.leadershipTarget(tags, o); return true; } catch { return false; } }) : [];

  let c1 = null, c4 = null;
  if (ready) {
    if (st("F") === "AGREED" && target) {
      const d = E.deriveSetup({ ...B, f1_tags: tags, tie_break: tieBreak, kpi_for: kpiForInput(pl(rows.get("C")), pl(rows.get("D")), undefined) } as unknown as E.SetupInput);
      c1 = E.toJsonable(d.c1_requirements); c4 = E.toJsonable(d.c4_requirement);
    } else {
      c1 = E.toJsonable(E.c1Requirements((B.priorities as { ref: string; goal_type: string }[]) ?? []));
      c4 = E.toJsonable(E.c4Requirement(B.business_model as string, (B.planned_model as string | undefined) ?? null));
    }
  }
  return {
    ready, sections: { B: st("B"), C: st("C"), D: st("D"), F: st("F") }, c1, c4,
    leadership_target_orientation: target,
    // the target is final only once F is agreed; before that it is a reading of the draft
    leadership_target_basis: tags.length ? (st("F") === "AGREED" ? "AGREED" : "DRAFT") : null,
    tie: { tied, options, tie_break: tieBreak, reason: (F.tie_break_reason as string | undefined) ?? null },
  };
}

/** H1, H3, H4 contradiction flags: the consultant's choice from REPORTING onward if one was made, else what Section H recorded. */
export async function contradictions(engagementId: string) {
  const [rows, { data: eng }] = await Promise.all([agreedRows(engagementId), admin().from("engagement").select("contradiction_flags").eq("engagement_id", engagementId).single()]);
  const h = pl(rows.get("H")), o = (eng?.contradiction_flags ?? {}) as Record<string, unknown>;
  const pick = (k: "h1" | "h3" | "h4") => (typeof o[k] === "boolean" ? (o[k] as boolean) : h[`contradiction_${k}`] === true);
  return { h1: pick("h1"), h3: pick("h3"), h4: pick("h4"), set_by: (o.set_by as string | undefined) ?? null, set_at: (o.set_at as string | undefined) ?? null, from_debrief: typeof o.h1 === "boolean" || typeof o.h3 === "boolean" || typeof o.h4 === "boolean" };
}

/** The setup output object of spec 1.7, built from what is stored now. */
export async function buildSetupOutput(engagementId: string) {
  const db = admin();
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, setup_version, g5_system").eq("engagement_id", engagementId).single();
  if (!eng) throw new Error("engagement not found");
  const [rows, req, { data: asm }, { data: grades }, con] = await Promise.all([
    agreedRows(engagementId), requirements(engagementId),
    db.from("assessment").select("window_open, window_close, consent_text_id, instrument_version_id, rules_version_id").eq("engagement_id", engagementId).neq("status", "SUPERSEDED").maybeSingle(),
    db.from("grade_band").select("grade_id, is_executive").eq("tenant_id", eng.tenant_id),
    contradictions(engagementId),
  ]);
  const execGrades = (grades ?? []).filter((g) => g.is_executive).map((g) => g.grade_id);
  let projected = 0;
  if (execGrades.length) {
    const r = await db.from("person_of_record").select("person_id", { count: "exact", head: true }).eq("tenant_id", eng.tenant_id).eq("employment_status", "ACTIVE").in("grade_id", execGrades);
    projected = r.count ?? 0;
  }
  const divergence = (await Promise.all(PERSPECTIVE_SECTIONS.map((s) => loadComparison(engagementId, s)))).flatMap((c) => c.findings);
  return {
    engagement_id: engagementId, setup_version: eng.setup_version,
    requirements: { c1: req.c1, c4: req.c4, leadership_target_orientation: req.leadership_target_orientation, tie_break_reason: req.tie.reason },
    executive_grades: execGrades,
    cohorts: [{ cohort_id: "coh_exec", predicate: { is_executive: true }, projected_n: projected }],
    survey: {
      window: { open: asm?.window_open?.slice(0, 10) ?? null, close: asm?.window_close?.slice(0, 10) ?? null },
      languages: (pl(rows.get("I")).languages as string[] | undefined) ?? [],
      consent_text_version: asm?.consent_text_id ?? null, instrument_version: asm?.instrument_version_id ?? null, rules_version: asm?.rules_version_id ?? null,
    },
    workshop: Object.fromEntries([...rows].map(([s, r]) => [s, { status: r.status }])),
    divergence,
    contradiction_flags: { h1: con.h1, h3: con.h3, h4: con.h4 },
    g5: { workshop: (pl(rows.get("G")).keep_protect as string[] | undefined) ?? [], system: (eng.g5_system as unknown[] | null) ?? [] },
  };
}

/**
 * Store the output object on the engagement at launch (S1.7-001). Called after the launch function succeeds, when setup is locked, so the
 * stored copy is what the assessment ran on. ponytail: a second step after the launch transaction; GET output writes it if this step failed.
 */
export async function writeSnapshot(engagementId: string) {
  const out = await buildSetupOutput(engagementId);
  const { error } = await admin().from("engagement").update({ setup_snapshot: out as never }).eq("engagement_id", engagementId);
  if (error) throw new Error("snapshot failed: " + error.message);
  return out;
}

/** The stored output when the assessment has launched, else the live one. A launched engagement without a stored copy gets it written now. */
export async function setupOutput(engagementId: string) {
  const { data: eng } = await admin().from("engagement").select("setup_snapshot").eq("engagement_id", engagementId).single();
  if (eng?.setup_snapshot) return { stored: true, output: eng.setup_snapshot };
  const { data: asm } = await admin().from("assessment").select("assessment_id").eq("engagement_id", engagementId).in("status", ["LAUNCHED", "FROZEN"]).limit(1).maybeSingle();
  if (asm) return { stored: true, output: await writeSnapshot(engagementId) };
  return { stored: false, output: await buildSetupOutput(engagementId) };
}
