import { actor } from "@/lib/staff";
import { r2Configured, signedGet } from "@/lib/r2";
import { problem } from "@/lib/problem";

export const runtime = "nodejs";

// GET: redirect to a 5-minute signed download of an evidence file. Reading the evidence row through the caller's own token
// (RLS) is the permission check; the redirect is never cached.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: ev } = await a.db.from("action_evidence").select("file_key, file_name").eq("evidence_id", id).maybeSingle();
  if (!ev?.file_key || !ev.file_name) return problem({ code: "NOT_FOUND", status: 404, title: "That file was not found." });
  if (!r2Configured()) return problem({ code: "UNAVAILABLE", status: 503, title: "File storage is not configured." });
  return new Response(null, { status: 302, headers: { location: await signedGet(ev.file_key, ev.file_name), "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
