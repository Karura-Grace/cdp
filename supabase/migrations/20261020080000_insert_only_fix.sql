-- Fix to 20261020030000 and 20261020050000: Supabase's default privileges give service_role every right on a new table, so the
-- "grant select, insert" there did not make the tables insert only (an e2e test deleted an extension record). Take the rest away.
revoke update, delete, truncate on public.window_extension, public.exclusion_log from service_role, authenticated, anon;
