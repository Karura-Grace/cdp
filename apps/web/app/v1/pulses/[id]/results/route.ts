import { requireServiceForPulse } from "@/lib/services";
import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { scoringClient } from "@/lib/supabase/scoring";
import { consultantOnPulse } from "@/lib/pulse";
import { followEvent } from "@/lib/lifecycle";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

type Json = Record<string, unknown>;

// POST: reads the closed pulse's answers through the one read path, compares them with the baseline on the same items, stores the
// aggregate once and raises a PULSE_MOVEMENT trigger for each movement over the thresholds. Below the reporting floor only the counts
// are stored and nothing is shown. A pulse whose window has passed is closed first. Results are INDICATIVE and never replace an assessment.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForPulse(id, "PULSE"); if (svcOff) return svcOff;
  const c = await consultantOnPulse(req, id);
  if (c instanceof Response) return c;
  const db = admin();
  const { pulse } = c;

  if (pulse.status === "OPEN" && pulse.closes_at && new Date(pulse.closes_at) <= new Date()) {
    const r = await db.rpc("rpc_pulse_close", { p_actor: c.a.userId, p_pulse: id });
    if (r.error) return fromDbError(r.error.message);
  } else if (pulse.status !== "CLOSED") {
    return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Close the pulse before its results are read." });
  }
  const done = await db.from("pulse_result").select("pulse_id").eq("pulse_id", id).maybeSingle();
  if (done.data) return json({ stored: false, note: "The result is already stored." });

  const counts = (await db.rpc("rpc_pulse_counts", { p_pulse: id })).data as { invited: number; submitted: number };
  const { data: pri } = await db.from("priority").select("orientation").eq("assessment_id", pulse.assessment_id).eq("score_version", pulse.score_version).eq("priority_id", pulse.priority_id).single();
  const { data: rows, error } = await scoringClient().rpc("rpc_closed_pulse_set", { p_pulse: id, p_floor: E.config.get("segments.floor") });

  let reading: Json | null = null;
  let triggers: { type: string; ref: string }[] = [];
  if (error) {
    if (!error.message.includes("BELOW_REPORTING_THRESHOLD")) return fromDbError(error.message);
  } else {
    const now = E.pulseReading(rows as unknown as E.PulseAnswers[], pulse.items, pri!.orientation as E.Orientation);
    const base = (pulse.baseline_json as unknown as { reading: E.PulseReading; n: Record<string, number> });
    const [b, n] = E.commonReading(base.reading, now.reading);
    triggers = E.pulseTriggers(b, n);
    reading = { label: "INDICATIVE", baseline: base.reading, current: E.toJsonable(now.reading), baseline_n: base.n, current_n: now.n, movement: triggers.map((t) => t.ref) } as Json;
    for (const t of triggers) {
      const r = await db.rpc("rpc_trigger_raise", { p_actor: c.a.userId, p_engagement: pulse.engagement_id, p_type: t.type, p_ref: `${t.ref} (${pulse.review_point})` });
      if (r.error) return fromDbError(r.error.message);
    }
  }
  const stored = await db.rpc("rpc_pulse_result_store", { p_actor: c.a.userId, p_pulse: id, p_invited: counts.invited, p_responded: counts.submitted, p_reading: reading as never, p_triggers: triggers as never });
  if (stored.error) return fromDbError(stored.error.message);
  await followEvent(pulse.engagement_id, "IMPLEMENTATION", "PULSE");   // back to implementation once no pulse is waiting for its results
  return json({ stored: stored.data, suppressed: reading === null, responded: counts.submitted, triggers: triggers.length }, 201);
}
