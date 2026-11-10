// UT-44 as a database test (spec 1.4.5, 6.6.3): destruction removes response level data, leaves score object, report and plan, writes an immutable
// certificate, refuses a second call and refuses a call before the retention date. Also: the engine's dates for a given window close.
// It runs inside ONE database statement that always ends in an error, so everything it writes (schedule, deletions, certificate) is rolled back and
// no client data is lost. Only row counts are read, never a response.
//   node scripts/e2e-retention.mjs <project-ref> <token-file>
import { readFileSync } from "node:fs";
import * as E from "@pac/cdp-engine";
import { ok, done } from "./lib/e2e.mjs";

const [ref, tokenFile] = process.argv.slice(2);
const key = readFileSync(tokenFile, "utf8").replace(/[\r\n]/g, "");
const SQL = `
do $$
declare a text; e text; t text; r jsonb := '{}'::jsonb; c jsonb; n int;
  cnt jsonb;
begin
  select x.assessment_id, x.engagement_id, x.tenant_id into a, e, t from public.assessment x
   where exists (select 1 from public.score_object s where s.assessment_id = x.assessment_id)
     and exists (select 1 from public.report s where s.assessment_id = x.assessment_id)
     and exists (select 1 from public.plan s where s.assessment_id = x.assessment_id)
     and exists (select 1 from capture.response s where s.assessment_id = x.assessment_id)
     and not exists (select 1 from public.retention_schedule s where s.engagement_id = x.engagement_id)
   limit 1;
  if a is null then raise exception 'RESULT:%', '{"error":"no suitable assessment"}'; end if;
  cnt := jsonb_build_object('response', (select count(*) from capture.response where assessment_id = a),
    'invitation', (select count(*) from capture.invitation where assessment_id = a),
    'score_object', (select count(*) from public.score_object where assessment_id = a),
    'report', (select count(*) from public.report where assessment_id = a),
    'plan', (select count(*) from public.plan where assessment_id = a));
  r := r || jsonb_build_object('before', cnt);
  begin perform public.rpc_destroy_responses(e); r := r || '{"not_scheduled":"allowed"}'; exception when others then r := r || jsonb_build_object('not_scheduled', sqlerrm); end;
  insert into public.retention_schedule (engagement_id, tenant_id, assessment_id, close_date, destroy_on, notice_90_on, notice_30_on)
    values (e, t, a, current_date - 700, current_date + 10, current_date - 80, current_date - 20);
  begin perform public.rpc_destroy_responses(e); r := r || '{"before_due":"allowed"}'; exception when others then r := r || jsonb_build_object('before_due', sqlerrm); end;
  r := r || jsonb_build_object('after_refused', (select count(*) from capture.response where assessment_id = a));
  update public.retention_schedule set destroy_on = current_date - 1 where engagement_id = e;
  c := public.rpc_destroy_responses(e);
  r := r || jsonb_build_object('cert', c);
  r := r || jsonb_build_object('after', jsonb_build_object('response', (select count(*) from capture.response where assessment_id = a),
    'invitation', (select count(*) from capture.invitation where assessment_id = a),
    'score_object', (select count(*) from public.score_object where assessment_id = a),
    'report', (select count(*) from public.report where assessment_id = a),
    'plan', (select count(*) from public.plan where assessment_id = a)),
    'certs', (select count(*) from public.destruction_certificate where engagement_id = e),
    'destroyed_at_set', (select destroyed_at is not null from public.retention_schedule where engagement_id = e));
  begin perform public.rpc_destroy_responses(e); r := r || '{"second":"allowed"}'; exception when others then r := r || jsonb_build_object('second', sqlerrm); end;
  begin update public.destruction_certificate set row_counts = '{}' where engagement_id = e; r := r || '{"cert_edit":"allowed"}'; exception when others then r := r || jsonb_build_object('cert_edit', sqlerrm); end;
  raise exception 'RESULT:%:END', r::text;
end $$;`;
const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify({ query: SQL }) });
const text = await resp.text();
const m = /RESULT:(\{.*\}):END/s.exec(text.replace(/\\"/g, '"'));
const r = m ? JSON.parse(m[1].replace(/\\n/g, "")) : null;
ok("the database test ran and rolled back (result returned through the error)", !!r && !r.error, text.slice(0, 300));
if (r && !r.error) {
  ok("there were responses to destroy", r.before.response > 0, JSON.stringify(r.before));
  ok("a call before the retention schedule exists is refused (RETENTION_NOT_SCHEDULED)", /RETENTION_NOT_SCHEDULED/.test(r.not_scheduled), r.not_scheduled);
  ok("a call before the retention date is refused (RETENTION_NOT_DUE)", /RETENTION_NOT_DUE/.test(r.before_due), r.before_due);
  ok("the refused call destroyed nothing", r.after_refused === r.before.response, r.after_refused);
  ok("responses and invitations are gone after destruction", r.after.response === 0 && r.after.invitation === 0, JSON.stringify(r.after));
  ok("the score object, report and plan remain untouched", ["score_object", "report", "plan"].every((k) => r.after[k] === r.before[k] && r.after[k] > 0), JSON.stringify(r.after));
  ok("a certificate exists with the row counts and a hash", r.certs === 1 && r.cert.cert_id && r.cert.cert_hash?.length === 64 && r.cert.row_counts.response === r.before.response, JSON.stringify(r.cert));
  ok("the schedule is marked destroyed", r.destroyed_at_set === true);
  ok("a second call is refused (ALREADY_DESTROYED)", /ALREADY_DESTROYED/.test(r.second), r.second);
  ok("the certificate cannot be edited (CERTIFICATE_IMMUTABLE)", /CERTIFICATE_IMMUTABLE/.test(r.cert_edit), r.cert_edit);
}
// the dates come from the engine: 24 months, notices 90 and 30 days before
const s = E.retentionSchedule("2026-11-30");
ok("engine dates: destroy 24 months after close, notices at 90 and 30 days before", s.destroy_on === "2028-11-30" && s.notice_90 === "2028-09-01" && s.notice_30 === "2028-10-31", JSON.stringify(s));
done();
