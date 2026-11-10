-- Owner ruling of 22 October 2026 (Erick Ngala comments 23 and 27, logged in context-sessions/DECISIONS-LOG.md): nobody can void or change
-- a response, ever. What is keyed in remains the information analysed. Quality flags stay as information only.
-- Removes the two void functions (20261020050000 created them, 20261021030000 widened the first). The exclusion log table and its rows stay
-- (insert only, history), and capture.response.voided_reason stays so any earlier test row keeps being left out of the frozen set.
drop function if exists public.rpc_void_response(text, text, text, uuid);
drop function if exists capture.void_response(text, text, text, uuid);
