// Coverage of the spec cross check: for every section of the developer specification, how many requirements the text holds
// (table data rows plus sentences with shall, must, never, may not, only, required) against how many CSV rows cite that section.
// Lists the sections where the matrix looks thin, so nothing in the spec is skipped.
//   node scripts/conformance/coverage.mjs [csv ...]   (default: docs/spec-crosscheck/parts/*.csv)
import { readFileSync, readdirSync } from "node:fs";
import { parseCsv } from "./csv.mjs";

const SPEC = "docs/spec/CDP_Platform_Developer_Specification_v2_1.md";
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync("docs/spec-crosscheck/parts").filter((f) => f.endsWith(".csv")).map((f) => `docs/spec-crosscheck/parts/${f}`);

// sections: "## 1.4  Data captured" -> "1.4"; "# Appendix C  Item bank" -> "C"; "## C.2 ..." -> "C.2"
const sections = [];
let cur = null;
readFileSync(SPEC, "utf8").split("\n").forEach((line, i) => {
  const h = /^#{1,2}\s+(?:Appendix\s+)?([0-9]+(?:\.[0-9]+)?|[A-K](?:\.[0-9]+)?)\s{2,}(.+)$/.exec(line);
  if (h) { cur = { id: h[1], title: h[2].trim(), from: i + 1, tables: 0, modal: 0 }; sections.push(cur); return; }
  if (!cur) return;
  if (/^\|/.test(line) && !/^\|\s*:?-{3}/.test(line)) cur.tables++;
  cur.modal += (line.match(/\b(shall|must|never|may not|is required|are required|only)\b/gi) ?? []).length;
});
// table counts above include header rows; subtract one per table (a header is followed by a |---| line)
const text = readFileSync(SPEC, "utf8").split("\n");
for (const s of sections) {
  const next = sections[sections.indexOf(s) + 1]?.from ?? text.length + 1;
  s.tables -= text.slice(s.from, next - 1).filter((l) => /^\|\s*:?-{3}/.test(l)).length;
}

const rows = files.flatMap((f) => parseCsv(readFileSync(f, "utf8")));
const cites = (sec) => rows.filter((r) => (r.spec_ref ?? "").trim().split(/\s+/)[0] === sec.id || (r.spec_ref ?? "").startsWith(sec.id + ".")).length;

let thin = 0;
console.log("section".padEnd(8), "title".padEnd(46), "table rows", "modal", "csv rows");
for (const s of sections) {
  const want = Math.max(s.tables, Math.ceil(s.modal / 2)), have = cites(s);
  const flag = want > 0 && have < want * 0.8;
  if (flag) thin++;
  console.log(s.id.padEnd(8), s.title.slice(0, 45).padEnd(46), String(s.tables).padStart(10), String(s.modal).padStart(5), String(have).padStart(8), flag ? "  THIN" : "");
}
console.log(`\n${rows.length} csv rows from ${files.length} file(s); ${thin} section(s) look thin`);
