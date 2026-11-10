import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor, readJson } from "@/lib/staff";
import { cleanColour } from "@/lib/tenant-fields";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";
const forbidden = () => problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });

// PUT { colour: "#1F7A5C" | null }: the client cover colour on released reports (a band on the cover of the PDF and the title slide).
// Who may: a Super Admin, or a PAC Consultant active on one of the organisation's engagements. Audited.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: scope } = await a.db.rpc("rpc_actor_scope");
  let ok = (scope as { role: string | null } | null)?.role === "SUPER_ADMIN";
  if (!ok) {
    const { data: engs } = await admin().from("engagement").select("engagement_id").eq("tenant_id", id);
    for (const e of engs ?? []) if ((await a.db.rpc("rpc_actor_role", { p_engagement: e.engagement_id })).data === "PAC_CONSULTANT") { ok = true; break; }
  }
  if (!ok) return forbidden();
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const colour = cleanColour(b.colour);
  if (colour === undefined) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The cover colour is a six digit hex such as #1F7A5C, or empty for none." });
  const up = await admin().from("tenant").update({ cover_colour: colour, updated_by: a.userId }).eq("tenant_id", id).select("tenant_id");
  if (up.error) return fromDbError(up.error.message);
  if (!up.data?.length) return problem({ code: "NOT_FOUND", status: 404, title: "That organisation was not found." });
  await audit(id, a.userId, colour ? "tenant.cover_colour_set" : "tenant.cover_colour_cleared", "tenant", id);
  return json({ tenant_id: id, cover_colour: colour });
}
