-- GrievX Campus Week 11: automatic staff matching and assignment.
-- Evidence images remain visible to admins but are intentionally excluded from ML input.

insert into public.departments (name, code) values
  ('Electrical', 'ELEC'),
  ('Plumbing', 'PLMB'),
  ('IT & Network', 'IT'),
  ('Cleanliness', 'CLEAN'),
  ('Classroom & Facilities', 'FAC'),
  ('Hostel', 'HOSTEL'),
  ('Security', 'SEC'),
  ('Transport', 'TRANS'),
  ('General', 'GEN')
on conflict (code) do nothing;

create table if not exists public.staff_directory (
  staff_id uuid primary key references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  skills text[] not null default '{}',
  is_available boolean not null default true,
  max_active_assignments integer not null default 10
    check (max_active_assignments > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_directory_department_available_idx
  on public.staff_directory(department_id, is_available);

alter table public.staff_directory enable row level security;
grant select, insert, update, delete on public.staff_directory to authenticated;

drop policy if exists "Admins manage staff directory" on public.staff_directory;
create policy "Admins manage staff directory"
on public.staff_directory for all to authenticated
using ((select public.is_grievx_admin()))
with check ((select public.is_grievx_admin()));

drop policy if exists "Staff can view their own directory entry" on public.staff_directory;
create policy "Staff can view their own directory entry"
on public.staff_directory for select to authenticated
using (staff_id = (select auth.uid()));

alter table public.staff_assignments
  alter column assigned_by drop not null,
  add column if not exists assignment_source text not null default 'manual'
    check (assignment_source in ('manual', 'auto_ml'));

create index if not exists staff_assignments_active_complaint_idx
  on public.staff_assignments(complaint_id)
  where unassigned_at is null;

create or replace function public.apply_complaint_ml_predictions(
  p_complaint_id uuid,
  p_category text,
  p_category_confidence numeric,
  p_category_model_version text,
  p_priority text,
  p_priority_confidence numeric,
  p_priority_model_version text,
  p_priority_source text,
  p_department_code text,
  p_department_confidence numeric,
  p_department_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  department_uuid uuid;
  selected_staff_id uuid;
  active_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_priority not in ('normal', 'high', 'critical') then
    raise exception 'Invalid priority value';
  end if;

  select d.id into department_uuid
  from public.departments d
  where d.code = p_department_code
  limit 1;

  update public.complaints
  set category = p_category,
      category_confidence = p_category_confidence,
      category_model_version = p_category_model_version,
      priority = p_priority,
      priority_confidence = p_priority_confidence,
      priority_model_version = p_priority_model_version,
      priority_source = p_priority_source,
      department_confidence = p_department_confidence,
      department_source = p_department_source,
      department_id = department_uuid,
      updated_at = now()
  where id = p_complaint_id
    and student_id = current_user_id;

  if not found then
    raise exception 'Complaint not found or not owned by the current student';
  end if;

  -- Low-confidence department predictions are deliberately not auto-assigned.
  if department_uuid is null
     or p_department_source = 'manual_review'
     or coalesce(p_department_confidence, 0) < 0.55 then
    return;
  end if;

  -- Serialize automatic selection within a department to reduce over-assignment races.
  perform pg_advisory_xact_lock(hashtextextended(department_uuid::text, 0));

  select sd.staff_id,
         coalesce((
           select count(*)::integer
           from public.complaints active_complaint
           where active_complaint.assigned_staff_id = sd.staff_id
             and active_complaint.status in ('assigned', 'in_progress')
         ), 0)
  into selected_staff_id, active_count
  from public.staff_directory sd
  join public.profiles staff_profile on staff_profile.id = sd.staff_id
  where sd.department_id = department_uuid
    and sd.is_available = true
    and staff_profile.role in ('staff', 'department_head')
    and coalesce((
      select count(*)::integer
      from public.complaints active_complaint
      where active_complaint.assigned_staff_id = sd.staff_id
        and active_complaint.status in ('assigned', 'in_progress')
    ), 0) < sd.max_active_assignments
  order by
    case when exists (
      select 1
      from unnest(sd.skills) skill
      where lower(trim(skill)) = lower(trim(coalesce(p_category, '')))
         or lower(trim(skill)) = lower(trim(coalesce(p_department_code, '')))
    ) then 0 else 1 end,
    coalesce((
      select count(*)::integer
      from public.complaints active_complaint
      where active_complaint.assigned_staff_id = sd.staff_id
        and active_complaint.status in ('assigned', 'in_progress')
    ), 0) asc,
    sd.created_at asc
  limit 1
  for update of sd skip locked;

  if selected_staff_id is null then
    return;
  end if;

  update public.complaints
  set assigned_staff_id = selected_staff_id,
      status = case when status = 'submitted' then 'assigned' else status end,
      updated_at = now()
  where id = p_complaint_id
    and student_id = current_user_id;

  insert into public.staff_assignments (
    complaint_id, staff_id, assigned_by, assignment_source
  ) values (
    p_complaint_id, selected_staff_id, null, 'auto_ml'
  );

  insert into public.notifications (
    recipient_id, complaint_id, type, title, message
  ) values (
    selected_staff_id,
    p_complaint_id,
    'system',
    'New complaint assigned',
    'A new campus complaint has been automatically assigned to you.'
  );
end;
$$;

revoke all on function public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text)
  from public, anon;
grant execute on function public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,text,numeric,text,text,numeric,text)
  to authenticated;
