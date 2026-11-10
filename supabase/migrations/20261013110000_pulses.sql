-- 20 Measure stage, step B: watch-list pulses (spec §6.5.1, screens S6-01 and S6-02). Approved 13 Oct 2026.
--   * public.pulse: what is asked (at most ten watch-list references of one priority), when, and the baseline reading on the
--     same items. Metadata only. DRAFT, then OPEN (links issued to the active roster), then CLOSED.
--   * capture.pulse_invitation and capture.pulse_response: same privacy design as the main survey. Only the token hash is stored,
--     the person link is destroyed in the transaction that stores the answers, and the answers carry no person, no demographics,
--     no invitation id and no free text. No client role or service role can read either table.
--   * public.pulse_result: the aggregate, stored once when the pulse is closed. Below the reporting floor only the count is stored.
--     Insert only. Always INDICATIVE.
--   * the one read path to pulse answers is capture.closed_pulse_set, owned by scoring_reader like frozen_response_set. It refuses
--     until the pulse is closed and refuses below the floor passed by the caller.

-- ---------------------------------------------------------------- tables
create table public.pulse (
  pulse_id        text primary key default app.new_id('pls'),
  tenant_id       text not null,
  engagement_id   text not null references public.engagement(engagement_id),
  assessment_id   text not null,
  score_version   int  not null,
  priority_id     text not null,
  review_point    text not null check (review_point in ('+90d', '+180d')),
  items           text[] not null check (cardinality(items) >= 1),     -- the cap and the watch-list are checked by the engine (validatePulse)
  baseline_json   jsonb not null,                                      -- the reading of the frozen baseline on exactly these items
  status          text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  opens_at        timestamptz, closes_at timestamptz, closed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  foreign key (assessment_id, score_version, priority_id) references public.priority(assessment_id, score_version, priority_id),
  unique (assessment_id, score_version, priority_id, review_point),
  unique (pulse_id, tenant_id)
);
create index pulse_eng_idx on public.pulse (engagement_id);

create table public.pulse_result (
  pulse_id     text primary key references public.pulse(pulse_id),
  tenant_id    text not null,
  engagement_id text not null,
  n_invited    int not null,
  n_responded  int not null,
  suppressed   boolean not null,
  reading_json jsonb,                                                  -- null when suppressed
  triggers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), created_by uuid,
  check (suppressed = (reading_json is null))
);
create trigger pulse_result_append_only before update or delete on public.pulse_result for each row execute function app.deny_mutation();

-- a pulse moves forward only, and what it asks never changes
create function app.pulse_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = tg_table_name; end if;
  if (new.pulse_id, new.tenant_id, new.engagement_id, new.assessment_id, new.score_version, new.priority_id, new.review_point, new.items, new.baseline_json, new.created_at)
     is distinct from (old.pulse_id, old.tenant_id, old.engagement_id, old.assessment_id, old.score_version, old.priority_id, old.review_point, old.items, old.baseline_json, old.created_at) then
    raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = tg_table_name;
  end if;
  if new.status is distinct from old.status and not ((old.status = 'DRAFT' and new.status = 'OPEN') or (old.status = 'OPEN' and new.status = 'CLOSED')) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = old.status || ' to ' || new.status;
  end if;
  return new;
end $$;
create trigger pulse_guard before update or delete on public.pulse for each row execute function app.pulse_guard();

create table capture.pulse_invitation (
  invitation_id            text primary key default app.new_id('pin'),
  tenant_id                text not null,
  pulse_id                 text not null,
  token_hash               bytea not null unique,
  person_id                text,                                       -- nulled at submission
  sent_at                  timestamptz,
  expires_at               timestamptz not null,
  submitted_at             timestamptz,
  person_link_destroyed_at timestamptz,
  created_at               timestamptz not null default now(),
  foreign key (pulse_id, tenant_id) references public.pulse(pulse_id, tenant_id)
);
create index pulse_invitation_pulse_idx on capture.pulse_invitation (pulse_id);

