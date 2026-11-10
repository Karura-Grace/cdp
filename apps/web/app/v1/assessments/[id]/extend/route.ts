import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor, readJson } from "@/lib/staff";
import { loadCalendar } from "@/lib/launch-checks";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST { working_days, reason }: extend the survey window (S2.6.2-005 to 007, N2.11.3-EXT). The PAC Consultant on the engagement or a Super Admin may
// extend as often as needed, by 1 to 365 working days, with a reason (owner ruling 22 Oct 2026: the platform does not control this).
// Every extension is recorded (public.window_extension, insert only), moves the close date of open links, and is audited.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in first." });
  // the row is read with the service role: a Super Admin (the engagement lead for now) is not on the engagement, so RLS hides it; the role checks below decide
  const { data: asm } = await admin().from("assessment").select("assessment_id, tenant_id, engagement_id, status, frozen_at, window_close").eq("assessment_id", id).maybeSingle();
  if (!asm) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const [{ data: role }, { data: scope }] = await Promise.all([
    a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id }),
    a.db.rpc("rpc_actor_scope"),
  ]);
  const isLead = (scope as { role: string | null } | null)?.role === "SUPER_ADMIN";
  if (role !== "PAC_CONSULTANT" && !isLead) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (asm.status !== "LAUNCHED" || asm.frozen_at || !asm.window_close) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Only an open survey can be extended." });

  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const days = Number(b.working_days), reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!Number.isInteger(days) || reason.length < 3 || reason.length > 1000) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Give 1 to 365 working days and a reason." });
  const db = admin();
  const bad = E.checkExtension(days);
  if (bad) return problem(bad);

  const cal = await loadCalendar(db, asm.tenant_id);
  const newDay = E.addWorkingDays(asm.window_close.slice(0, 10), days, cal.holidays.map((h) => h.day));
  const newClose = `${newDay}${asm.window_close.slice(10)}`;
  const { data: seq, error } = await db.rpc("rpc_extend_window", { p_assessment_id: id, p_new_close: newClose, p_working_days: days, p_reason: reason,
    p_requested_by: a.userId, p_approved_by: null as unknown as string });
  if (error) return fromDbError(error.message);
  await audit(asm.tenant_id, a.userId, `assessment.window_extended:${seq}:${days}wd`, "assessment", id);
  return json({ assessment_id: id, extension: seq, window_close: newClose }, 201);
}
