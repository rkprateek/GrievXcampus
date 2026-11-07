import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

export type Notification = {
  id: string;
  recipient_id: string;
  complaint_id: string | null;
  type: "complaint_submitted" | "status_changed" | "system";
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export type ComplaintStatusHistory = {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

export type DuplicateCandidate = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  created_at: string;
  upvote_count: number;
  title_similarity: number;
  description_similarity: number;
  location_match: boolean;
  similarity_score: number;
};

export type MLWorkflowResult = {
  category: { category: string; confidence: number; low_confidence: boolean; model_version: string };
  priority: {
    priority: "normal" | "high" | "critical";
    confidence: number;
    method: string;
    explanation: string;
    matched_rules: string[];
    model_version: string;
  };
  routing: {
    category: string;
    category_confidence: number;
    department: string;
    department_code: string;
    routing_confidence: number;
    requires_manual_review: boolean;
    reason: string;
    model_version: string;
  };
};

type MLWorkflowOutcome = {
  result: MLWorkflowResult | null;
  message: string;
};

function isMLWorkflowResult(value: unknown): value is MLWorkflowResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MLWorkflowResult>;
  return !!candidate.category
    && typeof candidate.category.category === "string"
    && typeof candidate.category.confidence === "number"
    && candidate.category.confidence >= 0 && candidate.category.confidence <= 1
    && typeof candidate.category.low_confidence === "boolean"
    && typeof candidate.category.model_version === "string"
    && !!candidate.priority
    && ["normal", "high", "critical"].includes(candidate.priority.priority)
    && typeof candidate.priority.confidence === "number"
    && candidate.priority.confidence >= 0 && candidate.priority.confidence <= 1
    && typeof candidate.priority.method === "string"
    && typeof candidate.priority.explanation === "string"
    && Array.isArray(candidate.priority.matched_rules)
    && typeof candidate.priority.model_version === "string"
    && !!candidate.routing
    && typeof candidate.routing.category === "string"
    && typeof candidate.routing.department === "string"
    && typeof candidate.routing.department_code === "string"
    && typeof candidate.routing.routing_confidence === "number"
    && candidate.routing.routing_confidence >= 0 && candidate.routing.routing_confidence <= 1
    && typeof candidate.routing.requires_manual_review === "boolean"
    && typeof candidate.routing.reason === "string"
    && typeof candidate.routing.model_version === "string";
}

async function runMLWorkflow(title: string, description: string): Promise<MLWorkflowOutcome> {
  const baseUrl = process.env.EXPO_PUBLIC_GRIEVX_API_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) {
    return { result: null, message: "ML service URL is not configured. The complaint was saved for manual review." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${baseUrl}/ml/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { result: null, message: `ML service returned HTTP ${response.status}. The complaint was saved for manual review.` };
    }
    const payload: unknown = await response.json();
    if (!isMLWorkflowResult(payload)) {
      return { result: null, message: "ML service returned an unexpected response. The complaint was saved for manual review." };
    }
    return { result: payload, message: "ML predictions completed." };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "ML service timed out"
      : "ML service could not be reached";
    return { result: null, message: `${reason}. The complaint was saved for manual review.` };
  } finally {
    clearTimeout(timeout);
  }
}

