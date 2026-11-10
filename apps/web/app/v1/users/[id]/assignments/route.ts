import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";
import { manager } from "@/lib/users";

export const runtime = "nodejs";

// Time-box a PAC Consultant to an engagement (Super Admin only; the database enforces that, and a one-year ceiling).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await manager(req);
  if (g instanceof Response) return g;
  const b = (await req.json().catch(() => null)) as { engagement_id?: string; valid_to?: string } | null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !b?.engagement_id || !b.valid_to || Number.isNaN(Date.parse(b.valid_to)))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "engagement_id and a valid end date are required." });
  const r = await admin().rpc("rpc_assignment_add", { p_actor: g.a.userId, p_user: id, p_engagement: b.engagement_id, p_valid_to: new Date(b.valid_to).toISOString() });
  if (r.error) return fromDbError(r.error.message);
  return json({ assignment_id: r.data }, 201);
}
