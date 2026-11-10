-- Journey 2, slice S2 (owner approved 19 October 2026): auto submit at close (S2.6.3-005).
--   The respondent may tick "submit what I have if the window closes". The tick lives inside their encrypted draft (autoSubmit), so
--   nothing new about the person is stored. Just before the data set is frozen, capture.auto_submit_drafts stores every ticked draft
--   of the assessment through the same storing code as a normal submit, keeping only scenario sets with all four orientations
--   answered (a set the respondent left half done is dropped, never balanced). The draft is then deleted by the existing trigger.
--   capture.submit_response is split: its checks stay, the storing and unlinking move unchanged into capture.store_response.

create function capture.store_response(p_invitation_id text, p_payload jsonb, p_language text, p_duration int)
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
  select * into inv from capture.invitation where invitation_id = p_invitation_id for update;
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

  perform capture.store_response(inv.invitation_id, p_payload, p_language, p_duration);
end $$;

-- every ticked draft of a closed, not yet frozen assessment; returns how many were stored. A draft that fails validation is skipped.
create function capture.auto_submit_drafts(p_assessment_id text) returns int
language plpgsql security definer set search_path = ''
as $$
declare a record; r record; keytxt text; d jsonb; persp text; dim text; sets jsonb; kept jsonb; p jsonb; n int := 0;
begin
  select * into a from public.assessment where assessment_id = p_assessment_id for update;
  if not found or a.frozen_at is not null or now() < coalesce(a.window_close, now() + interval '1 second') then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'auto submit runs only after close and before freeze';
  end if;
  select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key';
  for r in select i.invitation_id, dr.ciphertext from capture.invitation i join capture.draft dr using (invitation_id)
            where i.assessment_id = p_assessment_id and i.submitted_at is null
              and coalesce((select c.decision from capture.consent_record c where c.invitation_id = i.invitation_id), '') = 'AGREE' loop
    d := extensions.pgp_sym_decrypt(r.ciphertext, keytxt)::jsonb;
    continue when coalesce((d ->> 'autoSubmit')::boolean, false) is not true;
    p := jsonb_build_object('alloc', '{}'::jsonb, 'likert', coalesce(d -> 'likert', '{}'::jsonb), 'eos', coalesce(d -> 'eos', '[]'::jsonb));
    for persp in select jsonb_object_keys(coalesce(d -> 'alloc', '{}'::jsonb)) loop
      for dim in select jsonb_object_keys(d -> 'alloc' -> persp) loop
        sets := d -> 'alloc' -> persp -> dim;
        continue when jsonb_typeof(sets) <> 'array';
        select coalesce(jsonb_agg(case when (select count(*) from jsonb_each(s.v) e where jsonb_typeof(e.value) = 'number') = 4
                                        and (select sum((e.value #>> '{}')::numeric) from jsonb_each(s.v) e) = 100 then s.v else 'null'::jsonb end order by s.o), '[]'::jsonb)
          into kept from jsonb_array_elements(sets) with ordinality s(v, o);
        p := jsonb_set(p, array['alloc', persp], coalesce(p -> 'alloc' -> persp, '{}'::jsonb) || jsonb_build_object(dim, kept));
      end loop;
    end loop;
    begin
      perform capture.store_response(r.invitation_id, p, 'en', nullif((d ->> 'spent'), '')::int);
      n := n + 1;
    exception when others then
      null;   -- an invalid draft is left out; it counts as abandoned
    end;
  end loop;
  return n;
end $$;

revoke execute on function capture.store_response(text, jsonb, text, int), capture.auto_submit_drafts(text) from public, anon, authenticated, service_role;
grant  execute on function capture.auto_submit_drafts(text) to service_role;
create function public.rpc_auto_submit_drafts(p_assessment_id text) returns int
language sql security invoker set search_path = ''
as $$ select capture.auto_submit_drafts(p_assessment_id) $$;
revoke execute on function public.rpc_auto_submit_drafts(text) from public, anon, authenticated;
grant  execute on function public.rpc_auto_submit_drafts(text) to service_role;
