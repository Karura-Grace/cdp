// AC 2.4 inspection, repeatable: after submission no query, log or backup can join a response to a person.
// Inspects the live database catalogue and data through the Supabase Management API (read only queries) and prints one line per check.
//   node scripts/inspect-ac24.mjs <project-ref> <token-file>
// Checks: (1) no table privilege on schema capture for anon, authenticated, service_role or PUBLIC; (2) no person, invitation, token, e-mail
// or name column on any response table; (3) no foreign key from a response table to an invitation or a person; (4) no submitted invitation
// still holds a person or a demographic snapshot (and there are submitted invitations, so the check is not empty); (5) no table outside capture
// carries a response id, invitation id or token hash; (6) no audit log row holds a survey token; (7) which functions the application key may run;
// (8) no encrypted draft remains after its submission or the freeze.
// The Management API token is read from the file and never printed. (Backups: Supabase point in time recovery copies the same tables, so what
// holds for the tables holds for a restore.)
import { readFileSync } from "node:fs";

const [ref, tokenFile] = process.argv.slice(2);
if (!ref || !tokenFile) { console.error("usage: node scripts/inspect-ac24.mjs <project-ref> <token-file>"); process.exit(2); }
const key = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify({ query }) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
let fail = 0;
const line = (n, good, detail = "") => { if (!good) fail++; console.log(good ? "PASS" : "FAIL", n, detail); };

const RESPONSES = "('response','response_allocation','response_item','response_text','pulse_response','response_360','response_360_item','response_360_text')";

const privs = await sql(`select r.rolname, c.relname, p.priv from pg_roles r cross join pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) as p(priv)
  where n.nspname = 'capture' and c.relkind = 'r' and r.rolname in ('anon','authenticated','service_role') and has_table_privilege(r.rolname, c.oid, p.priv)`);
const pub = await sql(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'capture' and c.relkind = 'r'
  and exists (select 1 from aclexplode(c.relacl) a where a.grantee = 0)`);
const tables = (await sql(`select count(*)::int n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'capture' and c.relkind = 'r'`))[0].n;
line("1. no table in capture is readable or writable by anon, authenticated, service_role or PUBLIC", privs.length === 0 && pub.length === 0 && tables >= 10, `${tables} tables; ${privs.length} role grants, ${pub.length} public grants`);

const cols = await sql(`select table_name, column_name from information_schema.columns where table_schema = 'capture' and table_name in ${RESPONSES}
  and column_name ~* '(person|invitation|token|email|name|user)'`);
line("2. no response table has a person, invitation, token, e-mail or name column", cols.length === 0, JSON.stringify(cols));

const fks = await sql(`select conrelid::regclass::text as from_table, confrelid::regclass::text as to_table from pg_constraint
  where contype = 'f' and conrelid::regclass::text in ('capture.response','capture.response_allocation','capture.response_item','capture.response_text','capture.pulse_response','capture.response_360','capture.response_360_item','capture.response_360_text')
  and confrelid::regclass::text ~ '(invitation|person)'`);
line("3. no foreign key from a response table to an invitation or a person", fks.length === 0, JSON.stringify(fks));

const held = await sql(`select
  (select count(*)::int from capture.invitation where submitted_at is not null and (person_id is not null or demographic_snapshot_json <> '{}'::jsonb)) as survey,
  (select count(*)::int from capture.invitation_360 where submitted_at is not null and person_id is not null) as l360,
  (select count(*)::int from capture.pulse_invitation where submitted_at is not null and person_id is not null) as pulse,
  (select count(*)::int from capture.invitation where submitted_at is not null) as survey_done,
  (select count(*)::int from capture.invitation_360 where submitted_at is not null) as l360_done,
  (select count(*)::int from capture.pulse_invitation where submitted_at is not null) as pulse_done`);
const h = held[0];
line("4. no submitted invitation (survey, 360 or pulse) still holds a person or a demographic snapshot", h.survey + h.l360 + h.pulse === 0 && h.survey_done > 0 && h.l360_done > 0 && h.pulse_done > 0,
  `holding a link: ${h.survey}/${h.l360}/${h.pulse}; submitted checked: ${h.survey_done}/${h.l360_done}/${h.pulse_done}`);

const stray = await sql(`select table_schema, table_name, column_name from information_schema.columns where table_schema not in ('capture','pg_catalog','information_schema','auth','storage','realtime','vault','extensions','supabase_migrations','net','pgsodium','pgsodium_masks','graphql','graphql_public','pgbouncer','cron')
  and column_name in ('response_id','invitation_id','token_hash','token')
  and not (table_schema = 'public' and table_name = 'exclusion_log' and column_name = 'response_id')`);
// exclusion_log names the voided response (spec S2.6.1-004); a response row holds no person, so its id leads to nobody
line("5. no table outside capture carries a response id, invitation id or token hash (except the void log response id)", stray.length === 0, JSON.stringify(stray));

const toks = await sql(`select count(*)::int n from public.audit_log where action ~ '[0-9a-f]{32}' or object_id ~ '[0-9a-f]{32}'`);
line("6. no audit log row contains a survey token", toks[0].n === 0, `${toks[0].n} rows`);

const fns = await sql(`select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed, has_function_privilege('service_role', p.oid, 'EXECUTE') as service
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'capture' and p.prosecdef order by 1`);
line("7. no function in capture can be run by anon or authenticated", fns.every((f) => !f.anon && !f.authed), JSON.stringify(fns.filter((f) => f.anon || f.authed).map((f) => f.proname)));
const drafts = await sql(`select count(*)::int n from capture.draft d join capture.invitation i using (invitation_id) left join public.assessment a on a.assessment_id = i.assessment_id
  where i.submitted_at is not null or a.frozen_at is not null`);
line("8. no saved draft outlives its submission or the freeze", drafts[0].n === 0, `${drafts[0].n} drafts`);
console.log("INFO functions the application server key (service_role) can run in capture:", fns.filter((f) => f.service).map((f) => f.proname).join(", "));
const reads = fns.filter((f) => f.service && /frozen|closed_pulse/.test(f.proname)).map((f) => f.proname);
console.log(reads.length ? `INFO AC 3.6 open: the server key can still run the read functions: ${reads.join(", ")}` : "INFO AC 3.6: the server key cannot run any function that returns response rows");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
