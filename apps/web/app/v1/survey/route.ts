import { validateSurveyPayload } from "@pac/cdp-engine";
import { surveyTexts } from "@/lib/survey-text";
import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Respondents hold a single-use token. Prefer the header: URLs end up in platform logs, bodies do not.
// Never log the token or the body (CLAUDE.md §8).
const tokenOf = (req: Request) =>
  req.headers.get("x-survey-token") ?? new URL(req.url).searchParams.get("token") ?? "";

const GONE = { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." } as const;
const MAX_BODY = 64 * 1024;
const PREFER_NOT = "Prefer not to say";

export async function GET(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);

  const db = admin();
  const { data: st, error } = await db.rpc("rpc_survey_status", { p_token: token });
  if (error) return fromDbError(error.message);
  const status = st as { state: string; assessment_id?: string; instrument_version_id?: string; consent_text_id?: string; consent?: "AGREE" | "DECLINE" | null };
  if (status.state !== "OPEN") return problem(GONE);

  const v = status.instrument_version_id!;
  // Only the organisation name and the close date go to the respondent: both are already in the invitation they received.
  const asm = await db.from("assessment").select("tenant_id, window_close").eq("assessment_id", status.assessment_id!).single();
  const org = asm.data ? await db.from("tenant").select("name").eq("tenant_id", asm.data.tenant_id).single() : null;
  const texts = await surveyTexts(status.assessment_id!);
  // S2-04 About you: the demographic attributes the organisation defined, as closed lists that always end with "Prefer not to say", and the grade and unit already on the invitation.
  const [{ data: attrs }, { data: prefill }] = await Promise.all([
    db.from("demographic_attribute").select("attr_id, name, values_list").eq("tenant_id", asm.data!.tenant_id).order("name"),
    db.rpc("rpc_invitation_prefill", { p_token: token }),
  ]);
  const about = (attrs ?? []).map((a) => ({ attr_id: a.attr_id, name: a.name, values: [...a.values_list.filter((v) => v !== PREFER_NOT), PREFER_NOT] }));
  const [consent, scenarios, statements, items] = await Promise.all([
    db.from("consent_text").select("version, title, body").eq("consent_text_id", status.consent_text_id!).single(),
    db.from("scenario").select("scenario_id, dimension, sequence, title, prompt_now, prompt_preferred").eq("version_id", v).order("scenario_id"),
    db.from("scenario_statement").select("scenario_id, orientation, text").eq("version_id", v),
    db.from("item").select("item_id, block, dimension, sequence, scale_type, title, canonical_text").eq("version_id", v).order("sequence"),
  ]);
  if (consent.error || scenarios.error || statements.error || items.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });

  return json({ state: "OPEN", org: org?.data?.name ?? null, closes: asm.data?.window_close ?? null, message: texts.message, estimate: texts.estimate, about, prefill: prefill ?? {}, consent: { decision: status.consent ?? null, ...consent.data }, scenarios: scenarios.data, statements: statements.data, items: items.data });
}

// Final submit. Drafts stay in the browser; nothing reaches the database before this call.
export async function PUT(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The submission is too large." });
  let body: { payload?: Record<string, unknown>; language?: string; duration?: number; about?: Record<string, unknown> };
  try { body = JSON.parse(raw); } catch { return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is not valid JSON." }); }
  if (!body.payload || typeof body.payload !== "object") return problem({ code: "VALIDATION_FAILED", status: 422, title: "payload is required." });

  const errors = validateSurveyPayload(body.payload as Parameters<typeof validateSurveyPayload>[0]);
  if (errors.length) return problem({ ...errors[0], errors });

  // About you answers go into the invitation's demographic snapshot (the existing capture mechanism) just before the submit copies the snapshot to the response.
  // They never touch a response row, and the invitation's person link is destroyed in the same submit as before.
  if (body.about !== undefined) {
    if (!body.about || typeof body.about !== "object" || Array.isArray(body.about)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "about must be an object of attribute answers." });
    if (Object.keys(body.about).length) {
      const { data: set, error: e } = await admin().rpc("rpc_set_invitation_attributes", { p_token: token, p_attrs: body.about as never });
      if (e) return fromDbError(e.message);
      if (!set) return problem(GONE);
    }
  }
  const { error } = await admin().rpc("rpc_submit_response", {
    p_token: token,
    p_payload: body.payload as never,
    p_language: body.language ?? "en",
    p_duration: Number.isInteger(body.duration) ? body.duration : undefined,
  });
  if (error) return fromDbError(error.message);
  return json({ state: "SUBMITTED" });
}
