// Export checks against a running dev server and the released fixture reports.
//   node --env-file=.env.local scripts/e2e-export.mjs [base-url] [out-dir]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { inflateRawSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const base = process.argv[2] ?? "http://localhost:3100", out = process.argv[3] ?? "context-sessions/exports";
mkdirSync(out, { recursive: true });
const pw = passwords();
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function session(email) {
  const jar = new Map();
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw[email] });
  if (error) throw new Error(error.message);
  return (p) => fetch(base + p, { redirect: "manual", headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
}

// minimal zip reader: names + text of every entry (enough to inspect a .pptx)
function unzip(buf) {
  const files = {}; let eocd = buf.length - 22;
  while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0, n = buf.readUInt16LE(eocd + 10); i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const ls = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const raw = buf.subarray(ls, ls + csize);
    files[name] = method === 8 ? inflateRawSync(raw) : raw;
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const { data: ten } = await svc.from("tenant").select("tenant_id").eq("name", "Demo Retail Bank (fixture)").single();
const { data: asm } = await svc.from("assessment").select("assessment_id").eq("tenant_id", ten.tenant_id).single();
const { data: reps } = await svc.from("report").select("report_id, type, status").eq("assessment_id", asm.assessment_id);
const org = reps.find((r) => r.type === "ORGANISATIONAL"), board = reps.find((r) => r.type === "BOARD_EXEC_SUMMARY");
const consultant = await session("consultant@cdp-demo.example"), admin = await session("admin.fixture@cdp-demo.example");
const lead = await session("peoplelead.fixture@cdp-demo.example"), other = await session("admin.live@cdp-demo.example");

let r = await fetch(`${base}/v1/reports/${org.report_id}/export?format=pdf`);
ok("no session -> 401", r.status === 401, r.status);
r = await admin(`/v1/reports/${org.report_id}/export?format=docx`);
ok("bad format -> 422", r.status === 422, r.status);
r = await other(`/v1/reports/${org.report_id}/export?format=pdf`);
ok("other tenant -> 403", r.status === 403, r.status);
r = await lead(`/v1/reports/${board.report_id}/export?format=pdf`);
ok("people lead cannot export the board summary", r.status === 403, r.status);

r = await admin(`/v1/reports/${org.report_id}/export?format=pdf`);
let pdf = Buffer.from(await r.arrayBuffer());
ok("admin PDF 200 + pdf content-type + attachment", r.status === 200 && r.headers.get("content-type") === "application/pdf" && /attachment/.test(r.headers.get("content-disposition")), r.status);
ok("PDF has %PDF header and EOF marker", pdf.subarray(0, 5).toString() === "%PDF-" && pdf.subarray(-16).toString().includes("%%EOF"));
writeFileSync(`${out}/organisational.pdf`, pdf);
// the house serif is embedded, and every page after the cover says who it was prepared for and which frozen score it came from (poppler: pdffonts, pdftotext)
try {
  const fonts = execFileSync("pdffonts", [`${out}/organisational.pdf`], { encoding: "utf8" });
  ok("PDF embeds the serif font and no Helvetica", /Gelasio/.test(fonts) && !/Helvetica/.test(fonts), fonts);
  const pages = execFileSync("pdftotext", ["-layout", `${out}/organisational.pdf`, "-"], { encoding: "utf8" }).split("\f").filter((p) => p.trim());
  ok("every page after the cover carries Confidential and the client, and no page shows a hash (Erick #240, owner Q-ER9)", pages.length >= 2 && pages.slice(1).every((p) => /Confidential\. Prepared for Demo Retail Bank/.test(p)) && !pages.some((p) => /sha256:|score v\d/.test(p)), pages.length);
  const info = execFileSync("pdfinfo", [`${out}/organisational.pdf`], { encoding: "utf8" });
  ok("the version and score hash are in the PDF file properties instead", /Subject:.*sha256:/.test(info) && /Keywords:.*score v\d/.test(info), info.split("\n").filter((x) => /Subject|Keywords/.test(x)).join(" | ").slice(0, 200));
  const all = pages.join("\n");
  ok("the summary has the culture at a glance box and the journey page has the four squares, the axes, the stepping stone note and both labels (Erick #1)", ["culture at a glance", "The journey", "Engage", "Innovate", "Perform", "Govern", "ADAPTIVE", "STRUCTURED", "INWARD", "OUTWARD", "NOW", "PREFERRED", "stepping stone"].every((w) => all.replace(/\s+/g, "").includes(w.replace(/\s+/g, ""))), "");
  ok("the client PDF has no playbook chapter, no facilitation guide, no technical appendix and no finding ids", !/The playbook for each orientation|Appendix C|Appendix D|Session 1\. Leadership debrief|fnd_\d/.test(all), "");
  ok("the client PDF says Transformation Probability Score and never preparedness", /Transformation\s+Probability\s+Score/.test(all) && !/preparedness/i.test(all), "");
  ok("plan and playbook text reads clean: no orientation in capitals, no CEO+EXCO, no pulse codes, no separate pattern page (owner Q-ER23, Q-ER26)", !/[a-z,]\s+(ENGAGE|INNOVATE|PERFORM|GOVERN)\b/.test(all) && !/[A-Z]{2,}\+[A-Z]{2,}/.test(all) && !/\bD\d S\d|eOS Q\d/.test(all) && !/Reward and recognition pay for the behaviour the organisation wants to stop\.\s*\n\s*•/.test(all), "");
  ok("every chapter has its introduction (owner Q-ER28)", /Every organisation runs on a mix of four orientations/.test(all.replace(/\s+/g, " ")) && /What gets measured gets managed/.test(all.replace(/\s+/g, " ")));
  ok("the full PDF names Now and Preferred and no longer says Today", /Now/.test(all) && /Preferred/.test(all) && !/\bToday\b/.test(all.replace(/\s+/g, " ")), "");
  const raw = pdf.toString("latin1");
  ok("the pale diagonal mark (5% opacity) is set up on every page after the cover", /\/ca 0\.05/.test(raw) && (raw.match(/\/ExtGState <</g) ?? []).length >= pages.length - 1, (raw.match(/\/ExtGState <</g) ?? []).length);
} catch (e) { ok("poppler tools available for the PDF checks (pdffonts, pdftotext)", false, e.message); }

// the web report shows the same chosen looks (Q-ER18 to Q-ER20) and keeps the facilitation guide for PAC staff only
{ const wr = await lead(`/reports/${org.report_id}`); const wh = (await wr.text()).replace(/<!-- -->/g, "");
  ok("the web report carries the glance box, the Big Three columns and the chart blocks", wr.status === 200 && wh.includes("The culture at a glance") && wh.includes("ACCELERATOR") && wh.includes("What each dimension says"), wr.status);
  ok("a client role sees no facilitation guide on the web report", !/Facilitation guide/.test(wh));
  const cw = await (await consultant(`/reports/${org.report_id}`)).text();
  ok("the consultant sees the facilitation guide marked as staff only", /Facilitation guide \(PAC staff only\)|Facilitation guide \(staff PDF\)/.test(cw)); }
// the facilitation guide is its own staff PDF (Erick #238, owner Q-ER1): the consultant gets it, a client role does not
r = await consultant(`/v1/reports/${org.report_id}/export?format=pdf&part=facilitation`);
const guide = Buffer.from(await r.arrayBuffer());
writeFileSync(`${out}/facilitation-guide.pdf`, guide);
ok("the consultant downloads the facilitation guide as its own PDF", r.status === 200 && guide.subarray(0, 5).toString() === "%PDF-" && /facilitation-guide/.test(r.headers.get("content-disposition") ?? ""), r.status);
try { ok("the guide holds the three sessions", /Leadership debrief/.test(execFileSync("pdftotext", [`${out}/facilitation-guide.pdf`, "-"], { encoding: "utf8" }))); } catch (e) { ok("pdftotext for the guide", false, e.message); }
// the review copy has no diagonal mark and is for PAC consultants only (owner Q-ER27)
{ const rv = await consultant(`/v1/reports/${org.report_id}/export?format=pdf&review=1`); const rb = Buffer.from(await rv.arrayBuffer());
  ok("the consultant gets a review copy without the diagonal mark", rv.status === 200 && rb.subarray(0, 5).toString() === "%PDF-" && !/\/ca 0\.05/.test(rb.toString("latin1")), rv.status);
  const rl = await lead(`/v1/reports/${org.report_id}/export?format=pdf&review=1`); ok("a client role cannot get the review copy", rl.status === 403 || rl.status === 404, rl.status); }
r = await lead(`/v1/reports/${org.report_id}/export?format=pdf&part=facilitation`);
ok("a client role cannot download the facilitation guide", r.status === 403 || r.status === 404, r.status);
// the executive brief matches the full report too (owner, 30 Oct): no finding ids, the checks with a proposed intervention
r = await admin(`/v1/reports/${org.report_id}/export?format=pdf&brief=1`);
writeFileSync(`${out}/brief.pdf`, Buffer.from(await r.arrayBuffer()));
try { const bt = execFileSync("pdftotext", [`${out}/brief.pdf`, "-"], { encoding: "utf8" });
  ok("the brief has no finding ids or technical appendix and explains the checks", r.status === 200 && !/fnd_\d|sha256:|Every figure comes from this frozen score/.test(bt) && /Proposed\s+intervention/.test(bt), r.status); } catch (e) { ok("pdftotext for the brief", false, e.message); }
r = await lead(`/v1/reports/${org.report_id}/export?format=pptx`);
ok("people lead can export the organisational report", r.status === 200, r.status);
r = await consultant(`/v1/reports/${org.report_id}/export?format=pptx`);
const pptx = Buffer.from(await r.arrayBuffer());
ok("consultant PPTX 200", r.status === 200 && pptx.subarray(0, 2).toString() === "PK", r.status);
writeFileSync(`${out}/organisational.pptx`, pptx);
const z = unzip(pptx);
const names = Object.keys(z);
const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
const text = slides.map((n) => z[n].toString("utf8")).join(" ");
ok("PPTX has >= 8 slides", slides.length >= 8, slides.length);
ok("PPTX has a native chart part", names.some((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)));
const chart = names.filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).map((n) => z[n].toString()).join("");
ok("chart carries today 22/14/34/30 and preferred 31/25/28/16", ["22", "14", "34", "30", "31", "25", "28", "16"].every((v) => chart.includes(`<c:v>${v}</c:v>`)));
const content = slides.filter((n) => !/slide1\.xml$/.test(n));
ok("every slide after the title has the pale diagonal CONFIDENTIAL mark", content.length >= 7 && content.every((n) => /CONFIDENTIAL/.test(z[n].toString()) && /rot="-\d+/.test(z[n].toString()) && /alpha/.test(z[n].toString())), content.length);
ok("every slide after the title names the client in the footer", content.every((n) => /Prepared for Demo Retail Bank/.test(z[n].toString())));
ok("slides use Georgia and no Calibri", /typeface="Georgia"/.test(text) && !/typeface="Calibri"/.test(text));
const mapSlide = slides.map((n) => z[n].toString("utf8")).find((x) => /Culture map/.test(x));
ok("the PowerPoint has a Culture map slide with squares, axes, both dots and an arrow", !!mapSlide && ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN", "ADAPTIVE", "STRUCTURED", "NOW", "PREFERRED"].every((w) => mapSlide.includes(w)) && (mapSlide.match(/prst="ellipse"/g) ?? []).length >= 2 && /tailEnd type="triangle"|headEnd type="triangle"/.test(mapSlide), mapSlide ? "missing parts" : "no slide");
ok("the PowerPoint has no finding ids and explains the checks with a proposed intervention (owner, 30 Oct: match the full report)", !/fnd_\d/.test(text) && text.includes("What the checks mean and what to do") && /Proposed\s*(<[^>]+>\s*)*intervention/.test(text));
ok("the PowerPoint keeps the hash in its file properties, not on a slide", (z["docProps/core.xml"]?.toString() ?? "").includes("sha256:3366fa7d") && !text.includes("sha256:"));
ok("slides carry org, headline figures", text.includes("Demo Retail Bank") && text.includes("3.09") && text.includes("Shadow culture"));

// unreleased report cannot be exported, even by the consultant who can read it
const { data: draft } = await svc.from("report").insert({ tenant_id: ten.tenant_id, assessment_id: asm.assessment_id, score_version: 1, type: "SUB_CULTURE", payload_hash: (await svc.from("score_object").select("payload_hash").eq("assessment_id", asm.assessment_id).single()).data.payload_hash }).select("report_id").single();
r = await consultant(`/v1/reports/${draft.report_id}/export?format=pdf`);
ok("draft export refused (EXPORT_FORBIDDEN 403)", r.status === 403 && (await r.json()).code === "EXPORT_FORBIDDEN", r.status);

const { data: aud } = await svc.from("audit_log").select("action").eq("tenant_id", ten.tenant_id).like("action", "report.exported%");
ok("exports are audit-logged", aud.length >= 3, aud.length);
done(`\nfiles in ${out}/`);
