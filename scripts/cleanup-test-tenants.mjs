// Deletes test clients from the live project, keeping the ones listed in KEEP. Approved 17 Oct 2026.
//   node scripts/cleanup-test-tenants.mjs <project-ref> <token-file>            dry run: counts only, changes nothing
//   node scripts/cleanup-test-tenants.mjs <project-ref> <token-file> --apply    backup, then delete in one transaction
// The backup (every row removed, no password hashes) goes to context-sessions/cleanup-backup-<date>.json.gz (gitignored).
// The immutability guards (report, plan, evaluation, audit log...) are switched off for that one transaction only
// (session_replication_role = replica), which also skips foreign key checks, so child rows are deleted explicitly.
// Logins are deleted afterwards in normal mode, so auth's own cascades run.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const [ref, tokenFile] = process.argv.slice(2);
if (!ref || !tokenFile) { console.error("usage: cleanup-test-tenants.mjs <project-ref> <token-file> [--apply] [--only <tenant_id>]"); process.exit(2); }
const apply = process.argv.includes("--apply");
// --only <tenant_id>: delete just that client and keep every other one (used to replace a demo client)
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
if (only !== null && !/^ten_[a-z0-9]+$/.test(only)) { console.error("--only needs a tenant id"); process.exit(2); }
const token = readFileSync(tokenFile, "utf8").trim();
const sql = async (query, tries = 6) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  // the management API rate limits (429) after a busy day of seeds; wait and retry instead of failing half way
  if (r.status === 429 && tries > 1) { await new Promise((ok) => setTimeout(ok, (Number(r.headers.get("retry-after")) || 20) * 1000)); return sql(query, tries - 1); }
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`SQL failed (${r.status}): ${JSON.stringify(body).slice(0, 400)}`);
  return body;
};

let KEEP = [
  "ten_427cdf90cc5d4a90", "ten_7bdacdb40b994ce1", "ten_66c7237292b245a8", "ten_33754f0f40a04906",   // fixture, Ostravane, Savanna Ridge, Live Demo Co
  "ten_b6c75e8fed0f47a0", "ten_d85de777bc1a4999", "ten_199a639d38fe47e3", "ten_bede88df7d834ec7",   // newest lifecycle, rollover, pulse, plan
  "ten_a858ee26e4b24b5b", "ten_515f9d7f1ced4f67", "ten_b9130f427c784d30", "ten_612406f2d02d4b9d",   // team, adjust, scoring key, rater context
];
if (only) KEEP = (await sql(`select tenant_id from public.tenant where tenant_id <> '${only}'`)).map((t) => t.tenant_id);
const PROTECT = ["issa@pac.africa", "superadmin@cdp-demo.example", "consultant@cdp-demo.example", "consultant.a@cdp-demo.example", "consultant.b@cdp-demo.example", "demo@cdp-demo.example"];
const keepList = KEEP.map((k) => `'${k}'`).join(",");
const protList = PROTECT.map((e) => `'${e}'`).join(",");

const kept = await sql(`select tenant_id, name from public.tenant where tenant_id in (${keepList})`);
if (kept.length !== KEEP.length) throw new Error(`only ${kept.length} of ${KEEP.length} kept tenants found; stopping`);
const tables = (await sql(`select c.table_schema || '.' || c.table_name t from information_schema.columns c join information_schema.tables x
  on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
  where c.table_schema in ('public', 'capture', 'app') and c.column_name = 'tenant_id' order by 1`)).map((r) => r.t).filter((t) => t !== "public.tenant");

const gone = `tenant_id is not null and tenant_id not in (${keepList})`;
const CHILD = {   // tables without tenant_id, deleted through their parent
  "capture.response_item": `response_id in (select response_id from capture.response where ${gone})`,
  "capture.response_allocation": `response_id in (select response_id from capture.response where ${gone})`,
  "capture.response_text": `response_id in (select response_id from capture.response where ${gone})`,
  "capture.response_360_item": `response_id in (select response_id from capture.response_360 where ${gone})`,
  "app.engagement_assignment": `engagement_id in (select engagement_id from public.engagement where ${gone})`,
};
// logins to delete: test logins (cdp-demo.example) that are not protected and have no membership on a kept tenant, including
// leftovers with no membership at all
const USERS = `select u.id from auth.users u where u.email not in (${protList}) and u.email like '%@cdp-demo.example'
  and not exists (select 1 from app.membership m where m.user_id = u.id and (m.tenant_id is null or m.tenant_id in (${keepList})))`;

