-- 18 People Leader own-team view (gap 12). Approved 11 Oct 2026.
--   * A People Leader login is linked to a person on the roster (app.membership.person_id), one login per person, by a Super
--     Admin or the tenant's Client Admin. The person must be ACTIVE in the same tenant.
--   * New survey links also record the person's team in the snapshot (key 'team'), so results can be cut by team.
--   * A People Leader reads their own Leadership 360 result and their own AGREED development plan, after release; nothing else
--     new. Team culture results are computed by the server from the frozen set and only for a team with 5 or more answers.

create unique index membership_person_unique on app.membership (tenant_id, person_id) where person_id is not null;

create function app.my_person() returns text
language sql stable security definer set search_path = ''
as $$ select m.person_id from app.membership m where m.user_id = auth.uid() $$;
revoke execute on function app.my_person() from public, anon;
grant execute on function app.my_person() to authenticated;

-- p_person null unlinks.
create function public.rpc_user_link_person(p_actor uuid, p_user uuid, p_person text) returns void
language plpgsql security definer set search_path = ''
as $$
declare m record;
begin
  select * into m from app.membership where user_id = p_user;
  if not found or m.role <> 'PEOPLE_LEADER' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'only a People Leader login is linked to a person'; end if;
  if not app.manage_check(p_actor, 'PEOPLE_LEADER', m.tenant_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_person is not null and not exists (select 1 from public.person_of_record p where p.person_id = p_person and p.tenant_id = m.tenant_id and p.employment_status = 'ACTIVE') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'the person is not active in this organisation';
  end if;
  update app.membership set person_id = p_person where user_id = p_user;
  perform app.audit_user(m.tenant_id, p_actor, case when p_person is null then 'user.unlinked_person' else 'user.linked_person' end, p_user);
exception when unique_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'that person is already linked to another login';
end $$;
revoke execute on function public.rpc_user_link_person(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.rpc_user_link_person(uuid, uuid, text) to service_role;

-- the list now carries the linked person
create or replace function public.rpc_users_list(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare sa boolean; t text;
begin
  sa := exists (select 1 from app.platform_admin where user_id = p_actor) and exists (select 1 from app.user_profile where user_id = p_actor and active);
  select m.tenant_id into t from app.membership m join app.user_profile p using (user_id)
   where m.user_id = p_actor and m.role = 'CLIENT_ADMIN' and p.active;
  if not sa and t is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.role, x.email) from (
    select p.user_id, u.email::text as email, p.full_name,
           case when pa.user_id is not null then 'SUPER_ADMIN' when m.user_id is not null then m.role::text else 'PAC_CONSULTANT' end as role,
           m.tenant_id, tn.name as tenant_name, m.person_id, per.display_name as person_name, p.active, p.must_change_password, p.created_at, u.last_sign_in_at,
           coalesce((select jsonb_agg(jsonb_build_object('assignment_id', a.assignment_id, 'engagement_id', a.engagement_id,
                        'tenant_name', te.name, 'valid_from', a.valid_from, 'valid_to', a.valid_to) order by a.valid_to desc)
                     from app.engagement_assignment a
                     join public.engagement e on e.engagement_id = a.engagement_id
                     join public.tenant te on te.tenant_id = e.tenant_id
                     where a.user_id = p.user_id), '[]'::jsonb) as assignments
    from app.user_profile p
    join auth.users u on u.id = p.user_id
    left join app.platform_admin pa on pa.user_id = p.user_id
    left join app.membership m on m.user_id = p.user_id
    left join public.tenant tn on tn.tenant_id = m.tenant_id
    left join public.person_of_record per on per.person_id = m.person_id and per.tenant_id = m.tenant_id
    where sa or m.tenant_id = t
  ) x), '[]'::jsonb);
end $$;

-- survey links record the team
create or replace function capture.issue_person_invitations(p_assessment_id text, p_people text[], p_expires_at timestamptz default null)
returns table (person_id text, token text)
language plpgsql security definer set search_path = ''
as $$
declare
  a record; pid text; tok text; snap jsonb; rec record; months int; band text;
