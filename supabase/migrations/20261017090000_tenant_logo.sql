-- 24 Client logo for co branded reports. Approved 17 Oct 2026 (logo held on the tenant row, no file store).
--   * tenant.logo_data holds the image itself: PNG or JPEG, at most 200 KB, both checked here. No storage bucket, so no new
--     processor and no extra transfer basis.
--   * Set or cleared only through rpc_tenant_logo_set, called by the server with the signed in user's id: a Client Admin of the
--     tenant, or a PAC Consultant assigned to one of its engagements. Every change is audit logged.
--   * Reports and exports read it with the service role after their own access checks; it is not secret.

alter table public.tenant
  add column logo_data bytea check (logo_data is null or octet_length(logo_data) between 1 and 204800),
  add column logo_type text check (logo_type is null or logo_type in ('image/png', 'image/jpeg')),
  add constraint tenant_logo_complete check ((logo_data is null) = (logo_type is null));

create function public.rpc_tenant_logo_set(p_actor uuid, p_tenant text, p_data bytea, p_type text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (app.client_admin_of(p_actor, p_tenant) or exists (
      select 1 from public.engagement e where e.tenant_id = p_tenant and app.is_active_assignee(p_actor, e.engagement_id))) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.tenant set logo_data = p_data, logo_type = p_type where tenant_id = p_tenant;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
  values (p_tenant, p_actor, case when p_data is null then 'tenant.logo_cleared' else 'tenant.logo_set' end, 'tenant', p_tenant);
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'the logo must be a PNG or JPEG of at most 200 KB';
end $$;
revoke execute on function public.rpc_tenant_logo_set(uuid, text, bytea, text) from public, anon, authenticated;
grant  execute on function public.rpc_tenant_logo_set(uuid, text, bytea, text) to service_role;
