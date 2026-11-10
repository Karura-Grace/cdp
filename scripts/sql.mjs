// Runs one SQL file on the project through the Supabase Management API and prints the status and the start of the reply.
//   node scripts/sql.mjs <project-ref> <token-file> <sql-file>
import { readFileSync } from "node:fs";
const [ref, tokenFile, file] = process.argv.slice(2);
const key = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST", headers: { Authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify({ query: readFileSync(file, "utf8") }) });
console.log(r.status, (await r.text()).slice(0, 1500));
