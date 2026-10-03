-- GrievX Campus: Supabase-backed student demo foundation.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'student' check (role in ('student', 'staff', 'department_head', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(150) not null,
  description text not null,
  location varchar(255) not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaint_images (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  storage_path text not null unique,
  original_filename varchar(255) not null,
  content_type varchar(100) not null,
  created_at timestamptz not null default now()
);

create index if not exists complaints_student_id_idx on public.complaints(student_id);
create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaint_images_complaint_id_idx on public.complaint_images(complaint_id);

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_images enable row level security;

revoke all on public.profiles from anon;
revoke all on public.complaints from anon;
revoke all on public.complaint_images from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.complaints to authenticated;
grant select, insert on public.complaint_images to authenticated;

drop policy if exists "Students can view own profile" on public.profiles;
create policy "Students can view own profile" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Students can update own profile" on public.profiles;
create policy "Students can update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users can view own complaints" on public.complaints;
create policy "Users can view own complaints" on public.complaints for select to authenticated
using ((select auth.uid()) = student_id);

drop policy if exists "Users can create own complaints" on public.complaints;
create policy "Users can create own complaints" on public.complaints for insert to authenticated
with check ((select auth.uid()) = student_id);

drop policy if exists "Users can view images on own complaints" on public.complaint_images;
create policy "Users can view images on own complaints" on public.complaint_images for select to authenticated
using (exists (select 1 from public.complaints c where c.id = complaint_id and c.student_id = (select auth.uid())));

drop policy if exists "Users can add images to own complaints" on public.complaint_images;
create policy "Users can add images to own complaints" on public.complaint_images for insert to authenticated
with check (exists (select 1 from public.complaints c where c.id = complaint_id and c.student_id = (select auth.uid())));

create or replace function public.handle_new_grievx_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.email, 'student')
  on conflict (id) do update set name = excluded.name, email = excluded.email;
  return new;
end;
$$;

revoke execute on function public.handle_new_grievx_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_grievx on auth.users;
create trigger on_auth_user_created_grievx after insert on auth.users
for each row execute procedure public.handle_new_grievx_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-evidence', 'complaint-evidence', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students can upload complaint evidence" on storage.objects;
create policy "Students can upload complaint evidence" on storage.objects for insert to authenticated
with check (bucket_id = 'complaint-evidence' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Students can read own complaint evidence" on storage.objects;
create policy "Students can read own complaint evidence" on storage.objects for select to authenticated
using (bucket_id = 'complaint-evidence' and owner_id = (select auth.uid()::text));

drop policy if exists "Students can delete own complaint evidence" on storage.objects;
create policy "Students can delete own complaint evidence" on storage.objects for delete to authenticated
using (bucket_id = 'complaint-evidence' and owner_id = (select auth.uid()::text));
