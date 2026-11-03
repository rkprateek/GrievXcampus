-- Restrict notification writes to the read-state field only.
-- Notification rows are created by the complaint notification trigger function.
revoke all privileges on table public.notifications from anon, authenticated;

grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
