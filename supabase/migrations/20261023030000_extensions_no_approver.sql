-- Follows 20261023020000. The constraint that required an approver on every extension after the first has its own name (window_extension_check1),
-- so the earlier drop missed it. Owner ruling 22 Oct 2026: no approval step, any number of extensions.
alter table public.window_extension drop constraint if exists window_extension_check1;
