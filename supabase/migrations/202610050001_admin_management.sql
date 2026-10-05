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

