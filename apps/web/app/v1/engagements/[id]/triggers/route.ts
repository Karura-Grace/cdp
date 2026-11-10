import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { consultantOnEngagement, readJson } from "@/lib/staff";
import { fromDbError, json } from "@/lib/problem";

export const runtime = "nodejs";

// POST { board_request?: boolean }: checks the non-pulse triggers (spec Table 102) with the engine and records any that are new.
// A trigger opens a consultant review; it never starts a survey by itself (D-06). Idempotent: a trigger is raised once.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await consultantOnEngagement(req, id);
  if (c instanceof Response) return c;
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const db = admin();
  const prev = c.eng.previous_engagement_id;
  const baseEng = prev ?? id;                                   // the cycle being measured against: the previous one, or this one when it is the baseline
  const [{ data: changes }, { data: asm }, { data: acts }] = await Promise.all([
    db.from("org_change").select("type").eq("engagement_id", id),
    db.from("assessment").select("assessment_id, window_close").eq("engagement_id", baseEng).neq("status", "SUPERSEDED").maybeSingle(),
    db.from("action").select("priority_id, status, horizon, assessment_id").eq("horizon", "STRUCTURAL_12M_PLUS"),
  ]);
  const structural: Record<string, string[]> = {};
  for (const x of acts ?? []) if (x.assessment_id === asm?.assessment_id) (structural[x.priority_id] ??= []).push(x.status);
  const today = new Date().toISOString().slice(0, 10);
  const found = E.otherTriggers({ structuralActionsByPriority: structural, orgChanges: changes ?? [], boardRequest: b.board_request === true,
    baselineClosedOn: asm?.window_close?.slice(0, 10), today });
  const raised: string[] = [];
  for (const t of found) {
    const { data, error } = await db.rpc("rpc_trigger_raise", { p_actor: c.a.userId, p_engagement: id, p_type: t.type, p_ref: t.ref });
    if (error) return fromDbError(error.message);
    if (data) raised.push(t.type);
  }
  return json({ checked: found.length, raised });
}
