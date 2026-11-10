import { admin } from "@/lib/supabase/admin";
import { actor } from "@/lib/staff";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// The objections report (owner ruling 22 Oct 2026, Erick Ngala comment 25): COUNTS ONLY, for the PAC Consultant on the engagement and the Super Admin.
// How many objections were raised, how many are still open, and when, by month. No names, no employee references, no detail text: the people who
// objected are never identifiable from it, and no client role can read it.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in first." });
  const { data: eng } = await admin().from("engagement").select("engagement_id, tenant_id").eq("engagement_id", id).maybeSingle();
  if (!eng) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const [{ data: role }, { data: scope }] = await Promise.all([a.db.rpc("rpc_actor_role", { p_engagement: id }), a.db.rpc("rpc_actor_scope")]);
  const superAdmin = (scope as { role: string | null } | null)?.role === "SUPER_ADMIN";
  if (role !== "PAC_CONSULTANT" && !superAdmin) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const { data, error } = await admin().from("consultant_task").select("status, created_at").eq("tenant_id", eng.tenant_id).eq("kind", "OBJECTION");
  if (error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  const rows = data ?? [];
  const byMonth: Record<string, number> = {};
  for (const r of rows) { const m = r.created_at.slice(0, 7); byMonth[m] = (byMonth[m] ?? 0) + 1; }
  return json({ total: rows.length, open: rows.filter((r) => r.status === "OPEN").length, done: rows.filter((r) => r.status === "DONE").length,
    by_month: Object.entries(byMonth).sort(([x], [y]) => (x < y ? -1 : 1)).map(([month, count]) => ({ month, count })) });
}
