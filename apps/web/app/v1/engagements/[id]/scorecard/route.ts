import { applyScorecard, loadScorecard, priorityRefs, scorecardAccess, type ObjIn } from "@/lib/scorecard";
import { readJson } from "@/lib/staff";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// Spec Appendix B. GET: the scorecard and the Section B priorities it can link to (read by the PAC Consultant, Client Admin and Executive).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await scorecardAccess(req, id, false);
  if (g instanceof Response) return g;
  return json({ state: g.eng.state, locked: g.eng.state !== "SETUP", priorities: await priorityRefs(id), objectives: await loadScorecard(g.a.db, id) });
}

// PUT replaces the whole scorecard, from the PAC Consultant or the Client Admin while the engagement is in SETUP (409 SETUP_LOCKED after).
// Any refusal stores nothing; the 422 lists every problem with where it is.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await scorecardAccess(req, id, true);
  if (g instanceof Response) return g;
  const b = await readJson(req, 256 * 1024);
  if (b instanceof Response) return b;
  const r = await applyScorecard(g, b.objectives as ObjIn[], "scorecard.saved");
  return r instanceof Response ? r : json({ objectives: r });
}
