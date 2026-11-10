import { setupOutput } from "@/lib/setup-output";
import { setupReader } from "@/lib/setup-access";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// S1.7-001: the versioned setup output object (spec 1.7). After launch this is the copy stored at launch; before, it is built from what is saved now.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await setupReader(req, id);
  if (g instanceof Response) return g;
  return json(await setupOutput(id));
}
