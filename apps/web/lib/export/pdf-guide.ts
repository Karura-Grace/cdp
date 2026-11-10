// The staff guide on the template (SPEC group 4, 3; owner Q-D9-26): internal to PAC, plain and friendly. Page 1 runs the staff
// conversation (numbers to bring, the hour in four steps, what to avoid); then the three working sessions with the client and
// the questions the accepted advice gives the Culture Practitioner to explore. Numbers come from the frozen score object.
import type { LoadedReport } from "../report-data";
import type { Extras } from "../report-extras";
import type { Model } from "./model";
import { FACILITATION, NON_NEGOTIABLES } from "../report-library";
import { EOS_NAMES } from "../report-story";
import { clean } from "./full-model";
import { LOGO_COLOUR } from "./logos";
import { C, CW, GAP, HALF, LIMIT, TOP, X0, X1, frame, h2, icon, newDoc, num, paper, section, th, tw, tx } from "./pdf-kit";

const n = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));

export function buildStaffGuidePdf(l: LoadedReport, x: Extras, m: Model): Promise<Buffer> {
  const org = l.tenantName ?? "The organisation";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the frozen payload as stored
  const s = l.score as any;
  const doc = newDoc({ Title: `${org}: staff guide`, Subject: "Staff guide, internal to PAC", Keywords: m.trace });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", (c: Buffer) => chunks.push(c)).on("end", () => resolve(Buffer.concat(chunks))).on("error", reject); });
  const logo = Buffer.from(LOGO_COLOUR, "base64");
  paper(doc);
  const page = () => { doc.addPage(); paper(doc); };
  const secs = (l.rep.sections_json ?? {}) as Record<string, string>;
  const themes = (() => { try { return JSON.parse(String(secs.themes ?? "null")) as { n: number; items: { theme: string; share: number }[] } | null; } catch { return null; } })();
  const neg = EOS_NAMES.map((nm, i) => ({ nm, v: n(s.eos?.[`Q${i + 1}`]) })).filter((z) => z.v < 0).sort((p, q) => p.v - q.v);
  const nResp = n(s.counts?.now);

  // ================================================================ page 1: running the staff conversation
  let y = tx(doc, "Running the staff conversation", X0, TOP, { f: "I7", size: 14, lead: 18 }) + 8;
  y = tx(doc, `One hour with a department group of five or more, with no line manager in the room. Your job is to listen. The ${nResp} people who answered want to know they were heard.`, X0, y, { w: 400 }) + GAP;
  // numbers to bring: the voice scores below zero and the top comment theme
  const bring: [string, string][] = [...neg.slice(0, 4).map((z) => [num(z.v, 0), z.nm] as [string, string]), ...(themes?.items?.[0] ? [[`${themes.items[0].share}%`, `of comments on ${themes.items[0].theme.toLowerCase()}`] as [string, string]] : [])];
  doc.roundedRect(X0, y, CW, 78, 4).fill(C.white);
  tx(doc, "Numbers to bring", X0 + 12, y + 12, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
  bring.forEach(([v, k], i) => { const cw = (CW - 24 - 12 * (bring.length - 1)) / bring.length, cx = X0 + 12 + i * (cw + 12); tx(doc, v, cx, y + 30, { f: "I7", size: 14, lead: 18 }); tx(doc, k, cx, y + 50, { f: "I4", size: 8, lead: 10, w: cw }); });
  y += 78 + GAP;
  y = h2(doc, "The hour in four steps", y) + 8;
  // PAC's standard steps; the numbers come from this client's data
  const steps: [string, string, string, string][] = [
    ["Open and set the ground rules", "10 minutes", "Explain that answers were anonymous and that no group under five people is shown.", "Nothing you say today will be traced back to you."],
    ["Share what the survey found", "15 minutes", `Show the ${neg.length} voice scores below zero${neg[0] ? `, starting with ${neg[0].nm.toLowerCase()} at ${num(neg[0].v, 0)}` : ""}.`, "These are your numbers. We want to understand what sits behind them."],
    ["Listen", "25 minutes", `Ask about the top comment themes${themes?.items?.length ? `: ${themes.items.slice(0, 2).map((t) => t.theme.toLowerCase()).join(" and ")}` : ""}. Write down what people say, not who said it.`, "What would have to change for this score to go up?"],
    ["Agree one change", "10 minutes", "Ask the group to pick the one change they want first. Note it in their words.", "If we could fix one thing this quarter, what should it be?"]];
  for (const [i, [t0, time, body, say]] of steps.entries()) {
    const h = 30 + th(doc, body, CW - 60) + th(doc, `You might say: "${say}"`, CW - 60, "SI") + 10;
    doc.roundedRect(X0, y, CW, h, 4).fill(C.white);
    doc.circle(X0 + 20, y + 18, 8).fill(C.brand); tx(doc, String(i + 1), X0 + 12, y + 13.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center" });
    tx(doc, t0, X0 + 38, y + 11, { f: "I6", size: 11, lead: 14 });
    const pw = tw(doc, `Time: ${time}`, "I6", 8) + 16; doc.roundedRect(X1 - 12 - pw, y + 10, pw, 16, 8).fill(C.surface); tx(doc, `Time: ${time}`, X1 - 12 - pw + 8, y + 13, { f: "I6", size: 8, lead: 10 });
    let ly = tx(doc, body, X0 + 38, y + 32, { w: CW - 60 });
    ly = tx(doc, `You might say: "${say}"`, X0 + 38, ly, { f: "SI", w: CW - 60 });
    y += Math.max(h, ly - y + 8) + 8;
  }
  y += 8;
  const avoid = ["Do not name or guess who gave an answer.", "Do not discuss any single leader's 360 result.", "Do not promise a change the executive team has not agreed."];
  const ah = 30 + avoid.reduce((t, z) => t + th(doc, z, CW - 48) + 4, 0) + 8;
  doc.roundedRect(X0, y, CW, ah, 4).fill(C.surface); doc.rect(X0, y, CW, 1.5).fill(C.brand);
  tx(doc, "Please avoid", X0 + 12, y + 12, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
  let ay = y + 30; for (const z of avoid) { icon(doc, "cross", X0 + 12, ay + 2); ay = tx(doc, z, X0 + 30, ay, { w: CW - 48 }) + 4; }

  // ================================================================ page 2: the three working sessions with the client
  page();
  y = section(doc, "1", "The three sessions with the client") + 12;
  for (const f0 of FACILITATION.slice(0, 3)) {
    const lh = 24 + th(doc, f0.purpose, HALF) + 8 + th(doc, f0.who, HALF), rh = 14 + f0.agenda.reduce((t, g0) => t + th(doc, g0, HALF - 14) + 3, 0) + 16 + th(doc, f0.outputs, HALF);
    const ch = Math.max(lh, rh) + 30;
    if (y + ch > LIMIT) { page(); y = TOP; }
    doc.moveTo(X0, y).lineTo(X1, y).lineWidth(0.5).strokeColor(C.ink).stroke();
    tx(doc, `${f0.length}`, X0, y + 8, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5, color: C.brand });
    let ly = tx(doc, f0.name.replace(/^Session \d+\.\s*/, ""), X0, y + 20, { f: "I7", size: 11, lead: 14, w: HALF }) + 4;
    ly = tx(doc, f0.purpose, X0, ly, { w: HALF }) + 6; tx(doc, `Who: ${f0.who}`, X0, ly, { f: "I4", size: 8.5, lead: 12, w: HALF, color: C.muted });
    let ry = tx(doc, "Agenda", X0 + HALF + GAP, y + 8, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5 }) + 4;
    f0.agenda.forEach((g0, j) => { tx(doc, String(j + 1), X0 + HALF + GAP, ry, { f: "I7", size: 8, lead: 14 }); ry = tx(doc, g0, X0 + HALF + GAP + 14, ry, { w: HALF - 14 }) + 3; });
    ry = tx(doc, "Outputs", X0 + HALF + GAP, ry + 4, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5 }) + 2; tx(doc, f0.outputs, X0 + HALF + GAP, ry, { w: HALF });
    y += ch;
  }
  const nh = 30 + NON_NEGOTIABLES.reduce((t, z) => t + th(doc, z, CW - 48) + 4, 0) + 8;
  if (y + nh > LIMIT) { page(); y = TOP; }
  doc.roundedRect(X0, y, CW, nh, 4).fill(C.surface); doc.rect(X0, y, CW, 1.5).fill(C.brand);
  tx(doc, "Non negotiables", X0 + 12, y + 12, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
  let ny = y + 30; for (const z of NON_NEGOTIABLES) { icon(doc, "cross", X0 + 12, ny + 2); ny = tx(doc, z, X0 + 30, ny, { w: CW - 48 }) + 4; }

  // ================================================================ page 3: questions from the accepted advice, and notes for this client
  const qs = (x.advice ?? []).filter((v) => v.questions.length);
  if (qs.length || (secs.facilitation ?? "").trim()) {
    page();
    y = section(doc, "2", "Questions to explore with the client") + 8;
    y = tx(doc, "From the advice accepted for this report, by the result each comes from. Use them in session 2.", X0, y, { w: CW, color: C.muted }) + 10;
    for (const v of qs) {
      const qq = v.questions.slice(0, 3).map(clean), h = 18 + qq.reduce((t, z) => t + th(doc, z, CW - 20) + 2, 0) + 8;
      if (y + h > LIMIT) { page(); y = TOP; }
      doc.moveTo(X0, y).lineTo(X1, y).lineWidth(0.4).strokeColor(C.grid).stroke();
      let ly = tx(doc, `${clean(v.title)}${v.scope_key ? ` (${v.scope_key})` : ""}`, X0, y + 4, { f: "I6", size: 9.5, lead: 13, w: CW }) + 2;
      for (const z of qq) { doc.circle(X0 + 4, ly + 7, 1.6).fill(C.ink); ly = tx(doc, z, X0 + 14, ly, { w: CW - 20 }) + 2; }
      y = ly + 6;
    }
    if ((secs.facilitation ?? "").trim()) { if (y + 80 > LIMIT) { page(); y = TOP; } y = h2(doc, "Notes for this client", y + 8) + 6; tx(doc, clean(secs.facilitation), X0, y, { w: CW }); }
  }

  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) { doc.switchToPage(i); frame(doc, logo, `${org} · Staff guide`, "Internal. PAC staff only. Do not share with the client team.", i + 1, total); }
  doc.end();
  return done;
}
