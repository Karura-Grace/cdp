-- Journey 2, slice S5 (owner approved 19 October 2026: a read path before freeze, counts only).
--   1. capture.monitor_set: the engine input rows of an OPEN survey (no demographic snapshot, opaque response ids only), owned by
--      scoring_reader like frozen_response_set and callable only with the scoring key. The monitor route runs the engine quality
--      flags on them and returns counts, the median time and flagged response ids, never answers (S2-16, S2.5-003).
--   2. public.exclusion_log (insert only) + capture.void_response: a consultant voids a response with a recorded reason while the
--      survey is open; voided responses are left out of the frozen set and listed in the exclusion log (S2.6.1-004, N2.11.1-ONCE).

-- ponytail: the row shape repeats frozen_response_set without the snapshot; fold both into one function if a third reader appears.
create function capture.monitor_set(p_assessment_id text) returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.assessment where assessment_id = p_assessment_id and status = 'LAUNCHED' and frozen_at is null) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  return query
  select jsonb_build_object(
    'id', r.response_id,
    'duration', r.duration_seconds,
    'alloc', coalesce((
        select jsonb_object_agg(pd.perspective, pd.dims) from (
          select x.perspective,
                 jsonb_object_agg(x.dim, x.sets) as dims
          from (
            select ps.perspective, ps.dim,
                   (select jsonb_agg((select jsonb_object_agg(al.orientation, al.points)
                                      from capture.response_allocation al
                                      where al.response_id = r.response_id and al.perspective = ps.perspective
                                        and al.scenario_id = ps.dim || '-S' || s) order by s)
                    from generate_series(1, 3) s) as sets
            from (select distinct perspective, left(scenario_id, 2) as dim
                  from capture.response_allocation where response_id = r.response_id) ps
          ) x
          group by x.perspective
        ) pd), '{}'::jsonb),
    'likert', coalesce((
        select jsonb_object_agg(d.dim, (select jsonb_agg((select ri.value from capture.response_item ri
                                                          where ri.response_id = r.response_id
                                                            and ri.item_id = d.dim || '-' || lpad(s::text, 2, '0')) order by s)
                                        from generate_series(1, 12) s))
        from (select distinct left(item_id, 2) as dim from capture.response_item
              where response_id = r.response_id and item_id ~ '^D[7-9]-') d), '{}'::jsonb),
    'eos', (select jsonb_agg((select ri.value from capture.response_item ri
                              where ri.response_id = r.response_id and ri.item_id = 'EOS-' || s) order by s)
            from generate_series(1, 8) s)
  )
  from capture.response r
  where r.assessment_id = p_assessment_id and r.voided_reason is null
  order by r.response_id;
end $$;

create table public.exclusion_log (
  exclusion_id  text primary key default app.new_id('exl'),
  tenant_id     text not null references public.tenant(tenant_id),
  assessment_id text not null references public.assessment(assessment_id) on delete cascade,
  response_id   text not null,
  kind          text not null check (kind in ('VOID')),
  reason        text not null check (length(btrim(reason)) between 3 and 1000),
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  unique (response_id, kind)
);
alter table public.exclusion_log enable row level security;
revoke all on public.exclusion_log from anon, authenticated;
grant select on public.exclusion_log to authenticated;
grant select, insert on public.exclusion_log to service_role;    -- insert only
create policy exclusion_log_read on public.exclusion_log for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids()));

create function capture.void_response(p_assessment_id text, p_response_id text, p_reason text, p_actor uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select rs.response_id, rs.assessment_id, rs.tenant_id, rs.voided_reason into r from capture.response rs
   where rs.response_id = p_response_id and rs.assessment_id = p_assessment_id for update;
  if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'response'; end if;
  if not exists (select 1 from public.assessment where assessment_id = r.assessment_id and status = 'LAUNCHED' and frozen_at is null) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;
  if r.voided_reason is not null then raise exception 'ALREADY_DECIDED' using errcode = 'P0001'; end if;
  update capture.response set voided_reason = p_reason where response_id = p_response_id;
  insert into public.exclusion_log (tenant_id, assessment_id, response_id, kind, reason, created_by)
  values (r.tenant_id, r.assessment_id, p_response_id, 'VOID', p_reason, p_actor);
  return r.assessment_id;
end $$;

grant create on schema capture to scoring_reader;
alter function capture.monitor_set(text) owner to scoring_reader;
revoke create on schema capture from scoring_reader;
revoke execute on function capture.monitor_set(text), capture.void_response(text, text, text, uuid) from public, anon, authenticated, service_role;
grant  execute on function capture.monitor_set(text) to scoring_reader;
grant  execute on function capture.void_response(text, text, text, uuid) to service_role;

create function public.rpc_monitor_set(p_assessment_id text) returns setof jsonb
language sql security invoker set search_path = ''
as $$ select * from capture.monitor_set(p_assessment_id) $$;
create function public.rpc_void_response(p_assessment_id text, p_response_id text, p_reason text, p_actor uuid) returns text
language sql security invoker set search_path = ''
as $$ select capture.void_response(p_assessment_id, p_response_id, p_reason, p_actor) $$;
revoke execute on function public.rpc_monitor_set(text), public.rpc_void_response(text, text, text, uuid) from public, anon, authenticated, service_role;
grant  execute on function public.rpc_monitor_set(text) to scoring_reader;
grant  execute on function public.rpc_void_response(text, text, text, uuid) to service_role;
