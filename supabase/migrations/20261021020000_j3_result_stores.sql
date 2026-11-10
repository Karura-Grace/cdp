-- Journey 3 (owner approved 21 October 2026, docs/designs/J3-scoring-review.md): stores written at scoring and at score freeze.
--   1. public.segment_profile (S2): the profile of every reportable group on the standard cuts, written when the score is frozen,
--      tied to the score version and hash. Groups under the floor are never stored.
--   2. public.leader_link_result (S6): each valid leader's fit with the culture they lead (fit, carrier class, team eOS differential,
--      contribution quadrant), written at scoring. Consultant only until the leader report is released (Journey 5).
--   3. public.setup_system_note (G5 note): read only entries added by scoring, shown under Setup G5 with the score version.
--   4. segment_query_log.resolved_count (S4): the exact number of people a query matched, for audit. Staff roles cannot read the
--      column (column privileges below); the Super Admin reads it through the server.
-- All three new tables are insert only: no update, delete or truncate for any role.

create table public.segment_profile (
  assessment_id text not null,
  tenant_id     text not null,
  score_version int  not null,
  segment_key   text not null check (length(segment_key) between 1 and 200),
  axis          text not null check (length(axis) <= 40),
  value         text not null check (length(value) <= 200),
  n             int  not null check (n >= 5),
  profile_json  jsonb not null,
  payload_hash  text not null,
  created_at    timestamptz not null default now(), created_by uuid,
  primary key (assessment_id, score_version, segment_key),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);

create table public.leader_link_result (
  assessment_id text not null,
  tenant_id     text not null,
  score_version int  not null,
  assignment_id text not null,
  payload_json  jsonb not null,
  created_at    timestamptz not null default now(), created_by uuid,
  primary key (assessment_id, score_version, assignment_id),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);

create table public.setup_system_note (
  note_id       text primary key default app.new_id('ssn'),
  tenant_id     text not null references public.tenant(tenant_id),
  engagement_id text not null,
  assessment_id text not null,
  score_version int  not null,
  section       text not null check (section in ('G')),
  item          text not null check (length(item) <= 40),
  body          text not null check (length(body) <= 1000),
  created_at    timestamptz not null default now(),
  unique (assessment_id, score_version, section, item),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);

do $$
declare t text;
begin
  foreach t in array array['segment_profile', 'leader_link_result', 'setup_system_note'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated, service_role', t);
    execute format('grant insert on public.%I to service_role', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function app.deny_mutation()', t || '_append_only', t);
    execute format('create trigger %I before truncate on public.%I for each statement execute function app.deny_mutation()', t || '_no_truncate', t);
  end loop;
end $$;

-- assigned PAC consultant and Super Admin only; no client role reads any of these before release
create policy segment_profile_read on public.segment_profile for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids()));
create policy leader_link_result_read on public.leader_link_result for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids()));
-- G5 is setup content: the roles that read setup read the note
create policy setup_system_note_read on public.setup_system_note for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));

-- the exact resolved count: stored for audit, not readable by staff roles
alter table public.segment_query_log add column resolved_count int check (resolved_count is null or resolved_count >= 0);
revoke select on public.segment_query_log from authenticated;
grant select (query_id, tenant_id, assessment_id, actor_id, axis, predicates, outcome, at) on public.segment_query_log to authenticated;

create or replace function public.rpc_log_segment_query(p_actor uuid, p_assessment_id text, p_axis text, p_predicates jsonb, p_outcome text, p_resolved int default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare tid text;
begin
  select a.tenant_id into tid from public.assessment a where a.assessment_id = p_assessment_id;
  if tid is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  insert into public.segment_query_log (tenant_id, assessment_id, actor_id, axis, predicates, outcome, resolved_count)
  values (tid, p_assessment_id, p_actor, left(p_axis, 40), coalesce(p_predicates, '{}'::jsonb), p_outcome, p_resolved);
end $$;
revoke execute on function public.rpc_log_segment_query(uuid, text, text, jsonb, text, int) from public, anon, authenticated;
grant  execute on function public.rpc_log_segment_query(uuid, text, text, jsonb, text, int) to service_role;
