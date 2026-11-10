-- Applied 2026-10-02 to project swnvjucteqguqdbsdmsl.
-- 3/6 Capture: invitations, responses, constant-sum constraint, submit/issue/read functions.
-- Spec: §0.5 override rule 1, §2.4 (unlinking), AC-2.2, AC-2.4, Appendix A rows invitation/response*.
-- CLAUDE.md §3 first row, §4 (tokens).
--
-- THE PRIVACY STORY, in one place
--   1. Schema `capture` is not exposed over REST. anon/authenticated/service_role have no
--      table privilege on it (revoked below), so none of them can SELECT a response row.
--   2. Writes happen only inside capture.submit_response (SECURITY DEFINER, owner postgres).
--      It revalidates the payload, writes the rows, and nulls invitation.person_id in the SAME transaction.
--   3. response has no column or FK that points at invitation or person. After submit the
--      invitation keeps neither person_id nor the demographic snapshot.
--   4. Reads happen only inside capture.frozen_response_set, owned by role scoring_reader
--      (SELECT on three tables, nothing else). It refuses unless the assessment is frozen.
--   5. The thin `public.rpc_*` wrappers are SECURITY INVOKER and executable by service_role only.
--
-- LIMITATION TO DECIDE (see review notes): service_role can EXECUTE frozen_response_set, so a
-- compromised app server could read all frozen response rows as engine input. Real separation
-- needs the scoring job to connect as its own login role (scoring_reader). Drafted as: service_role.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'scoring_reader') then
    create role scoring_reader nologin noinherit;
  end if;
end $$;
grant scoring_reader to postgres;           -- lets postgres ALTER FUNCTION ... OWNER TO scoring_reader

-- ---------------------------------------------------------------- tables

