-- Fix to 20261020100000: a draft scenario list may hold null entries (sets not reached); they are skipped instead of failing the freeze.

create or replace function capture.auto_submit_drafts(p_assessment_id text) returns int
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
        select coalesce(jsonb_agg(case when jsonb_typeof(s.v) = 'object' and (select count(*) from jsonb_each(s.v) e where jsonb_typeof(e.value) = 'number') = 4
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
