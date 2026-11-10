-- 10/10 Consent record (spec §2.4 / Table 29, S2-03, Table 19, AC-2.3).
--   * public.consent_text: the versioned text a respondent agrees to. Locked once APPROVED. An assessment pins one text
--     and cannot launch without an approved one (this is pre-flight L6's "consent text approved", enforced here).
--   * capture.consent_record: one row per invitation: AGREE or DECLINE, the text it was given against, a timestamp.
--     At submission the row loses its invitation link and its time is cut to the day, so only the count and the text
--     version remain (spec: "retained as a count and text version after unlink").
--   * submit_response refuses unless the invitation's consent is AGREE (CONSENT_REQUIRED). A decline stores no response data.
--   * No role gets table privileges on either table; service_role reaches them only through definer functions / the route.

-- ---------------------------------------------------------------- consent_text

create table public.consent_text (
  consent_text_id text primary key default app.new_id('cst'),
  tenant_id       text not null references public.tenant(tenant_id),
  privacy_regime  text not null,
  locale          text not null default 'en',
  version         int  not null check (version > 0),
  title           text not null,
  body            text not null check (length(body) between 1 and 20000),   -- paragraphs separated by a blank line
  status          text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED')),
  approved_at     timestamptz,
  approved_by     uuid,
  created_at      timestamptz not null default now(), created_by uuid,
  check (status <> 'APPROVED' or approved_at is not null),
  unique (tenant_id, privacy_regime, locale, version),
  unique (consent_text_id, tenant_id)          -- target of the composite FKs below
);

create function app.consent_text_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status = 'APPROVED' then
    raise exception 'CONSENT_TEXT_LOCKED' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger consent_text_lock before update or delete on public.consent_text
  for each row execute function app.consent_text_guard();

alter table public.consent_text enable row level security;     -- no policy: only service_role (bypasses RLS) reads it
revoke all on public.consent_text from public, anon, authenticated;
grant select, insert, update on public.consent_text to service_role;

-- ---------------------------------------------------------------- assessment pins the text; launch needs it approved

alter table public.assessment add column consent_text_id text;
alter table public.assessment add foreign key (consent_text_id, tenant_id)
  references public.consent_text (consent_text_id, tenant_id);

create or replace function app.assessment_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'DRAFT' and (new.instrument_version_id, new.rules_version_id, new.window_open, new.window_close, new.consent_text_id)
       is distinct from (old.instrument_version_id, old.rules_version_id, old.window_open, old.window_close, old.consent_text_id) then
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

-- ---------------------------------------------------------------- consent_record

create table capture.consent_record (
  consent_id      text primary key default app.new_id('con'),
  tenant_id       text not null,
  assessment_id   text not null,
  consent_text_id text not null,
  invitation_id   text unique references capture.invitation(invitation_id),   -- nulled at submission
  decision        text not null check (decision in ('AGREE', 'DECLINE')),
  decided_at      timestamptz not null default now(),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id),
  foreign key (consent_text_id, tenant_id) references public.consent_text(consent_text_id, tenant_id)
);
create index consent_record_assessment_idx on capture.consent_record (assessment_id);

-- Append-only apart from the two moves the definer functions make: change the decision while still linked, and unlink.
create function capture.consent_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_ROW' using errcode = 'P0001';
  end if;
  if (new.consent_id, new.tenant_id, new.assessment_id) is distinct from (old.consent_id, old.tenant_id, old.assessment_id)
     or (old.invitation_id is null and (new.invitation_id is not null or new.decision <> old.decision or new.consent_text_id <> old.consent_text_id)) then
    raise exception 'IMMUTABLE_ROW' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger consent_record_guard before update or delete on capture.consent_record
  for each row execute function capture.consent_guard();

alter table capture.consent_record enable row level security;
revoke all on capture.consent_record from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- token status now reports the consent state