begin
  if p_people is null or coalesce(array_length(p_people, 1), 0) not between 1 and 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'people must be 1..5000';
  end if;
  select * into a from public.assessment where assessment_id = p_assessment_id for update;
  if not found or a.status <> 'LAUNCHED' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  foreach pid in array p_people loop
    select p.person_id, p.employment_status, p.start_date, g.name as grade, g.is_executive,
           (with recursive up as (
              select u0.unit_id, u0.parent_unit_id, u0.type, u0.name, 0 as d from public.org_unit u0 where u0.unit_id = p.unit_id
              union all
              select u1.unit_id, u1.parent_unit_id, u1.type, u1.name, up.d + 1
              from public.org_unit u1 join up on u1.unit_id = up.parent_unit_id where up.d < 10)
            select coalesce((select up.name from up where up.type = 'DEPARTMENT' order by up.d limit 1),
                            (select up.name from up where up.d = 0))) as department,
           (with recursive up as (
              select u0.unit_id, u0.parent_unit_id, u0.type, u0.name, 0 as d from public.org_unit u0 where u0.unit_id = p.unit_id
              union all
              select u1.unit_id, u1.parent_unit_id, u1.type, u1.name, up.d + 1
              from public.org_unit u1 join up on u1.unit_id = up.parent_unit_id where up.d < 10)
            select coalesce((select up.name from up where up.type = 'TEAM' order by up.d limit 1), (select up.name from up where up.d = 0))) as team
      into rec
      from public.person_of_record p
      left join public.grade_band g on g.grade_id = p.grade_id and g.tenant_id = p.tenant_id
      where p.person_id = pid and p.tenant_id = a.tenant_id;
    if rec.person_id is null or rec.employment_status <> 'ACTIVE' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a person is unknown, not active, or in another organisation';
    end if;
    begin
      insert into public.invitation_roster (assessment_id, tenant_id, person_id) values (a.assessment_id, a.tenant_id, pid);
    exception when unique_violation then
      raise exception 'ALREADY_INVITED' using errcode = 'P0001';
    end;
    band := null;
    if rec.start_date is not null then
      months := (extract(year from age(coalesce(a.window_open, now())::date, rec.start_date)) * 12
               + extract(month from age(coalesce(a.window_open, now())::date, rec.start_date)))::int;
      select tb.name into band from public.tenure_band tb
        where tb.tenant_id = a.tenant_id and months >= tb.min_months and (tb.max_months is null or months < tb.max_months);
    end if;
    snap := jsonb_build_object(
      'department', coalesce(rec.department, 'UNKNOWN'),
      'team', coalesce(rec.team, 'UNKNOWN'),
      'grade', coalesce(rec.grade, 'UNKNOWN'),
      'tenure_band', coalesce(band, 'UNKNOWN'),
      'is_executive', coalesce(rec.is_executive, false));
    tok := encode(extensions.gen_random_bytes(16), 'hex');                       -- 128 bits
    insert into capture.invitation (tenant_id, assessment_id, kind, token_hash, person_id, demographic_snapshot_json, sent_at, expires_at)
    values (a.tenant_id, a.assessment_id, 'SURVEY', extensions.digest(tok, 'sha256'), pid, snap, now(),
            coalesce(p_expires_at, a.window_close, now() + interval '30 days'));
    person_id := pid; token := tok;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------- the leader's own 360 result and agreed development plan
-- leader_assignment is closed to People Leaders, so the caller's own assignments come from a definer helper
create function app.my_assignments() returns setof text
language sql stable security definer set search_path = ''
as $$ select la.assignment_id from public.leader_assignment la where la.person_id = (select m.person_id from app.membership m where m.user_id = auth.uid()) $$;
revoke execute on function app.my_assignments() from public, anon;
grant execute on function app.my_assignments() to authenticated;

create policy leader_result_own on public.leader_result for select to authenticated using (
  (select app.client_role()) = 'PEOPLE_LEADER' and tenant_id = (select app.client_tenant_id())
  and (select app.score_released(assessment_id, score_version))
  and assignment_id in (select app.my_assignments()));
create policy development_item_own on public.development_item for select to authenticated using (
  (select app.client_role()) = 'PEOPLE_LEADER' and tenant_id = (select app.client_tenant_id()) and agreed_at is not null
  and (select app.score_released(assessment_id, score_version))
  and assignment_id in (select app.my_assignments()));
-- the caller's own link and assignments for route handlers (invoker: they report on auth.uid() and nobody else)
create function public.rpc_my_person() returns text language sql stable security invoker set search_path = ''
as $$ select app.my_person() $$;
create function public.rpc_my_assignments() returns setof text language sql stable security invoker set search_path = ''
as $$ select app.my_assignments() $$;
revoke execute on function public.rpc_my_person(), public.rpc_my_assignments() from public, anon;
grant  execute on function public.rpc_my_person(), public.rpc_my_assignments() to authenticated;
