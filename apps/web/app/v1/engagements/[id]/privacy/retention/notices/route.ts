import { audit } from "@/lib/audit";
import { consultantOnEngagement } from "@/lib/staff";
import { sendRetentionNotices } from "@/lib/retention";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Sends the 90 and 30 day notices that are due. No scheduled job or service key route exists in the app yet, so this is the consultant's call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const r = await sendRetentionNotices(id);
  if (!r.ok) return r.reason === "NOT_SCHEDULED"
    ? problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "No retention schedule exists for this engagement." })
    : problem({ code: "UNAVAILABLE", status: 503, title: "Email is not configured, so no notice was sent." });
  if (r.sent.length) await audit(g.eng.tenant_id, g.a.userId, `retention.notice_sent:${r.sent.join("+")}`, "engagement", id);
  return json(r);
}
