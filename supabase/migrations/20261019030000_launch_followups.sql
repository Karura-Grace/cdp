-- Journey 1, launch slice, second pass (j1b-launch). Owner decisions of 18 October 2026. NOT applied by the helper; the lead applies it.
--   1. rater_window: a separate open and close date per leader for the 360 raters of one assessment. A NEW TABLE (not columns on leader_assignment)
--      because a leader assignment spans assessments while the window belongs to one assessment. Rules (inside the assessment window, open on or
--      before close) are checked by the route that writes it; the table only keeps the dates in order.
--   2. tenant.cover_colour: the client cover colour, a six digit hex such as #1F7A5C, used on the report cover.
--   3. assessment.staff_message_text: staff message wording edited after launch. A text only change kept on the assessment, not in the locked
--      setup rows, so the locked Section I payload and everything scoring reads stay as launched. Respondents see it ahead of the Section I text.
-- Nothing here touches capture, tokens or responses.

create table public.rater_window (
  assessment_id text not null references public.assessment(assessment_id) on delete cascade,
  assignment_id text not null references public.leader_assignment(assignment_id),
  tenant_id     text not null references public.tenant(tenant_id),
  opens_on      date not null,
  closes_on     date not null,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  primary key (assessment_id, assignment_id),
  check (closes_on >= opens_on)
);
create trigger rater_window_touch before insert or update on public.rater_window for each row execute function app.touch();
alter table public.rater_window enable row level security;
revoke all on public.rater_window from anon, authenticated;
grant select on public.rater_window to authenticated;
grant all on public.rater_window to service_role;
create policy rater_window_read on public.rater_window for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'PEOPLE_LEADER')));

alter table public.tenant add column cover_colour text check (cover_colour is null or cover_colour ~ '^#[0-9A-Fa-f]{6}$');

alter table public.assessment add column staff_message_text text check (staff_message_text is null or length(staff_message_text) <= 3000);
