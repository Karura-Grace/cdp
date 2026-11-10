-- Owner ruling of 22 October 2026 (Erick Ngala comment 40, rounds Q-SV1 and Q-SV2 in context-sessions/DECISIONS-LOG.md): some parts of the platform are
-- only available to a client that has paid for or selected them. The Super Admin ticks them per client.
--   LEADERSHIP_360, CLIENT_LOGO, PULSE, GROUP_RESULTS
-- A NEW client starts with none ticked. Every client that exists today keeps everything it has now (backfilled below, once).
alter table public.tenant add column services text[] not null default '{}'
  check (services <@ array['LEADERSHIP_360', 'CLIENT_LOGO', 'PULSE', 'GROUP_RESULTS']::text[]);
update public.tenant set services = array['LEADERSHIP_360', 'CLIENT_LOGO', 'PULSE', 'GROUP_RESULTS']::text[];
