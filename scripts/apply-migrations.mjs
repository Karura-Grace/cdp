// Applies supabase/migrations/*.sql in order through the Supabase Management API and
// records each in supabase_migrations.schema_migrations (same table the CLI uses).
// Usage: node scripts/apply-migrations.mjs <project-ref> <token-file>
// The token is read from the file; it is never printed or passed on a command line.
// ponytail: used because `supabase db push` needs the DB password; swap back to the CLI once it is set.
import { readFileSync, readdirSync } from "node:fs";

const [ref, tokenFile] = process.argv.slice(2);
if (!ref || !tokenFile) { console.error("usage: node scripts/apply-migrations.mjs <project-ref> <token-file>"); process.exit(2); }
const token = readFileSync(tokenFile, "utf8").trim();

const dir = new URL("../supabase/migrations/", import.meta.url).pathname;
const run = async (query, tries = 6) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  // a rate limited ledger check (429) must never read as "not applied"; wait and retry, as scripts/lib/seed.mjs does
  if (r.status === 429 && tries > 1) { await new Promise((ok) => setTimeout(ok, (Number(r.headers.get("retry-after")) || 20) * 1000)); return run(query, tries - 1); }
  return { ok: r.ok, body: (await r.text()).slice(0, 1500) };
};

await run(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);

for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const [version, name] = f.replace(/\.sql$/, "").split(/_(.*)/s);
  const done = await run(`select version from supabase_migrations.schema_migrations where version='${version}'`);
  if (!done.ok) { console.error("ledger check failed", f, done.body); process.exit(1); }
  if (done.body.includes(version)) { console.log("skip", f); continue; }
  const r = await run(readFileSync(dir + f, "utf8"));
  console.log(f, r.ok ? "OK" : "FAIL " + r.body);
  if (!r.ok) process.exit(1);
  await run(`insert into supabase_migrations.schema_migrations(version,name) values ('${version}','${name}')`);
}
