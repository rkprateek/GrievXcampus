-- Admin-managed department accounts and strict department-scoped access.
alter table public.profiles
  add column if not exists department_id uuid
  references public.departments(id) on delete set null;

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

create index if not exists profiles_department_id_idx on public.profiles(department_id);

create or replace function public.current_grievx_department_id()
returns uuid language sql stable security definer set search_path = public
as $function$
  select department_id from public.profiles where id = (select auth.uid()) limit 1;
$function$;

create or replace function public.can_access_grievx_complaint(
  p_department_id uuid,
  p_assigned_staff_id uuid
)
returns boolean language sql stable security definer set search_path = public
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'admin'
        or (p.role = 'department_head' and p.department_id is not null and p.department_id = p_department_id)
        or (p.role = 'staff' and p.id = p_assigned_staff_id)
      )
  );
$function$;

revoke all on function public.current_grievx_department_id() from public, anon;
grant execute on function public.current_grievx_department_id() to authenticated;
revoke all on function public.can_access_grievx_complaint(uuid, uuid) from public, anon;
grant execute on function public.can_access_grievx_complaint(uuid, uuid) to authenticated;

-- Remove campus-wide staff access and replace it with department/assignment scope.
drop policy if exists "Staff can view all complaints" on public.complaints;
drop policy if exists "Staff can update complaints" on public.complaints;
drop policy if exists "Staff can view complaints in authorized scope" on public.complaints;
drop policy if exists "Staff can update complaints in authorized scope" on public.complaints;

create policy "Staff can view complaints in authorized scope"
on public.complaints for select to authenticated
using (public.can_access_grievx_complaint(department_id, assigned_staff_id));

create policy "Staff can update complaints in authorized scope"
on public.complaints for update to authenticated
using (public.can_access_grievx_complaint(department_id, assigned_staff_id))
with check (public.can_access_grievx_complaint(department_id, assigned_staff_id));

-- Department heads can see profiles in their own department; users can see themselves.
drop policy if exists "Staff can view profiles" on public.profiles;
drop policy if exists "Staff can view profiles in authorized department" on public.profiles;
create policy "Staff can view profiles in authorized department"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.is_grievx_admin()
  or (
    department_id = (select public.current_grievx_department_id())
    and (select public.current_grievx_role()) in ('staff', 'department_head')
  )
);

-- Admins alone can assign or change department membership.
grant update on public.profiles to authenticated;
drop policy if exists "Admins can assign department membership" on public.profiles;
create policy "Admins can assign department membership"
on public.profiles for update to authenticated
using ((select public.is_grievx_admin()))
with check ((select public.is_grievx_admin()));

-- Restrict assignment history to the complaint's authorized team.
drop policy if exists "Staff can view assignments" on public.staff_assignments;
drop policy if exists "Staff can create assignments" on public.staff_assignments;
drop policy if exists "Staff can update assignments" on public.staff_assignments;
drop policy if exists "Authorized staff can view complaint assignments" on public.staff_assignments;
create policy "Authorized staff can view complaint assignments"
on public.staff_assignments for select to authenticated
using (
  exists (
    select 1 from public.complaints c
    where c.id = complaint_id
      and public.can_access_grievx_complaint(c.department_id, c.assigned_staff_id)
  )
);

-- Staff may only read evidence attached to complaints in their authorized scope.
drop policy if exists "Scoped staff can read complaint evidence" on storage.objects;
create policy "Scoped staff can read complaint evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'complaint-evidence'
  and exists (
    select 1
    from public.complaint_images ci
    join public.complaints c on c.id = ci.complaint_id
    where ci.storage_path = name
      and public.can_access_grievx_complaint(c.department_id, c.assigned_staff_id)
  )
);


-- Preserve administrator assignment management while constraining department heads.
drop policy if exists "Admins and department heads can create scoped assignments" on public.staff_assignments;
create policy "Admins and department heads can create scoped assignments"
on public.staff_assignments for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and (
    public.is_grievx_admin()
    or exists (
      select 1 from public.complaints c
      join public.profiles actor on actor.id = (select auth.uid())
      join public.profiles target_staff on target_staff.id = staff_id
      where c.id = complaint_id
        and actor.role = 'department_head'
        and actor.department_id = c.department_id
        and target_staff.role = 'staff'
        and target_staff.department_id = c.department_id
    )
  )
);
drop policy if exists "Admins and department heads can update scoped assignments" on public.staff_assignments;
create policy "Admins and department heads can update scoped assignments"
on public.staff_assignments for update to authenticated
using (
  public.is_grievx_admin()
  or exists (
    select 1 from public.complaints c
    join public.profiles actor on actor.id = (select auth.uid())
    where c.id = complaint_id
      and actor.role = 'department_head'
      and actor.department_id = c.department_id
  )
)
with check (
  public.is_grievx_admin()
  or exists (
    select 1 from public.complaints c
    join public.profiles actor on actor.id = (select auth.uid())
    join public.profiles target_staff on target_staff.id = staff_id
    where c.id = complaint_id
      and actor.role = 'department_head'
      and actor.department_id = c.department_id
      and target_staff.role = 'staff'
      and target_staff.department_id = c.department_id
  )
);
