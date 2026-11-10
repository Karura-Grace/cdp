import { requireServiceForAssessment } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const GROUPS = ["SUPERIOR", "PEER", "DIRECT_REPORT", "OTHER"];

// PUT { assignment_id, raters: [{ person_id, rater_group }] } replaces the not-yet-invited raters of one leader.
// PAC Consultant on the engagement or the tenant's Client Admin, before the data is frozen; the database checks both.
// Peers must be 3 to 8 (spec 1.4.6, D-09; owner decision 18 October 2026: every nomination route). Peers already invited count too. A list with
// no raters at all clears the leader's nominations and is allowed. The proposal route holds the same rule (8 at most when proposing, 3 to 8 to approve).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 16 * 1024);
  if (b instanceof Response) return b;
  const raters = b.raters as { person_id?: unknown; rater_group?: unknown }[] | undefined;
  if (typeof b.assignment_id !== "string" || !Array.isArray(raters)
      || raters.some((r) => typeof r?.person_id !== "string" || !GROUPS.includes(String(r?.rater_group)))) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "assignment_id and raters [{ person_id, rater_group }] are required." });
  }
  if (new Set(raters.map((r) => r.person_id)).size !== raters.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Each rater can be listed once per leader." });
  if (raters.length) {
    const { data: invited } = await admin().from("rater_nomination").select("rater_person_id").eq("assessment_id", id).eq("assignment_id", b.assignment_id).eq("rater_group", "PEER").eq("status", "INVITED");
    const peers = new Set([...raters.filter((r) => r.rater_group === "PEER").map((r) => r.person_id as string), ...(invited ?? []).map((r) => r.rater_person_id)]).size;
    if (peers < 3 || peers > 8) return problem({ code: "VALIDATION_FAILED", status: 422, title: `Peers must be 3 to 8 (this list has ${peers}).` });
  }
  const { data, error } = await admin().rpc("rpc_nominations_replace", {
    p_actor: a.userId, p_assessment: id, p_assignment: b.assignment_id, p_noms: raters.map((r) => ({ person_id: r.person_id, rater_group: r.rater_group })) as never,
  });
  if (error) return fromDbError(error.message);
  return json(data);
}
