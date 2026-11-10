import { requireServiceForAssessment } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor, readJson } from "@/lib/staff";
import { raterWindowErrors } from "@/lib/rater-window";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";
const forbidden = () => problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });

// Rater window per leader (owner decision, 18 October 2026): the dates between which the raters of one leader may answer.
//   GET                                                    the windows set for this assessment (consultant, Client Admin, People Leader in scope: RLS decides)
//   PUT { assignment_id, opens_on, closes_on }            set or replace one leader's window. null for both clears it.
// The window must sit inside the assessment window. PAC Consultant on the engagement or the tenant's Client Admin, before the data is frozen.
// Links are issued only inside the window and expire at its close (see l360/invitations); a change here does not alter links already issued.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data, error } = await a.db.from("rater_window").select("assignment_id, opens_on, closes_on").eq("assessment_id", id);
  return error ? fromDbError(error.message) : json(data);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const db = admin();
  const { data: asm } = await db.from("assessment").select("assessment_id, tenant_id, engagement_id, status, frozen_at, window_open, window_close").eq("assessment_id", id).maybeSingle();
  if (!asm) return forbidden();
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PAC_CONSULTANT" && role !== "CLIENT_ADMIN") return forbidden();
  if (asm.frozen_at || !["DRAFT", "LAUNCHED"].includes(asm.status)) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Rater windows can be set while the assessment is a draft or open." });
  const b = await readJson(req, 2048);
  if (b instanceof Response) return b;
  if (typeof b.assignment_id !== "string") return problem({ code: "VALIDATION_FAILED", status: 422, title: "assignment_id is required." });
  const { data: la } = await db.from("leader_assignment").select("assignment_id").eq("assignment_id", b.assignment_id).eq("tenant_id", asm.tenant_id).maybeSingle();
  if (!la) return problem({ code: "VALIDATION_FAILED", status: 422, title: "That leader is not part of this organisation." });

  if (b.opens_on === null && b.closes_on === null) {
    const del = await db.from("rater_window").delete().eq("assessment_id", id).eq("assignment_id", b.assignment_id);
    if (del.error) return fromDbError(del.error.message);
    await audit(asm.tenant_id, a.userId, "l360.rater_window_cleared", "leader_assignment", b.assignment_id);
    return json({ assignment_id: b.assignment_id, opens_on: null, closes_on: null });
  }
  const errors = raterWindowErrors({ opens_on: b.opens_on, closes_on: b.closes_on }, asm.window_open, asm.window_close);
  if (errors.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: errors[0], errors });
  const up = await db.from("rater_window").upsert({
    assessment_id: id, assignment_id: b.assignment_id, tenant_id: asm.tenant_id, opens_on: b.opens_on as string, closes_on: b.closes_on as string, created_by: a.userId, updated_by: a.userId,
  }, { onConflict: "assessment_id,assignment_id" });
  if (up.error) return fromDbError(up.error.message);
  await audit(asm.tenant_id, a.userId, `l360.rater_window_set:${b.opens_on}/${b.closes_on}`, "leader_assignment", b.assignment_id);
  return json({ assignment_id: b.assignment_id, opens_on: b.opens_on, closes_on: b.closes_on });
}
