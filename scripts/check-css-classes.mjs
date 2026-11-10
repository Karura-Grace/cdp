// Every class name used in a .tsx file must be defined in one of the app stylesheets (catches typos and dropped rules).
//   node scripts/check-css-classes.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const web = new URL("../apps/web/", import.meta.url).pathname;
const cssFiles = []; (function find(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== ".next") find(p); } else if (f.endsWith(".css")) cssFiles.push(p); } })(web + "app");
const css = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const defined = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
// classes that are state or runtime-only, not styled by name
const allow = new Set(["scrolled", "on", "ok", "bad", "warn", "grey", "orange", "blue", "fp"]);   // fp: a hook class in the design with no rule

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (f === "node_modules" || f === ".next") continue; statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && files.push(p); } })(web + "app");
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx$/.test(f) && files.push(p); } })(web + "components");

let missing = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const str = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, " ");
    for (const c of str.split(/\s+/).filter(Boolean)) if (!defined.has(c) && !allow.has(c)) { console.log(`${f.replace(web, "")}: .${c} is not defined in any stylesheet`); missing++; }
  }
}
console.log(missing ? `\n${missing} undefined class(es)` : "all class names are defined");
process.exit(missing ? 1 : 0);
