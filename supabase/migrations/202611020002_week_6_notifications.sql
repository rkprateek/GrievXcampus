-- GrievX Campus Week 6: notifications and realtime.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  complaint_id uuid references public.complaints(id) on delete cascade,
  type text not null check (type in ('complaint_submitted', 'status_changed', 'system')),
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_complaint_id_idx
  on public.notifications(complaint_id);

alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
on public.notifications
for select to authenticated
using ((select auth.uid()) = recipient_id);

drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read"
on public.notifications
for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create or replace function public.create_complaint_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.from_status is null then
    insert into public.notifications (
      recipient_id, complaint_id, type, title, message, created_at
    )
    select
      c.student_id,
      c.id,
      'complaint_submitted',
      'Complaint submitted',
      'Your complaint "' || c.title || '" has been submitted successfully.',
      coalesce(new.created_at, now())
    from public.complaints c
    where c.id = new.complaint_id;
  else
    insert into public.notifications (
      recipient_id, complaint_id, type, title, message, created_at
    )
    select
      c.student_id,
      c.id,
      'status_changed',
      'Complaint status updated',
      'Your complaint "' || c.title || '" changed from ' ||
        replace(new.from_status, '_', ' ') || ' to ' ||
        replace(new.to_status, '_', ' ') || '.',
      coalesce(new.created_at, now())
    from public.complaints c
    where c.id = new.complaint_id;
  end if;

  return new;
end;
$$;

revoke all on function public.create_complaint_notification() from public, anon, authenticated;

drop trigger if exists complaint_status_history_notification_trigger
  on public.complaint_status_history;
create trigger complaint_status_history_notification_trigger
after insert on public.complaint_status_history
for each row
execute function public.create_complaint_notification();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
