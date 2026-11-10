-- Follows 20261023050000. The service key has no direct write on person_of_record or location (the organisation data is written only through functions), so
-- role tags and location countries are written by these two security definer functions. Each one checks the caller itself, like rpc_nominations_replace:
-- an active PAC consultant assigned to the engagement, or the organisation's Client Admin. Callable by the service key only.

create function public.rpc_role_tags_set(p_actor uuid, p_engagement text, p_tags jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e record; x record; pid text; cur text; changed int := 0; total int := 0;
begin
  select * into e from public.engagement where engagement_id = p_engagement;
  if not found then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_actor is null or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true)
     or not (exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = p_engagement and now() >= g.valid_from and now() < g.valid_to)
             or exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = e.tenant_id and m.role = 'CLIENT_ADMIN')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_tags) <> 'array' or jsonb_array_length(p_tags) > 5000 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'tags'; end if;
  for x in select * from jsonb_to_recordset(p_tags) as t(employee_ref text, role_tag text) loop
    total := total + 1;
    if x.role_tag is not null and x.role_tag not in ('STAFF', 'LEADER', 'EXECUTIVE') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'role_tag'; end if;
    select person_id, role_tag into pid, cur from public.person_of_record where tenant_id = e.tenant_id and employee_ref = x.employee_ref;
    if pid is null then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown person'; end if;
    if cur is distinct from x.role_tag then
      -- the tag is written on the survey link when it is issued: nobody who has a link can be re tagged
      if exists (select 1 from public.invitation_roster r where r.person_id = pid) then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = x.employee_ref; end if;
      update public.person_of_record set role_tag = x.role_tag where person_id = pid;
      changed := changed + 1;
    end if;
  end loop;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (e.tenant_id, p_actor, 'org.role_tags_set:' || changed, 'engagement', p_engagement);
  return jsonb_build_object('changed', changed, 'unchanged', total - changed);
end $$;

create function public.rpc_location_countries_set(p_actor uuid, p_engagement text, p_locations jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e record; x record; n int := 0; geo text[];
begin
  select * into e from public.engagement where engagement_id = p_engagement;
  if not found then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_actor is null or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true)
     or not (exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = p_engagement and now() >= g.valid_from and now() < g.valid_to)
             or exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = e.tenant_id and m.role = 'CLIENT_ADMIN')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select geographies into geo from public.tenant where tenant_id = e.tenant_id;
  for x in select * from jsonb_to_recordset(p_locations) as t(name text, country text) loop
    if x.country is not null and not (x.country = any (geo)) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'country not one of the organisation''s countries'; end if;
    update public.location set country = x.country where tenant_id = e.tenant_id and name = x.name;
    if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown location'; end if;
    n := n + 1;
  end loop;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (e.tenant_id, p_actor, 'org.location_countries_set:' || n, 'engagement', p_engagement);
  return jsonb_build_object('updated', n);
end $$;

revoke execute on function public.rpc_role_tags_set(uuid, text, jsonb), public.rpc_location_countries_set(uuid, text, jsonb) from public, anon, authenticated;
grant  execute on function public.rpc_role_tags_set(uuid, text, jsonb), public.rpc_location_countries_set(uuid, text, jsonb) to service_role;
