-- Linking culture actions to scorecard KPIs (spec Table 77 scorecard_kpi_id). The service role has no UPDATE on public.action (writes go through
-- security definer functions), so scorecard import links through this one. The caller (a route handler) has already checked the role; the function
-- checks that the KPI exists and that every action belongs to an assessment of the KPI's own engagement, and changes nothing otherwise.
create function public.rpc_action_link_kpi(p_actor uuid, p_kpi text, p_actions text[]) returns int
language plpgsql security definer set search_path = ''
as $$
declare k record; n int;
begin
  select * into k from public.scorecard_kpi where kpi_id = p_kpi;
  if not found or p_actions is null or cardinality(p_actions) not between 1 and 200 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown KPI or action list'; end if;
  if (select count(*) from public.action a join public.assessment s on s.assessment_id = a.assessment_id
      where a.action_id = any (p_actions) and s.engagement_id = k.engagement_id) <> cardinality(p_actions) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'an action is not an action of this engagement';
  end if;
  update public.action set scorecard_kpi_id = p_kpi, updated_by = p_actor where action_id = any (p_actions);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rpc_action_link_kpi(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.rpc_action_link_kpi(uuid, text, text[]) to service_role;
