-- GrievX Campus Week 5: secure admin complaint management.

create or replace function public.is_grievx_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_grievx_admin() from public, anon;
grant execute on function public.is_grievx_admin() to authenticated;

-- Students must not be able to change their own role.
revoke update on public.profiles from authenticated;

drop policy if exists "Students can update own profile" on public.profiles;

-- Admins can inspect profiles needed for complaint management.
grant select on public.profiles to authenticated;

drop policy if exists "Admins can view profiles" on public.profiles;
create policy "Admins can view profiles" on public.profiles
for select to authenticated
using (public.is_grievx_admin());

-- Admins can view every complaint.
drop policy if exists "Admins can view all complaints" on public.complaints;
create policy "Admins can view all complaints" on public.complaints
for select to authenticated
using (public.is_grievx_admin());

-- Admins can update lifecycle status and other operational complaint fields.
grant update on public.complaints to authenticated;

drop policy if exists "Admins can update complaints" on public.complaints;
create policy "Admins can update complaints" on public.complaints
for update to authenticated
using (public.is_grievx_admin())
with check (public.is_grievx_admin());

-- Admins can inspect evidence metadata.
drop policy if exists "Admins can view complaint images" on public.complaint_images;
create policy "Admins can view complaint images" on public.complaint_images
for select to authenticated
using (public.is_grievx_admin());

-- Admins can read evidence files from the private bucket.
drop policy if exists "Admins can read complaint evidence" on storage.objects;
create policy "Admins can read complaint evidence" on storage.objects
for select to authenticated
using (
  bucket_id = 'complaint-evidence'
  and public.is_grievx_admin()
);

-- GrievX Campus Week 5: admin complaint management.
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

alter table public.complaints
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists priority text not null default 'normal'
    check (priority in ('normal', 'high', 'critical')),
  add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null;

create index if not exists complaints_department_id_idx on public.complaints(department_id);
create index if not exists complaints_priority_idx on public.complaints(priority);
create index if not exists complaints_assigned_staff_id_idx on public.complaints(assigned_staff_id);
create index if not exists staff_assignments_complaint_id_idx on public.staff_assignments(complaint_id);
create index if not exists staff_assignments_staff_id_idx on public.staff_assignments(staff_id);

alter table public.departments enable row level security;
alter table public.staff_assignments enable row level security;

create or replace function public.has_grievx_staff_access()
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('staff', 'department_head', 'admin')
  );
$$;

revoke all on function public.has_grievx_staff_access() from public, anon;
grant execute on function public.has_grievx_staff_access() to authenticated;

grant select on public.departments to authenticated;
grant select on public.staff_assignments to authenticated;
grant insert, update on public.complaints to authenticated;
grant insert, update on public.staff_assignments to authenticated;

drop policy if exists "Staff can view departments" on public.departments;
create policy "Staff can view departments" on public.departments for select to authenticated
using ((select public.has_grievx_staff_access()));

drop policy if exists "Staff can view all complaints" on public.complaints;
create policy "Staff can view all complaints" on public.complaints for select to authenticated
using ((select public.has_grievx_staff_access()));

drop policy if exists "Staff can update complaints" on public.complaints;
create policy "Staff can update complaints" on public.complaints for update to authenticated
using ((select public.has_grievx_staff_access()))
with check ((select public.has_grievx_staff_access()));

drop policy if exists "Staff can view assignments" on public.staff_assignments;
create policy "Staff can view assignments" on public.staff_assignments for select to authenticated
using ((select public.has_grievx_staff_access()));

drop policy if exists "Staff can create assignments" on public.staff_assignments;
create policy "Staff can create assignments" on public.staff_assignments for insert to authenticated
with check ((select public.has_grievx_staff_access()) and assigned_by = (select auth.uid()));

drop policy if exists "Staff can update assignments" on public.staff_assignments;
create policy "Staff can update assignments" on public.staff_assignments for update to authenticated
using ((select public.has_grievx_staff_access()))
with check ((select public.has_grievx_staff_access()));

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
