import { consultantOnAssessment } from "@/lib/staff";
import { runPreflight } from "@/lib/preflight";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// Read-only: runs checks L1 to L8 and changes nothing.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  return json(await runPreflight(id));
}
