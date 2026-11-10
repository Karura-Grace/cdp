import { admin } from "./supabase/admin";
import { consentPurposeGap } from "./consent-template.mjs";

/** Pre-flight WARNING (never blocking, owner decision of 18 October 2026): the approved consent text of the engagement's assessment leaves out the purpose.
 *  Returns null when there is nothing to warn about, including when no consent text has been approved yet (a different check covers that).
 *  The lead wires it into lib/preflight.ts: push the result into the warnings list when it is not null. */
export async function consentPurposeWarning(engagementId: string): Promise<{ id: "CONSENT_PURPOSE"; message: string } | null> {
  const db = admin();
  const [{ data: eng }, { data: asm }] = await Promise.all([
    db.from("engagement").select("purpose").eq("engagement_id", engagementId).maybeSingle(),
    db.from("assessment").select("consent_text_id").eq("engagement_id", engagementId).neq("status", "SUPERSEDED").maybeSingle(),
  ]);
  if (!asm?.consent_text_id) return null;
  const { data: ct } = await db.from("consent_text").select("body, status").eq("consent_text_id", asm.consent_text_id).maybeSingle();
  if (!ct || ct.status !== "APPROVED") return null;
  const message = consentPurposeGap(ct.body, eng?.purpose ?? null);
  return message ? { id: "CONSENT_PURPOSE", message } : null;
}
