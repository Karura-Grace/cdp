import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { proposeAdvice } from "@/lib/advice";
import { reportExtras } from "@/lib/report-extras";
import { loadReport } from "@/lib/report-data";
import { fromDbError, json, problem } from "@/lib/problem";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

// Advice library on a report (Erick #197, owner Q-AL8, Q-AL14): the PAC Consultant on the engagement asks for proposals from the
// report's frozen numbers, then keeps, drops or rewords each one. Release refuses while any proposal is undecided.
async function consultant(req: Request, id: string) {
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: rep } = await a.db.from("report").select("report_id, assessment_id, status").eq("report_id", id).maybeSingle();
  const { data: asm } = rep ? await a.db.from("assessment").select("engagement_id").eq("assessment_id", rep.assessment_id).maybeSingle() : { data: null };
  const { data: role } = asm ? await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id }) : { data: null };
  if (!rep || role !== "PAC_CONSULTANT") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  return { a, rep };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await consultant(req, (await params).id);
  if (g instanceof Response) return g;
  const { data, error } = await admin().from("report_advice").select("item_id, scope_key, section, level, proposed_rank, decision, edited, advice_item(title, topic, diagnosis)")
    .eq("report_id", g.rep.report_id).order("section").order("proposed_rank");
  if (error) return fromDbError(error.message);
  return json({ items: data });
}

/** Propose advice. Body `{ version?: "alv_..." }` lets a review run use a DRAFT library version (owner Q-AL25). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await consultant(req, (await params).id);
  if (g instanceof Response) return g;
  if (g.rep.status === "RELEASED") return problem({ code: "REPORT_RELEASED", status: 409, title: "A released report keeps the advice it was released with." });
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const version = typeof b.version === "string" && /^alv_[a-z0-9]+$/.test(b.version) ? b.version : undefined;
  const l = await loadReport(g.a.db, g.rep.report_id);
  const depts = l ? (await reportExtras(l, g.a.userId)).depts : null;    // department advice only for groups that met the reporting floor
  const added = await proposeAdvice(g.rep.report_id, g.a.userId, { version, depts });
  return json({ added }, 201);
}

const FIELDS = ["title", "diagnosis", "why", "risks", "actions", "questions", "signal", "good", "traps"];
/** Decide proposals: `{ decisions: [{ item_id, scope_key?, decision: "ACCEPTED" | "DROPPED", edited?: { field: value } }] }`. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await consultant(req, (await params).id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 512 * 1024);
  if (b instanceof Response) return b;
  const ds = Array.isArray(b.decisions) ? (b.decisions as Record<string, unknown>[]) : [];
  if (!ds.length || ds.some((d) => typeof d.item_id !== "string" || !["ACCEPTED", "DROPPED"].includes(String(d.decision))
    || (d.edited !== undefined && (typeof d.edited !== "object" || d.edited === null || Object.keys(d.edited).some((k) => !FIELDS.includes(k))))))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Each decision needs an item, ACCEPTED or DROPPED, and edits only to advice text fields." });
  const now = new Date().toISOString();
  for (const d of ds) {
    const up = await admin().from("report_advice").update({ decision: String(d.decision), edited: (d.edited as Json | undefined) ?? null, decided_by: g.a.userId, decided_at: now })
      .eq("report_id", g.rep.report_id).eq("item_id", String(d.item_id)).eq("scope_key", typeof d.scope_key === "string" ? d.scope_key : "");
    if (up.error) return fromDbError(up.error.message);
  }
  return json({ decided: ds.length });
}
