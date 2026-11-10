-- Rules 2.2: the client owns the action plan (engine TRANSITIONS_2_2, design docs/designs/J4b-client-owned-plan.md, owner rulings Q-AP1 to Q-AP8).
-- Published last, once the schema, routes and plan page exist. It scores exactly as 2.1 and only changes who moves an action, so assessments created
-- from now on pin it (Q-AP5: new plans only). Assessments already created stay on their version and their plans work as before.
insert into public.rules_version (version_id, semver, status, published_at, equivalence_note)
values ('rul_v2_2', '2.2', 'PUBLISHED', now(),
        'Scores exactly as 2.1. The client owns the action plan: the system proposes, the client accepts, defers, ranks and publishes, and the consultant no longer moves actions.')
on conflict (version_id) do nothing;