create table capture.invitation (
  invitation_id            text primary key default app.new_id('inv'),
  tenant_id                text not null,
  assessment_id            text not null,
  kind                     text not null default 'SURVEY' check (kind in ('SURVEY', 'SELF_360', 'RATER_360')),
  token_hash               bytea not null unique,       -- sha256 of a 128-bit token; the token itself is never stored
  person_id                text,                         -- nulled at submission
  demographic_snapshot_json jsonb not null default '{}'::jsonb,   -- emptied at submission
  sent_at                  timestamptz,
  expires_at               timestamptz not null,
  submitted_at             timestamptz,
  person_link_destroyed_at timestamptz,
  created_at               timestamptz not null default now(),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index invitation_assessment_idx on capture.invitation (assessment_id);

-- No invitation_id, person_id or token here, on purpose.
create table capture.response (
  response_id               text primary key default app.new_id('rsp'),
  tenant_id                 text not null,
  assessment_id             text not null,
  demographic_snapshot_json jsonb not null default '{}'::jsonb,
  language                  text not null default 'en',
  started_at                timestamptz,
  submitted_at              timestamptz not null default now(),
  duration_seconds          int check (duration_seconds is null or duration_seconds >= 0),
  completion_state          text,                          -- derived by the engine at scoring, not stored here
  quality_flags             text[] not null default '{}',
  voided_reason             text,
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index response_assessment_idx on capture.response (assessment_id);

create table capture.response_allocation (
  response_id text not null references capture.response(response_id) on delete cascade,
  scenario_id text not null check (scenario_id ~ '^D[1-6]-S[1-3]$'),
  perspective text not null check (perspective in ('NOW', 'PREFERRED')),
  orientation text not null check (orientation in ('ENGAGE', 'INNOVATE', 'PERFORM', 'GOVERN')),
  points      int  not null check (points between 0 and 100),
  primary key (response_id, scenario_id, perspective, orientation)
);

create table capture.response_item (
  response_id text not null references capture.response(response_id) on delete cascade,
  item_id     text not null,
  value       int  not null check (value between 0 and 10),   -- Likert 1-5 and eOS 0-10 are checked in submit_response
  primary key (response_id, item_id)
);

create table capture.response_text (
  response_id   text not null references capture.response(response_id) on delete cascade,
  question_code text not null check (question_code in ('Q1', 'Q2', 'Q3')),
  ciphertext    bytea not null,
  primary key (response_id, question_code)
);

-- AC-2.2 database layer: every (response, scenario, perspective) present has exactly four rows summing to 100.
create function capture.check_allocation_sum() returns trigger
language plpgsql set search_path = ''
as $$
declare n int; s int;
begin
  select count(*), coalesce(sum(points), 0) into n, s
  from capture.response_allocation
  where response_id = new.response_id and scenario_id = new.scenario_id and perspective = new.perspective;
  if n <> 4 or s <> 100 then
    raise exception 'CONSTANT_SUM_VIOLATION' using errcode = 'P0001',
      detail = format('%s %s %s: %s rows summing to %s', new.response_id, new.scenario_id, new.perspective, n, s);
  end if;
  return null;
end $$;
create constraint trigger response_allocation_sum
  after insert or update on capture.response_allocation
  deferrable initially deferred for each row execute function capture.check_allocation_sum();

alter table capture.invitation          enable row level security;
alter table capture.response            enable row level security;
alter table capture.response_allocation enable row level security;
alter table capture.response_item       enable row level security;
alter table capture.response_text       enable row level security;

-- Defaults in some Supabase projects grant on new schemas; make the absence explicit.
revoke all on all tables    in schema capture from public, anon, authenticated, service_role;
revoke all on all sequences in schema capture from public, anon, authenticated, service_role;
alter default privileges in schema capture revoke all on tables from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- tokens

-- Staff issue invitations. Returns each raw token exactly once; only its hash is stored.
-- Authorisation is the caller's job (route handler checks the actor with their own JWT first).
create function capture.issue_invitations(
  p_assessment_id text, p_count int, p_snapshot jsonb default '{}'::jsonb, p_expires_at timestamptz default null
) returns setof text
language plpgsql security definer set search_path = ''
as $$
declare
  a record;
  tok text;
begin
  if p_count < 1 or p_count > 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'count must be 1..5000';
  end if;
  select * into a from public.assessment where assessment_id = p_assessment_id;
  if not found or a.status = 'FROZEN' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  for i in 1..p_count loop
    tok := encode(extensions.gen_random_bytes(16), 'hex');           -- 128 bits
    insert into capture.invitation (tenant_id, assessment_id, token_hash, demographic_snapshot_json, sent_at, expires_at)
    values (a.tenant_id, a.assessment_id, extensions.digest(tok, 'sha256'), coalesce(p_snapshot, '{}'::jsonb),
            now(), coalesce(p_expires_at, a.window_close, now() + interval '30 days'));
    return next tok;
  end loop;
end $$;

-- GET /survey?token=: is this token usable? Returns no personal data.
create function capture.survey_status(p_token text) returns jsonb
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
  if a.status <> 'LAUNCHED' or a.frozen_at is not null
     or now() < coalesce(a.window_open, now()) or now() >= coalesce(a.window_close, now() + interval '1 second') then
    return jsonb_build_object('state', 'INVALID');
  end if;
  return jsonb_build_object('state', 'OPEN', 'assessment_id', a.assessment_id,
                            'instrument_version_id', a.instrument_version_id);
end $$;

-- ---------------------------------------------------------------- submit

-- Payload shape = the engine's validateSurveyPayload body:
--   { alloc: { NOW: { D1: [ {ENGAGE,INNOVATE,PERFORM,GOVERN} | null x3 ], ... }, PREFERRED: {...} },
--     likert: { D7: [12 x int|null], D8: [...], D9: [...] }, eos: [8 x int|null], qual: [3 x text] }
-- Drafts live in the browser (as in the v1 prototype); only a final submit reaches the database.
-- Error codes are the Appendix J strings, raised as exception messages for the route to map.
create function capture.submit_response(p_token text, p_payload jsonb, p_language text default 'en', p_duration int default null)
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
end $$;

-- ---------------------------------------------------------------- monitor (counts only)

create function capture.fielding_counts(p_assessment_id text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('invited', count(*), 'submitted', count(submitted_at))
  from capture.invitation where assessment_id = p_assessment_id
$$;

-- ---------------------------------------------------------------- the only read path

-- One jsonb row per response, shaped as the engine's ResponseInput:
--   { id, duration, snapshot, alloc: { NOW: { D1: [ {..}|null x3 ] } }, likert: { D7: [12] }, eos: [8] }
-- Refuses unless the assessment is frozen (DATA_NOT_FROZEN). The opaque response id is the only id returned.
create function capture.frozen_response_set(p_assessment_id text) returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.assessment where assessment_id = p_assessment_id and frozen_at is not null) then
    raise exception 'DATA_NOT_FROZEN' using errcode = 'P0001';
  end if;
  return query
  select jsonb_build_object(
    'id', r.response_id,
    'duration', r.duration_seconds,
    'snapshot', r.demographic_snapshot_json,
    'alloc', coalesce((
        select jsonb_object_agg(pd.perspective, pd.dims) from (
          select x.perspective,
                 jsonb_object_agg(x.dim, x.sets) as dims
          from (
            select ps.perspective, ps.dim,
                   (select jsonb_agg((select jsonb_object_agg(al.orientation, al.points)
                                      from capture.response_allocation al
                                      where al.response_id = r.response_id and al.perspective = ps.perspective
                                        and al.scenario_id = ps.dim || '-S' || s) order by s)
                    from generate_series(1, 3) s) as sets
            from (select distinct perspective, left(scenario_id, 2) as dim
                  from capture.response_allocation where response_id = r.response_id) ps
          ) x
          group by x.perspective
        ) pd), '{}'::jsonb),
    'likert', coalesce((
        select jsonb_object_agg(d.dim, (select jsonb_agg((select ri.value from capture.response_item ri
                                                          where ri.response_id = r.response_id
                                                            and ri.item_id = d.dim || '-' || lpad(s::text, 2, '0')) order by s)
                                        from generate_series(1, 12) s))
        from (select distinct left(item_id, 2) as dim from capture.response_item
              where response_id = r.response_id and item_id ~ '^D[7-9]-') d), '{}'::jsonb),
    'eos', (select jsonb_agg((select ri.value from capture.response_item ri
                              where ri.response_id = r.response_id and ri.item_id = 'EOS-' || s) order by s)
            from generate_series(1, 8) s)
  )
  from capture.response r
  where r.assessment_id = p_assessment_id and r.voided_reason is null
  order by r.response_id;
end $$;

-- scoring_reader: read-only, three tables, plus the assessment row it must check.
grant usage on schema capture to scoring_reader;
grant usage on schema public   to scoring_reader;
grant select on capture.response, capture.response_allocation, capture.response_item to scoring_reader;
grant select on public.assessment to scoring_reader;
create policy scoring_reader_reads_response   on capture.response            for select to scoring_reader using (true);
create policy scoring_reader_reads_allocation on capture.response_allocation for select to scoring_reader using (true);
create policy scoring_reader_reads_item       on capture.response_item       for select to scoring_reader using (true);
create policy scoring_reader_reads_assessment on public.assessment           for select to scoring_reader using (true);
grant create on schema capture to scoring_reader;      -- ALTER OWNER requires CREATE on the schema ...
alter function capture.frozen_response_set(text) owner to scoring_reader;
revoke create on schema capture from scoring_reader;   -- ... and nothing else needs it

-- ---------------------------------------------------------------- the API surface: invoker wrappers, service_role only
-- service_role gets USAGE on the schema and EXECUTE on exactly these functions; no table privilege.

grant usage on schema capture to service_role;
revoke execute on all functions in schema capture from public, anon, authenticated;
grant  execute on function capture.issue_invitations(text, int, jsonb, timestamptz),
                           capture.survey_status(text),
                           capture.submit_response(text, jsonb, text, int),
                           capture.fielding_counts(text),
                           capture.frozen_response_set(text)
  to service_role;
revoke execute on function capture.check_allocation_sum() from service_role;

create function public.rpc_issue_invitations(p_assessment_id text, p_count int, p_snapshot jsonb default '{}', p_expires_at timestamptz default null)
returns setof text language sql security invoker set search_path = ''
as $$ select * from capture.issue_invitations(p_assessment_id, p_count, p_snapshot, p_expires_at) $$;

create function public.rpc_survey_status(p_token text) returns jsonb
language sql security invoker set search_path = ''
as $$ select capture.survey_status(p_token) $$;

create function public.rpc_submit_response(p_token text, p_payload jsonb, p_language text default 'en', p_duration int default null)
returns void language sql security invoker set search_path = ''
as $$ select capture.submit_response(p_token, p_payload, p_language, p_duration) $$;

create function public.rpc_fielding_counts(p_assessment_id text) returns jsonb
language sql security invoker set search_path = ''
as $$ select capture.fielding_counts(p_assessment_id) $$;

create function public.rpc_frozen_response_set(p_assessment_id text) returns setof jsonb
language sql security invoker set search_path = ''
as $$ select * from capture.frozen_response_set(p_assessment_id) $$;

revoke execute on function public.rpc_issue_invitations(text, int, jsonb, timestamptz),
                           public.rpc_survey_status(text),
                           public.rpc_submit_response(text, jsonb, text, int),
                           public.rpc_fielding_counts(text),
                           public.rpc_frozen_response_set(text)
  from public, anon, authenticated;
grant execute on function public.rpc_issue_invitations(text, int, jsonb, timestamptz),
                          public.rpc_survey_status(text),
                          public.rpc_submit_response(text, jsonb, text, int),
                          public.rpc_fielding_counts(text),
                          public.rpc_frozen_response_set(text)
  to service_role;
