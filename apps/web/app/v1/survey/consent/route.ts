import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// S2-03: record AGREE or DECLINE for this link. The token travels in a header, as on /v1/survey; never logged.
export async function POST(req: Request) {
  const token = req.headers.get("x-survey-token") ?? "";
  if (!/^[0-9a-f]{32}$/.test(token)) return problem({ code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." });

  const raw = await req.text();
  if (raw.length > 256) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is too large." });
  let body: { decision?: string };
  try { body = JSON.parse(raw); } catch { return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is not valid JSON." }); }
  if (body.decision !== "AGREE" && body.decision !== "DECLINE") return problem({ code: "VALIDATION_FAILED", status: 422, title: "decision must be AGREE or DECLINE." });

  const { error } = await admin().rpc("rpc_record_consent", { p_token: token, p_decision: body.decision });
  if (error) return fromDbError(error.message);
  return json({ decision: body.decision });
}
