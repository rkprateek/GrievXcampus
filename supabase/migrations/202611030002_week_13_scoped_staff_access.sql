-- Week 13: narrow staff and department-head access to their authorized scope.

alter table public.profiles
  add column if not exists department_id uuid
  references public.departments(id) on delete set null;

create index if not exists profiles_department_id_idx
  on public.profiles(department_id);

create or replace function public.can_access_grievx_complaint(
  p_department_id uuid,
  p_assigned_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role = 'admin'
        or (
          p.role = 'department_head'
          and p.department_id is not null
          and p.department_id = p_department_id
        )
        or (
          p.role = 'staff'
          and p.id = p_assigned_staff_id
        )
      )
  );
$$;

revoke all on function public.can_access_grievx_complaint(uuid, uuid)
  from public, anon;
grant execute on function public.can_access_grievx_complaint(uuid, uuid)
  to authenticated;

-- Remove the previous campus-wide staff policies.
drop policy if exists "Staff can view all complaints" on public.complaints;
drop policy if exists "Staff can update complaints" on public.complaints;

create policy "Staff can view complaints in authorized scope"
on public.complaints for select to authenticated
using (
  public.can_access_grievx_complaint(department_id, assigned_staff_id)
);

create policy "Staff can update complaints in authorized scope"
on public.complaints for update to authenticated
using (
  public.can_access_grievx_complaint(department_id, assigned_staff_id)
)
with check (
  public.can_access_grievx_complaint(department_id, assigned_staff_id)
);

-- Scope assignment history to people who can access its complaint.
drop policy if exists "Staff can view assignments" on public.staff_assignments;
drop policy if exists "Staff can create assignments" on public.staff_assignments;
drop policy if exists "Staff can update assignments" on public.staff_assignments;

create policy "Authorized staff can view complaint assignments"
on public.staff_assignments for select to authenticated
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and public.can_access_grievx_complaint(c.department_id, c.assigned_staff_id)
  )
);

create policy "Admins and department heads can create scoped assignments"
on public.staff_assignments for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and (
    public.is_grievx_admin()
    or exists (
      select 1
      from public.complaints c
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

create policy "Admins and department heads can update scoped assignments"
on public.staff_assignments for update to authenticated
using (
  public.is_grievx_admin()
  or exists (
    select 1
    from public.complaints c
    join public.profiles actor on actor.id = (select auth.uid())
    where c.id = complaint_id
      and actor.role = 'department_head'
      and actor.department_id = c.department_id
  )
)
with check (
  public.is_grievx_admin()
  or exists (
    select 1
    from public.complaints c
    join public.profiles actor on actor.id = (select auth.uid())
    join public.profiles target_staff on target_staff.id = staff_id
    where c.id = complaint_id
      and actor.role = 'department_head'
      and actor.department_id = c.department_id
      and target_staff.role = 'staff'
      and target_staff.department_id = c.department_id
  )
);

-- Use a SECURITY DEFINER accessor to avoid recursive profile RLS evaluation.
create or replace function public.current_grievx_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $
  select department_id
  from public.profiles
  where id = (select auth.uid())
  limit 1;
$;

revoke all on function public.current_grievx_department_id() from public, anon;
grant execute on function public.current_grievx_department_id() to authenticated;

-- Staff may see only profile details needed for their own department.
drop policy if exists "Staff can view profiles" on public.profiles;
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

-- Allow authorized staff to inspect evidence for complaints in their scope.
grant select on public.complaint_images to authenticated;
drop policy if exists "Staff can view complaint evidence metadata" on public.complaint_images;
create policy "Staff can view complaint evidence metadata"
on public.complaint_images for select to authenticated
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and public.can_access_grievx_complaint(c.department_id, c.assigned_staff_id)
  )
);

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

-- Existing staff accounts must be assigned a department by an administrator
-- before department-head or staff-scoped work is visible to them.

-- Give administrators a controlled UI path to place staff and department heads
-- into a department. The existing role guard still protects self-service edits.
grant update on public.profiles to authenticated;
drop policy if exists "Admins can assign department membership" on public.profiles;
create policy "Admins can assign department membership"
on public.profiles for update to authenticated
using ((select public.is_grievx_admin()))
with check ((select public.is_grievx_admin()));

-- Staff may update lifecycle state only. Department heads may manage priority and
-- assignments inside their department, but cannot rewrite student-submitted content.
create or replace function public.guard_scoped_complaint_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  target_staff_department uuid;
begin
  actor_role := (select public.current_grievx_role());

  if actor_role = 'staff' and (
    new.student_id is distinct from old.student_id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.location is distinct from old.location
    or new.department_id is distinct from old.department_id
    or new.assigned_staff_id is distinct from old.assigned_staff_id
    or new.priority is distinct from old.priority
    or new.category is distinct from old.category
    or new.category_confidence is distinct from old.category_confidence
    or new.category_model_version is distinct from old.category_model_version
    or new.priority_confidence is distinct from old.priority_confidence
    or new.priority_model_version is distinct from old.priority_model_version
    or new.priority_source is distinct from old.priority_source
    or new.department_confidence is distinct from old.department_confidence
    or new.department_source is distinct from old.department_source
    or new.duplicate_of_id is distinct from old.duplicate_of_id
    or new.upvote_count is distinct from old.upvote_count
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Staff members may update complaint status only';
  end if;

  if actor_role = 'department_head' then
    if new.student_id is distinct from old.student_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.location is distinct from old.location
      or new.created_at is distinct from old.created_at
      or new.department_id is distinct from old.department_id
      or new.category is distinct from old.category
      or new.category_confidence is distinct from old.category_confidence
      or new.category_model_version is distinct from old.category_model_version
      or new.priority_confidence is distinct from old.priority_confidence
      or new.priority_model_version is distinct from old.priority_model_version
      or new.priority_source is distinct from old.priority_source
      or new.department_confidence is distinct from old.department_confidence
      or new.department_source is distinct from old.department_source
      or new.duplicate_of_id is distinct from old.duplicate_of_id
      or new.upvote_count is distinct from old.upvote_count
    then
      raise exception 'Department heads cannot change student-submitted complaint data or ML metadata';
    end if;

    if new.assigned_staff_id is not null then
      select p.department_id into target_staff_department
      from public.profiles p
      where p.id = new.assigned_staff_id and p.role = 'staff';
      if target_staff_department is distinct from new.department_id then
        raise exception 'A department head may assign only staff from their own department';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_scoped_complaint_updates() from public, anon, authenticated;
drop trigger if exists guard_scoped_complaint_updates_trigger on public.complaints;
create trigger guard_scoped_complaint_updates_trigger
before update on public.complaints
for each row execute function public.guard_scoped_complaint_updates();
