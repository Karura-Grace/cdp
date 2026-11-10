import { loadScorecard, scorecardAccess, scorecardCsv } from "@/lib/scorecard";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// JSON by default, ?format=csv for the file the import accepts. Same roles as the read.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await scorecardAccess(req, id, false);
  if (g instanceof Response) return g;
  const objs = await loadScorecard(g.a.db, id);
  if (new URL(req.url).searchParams.get("format") !== "csv") return json({ objectives: objs });
  return new Response(scorecardCsv(objs), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="scorecard.csv"', "cache-control": "no-store" } });
}