-- No invitation_id, person_id or token here, on purpose.
create table capture.pulse_response (
  response_id  text primary key default app.new_id('prs'),
  tenant_id    text not null,
  pulse_id     text not null,
  answers      jsonb not null,
  submitted_at timestamptz not null default now(),
  foreign key (pulse_id, tenant_id) references public.pulse(pulse_id, tenant_id)
);
create index pulse_response_pulse_idx on capture.pulse_response (pulse_id);

alter table capture.pulse_invitation enable row level security;
alter table capture.pulse_response   enable row level security;
revoke all on capture.pulse_invitation, capture.pulse_response from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- capture functions
-- Issues one link per person; returns each raw token once. Authorisation is the caller's (rpc_pulse_open below).
create function capture.pulse_issue(p_pulse text, p_people text[]) returns table (person_id text, token text)
language plpgsql security definer set search_path = ''
as $$
declare p record; pid text; tok text;
begin
  select * into p from public.pulse where pulse_id = p_pulse;
  if not found or p.status <> 'OPEN' or p.closes_at is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  foreach pid in array p_people loop
    tok := encode(extensions.gen_random_bytes(16), 'hex');                -- 128 bits
    insert into capture.pulse_invitation (tenant_id, pulse_id, token_hash, person_id, sent_at, expires_at)
    values (p.tenant_id, p.pulse_id, extensions.digest(tok, 'sha256'), pid, now(), p.closes_at);
    person_id := pid; token := tok; return next;
  end loop;
end $$;

