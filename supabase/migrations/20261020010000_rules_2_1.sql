-- Rules version 2.1 (17 October 2026 spec; owner decisions V-02 and V-05, Journey 2 design S1).
-- New assessments take the newest PUBLISHED rules version, so every assessment created from now on is pinned to 2.1;
-- assessments already created stay on 2.0 and their frozen scores reproduce unchanged.
-- 2.1 grows as journeys land (V-03, V-04, V-06, V-07, V-12, V-14, V-16); no client engagement runs before all are built.
insert into public.rules_version (version_id, semver, status, published_at, equivalence_note)
values ('rul_v2_1', '2.1', 'PUBLISHED', now(),
        'Speeding below 40% of median or 8 minutes; any two quality flags exclude; 360 sections need 3 observed items. Not comparable at item level with 2.0 exclusions.')
on conflict (version_id) do nothing;
