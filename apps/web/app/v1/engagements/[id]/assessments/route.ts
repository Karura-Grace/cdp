import { admin } from "@/lib/supabase/admin";
import { consentText } from "@/lib/consent-template.mjs";
import { audit } from "@/lib/audit";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const bad = (title: string) => problem({ code: "VALIDATION_FAILED", status: 422, title });

// Create the DRAFT assessment for an engagement: pins the published instrument and rules versions, sets the survey
// window, and drafts a consent text from the tenant's privacy-regime template. One assessment per engagement.
// The 10-working-day minimum is checked by pre-flight L5, not here, so a window can be set first and fixed later.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const open = String(b.window_open ?? ""), close = String(b.window_close ?? "");
  if (!DAY.test(open) || !DAY.test(close) || open >= close) return bad("window_open and window_close must be dates (YYYY-MM-DD), open before close.");
  if (g.eng.state !== "SETUP") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "An assessment can only be created while the engagement is in setup." });

  const db = admin();
  const { data: existing } = await db.from("assessment").select("assessment_id").eq("engagement_id", id).limit(1);
  if (existing?.length) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "This engagement already has an assessment." });

  const [{ data: ins }, { data: rul }, { data: tenant }] = await Promise.all([
    db.from("instrument_version").select("version_id").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1),
    db.from("rules_version").select("version_id").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1),
    db.from("tenant").select("name, legal_name, privacy_regime").eq("tenant_id", g.eng.tenant_id).single(),
  ]);
  if (!ins?.length || !rul?.length || !tenant) return problem({ code: "INTERNAL", status: 500, title: "No published instrument or rules version." });

  const { data: last } = await db.from("consent_text").select("version").eq("tenant_id", g.eng.tenant_id).eq("privacy_regime", tenant.privacy_regime).eq("locale", "en").order("version", { ascending: false }).limit(1);
  const t = consentText({ orgName: tenant.legal_name ?? tenant.name, privacyRegime: tenant.privacy_regime, purpose: g.eng.purpose });
  const ct = await db.from("consent_text").insert({
    tenant_id: g.eng.tenant_id, privacy_regime: tenant.privacy_regime, version: (last?.[0]?.version ?? 0) + 1, title: t.title, body: t.body, created_by: g.a.userId,
  }).select("consent_text_id").single();
  if (ct.error) return fromDbError(ct.error.message);

  const asm = await db.from("assessment").insert({
    tenant_id: g.eng.tenant_id, engagement_id: id, instrument_version_id: ins[0].version_id, rules_version_id: rul[0].version_id,
    window_open: `${open}T00:00:00Z`, window_close: `${close}T23:59:59Z`, consent_text_id: ct.data.consent_text_id, created_by: g.a.userId,
  }).select("assessment_id").single();
  if (asm.error) return fromDbError(asm.error.message);
  await audit(g.eng.tenant_id, g.a.userId, "assessment.created", "assessment", asm.data.assessment_id);
  return json({ assessment_id: asm.data.assessment_id, consent_text_id: ct.data.consent_text_id }, 201);
}
