import { assignedConsultants } from "@/lib/setup-workshop";
import { consultantOnEngagement } from "@/lib/staff";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// The facilitator pick list: PAC consultants currently assigned to this engagement (user id and name).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  return json({ consultants: await assignedConsultants(id) });
}
