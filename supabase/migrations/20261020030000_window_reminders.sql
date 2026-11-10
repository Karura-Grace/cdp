-- Journey 2, slice S3 (owner approved 19 October 2026, docs/designs/J2-respondent-360.md).
--   1. capture.reminder_log + capture.claim_reminders: the daily reminder job claims, per assessment and reminder kind, the
--      invitations still to remind, and logs them in the same statement, so a rerun never sends twice. Submitted invitations
--      drop out, so reminders stop on submission (AC-2.5). The final reminder goes only to started and not submitted links.
--      It returns person ids for the email lookup and nothing else; tokens are hashes, so a reminder points the person to
--      their invitation email instead of carrying a link.
--   2. public.window_extension (insert only) + capture.extend_window: moves window_close and expires_at of open links. The
--      assessment guard lets the window move only through this function (flag app.window_extension), never by a plain update.
--   (The 360 rater window check at answer time is in 20261020060000_l360_text.sql, with the final submit_360.)

create table capture.reminder_log (
  invitation_id text not null references capture.invitation(invitation_id) on delete cascade,
  kind          text not null,
  sent_at       timestamptz not null default now(),
  primary key (invitation_id, kind)
);
alter table capture.reminder_log enable row level security;
revoke all on capture.reminder_log from public, anon, authenticated, service_role;

create function capture.claim_reminders(p_assessment_id text, p_kind text, p_started_only boolean) returns setof text
language sql security definer set search_path = ''
as $$
  with due as (
    select i.invitation_id, i.person_id from capture.invitation i
     where i.assessment_id = p_assessment_id and i.submitted_at is null and i.person_id is not null and i.expires_at > now()
       and (not p_started_only or i.started_at is not null)
       and not exists (select 1 from capture.reminder_log r where r.invitation_id = i.invitation_id and r.kind = p_kind)
  ), logged as (
    insert into capture.reminder_log (invitation_id, kind) select invitation_id, p_kind from due
    on conflict do nothing returning invitation_id
  )
  select d.person_id from due d join logged l using (invitation_id)
$$;

-- ---------------------------------------------------------------- window extensions

create table public.window_extension (
  assessment_id text not null references public.assessment(assessment_id) on delete cascade,
  seq           int  not null check (seq between 1 and 2),
  tenant_id     text not null references public.tenant(tenant_id),
  old_close     timestamptz not null,
  new_close     timestamptz not null check (new_close > old_close),
  working_days  int  not null check (working_days between 1 and 5),
  reason        text not null check (length(btrim(reason)) between 3 and 1000),
  requested_by  uuid not null,
  approved_by   uuid,                                 -- the engagement lead, required for the second extension
  created_at    timestamptz not null default now(),
  primary key (assessment_id, seq),
  check (seq = 1 or approved_by is not null)
);
alter table public.window_extension enable row level security;
revoke all on public.window_extension from anon, authenticated;
grant select on public.window_extension to authenticated;
grant select, insert on public.window_extension to service_role;   -- insert only: no update or delete for anyone
create policy window_extension_read on public.window_extension for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));

create or replace function app.assessment_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'DRAFT' and (new.instrument_version_id, new.rules_version_id, new.window_open, new.consent_text_id)
       is distinct from (old.instrument_version_id, old.rules_version_id, old.window_open, old.consent_text_id) then
    raise exception 'ASSESSMENT_PINNED' using errcode = 'P0001';
  end if;
  -- the close date moves only through capture.extend_window, and only later
  if old.status <> 'DRAFT' and new.window_close is distinct from old.window_close
     and (coalesce(current_setting('app.window_extension', true), '') <> 'on' or new.window_close < old.window_close) then
    raise exception 'ASSESSMENT_PINNED' using errcode = 'P0001';
  end if;
  if old.frozen_at is not null and new.frozen_at is distinct from old.frozen_at then
    raise exception 'ASSESSMENT_FROZEN' using errcode = 'P0001';
  end if;
  if new.status <> 'DRAFT' and not exists (
       select 1 from public.instrument_version i, public.rules_version r
       where i.version_id = new.instrument_version_id and i.status = 'PUBLISHED'
         and r.version_id = new.rules_version_id and r.status = 'PUBLISHED') then
    raise exception 'VERSION_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  -- only the DRAFT -> LAUNCHED move is checked, so assessments launched before this migration still freeze and score
  if old.status = 'DRAFT' and new.status <> 'DRAFT' and not exists (
       select 1 from public.consent_text c where c.consent_text_id = new.consent_text_id and c.status = 'APPROVED') then
    raise exception 'CONSENT_TEXT_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- The route has already applied the engine rule (checkExtension) and the role checks; this writes the record and moves the dates
-- in one transaction.
create function capture.extend_window(p_assessment_id text, p_new_close timestamptz, p_working_days int, p_reason text,
                                      p_requested_by uuid, p_approved_by uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare a record; n int;
begin
  select * into a from public.assessment where assessment_id = p_assessment_id for update;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001'; end if;
  select count(*) into n from public.window_extension where assessment_id = p_assessment_id;
  if n >= 2 then raise exception 'EXTENSION_LIMIT' using errcode = 'P0001'; end if;
  insert into public.window_extension (assessment_id, seq, tenant_id, old_close, new_close, working_days, reason, requested_by, approved_by)
  values (p_assessment_id, n + 1, a.tenant_id, a.window_close, p_new_close, p_working_days, p_reason, p_requested_by, p_approved_by);
  perform set_config('app.window_extension', 'on', true);
  update public.assessment set window_close = p_new_close where assessment_id = p_assessment_id;
  perform set_config('app.window_extension', 'off', true);
  update capture.invitation set expires_at = p_new_close
   where assessment_id = p_assessment_id and submitted_at is null and expires_at = a.window_close;
  return n + 1;
end $$;

revoke execute on function capture.claim_reminders(text, text, boolean), capture.extend_window(text, timestamptz, int, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function capture.claim_reminders(text, text, boolean), capture.extend_window(text, timestamptz, int, text, uuid, uuid) to service_role;

create function public.rpc_claim_reminders(p_assessment_id text, p_kind text, p_started_only boolean) returns setof text
language sql security invoker set search_path = ''
as $$ select * from capture.claim_reminders(p_assessment_id, p_kind, p_started_only) $$;
create function public.rpc_extend_window(p_assessment_id text, p_new_close timestamptz, p_working_days int, p_reason text,
                                         p_requested_by uuid, p_approved_by uuid) returns int
language sql security invoker set search_path = ''
as $$ select capture.extend_window(p_assessment_id, p_new_close, p_working_days, p_reason, p_requested_by, p_approved_by) $$;
revoke execute on function public.rpc_claim_reminders(text, text, boolean), public.rpc_extend_window(text, timestamptz, int, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.rpc_claim_reminders(text, text, boolean), public.rpc_extend_window(text, timestamptz, int, text, uuid, uuid) to service_role;

