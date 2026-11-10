// Appendix J (errors) and Appendix K (domain events), checked statically against the source.
// J: every code in Table 120 is raised somewhere with its HTTP status, and some e2e or engine test asserts it.
// K: every event in Table 121 is written to event_outbox somewhere (SQL or app code).
//   node scripts/conformance/probes/errors-events.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ok, done } from "../../lib/e2e.mjs";

const walk = (d, ext) => readdirSync(d).flatMap((f) => { const p = join(d, f); if (f === "node_modules" || f.startsWith(".")) return []; return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : []; });
const src = [...walk("apps/web/app", [".ts", ".tsx"]), ...walk("apps/web/lib", [".ts"]), ...walk("packages/cdp-engine/src", [".ts"]), ...walk("supabase/migrations", [".sql"])].map((f) => [f, readFileSync(f, "utf8")]);
const tests = [...walk("scripts", [".mjs"]), ...walk("packages/cdp-engine/test", [".ts"])].map((f) => [f, readFileSync(f, "utf8")]);
const spec = readFileSync("docs/spec/CDP_Platform_Developer_Specification_v2_1.md", "utf8");
const tbl = (n) => { const s = spec.indexOf(`**Table ${n} `); const e = spec.indexOf("\n# ", s); return spec.slice(s, e > 0 ? e : undefined).split("\n").filter((l) => /^\| [a-zA-Z]/.test(l) && !/^\| \*\*/.test(l)).map((l) => l.replace(/^\| | \|$/g, "").split(" | ").map((c) => c.trim())); };

for (const [code, http] of tbl(120)) {
  const raised = src.filter(([, t]) => t.includes(`"${code}"`) || t.includes(`'${code}'`) || t.includes(`code: "${code}"`));
  const withStatus = src.some(([, t]) => new RegExp(`${code}[^\\n]{0,80}status: ${http}|status: ${http}[^\\n]{0,80}${code}|"${code}", ${http}|'${code}', ${http}`).test(t));
  ok(`[APPJ-${code}] raised in the code (${raised.length} files)`, raised.length > 0, "not found");
  ok(`[APPJ-${code}] raised with HTTP ${http}`, withStatus, "status not found next to the code");
  ok(`[APPJ-${code}] asserted by a test`, tests.some(([, t]) => t.includes(code)), "no test mentions it");
}
for (const [ev] of tbl(121)) {
  const hits = src.filter(([, t]) => t.includes(`'${ev}'`) || t.includes(`"${ev}"`));
  ok(`[APPK-${ev}] emitted to event_outbox`, hits.some(([, t]) => /insert into (public\.)?event_outbox|from\("event_outbox"\)/i.test(t)),
    hits.length ? `only written to the audit log (${hits.map(([f]) => f.split("/").pop()).join(", ")})` : "not emitted anywhere");
}
done();
