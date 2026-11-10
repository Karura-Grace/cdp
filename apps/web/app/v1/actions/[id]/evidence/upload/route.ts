import { randomUUID } from "node:crypto";
import { actor, readJson } from "@/lib/staff";
import { actionFor } from "@/lib/plan";
import { MAX_BYTES, TYPES, safeName } from "@/lib/evidence-files";
import { r2Configured, signedPut } from "@/lib/r2";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST { file_name, size, content_type } -> { key, url }: a 5-minute signed link to upload one evidence file straight to R2.
// The file is only recorded once POST /evidence confirms it (size and type checked on the stored object).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const found = await actionFor(a, id);
  if (!found || found.role === "COACH") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (!["PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW"].includes(found.act.status)) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Evidence is added once the action is published." });
  const size = Number(b.size), type = String(b.content_type ?? ""), name = String(b.file_name ?? "");
  if (!TYPES[type] || !Number.isInteger(size) || size < 1 || size > MAX_BYTES || !name || name.length > 200) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Upload a PDF, Word, Excel, PowerPoint, PNG or JPG file of up to 20 MB." });
  }
  if (!r2Configured()) return problem({ code: "UNAVAILABLE", status: 503, title: "File storage is not configured yet. Add a link instead." });
  const key = `evidence/${found.act.tenant_id}/${id}/${randomUUID()}-${safeName(name)}`;
  return json({ key, url: await signedPut(key, type), expires_in: 300 }, 201);
}
