-- Journey 4 (owner approved 22 October 2026, docs/designs/J4-findings-playbook.md, slice F3): consultant annotations on findings.
-- A note is recorded beside a finding and never changes its verdict (spec S4.2-003, S4.4-010). Insert only: no update, delete or
-- truncate for any role. Read by the assigned PAC consultant and the Super Admin only; never shown in a client report and never
-- readable by a client role, released or not (owner ruling on Erick Ngala comment 24: comments stay outside the reports).

create table public.finding_annotation (
  annotation_id text primary key default app.new_id('ann'),
  tenant_id     text not null,
  assessment_id text not null,
  score_version int  not null,
  finding_id    text not null check (finding_id ~ '^fnd_[0-9]{4}$'),
  body          text not null check (length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now(), created_by uuid,
  foreign key (assessment_id, score_version) references public.evaluation(assessment_id, score_version),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index finding_annotation_finding_idx on public.finding_annotation (assessment_id, score_version, finding_id);

alter table public.finding_annotation enable row level security;
revoke all on public.finding_annotation from public, anon, authenticated, service_role;
grant select on public.finding_annotation to authenticated, service_role;
grant insert on public.finding_annotation to service_role;
create trigger finding_annotation_append_only before update or delete on public.finding_annotation
  for each row execute function app.deny_mutation();
create trigger finding_annotation_no_truncate before truncate on public.finding_annotation
  for each statement execute function app.deny_mutation();

create policy finding_annotation_read on public.finding_annotation for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids()));
