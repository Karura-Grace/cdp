// Answers the surveys you do not answer yourself. Reads the links file you downloaded from Survey links (CSV: name,email,link) and
// submits generated answers for everyone except the emails you list, through the same routes the survey page uses.
//   node scripts/rehearsal-fill.mjs <links.csv> <base-url> <email,email,email>
// The three emails are the people you answered for by hand (Persona A, B and C). Executives get the executive pattern, everyone else the staff one.
import { readFileSync } from "node:fs";
import { orgGraph } from "./lib/rehearsal-data.mjs";
import { fillAll } from "./lib/rehearsal-fill.mjs";

const [file, base, skipList = ""] = process.argv.slice(2);
if (!file || !base) { console.error("usage: node scripts/rehearsal-fill.mjs <links.csv> <base-url> <email,email,email>"); process.exit(2); }
const rows = readFileSync(file, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/).slice(1).map((l) => {
  const m = /^"?([^",]*)"?,"?([^",]*)"?,(\S+)$/.exec(l.trim());
  const tok = m && /#([0-9a-f]{32})$/.exec(m[3]);
  return m && tok ? { email: m[2].toLowerCase(), token: tok[1] } : null;
}).filter(Boolean);
const exec = new Map(orgGraph().people.map((p) => [p.email, p.grade === "Executive"]));
const skip = new Set(skipList.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
const todo = rows.filter((r) => !skip.has(r.email));
console.log(`${rows.length} links read, ${skip.size} skipped (answered by you), ${todo.length} to fill`);
const n = await fillAll(base, rows, (email) => (exec.get(email) ? "exec" : "staff"), { skip });
console.log(`submitted ${n} surveys`);
