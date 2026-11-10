// Writes the files the rehearsal guide asks you to upload: the five organisation CSVs (docs/rehearsal-data/).
//   node scripts/rehearsal-files.mjs [out-dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { orgGraph, toCsv, CSV_COLUMNS } from "./lib/rehearsal-data.mjs";

const out = process.argv[2] ?? "docs/rehearsal-data";
mkdirSync(out, { recursive: true });
const g = orgGraph();
for (const k of Object.keys(CSV_COLUMNS)) writeFileSync(`${out}/${k}.csv`, toCsv(g[k], CSV_COLUMNS[k]));
console.log(`wrote ${Object.keys(CSV_COLUMNS).length} files to ${out}: ${g.units.length} units, ${g.people.length} people, ${g.leaders.length} leaders`);
