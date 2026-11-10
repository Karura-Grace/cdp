import { audit } from "@/lib/audit";
import { consultantOnEngagement } from "@/lib/staff";
import { scheduleRetention } from "@/lib/retention";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Writes the retention schedule from the assessment's window close (spec 1.4.5). Repeating it changes nothing.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const r = await scheduleRetention(id);
  if (!r.ok) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: r.reason === "NO_ASSESSMENT" ? "Create the assessment first." : "The assessment has no survey window close date." });
  if (r.created) await audit(g.eng.tenant_id, g.a.userId, "retention.scheduled", "engagement", id);
  return json({ ...r.schedule, created: r.created }, r.created ? 201 : 200);
}
