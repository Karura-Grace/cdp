-- Q-ER21 (owner, 29 Oct 2026): drop the five argument rpc_log_segment_query from 20261011100000. The six argument version
-- (20261021020000, p_resolved default null) replaced it, but the old one stayed, so a call without p_resolved matched both
-- (PGRST203) and nothing was logged. Calls without p_resolved now resolve to the six argument version through its default.
drop function if exists public.rpc_log_segment_query(uuid, text, text, jsonb, text);
