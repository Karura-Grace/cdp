import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { superAdmin } from "@/lib/users";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Create the next engagement (cycle) for a tenant. The cycle number is the next in line, and the engagement links to the
// previous cycle for trend carry-forward. A PAC Consultant is then assigned on the Users screen.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await superAdmin(req);
  if (g instanceof Response) return g;
  const db = admin();
  const { data: t } = await db.from("tenant").select("tenant_id").eq("tenant_id", id).maybeSingle();
  if (!t) return problem({ code: "NOT_FOUND", status: 404, title: "That organisation was not found." });
  const { data: last } = await db.from("engagement").select("engagement_id, cycle_no").eq("tenant_id", id).order("cycle_no", { ascending: false }).limit(1);
  const ins = await db.from("engagement").insert({
    tenant_id: id, cycle_no: (last?.[0]?.cycle_no ?? 0) + 1, previous_engagement_id: last?.[0]?.engagement_id ?? null, created_by: g.a.userId,
  }).select("engagement_id, cycle_no").single();
  if (ins.error) return fromDbError(ins.error.message);
  await audit(id, g.a.userId, "engagement.created", "engagement", ins.data.engagement_id);
  return json(ins.data, 201);
}
