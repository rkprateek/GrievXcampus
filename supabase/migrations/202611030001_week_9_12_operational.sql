-- GrievX Campus Weeks 9-12 operational foundation.
-- This migration mirrors the live Week 9-12 schema applied for the project.

create extension if not exists pg_trgm with schema extensions;

create or replace function public.is_grievx_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_grievx_admin() from public, anon;
grant execute on function public.is_grievx_admin() to authenticated;

alter table public.complaints
  add column if not exists category text,
  add column if not exists category_confidence numeric(5,4),
  add column if not exists category_model_version text,
  add column if not exists priority_confidence numeric(5,4),
  add column if not exists priority_model_version text,
  add column if not exists priority_source text,
  add column if not exists department_confidence numeric(5,4),
  add column if not exists department_source text,
  add column if not exists duplicate_of_id uuid references public.complaints(id) on delete set null,
  add column if not exists upvote_count integer not null default 0;

create index if not exists complaints_category_idx on public.complaints(category);
create index if not exists complaints_duplicate_of_id_idx on public.complaints(duplicate_of_id);
create index if not exists complaints_created_location_idx on public.complaints(created_at, location);

create table if not exists public.complaint_upvotes (
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (complaint_id, student_id)
);

alter table public.complaint_upvotes enable row level security;
grant select, insert on public.complaint_upvotes to authenticated;

drop policy if exists "Students can view their own complaint upvotes" on public.complaint_upvotes;
create policy "Students can view their own complaint upvotes"
on public.complaint_upvotes for select to authenticated
using ((select auth.uid()) = student_id);

drop policy if exists "Students can upvote another student's complaint" on public.complaint_upvotes;
create policy "Students can upvote another student's complaint"
on public.complaint_upvotes for insert to authenticated
with check (
  (select auth.uid()) = student_id
  and exists (
    select 1 from public.complaints c
    where c.id = complaint_id
      and c.student_id <> (select auth.uid())
      and c.status not in ('closed', 'rejected')
  )
);

create or replace function public.update_complaint_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.complaints set upvote_count = upvote_count + 1 where id = new.complaint_id;
  elsif tg_op = 'DELETE' then
    update public.complaints set upvote_count = greatest(upvote_count - 1, 0) where id = old.complaint_id;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.update_complaint_upvote_count() from public, anon, authenticated;
drop trigger if exists complaint_upvotes_count_trigger on public.complaint_upvotes;
create trigger complaint_upvotes_count_trigger
after insert or delete on public.complaint_upvotes
for each row execute function public.update_complaint_upvote_count();

create table if not exists public.duplicate_detection_config (
  id boolean primary key default true,
  title_weight numeric(4,3) not null default 0.40,
  description_weight numeric(4,3) not null default 0.40,
  location_weight numeric(4,3) not null default 0.20,
  threshold numeric(4,3) not null default 0.60,
  recency_days integer not null default 30,
  updated_at timestamptz not null default now(),
  check (id = true),
  check (threshold > 0 and threshold <= 1),
  check (recency_days > 0)
);

insert into public.duplicate_detection_config (id) values (true)
on conflict (id) do nothing;

alter table public.duplicate_detection_config enable row level security;
grant select, update on public.duplicate_detection_config to authenticated;

drop policy if exists "Admins can view duplicate settings" on public.duplicate_detection_config;
create policy "Admins can view duplicate settings"
on public.duplicate_detection_config for select to authenticated
using ((select public.is_grievx_admin()));

drop policy if exists "Admins can update duplicate settings" on public.duplicate_detection_config;
create policy "Admins can update duplicate settings"
on public.duplicate_detection_config for update to authenticated
using ((select public.is_grievx_admin()))
with check ((select public.is_grievx_admin()));

grant select on public.departments to authenticated;
drop policy if exists "Authenticated users can view department directory" on public.departments;
create policy "Authenticated users can view department directory"
on public.departments for select to authenticated using (true);

create or replace function public.find_possible_duplicates(
  p_title text, p_description text, p_location text
)
returns table (
  id uuid,
  title varchar,
  description text,
  location varchar,
  status text,
  created_at timestamptz,
  upvote_count integer,
  title_similarity real,
  description_similarity real,
  location_match boolean,
  similarity_score real
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg public.duplicate_detection_config%rowtype;
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select d.* into cfg from public.duplicate_detection_config d where d.id = true;

  return query
  with candidates as (
    select c.id, c.title, c.description, c.location, c.status, c.created_at,
      c.upvote_count,
      extensions.similarity(lower(coalesce(c.title, '')), lower(trim(coalesce(p_title, '')))) as title_similarity,
      extensions.similarity(lower(coalesce(c.description, '')), lower(trim(coalesce(p_description, '')))) as description_similarity,
      lower(trim(coalesce(c.location, ''))) = lower(trim(coalesce(p_location, ''))) as location_match
    from public.complaints c
    where c.student_id <> current_user_id
      and c.created_at >= now() - make_interval(days => cfg.recency_days)
      and c.status not in ('closed', 'rejected')
  )
  select c.id, c.title, c.description, c.location, c.status, c.created_at, c.upvote_count,
    c.title_similarity, c.description_similarity, c.location_match,
    (cfg.title_weight * c.title_similarity
      + cfg.description_weight * c.description_similarity
      + cfg.location_weight * case when c.location_match then 1 else 0 end)::real
  from candidates c
  where (cfg.title_weight * c.title_similarity
      + cfg.description_weight * c.description_similarity
      + cfg.location_weight * case when c.location_match then 1 else 0 end) >= cfg.threshold
  order by similarity_score desc, c.created_at desc
  limit 5;
end;
$$;

revoke all on function public.find_possible_duplicates(text, text, text) from public, anon;
grant execute on function public.find_possible_duplicates(text, text, text) to authenticated;

create or replace function public.admin_analytics_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when public.is_grievx_admin() then
    jsonb_build_object(
      'total', (select count(*) from public.complaints),
      'submitted', (select count(*) from public.complaints where status = 'submitted'),
      'active', (select count(*) from public.complaints where status in ('assigned', 'in_progress')),
      'resolved', (select count(*) from public.complaints where status in ('resolved', 'closed')),
      'critical', (select count(*) from public.complaints where priority = 'critical')
    )
  else '{}'::jsonb end;
$$;

revoke all on function public.admin_analytics_summary() from public, anon;
grant execute on function public.admin_analytics_summary() to authenticated;


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
  department_uuid uuid;
begin
  select d.id into department_uuid from public.departments d
  where d.code = p_department_code limit 1;

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
    and student_id = (select auth.uid());

  if not found then
    raise exception 'Complaint not found or not owned by the current student';
  end if;
end;
$$;

revoke all on function public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text) from public, anon;
grant execute on function public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text) to authenticated;
