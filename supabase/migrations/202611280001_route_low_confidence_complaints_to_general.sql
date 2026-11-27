-- Route every new complaint into a department inbox.
-- Confident predictions use the predicted department. Low-confidence/manual-review
-- predictions go to General while retaining the suggested department in ML history.
CREATE OR REPLACE FUNCTION public.apply_complaint_ml_predictions(
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
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  suggested_department_uuid uuid;
  general_department_uuid uuid;
  assigned_department_uuid uuid;
  assigned_department_code text;
  assigned_department_name text;
  selected_staff_id uuid;
  route_confident boolean;
  review_reason_text text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_priority NOT IN ('normal', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid priority value';
  END IF;

  SELECT id INTO suggested_department_uuid
  FROM public.departments WHERE code = p_department_code LIMIT 1;

  SELECT id INTO general_department_uuid
  FROM public.departments WHERE code = 'GEN' LIMIT 1;

  IF general_department_uuid IS NULL THEN
    RAISE EXCEPTION 'General department (GEN) is missing';
  END IF;

  route_confident :=
    suggested_department_uuid IS NOT NULL
    AND p_department_source IS DISTINCT FROM 'manual_review'
    AND COALESCE(p_department_confidence, 0) >= 0.55;

  assigned_department_uuid := CASE
    WHEN route_confident THEN suggested_department_uuid
    ELSE general_department_uuid
  END;

  SELECT code, name INTO assigned_department_code, assigned_department_name
  FROM public.departments WHERE id = assigned_department_uuid;

  IF NOT route_confident THEN
    IF suggested_department_uuid IS NULL THEN
      review_reason_text := 'The predicted department code was not found. Complaint routed to General for administrator review.';
    ELSE
      review_reason_text := 'The prediction confidence is below the automatic-routing threshold or requires manual review. Complaint routed to General; the suggested department is retained for administrator review.';
    END IF;
  END IF;

  UPDATE public.complaints
  SET category = COALESCE(NULLIF(p_category, ''), 'General'),
      category_confidence = GREATEST(0, LEAST(1, COALESCE(p_category_confidence, 0))),
      category_model_version = COALESCE(NULLIF(p_category_model_version, ''), 'ml-unavailable'),
      priority = p_priority,
      priority_confidence = GREATEST(0, LEAST(1, COALESCE(p_priority_confidence, 0))),
      priority_model_version = COALESCE(NULLIF(p_priority_model_version, ''), 'ml-unavailable'),
      priority_source = COALESCE(NULLIF(p_priority_source, ''), 'fallback'),
      department_confidence = GREATEST(0, LEAST(1, COALESCE(p_department_confidence, 0))),
      department_source = COALESCE(NULLIF(p_department_source, ''), 'fallback'),
      suggested_department_id = COALESCE(suggested_department_uuid, general_department_uuid),
      department_id = assigned_department_uuid,
      updated_at = now()
  WHERE id = p_complaint_id AND student_id = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint not found or not owned by the current student';
  END IF;

  INSERT INTO public.complaint_ml_predictions (
    complaint_id, prediction_state, category, category_confidence,
    priority, priority_confidence, priority_method,
    department_id, department_name, department_code, routing_confidence,
    requires_manual_review, review_reason, category_model_version,
    priority_model_version, routing_model_version, prediction_source, updated_at
  ) VALUES (
    p_complaint_id,
    CASE WHEN route_confident THEN 'completed' ELSE 'manual_review' END,
    COALESCE(NULLIF(p_category, ''), 'General'),
    GREATEST(0, LEAST(1, COALESCE(p_category_confidence, 0))),
    p_priority,
    GREATEST(0, LEAST(1, COALESCE(p_priority_confidence, 0))),
    COALESCE(NULLIF(p_priority_source, ''), 'fallback'),
    assigned_department_uuid,
    assigned_department_name,
    assigned_department_code,
    GREATEST(0, LEAST(1, COALESCE(p_department_confidence, 0))),
    NOT route_confident,
    review_reason_text,
    COALESCE(NULLIF(p_category_model_version, ''), 'ml-unavailable'),
    COALESCE(NULLIF(p_priority_model_version, ''), 'ml-unavailable'),
    CASE WHEN p_department_source = 'fallback' THEN 'department-router-v1.0.0' ELSE 'department-router-v1.1.0' END,
    CASE WHEN p_department_source = 'fallback' THEN 'fallback' ELSE 'fastapi' END,
    now()
  )
  ON CONFLICT (complaint_id) DO UPDATE SET
    prediction_state = EXCLUDED.prediction_state,
    category = EXCLUDED.category,
    category_confidence = EXCLUDED.category_confidence,
    priority = EXCLUDED.priority,
    priority_confidence = EXCLUDED.priority_confidence,
    priority_method = EXCLUDED.priority_method,
    department_id = EXCLUDED.department_id,
    department_name = EXCLUDED.department_name,
    department_code = EXCLUDED.department_code,
    routing_confidence = EXCLUDED.routing_confidence,
    requires_manual_review = EXCLUDED.requires_manual_review,
    review_reason = EXCLUDED.review_reason,
    category_model_version = EXCLUDED.category_model_version,
    priority_model_version = EXCLUDED.priority_model_version,
    routing_model_version = EXCLUDED.routing_model_version,
    prediction_source = EXCLUDED.prediction_source,
    updated_at = now();

  -- Do not auto-assign an individual for low-confidence/manual-review cases.
  IF NOT route_confident THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(assigned_department_uuid::text, 0));

  SELECT sd.staff_id INTO selected_staff_id
  FROM public.staff_directory sd
  JOIN public.profiles staff_profile ON staff_profile.id = sd.staff_id
  WHERE sd.department_id = assigned_department_uuid
    AND sd.is_available = true
    AND staff_profile.role IN ('staff', 'department_head')
    AND COALESCE((
      SELECT count(*)::integer FROM public.complaints active_complaint
      WHERE active_complaint.assigned_staff_id = sd.staff_id
        AND active_complaint.status IN ('assigned', 'in_progress')
    ), 0) < sd.max_active_assignments
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM unnest(sd.skills) skill
      WHERE position(lower(trim(skill)) in lower(coalesce(p_category, ''))) > 0
         OR position(lower(trim(skill)) in lower(coalesce(p_department_code, ''))) > 0
         OR position(lower(trim(p_category)) in lower(trim(skill))) > 0
    ) THEN 0 ELSE 1 END,
    COALESCE((
      SELECT count(*)::integer FROM public.complaints active_complaint
      WHERE active_complaint.assigned_staff_id = sd.staff_id
        AND active_complaint.status IN ('assigned', 'in_progress')
    ), 0) ASC,
    sd.created_at ASC
  LIMIT 1
  FOR UPDATE OF sd SKIP LOCKED;

  IF selected_staff_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.complaints
  SET assigned_staff_id = selected_staff_id,
      status = CASE WHEN status = 'submitted' THEN 'assigned' ELSE status END,
      updated_at = now()
  WHERE id = p_complaint_id AND student_id = current_user_id;

  INSERT INTO public.staff_assignments (complaint_id, staff_id, assigned_by, assignment_source)
  VALUES (p_complaint_id, selected_staff_id, NULL, 'auto_ml');

  INSERT INTO public.notifications (recipient_id, complaint_id, type, title, message)
  VALUES (
    selected_staff_id, p_complaint_id, 'system',
    'New complaint assigned',
    'A new campus complaint has been automatically assigned to you.'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_complaint_ml_predictions(uuid,text,numeric,text,text,numeric,text,text,text,numeric,text) TO authenticated;
