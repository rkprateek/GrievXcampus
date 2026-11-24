-- Automatic complaint routing and prediction history.
-- Every complaint receives a department; uncertain or unavailable predictions
-- are safely routed to General instead of waiting for an administrator.

alter table public.complaints
  add column if not exists suggested_department_id uuid references public.departments(id) on delete set null;

create table if not exists public.complaint_ml_predictions (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  category text not null,
  category_confidence numeric(5,4) not null default 0,
  category_model_version text not null,
  priority text not null check (priority in ('normal', 'high', 'critical')),
  priority_confidence numeric(5,4) not null default 0,
  priority_model_version text not null,
  priority_source text not null,
  suggested_department_id uuid references public.departments(id) on delete set null,
  department_confidence numeric(5,4) not null default 0,
  department_source text not null,
  created_at timestamptz not null default now()
);
create index if not exists complaint_ml_predictions_complaint_created_idx
  on public.complaint_ml_predictions(complaint_id, created_at desc);
alter table public.complaint_ml_predictions enable row level security;
grant select on public.complaint_ml_predictions to authenticated;
drop policy if exists "Students and authorized staff can view complaint ML history" on public.complaint_ml_predictions;
create policy "Students and authorized staff can view complaint ML history"
on public.complaint_ml_predictions for select to authenticated
using (exists (
  select 1 from public.complaints c where c.id = complaint_id
  and (c.student_id = (select auth.uid())
    or public.can_access_grievx_complaint(c.department_id, c.assigned_staff_id))
));

create or replace function public.apply_complaint_ml_predictions(
  p_complaint_id uuid, p_category text, p_category_confidence numeric,
  p_category_model_version text, p_priority text, p_priority_confidence numeric,
  p_priority_model_version text, p_priority_source text, p_department_code text,
  p_department_confidence numeric, p_department_source text
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  department_uuid uuid;
  safe_priority text;
  safe_department_code text;
  safe_category text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  safe_priority := case when p_priority in ('normal','high','critical') then p_priority else 'normal' end;
  safe_category := coalesce(nullif(p_category,''),'General');
  safe_department_code := case
    when exists (select 1 from public.departments where code = p_department_code) then p_department_code
    else 'GEN' end;
  select id into department_uuid from public.departments where code = safe_department_code limit 1;
  if department_uuid is null then
    raise exception 'General department (GEN) is missing. Seed the department directory before accepting complaints.';
  end if;

  update public.complaints set
    category = safe_category,
    category_confidence = greatest(0,least(1,coalesce(p_category_confidence,0))),
    category_model_version = coalesce(nullif(p_category_model_version,''),'ml-unavailable'),
    priority = safe_priority,
    priority_confidence = greatest(0,least(1,coalesce(p_priority_confidence,0))),
    priority_model_version = coalesce(nullif(p_priority_model_version,''),'ml-unavailable'),
    priority_source = coalesce(nullif(p_priority_source,''),'fallback'),
    department_confidence = greatest(0,least(1,coalesce(p_department_confidence,0))),
    department_source = coalesce(nullif(p_department_source,''),'fallback'),
    department_id = department_uuid,
    suggested_department_id = department_uuid,
    status = case when status = 'submitted' then 'assigned' else status end,
    updated_at = now()
  where id = p_complaint_id and student_id = (select auth.uid());
  if not found then raise exception 'Complaint not found or not owned by the current student'; end if;

  insert into public.complaint_ml_predictions (
    complaint_id, category, category_confidence, category_model_version,
    priority, priority_confidence, priority_model_version, priority_source,
    suggested_department_id, department_confidence, department_source
  ) values (
    p_complaint_id, safe_category, greatest(0,least(1,coalesce(p_category_confidence,0))),
    coalesce(nullif(p_category_model_version,''),'ml-unavailable'), safe_priority,
    greatest(0,least(1,coalesce(p_priority_confidence,0))),
    coalesce(nullif(p_priority_model_version,''),'ml-unavailable'),
    coalesce(nullif(p_priority_source,''),'fallback'), department_uuid,
    greatest(0,least(1,coalesce(p_department_confidence,0))),
    coalesce(nullif(p_department_source,''),'fallback')
  );
end;
$$;
revoke all on function public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text) from public, anon;
grant execute on function public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text) to authenticated;
