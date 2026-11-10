import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { purposeSentence } from "@/lib/consent-template.mjs";
import { json, problem } from "@/lib/problem";
import { bad } from "@/lib/privacy";

export const runtime = "nodejs";

// The assessment purpose is stored on the engagement and reproduced in the consent text (spec 1.4.5). It is fixed once the assessment launches.
// A draft consent text that still carries the old purpose sentence is updated in place. An approved text never changes, so the consultant makes a
// new version (consent_updated false says so).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (!purpose || purpose.length > 1000) return bad("purpose is required (up to 1000 characters).");
  const db = admin();
  const { data: asm } = await db.from("assessment").select("status, consent_text_id").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle();
  if (asm && asm.status !== "DRAFT") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const up = await db.from("engagement").update({ purpose }).eq("engagement_id", id);
  if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  let consentUpdated = false;
  const ct = asm?.consent_text_id ? (await db.from("consent_text").select("consent_text_id, status, body").eq("consent_text_id", asm.consent_text_id).single()).data : null;
  if (ct?.status === "DRAFT") {
    const old = purposeSentence(g.eng.purpose);
    if (ct.body.includes(old)) {
      const r = await db.from("consent_text").update({ body: ct.body.replace(old, purposeSentence(purpose)) }).eq("consent_text_id", ct.consent_text_id);
      consentUpdated = !r.error;
    }
  }
  await audit(g.eng.tenant_id, g.a.userId, "privacy.purpose.set", "engagement", id);
  return json({ purpose, consent_updated: consentUpdated });
}
