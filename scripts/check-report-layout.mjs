// Layout check for an exported full report PDF (owner rule 26 Oct 2026: no half empty pages, graphics never alone on a page).
//   node scripts/check-report-layout.mjs <report.pdf>
// Counts the lines of text on every page with pdftotext. After the cover, the contents and the last page, a page with fewer than MIN lines fails, except the pages
// that are meant to be graphic pages (the glance and the journey), which must still carry text beside their graphics.
import { execFileSync } from "node:child_process";

const file = process.argv[2];
if (!file) { console.error("usage: check-report-layout.mjs <report.pdf>"); process.exit(2); }
const MIN = 18, MIN_GRAPHIC = 12;
const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
const text = (p) => execFileSync("pdftotext", ["-f", String(p), "-l", String(p), "-layout", file, "-"], { encoding: "utf8" });
let fail = 0;
const lines = [];
// every chapter starts on a new page (owner Q-ER3, 29 Oct 2026), so the last page of a chapter may be short; a page in the middle of a chapter may not
const opens = (p) => p <= pages && /^\s*(PART \d|\d\d\s{2,}\S|[A-Z]\s{2,}Appendix|The journey)/m.test(text(p).split("\n").slice(0, 8).join("\n"));
for (let p = 1; p <= pages; p++) {
  const t = text(p), n = t.split("\n").filter((l) => /[A-Za-z]/.test(l)).length;
  lines.push(n);
  const special = p === 1 || p === 2 || p === pages || opens(p + 1);   // cover, contents, last page, the last page of a chapter
  const graphic = /Culture at a glance|The journey/.test(t.slice(0, 400));
  const need = special ? 0 : graphic ? MIN_GRAPHIC : MIN;
  if (n < need) { fail++; console.log(`FAIL page ${p}: ${n} lines of text, needs ${need}`); }
}
console.log(`pages ${pages}; lines per page: ${lines.join(" ")}`);
console.log(fail ? `${fail} page(s) too empty` : "layout ok");
process.exit(fail ? 1 : 0);
