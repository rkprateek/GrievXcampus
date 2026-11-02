-- GrievX Campus Week 10: ML triage persistence and safe duplicate detection.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.complaint_ml_predictions (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null unique references public.complaints(id) on delete cascade,
  prediction_state text not null default 'completed'
    check (prediction_state in ('completed', 'manual_review', 'unavailable', 'error')),
  category text,
  category_confidence numeric(6,5)
    check (category_confidence is null or (category_confidence >= 0 and category_confidence <= 1)),
  priority text
    check (priority is null or priority in ('normal', 'high', 'critical')),
  priority_confidence numeric(6,5)
    check (priority_confidence is null or (priority_confidence >= 0 and priority_confidence <= 1)),
  priority_method text,
  priority_explanation text,
  matched_rules text[] not null default '{}',
  department_id uuid references public.departments(id) on delete set null,
  department_name text,
  department_code text,
  routing_confidence numeric(6,5)
    check (routing_confidence is null or (routing_confidence >= 0 and routing_confidence <= 1)),
  requires_manual_review boolean not null default false,
  review_reason text,
  category_model_version text,
  priority_model_version text,
  routing_model_version text,
  prediction_source text not null default 'fastapi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complaint_ml_predictions_review_idx
  on public.complaint_ml_predictions(requires_manual_review, created_at desc);

create index if not exists complaint_ml_predictions_department_idx
  on public.complaint_ml_predictions(department_id);

alter table public.complaint_ml_predictions enable row level security;

grant select, insert, update on public.complaint_ml_predictions to authenticated;

drop policy if exists "Students can view own ML prediction" on public.complaint_ml_predictions;
create policy "Students can view own ML prediction"
on public.complaint_ml_predictions
for select to authenticated
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and c.student_id = (select auth.uid())
  )
);

drop policy if exists "Staff can view ML predictions" on public.complaint_ml_predictions;
create policy "Staff can view ML predictions"
on public.complaint_ml_predictions
for select to authenticated
using ((select public.has_grievx_staff_access()));

drop policy if exists "Students can save own ML prediction" on public.complaint_ml_predictions;
create policy "Students can save own ML prediction"
on public.complaint_ml_predictions
for insert to authenticated
with check (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and c.student_id = (select auth.uid())
  )
);

drop policy if exists "Students can update own ML prediction" on public.complaint_ml_predictions;
create policy "Students can update own ML prediction"
on public.complaint_ml_predictions
for update to authenticated
using (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and c.student_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.complaints c
    where c.id = complaint_id
      and c.student_id = (select auth.uid())
  )
);

drop policy if exists "Staff can update ML predictions" on public.complaint_ml_predictions;
create policy "Staff can update ML predictions"
on public.complaint_ml_predictions
for update to authenticated
using ((select public.has_grievx_staff_access()))
with check ((select public.has_grievx_staff_access()));

create or replace function public.find_duplicate_complaints(
  p_title text,
  p_description text,
  p_location text,
  p_window_days integer default 90,
  p_threshold numeric default 0.55,
  p_location_threshold numeric default 0.45,
  p_limit integer default 5
)
returns table (
  id uuid,
  title text,
  description text,
  location text,
  status text,
  created_at timestamptz,
  similarity numeric,
  text_similarity numeric,
  location_similarity numeric
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with candidates as (
    select
      c.id,
      c.title,
      c.description,
      c.location,
      c.status,
      c.created_at,
      greatest(
        extensions.similarity(lower(c.title), lower(trim(p_title))),
        extensions.similarity(lower(c.description), lower(trim(p_description))),
        extensions.similarity(
          lower(c.title || ' ' || c.description),
          lower(trim(p_title || ' ' || p_description))
        )
      ) as text_similarity,
      extensions.similarity(lower(c.location), lower(trim(p_location))) as location_similarity
    from public.complaints c
    where (select auth.uid()) is not null
      and c.created_at >= now() - make_interval(days => least(greatest(p_window_days, 1), 365))
      and c.student_id <> (select auth.uid())
      and c.status not in ('closed', 'rejected')
  ),
  scored as (
    select
      id,
      title,
      description,
      location,
      status,
      created_at,
      round((text_similarity * 0.70 + location_similarity * 0.30)::numeric, 4) as similarity,
      round(text_similarity::numeric, 4) as text_similarity,
      round(location_similarity::numeric, 4) as location_similarity
    from candidates
  )
  select
    id,
    title,
    description,
    location,
    status,
    created_at,
    similarity,
    text_similarity,
    location_similarity
  from scored
  where (select auth.uid()) is not null
    and similarity >= greatest(least(p_threshold, 0.95), 0.20)
    and location_similarity >= greatest(least(p_location_threshold, 0.90), 0.20)
  order by similarity desc, created_at desc
  limit greatest(least(p_limit, 10), 1);
$$;

revoke all on function public.find_duplicate_complaints(text, text, text, integer, numeric, numeric, integer)
  from public, anon;
grant execute on function public.find_duplicate_complaints(text, text, text, integer, numeric, numeric, integer)
  to authenticated;

comment on function public.find_duplicate_complaints(text, text, text, integer, numeric, numeric, integer)
is 'Week 10 application-level duplicate detection. Uses title/description similarity plus a required near-matching campus location. It does not block submission.';
