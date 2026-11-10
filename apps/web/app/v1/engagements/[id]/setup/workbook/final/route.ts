import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { SECTION_KEYS } from "@/lib/setup-workbook";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";
import type { Json } from "@/lib/setup-sections";

export const runtime = "nodejs";

// POST { version_id }  mark a CLEAN workbook version final. The final version is the one used: each of its sections that holds answers is written to Setup as the agreed
// record in DRAFT (the same record the Setup forms save), so it still has to be agreed in the workshop steps before the engine reads it. Earlier versions stay as they are.
// Marking a different version final later writes that version over the Setup drafts and takes the confirmations back, exactly as editing a section does. Setup must be open.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  if (g.eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const b = await readJson(req);
  if (b instanceof Response) return b;
  if (typeof b.version_id !== "string") return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send version_id." });
  const db = admin();
  const { data: v } = await db.from("setup_workbook_version").select("*").eq("engagement_id", id).eq("version_id", b.version_id).maybeSingle();
  if (!v) return problem({ code: "NOT_FOUND", status: 404, title: "No such workbook version." });
  if (!v.clean) return problem({ code: "VALIDATION_FAILED", status: 422, title: "This version has problems in it. Fix them in the workbook and upload it again before marking it final." });
  const secs = v.sections_json as Record<string, { payload: Json }>;
  const written: string[] = [];
  for (const sec of SECTION_KEYS) {
    const payload = secs[sec]?.payload;
    if (!payload || Object.keys(payload).length === 0) continue;
    const prev = await db.from("setup_record").select("setup_id").eq("engagement_id", id).eq("section", sec).eq("perspective", "AGREED").maybeSingle();
    const up = prev.data
      ? await db.from("setup_record").update({ payload_json: payload as never, status: "DRAFT", updated_by: g.a.userId }).eq("setup_id", prev.data.setup_id).select("setup_id").single()
      : await db.from("setup_record").insert({ tenant_id: g.eng.tenant_id, engagement_id: id, section: sec, perspective: "AGREED", payload_json: payload as never, status: "DRAFT",
          participants: [], facilitator: "PAC Consultant", facilitator_user_id: g.a.userId, created_by: g.a.userId, updated_by: g.a.userId }).select("setup_id").single();
    if (up.error) return fromDbError(up.error.message);
    written.push(sec);
    await audit(g.eng.tenant_id, g.a.userId, `setup.saved:${sec}`, "setup_record", up.data.setup_id);
  }
  if (written.includes("C")) {
    const r = await db.from("setup_record").update({ status: "DRAFT", updated_by: g.a.userId }).eq("engagement_id", id).eq("section", "D").eq("perspective", "AGREED").eq("status", "AGREED");
    if (r.error) return fromDbError(r.error.message);
  }
  const cl = await db.from("setup_confirmation").delete().eq("engagement_id", id).in("section", written.includes("C") ? [...new Set([...written, "D"])] : written);
  if (cl.error) return fromDbError(cl.error.message);
  const mk = await db.from("setup_workbook_final").insert({ tenant_id: g.eng.tenant_id, engagement_id: id, version_id: v.version_id, marked_by: g.a.userId });
  if (mk.error) return fromDbError(mk.error.message);
  await audit(g.eng.tenant_id, g.a.userId, "setup.workbook_final", "setup_workbook_version", v.version_id);
  return json({ version_id: v.version_id, version_no: v.version_no, sections_written: written });
}
