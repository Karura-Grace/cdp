import { applyScorecard, loadScorecard, mergeScorecard, priorityRefs, scorecardAccess } from "@/lib/scorecard";
import { buildFromSections } from "@/lib/scorecard-from-setup";
import { admin } from "@/lib/supabase/admin";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Builds objectives and KPIs from the agreed Sections B, C and D (rule in lib/scorecard-from-setup.ts) and merges them into the stored scorecard, so running it twice
// changes nothing. PAC Consultant and Client Admin, while the engagement is in SETUP. Refuses (422) when Section B, C or D is not saved yet.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await scorecardAccess(req, id, true);
  if (g instanceof Response) return g;
  const db = admin();
  const [priorities, { data: rows }] = await Promise.all([priorityRefs(id), db.from("setup_record").select("section, payload_json").eq("engagement_id", id).eq("perspective", "AGREED").in("section", ["C", "D"])]);
  const sec = (s: string) => rows?.find((r) => r.section === s)?.payload_json as Record<string, unknown> | undefined;
  if (!priorities.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Save Section B first: there are no priorities to build objectives from." });
  if (!sec("C")?.kpis) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Save Section C first: there are no KPIs to import." });
  const built = buildFromSections({ priorities }, sec("C"), sec("D"), "USD");   // money KPIs are in US dollars for every client (owner ruling 22 Oct 2026); no conversion in the platform
  if (!built.objectives.some((o) => o.kpis.length)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "No Section C KPI could be imported.", skipped: built.skipped });
  const r = await applyScorecard(g, mergeScorecard(await loadScorecard(db, id), built.objectives), "scorecard.imported_from_setup");
  return r instanceof Response ? r : json({ imported_kpis: built.objectives.reduce((n, o) => n + o.kpis.length, 0), skipped: built.skipped, objectives: r });
}
