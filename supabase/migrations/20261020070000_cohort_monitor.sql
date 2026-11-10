-- Journey 2, slice S8 (owner approved 19 October 2026): the response monitor by cohort (S2-15, S2.6.5-005, AC-2.7).
-- Counts only. A cohort is the department on the demographic snapshot: unsubmitted links still carry it on the invitation, submitted
-- answers carry it on the response (the invitation's copy is cleared at submit). A cohort with fewer than p_floor invited is never
-- returned on its own; those are added together into one "suppressed" figure. Nothing lists who has or has not responded.
-- The daily trend is whole survey submissions per day.
create function capture.cohort_counts(p_assessment_id text, p_floor int) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with c as (
    select coalesce(nullif(demographic_snapshot_json ->> 'department', ''), 'Not recorded') as cohort,
           1 as invited, (started_at is not null)::int as started, 0 as submitted
      from capture.invitation where assessment_id = p_assessment_id and submitted_at is null
    union all
    select coalesce(nullif(demographic_snapshot_json ->> 'department', ''), 'Not recorded'), 1, 1, 1
      from capture.response where assessment_id = p_assessment_id
  ), g as (
    select cohort, sum(invited)::int invited, sum(started)::int started, sum(submitted)::int submitted from c group by cohort
  )
  select jsonb_build_object(
    'floor', greatest(p_floor, 5),
    'cohorts', coalesce((select jsonb_agg(jsonb_build_object('cohort', cohort, 'invited', invited, 'started', started, 'submitted', submitted) order by cohort)
                          from g where invited >= greatest(p_floor, 5)), '[]'::jsonb),
    'suppressed', jsonb_build_object('cohorts', (select count(*) from g where invited < greatest(p_floor, 5)),
                                     'invited', coalesce((select sum(invited) from g where invited < greatest(p_floor, 5)), 0)),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'submitted', n) order by d)
                         from (select submitted_at::date d, count(*) n from capture.response where assessment_id = p_assessment_id group by 1) x), '[]'::jsonb))
$$;
revoke execute on function capture.cohort_counts(text, int) from public, anon, authenticated;
grant  execute on function capture.cohort_counts(text, int) to service_role;
create function public.rpc_cohort_counts(p_assessment_id text, p_floor int) returns jsonb
language sql security invoker set search_path = ''
as $$ select capture.cohort_counts(p_assessment_id, p_floor) $$;
revoke execute on function public.rpc_cohort_counts(text, int) from public, anon, authenticated;
grant  execute on function public.rpc_cohort_counts(text, int) to service_role;

-- Freeze manifest (S2.7-001, S2.6.2-010, AC-2.8): written once by the freeze route next to response_set_hash. Counts by completion state
-- (engine, under the assessment's rules version), invited, started, abandoned, voided, the versions and the window extensions.
alter table public.assessment add column freeze_manifest jsonb;

-- J1 follow up (owner ruling 19 October 2026): one currency per client; money KPIs take it.
alter table public.tenant add column currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$');
