-- 23 Separate scoring key (AC 3.6), part 1 of 2: let the scoring role run the read functions. Approved 15 Oct 2026. Grants only, no tables.
--   Additive on purpose: the application keeps working while the new key is added and the code that uses it is deployed.
--   Part 2 (20261015130000_scoring_key_revoke.sql) then takes the same functions away from the application's server key (service_role).
--   scoring_reader is a role with no login; PostgREST reaches it when a request carries a key whose role claim is scoring_reader
--   (SCORING_KEY, a JWT signed once and held only as an environment variable). It has the read grants it already had and no write function.

-- PostgREST connects as authenticator and switches to the role named in the key
grant scoring_reader to authenticator;

grant execute on function capture.frozen_response_set(text), capture.frozen_360_set(text), capture.closed_pulse_set(text, int) to scoring_reader;
grant execute on function public.rpc_frozen_response_set(text), public.rpc_frozen_360_set(text), public.rpc_closed_pulse_set(text, int) to scoring_reader;
