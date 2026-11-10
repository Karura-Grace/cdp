import { validate360 } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Leadership 360 forms. The single-use token travels in a header (never logged). Any bad, used or expired token gets
// the same neutral 410, as for the culture survey.
const tokenOf = (req: Request) => req.headers.get("x-survey-token") ?? "";
const GONE = { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." } as const;

export async function GET(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);
  const { data, error } = await admin().rpc("rpc_status_360", { p_token: token });
  if (error) return fromDbError(error.message);
  return json(data);
}

export async function PUT(req: Request) {
  const token = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(token)) return problem(GONE);
  const raw = await req.text();
  if (raw.length > 40 * 1024) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The submission is too large." });
  let body: { ratings?: unknown; kind?: unknown; meta?: { known_for?: unknown; contact?: unknown }; text?: unknown };
  try { body = JSON.parse(raw); } catch { return problem({ code: "VALIDATION_FAILED", status: 422, title: "The body is not valid JSON." }); }
  const st = await admin().rpc("rpc_status_360", { p_token: token });
  if (st.error) return fromDbError(st.error.message);
  const kind = (st.data as { kind: "SELF" | "RATER" }).kind;
  if (!Array.isArray(body.ratings)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "ratings is required." });
  // Wire format (owner rule 26 Oct 2026, Q-L2): every statement carries an answer. 1 to 5 rates it; 0 means Not observed and is allowed on a rater form only. A null or a missing
  // statement is a blank and is refused for both forms. Not observed is stored as null, as before, so the engine and the database are unchanged.
  const wire = body.ratings as unknown[];
  if (wire.length !== 60 || wire.some((v) => !Number.isInteger(v) || (v as number) < 0 || (v as number) > 5)) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Every statement needs an answer: 1 to 5, or 0 for Not observed on a rater form." });
  }
  if (kind === "SELF" && wire.some((v) => v === 0)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Not observed is only for raters. Every self statement needs a rating from 1 to 5." });
  const ratings = wire.map((v) => (v === 0 ? null : v)) as (number | null)[];
  const p = validate360(ratings, kind);
  if (p) return problem(p);
  // optional rater context, as bands; the database refuses anything else and ignores it on a self form
  // open questions (S-Q1..S-Q6 on the self form, R-Q1..R-Q7 on the rater form), optional, 2,000 characters each; stored encrypted
  const codes = kind === "SELF" ? ["S-Q1", "S-Q2", "S-Q3", "S-Q4", "S-Q5", "S-Q6"] : ["R-Q1", "R-Q2", "R-Q3", "R-Q4", "R-Q5", "R-Q6", "R-Q7"];
  const text: Record<string, string> = {};
  if (body.text !== undefined) {
    if (!body.text || typeof body.text !== "object" || Array.isArray(body.text)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "text must be an object of answers." });
    for (const [k, v] of Object.entries(body.text)) {
      if (!codes.includes(k) || typeof v !== "string" || v.length > 2000) return problem({ code: "VALIDATION_FAILED", status: 422, title: "An open answer is not valid for this form or is over 2,000 characters." });
      if (v.trim()) text[k] = v.trim();
    }
  }
  const meta = { known_for: typeof body.meta?.known_for === "string" ? body.meta.known_for : null, contact: typeof body.meta?.contact === "string" ? body.meta.contact : null, text };
  const { error } = await admin().rpc("rpc_submit_360", { p_token: token, p_ratings: ratings as never, p_meta: meta as never });
  if (error) return fromDbError(error.message);
  return json({ state: "SUBMITTED" });
}
