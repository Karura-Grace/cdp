-- Journey 1, block 26 (second file). Perspective comparison, the post debrief contradiction flags and the written back keep and protect entries.
--   divergence_flags: the consultant's per field "these differ" judgement for text fields in E, F and G (spec 1.5.4). Lives on the AGREED row, so the
--                     setup lock guard freezes it at launch with the rest of the section.
--   contradiction_flags: H1, H3, H4 contradiction flags set by the consultant after the debrief (spec Table 16). Setup is locked by then, so they sit on the engagement.
--   g5_system: the system entries of G5, written from the KEEP AND PROTECT classification once a score is evaluated, labelled by source.
alter table public.setup_record add column divergence_flags jsonb not null default '{}'::jsonb;
alter table public.engagement
  add column contradiction_flags jsonb,
  add column g5_system jsonb;
