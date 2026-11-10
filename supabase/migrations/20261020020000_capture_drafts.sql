-- Journey 2, slice S2 (owner approved 19 October 2026, docs/designs/J2-respondent-360.md).
--   1. capture.invitation.started_at: set on the first saved scenario. Gives the started count, the final reminder to people who
--      started but have not submitted (S2.6.2-003) and the ABANDONED state (S2.6.3-005).
--   2. capture.draft: the respondent's unsubmitted answers, saved server side on every completed scenario (S2.3.1-005) so a
--      survey can resume on another device. Encrypted with the Vault key cdp_text_key, like free text. No role has SELECT;
--      only the token holder can read it back, through capture.load_draft.
--   3. A draft never outlives the person link: a trigger deletes it in the same transaction that submit_response sets
--      submitted_at (and nulls person_id), and another deletes every draft of an assessment when it is frozen.

alter table capture.invitation add column started_at timestamptz;

create table capture.draft (
  invitation_id text primary key references capture.invitation(invitation_id) on delete cascade,
  ciphertext    bytea not null,
  updated_at    timestamptz not null default now()
);
alter table capture.draft enable row level security;
revoke all on capture.draft from public, anon, authenticated, service_role;

-- the invitation a token opens, only while it can still be answered
create function capture.open_invitation(p_token text) returns capture.invitation
language plpgsql security definer set search_path = ''
as $$
declare inv capture.invitation; a record;
begin
  select * into inv from capture.invitation where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() or inv.submitted_at is not null then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;
  select status, frozen_at, window_open, window_close into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null
     or now() < coalesce(a.window_open, now()) or now() >= coalesce(a.window_close, now() + interval '1 second') then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;
  if coalesce((select c.decision from capture.consent_record c where c.invitation_id = inv.invitation_id), '') <> 'AGREE' then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;
  return inv;
end $$;

create function capture.save_draft(p_token text, p_payload jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare inv capture.invitation; keytxt text;
begin
  inv := capture.open_invitation(p_token);
  if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 200000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'draft';
  end if;
  select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key';
  if keytxt is null then raise exception 'TEXT_KEY_MISSING' using errcode = 'P0001'; end if;
  update capture.invitation set started_at = coalesce(started_at, now()) where invitation_id = inv.invitation_id;
  insert into capture.draft (invitation_id, ciphertext, updated_at)
  values (inv.invitation_id, extensions.pgp_sym_encrypt(p_payload::text, keytxt), now())
  on conflict (invitation_id) do update set ciphertext = excluded.ciphertext, updated_at = excluded.updated_at;
end $$;

create function capture.load_draft(p_token text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare inv capture.invitation; keytxt text; ct bytea;
begin
  inv := capture.open_invitation(p_token);
  select ciphertext into ct from capture.draft where invitation_id = inv.invitation_id;
  if ct is null then return null; end if;
  select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key';
  return extensions.pgp_sym_decrypt(ct, keytxt)::jsonb;
end $$;

create function capture.drop_draft_on_submit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from capture.draft where invitation_id = new.invitation_id;
  return new;
end $$;
create trigger invitation_submitted_drops_draft after update of submitted_at on capture.invitation
  for each row when (new.submitted_at is not null and old.submitted_at is null)
  execute function capture.drop_draft_on_submit();

create function capture.drop_drafts_on_freeze() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from capture.draft d using capture.invitation i
   where d.invitation_id = i.invitation_id and i.assessment_id = new.assessment_id;
  return new;
end $$;
create trigger assessment_frozen_drops_drafts after update of frozen_at on public.assessment
  for each row when (new.frozen_at is not null and old.frozen_at is null)
  execute function capture.drop_drafts_on_freeze();

revoke execute on function capture.open_invitation(text), capture.save_draft(text, jsonb), capture.load_draft(text),
                           capture.drop_draft_on_submit(), capture.drop_drafts_on_freeze()
  from public, anon, authenticated;
grant execute on function capture.save_draft(text, jsonb), capture.load_draft(text) to service_role;

create function public.rpc_save_draft(p_token text, p_payload jsonb) returns void
language sql security invoker set search_path = ''
as $$ select capture.save_draft(p_token, p_payload) $$;
create function public.rpc_load_draft(p_token text) returns jsonb
language sql security invoker set search_path = ''
as $$ select capture.load_draft(p_token) $$;
revoke execute on function public.rpc_save_draft(text, jsonb), public.rpc_load_draft(text) from public, anon, authenticated;
grant  execute on function public.rpc_save_draft(text, jsonb), public.rpc_load_draft(text) to service_role;

-- monitors gain the started count (S2-15); still counts only
create or replace function capture.fielding_counts(p_assessment_id text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('invited', count(*), 'started', count(*) filter (where started_at is not null or submitted_at is not null), 'submitted', count(submitted_at),
    'consent_agree',   (select count(*) from capture.consent_record c where c.assessment_id = p_assessment_id and c.decision = 'AGREE'),
    'consent_decline', (select count(*) from capture.consent_record c where c.assessment_id = p_assessment_id and c.decision = 'DECLINE'))
  from capture.invitation where assessment_id = p_assessment_id
$$;
