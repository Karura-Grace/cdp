import { requireServiceForAssessment } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const GROUPS = ["SUPERIOR", "PEER", "DIRECT_REPORT", "OTHER"];
const unauth = () => problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });

// Rater proposals (spec 1.4.6, D-09): the leader proposes, the line manager approves, or the Client Admin on their behalf.
//   PUT  { assignment_id, raters: [{ person_id, rater_group }] }   the leader (a People Leader linked to that person), the Client Admin or the
//                                                                    consultant on the leader's behalf. Replaces the leader's waiting proposals.
//   POST { assignment_id, decision: "APPROVE" | "REJECT" }         the leader's line manager (a People Leader linked to that person) or the Client Admin.
// Approving needs 3 to 8 peers. The database checks the caller's role against the leader, so a route cannot be talked past it.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return unauth();
  const b = await readJson(req, 16 * 1024);
  if (b instanceof Response) return b;
  const raters = b.raters as { person_id?: unknown; rater_group?: unknown }[] | undefined;
  if (typeof b.assignment_id !== "string" || !Array.isArray(raters) || raters.some((r) => typeof r?.person_id !== "string" || !GROUPS.includes(String(r?.rater_group))))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "assignment_id and raters [{ person_id, rater_group }] are required." });
  if (new Set(raters.map((r) => r.person_id)).size !== raters.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Each rater can be listed once per leader." });
  const { data, error } = await admin().rpc("rpc_nominations_propose", {
    p_actor: a.userId, p_assessment: id, p_assignment: b.assignment_id, p_noms: raters.map((r) => ({ person_id: r.person_id, rater_group: r.rater_group })) as never,
  });
  if (error) return fromDbError(error.message);
  return json(data);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return unauth();
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  if (typeof b.assignment_id !== "string" || (b.decision !== "APPROVE" && b.decision !== "REJECT"))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "assignment_id and decision (APPROVE or REJECT) are required." });
  const { data, error } = await admin().rpc("rpc_nominations_decide", { p_actor: a.userId, p_assessment: id, p_assignment: b.assignment_id, p_approve: b.decision === "APPROVE" });
  if (error) return fromDbError(error.message);
  return json(data);
}
