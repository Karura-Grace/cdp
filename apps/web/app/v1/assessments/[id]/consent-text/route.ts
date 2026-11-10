import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Edit the consent text pinned to a DRAFT assessment. An approved text never changes (database trigger); editing one
// makes a new version and pins that instead. The new version has to be approved again.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (asm.status !== "DRAFT") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The consent text is pinned because the assessment has launched." });
  const b = await readJson(req, 40 * 1024);
  if (b instanceof Response) return b;
  const title = typeof b.title === "string" ? b.title.trim() : "", body = typeof b.body === "string" ? b.body.trim() : "";
  if (!title || title.length > 200 || !body || body.length > 20000) return problem({ code: "VALIDATION_FAILED", status: 422, title: "title (up to 200) and body (up to 20,000 characters) are required." });

  const db = admin();
  const { data: cur } = await db.from("consent_text").select("*").eq("consent_text_id", asm.consent_text_id ?? "").maybeSingle();
  if (cur && cur.status === "DRAFT") {
    const up = await db.from("consent_text").update({ title, body }).eq("consent_text_id", cur.consent_text_id);
    if (up.error) return fromDbError(up.error.message);
    await audit(asm.tenant_id, a.userId, "consent_text.edited", "consent_text", cur.consent_text_id);
    return json({ consent_text_id: cur.consent_text_id, version: cur.version, status: "DRAFT" });
  }
  const { data: tn } = await db.from("tenant").select("privacy_regime").eq("tenant_id", asm.tenant_id).single();
  const { data: last } = await db.from("consent_text").select("version").eq("tenant_id", asm.tenant_id).eq("privacy_regime", tn!.privacy_regime).eq("locale", "en").order("version", { ascending: false }).limit(1);
  const ins = await db.from("consent_text").insert({ tenant_id: asm.tenant_id, privacy_regime: tn!.privacy_regime, version: (last?.[0]?.version ?? 0) + 1, title, body, created_by: a.userId }).select("consent_text_id, version").single();
  if (ins.error) return fromDbError(ins.error.message);
  const pin = await db.from("assessment").update({ consent_text_id: ins.data.consent_text_id }).eq("assessment_id", id);
  if (pin.error) return fromDbError(pin.error.message);
  await audit(asm.tenant_id, a.userId, "consent_text.new_version", "consent_text", ins.data.consent_text_id);
  return json({ consent_text_id: ins.data.consent_text_id, version: ins.data.version, status: "DRAFT" }, 201);
}