const counts = {};
for (const [t, w] of Object.entries(CHILD)) counts[t] = (await sql(`select count(*)::int n from ${t} where ${w}`))[0].n;
for (const t of tables) counts[t] = (await sql(`select count(*)::int n from ${t} where ${gone}`))[0].n;
counts["public.tenant"] = (await sql(`select count(*)::int n from public.tenant where tenant_id not in (${keepList})`))[0].n;
counts["auth.users"] = (await sql(`select count(*)::int n from (${USERS}) x`))[0].n;
const remaining = await sql(`select split_part(email, '@', 1) who from auth.users u where id not in (${USERS}) order by 1`);
const r2 = (await sql(`select count(*)::int n from public.action_evidence where file_key is not null and ${gone}`))[0].n;

console.log(`keeping ${kept.length} clients: ${kept.map((k) => k.name).join("; ")}`);
for (const [t, n] of Object.entries(counts)) if (n) console.log(`  ${t.padEnd(32)} ${n}`);
console.log(`logins kept: ${remaining.map((x) => x.who).join(", ")}`);
console.log(`evidence files in R2 for deleted clients: ${r2}`);
if (!apply) { console.log("\nDry run. Nothing changed. Add --apply to delete."); process.exit(0); }

// ---------------------------------------------------------------- backup
const backup = { taken_at: new Date().toISOString(), keep: KEEP, rows: {} };
for (const [t, w] of Object.entries(CHILD)) backup.rows[t] = await sql(`select * from ${t} where ${w}`);
for (const t of tables) backup.rows[t] = await sql(`select * from ${t} where ${gone}`);
backup.rows["public.tenant"] = await sql(`select * from public.tenant where tenant_id not in (${keepList})`);
backup.rows["auth.users"] = await sql(`select id, email, created_at from auth.users where id in (${USERS})`);
backup.rows["app.user_profile"] = await sql(`select * from app.user_profile where user_id in (${USERS})`);
const file = new URL(`../context-sessions/cleanup-backup-${backup.taken_at.slice(0, 19).replace(/:/g, "")}.json.gz`, import.meta.url).pathname;
writeFileSync(file, gzipSync(JSON.stringify(backup)));
console.log(`backup written: ${file}`);

// ---------------------------------------------------------------- delete client data in one transaction
const ids = backup.rows["auth.users"].map((u) => `'${u.id}'`).join(",") || "null";
await sql(`begin;
set local session_replication_role = replica;
${Object.entries(CHILD).map(([t, w]) => `delete from ${t} where ${w};`).join("\n")}
delete from app.engagement_assignment where user_id in (${ids});
delete from app.user_profile where user_id in (${ids});
${tables.map((t) => `delete from ${t} where ${gone};`).join("\n")}
delete from public.tenant where tenant_id not in (${keepList});
commit;`);
// ---------------------------------------------------------------- then the logins, in normal mode (auth cascades run)
await sql(`delete from auth.users where id in (${ids})`);
// ---------------------------------------------------------------- evidence files of deleted clients in R2 (keys from the backup)
const keys = backup.rows["public.action_evidence"].map((e) => e.file_key).filter(Boolean);
if (keys.length) {
  const { AwsClient } = await import("aws4fetch");
  const { R2_ACCOUNT_ID: acc, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  if (!acc || !id || !secret || !bucket) console.log(`${keys.length} R2 files not removed: R2 settings missing (run with --env-file=apps/web/.env.local)`);
  else {
    const aws = new AwsClient({ accessKeyId: id, secretAccessKey: secret, service: "s3", region: "auto" });
    let ok = 0;
    for (const k of keys) { const r = await aws.fetch(`https://${acc}.r2.cloudflarestorage.com/${bucket}/${k.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" }); if (r.ok || r.status === 404) ok++; }
    console.log(`R2: ${ok} of ${keys.length} evidence files removed`);
  }
}

const left = (await sql(`select count(*)::int t from public.tenant`))[0].t;
const users = (await sql(`select count(*)::int n from auth.users`))[0].n;
const orphans = [];
for (const t of tables) { const n = (await sql(`select count(*)::int n from ${t} x where x.tenant_id is not null and not exists (select 1 from public.tenant y where y.tenant_id = x.tenant_id)`))[0].n; if (n) orphans.push(`${t} ${n}`); }
console.log(`done: ${left} clients and ${users} logins remain; orphan rows: ${orphans.join(", ") || "none"}`);
