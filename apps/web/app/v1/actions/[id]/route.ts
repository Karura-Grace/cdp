import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { CLIENT_PLAN_ROLES, actionFor, openGates, rulesOf, workflowProblem } from "@/lib/plan";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const FIELDS = ["owner", "sponsor", "kpi", "baseline_value", "target_value", "budget_amount", "start_date", "end_date"] as const;
const NUM = /^-?\d{1,12}(\.\d{1,6})?$/, DATE = /^\d{4}-\d{2}-\d{2}$/;

// PATCH { fields: {...} }  edit the plan fields while DRAFT, IN_REVIEW or IN_CO_DESIGN: the PAC Consultant on rules 2.0 and 2.1, the client from rules 2.2, or
// PATCH { client: { horizon?, decision? } }  the client marks an action Now, Next or Later, or defers it (rules 2.2; decision is DEFERRED or null), or
// PATCH { to, reason? }    move the action. Accepting (to APPROVED) records the client's decision beside the move on rules 2.2. The engine's transition decides (role, mandatory fields, open gates, evidence);
//                          the database re-checks gates and evidence and refuses a stale status.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 8 * 1024);
  if (b instanceof Response) return b;
  const found = await actionFor(a, id);
  if (!found) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const { act, role } = found;
  const db = admin();
  const rules = await rulesOf(act.assessment_id);
  const clientOwned = rules === "2.2";

  if (b.client !== undefined) {
    const c = b.client as Record<string, unknown>;
    if (!clientOwned || !CLIENT_PLAN_ROLES.includes(role)) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
    if (!c || typeof c !== "object" || Array.isArray(c) || !Object.keys(c).length || Object.keys(c).some((k) => k !== "horizon" && k !== "decision")
        || (c.horizon !== undefined && c.horizon !== null && !["NOW", "NEXT", "LATER"].includes(String(c.horizon)))
        || (c.decision !== undefined && c.decision !== null && c.decision !== "DEFERRED")) {
      return problem({ code: "VALIDATION_FAILED", status: 422, title: "client may set horizon (NOW, NEXT, LATER) and decision (DEFERRED or null)." });
    }
    const { error } = await db.rpc("rpc_action_client_set", { p_actor: a.userId, p_action: id, p_set: c as never });
    if (error) return fromDbError(error.message);
    return json({ action_id: id, client: c });
  }

  if (b.fields !== undefined) {
    if (clientOwned ? !CLIENT_PLAN_ROLES.includes(role) : role !== "PAC_CONSULTANT") {
      return problem({ code: "FORBIDDEN", status: 403, title: clientOwned ? "Your role or scope does not permit this." : "Only the PAC Consultant edits the plan." });
    }
    const f = b.fields as Record<string, unknown>;
    if (!f || typeof f !== "object" || Array.isArray(f) || !Object.keys(f).length || Object.keys(f).some((k) => !(FIELDS as readonly string[]).includes(k))) {
      return problem({ code: "VALIDATION_FAILED", status: 422, title: `fields may set ${FIELDS.join(", ")}.` });
    }
    for (const [k, v] of Object.entries(f)) {
      const s = v === null ? "" : String(v);
      const bad = typeof v !== "string" && v !== null && typeof v !== "number" ? true
        : ["baseline_value", "target_value", "budget_amount"].includes(k) ? s !== "" && !NUM.test(s)
        : ["start_date", "end_date"].includes(k) ? !DATE.test(s)
        : s.length > 200;
      if (bad) return problem({ code: "VALIDATION_FAILED", status: 422, title: `${k} is not valid.` });
    }
    const { error } = clientOwned
      ? await db.rpc("rpc_action_client_fields", { p_actor: a.userId, p_action: id, p_fields: f as never })
      : await db.rpc("rpc_action_update", { p_actor: a.userId, p_action: id, p_fields: f as never });
    if (error) return fromDbError(error.message);
    return json({ action_id: id, updated: Object.keys(f) });
  }

  const to = String(b.to ?? "");
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 1000) : null;
  if (!to) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send fields or to." });
  const [{ count }, gates] = await Promise.all([
    db.from("action_evidence").select("evidence_id", { count: "exact", head: true }).eq("action_id", id),
    openGates(a, act),
  ]);
  try { E.transition(act as never, to as E.ActionStatus, role, { openGates: gates, evidenceCount: count ?? 0, reason, rules }); }
  catch (e) { return workflowProblem(e); }
  const { error } = await db.rpc("rpc_action_transition", { p_actor: a.userId, p_action: id, p_from: act.status, p_to: to, p_reason: reason ?? "" });
  if (error) return fromDbError(error.message);
  if (clientOwned && to === "APPROVED") {
    const accepted = await db.rpc("rpc_action_client_set", { p_actor: a.userId, p_action: id, p_set: { decision: "ACCEPTED" } });
    if (accepted.error) return fromDbError(accepted.error.message);
  }
  return json({ action_id: id, status: to });
}
