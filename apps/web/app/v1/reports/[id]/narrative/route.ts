import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { loadReport } from "@/lib/report-data";
import { reportExtras } from "@/lib/report-extras";
import { buildFullModel } from "@/lib/export/full-model";
import { withTwoDecimals } from "@/lib/precision";
import { polishChapter } from "@/lib/ai-polish";
import { fromDbError, json, problem } from "@/lib/problem";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

// AI polish per chapter (owner Q-AL26, 1 Nov 2026): the PAC Consultant on the engagement asks for a short reading of one chapter,
// written by the model from the chapter's own text and screened by the engine guardrails. It is stored as `ai_<chapter>` in the
// report sections and shows in the report only once the consultant accepts it; release refuses while a draft is not accepted.
async function consultant(req: Request, id: string) {
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: rep } = await a.db.from("report").select("report_id, tenant_id, assessment_id, status, sections_json, accepted_json").eq("report_id", id).maybeSingle();
  const { data: asm } = rep ? await a.db.from("assessment").select("engagement_id").eq("assessment_id", rep.assessment_id).maybeSingle() : { data: null };
  const { data: role } = asm ? await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id }) : { data: null };
  if (!rep || role !== "PAC_CONSULTANT") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (rep.status === "RELEASED") return problem({ code: "REPORT_RELEASED", status: 409, title: "A released report keeps the text it was released with." });
  return { a, rep };
}

/** Draft one chapter. Body `{ chapter: "gaps", model?: "claude-sonnet-5-5" }`; the default model is the one in config. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await consultant(req, (await params).id);
  if (g instanceof Response) return g;
  if (!process.env.ANTHROPIC_API_KEY) return problem({ code: "AI_UNAVAILABLE", status: 503, title: "AI drafting is not set up on this server." });
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const l = await loadReport(g.a.db, g.rep.report_id);
  if (!l) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const x = await reportExtras(l, g.a.userId);
  const ch = withTwoDecimals(() => buildFullModel(l, x)).chapters.find((c) => c.key === b.chapter);
  if (!ch) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Name a chapter of this report." });
  const r = await polishChapter({ reportId: g.rep.report_id, tenantId: g.rep.tenant_id, actorId: g.a.userId, chapter: ch, payload: l.score,
    smallGroups: (x.depts ?? []).filter((d) => d.suppressed).map((d) => d.label), model: typeof b.model === "string" ? b.model : undefined });
  if (!r.ok) return problem({ code: r.code, status: r.code === "AI_BUDGET" ? 429 : 422, title: r.detail.join(" ") });
  const key = `ai_${ch.key}`;
  const sections = { ...(g.rep.sections_json as Record<string, string>), [key]: r.text };
  const accepted = { ...(g.rep.accepted_json as Record<string, unknown>) }; delete accepted[key];
  const up = await admin().from("report").update({ sections_json: sections, accepted_json: accepted as Json }).eq("report_id", g.rep.report_id);
  if (up.error) return fromDbError(up.error.message);
  return json({ chapter: ch.key, text: r.text, model: r.model, cost_usd: r.cost_usd, month_usd: r.month_usd }, 201);
}

/** Keep or drop a draft: `{ chapter: "gaps", decision: "ACCEPTED" | "DROPPED" }`. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await consultant(req, (await params).id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const key = `ai_${String(b.chapter)}`;
  const sections = { ...(g.rep.sections_json as Record<string, string>) };
  if (!(key in sections) || !["ACCEPTED", "DROPPED"].includes(String(b.decision))) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Name a drafted chapter and ACCEPTED or DROPPED." });
  const accepted = { ...(g.rep.accepted_json as Record<string, unknown>) };
  if (b.decision === "ACCEPTED") accepted[key] = { by: g.a.userId, at: new Date().toISOString() };
  else { delete sections[key]; delete accepted[key]; }
  const up = await admin().from("report").update({ sections_json: sections, accepted_json: accepted as Json }).eq("report_id", g.rep.report_id);
  if (up.error) return fromDbError(up.error.message);
  return json({ chapter: b.chapter, decision: b.decision });
}
