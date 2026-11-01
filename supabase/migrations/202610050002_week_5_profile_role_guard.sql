-- GrievX Campus Week 5: prevent client-side role escalation.
create policy "Staff can view profiles" on public.profiles
for select to authenticated
using ((select public.has_grievx_staff_access()));

create or replace function public.current_grievx_role()
returns text language sql security definer set search_path = public stable
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.current_grievx_role() from public, anon;
grant execute on function public.current_grievx_role() to authenticated;

drop policy if exists "Students can update own profile" on public.profiles;
drop policy if exists "Users can update own profile details" on public.profiles;
create policy "Users can update own profile details" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and role = (select public.current_grievx_role())
);
