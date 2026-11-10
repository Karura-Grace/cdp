-- Block 33: leader proposes raters, line manager (or Client Admin) approves (spec 1.4.6).
alter table public.rater_nomination drop constraint rater_nomination_status_check;
alter table public.rater_nomination
  add constraint rater_nomination_status_check check (status in ('PROPOSED', 'NOMINATED', 'INVITED')),
  add column proposed_by text,
  add column approved_by uuid,
  add column approved_at timestamptz;
