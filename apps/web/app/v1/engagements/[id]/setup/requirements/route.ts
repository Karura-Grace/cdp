import { requirements } from "@/lib/setup-output";
import { setupReader } from "@/lib/setup-access";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// S1-08: what the rules derive from the agreed sections (C1, C4, the leadership target and the tie break). Engine functions, nothing computed here.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await setupReader(req, id);
  if (g instanceof Response) return g;
  return json(await requirements(id));
}