export async function register(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role: "student" } },
  });
  if (error) throw new Error(error.message);

  // Supabase may create an active session immediately when email confirmation is disabled.
  // Registration should still return the user to the login screen, so clear that session.
  if (data.session) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error(signOutError.message);
  }

  return data.user;
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function resetPassword() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error(userError?.message ?? "You are not signed in.");
  }

  const email = userData.user.email?.trim();
  if (!email) {
    throw new Error("No email address is registered for this account.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getMe() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "You are not signed in.");

  const { data, error } = await supabase.from("profiles")
    .select("id, name, email, role")
    .eq("id", userData.user.id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateMyProfileName(name: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "You are not signed in.");
  const { data, error } = await supabase.from("profiles")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", userData.user.id)
    .select("id,name,email,role")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function submitAppFeedback(message: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message ?? "You are not signed in.");
  const { error } = await supabase.from("app_feedback").insert({
    user_id: userData.user.id,
    message,
  });
  if (error) throw new Error(error.message);
}

export async function findPossibleDuplicates(input: { title: string; description: string; location: string }) {
  const { data, error } = await supabase.rpc("find_possible_duplicates", {
    p_title: input.title,
    p_description: input.description,
    p_location: input.location,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as DuplicateCandidate[];
}

export async function createComplaint(input: {
  title: string;
  description: string;
  location: string;
  duplicateOfId?: string | null;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You are not signed in.");

  const { data, error } = await supabase.from("complaints")
    .insert({
      student_id: userData.user.id,
      title: input.title,
      description: input.description,
      location: input.location,
      status: "submitted",
      duplicate_of_id: input.duplicateOfId ?? null,
    })
    .select("id, student_id, title, description, location, status, category, category_confidence, priority, priority_confidence, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);

  // Save the complaint first so an ML outage never loses a student's report.
  const workflow = await runMLWorkflow(input.title, input.description);
  const ml = workflow.result;
  if (!ml) {
    return { ...data, ml_status: "unavailable" as const, ml_message: workflow.message };
  }

  const { error: workflowError } = await supabase.rpc("apply_complaint_ml_predictions", {
    p_complaint_id: data.id,
    p_category: ml.category.category,
    p_category_confidence: ml.category.confidence,
    p_category_model_version: ml.category.model_version,
    p_priority: ml.priority.priority,
    p_priority_confidence: ml.priority.confidence,
    p_priority_model_version: ml.priority.model_version,
    p_priority_source: ml.priority.method,
    p_department_code: ml.routing.department_code,
    p_department_confidence: ml.routing.routing_confidence,
    p_department_source: ml.routing.requires_manual_review ? "manual_review" : "department_routing",
  });

  if (workflowError) {
    return {
      ...data,
      category: ml.category.category,
      category_confidence: ml.category.confidence,
      priority: ml.priority.priority,
      priority_confidence: ml.priority.confidence,
      ml_status: "save_failed" as const,
      ml_message: `Predictions were generated but could not be applied: ${workflowError.message}`,
    };
  }

  const { data: department } = await supabase.from("departments")
    .select("id, name")
    .eq("code", ml.routing.department_code)
    .maybeSingle();

  const { error: historyError } = await supabase.from("complaint_ml_predictions").upsert({
    complaint_id: data.id,
    prediction_state: ml.routing.requires_manual_review ? "manual_review" : "completed",
    category: ml.category.category,
    category_confidence: ml.category.confidence,
    priority: ml.priority.priority,
    priority_confidence: ml.priority.confidence,
    priority_method: ml.priority.method,
    priority_explanation: ml.priority.explanation,
    matched_rules: ml.priority.matched_rules,
    department_id: department?.id ?? null,
    department_name: ml.routing.department,
    department_code: ml.routing.department_code,
    routing_confidence: ml.routing.routing_confidence,
    requires_manual_review: ml.routing.requires_manual_review,
    review_reason: ml.routing.requires_manual_review ? ml.routing.reason : null,
    category_model_version: ml.category.model_version,
    priority_model_version: ml.priority.model_version,
    routing_model_version: ml.routing.model_version,
    prediction_source: "fastapi",
    updated_at: new Date().toISOString(),
  }, { onConflict: "complaint_id" });

  const { data: updatedComplaint } = await supabase.from("complaints")
    .select("id, student_id, title, description, location, status, category, category_confidence, priority, priority_confidence, department_id, assigned_staff_id, created_at, updated_at")
    .eq("id", data.id)
    .maybeSingle();

  return {
    ...(updatedComplaint ?? data),
    ml_status: historyError ? "history_failed" as const : "applied" as const,
    ml_message: historyError
      ? `Predictions were applied, but prediction history could not be saved: ${historyError.message}`
      : ml.routing.requires_manual_review
        ? "Category and priority predicted. Department needs admin review because model confidence is low."
        : "Category, priority and department predicted successfully. Staff assignment depends on configured staff availability.",
  };
}

export async function getComplaints() {
  const { data, error } = await supabase.from("complaints")
    .select("id, student_id, title, description, location, status, priority, category, upvote_count, created_at, updated_at, complaint_images(id, original_filename, content_type, storage_path)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: userData } = await supabase.auth.getUser();
  const myUpvotes = userData.user
    ? await supabase.from("complaint_upvotes").select("complaint_id").eq("student_id", userData.user.id)
    : { data: [] };

  const upvotedIds = new Set((myUpvotes.data ?? []).map((x: any) => x.complaint_id));
  return (data ?? []).map((item: any) => ({
    ...item,
    images: item.complaint_images ?? [],
    has_upvoted: upvotedIds.has(item.id),
  }));
}

export async function updateComplaint(id: string, input: { title: string; description: string; location: string }) {
  const { data, error } = await supabase.from("complaints")
    .update({ title: input.title, description: input.description, location: input.location })
    .eq("id", id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This complaint can no longer be edited. Refresh and try again.");
}

export async function withdrawComplaint(id: string) {
  const { data, error } = await supabase.from("complaints")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This complaint can no longer be withdrawn. Refresh and try again.");
}

export async function getComplaint(id: string) {
  const { data, error } = await supabase.from("complaints")
    .select("id, student_id, title, description, location, status, priority, category, upvote_count, duplicate_of_id, created_at, updated_at, complaint_images(id, original_filename, content_type, storage_path), complaint_status_history(id, from_status, to_status, changed_by, note, created_at)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const images = await Promise.all((data.complaint_images ?? []).map(async (image: any) => {
    const { data: signed } = await supabase.storage.from("complaint-evidence")
      .createSignedUrl(image.storage_path, 3600);
    return { ...image, signed_url: signed?.signedUrl ?? null };
  }));
  const { data: userData } = await supabase.auth.getUser();
  const { data: myUpvote } = userData.user
    ? await supabase.from("complaint_upvotes").select("complaint_id").eq("complaint_id", id).eq("student_id", userData.user.id).maybeSingle()
    : { data: null };
  return {
    ...data,
    images,
    status_history: (data.complaint_status_history ?? []) as ComplaintStatusHistory[],
    has_upvoted: !!myUpvote,
  };
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function resolveImageMimeType(filename: string, uri: string, reportedMimeType?: string) {
  const normalized = reportedMimeType?.toLowerCase();
  if (normalized && Object.values(IMAGE_MIME_BY_EXTENSION).includes(normalized)) {
    return normalized;
  }

  const candidates = [filename, uri];
  for (const value of candidates) {
    const match = value.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
    if (match?.[1] && IMAGE_MIME_BY_EXTENSION[match[1]]) {
      return IMAGE_MIME_BY_EXTENSION[match[1]];
    }
  }

  // Android content providers can occasionally report text/plain for a real image.
  // Since this screen only accepts images, safely default to JPEG instead of sending
  // an unsupported MIME type to Supabase Storage.
  return "image/jpeg";
}

export async function uploadComplaintImage(
  complaintId: string,
  uri: string,
  filename = "evidence.jpg",
  mimeType?: string,
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You are not signed in.");

  const resolvedMimeType = resolveImageMimeType(filename, uri, mimeType);
  const extension = resolvedMimeType === "image/png"
    ? "png"
    : resolvedMimeType === "image/webp"
      ? "webp"
      : "jpg";
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_") || `evidence.${extension}`;
  const storageFilename = /\.[a-z0-9]+$/i.test(safeFilename)
    ? safeFilename
    : `${safeFilename}.${extension}`;
  const storagePath = `${userData.user.id}/${complaintId}/${Date.now()}-${storageFilename}`;

  // Expo Android can return content:// URIs. Read the selected asset through
  // Expo FileSystem and convert it to binary data before sending it to Storage.
  // Supabase documents ArrayBuffer uploads as the reliable React Native path.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error("Unable to read the selected image.");
  const arrayBuffer = decode(base64);

  const { error: uploadError } = await supabase.storage.from("complaint-evidence")
    .upload(storagePath, arrayBuffer, {
      contentType: resolvedMimeType,
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase.from("complaint_images")
    .insert({
      complaint_id: complaintId,
      storage_path: storagePath,
      original_filename: filename,
      content_type: resolvedMimeType,
    })
    .select("id, complaint_id, storage_path, original_filename, content_type, created_at")
    .single();

  if (error) {
    await supabase.storage.from("complaint-evidence").remove([storagePath]);
    throw new Error(error.message);
  }
  return data;
}

export async function getNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, complaint_id, type, title, message, read_at, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You are not signed in.");

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userData.user.id)
    .is("read_at", null);

  if (error) throw new Error(error.message);
}


export async function upvoteComplaint(complaintId: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You are not signed in.");

  const { error } = await supabase.from("complaint_upvotes").insert({
    complaint_id: complaintId,
    student_id: userData.user.id,
  });

  if (error) {
    if (error.code === "23505") throw new Error("You already supported this complaint.");
    throw new Error(error.message);
  }
}
