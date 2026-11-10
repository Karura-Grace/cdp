-- Journey 1 (design docs/designs/J1-setup-launch-privacy.md), block 26.
-- Setup records already hold EXECUTIVE, HR and AGREED perspectives. This adds the facilitator on the workshop panel, the stored
-- setup version and snapshot written at launch (spec 1.7), the assessment purpose that the consent text reproduces (1.4.5), and the
-- two step launch (consultant approves, Client Admin launches).
alter table public.setup_record add column facilitator text check (facilitator is null or length(btrim(facilitator)) between 1 and 120);
alter table public.engagement
  add column setup_version int not null default 1 check (setup_version > 0),
  add column setup_snapshot jsonb,
  add column purpose text check (purpose is null or length(btrim(purpose)) between 1 and 1000),
  add column launch_approved_by uuid,
  add column launch_approved_at timestamptz;
