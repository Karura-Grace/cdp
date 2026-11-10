import { admin } from "@/lib/supabase/admin";
import { consultantOnEngagement } from "@/lib/staff";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// The workbook versions of an engagement, newest first, and which one is final. Answers are not listed here, only what the review screen needs.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const db = admin();
  const [{ data: vs }, { data: fin }] = await Promise.all([
    db.from("setup_workbook_version").select("version_id, version_no, file_name, clean, uploaded_at, uploaded_by").eq("engagement_id", id).order("version_no", { ascending: false }),
    db.from("setup_workbook_final").select("version_id, marked_at, marked_by").eq("engagement_id", id).order("marked_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return json({ versions: vs ?? [], final_version_id: fin?.version_id ?? null, marked_at: fin?.marked_at ?? null });
}
