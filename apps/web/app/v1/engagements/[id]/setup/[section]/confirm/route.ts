import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor } from "@/lib/staff";
import { setupReader } from "@/lib/setup-access";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Decision 18 Oct 2026: an Executive of the tenant confirms an agreed section with a recorded tick (who and when, audited). The tick is
// cleared when the section changes (see the section route). Reads: consultant, Client Admin and Executives (same as the setup read).
export async function GET(req: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  const g = await setupReader(req, id);
  if (g instanceof Response) return g;
  const { data } = await g.a.db.from("setup_confirmation").select("user_id, confirmed_at").eq("engagement_id", id).eq("section", section).order("confirmed_at");
  return json({ section, confirmations: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; section: string }> }) {
  const { id, section } = await params;
  if (!/^[A-I]$/.test(section)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The section must be A to I." });
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: eng } = await a.db.from("engagement").select("tenant_id, state").eq("engagement_id", id).maybeSingle();
  const { data: role } = eng ? await a.db.rpc("rpc_actor_role", { p_engagement: id }) : { data: null };
  if (!eng || role !== "EXECUTIVE") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const { data: row } = await a.db.from("setup_record").select("status").eq("engagement_id", id).eq("section", section).eq("perspective", "AGREED").maybeSingle();
  if (row?.status !== "AGREED") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Only a section the consultant has agreed can be confirmed." });
  const up = await admin().from("setup_confirmation").upsert({ engagement_id: id, tenant_id: eng.tenant_id, section, user_id: a.userId }, { onConflict: "engagement_id,section,user_id", ignoreDuplicates: true });
  if (up.error) return fromDbError(up.error.message);
  await audit(eng.tenant_id, a.userId, `setup.confirmed:${section}`, "setup_confirmation", `${id}:${section}`);
  return json({ section, confirmed: true });
}
