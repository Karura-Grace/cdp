import ExcelJS from "exceljs";
import * as E from "@pac/cdp-engine";
import { AXES, AXIS_LABEL, frozenScored, type Axis } from "./segments";
import { ORIENTATIONS, ORIENT_NAME } from "./format";

type Prof = Record<string, string>;
type Metrics = { n: number; now: Prof; sdi: string; readiness: { d8: string | null }; eos_index: string | null; subculture: E.SubcultureResult };

/** Every segment view of the frozen score as one workbook, with the counts behind each number. Groups under the floor, or hidden by
 *  differencing protection, appear as "below reporting threshold" with no count. Same hash check as the screens (frozenScored). */
export async function segmentWorkbook(assessmentId: string, engagementId: string, frozen: boolean) {
  const f = await frozenScored(assessmentId, engagementId, frozen);
  if (!f.ok) return f;
  const { s, sc } = f;
  const wb = new ExcelJS.Workbook();
  const head = wb.addWorksheet("About");
  head.addRows([["Culture results by group"], [`Score version ${sc.version}`], [`Payload hash ${sc.payload_hash}`],
    [`Groups with fewer than ${E.config.get("segments.floor")} responses are not shown. Counts are valid responses.`]]);
  head.getColumn(1).width = 90;
  for (const axis of AXES as readonly Axis[]) {
    const ws = wb.addWorksheet(AXIS_LABEL[axis].slice(0, 31));
    ws.addRow([AXIS_LABEL[axis], "Responses", ...ORIENTATIONS.map((o) => ORIENT_NAME[o]), "SDI", "Verdict", "Safety (D8)", "eOS index"]).font = { bold: true };
    for (const c of E.toJsonable(E.heatmap(s.scored, axis, s.obj)) as { value: string; n: number | null; suppressed: boolean; metrics?: Metrics }[]) {
      if (c.suppressed || !c.metrics) { ws.addRow([c.value, "below reporting threshold"]); continue; }
      const m = c.metrics, sub = m.subculture;
      ws.addRow([c.value, c.n, ...ORIENTATIONS.map((o) => Number(m.now[o])), Number(m.sdi),
        sub.is_subculture ? (sub.significance === "CONFIRMED" ? "Sub-culture (confirmed)" : "Indicative") : "", m.readiness.d8 ? Number(m.readiness.d8) : "", m.eos_index ? Number(m.eos_index) : ""]);
    }
    ws.columns.forEach((col) => { col.width = 18; });
  }
  return { ok: true as const, buffer: Buffer.from(await wb.xlsx.writeBuffer()), version: sc.version };
}