-- GET: is this link usable? Returns no personal data.
create function capture.pulse_status(p_token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare inv record; p record;
begin
  select * into inv from capture.pulse_invitation where token_hash = extensions.digest(p_token, 'sha256');
  if not found or inv.expires_at <= now() then return jsonb_build_object('state', 'INVALID'); end if;
  if inv.submitted_at is not null then return jsonb_build_object('state', 'SUBMITTED'); end if;
  select * into p from public.pulse where pulse_id = inv.pulse_id;
  if p.status <> 'OPEN' or now() >= p.closes_at then return jsonb_build_object('state', 'INVALID'); end if;
  return jsonb_build_object('state', 'OPEN', 'pulse_id', p.pulse_id, 'items', to_jsonb(p.items), 'assessment_id', p.assessment_id,
                            'priority_id', p.priority_id, 'closes_at', p.closes_at);
end $$;

-- The engine has already checked the exact shape. The database re-checks the structure, so a bypass of the route still cannot store
-- a key that is not on the pulse, a value outside 0 to 100, or a scenario that does not add up to 100.
create function capture.submit_pulse(p_token text, p_answers jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare inv record; p record; k text; v jsonb; leaf record;
begin
  select * into inv from capture.pulse_invitation where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if inv.submitted_at is not null then raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001'; end if;
  select * into p from public.pulse where pulse_id = inv.pulse_id;
  if p.status <> 'OPEN' or now() >= p.closes_at then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 8000 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'answers'; end if;
  for k, v in select * from jsonb_each(p_answers) loop
    if not (k = any (p.items)) then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'not on this pulse'; end if;
    if jsonb_typeof(v) = 'number' then
      if (v #>> '{}') !~ '^\d{1,3}$' or (v #>> '{}')::int > 100 then raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = k; end if;
    elsif jsonb_typeof(v) = 'object' then
      for leaf in select * from jsonb_each(v) loop
        if jsonb_typeof(leaf.value) <> 'number' or (leaf.value #>> '{}') !~ '^\d{1,3}$' or (leaf.value #>> '{}')::int > 100 then
          raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = k;
        end if;
      end loop;
      if k ~ '^D[1-6] S[1-3]$' and ((select count(*) from jsonb_each(v)) <> 4 or (select sum((x.value #>> '{}')::int) from jsonb_each(v) x) <> 100) then
        raise exception 'CONSTANT_SUM_VIOLATION' using errcode = 'P0001', detail = k;
      end if;
    else
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = k;
    end if;
  end loop;
  insert into capture.pulse_response (tenant_id, pulse_id, answers) values (inv.tenant_id, inv.pulse_id, p_answers);
  -- unlink in the same transaction
  update capture.pulse_invitation set submitted_at = now(), person_id = null, person_link_destroyed_at = now() where invitation_id = inv.invitation_id;
end $$;

create function capture.pulse_counts(p_pulse text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('invited', count(*), 'submitted', count(submitted_at)) from capture.pulse_invitation where pulse_id = p_pulse
$$;

-- The only read path to pulse answers: one row of answers per respondent, no id of any kind. Only for a closed pulse, never below the floor.
create function capture.closed_pulse_set(p_pulse text, p_floor int) returns setof jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare n int;
begin
  if not exists (select 1 from public.pulse where pulse_id = p_pulse and status = 'CLOSED') then
    raise exception 'DATA_NOT_FROZEN' using errcode = 'P0001', detail = 'the pulse is not closed';
  end if;
  select count(*) into n from capture.pulse_response where pulse_id = p_pulse;
  if p_floor is null or p_floor < 1 or n < p_floor then
    raise exception 'BELOW_REPORTING_THRESHOLD' using errcode = 'P0001';
  end if;
  return query select r.answers from capture.pulse_response r where r.pulse_id = p_pulse order by r.response_id;
end $$;

-- scoring_reader: the same narrow role as for the baseline set
grant select on capture.pulse_response to scoring_reader;
grant select on public.pulse to scoring_reader;
create policy scoring_reader_reads_pulse_response on capture.pulse_response for select to scoring_reader using (true);
create policy scoring_reader_reads_pulse on public.pulse for select to scoring_reader using (true);
grant create on schema capture to scoring_reader;
alter function capture.closed_pulse_set(text, int) owner to scoring_reader;
revoke create on schema capture from scoring_reader;

revoke execute on all functions in schema capture from public, anon, authenticated;
grant execute on function capture.pulse_issue(text, text[]), capture.pulse_status(text), capture.submit_pulse(text, jsonb),
                          capture.pulse_counts(text), capture.closed_pulse_set(text, int) to service_role;

-- ---------------------------------------------------------------- the API surface (service role only)
create function public.rpc_pulse_status(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select capture.pulse_status(p_token) $$;
create function public.rpc_pulse_submit(p_token text, p_answers jsonb) returns void
language sql security invoker set search_path = '' as $$ select capture.submit_pulse(p_token, p_answers) $$;
create function public.rpc_pulse_counts(p_pulse text) returns jsonb
language sql security invoker set search_path = '' as $$ select capture.pulse_counts(p_pulse) $$;
create function public.rpc_closed_pulse_set(p_pulse text, p_floor int) returns setof jsonb
language sql security invoker set search_path = '' as $$ select * from capture.closed_pulse_set(p_pulse, p_floor) $$;

-- the engine checked the items against the priority's watch-list and computed the baseline; the database checks the priority is on a frozen baseline
create function public.rpc_pulse_create(p_actor uuid, p_assessment text, p_score_version int, p_priority text, p_review_point text, p_items text[], p_baseline jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare a record; id text;
begin
  select * into a from public.assessment where assessment_id = p_assessment;
  if not found or not app.consultant_on_engagement(p_actor, a.engagement_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if a.status <> 'FROZEN' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'a pulse is built on a frozen baseline';
  end if;
  insert into public.pulse (tenant_id, engagement_id, assessment_id, score_version, priority_id, review_point, items, baseline_json, created_by)
  values (a.tenant_id, a.engagement_id, p_assessment, p_score_version, p_priority, p_review_point, p_items, p_baseline, p_actor) returning pulse_id into id;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, p_actor, 'pulse.created', 'pulse', id);
  return id;
exception
  when check_violation then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'pulse';
  when foreign_key_violation then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'that priority is not in the plan of this baseline';
  when unique_violation then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'this priority already has a pulse at that review point';
end $$;

-- opens the pulse and issues one link to every active person on the roster; the links are returned once, to the consultant
create function public.rpc_pulse_open(p_actor uuid, p_pulse text, p_closes timestamptz) returns setof jsonb
language plpgsql security definer set search_path = ''
as $$
declare p record; people text[];
begin
  select * into p from public.pulse where pulse_id = p_pulse;
  if not found or not app.consultant_on_engagement(p_actor, p.engagement_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p.status <> 'DRAFT' then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'only a draft pulse can be opened'; end if;
  if p_closes is null or p_closes <= now() or p_closes > now() + interval '60 days' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'the close date must be in the future and within 60 days';
  end if;
  update public.pulse set status = 'OPEN', opens_at = now(), closes_at = p_closes where pulse_id = p_pulse;
  select coalesce(array_agg(x.person_id order by x.display_name), '{}') into people
    from public.person_of_record x where x.tenant_id = p.tenant_id and x.employment_status = 'ACTIVE';
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (p.tenant_id, p_actor, 'pulse.opened:' || cardinality(people), 'pulse', p_pulse);
  return query select jsonb_build_object('person_id', i.person_id, 'token', i.token) from capture.pulse_issue(p_pulse, people) i;
end $$;

create function public.rpc_pulse_close(p_actor uuid, p_pulse text) returns void
language plpgsql security definer set search_path = ''
as $$
declare p record;
begin
  select * into p from public.pulse where pulse_id = p_pulse;
  if not found or not app.consultant_on_engagement(p_actor, p.engagement_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p.status <> 'OPEN' then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'only an open pulse can be closed'; end if;
  update public.pulse set status = 'CLOSED', closed_at = now() where pulse_id = p_pulse;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (p.tenant_id, p_actor, 'pulse.closed', 'pulse', p_pulse);
end $$;

-- stored once per pulse; a second call stores nothing and returns false
create function public.rpc_pulse_result_store(p_actor uuid, p_pulse text, p_invited int, p_responded int, p_reading jsonb, p_triggers jsonb) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare p record; done int;
begin
  select * into p from public.pulse where pulse_id = p_pulse;
  if not found or not app.consultant_on_engagement(p_actor, p.engagement_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p.status <> 'CLOSED' then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'the pulse is not closed'; end if;
  insert into public.pulse_result (pulse_id, tenant_id, engagement_id, n_invited, n_responded, suppressed, reading_json, triggers_json, created_by)
  values (p_pulse, p.tenant_id, p.engagement_id, p_invited, p_responded, p_reading is null, p_reading, coalesce(p_triggers, '[]'::jsonb), p_actor)
  on conflict (pulse_id) do nothing;
  get diagnostics done = row_count;
  if done = 1 then
    insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (p.tenant_id, p_actor, 'pulse.result_stored', 'pulse', p_pulse);
  end if;
  return done = 1;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'pulse result';
end $$;

revoke execute on function public.rpc_pulse_status(text), public.rpc_pulse_submit(text, jsonb), public.rpc_pulse_counts(text), public.rpc_closed_pulse_set(text, int),
                           public.rpc_pulse_create(uuid, text, int, text, text, text[], jsonb), public.rpc_pulse_open(uuid, text, timestamptz),
                           public.rpc_pulse_close(uuid, text), public.rpc_pulse_result_store(uuid, text, int, int, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.rpc_pulse_status(text), public.rpc_pulse_submit(text, jsonb), public.rpc_pulse_counts(text), public.rpc_closed_pulse_set(text, int),
                          public.rpc_pulse_create(uuid, text, int, text, text, text[], jsonb), public.rpc_pulse_open(uuid, text, timestamptz),
                          public.rpc_pulse_close(uuid, text), public.rpc_pulse_result_store(uuid, text, int, int, jsonb, jsonb)
  to service_role;

-- ---------------------------------------------------------------- reads (RLS)
-- what is asked: the PAC team and the client's administrators and executives. Results exist only once the pulse is closed.
alter table public.pulse enable row level security;
alter table public.pulse_result enable row level security;
revoke all on public.pulse, public.pulse_result from public, anon, authenticated, service_role;
grant select on public.pulse, public.pulse_result to authenticated, service_role;

create policy pulse_read on public.pulse for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy pulse_result_read on public.pulse_result for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
