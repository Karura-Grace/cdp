import { checkWorkshopRecord, leadershipTarget } from "@pac/cdp-engine";
import type { Orientation } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { validateSection, type Json } from "@/lib/setup-sections";
import { sectionKpis } from "@/lib/setup-data";
import { agreedSections, attendance, executiveCount, perspectivesBlock, sequenceBlock } from "@/lib/setup-workshop";
import { syncDemographics } from "@/lib/section-i-demographics";
import { consultantOnEngagement } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// AC-1.3 and AC-1.4: a section is agreed only with a workshop date and two executives present, and Section F is not
// agreed while its tags tie without a tie-break and a recorded reason. Participants are person ids; an id counts when its grade is an
// executive grade. A typed name from an older record never counts (see lib/setup-workshop.ts). E, F and G also need an Executive and an HR entry.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!/^[A-I]$/.test(section)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The section must be A to I." });
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  if (g.eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });

  const db = admin();
  const { data: row } = await db.from("setup_record").select("setup_id, status, payload_json, workshop_date, participants, facilitator")
    .eq("engagement_id", id).eq("section", section).eq("perspective", "AGREED").maybeSingle();
  if (!row) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Save the section before agreeing it." });
  if (row.status === "AGREED") return json({ section, status: "AGREED", changed: false });

  // Spec 1.1: B, C and D first; E, F and G after them; Section I last.
  const seq = sequenceBlock(section, await agreedSections(id), "agree");
  if (seq) return problem({ code: "SETUP_SEQUENCE_VIOLATION", status: 409, title: seq });
  // E, F and G: both the Executive and the HR entry are saved before the agreed record
  const pb = await perspectivesBlock(id, section);
  if (pb) return problem({ code: "SETUP_SEQUENCE_VIOLATION", status: 409, title: pb });

  const att = await attendance(g.eng.tenant_id, row.participants);
  const bad = checkWorkshopRecord(row.workshop_date, executiveCount(att), new Date().toISOString().slice(0, 10));
  if (bad) return problem(bad);
  if (!row.facilitator) return problem({ code: "WORKSHOP_RECORD_MISSING", status: 422, title: "Record the facilitating consultant on the workshop record before agreeing this section." });

  // Agreeing needs a complete section (required fields, list minimums, cross-field rules).
  const errors = validateSection(section, row.payload_json as Json, { complete: true, ctx: { today: new Date().toISOString().slice(0, 10), kpis: section === "D" ? await sectionKpis(id) : undefined } });
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `Section ${section} is not complete: ${errors[0]}`, errors });

  if (section === "F") {
    const p = row.payload_json as { f1_tags?: Orientation[]; tie_break?: Orientation | null; tie_break_reason?: string };
    if (!Array.isArray(p.f1_tags) || !p.f1_tags.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Section F needs f1_tags." });
    try { leadershipTarget(p.f1_tags, p.tie_break ?? null); }
    catch (e) {
      if ((e as Error).message.includes("SETUP_TIE_UNRESOLVED")) return problem({ code: "SETUP_TIE_UNRESOLVED", status: 422, title: "Section F has a tie among its tags. The consultant must choose one of the tied orientations as the tie-break." });
      return problem({ code: "VALIDATION_FAILED", status: 422, title: "Section F tags are not valid." });
    }
    // a tie that was broken needs the reason written down (spec 1.5.3); no tie, nothing to record
    let tied = false;
    try { leadershipTarget(p.f1_tags, null); } catch { tied = true; }
    if (tied && !p.tie_break_reason?.trim()) return problem({ code: "SETUP_TIE_UNRESOLVED", status: 422, title: "Record the reason for the tie-break before Section F can be agreed." });
  }

  // Section I declares the demographic attributes: write them to the organisation's list before the section is agreed (checked first, so a bad list blocks agreeing)
  if (section === "I") {
    const w = await syncDemographics(g.eng.tenant_id, g.a.userId, row.payload_json as Json);
    if ("error" in w) return problem({ code: "VALIDATION_FAILED", status: 422, title: w.error });
  }
  const up = await db.from("setup_record").update({ status: "AGREED", updated_by: g.a.userId }).eq("setup_id", row.setup_id);
  if (up.error) return fromDbError(up.error.message);
  await audit(g.eng.tenant_id, g.a.userId, `setup.agreed:${section}`, "setup_record", row.setup_id);
  return json({ section, status: "AGREED", changed: true });
}
