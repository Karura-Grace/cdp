import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { graphEditor, readJson } from "@/lib/staff";
import { bad, checkOdpc } from "@/lib/privacy";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// ODPC registration of the organisation (the Kenya Office of the Data Protection Commissioner): the registration reference and the date PAC confirmed it.
// Set by the PAC Consultant; both values or neither. It can be corrected later, and each change is audited.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id, true);
  if (g instanceof Response) return g;
  const b = await readJson(req, 2 * 1024);
  if (b instanceof Response) return b;
  const c = checkOdpc(b);
  if ("error" in c) return bad(c.error);
  const up = await admin().from("tenant").update({ odpc_registration_ref: c.ref, odpc_confirmed_on: c.confirmed_on }).eq("tenant_id", g.eng.tenant_id);
  if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  await audit(g.eng.tenant_id, g.a.userId, "privacy.odpc.set", "tenant", g.eng.tenant_id);
  return json({ odpc_registration_ref: c.ref, odpc_confirmed_on: c.confirmed_on });
}
