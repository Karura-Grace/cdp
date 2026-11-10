import { requireServiceForEngagement } from "@/lib/services";
import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { actor, consultantOnEngagement, readJson } from "@/lib/staff";
import { baselineOf, baselineReading, watchlistOf } from "@/lib/pulse";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// GET: the pulses of this engagement and any stored results. RLS decides who sees them (PAC team, client admin and executive).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForEngagement(id, "PULSE"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const [{ data: pulses }, { data: results }] = await Promise.all([
    a.db.from("pulse").select("pulse_id, priority_id, review_point, items, status, opens_at, closes_at, closed_at").eq("engagement_id", id).order("created_at", { ascending: false }),
    a.db.from("pulse_result").select("*").eq("engagement_id", id),
  ]);
  return json({ pulses: pulses ?? [], results: results ?? [] });
}

// POST { priority_id, review_point: "+90d" | "+180d", items: string[] }. The items must all be on that priority's watch-list and at most
// ten (engine validatePulse, 422 PULSE_INVALID). The baseline reading on the same items is taken from the frozen baseline.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForEngagement(id, "PULSE"); if (svcOff) return svcOff;
  const c = await consultantOnEngagement(req, id);
  if (c instanceof Response) return c;
  const b = await readJson(req, 4096);
  if (b instanceof Response) return b;
  const items = Array.isArray(b.items) && b.items.every((x) => typeof x === "string") ? (b.items as string[]) : null;
  if (typeof b.priority_id !== "string" || !items || !["+90d", "+180d"].includes(b.review_point as string)) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "priority_id, review_point (+90d or +180d) and items are required." });
  }
  const base = await baselineOf(id);
  if (!base) return problem({ code: "DATA_NOT_FROZEN", status: 409, title: "A pulse is built on a frozen baseline with a plan." });
  const w = watchlistOf(base.plan, b.priority_id);
  if (!w) return problem({ code: "VALIDATION_FAILED", status: 422, title: "That priority is not in the plan." });
  const errors = E.validatePulse(items, w.items);
  if (errors.length) return problem({ code: "PULSE_INVALID", status: 422, title: errors.join(". "), errors });

  const baseline = await baselineReading(base.assessmentId, items, w.orientation);
  const { data, error } = await admin().rpc("rpc_pulse_create", { p_actor: c.a.userId, p_assessment: base.assessmentId, p_score_version: base.scoreVersion,
    p_priority: b.priority_id, p_review_point: b.review_point as string, p_items: items, p_baseline: baseline as never });
  if (error) return fromDbError(error.message);
  return json({ pulse_id: data }, 201);
}
