-- 23 Separate scoring key (AC 3.6), part 2 of 2: take the read functions away from the application's server key. Approved 15 Oct 2026.
--   Applied only after the code that uses SCORING_KEY is deployed. From here a leaked or misused service_role key can no longer read a response.
--   Rollback: grant execute on these six functions to service_role again.
--   Limit, stated plainly: SCORING_KEY and the server key sit in the same deployment, so a full compromise of the deployment reaches both.
revoke execute on function capture.frozen_response_set(text), capture.frozen_360_set(text), capture.closed_pulse_set(text, int) from service_role;
revoke execute on function public.rpc_frozen_response_set(text), public.rpc_frozen_360_set(text), public.rpc_closed_pulse_set(text, int) from service_role;
