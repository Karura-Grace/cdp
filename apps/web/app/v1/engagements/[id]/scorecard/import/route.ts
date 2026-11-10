import { applyExtrasOnly, applyScorecard, duplicateRefs, loadScorecard, mergeScorecard, parseScorecardCsv, scorecardAccess, type ObjIn } from "@/lib/scorecard";
import { admin } from "@/lib/supabase/admin";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// CSV (content-type text/csv) or JSON ({ objectives }) import. It merges into the stored scorecard: an objective is matched by external_ref (else title) and a KPI by
// external_ref (else name), so importing the same file again changes nothing. KPI readings and links to culture actions (linked_actions) come in with it.
// While the engagement is in SETUP the whole scorecard can change. After that the structure is locked: the file may only add readings and action links,
// and every objective and KPI in it must carry an external_ref that matches a stored one (409 SETUP_LOCKED otherwise).
// Any problem refuses the whole file and names the row.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await scorecardAccess(req, id, "extras");
  if (g instanceof Response) return g;
  const raw = await req.text();
  if (raw.length > 256 * 1024) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The file is too large." });
  let incoming: ObjIn[];
  if ((req.headers.get("content-type") ?? "").includes("json")) {
    try { incoming = (JSON.parse(raw) as { objectives: ObjIn[] }).objectives; } catch { incoming = null as never; }
    if (!Array.isArray(incoming)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body must be a JSON object with an objectives list." });
  } else {
    const p = parseScorecardCsv(raw);
    if (p.errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `The file is not valid: ${p.errors[0]}`, errors: p.errors });
    incoming = p.objectives;
  }
  if (incoming.some((o) => !o || typeof o !== "object" || (o.kpis !== undefined && !Array.isArray(o.kpis)))) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Each objective must be an object with a kpis list." });
  const dups = duplicateRefs(incoming);
  if (dups.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `The file is not valid: ${dups[0]}`, errors: dups });
  if (g.eng.state !== "SETUP") {
    const r = await applyExtrasOnly(g, incoming, "scorecard.extras_imported");
    return r instanceof Response ? r : json({ imported_objectives: incoming.length, locked: true, objectives: r });
  }
  const r = await applyScorecard(g, mergeScorecard(await loadScorecard(admin(), id), incoming), "scorecard.imported");
  return r instanceof Response ? r : json({ imported_objectives: incoming.length, objectives: r });
}