create or replace function capture.survey_status(p_token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare inv record; a record;
begin
  select * into inv from capture.invitation where token_hash = extensions.digest(p_token, 'sha256');
  if not found or inv.expires_at <= now() then
    return jsonb_build_object('state', 'INVALID');
  end if;
  if inv.submitted_at is not null then
    return jsonb_build_object('state', 'SUBMITTED');
  end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null or a.consent_text_id is null
     or now() < coalesce(a.window_open, now()) or now() >= coalesce(a.window_close, now() + interval '1 second') then
    return jsonb_build_object('state', 'INVALID');
  end if;
  return jsonb_build_object('state', 'OPEN', 'assessment_id', a.assessment_id,
                            'instrument_version_id', a.instrument_version_id,
                            'consent_text_id', a.consent_text_id,
                            'consent', (select c.decision from capture.consent_record c where c.invitation_id = inv.invitation_id));
end $$;

-- ---------------------------------------------------------------- record a decision (S2-03)

create function capture.record_consent(p_token text, p_decision text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare inv record; a record;
begin
  if p_decision not in ('AGREE', 'DECLINE') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'decision';
  end if;
  select * into inv from capture.invitation where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() or inv.submitted_at is not null then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null or a.consent_text_id is null
     or now() < coalesce(a.window_open, now()) or now() >= coalesce(a.window_close, now() + interval '1 second') then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;
  -- one row per invitation; repeating the same decision changes nothing, so a link cannot be used to pad the counts
  insert into capture.consent_record (tenant_id, assessment_id, consent_text_id, invitation_id, decision)
  values (inv.tenant_id, inv.assessment_id, a.consent_text_id, inv.invitation_id, p_decision)
  on conflict (invitation_id) do update set decision = excluded.decision, decided_at = now()
    where capture.consent_record.decision <> excluded.decision;
  return jsonb_build_object('decision', p_decision);
end $$;

-- ---------------------------------------------------------------- counts (totals only)

create or replace function capture.fielding_counts(p_assessment_id text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('invited', count(*), 'submitted', count(submitted_at),
    'consent_agree',   (select count(*) from capture.consent_record c where c.assessment_id = p_assessment_id and c.decision = 'AGREE'),
    'consent_decline', (select count(*) from capture.consent_record c where c.assessment_id = p_assessment_id and c.decision = 'DECLINE'))
  from capture.invitation where assessment_id = p_assessment_id
$$;

-- ---------------------------------------------------------------- submit: refuses without consent, unlinks the consent record

create or replace function capture.submit_response(p_token text, p_payload jsonb, p_language text default 'en', p_duration int default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  inv     record;
  a       record;
  rid     text;
  persp   text; dim text; sets jsonb; setv jsonb; i int; o text; v jsonb; k text; n int;
  txt     text; keytxt text;
begin
  -- lock the invitation so two concurrent submits cannot both pass
  select * into inv from capture.invitation
  where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;
  if inv.submitted_at is not null then
    raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null
     or now() < coalesce(a.window_open, now()) or now() >= coalesce(a.window_close, now() + interval '1 second') then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;

  -- AC-2.3: no response is stored unless the latest consent decision on this invitation is AGREE.
  if coalesce((select c.decision from capture.consent_record c where c.invitation_id = inv.invitation_id), '') <> 'AGREE' then
    raise exception 'CONSENT_REQUIRED' using errcode = 'P0001';
  end if;

  insert into capture.response (tenant_id, assessment_id, demographic_snapshot_json, language, duration_seconds)
  values (inv.tenant_id, inv.assessment_id, inv.demographic_snapshot_json, p_language, p_duration)
  returning response_id into rid;

  -- scenario allocations (4 rows per set; the deferred trigger re-checks the sum at commit)
  for persp in select jsonb_object_keys(coalesce(p_payload -> 'alloc', '{}'::jsonb)) loop
    if persp not in ('NOW', 'PREFERRED') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'perspective ' || persp;
    end if;
    for dim in select jsonb_object_keys(p_payload -> 'alloc' -> persp) loop
      sets := p_payload -> 'alloc' -> persp -> dim;
      if jsonb_typeof(sets) <> 'array' or jsonb_array_length(sets) > 3 then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = dim;
      end if;
      for i in 0 .. jsonb_array_length(sets) - 1 loop
        setv := sets -> i;
        if jsonb_typeof(setv) = 'object' then
          for o in select unnest(array['ENGAGE', 'INNOVATE', 'PERFORM', 'GOVERN']) loop
            v := setv -> o;
            if v is null or jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^\d{1,3}$' or (v #>> '{}')::int > 100 then
              raise exception 'CONSTANT_SUM_VIOLATION' using errcode = 'P0001', detail = dim || '-S' || (i + 1);
            end if;
            insert into capture.response_allocation (response_id, scenario_id, perspective, orientation, points)
            values (rid, dim || '-S' || (i + 1), persp, o, (v #>> '{}')::int);
          end loop;
          select count(*) into n from jsonb_object_keys(setv);
          if n <> 4 then
            raise exception 'CONSTANT_SUM_VIOLATION' using errcode = 'P0001', detail = dim || '-S' || (i + 1);
          end if;
        end if;
      end loop;
    end loop;
  end loop;

  -- surface a constant-sum failure here, as CONSTANT_SUM_VIOLATION, not at commit
  set constraints all immediate;

  -- Likert D7-D9 (1-5)
  for dim in select jsonb_object_keys(coalesce(p_payload -> 'likert', '{}'::jsonb)) loop
    if dim not in ('D7', 'D8', 'D9') or jsonb_array_length(p_payload -> 'likert' -> dim) > 12 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = dim;
    end if;
    for i in 0 .. jsonb_array_length(p_payload -> 'likert' -> dim) - 1 loop
      v := p_payload -> 'likert' -> dim -> i;
      continue when v is null or jsonb_typeof(v) = 'null';
      if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[1-5]$' then
        raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = dim;
      end if;
      insert into capture.response_item (response_id, item_id, value)
      values (rid, dim || '-' || lpad((i + 1)::text, 2, '0'), (v #>> '{}')::int);
    end loop;
  end loop;

  -- eOS (0-10)
  if jsonb_typeof(p_payload -> 'eos') = 'array' then
    if jsonb_array_length(p_payload -> 'eos') > 8 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'eos';
    end if;
    for i in 0 .. jsonb_array_length(p_payload -> 'eos') - 1 loop
      v := p_payload -> 'eos' -> i;
      continue when v is null or jsonb_typeof(v) = 'null';
      if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^\d{1,2}$' or (v #>> '{}')::int > 10 then
        raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = 'eos';
      end if;
      insert into capture.response_item (response_id, item_id, value)
      values (rid, 'EOS-' || (i + 1), (v #>> '{}')::int);
    end loop;
  end if;

  -- free text, encrypted. The key is a Vault secret named 'cdp_text_key' (created once, see review notes).
  if jsonb_typeof(p_payload -> 'qual') = 'array' then
    select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key';
    for i in 0 .. least(jsonb_array_length(p_payload -> 'qual'), 3) - 1 loop
      txt := p_payload -> 'qual' ->> i;
      continue when txt is null or btrim(txt) = '';
      if length(txt) > 8000 then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'qual length';
      end if;
      if keytxt is null then
        raise exception 'TEXT_KEY_MISSING' using errcode = 'P0001';
      end if;
      insert into capture.response_text (response_id, question_code, ciphertext)
      values (rid, 'Q' || (i + 1), extensions.pgp_sym_encrypt(txt, keytxt));
    end loop;
  end if;

  -- unlink in the same transaction
  update capture.invitation
     set submitted_at = now(), person_id = null, person_link_destroyed_at = now(),
         demographic_snapshot_json = '{}'::jsonb
   where invitation_id = inv.invitation_id;

  -- the consent record loses its invitation link too; it keeps the text version and the decision, and the time is
  -- coarsened to the day so it cannot be matched to a response's submitted_at.
  update capture.consent_record
     set invitation_id = null, decided_at = date_trunc('day', decided_at)
   where invitation_id = inv.invitation_id;
end $$;

-- ---------------------------------------------------------------- API surface

revoke execute on function capture.record_consent(text, text) from public, anon, authenticated;
grant  execute on function capture.record_consent(text, text) to service_role;

create function public.rpc_record_consent(p_token text, p_decision text) returns jsonb
language sql security invoker set search_path = ''
as $$ select capture.record_consent(p_token, p_decision) $$;
revoke execute on function public.rpc_record_consent(text, text) from public, anon, authenticated;
grant  execute on function public.rpc_record_consent(text, text) to service_role;
