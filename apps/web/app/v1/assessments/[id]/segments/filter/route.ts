import { requireServiceForAssessment } from "@/lib/services";
import { consultantOnAssessment } from "@/lib/staff";
import { json, problem } from "@/lib/problem";
import { parseFilter, segmentFilter } from "@/lib/segments";

export const runtime = "nodejs";

// GET /v1/assessments/{id}/segments/filter?p=department:Finance&p=grade:Manager[&count_only=1]
// AND of up to three cuts. count_only gives the live count for the filter builder: the number when the group meets the floor,
// otherwise only { below: true } ("fewer than 5"). Without count_only the group's results come back, or 409
// BELOW_REPORTING_THRESHOLD with the roll-up. PAC Consultant on the engagement only; every query is logged.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "GROUP_RESULTS"); if (svcOff) return svcOff;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const q = new URL(req.url).searchParams;
  const filter = parseFilter(q.getAll("p"));
  if (!filter) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send one to three different cuts as p=axis:value." });
  const v = await segmentFilter(id, g.asm.engagement_id, !!g.asm.frozen_at, g.a.userId, filter, q.get("count_only") === "1");
  if (!v.ok) return problem({ code: v.code, status: v.status, title: v.title, rule: v.rule, minimum: v.minimum, rollup: v.rollup });
  if (v.below) return json({ below: true, label: `fewer than ${v.floor}`, score_version: v.score_version, payload_hash: v.payload_hash });
  return json({ below: false, count: v.count, metrics: v.metrics, score_version: v.score_version, payload_hash: v.payload_hash });
}
