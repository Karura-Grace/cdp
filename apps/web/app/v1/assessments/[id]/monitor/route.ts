import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { actor } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Response monitor (S2-15): invited, started and submitted by cohort, only for cohorts with at least five invited (AC-2.7), and a daily trend.
// Counts and rates only; never who has or has not responded. PAC Consultant and Client Admin on the engagement.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in first." });
  const { data: asm } = await a.db.from("assessment").select("engagement_id, window_close").eq("assessment_id", id).maybeSingle();
  const role = asm ? (await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id })).data : null;
  if (role !== "PAC_CONSULTANT" && role !== "CLIENT_ADMIN") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const { data, error } = await admin().rpc("rpc_cohort_counts", { p_assessment_id: id, p_floor: E.config.get("segments.floor") });
  if (error) return fromDbError(error.message);
  const { data: ext } = await admin().from("window_extension").select("seq, old_close, new_close, working_days, reason, created_at").eq("assessment_id", id).order("seq");
  const d = data as { cohorts: { invited: number; submitted: number }[] };
  return json({ ...d, cohorts: d.cohorts.map((c) => ({ ...c, rate: c.invited ? Math.round((c.submitted / c.invited) * 100) : 0 })), window_close: asm!.window_close, extensions: ext ?? [] });
}
