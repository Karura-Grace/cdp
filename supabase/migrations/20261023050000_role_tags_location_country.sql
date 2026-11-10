-- Journeys 3 and 4 follow ups (owner rulings of 22 October 2026, Erick Ngala comments 34 and 39; rounds Q-SV3 and Q-SV4 in context-sessions/DECISIONS-LOG.md).
--   1. person_of_record.role_tag (STAFF, LEADER or EXECUTIVE, null = not set): the Client Admin tags people for the Leadership 360. The tag WINS for the
--      executive cohort when set, otherwise the grade flag decides. LEADER tags nobody a leader on their own: leaders still need a team in the leaders file.
--   2. location.country (two letter code, must be one of the organisation's countries, checked by the route): results can be cut by country.
--   3. capture.issue_person_invitations: the link snapshot gains 'country', and is_executive follows the tag. A link keeps the snapshot it was issued
--      with, so a person's tag is refused (409 by the route) once they have been issued a link in any assessment.
alter table public.person_of_record add column role_tag text check (role_tag is null or role_tag in ('STAFF', 'LEADER', 'EXECUTIVE'));
alter table public.location add column country text check (country is null or country ~ '^[A-Z]{2}$');

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
    select p.person_id, p.employment_status, p.start_date, g.name as grade, case p.role_tag when 'EXECUTIVE' then true when 'STAFF' then false when 'LEADER' then false else g.is_executive end as is_executive,
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
            select coalesce((select up.name from up where up.type = 'TEAM' order by up.d limit 1), (select up.name from up where up.d = 0))) as team,
           (with recursive up as (
              select u0.unit_id, u0.parent_unit_id, u0.type, u0.name, 0 as d from public.org_unit u0 where u0.unit_id = p.unit_id
              union all
              select u1.unit_id, u1.parent_unit_id, u1.type, u1.name, up.d + 1
              from public.org_unit u1 join up on u1.unit_id = up.parent_unit_id where up.d < 10)
            select up.name from up where up.type = 'DIVISION' order by up.d limit 1) as division,
           (select l.name from public.location l where l.location_id = p.location_id and l.tenant_id = p.tenant_id) as location,
           (select l.country from public.location l where l.location_id = p.location_id and l.tenant_id = p.tenant_id) as country
      into rec
      from public.person_of_record p
      left join public.grade_band g on g.grade_id = p.grade_id and g.tenant_id = p.tenant_id
      where p.person_id = pid and p.tenant_id = a.tenant_id;
    if rec.person_id is null or rec.employment_status <> 'ACTIVE' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a person is unknown, not active, or in another organisation';
    end if;
    -- Decision of 18 October 2026: an objection blocks further links to that person (open or done). The person is skipped, not refused, so a roster run goes on for everyone else.
    if exists (select 1 from public.data_subject_request r join public.person_of_record q on q.employee_ref = r.subject_ref and q.tenant_id = r.tenant_id
               where q.person_id = pid and r.tenant_id = a.tenant_id and r.kind = 'OBJECT' and r.status in ('OPEN', 'DONE')) then
      continue;
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
      'division', coalesce(rec.division, 'UNKNOWN'),
      'location', coalesce(rec.location, 'UNKNOWN'),
      'country', coalesce(rec.country, 'UNKNOWN'),
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
