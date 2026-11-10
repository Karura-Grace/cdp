import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { actionFor } from "@/lib/plan";
import { MAX_BYTES, TYPES } from "@/lib/evidence-files";
import { head, remove } from "@/lib/r2";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const KINDS = ["DOCUMENT", "MINUTES", "KPI_REPORT"];

// POST { kind, description, link? | file_key + file_name? }: evidence that an action delivered (needed before it can close).
// A file must already be in R2 (see /evidence/upload); its size and type are read from the stored object, and a file that
// breaks the rules is deleted and refused. A link must be https.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 4096);
  if (b instanceof Response) return b;
  const found = await actionFor(a, id);
  if (!found || found.role === "COACH") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const desc = typeof b.description === "string" ? b.description.trim() : "";
  const link = typeof b.link === "string" ? b.link.trim() : "";
  const key = typeof b.file_key === "string" ? b.file_key : "";
  if (!KINDS.includes(String(b.kind)) || desc.length < 3 || desc.length > 1000 || (link && (!/^https:\/\/\S+$/.test(link) || link.length > 500)) || (link && key)) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "kind (DOCUMENT, MINUTES or KPI_REPORT), a description, and either a file or an https link are required." });
  }
  let file: { key: string; name: string; size: number; type: string } | null = null;
  if (key) {
    if (!key.startsWith(`evidence/${found.act.tenant_id}/${id}/`)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "That file does not belong to this action." });
    const o = await head(key);
    if (!o) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The upload did not arrive. Try again." });
    if (o.size < 1 || o.size > MAX_BYTES || !TYPES[o.type]) { await remove(key); return problem({ code: "VALIDATION_FAILED", status: 422, title: "Upload a PDF, Word, Excel, PowerPoint, PNG or JPG file of up to 20 MB." }); }
    const name = typeof b.file_name === "string" && b.file_name.trim() ? b.file_name.trim().slice(0, 200) : key.split("/").pop()!;
    file = { key, name, size: o.size, type: o.type };
  }
  const { data, error } = await admin().rpc("rpc_evidence_add", { p_actor: a.userId, p_action: id, p_kind: String(b.kind), p_description: desc, p_link: link,
    p_file_key: file?.key, p_file_name: file?.name, p_file_size: file?.size, p_content_type: file?.type });
  if (error) { if (file) await remove(file.key); return fromDbError(error.message); }
  return json({ action_id: id, evidence_id: data, kind: b.kind, file: file ? { name: file.name, size: file.size } : null }, 201);
}
