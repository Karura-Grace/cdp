-- Journey 2, slice S7 (owner approved 19 October 2026; question wording DRAFT until the Leadership 360 forms v1.1 are supplied).
--   1. capture.response_360_text: the open answers of both 360 forms (S-Q1..S-Q6 self, R-Q1..R-Q7 rater), encrypted with cdp_text_key.
--      No role has SELECT. A consultant reviews rater comments for identifying content after freeze (so arrival time tells nothing)
--      and may redact one; the original stays in the encrypted store (N4.7-COMMENTS, S2.4-015). Release to the leader is Journey 5.
--   2. capture.submit_360, final form: the rater window check at answer time (owner ruling 19 October 2026) and the open answers,
--      written in the same transaction as the ratings and the unlinking.

create table capture.response_360_text (
  comment_id         text primary key default app.new_id('c36'),
  response_id        text not null references capture.response_360(response_id) on delete cascade,
  question_code      text not null check (question_code ~ '^(S-Q[1-6]|R-Q[1-7])$'),
  ciphertext         bytea not null,
  redacted_ciphertext bytea,
  reviewed_at        timestamptz,
  reviewed_by        uuid,
  unique (response_id, question_code)
);
alter table capture.response_360_text enable row level security;
revoke all on capture.response_360_text from public, anon, authenticated, service_role;

create or replace function capture.submit_360(p_token text, p_ratings jsonb, p_meta jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare inv record; a record; rid text; i int; v jsonb; kf text; ct text; k text; t text; keytxt text;
begin
  select * into inv from capture.invitation_360 where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if inv.submitted_at is not null then raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001'; end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  -- raters answer only inside the leader's rater window, when one is set (owner ruling 19 October 2026)
  if inv.kind = 'RATER' and exists (select 1 from public.rater_window w where w.assessment_id = inv.assessment_id and w.assignment_id = inv.assignment_id
       and (current_date < w.opens_on or current_date > w.closes_on)) then
    raise exception 'TOKEN_INVALID' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_ratings) <> 'array' or jsonb_array_length(p_ratings) <> 60 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a 360 form has exactly 60 items';
  end if;
  if p_meta is not null and jsonb_typeof(p_meta) <> 'object' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'meta'; end if;
  kf := case when inv.kind = 'RATER' then nullif(p_meta ->> 'known_for', '') end;
  ct := case when inv.kind = 'RATER' then nullif(p_meta ->> 'contact', '') end;
  insert into capture.response_360 (tenant_id, assessment_id, assignment_id, kind, rater_group, known_for, contact)
  values (inv.tenant_id, inv.assessment_id, inv.assignment_id, inv.kind, inv.rater_group, kf, ct) returning response_id into rid;
  for i in 0 .. 59 loop
    v := p_ratings -> i;
    if v is null or jsonb_typeof(v) = 'null' then
      if inv.kind = 'SELF' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'all 60 self items are required'; end if;
      continue;
    end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[1-5]$' then raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = '360'; end if;
    insert into capture.response_360_item (response_id, idx, value) values (rid, i + 1, (v #>> '{}')::int);
  end loop;
  -- open questions, encrypted like the survey free text; codes match the form kind
  if jsonb_typeof(p_meta -> 'text') = 'object' then
    for k, t in select key, value #>> '{}' from jsonb_each(p_meta -> 'text') loop
      continue when t is null or btrim(t) = '';
      if (inv.kind = 'SELF' and k !~ '^S-Q[1-6]$') or (inv.kind = 'RATER' and k !~ '^R-Q[1-7]$') or length(t) > 2000 then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '360 text';
      end if;
      if keytxt is null then select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key'; end if;
      if keytxt is null then raise exception 'TEXT_KEY_MISSING' using errcode = 'P0001'; end if;
      insert into capture.response_360_text (response_id, question_code, ciphertext) values (rid, k, extensions.pgp_sym_encrypt(t, keytxt));
    end loop;
  end if;
  update capture.invitation_360 set submitted_at = now(), person_id = null, person_link_destroyed_at = now() where invitation_id = inv.invitation_id;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'rater context';
end $$;

-- Rater comments of one leader for the consultant's review, after freeze: comment id, question code and text only (no rater group, no
-- response id, no time), ordered by question then at random so the order says nothing about who wrote what.
create function capture.comments_for_review(p_assessment_id text, p_assignment_id text) returns table (comment_id text, question_code text, body text, redacted text, reviewed boolean)
language plpgsql security definer set search_path = ''
as $$
declare keytxt text;
begin
  if not exists (select 1 from public.assessment where assessment_id = p_assessment_id and frozen_at is not null) then
    raise exception 'DATA_NOT_FROZEN' using errcode = 'P0001';
  end if;
  select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key';
  return query
  select c.comment_id, c.question_code, extensions.pgp_sym_decrypt(c.ciphertext, keytxt),
         case when c.redacted_ciphertext is null then null else extensions.pgp_sym_decrypt(c.redacted_ciphertext, keytxt) end,
         c.reviewed_at is not null
    from capture.response_360_text c join capture.response_360 r using (response_id)
   where r.assessment_id = p_assessment_id and r.assignment_id = p_assignment_id and r.kind = 'RATER'
   order by c.question_code, random();
end $$;

-- Mark a comment reviewed, optionally with a redacted version shown instead of the original.
create function capture.review_comment(p_assessment_id text, p_comment_id text, p_redacted text, p_actor uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare keytxt text;
begin
  if p_redacted is not null and (btrim(p_redacted) = '' or length(p_redacted) > 2000) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'redaction';
  end if;
  select decrypted_secret into keytxt from vault.decrypted_secrets where name = 'cdp_text_key';
  update capture.response_360_text c
     set redacted_ciphertext = case when p_redacted is null then null else extensions.pgp_sym_encrypt(p_redacted, keytxt) end,
         reviewed_at = now(), reviewed_by = p_actor
    from capture.response_360 r
   where c.comment_id = p_comment_id and r.response_id = c.response_id and r.assessment_id = p_assessment_id;
  if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'comment'; end if;
end $$;

revoke execute on function capture.comments_for_review(text, text), capture.review_comment(text, text, text, uuid) from public, anon, authenticated;
grant  execute on function capture.comments_for_review(text, text), capture.review_comment(text, text, text, uuid) to service_role;
create function public.rpc_comments_for_review(p_assessment_id text, p_assignment_id text) returns table (comment_id text, question_code text, body text, redacted text, reviewed boolean)
language sql security invoker set search_path = ''
as $$ select * from capture.comments_for_review(p_assessment_id, p_assignment_id) $$;
create function public.rpc_review_comment(p_assessment_id text, p_comment_id text, p_redacted text, p_actor uuid) returns void
language sql security invoker set search_path = ''
as $$ select capture.review_comment(p_assessment_id, p_comment_id, p_redacted, p_actor) $$;
revoke execute on function public.rpc_comments_for_review(text, text), public.rpc_review_comment(text, text, text, uuid) from public, anon, authenticated;
grant  execute on function public.rpc_comments_for_review(text, text), public.rpc_review_comment(text, text, text, uuid) to service_role;
