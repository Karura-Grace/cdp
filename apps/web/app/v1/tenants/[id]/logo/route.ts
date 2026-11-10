import { admin } from "@/lib/supabase/admin";
import { requireService } from "@/lib/services";
import { actor } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";
const MAX = 200 * 1024;
const TYPES = ["image/png", "image/jpeg"];

// PUT the client logo as the raw request body (content-type image/png or image/jpeg, at most 200 KB); DELETE clears it.
// Who may: a Client Admin of the tenant or a PAC Consultant assigned to one of its engagements (checked in rpc_tenant_logo_set).
// The image's own signature is checked too, so a mislabelled file is refused.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireService(id, "CLIENT_LOGO"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TYPES.includes(type)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The logo must be a PNG or JPEG image." });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The logo must be at most 200 KB." });
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if ((type === "image/png" && !png) || (type === "image/jpeg" && !jpg)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The file is not the image type it claims to be." });
  const r = await admin().rpc("rpc_tenant_logo_set", { p_actor: a.userId, p_tenant: id, p_data: `\\x${buf.toString("hex")}`, p_type: type });
  if (r.error) return fromDbError(r.error.message);
  return json({ tenant_id: id, logo: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const r = await admin().rpc("rpc_tenant_logo_set", { p_actor: a.userId, p_tenant: id, p_data: null as never, p_type: null as never });
  if (r.error) return fromDbError(r.error.message);
  return json({ tenant_id: id, logo: false });
}
