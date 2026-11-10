-- 17 Evidence files in Cloudflare R2 (bucket pac-cdp, Western Europe). Approved 11 Oct 2026 (storage: R2 for all files).
--   * action_evidence gains the stored file: R2 object key, original name, size and type. A row has a link or a file, or neither
--     (a described record), never both. The key always sits under evidence/<tenant>/<action>/, which the database checks.
--   * Files go straight from the browser to R2 with a 5-minute signed upload link; the server then checks the object (size
--     and type) before it records the row. Downloads are 5-minute signed links, issued only to someone who can read the row.
--   * Data transfer note: R2 is a separate processor from Supabase. The bucket is in Cloudflare's Western Europe location
--     without the EU jurisdiction lock, so a transfer basis covering Cloudflare must be recorded per tenant (spec §1.4.5).

alter table public.action_evidence
  add column file_key  text check (file_key is null or (length(file_key) <= 300 and file_key ~ '^evidence/ten_[a-z0-9]+/act_[a-z0-9]+/[A-Za-z0-9._-]+$')),
  add column file_name text check (file_name is null or length(file_name) between 1 and 200),
  add column file_size bigint check (file_size is null or file_size between 1 and 20971520),
  add column content_type text check (content_type is null or content_type in (
    'application/pdf', 'image/png', 'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint')),
  add constraint evidence_link_or_file check (link is null or file_key is null),
  add constraint evidence_file_complete check ((file_key is null) = (file_name is null) and (file_key is null) = (file_size is null) and (file_key is null) = (content_type is null)),
  add constraint evidence_file_key_unique unique (file_key);

create function app.evidence_key_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.file_key is not null and new.file_key not like 'evidence/' || new.tenant_id || '/' || new.action_id || '/%' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'the file does not belong to this action';
  end if;
  return new;
end $$;
create trigger action_evidence_key before insert on public.action_evidence for each row execute function app.evidence_key_guard();

drop function public.rpc_evidence_add(uuid, text, text, text, text);
create function public.rpc_evidence_add(p_actor uuid, p_action text, p_kind text, p_description text, p_link text,
  p_file_key text default null, p_file_name text default null, p_file_size bigint default null, p_content_type text default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare r record; eid text;
begin
  select * into r from public.action where action_id = p_action;
  if not found or not app.on_engagement(p_actor, r.assessment_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status not in ('PUBLISHED', 'IN_PROGRESS', 'UNDER_REVIEW') then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'evidence is added once the action is published'; end if;
  insert into public.action_evidence (tenant_id, action_id, kind, description, link, file_key, file_name, file_size, content_type, created_by)
  values (r.tenant_id, p_action, p_kind, btrim(p_description), nullif(btrim(p_link), ''), p_file_key, p_file_name, p_file_size, p_content_type, p_actor)
  returning evidence_id into eid;
  return eid;
exception when check_violation or unique_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'evidence';
end $$;
revoke execute on function public.rpc_evidence_add(uuid, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
grant  execute on function public.rpc_evidence_add(uuid, text, text, text, text, text, text, bigint, text) to service_role;
