import PDFDocument from "pdfkit";
import type { Model } from "./model";
import type { FullModel } from "./full-model";
import { LOGO_COLOUR, LOGO_WHITE } from "./logos";
import { SERIF, SERIF_BOLD } from "./fonts";
import { plotAt, routeVia } from "../culture-map";

const INK = "#151c26", MUTED = "#51606f", GOLD = "#eb5733", LINE = "#d6dade";
const M = 50, W = 595.28 - 2 * M, BOTTOM = 842 - 70;

// The PAC house serif (Gelasio, a Georgia match) is embedded from ./fonts. It covers Latin and extended Latin; anything outside it
// would drop out, which does not matter for consultant prose.
export function buildPdf(m: Model, full?: FullModel | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: `${m.org}: ${m.title}`, Author: "Priority Activator Consulting", Subject: m.trace, Keywords: m.trace } });
    doc.registerFont("Serif", Buffer.from(SERIF, "base64")).registerFont("Serif-Bold", Buffer.from(SERIF_BOLD, "base64"));
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c)).on("end", () => resolve(Buffer.concat(chunks))).on("error", reject);

    const room = (h: number) => { if (doc.y + h > BOTTOM) doc.addPage(); };
    const h2 = (t: string) => { room(60); doc.moveDown(0.9).font("Serif-Bold").fontSize(14).fillColor(INK).text(t, M, doc.y, { width: W }); doc.moveDown(0.3); };
    const para = (t: string, o: { size?: number; color?: string; bold?: boolean } = {}) =>
      doc.font(o.bold ? "Serif-Bold" : "Serif").fontSize(o.size ?? 10.5).fillColor(o.color ?? INK).text(t, M, doc.y, { width: W });
    const table = (head: string[], rows: string[][], cols: number[]) => {
      const draw = (cells: string[], bold: boolean, fill?: string) => {
        const hts = cells.map((c, i) => doc.font(bold ? "Serif-Bold" : "Serif").fontSize(9.5).heightOfString(c, { width: cols[i] * W - 8 }));
        const h = Math.max(...hts) + 8;
        room(h);
        const y = doc.y;
        if (fill) doc.rect(M, y, W, h).fill(fill);
        let x = M;
        cells.forEach((c, i) => { doc.font(bold ? "Serif-Bold" : "Serif").fontSize(9.5).fillColor(bold ? "#706f6f" : INK).text(c, x + 4, y + 4, { width: cols[i] * W - 8 }); x += cols[i] * W; });
        doc.moveTo(M, y + h).lineTo(M + W, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
        doc.y = y + h;
      };
      draw(head, true, "#f4f5f7");
      rows.forEach((r) => draw(r, false));
    };

    // cover
    doc.rect(0, 0, 595.28, 842).fill(INK);
    if (m.coverColour) doc.rect(0, 0, 595.28, 14).fill(m.coverColour);   // client cover colour
    doc.image(Buffer.from(LOGO_WHITE, "base64"), M, 60, { width: 150 });
    doc.font("Serif-Bold").fontSize(14).fillColor(GOLD).text("Culture Dynamics Profile", M, 250);
    doc.font("Serif-Bold").fontSize(32).fillColor("#ffffff").text(m.title, M, 280, { width: W });
    doc.font("Serif").fontSize(14).fillColor("#c9d2dd").text(`${m.org}${m.audience ? " · " + m.audience : ""}`, M, doc.y + 12, { width: W });
    doc.text(`Released ${m.released}`, M, doc.y + 6);
    if (m.purpose) doc.fontSize(10).text(`Purpose: ${m.purpose}`, M, doc.y + 10, { width: W });
    if (m.clientLogo) {   // co branded: the client logo on a white panel, PAC as presenter
      doc.roundedRect(M, 560, 240, 110, 8).fill("#ffffff");
      doc.image(Buffer.from(m.clientLogo.base64, "base64"), M + 16, 576, { fit: [208, 78], align: "center", valign: "center" });
      doc.font("Serif").fontSize(11).fillColor("#c9d2dd").text("Presented by Priority Activator Consulting", M, 690);
    }
    doc.addPage();

    if (m.summary.length) {
      h2("Summary");
      for (const [h, body] of m.summary) { para(h, { bold: true, color: GOLD, size: 11 }); para(body); doc.moveDown(0.6); }
    }

    const st = m.story;
    const bullets = (xs: string[]) => xs.forEach((t) => para(`•  ${t}`, { size: 10 }));
    if (st) {
      h2("Executive summary: the culture scorecard");
      table(["Measure", "Value", "Reading"], st.tiles.map((t) => [t.label, t.value, t.note]), [0.35, 0.25, 0.4]);
      doc.moveDown(0.4); st.board.forEach((l) => { para(l); doc.moveDown(0.2); });
      h2("The Big Three");
      for (const b of st.big) { room(70); para(`${b.kind}: ${b.title}`, { bold: true, color: GOLD, size: 11 }); para(b.text); para(b.figure, { bold: true }); doc.moveDown(0.4); }
      h2("For the people team");
      st.people.forEach((l) => { para(l); doc.moveDown(0.2); });
    }
    if (!st) h2("Key figures");
    const y0 = doc.y, bw = W / 4;
    if (!st) m.kpis.forEach(([label, value, note], i) => {
      const x = M + i * bw;
      doc.roundedRect(x + 2, y0, bw - 4, 70, 6).strokeColor(LINE).lineWidth(0.8).stroke();
      doc.font("Serif").fontSize(8.5).fillColor(MUTED).text(label, x + 6, y0 + 8, { width: bw - 12, align: "center" });
      doc.font("Serif-Bold").fontSize(15).fillColor(INK).text(value, x + 6, y0 + 24, { width: bw - 12, align: "center" });
      doc.font("Serif-Bold").fontSize(8.5).fillColor(MUTED).text(note, x + 6, y0 + 50, { width: bw - 12, align: "center" });
    });
    if (!st) doc.y = y0 + 80;

    h2("Now versus preferred future");
    room(190);
    const cy = doc.y + 10, ch = 140, gw = W / 4, bwid = gw * 0.26;
    [0, 10, 20, 30, 40].forEach((t) => { const y = cy + ch - (t / 40) * ch; doc.moveTo(M + 22, y).lineTo(M + W, y).strokeColor("#eceef1").lineWidth(0.5).stroke(); doc.font("Serif").fontSize(7.5).fillColor("#8494a3").text(String(t), M, y - 3, { width: 18, align: "right" }); });
    m.profile.forEach((r, i) => {
      const x0 = M + 22 + i * ((W - 22) / 4) + gw * 0.12;
      const hn = (Math.min(r.nowN, 40) / 40) * ch, hp = (Math.min(r.prefN, 40) / 40) * ch;
      doc.rect(x0, cy + ch - hn, bwid, hn).fill(r.color);
      doc.rect(x0 + bwid + 5, cy + ch - hp, bwid, hp).fillAndStroke("#ffffff", r.color);
      doc.font("Serif-Bold").fontSize(9).fillColor(INK).text(r.now, x0 - 4, cy + ch - hn - 12, { width: bwid + 8, align: "center" });
      doc.fillColor(MUTED).text(r.preferred, x0 + bwid + 1, cy + ch - hp - 12, { width: bwid + 8, align: "center" });
      doc.fillColor(INK).text(r.name, x0 - 10, cy + ch + 6, { width: bwid * 2 + 25, align: "center" });
    });
    doc.y = cy + ch + 26;
    para("Solid bars: Now. Outlined bars: Preferred.", { size: 8.5, color: MUTED });
    doc.moveDown(0.4);
    table(["Orientation", "Now", "Preferred", "Gap", "Reading"], m.profile.map((r) => [r.name, r.now, r.preferred, r.gap, r.reading]), [0.25, 0.15, 0.17, 0.13, 0.3]);

    room(340);   // heading and map stay together
    h2("Culture map");
    {
      const half = 112, cx = M + W / 2, cy = doc.y + 18 + half, gap = 2, col: Record<string, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
      const sq: [string, number, number][] = [["ENGAGE", -1, -1], ["INNOVATE", 1, -1], ["PERFORM", 1, 1], ["GOVERN", -1, 1]];
      for (const [o, sx, sy] of sq) {
        const x0 = sx < 0 ? cx - half : cx + gap, y0 = sy < 0 ? cy - half : cy + gap, w = half - gap;
        doc.roundedRect(x0, y0, w, w, 4).fillColor(col[o]).fillOpacity(0.07).fill();
        doc.roundedRect(x0, y0, w, w, 4).strokeColor(col[o]).strokeOpacity(0.4).lineWidth(0.8).stroke();
        doc.fillOpacity(1).strokeOpacity(1).font("Serif-Bold").fontSize(8).fillColor(col[o]).text(o, x0 + (sx < 0 ? 6 : 0), sy < 0 ? y0 + 6 : y0 + w - 14, { width: w - 6, align: sx < 0 ? "left" : "right", lineBreak: false });
      }
      for (const r of [10, 20, 30]) { const d = (r / m.map.limit) * half; doc.rect(cx - d, cy - d, d * 2, d * 2).dash(1.5, { space: 2.5 }).strokeColor("#706f6f").strokeOpacity(0.3).lineWidth(0.5).stroke().undash(); }
      doc.strokeOpacity(0.4).moveTo(cx - half, cy).lineTo(cx + half, cy).moveTo(cx, cy - half).lineTo(cx, cy + half).strokeColor("#706f6f").lineWidth(0.5).stroke().strokeOpacity(1);
      doc.font("Serif-Bold").fontSize(7.5).fillColor(MUTED);
      doc.text("ADAPTIVE", cx - 40, cy - half - 14, { width: 80, align: "center", lineBreak: false }).text("STRUCTURED", cx - 40, cy + half + 5, { width: 80, align: "center", lineBreak: false });
      doc.save().rotate(-90, { origin: [cx - half - 8, cy] }).text("INWARD", cx - half - 8 - 40, cy - 4, { width: 80, align: "center", lineBreak: false }).restore();
      doc.save().rotate(90, { origin: [cx + half + 8, cy] }).text("OUTWARD", cx + half + 8 - 40, cy - 4, { width: 80, align: "center", lineBreak: false }).restore();
      const a = plotAt(m.map.now, cx, cy, half), b = plotAt(m.map.pref, cx, cy, half), route = routeVia(a, b, 7, m.map.stone, cx, cy), legs = route.legs;
      legs.forEach((ar, i) => {
        doc.moveTo(ar.from[0], ar.from[1]).lineTo(ar.to[0], ar.to[1]).strokeColor(GOLD).lineWidth(2).stroke();
        if (i < legs.length - 1) return;   // only the last leg carries the arrowhead
        const ang = Math.atan2(ar.to[1] - ar.from[1], ar.to[0] - ar.from[0]), hl = 7;
        doc.moveTo(ar.to[0], ar.to[1]).lineTo(ar.to[0] - hl * Math.cos(ang - 0.45), ar.to[1] - hl * Math.sin(ang - 0.45)).lineTo(ar.to[0] - hl * Math.cos(ang + 0.45), ar.to[1] - hl * Math.sin(ang + 0.45)).closePath().fillColor(GOLD).fill();
      });
      if (route.waypoint && m.map.stone) {
        const [wx, wy] = route.waypoint, name = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" }[m.map.stone as "ENGAGE"], txt = `via ${name}`;
        doc.circle(wx, wy, 4.5).fillColor("#ffffff").fill().circle(wx, wy, 4.5).strokeColor(GOLD).lineWidth(2).stroke();
        doc.fontSize(7.5).fillColor(INK).text(txt, wx - 30, wy + (wy < cy ? -15 : 8), { width: 60, align: "center", lineBreak: false });
      }
      for (const [xy, label, fill, ink, away] of [[a, "NOW", INK, "#ffffff", b[1] >= a[1]], [b, "PREFERRED", GOLD, INK, a[1] >= b[1]]] as const) {
        doc.circle(xy[0], xy[1], 5).fillColor(fill).fill().circle(xy[0], xy[1], 5).strokeColor("#ffffff").lineWidth(1.2).stroke();
        const lw = label.length * 4.9 + 10, ly = xy[1] + (away ? -19 : 8), lx = Math.min(Math.max(xy[0], cx - half - 40 + lw / 2), cx + half + 40 - lw / 2);
        doc.roundedRect(lx - lw / 2, ly, lw, 11, 5.5).fillColor(fill).fill();
        doc.font("Serif-Bold").fontSize(6.5).fillColor(ink).text(label, lx - lw / 2, ly + 2.6, { width: lw, align: "center", lineBreak: false });
      }
      doc.y = cy + half + 22;
    }
    para(m.map.note + (m.map.now.offScale || m.map.pref.offScale ? " A profile beyond the edge is drawn at the edge." : ""), { size: 8.5, color: MUTED });
    para(`Now sits ${m.map.now.xPts} inward to outward and ${m.map.now.yPts} structured to adaptive; preferred sits ${m.map.pref.xPts} and ${m.map.pref.yPts}. The four scores are in the table above.`, { size: 8.5, color: MUTED });

    if (st) {
      h2("Values against reality");
      table(["Orientation", "Espoused (D1)", "Lived (D4 and D6)", "Difference"], st.values, [0.25, 0.25, 0.25, 0.25]);
      if (st.entropy) {
        h2("Gap, tension and risk");
        table(["Measure", "Value", "Reading"], [["Cultural entropy", st.entropy[0], st.entropy[1]], ...st.tensions.map((t) => [t[0] + " tension", t[1], t[2]]),
          ...(st.spread ? [["Spread of answers", st.spread, "average standard deviation, points"]] : []), ...(st.risk ? [["Culture Risk Index", st.risk.index, st.risk.band + " risk"]] : [])], [0.4, 0.2, 0.4]);
        if (st.risk) { doc.moveDown(0.4); table(["Part of the Risk Index", "Reading"], st.risk.rows.map((r) => [r[0], r[2]]), [0.7, 0.3]); }
      }
    }
    h2("Executives and staff");
    const pr = m.perception.rows;
    if (pr) table(["Orientation", "Difference", "Flag"], pr, [0.35, 0.3, 0.35]); else para(m.perception.note ?? "");

    h2("Readiness for change");
    table(["Measure", "Score (1 to 5)", "Reading"], m.readiness, [0.35, 0.25, 0.4]);
    doc.moveDown(0.3); para(m.readinessNote, { size: 9, color: MUTED });

    if (st?.eos.length) { h2("Employee voice"); table(["Question", "Net score", "Signal"], st.eos, [0.6, 0.2, 0.2]); }
    if (st?.depts.length) { h2("Departments"); table(["Department", "Responses", "Leading", ...m.profile.map((r) => r.name)], st.depts, [0.2, 0.12, 0.16, 0.13, 0.13, 0.13, 0.13]); }
    if (m.checks.length) { h2("Checks against your strategy"); para(m.checks.join("     "), { bold: true }); }
    if (full?.checks.length) { h2("What the checks mean and what to do"); table(["Check", "Result", "What it means here", "Proposed intervention"], full.checks.map((c) => [c.name, c.word, c.result, c.action]), [0.16, 0.12, 0.36, 0.36]); }
    if (m.scenarios.length) {
      h2("Patterns to explore");
      for (const sc of m.scenarios) {
        room(90); para(`${sc.name} (${sc.severity})`, { bold: true, size: 11 }); para(sc.diagnosis);
        sc.hypotheses.forEach((h) => para(`•  ${h}`, { size: 9.5, color: MUTED })); doc.moveDown(0.5);
      }
    }
    if (st) {
      h2("Culture KPI scorecard");
      if (st.kpis.length) { table(["KPI", "Baseline", "12 month target", "3 year target"], st.kpis, [0.46, 0.18, 0.18, 0.18]); doc.moveDown(0.4); }
      table(["When", "What"], st.governance, [0.22, 0.78]);
      h2("From findings to action");
      if (st.quickWins.length) { para("The first 14 days", { bold: true, color: GOLD, size: 11 }); bullets(st.quickWins); doc.moveDown(0.4); }
      para("Change principles", { bold: true, color: GOLD, size: 11 }); bullets(st.principles);
      h2("Method and sample"); para(st.method);
      h2("Glossary"); table(["Term", "Meaning"], st.glossary, [0.28, 0.72]);
      doc.moveDown(0.5); para(st.ethics, { size: 8.5, color: MUTED });
    }

    const range = doc.bufferedPageRange();
    for (let i = 1; i < range.count; i++) {   // skip the cover
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;   // the footer sits below the bottom margin; without this pdfkit appends a blank page
      doc.image(Buffer.from(LOGO_COLOUR, "base64"), M + W - 70, 22, { width: 70 });
      doc.save().fillOpacity(0.05).fillColor(INK).font("Serif-Bold").fontSize(60).rotate(-40, { origin: [297, 421] }).text("CONFIDENTIAL", 40, 390, { width: 520, align: "center", lineBreak: false }).restore();
      doc.font("Serif").fontSize(8).fillColor(MUTED).text(`Confidential. ${m.footer}    Page ${i} of ${range.count - 1}`, M, 842 - 40, { width: W, align: "left", lineBreak: false });
    }
    doc.end();
  });
}
