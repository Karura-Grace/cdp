import { requireServiceForAssessment } from "@/lib/services";
import * as E from "@pac/cdp-engine";
import { consultantOnAssessment } from "@/lib/staff";
import { json, problem } from "@/lib/problem";
import { AXES, segmentView, type Axis } from "@/lib/segments";

export const runtime = "nodejs";

// GET /v1/assessments/{id}/segments?axis=department[&parent_axis=grade&parent_value=Manager]
// Heatmap of one axis over the frozen set (see lib/segments.ts). 409 BELOW_REPORTING_THRESHOLD with the roll-up when the
// parent group is under the floor. PAC Consultant on the engagement only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "GROUP_RESULTS"); if (svcOff) return svcOff;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const q = new URL(req.url).searchParams;
  const axis = q.get("axis") as Axis | null;
  const pAxis = q.get("parent_axis") as Axis | null;
  const pValue = q.get("parent_value");
  if (!axis || !AXES.includes(axis)) return problem({ code: "VALIDATION_FAILED", status: 422, title: `axis must be one of ${AXES.join(", ")}.` });
  if ((pAxis === null) !== (pValue === null) || (pAxis && (!AXES.includes(pAxis) || pAxis === axis)) || (pValue !== null && (pValue.length < 1 || pValue.length > 120))) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "parent_axis and parent_value go together, and the parent axis must differ from the axis." });
  }
  const v = await segmentView(id, g.asm.engagement_id, !!g.asm.frozen_at, g.a.userId, axis, pAxis, pValue);
  if (!v.ok) return problem({ code: v.code, status: v.status, title: v.title, rule: v.rule, minimum: v.minimum, rollup: v.rollup });
  return json({ axis: v.axis, parent: v.parent, score_version: v.score_version, payload_hash: v.payload_hash, floor: v.floor, cells: E.toJsonable(v.cells) });
}
