// Checks the full length organisational report of a released report: page count, every chapter present, length, contents page
// numbers, no "undefined" or "NaN", the brief still short. Needs pdftotext and pdfinfo (poppler).
//   node --env-file=apps/web/.env.local scripts/inspect-full-report.mjs <report_id> [base-url]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { ok, done, URL_, ANON, passwords } from "./lib/e2e.mjs";

const [rep, base = "http://localhost:3100"] = process.argv.slice(2);
if (!rep) { console.error("usage: inspect-full-report.mjs <report_id> [base-url]"); process.exit(2); }
const jar = new Map();
const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
await c.auth.signInWithPassword({ email: "consultant@cdp-demo.example", password: passwords()["consultant@cdp-demo.example"] });
const dir = mkdtempSync(join(tmpdir(), "cdp-full-"));
const get = async (q, file) => { const r = await fetch(`${base}/v1/reports/${rep}/export?${q}`, { headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } }); writeFileSync(join(dir, file), Buffer.from(await r.arrayBuffer())); return r.status; };

ok("full report exports", (await get("format=pdf", "full.pdf")) === 200);
ok("brief exports", (await get("format=pdf&brief=1", "brief.pdf")) === 200);
const pages = (f) => Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [join(dir, f)]).toString())[1]);
const text = (f, a = []) => execFileSync("pdftotext", [...a, join(dir, f), "-"]).toString();
const full = text("full.pdf"), layout = text("full.pdf", ["-layout"]);
ok("full report runs to 25 pages or more", pages("full.pdf") >= 25, pages("full.pdf"));
ok("full report carries 6,000 words or more", full.split(/\s+/).filter(Boolean).length >= 6000, full.split(/\s+/).length);
ok("the brief stays short", pages("brief.pdf") <= 10, pages("brief.pdf"));
for (const h of ["Executive summary", "Method and sample", "The culture today", "D1 · Cultural DNA", "D6 · Victory Conditions", "The culture gap", "Executives and staff", "Departments",
  "Employee voice", "Readiness for change", "Risk and cultural debt", "Hits and misses", "Leadership 360 summary", "Recommendations and roadmap", "Culture KPI scorecard",
  "Appendix A. Dimension data", "Appendix B. Glossary", "Appendix C. Facilitation guide", "Appendix D. Technical appendix"]) ok(`chapter present: ${h}`, full.includes(h));
ok("no undefined or NaN in the text", !/\bundefined\b|\bNaN\b/.test(full));
// contents: each listed page shows that chapter's title
const toc = [...layout.split("\f")[2].matchAll(/^\s*(?:\d\d|[A-D]|)\s*(.+?)\s{2,}(\d+)\s*$/gm)].map((m) => [m[1].trim(), Number(m[2])]);
const byPage = layout.split("\f");
const wrong = toc.filter(([t, p]) => !byPage[p]?.includes(t.replace(/^\d\d\s+/, "")));
ok("contents page numbers point at their chapters", toc.length >= 15 && wrong.length === 0, `${toc.length} entries; wrong: ${wrong.map((w) => w.join(" p")).join(", ")}`);
done();
