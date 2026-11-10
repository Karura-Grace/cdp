import PDFDocument from "pdfkit";
import type { FullModel, Block, Chapter } from "./full-model";
import type { Model } from "./model";
import { LOGO_CDP, LOGO_COLOUR, LOGO_WHITE } from "./logos";
import { SERIF, SERIF_BOLD } from "./fonts";
import { INTER_800 } from "./fonts-inter";
import { ORDER, drawPdf, profiles, symbol } from "./pdf-graphics";
import { barsDrawing, type Prof, verdictColor, concentricDrawing, gaugeColor, gaugeDrawing, heatmapDrawing, mapDrawing, rangeDrawing, type O } from "../graphics/culture";

const INK = "#151c26", MUTED = "#51606f", GOLD = "#eb5733", LINE = "#d6dade", PALE = "#f1ece3", PAPER = "#FAF7F2", CARD = "#ffffff";   // cream paper, white cards (owner palette, Q-RD2)
const M = 56, PW = 595.28, PH = 841.89, W = PW - 2 * M, TOP = 70, BOTTOM = PH - 66;

// The full organisational report as a PDF in the shape of the PAC reference report: cover, report details, contents with page
// numbers, one chapter per page start with a numbered band, 11 pt body, drawn bar charts, tables, cards and callouts.
// The executive brief stays in pdf.ts. `m` gives the cover and footer lines shared with the brief.
export function buildFullPdf(f: FullModel, m: Model, staff = false, review = false): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: TOP, bottom: PH - BOTTOM, left: M, right: M }, bufferPages: true,
      info: { Title: `${f.org}: ${f.title}`, Author: "Priority Activator Consulting", Subject: f.trace, Keywords: m.trace } });   // versions and hashes live here, not on a page (owner Q-ER9)
    doc.registerFont("Serif", Buffer.from(SERIF, "base64")).registerFont("Serif-Bold", Buffer.from(SERIF_BOLD, "base64")).registerFont("Head", Buffer.from(INTER_800, "base64"));   // Inter for headings (website voice), serif for body (owner Q-RD5)
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c)).on("end", () => resolve(Buffer.concat(chunks))).on("error", reject);

    const room = (h: number) => { if (doc.y + h > BOTTOM) doc.addPage(); };
    let onH3: ((t: string) => void) | null = null;   // the contents page learns where each sub heading landed
    const text = (t: string, o: { size?: number; color?: string; bold?: boolean; gap?: number; x?: number; w?: number; justify?: boolean } = {}) => {
      doc.font(o.bold ? ((o.size ?? 11) >= 12 ? "Head" : "Serif-Bold") : "Serif").fontSize(o.size ?? 11).fillColor(o.color ?? INK);
      room(Math.min(doc.heightOfString(t, { width: o.w ?? W, lineGap: 3 }), 120));
      doc.text(t, o.x ?? M, doc.y, { width: o.w ?? W, lineGap: 3, align: o.justify ? "justify" : "left" });
      doc.moveDown(o.gap ?? 0.6);
    };
    const table = (head: string[], rows: string[][], cols: number[]) => {
      const draw = (cells: string[], bold: boolean, fill?: string) => {
        const hts = cells.map((c, i) => doc.font(bold ? "Serif-Bold" : "Serif").fontSize(9.5).heightOfString(c || " ", { width: cols[i] * W - 10 }));
        const h = Math.max(...hts) + 10;
        if (doc.y + h > BOTTOM) { doc.addPage(); if (!bold && head.some(Boolean)) draw(head, true, INK); }
        const y = doc.y;
        if (fill) doc.rect(M, y, W, h).fill(fill);
        let x = M;
        cells.forEach((c, i) => { doc.font(bold ? "Serif-Bold" : "Serif").fontSize(9.5).fillColor(bold ? "#ffffff" : INK).text(c, x + 5, y + 5, { width: cols[i] * W - 10 }); x += cols[i] * W; });
        doc.moveTo(M, y + h).lineTo(M + W, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
        doc.y = y + h;
      };
      room(60);
      if (head.some(Boolean)) draw(head, true, INK);
      rows.forEach((r, i) => draw(r, false, i % 2 ? PALE : undefined));
      doc.moveDown(0.8);
    };
    const bars = (b: Extract<Block, { bars: unknown }>["bars"]) => {
      const ch = 150; room(ch + 60);
      const top = doc.y + 8, base = top + ch, gw = (W - 30) / b.labels.length, bw = Math.min(26, (gw * 0.7) / b.series.length);
      Array.from({ length: Math.floor(b.max / 10) + 1 }, (_, i) => (i * 10) / b.max).forEach((t) => { const y = base - t * ch; doc.moveTo(M + 28, y).lineTo(M + W, y).strokeColor("#eceef1").lineWidth(0.5).stroke();
        doc.font("Serif").fontSize(7.5).fillColor("#8494a3").text(String(Math.round(t * b.max)), M, y - 3, { width: 22, align: "right" }); });
      b.labels.forEach((lab, i) => {
        const x0 = M + 30 + i * gw + (gw - bw * b.series.length - 4 * (b.series.length - 1)) / 2;
        b.series.forEach((s, j) => {
          const v = s.values[i]; if (!Number.isFinite(v)) return;
          const h = (Math.min(v, b.max) / b.max) * ch, x = x0 + j * (bw + 4);
          doc.rect(x, base - h, bw, h).fill(s.color);
          doc.font("Serif-Bold").fontSize(8).fillColor(INK).text(v.toFixed(0), x - 6, base - h - 11, { width: bw + 12, align: "center" });
        });
        doc.font("Serif").fontSize(9).fillColor(INK).text(lab, M + 30 + i * gw, base + 6, { width: gw, align: "center" });
      });
      let lx = M + 30; const ly = base + 22;
      b.series.forEach((s) => { doc.rect(lx, ly, 9, 9).fill(s.color); doc.font("Serif").fontSize(8.5).fillColor(MUTED).text(s.name, lx + 13, ly, { lineBreak: false }); lx += 90; });
      doc.y = ly + 16;
      if (b.note) text(b.note, { size: 8.5, color: MUTED });
      doc.moveDown(0.4);
    };
    const cards = (cs: [string, string, string][]) => {
      room(74);
      const y = doc.y, w = (W - (cs.length - 1) * 10) / cs.length;
      cs.forEach(([l, v, note], i) => {
        const x = M + i * (w + 10);
        doc.roundedRect(x, y, w, 64, 10).fill(CARD);
        doc.rect(x, y, w, 3).fill(GOLD);
        doc.font("Serif").fontSize(8.5).fillColor(MUTED).text(l, x + 8, y + 7, { width: w - 16, align: "center", height: 12, lineBreak: false, ellipsis: true });
        doc.font("Head").fontSize(17).fillColor(INK).text(v, x + 8, y + 21, { width: w - 16, align: "center", lineBreak: false });
        doc.font("Serif").fontSize(8).fillColor(MUTED).text(note, x + 8, y + 44, { width: w - 16, align: "center", height: 14, lineBreak: false, ellipsis: true });
      });
      doc.y = y + 76;
    };
    const callout = (t: string, label?: string) => {
      doc.font("Serif").fontSize(9.5);
      const h = doc.heightOfString(t, { width: W - 28, lineGap: 2 }) + (label ? 18 : 0) + 16;
      room(h + 10);
      const y = doc.y;
      doc.roundedRect(M, y, W, h, 8).fill("#fdf1ec"); doc.rect(M, y, 3, h).fill(GOLD);
      if (label) doc.font("Serif-Bold").fontSize(9).fillColor(GOLD).text(label.toUpperCase(), M + 14, y + 8);
      doc.font("Serif").fontSize(9.5).fillColor(INK).text(t, M + 14, y + (label ? 22 : 8), { width: W - 28, lineGap: 2 });
      doc.y = y + h + 10;
    };
    const block = (b: Block, next?: Block) => {
      if ("p" in b) text(b.p, { justify: true });
      else if ("h3" in b) { room(next && ("chart" in next || "grid" in next || "big3" in next || "dept" in next || "tiles" in next) ? 300 : 150); onH3?.(b.h3); doc.moveDown(0.3); text(b.h3, { size: 12.5, bold: true, gap: 0.35 }); }
      else if ("callout" in b) callout(b.callout);
      else if ("bullets" in b) { b.bullets.forEach((t) => text(`•  ${t}`, { gap: 0.25, x: M + 8, w: W - 8 })); doc.moveDown(0.4); }
      else if ("table" in b) table(b.table.head, b.table.rows, b.table.cols);
      else if ("bars" in b) bars(b.bars);
      else if ("cards" in b) cards(b.cards);
      else if ("ph" in b) { room(60); const y = doc.y + 4; symbol(doc, b.ph.o as "ENGAGE", M + 14, y + 14, 14); doc.font("Head").fontSize(15).fillColor(INK).text(b.ph.title, M + 38, y + 6, { width: W - 38 }); doc.y = y + 36; }
      else if ("gauges" in b) {
        const nG = b.gauges.length, gw = (W - 10 * (nG - 1)) / nG, dw = Math.min(gw - 20, 150), dh = dw * 96 / 150, ch = 32 + dh + 34; room(ch + 12); const gy = doc.y;
        b.gauges.forEach((g, i) => {
          const gx = M + i * (gw + 10);
          doc.roundedRect(gx, gy, gw, ch, 14).fillColor(CARD).fill(); doc.roundedRect(gx, gy, gw, 4, 2).fillColor(GOLD).fill();
          doc.font("Serif").fontSize(8.5).fillColor(MUTED).text(g.label, gx + 8, gy + 12, { width: gw - 16, align: "center", height: 22 });
          drawPdf(doc, gaugeDrawing(g.value, g.max, gaugeColor(g.value, g.max)), gx + (gw - dw) / 2, gy + 32, dw);
          doc.font("Head").fontSize(9).fillColor(INK).text(g.band, gx + 6, gy + 32 + dh + 4, { width: gw - 12, align: "center", height: 24 });
        });
        doc.y = gy + ch + 10;
      }
      else if ("pills" in b) {
        const nP = b.pills.length, pw = (W - 10 * (nP - 1)) / nP; room(84); const py = doc.y;
        b.pills.forEach((pl, i) => {
          const px = M + i * (pw + 10), col = verdictColor(pl.verdict);
          doc.roundedRect(px, py, pw, 70, 14).fillColor(CARD).fill(); doc.roundedRect(px, py, 5, 70, 2).fillColor(col).fill();
          doc.font("Serif").fontSize(8.5).fillColor(MUTED).text(pl.name, px + 14, py + 10, { width: pw - 22, height: 22 });
          doc.roundedRect(px + 14, py + 40, Math.min(pw - 28, pl.word.length * 6.4 + 22), 20, 10).fillColor(col).fillOpacity(0.14).fill().fillOpacity(1);
          doc.font("Head").fontSize(9).fillColor(col).text(pl.word.toUpperCase(), px + 14, py + 46, { width: Math.min(pw - 28, pl.word.length * 6.4 + 22), align: "center", lineBreak: false });
        });
        doc.y = py + 84;
      }
      else if ("range" in b) { const d = rangeDrawing(b.range.rows, b.range.aName, b.range.bName), hh = d.h * (W / d.w); room(hh + 10); const ry = doc.y; drawPdf(doc, d, M, ry, W); doc.y = ry + hh + 8; }
      else if ("heat" in b) { const d = heatmapDrawing(b.heat.rows, 480), hw = W, hh = d.h * (hw / d.w); room(hh + 10); const hy = doc.y; drawPdf(doc, d, M, hy, hw); doc.y = hy + hh + 8; }
      else if ("fig" in b) {
        // a graphic beside its words (owner Q-RF4): the figure on the left, the text on the right, so no page holds a graphic alone
        const need = b.text ? (b.prof ? 190 : 250) : 300; if (BOTTOM - doc.y < need) doc.addPage();
        const sz = b.prof ? 170 : b.text ? 226 : 280, fy = doc.y + 4, tx = M + sz + 16, tw = W - sz - 16;
        fig(b.fig, b.text ? M : M + (W - sz) / 2, fy, sz, b.prof);
        if (b.text) { let ty = fy + 6; for (const t of b.text) { doc.font("Serif").fontSize(10.5).fillColor(INK).text(t, tx, ty, { width: tw, lineGap: 3 }); ty = doc.y + 8; } doc.y = Math.max(fy + sz + 8, ty); }
        else doc.y = fy + sz + 8;
      }
      else if ("pb" in b) { if (doc.y > TOP + 80) doc.addPage(); }   // each priority starts its own page (owner Q-ER12)
      else if ("box" in b) callout(b.box.text, b.box.label);
      // ---- the chosen looks (owner picks Q-ER18 to Q-ER20, 30 Oct 2026), drawn as in CDP_Documents/J5-Report-Samples
      else if ("tiles" in b) {
        const nT = b.tiles.length, tw = (W - 10 * (nT - 1)) / nT, th = 92; room(th + 14); const ty = doc.y;
        b.tiles.forEach((t, i) => {
          const x = M + i * (tw + 10);
          doc.roundedRect(x, ty, tw, th, 14).fillColor(t.tone).fill();
          doc.font("Head").fontSize(t.value.length > 6 ? 20 : 26).fillColor("#ffffff").text(t.value, x, ty + 14, { width: tw, align: "center", lineBreak: false });
          doc.font("Serif-Bold").fontSize(8.5).text(t.label, x + 6, ty + 50, { width: tw - 12, align: "center" });
          doc.font("Serif").fontSize(7.5).text(t.note, x + 6, doc.y + 1, { width: tw - 12, align: "center", height: 20, ellipsis: true });
        });
        doc.y = ty + th + 14;
      }
      else if ("glance" in b) {
        const gh = 196; room(gh + 12); const gy = doc.y;
        doc.roundedRect(M, gy, W, gh, 16).fillColor(CARD).fill();
        drawPdf(doc, concentricDrawing(f.graphics.now, f.graphics.pref, 300), M + 8, gy + 8, 180);
        doc.font("Head").fontSize(12).fillColor(INK).text("The culture at a glance", M + 200, gy + 18, { width: W - 214 });
        doc.y = gy + 40;
        for (const t of b.glance) { doc.font("Serif").fontSize(9.5).fillColor(INK).text(`•  ${t}`, M + 200, doc.y, { width: W - 214, lineGap: 2 }); doc.moveDown(0.4); }
        doc.font("Serif").fontSize(7.5).fillColor(MUTED).text("Solid colour is Now; the dashed orange line is Preferred.", M + 200, gy + gh - 22, { width: W - 214 });
        doc.y = gy + gh + 14;
      }
      else if ("big3" in b) {
        // three columns, each with a coloured title pill, the text, and the key figure underlined at the foot (owner pick Q-ER18, 1A)
        const cw = (W - 20) / 3; doc.font("Serif").fontSize(9);
        const tx = Math.min(112, Math.max(...b.big3.map((x) => doc.heightOfString(x.text, { width: cw - 18, lineGap: 1.5 })))), fy = 84 + tx + 12, ph = fy + 44; room(ph + 12); const by = doc.y;
        doc.roundedRect(M, by, W, ph, 16).fillColor("#efe9df").fill();
        b.big3.forEach((x, i) => {
          const cx = M + 10 + i * cw, col = x.good ? "#2f8f4e" : "#c0392b";
          doc.font("Head").fontSize(9.5).fillColor(col).text(x.kind, cx + 8, by + 14, { width: cw - 16, lineBreak: false });
          doc.roundedRect(cx + 4, by + 32, cw - 12, 42, 12).fillColor(col).fill();
          doc.font("Head").fontSize(10).fillColor("#ffffff").text(x.title, cx + 14, by + 38, { width: cw - 32, height: 32, ellipsis: true });
          doc.font("Serif").fontSize(9).fillColor(INK).text(x.text, cx + 8, by + 84, { width: cw - 18, lineGap: 1.5, height: tx + 2, ellipsis: true });
          doc.rect(cx + 8, by + fy, cw - 24, 2).fillColor(GOLD).fill();
          doc.font("Head").fontSize(12).fillColor(INK).text(x.figure, cx + 8, by + fy + 10, { width: cw - 18, height: 30, ellipsis: true });
        });
        doc.y = by + ph + 14;
      }
      else if ("chart" in b) { const d = barsDrawing(b.chart.groups, b.chart.max, 520, 230, b.chart.step), hh = d.h * (W / d.w); room(hh + 44); legend(b.chart.legend); const cy = doc.y; drawPdf(doc, d, M, cy, W); doc.y = cy + hh + 8; }
      else if ("grid" in b) {
        // small charts two to a row (owner pick Q-ER19, 2B); a row never splits across pages
        const cw = (W - 12) / 2, d0 = barsDrawing(b.grid[0].groups, b.max, 300, 170), chh = (cw - 8) * d0.h / d0.w + 26;
        room(chh + 50); legend(b.legend);   // the legend stays with the first row
        for (let i = 0; i < b.grid.length; i += 2) {
          room(chh + 10); const y = doc.y;
          b.grid.slice(i, i + 2).forEach((c, k) => {
            const x = M + k * (cw + 12);
            doc.roundedRect(x, y, cw, chh, 12).fillColor(CARD).fill();
            doc.font("Head").fontSize(9.5).fillColor(INK).text(c.title, x + 10, y + 8, { width: cw - 20, lineBreak: false });
            drawPdf(doc, barsDrawing(c.groups, b.max, 300, 170), x + 4, y + 22, cw - 8);
          });
          doc.y = y + chh + 10;
        }
      }
      else if ("dept" in b) {
        // a department against the organisation, with what it means beside it (owner pick Q-ER20, 3A)
        const d = barsDrawing(b.dept.groups, b.dept.max, 480, 200), cwid = W * 0.6, hh = cwid * d.h / d.w, bw = W - cwid - 12;
        doc.font("Serif").fontSize(9);
        const th = doc.heightOfString(b.dept.text, { width: bw - 24, lineGap: 1.5 }) + 44, h = Math.max(hh, th);
        room(h + 30); const y = doc.y;
        doc.font("Head").fontSize(11.5).fillColor(INK).text(b.dept.title, M, y, { width: W });
        const y2 = y + 20;
        drawPdf(doc, d, M, y2, cwid);
        doc.roundedRect(M + cwid + 12, y2, bw, th, 12).fillColor(CARD).fill();
        doc.font("Head").fontSize(10).fillColor(b.dept.color).text(b.dept.head, M + cwid + 24, y2 + 12, { width: bw - 24 });
        doc.font("Serif").fontSize(9).fillColor(INK).text(b.dept.text, M + cwid + 24, doc.y + 4, { width: bw - 24, lineGap: 1.5 });
        doc.y = y2 + h + 12;
      }
      // ---- the remaining tables as cards, bars and chips (owner Q-ER24; Erick #72, #92, #193)
      else if ("check" in b) {
        const c = b.check, col = verdictColor(c.verdict), iw = W - 30;
        const hOf = (t: string, sz: number, w = iw) => { doc.font("Serif").fontSize(sz); return doc.heightOfString(t, { width: w, lineGap: 2 }); };
        const half = (iw - 10) / 2;
        const boxH = c.risk ? Math.max(hOf(c.risk, 9, half - 20), hOf(c.action, 9, half - 20)) + 30 : hOf(c.action, 9) + 30;
        const pat = c.pattern ? `${c.pattern.diagnosis} Questions for the debrief: ${c.pattern.prompts.join(" ")}` : "";
        const h = 40 + hOf(c.asks, 9) + c.result.reduce((a, t) => a + hOf(t, 10) + 6, 0) + boxH + 30 + (pat ? hOf(pat, 9) + 30 : 0);
        room(Math.min(h, BOTTOM - TOP - 20) + 12); const y = doc.y;
        doc.roundedRect(M, y, W, h, 14).fillColor(CARD).fill(); doc.roundedRect(M, y, 6, h, 3).fillColor(col).fill();
        doc.font("Head").fontSize(12).fillColor(INK).text(`${c.code} · ${c.name}`, M + 18, y + 14, { lineBreak: false });
        const ww = doc.font("Head").fontSize(9).widthOfString(c.word.toUpperCase()) + 20;
        doc.roundedRect(M + W - ww - 14, y + 11, ww, 20, 10).fillColor(col).fill();
        doc.fillColor("#ffffff").text(c.word.toUpperCase(), M + W - ww - 14, y + 17, { width: ww, align: "center", lineBreak: false });
        doc.font("Serif").fontSize(9).fillColor(MUTED).text(c.asks, M + 18, y + 36, { width: iw, lineGap: 2 });
        doc.y += 6;
        for (const t of c.result) { doc.font("Serif").fontSize(10).fillColor(INK).text(t, M + 18, doc.y, { width: iw, lineGap: 2, align: "justify" }); doc.y += 6; }
        const by = doc.y + 2;
        const box = (x: number, w: number, label: string, t: string, tone: string) => { const bh = boxH - 6; doc.roundedRect(x, by, w, bh, 10).fillColor(tone).fillOpacity(0.08).fill().fillOpacity(1);
          doc.font("Serif-Bold").fontSize(8.5).fillColor(tone).text(label.toUpperCase(), x + 10, by + 8, { width: w - 20 }); doc.font("Serif").fontSize(9).fillColor(INK).text(t, x + 10, by + 22, { width: w - 20, lineGap: 2 }); };
        if (c.risk) { box(M + 18, half, "Risk if not addressed", c.risk, "#c0392b"); box(M + 18 + half + 10, half, "Proposed intervention", c.action, "#2f8f4e"); }
        else box(M + 18, iw, "What to keep doing", c.action, "#2f8f4e");
        const cy = by + boxH + 2; let cx = M + 18;
        for (const t of [`Owner: ${c.owner}`, `Urgency: ${c.urgency}`]) { const tw = doc.font("Serif").fontSize(8.5).widthOfString(t) + 18; doc.roundedRect(cx, cy, tw, 18, 9).fillColor(PALE).fill(); doc.fillColor(INK).text(t, cx + 9, cy + 5, { lineBreak: false }); cx += tw + 8; }
        if (pat) { const py = cy + 28; doc.font("Serif-Bold").fontSize(9).fillColor(GOLD).text(`Pattern to explore: ${c.pattern!.name}`, M + 18, py, { width: iw }); doc.font("Serif").fontSize(9).fillColor(INK).text(pat, M + 18, doc.y + 2, { width: iw, lineGap: 2 }); }
        doc.y = y + h + 12;
      }
      else if ("hbars" in b) {
        const lw = W * 0.58, bw = W * 0.28, rows = b.hbars.rows;
        doc.font("Serif").fontSize(9.5);
        const hs = rows.map((r) => Math.max(doc.heightOfString(r.label, { width: lw, lineGap: 1.5 }), 12) + 8);
        room(hs.reduce((a, x) => a + x, 0) + 30); doc.font("Head").fontSize(10.5).fillColor(INK).text(b.hbars.title, M, doc.y); doc.y += 4;
        rows.forEach((r, i) => { const y = doc.y; doc.font("Serif").fontSize(9.5).fillColor(INK).text(r.label, M, y, { width: lw, lineGap: 1.5 });
          const yy = y + 2; doc.roundedRect(M + lw + 12, yy, bw, 9, 4.5).fillColor(PALE).fill();
          if (r.value !== null) doc.roundedRect(M + lw + 12, yy, Math.max(4, bw * Math.min(1, r.value / b.hbars.max)), 9, 4.5).fillColor(gaugeColor(r.value, b.hbars.max)).fill();
          doc.font("Head").fontSize(9.5).fillColor(INK).text(r.shown, M + lw + bw + 20, y, { width: W - lw - bw - 20, lineBreak: false }); doc.y = y + hs[i]; });
        doc.y += 8;
      }
      else if ("meters" in b) {
        const lw = W * 0.38, bw = W * 0.3;
        for (const m of b.meters) {
          room(30); const y = doc.y, col = m.ok ? "#2f8f4e" : "#c0392b";
          doc.font("Serif").fontSize(9.5).fillColor(INK).text(m.label, M, y, { width: lw, lineBreak: false });
          doc.font("Serif").fontSize(7.5).fillColor(MUTED).text(`target ${m.targetText}`, M, y + 12, { width: lw, lineBreak: false });
          const bx = M + lw + 8; doc.roundedRect(bx, y + 4, bw, 10, 5).fillColor(PALE).fill();
          doc.roundedRect(bx, y + 4, Math.max(4, bw * Math.min(1, m.value / m.max)), 10, 5).fillColor(col).fill();
          const tx = bx + bw * Math.min(1, m.target / m.max); doc.moveTo(tx, y).lineTo(tx, y + 18).strokeColor(INK).lineWidth(1.2).stroke();
          doc.font("Head").fontSize(10).fillColor(INK).text(m.shown, bx + bw + 10, y + 3, { width: 50, lineBreak: false });
          const word = m.ok ? "ON TARGET" : "NEEDS ATTENTION", cw2 = doc.font("Head").fontSize(8).widthOfString(word) + 16;
          doc.roundedRect(M + W - cw2, y + 2, cw2, 16, 8).fillColor(col).fill(); doc.fillColor("#ffffff").text(word, M + W - cw2, y + 6, { width: cw2, align: "center", lineBreak: false });
          doc.y = y + 28;
        }
        doc.font("Serif").fontSize(7.5).fillColor(MUTED).text("The dark tick on each bar is the target.", M, doc.y); doc.y += 10;
      }
      else if ("chips" in b) {
        let cx = M; room(30); let cy = doc.y; const TONE = { ok: "#2f8f4e", warn: "#b7791f", bad: "#c0392b" } as const;
        for (const c of b.chips) { const tw = doc.font("Head").fontSize(8.5).widthOfString(c.label) + 20; if (cx + tw > M + W) { cx = M; cy += 24; }
          doc.roundedRect(cx, cy, tw, 18, 9).fillColor(TONE[c.tone]).fill(); doc.fillColor("#ffffff").text(c.label, cx + 10, cy + 5, { lineBreak: false }); cx += tw + 8; }
        doc.y = cy + 30;
      }
      else if ("split" in b) {
        const tot = b.split.reduce((a, x) => a + x.count, 0) || 1; room(50); const y = doc.y; let x = M;
        for (const p of b.split) { const w = (W * p.count) / tot; if (w > 0) doc.rect(x, y, w, 16).fillColor(p.color).fill(); x += w; }
        doc.y = y + 22; legend(b.split.map((p) => [`${p.label}: ${p.count}`, p.color, false]));
      }
      else if ("actions" in b) {
        // compact numbered cards: the action on the left, when and owner as chips in a column on the right
        const tw = W - 210;
        b.actions.forEach((a, i) => {
          const t = `${a.recommended ? "Recommended. " : ""}${a.text}`; doc.font("Serif").fontSize(9.5);
          const h = Math.max(doc.heightOfString(t, { width: tw, lineGap: 1.5 }), 36) + 12;
          room(h + 6); const y = doc.y;
          doc.roundedRect(M, y, W, h, 10).fillColor(CARD).fill(); doc.circle(M + 18, y + 18, 10).fillColor(a.recommended ? GOLD : INK).fill();
          doc.font("Head").fontSize(10).fillColor("#ffffff").text(String(i + 1), M + 8, y + 13, { width: 20, align: "center" });
          doc.font("Serif").fontSize(9.5).fillColor(INK).text(t, M + 36, y + 7, { width: tw, lineGap: 1.5 });
          let cy = y + 7; const cx = M + 36 + tw + 12, cw = W - (cx - M) - 10;
          for (const c of [a.when, `Owner: ${a.owner}`]) { doc.roundedRect(cx, cy, cw, 16, 8).fillColor(PALE).fill(); doc.font("Serif").fontSize(8).fillColor(INK).text(c, cx + 8, cy + 4.5, { width: cw - 16, lineBreak: false, ellipsis: true }); cy += 20; }
          doc.y = y + h + 6;
        });
      }
    };
    const legend = (l: [string, string, boolean][]) => {
      room(40); let lx = M; const ly = doc.y;
      for (const [t, c, ghost] of l) {
        doc.font("Serif").fontSize(8.5); const w = doc.widthOfString(t) + 28;
        if (lx + w > M + W) { lx = M; doc.y += 14; }
        doc.roundedRect(lx, doc.y, 10, 10, 2).fillColor(c).fillOpacity(ghost ? 0.22 : 1).fill().fillOpacity(1);
        doc.fillColor(INK).text(t, lx + 14, doc.y + 1, { lineBreak: false }); lx += w;
      }
      doc.y = Math.max(doc.y, ly) + 18;
    };

    // ---------------------------------------------------------------- cover
    doc.rect(0, 0, PW, PH).fill(GOLD);   // Direction D cover: PAC orange with soft rounded shapes
    doc.fillOpacity(0.14).fillColor("#ffffff").circle(PW - 60, 150, 110).fill().circle(PW - 10, 420, 70).fill().circle(90, PH - 40, 130).fill().fillOpacity(1);
    if (m.coverColour) doc.rect(0, 0, PW, 14).fill(m.coverColour);   // client cover colour
    doc.image(Buffer.from(LOGO_WHITE, "base64"), M, 64, { width: 150 });
    doc.roundedRect(PW - M - 150, 52, 150, 74, 14).fillColor(PAPER).fill();
    doc.image(Buffer.from(LOGO_CDP, "base64"), PW - M - 150 + 15, 62, { width: 120 });
    doc.font("Head").fontSize(14).fillColor("#ffffff").text("Culture Dynamics Profile", M, 250);
    doc.font("Head").fontSize(34).fillColor("#ffffff").text(f.title, M, 280, { width: W });
    doc.font("Serif").fontSize(15).fillColor("#ffffff").text(f.org, M, doc.y + 14, { width: W });
    doc.fontSize(12).text(`Released ${m.released}`, M, doc.y + 6);
    if (m.clientLogo) {
      doc.roundedRect(M, 560, 240, 110, 8).fill("#ffffff");
      doc.image(Buffer.from(m.clientLogo.base64, "base64"), M + 16, 576, { fit: [208, 78], align: "center", valign: "center" });
    }
    doc.font("Serif").fontSize(11).fillColor("#ffffff").text("Presented by Priority Activator Consulting", M, 700);

    doc.on("pageAdded", () => { doc.save().rect(0, 0, PW, PH).fillColor(PAPER).fill().restore(); });
    // ---------------------------------------------------------------- report details and contents (page numbers filled in at the end)
    doc.addPage();
    doc.font("Head").fontSize(20).fillColor(INK).text("About this report", M, TOP);
    doc.moveDown(0.6);
    table(["", ""], [["Organisation", f.org], ["Report", f.title], ["Audience", m.audience || "Client leadership"], ["Released", m.released], ["Prepared by", "Priority Activator Consulting"], ["Classification", "Confidential"], ...(m.purpose ? [["Purpose", m.purpose]] : [])], [0.3, 0.7]);
    text("This report is confidential and is for the development of the organisation. It is never used to make decisions about individuals.", { size: 10, color: MUTED });
    // contents (owner Q-D7-1): every chapter with a number tile, then its sub headings numbered 3.1, 3.2 ... with dotted leaders and page numbers
    const SKIP_SUB = /^(in short|consultant|priority|in plain words)/i;
    // sub headings stop at the closing advice block: the items inside it are advice titles, not sections
    const subsOf = (c: Chapter) => { if (!c.num || c.num === "ES") return []; const out: string[] = []; for (const b of c.blocks) { if (!("h3" in b)) continue; if (/^what this means and what to do/i.test(b.h3)) { out.push("What this means and what to do"); break; } if (!SKIP_SUB.test(b.h3)) out.push(b.h3); } return out; };
    const tocRows = f.chapters.reduce((a, c) => a + 1 + subsOf(c).length, 0);
    const tocPages = Math.max(1, Math.ceil((tocRows * 17 + 120) / (BOTTOM - TOP - 20)));
    doc.addPage();
    const tocPage = doc.bufferedPageRange().count - 1;
    for (let i = 1; i < tocPages; i++) doc.addPage();
    const subPages = new Map<string, number[]>();
    const starts: { c: Chapter; page: number }[] = [];
    const graphicPages = new Set<number>();
    const glance = () => { doc.addPage(); graphicPages.add(doc.bufferedPageRange().count - 1); };
    const sentence = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    const pr = profiles(m), INF = f.infographic, STONE = (m.map.stone as O | null) ?? null;
    const fig = (kind: "now" | "pref" | "move" | "chart", x: number, y: number, w: number, prof?: { now: Prof; pref: Prof }) => drawPdf(doc, kind === "chart" ? concentricDrawing((prof ?? pr).now, (prof ?? pr).pref, 300) : mapDrawing(kind, (prof ?? pr).now, (prof ?? pr).pref, prof ? null : STONE, 300), x, y, w);
    const heading = (t: string, sub: string) => { doc.font("Head").fontSize(20).fillColor(INK).text(t, M, TOP); doc.font("Serif").fontSize(10.5).fillColor(MUTED).text(sub, M, doc.y + 2, { width: W }); };
   // Two full pages, graphics beside their words (owner Q-RF4): the glance (the move map with the headline measures beside it, the concentric chart with the four orientations
    // beside it) and the journey (Now and Preferred side by side, then the three actions).
    // the glance now sits inside the executive summary (Erick #1); the journey page follows the summary
    const glancePages = () => {
    glance();
    heading("The journey", "Where we are, the move we want to make, and the actions that make it.");
    fig("now", M, 108, W / 2 - 6); fig("pref", M + W / 2 + 6, 108, W / 2 - 6);
    doc.font("Head").fontSize(10.5).fillColor(INK).text("Now", M, 108 + W / 2 - 4, { width: W / 2 - 6, align: "center", lineBreak: false }).text("Preferred", M + W / 2 + 6, 108 + W / 2 - 4, { width: W / 2 - 6, align: "center", lineBreak: false });
    doc.font("Serif").fontSize(9).fillColor(MUTED).text(STONE ? `The move from Now to Preferred runs along the axes, through the stepping stone ${STONE.charAt(0) + STONE.slice(1).toLowerCase()}.` : "The move from Now to Preferred runs along the axes.", M, 108 + W / 2 + 16, { width: W, align: "center" });
    doc.font("Head").fontSize(13).fillColor(INK).text("Three actions that make the move", M, 412);
    (INF.actions.length ? INF.actions : [{ objective: "The actions appear here once the action plan is built.", intervention: "" }]).forEach((a, i) => {
      const y = 440 + i * 80;
      doc.roundedRect(M, y, W, 68, 14).fillColor(CARD).fill(); doc.circle(M + 34, y + 34, 18).fillColor(GOLD).fill();
      doc.font("Head").fontSize(16).fillColor("#ffffff").text(String(i + 1), M + 16, y + 26, { width: 36, align: "center" });
      doc.font("Serif-Bold").fontSize(11).fillColor(INK).text(sentence(a.objective), M + 66, y + 10, { width: W - 86, lineBreak: false, ellipsis: true });
      if (a.intervention) doc.font("Serif").fontSize(9).fillColor(MUTED).text(a.intervention, M + 66, y + 27, { width: W - 86, height: 36, ellipsis: true });
    });
    };

    // ---------------------------------------------------------------- chapters
    // Part openers (owner pick Q-J5-9: section dividers with a symbol): a soft panel with the part and its orientation symbol above the chapter band, so the length stays in range
    const PARTS: Record<string, [string, string]> = { current: ["Part 1", "The culture now and the gap"], checks: ["Part 2", "Does the culture support the strategy"], perception: ["Part 3", "What the groups say"],
      readiness: ["Part 4", "Readiness, risk and employee voice"], departments: ["Part 5", "Sub cultures and leadership"], meaning: ["Part 6", "What this means and what to do next"], kpis: ["Part 7", "Next steps"] };
    const partSymbol = (n: number) => ORDER[(n - 1) % 4];
    for (const c of f.chapters) {
      const opener = !!c.num;
      // continuous flow (owner critique 26 Oct 2026: page gaps): only the summary, the parts and the first appendix start a page; every other chapter follows on, keeping its band with the text under it
      doc.addPage();
      starts.push({ c, page: doc.bufferedPageRange().count - 1 });
      { const seen: number[] = []; subPages.set(c.key, seen); const want = subsOf(c); let k = 0; onH3 = (t) => { if (k < want.length && t === want[k]) { seen.push(doc.bufferedPageRange().count - 1); k++; } }; }
      if (PARTS[c.key]) { const [pn, pt] = PARTS[c.key], py = doc.y; doc.roundedRect(M, py, W, 70, 16).fillColor(CARD).fill(); doc.font("Serif-Bold").fontSize(9).fillColor(GOLD).text(pn.toUpperCase(), M + 20, py + 16); doc.font("Head").fontSize(17).fillColor(INK).text(pt, M + 20, py + 31, { width: W - 110 }); symbol(doc, partSymbol(Number(pn.slice(5))), M + W - 40, py + 35, 24); doc.y = py + 86; }
      const y = doc.y;
      if (opener) {
        doc.roundedRect(M, y, 58, 42, 8).fillColor(GOLD).fill(); doc.roundedRect(M + 64, y, W - 64, 42, 8).fillColor(INK).fill();
        doc.font("Head").fontSize(16).fillColor("#ffffff").text(c.num, M, y + 12, { width: 58, align: "center" });
        doc.fontSize(13.5).text(c.title.replace(/^Appendix [A-Z]\. /, "").toUpperCase(), M + 80, y + 14, { width: W - 92, lineBreak: false });
        doc.y = y + 56;
      } else { doc.rect(M, y, 4, 22).fill(GOLD); doc.font("Head").fontSize(15).fillColor(INK).text(c.title, M + 14, y + 3); doc.moveDown(0.5); }
      text(c.lead, { size: 11.5, color: MUTED, gap: 0.9 });
      c.blocks.forEach((b, i) => block(b, c.blocks[i + 1]));
      if (c.consultant?.trim()) callout(c.consultant.trim(), "Consultant's note");
      if (c.key === "summary" && !staff) glancePages();
    }

    // ---------------------------------------------------------------- contents
    const range = doc.bufferedPageRange();
    // draw rows across the reserved pages
    let tp = tocPage, ty = TOP;
    doc.switchToPage(tp);
    doc.font("Head").fontSize(34).fillColor(INK).text("Table of", M, ty, { lineBreak: false }).text("Contents", M, ty + 38, { lineBreak: false });
    doc.rect(M, ty + 84, 64, 4).fillColor(GOLD).fill();
    ty += 108;
    const rowRoom = (h: number) => { if (ty + h > BOTTOM) { tp++; doc.switchToPage(tp); ty = TOP; } };
    const dots = (y: number, x1: number, x2: number) => { doc.save().dash(0.6, { space: 2.4 }).moveTo(x1, y).lineTo(x2, y).strokeColor("#b9bec6").lineWidth(0.6).stroke().undash().restore(); };
    for (const { c, page } of starts) {
      const main = !!c.num, appx = /^[A-Z]$/.test(c.num);
      if (!main) continue;
      rowRoom(30);
      doc.roundedRect(M, ty, 30, 20, 5).fillColor(c.num === "ES" || appx ? INK : GOLD).fill();
      doc.font("Head").fontSize(9.5).fillColor("#ffffff").text(c.num, M, ty + 5.5, { width: 30, align: "center", lineBreak: false });
      const title = c.title.replace(/^Appendix [A-Z]\. /, "").toUpperCase();
      doc.font("Head").fontSize(10.5).fillColor(INK).text(title, M + 42, ty + 5, { width: W - 100, lineBreak: false });
      doc.font("Head").fontSize(10.5).fillColor(INK).text(String(page), M + W - 40, ty + 5, { width: 40, align: "right", lineBreak: false });
      ty += 26;
      const pages = subPages.get(c.key) ?? [], n0 = c.num.replace(/^0+/, "");
      subsOf(c).forEach((t, k) => {
        rowRoom(17);
        const label = `${n0}.${k + 1}  ${t}`;
        doc.font("Serif").fontSize(9.5).fillColor(MUTED);
        const tw = Math.min(W - 92, doc.widthOfString(label));
        doc.text(label, M + 42, ty, { width: W - 92, lineBreak: false, ellipsis: true });
        dots(ty + 8, M + 42 + tw + 6, M + W - 46);
        doc.text(String(pages[k] ?? page), M + W - 40, ty, { width: 40, align: "right", lineBreak: false });
        ty += 16;
      });
      ty += 6;
    }

    // ---------------------------------------------------------------- header, mark and footer on every page but the cover
    for (let i = 1; i < range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.image(Buffer.from(LOGO_COLOUR, "base64"), M + W - 70, 24, { width: 70 });
      if (m.clientLogo) doc.image(Buffer.from(m.clientLogo.base64, "base64"), M + W - 70 - 14 - 64, 22, { fit: [64, 24], align: "right", valign: "center" });
      doc.font("Serif").fontSize(8).fillColor(MUTED).text(`${f.org} · ${f.title}`, M, 34, { width: W - (m.clientLogo ? 170 : 90), lineBreak: false });
      if (!graphicPages.has(i) && !review) doc.save().fillOpacity(0.05).fillColor(INK).font("Head").fontSize(60).rotate(-40, { origin: [297, 421] }).text("CONFIDENTIAL", 40, 390, { width: 520, align: "center", lineBreak: false }).restore();
      doc.moveTo(M, PH - 50).lineTo(M + W, PH - 50).strokeColor(GOLD).lineWidth(0.6).stroke();
      doc.font("Serif").fontSize(8).fillColor(MUTED).text(`Confidential. ${m.footer}`, M, PH - 42, { width: W - 70, lineBreak: false });
      doc.text(`Page ${i} of ${range.count - 1}`, M + W - 70, PH - 42, { width: 70, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
