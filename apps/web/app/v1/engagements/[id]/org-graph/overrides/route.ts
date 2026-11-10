import { admin } from "@/lib/supabase/admin";
import { graphEditor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// §1.6.1: a consultant may override a blocking rule only by recording a reason. The override is listed in the technical
// appendix of every report. { rule, reason } sets it, { rule, reason: null } removes it. Only V1 to V4, V6 and V7 block.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id, true);
  if (g instanceof Response) return g;
  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const rule = typeof b.rule === "string" ? b.rule : "";
  if (!["V1", "V2", "V3", "V4", "V6", "V7"].includes(rule)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Only a blocking rule (V1, V2, V3, V4, V6 or V7) can be overridden." });
  const reason = b.reason === null ? null : typeof b.reason === "string" ? b.reason.trim() : undefined;
  if (reason === undefined || (reason !== null && (reason.length < 3 || reason.length > 500))) return problem({ code: "VALIDATION_FAILED", status: 422, title: "A reason of 3 to 500 characters is required (or null to remove the override)." });
  const { data, error } = await admin().rpc("rpc_org_override_set", { p_actor: g.a.userId, p_engagement: id, p_rule: rule, p_reason: reason as string });
  if (error) return fromDbError(error.message);
  return json(data);
}
