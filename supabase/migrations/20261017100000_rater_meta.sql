-- 25 Leadership 360 rater context. Approved 17 Oct 2026.
--   * Two optional questions at the start of a rater form: how long the rater has worked with the leader, and how often they
--     are in contact. Stored as bands on capture.response_360 (rater forms only), never shown per rater.
--   * capture.submit_360 gains p_meta; the old two argument call keeps working (meta defaults to none).
--   * capture.rater_meta_360 returns counts per band, per leader, only after the data is frozen and only for leaders with at
--     least the rater floor (3) of rater forms, so a band count can never point to one person. Service role only.

alter table capture.response_360
  add column known_for text check (known_for is null or known_for in ('LT1Y', 'Y1_3', 'Y3P')),
  add column contact   text check (contact is null or contact in ('DAILY', 'WEEKLY', 'MONTHLY', 'RARELY')),
  add constraint response_360_meta_rater_only check (kind = 'RATER' or (known_for is null and contact is null));

drop function public.rpc_submit_360(text, jsonb);
drop function capture.submit_360(text, jsonb);

create function capture.submit_360(p_token text, p_ratings jsonb, p_meta jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare inv record; a record; rid text; i int; v jsonb; kf text; ct text;
begin
  select * into inv from capture.invitation_360 where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if inv.submitted_at is not null then raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001'; end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_ratings) <> 'array' or jsonb_array_length(p_ratings) <> 60 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a 360 form has exactly 60 items';
  end if;
  if p_meta is not null and jsonb_typeof(p_meta) <> 'object' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'meta'; end if;
  kf := case when inv.kind = 'RATER' then nullif(p_meta ->> 'known_for', '') end;
  ct := case when inv.kind = 'RATER' then nullif(p_meta ->> 'contact', '') end;
  insert into capture.response_360 (tenant_id, assessment_id, assignment_id, kind, rater_group, known_for, contact)
  values (inv.tenant_id, inv.assessment_id, inv.assignment_id, inv.kind, inv.rater_group, kf, ct) returning response_id into rid;
  for i in 0 .. 59 loop
    v := p_ratings -> i;
    if v is null or jsonb_typeof(v) = 'null' then
      if inv.kind = 'SELF' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'all 60 self items are required'; end if;
      continue;
    end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[1-5]$' then raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = '360'; end if;
    insert into capture.response_360_item (response_id, idx, value) values (rid, i + 1, (v #>> '{}')::int);
  end loop;
  update capture.invitation_360 set submitted_at = now(), person_id = null, person_link_destroyed_at = now() where invitation_id = inv.invitation_id;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'rater context';
end $$;

create function capture.rater_meta_360(p_assessment_id text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare out jsonb;
begin
  if not exists (select 1 from public.assessment where assessment_id = p_assessment_id and frozen_at is not null) then
    raise exception 'DATA_NOT_FROZEN' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into out from (
    select r.assignment_id, count(*) as raters,
           jsonb_build_object('LT1Y', count(*) filter (where known_for = 'LT1Y'), 'Y1_3', count(*) filter (where known_for = 'Y1_3'),
                              'Y3P', count(*) filter (where known_for = 'Y3P'), 'NONE', count(*) filter (where known_for is null)) as known_for,
           jsonb_build_object('DAILY', count(*) filter (where contact = 'DAILY'), 'WEEKLY', count(*) filter (where contact = 'WEEKLY'),
                              'MONTHLY', count(*) filter (where contact = 'MONTHLY'), 'RARELY', count(*) filter (where contact = 'RARELY'),
                              'NONE', count(*) filter (where contact is null)) as contact
    from capture.response_360 r
    where r.assessment_id = p_assessment_id and r.kind = 'RATER'
    group by r.assignment_id
    having count(*) >= 3
  ) x;
  return out;
end $$;

revoke execute on function capture.submit_360(text, jsonb, jsonb), capture.rater_meta_360(text) from public, anon, authenticated;
grant  execute on function capture.submit_360(text, jsonb, jsonb), capture.rater_meta_360(text) to service_role;

create function public.rpc_submit_360(p_token text, p_ratings jsonb, p_meta jsonb default '{}'::jsonb) returns void language sql security invoker set search_path = ''
as $$ select capture.submit_360(p_token, p_ratings, p_meta) $$;
create function public.rpc_rater_meta_360(p_assessment_id text) returns jsonb language sql security invoker set search_path = ''
as $$ select capture.rater_meta_360(p_assessment_id) $$;
revoke execute on function public.rpc_submit_360(text, jsonb, jsonb), public.rpc_rater_meta_360(text) from public, anon, authenticated;
grant  execute on function public.rpc_submit_360(text, jsonb, jsonb), public.rpc_rater_meta_360(text) to service_role;
