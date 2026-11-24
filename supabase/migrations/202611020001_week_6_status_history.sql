-- GrievX Campus Week 6: complaint status history.

create table if not exists public.complaint_status_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  from_status text,
  to_status text not null
    check (to_status in ('submitted', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists complaint_status_history_complaint_id_idx
  on public.complaint_status_history(complaint_id, created_at);

create index if not exists complaint_status_history_changed_by_idx
  on public.complaint_status_history(changed_by);

alter table public.complaint_status_history enable row level security;

grant select on public.complaint_status_history to authenticated;

drop policy if exists "Students can view own complaint status history"
  on public.complaint_status_history;
create policy "Students can view own complaint status history"
on public.complaint_status_history
for select to authenticated
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and c.student_id = (select auth.uid())
  )
);

drop policy if exists "Staff can view complaint status history"
  on public.complaint_status_history;
create policy "Staff can view complaint status history"
on public.complaint_status_history
for select to authenticated
using ((select public.has_grievx_staff_access()));

create or replace function public.record_complaint_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.complaint_status_history (
      complaint_id,
      from_status,
      to_status,
      changed_by,
      created_at
    )
    values (
      new.id,
      null,
      new.status,
      (select auth.uid()),
      coalesce(new.created_at, now())
    );
  elsif old.status is distinct from new.status then
    insert into public.complaint_status_history (
      complaint_id,
      from_status,
      to_status,
      changed_by,
      created_at
    )
    values (
      new.id,
      old.status,
      new.status,
      (select auth.uid()),
      now()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_complaint_status_history() from public, anon, authenticated;

drop trigger if exists complaints_status_history_trigger on public.complaints;
create trigger complaints_status_history_trigger
after insert or update of status on public.complaints
for each row
execute function public.record_complaint_status_history();

insert into public.complaint_status_history (
  complaint_id,
  from_status,
  to_status,
  changed_by,
  created_at
)
select
  c.id,
  null,
  c.status,
  c.student_id,
  c.created_at
from public.complaints c
where not exists (
  select 1
  from public.complaint_status_history h
  where h.complaint_id = c.id
);
