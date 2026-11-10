import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Server side draft (S2.3.1-005): saved encrypted on every completed scenario so a survey resumes on another device.
// It is deleted in the same transaction as the submit, and at freeze. Never log the token or the body (CLAUDE.md §8).
const tokenOf = (req: Request) => req.headers.get("x-survey-token") ?? "";
const GONE = { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." } as const;
const MAX_BODY = 64 * 1024;

export async function GET(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);
  const { data, error } = await admin().rpc("rpc_load_draft", { p_token: token });
  if (error) return fromDbError(error.message);
  return json({ draft: data ?? null });
}

export async function PUT(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The draft is too large." });
  let draft: unknown;
  try { draft = JSON.parse(raw); } catch { return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is not valid JSON." }); }
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The draft must be an object." });
  const { error } = await admin().rpc("rpc_save_draft", { p_token: token, p_payload: draft as never });
  if (error) return fromDbError(error.message);
  return json({ saved: true });
}
