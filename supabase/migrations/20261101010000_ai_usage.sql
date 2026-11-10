-- AI polish spend guard (owner Q-AL30, Q-AL41, 1 Nov 2026). One row per Anthropic call made for a report chapter: the model, the
-- tokens in and out, and the estimated cost, so the narrative route can refuse once this month's estimate reaches the cap in config.
-- Holds no text, no names and no numbers from the report. Insert only: rows are never changed or removed.
create table public.ai_usage (
  usage_id       text primary key default 'aiu_' || replace(gen_random_uuid()::text, '-', ''),
  report_id      text not null references public.report(report_id),
  tenant_id      text not null,
  chapter        text not null,
  model          text not null,
  effort         text,
  input_tokens   integer not null check (input_tokens >= 0),
  output_tokens  integer not null check (output_tokens >= 0),
  cost_usd       numeric(10, 6) not null check (cost_usd >= 0),
  created_at     timestamptz not null default now(),
  created_by     uuid
);
create index ai_usage_created_at on public.ai_usage (created_at);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public, anon, authenticated, service_role;
grant select on public.ai_usage to authenticated;
grant select, insert on public.ai_usage to service_role;
create policy ai_usage_read on public.ai_usage for select to authenticated
  using ((select app.is_super_admin()) or (select app.is_pac_consultant()));
