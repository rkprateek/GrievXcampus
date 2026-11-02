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


export type DuplicateComplaint = {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  created_at: string;
  similarity: number;
  text_similarity: number;
  location_similarity: number;
};

export type ComplaintMlPrediction = {
  id: string;
  complaint_id: string;
  prediction_state: "completed" | "manual_review" | "unavailable" | "error";
  category: string | null;
  category_confidence: number | null;
  priority: "normal" | "high" | "critical" | null;
  priority_confidence: number | null;
  priority_method: string | null;
  priority_explanation: string | null;
  matched_rules: string[];
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  routing_confidence: number | null;
  requires_manual_review: boolean;
  review_reason: string | null;
  category_model_version: string | null;
  priority_model_version: string | null;
  routing_model_version: string | null;
  prediction_source: string;
  created_at: string;
  updated_at: string;
};

export type ComplaintPredictionResponse = {
  category: {
    category: string;
    confidence: number;
    low_confidence: boolean;
    model_version: string;
  };
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

export async function findDuplicateComplaints(input: {
  title: string;
  description: string;
  location: string;
}) {
  const { data, error } = await supabase.rpc("find_duplicate_complaints", {
    p_title: input.title,
    p_description: input.description,
    p_location: input.location,
    p_window_days: 90,
    p_threshold: 0.55,
    p_location_threshold: 0.45,
    p_limit: 5,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as DuplicateComplaint[];
}

async function getMlServiceUrl() {
  const value = process.env.EXPO_PUBLIC_ML_API_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function predictComplaintWithMl(input: {
  title: string;
  description: string;
}): Promise<ComplaintPredictionResponse | null> {
  const baseUrl = await getMlServiceUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`${baseUrl}/ml/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ML service returned HTTP ${response.status}.`);
    }

    return (await response.json()) as ComplaintPredictionResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveComplaintMlPrediction(
  complaintId: string,
  prediction: ComplaintMlPrediction | Omit<ComplaintMlPrediction, "id" | "created_at" | "updated_at">,
) {
  const row = {
    ...prediction,
    complaint_id: complaintId,
    updated_at: new Date().toISOString(),
  };
  delete (row as any).id;
  delete (row as any).created_at;

  const { data, error } = await supabase
    .from("complaint_ml_predictions")
    .upsert(row, { onConflict: "complaint_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ComplaintMlPrediction;
}

export async function runAndPersistComplaintTriage(input: {
  complaintId: string;
  title: string;
  description: string;
}) {
  let prediction: ComplaintPredictionResponse | null = null;
  let predictionError: string | null = null;

  try {
    prediction = await predictComplaintWithMl({
      title: input.title,
      description: input.description,
    });
  } catch (error) {
    predictionError = error instanceof Error ? error.message : "The ML service could not be reached.";
  }

  if (!prediction) {
    return saveComplaintMlPrediction(input.complaintId, {
      complaint_id: input.complaintId,
      prediction_state: predictionError ? "error" : "unavailable",
      category: null,
      category_confidence: null,
      priority: null,
      priority_confidence: null,
      priority_method: null,
      priority_explanation: null,
      matched_rules: [],
      department_id: null,
      department_name: null,
      department_code: null,
      routing_confidence: null,
      requires_manual_review: true,
      review_reason: predictionError ?? "ML service is not configured. Staff should review the complaint manually.",
      category_model_version: null,
      priority_model_version: null,
      routing_model_version: null,
      prediction_source: "fastapi",
      id: "",
      created_at: "",
      updated_at: new Date().toISOString(),
    });
  }

  const routingNeedsReview =
    prediction.category.low_confidence || prediction.routing.requires_manual_review;

  const { data: department } = await supabase
    .from("departments")
    .select("id")
    .eq("code", prediction.routing.department_code)
    .maybeSingle();

  const complaintUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (prediction.priority.priority) {
    complaintUpdate.priority = prediction.priority.priority;
  }

  if (!routingNeedsReview && department?.id) {
    complaintUpdate.department_id = department.id;
  }

  const { error: complaintError } = await supabase
    .from("complaints")
    .update(complaintUpdate)
    .eq("id", input.complaintId);

  if (complaintError) throw new Error(complaintError.message);

  return saveComplaintMlPrediction(input.complaintId, {
    complaint_id: input.complaintId,
    prediction_state: routingNeedsReview ? "manual_review" : "completed",
    category: prediction.category.category,
    category_confidence: prediction.category.confidence,
    priority: prediction.priority.priority,
    priority_confidence: prediction.priority.confidence,
    priority_method: prediction.priority.method,
    priority_explanation: prediction.priority.explanation,
    matched_rules: prediction.priority.matched_rules,
    department_id: department?.id ?? null,
    department_name: prediction.routing.department,
    department_code: prediction.routing.department_code,
    routing_confidence: prediction.routing.routing_confidence,
    requires_manual_review: routingNeedsReview,
    review_reason: routingNeedsReview
      ? prediction.routing.reason
      : null,
    category_model_version: prediction.category.model_version,
    priority_model_version: prediction.priority.model_version,
    routing_model_version: prediction.routing.model_version,
    prediction_source: "fastapi",
    id: "",
    created_at: "",
    updated_at: new Date().toISOString(),
  });
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

export async function resetPassword(email: string) {
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

export async function createComplaint(input: { title: string; description: string; location: string }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You are not signed in.");

  const { data, error } = await supabase.from("complaints")
    .insert({
      student_id: userData.user.id,
      title: input.title,
      description: input.description,
      location: input.location,
      status: "submitted",
    })
    .select("id, student_id, title, description, location, status, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getComplaints() {
  const { data, error } = await supabase.from("complaints")
    .select("id, student_id, title, description, location, status, priority, department_id, created_at, updated_at, complaint_images(id, original_filename, content_type, storage_path)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((item: any) => ({
    ...item,
    images: item.complaint_images ?? [],
  }));
}

export async function getComplaint(id: string) {
  const { data, error } = await supabase.from("complaints")
    .select("id, student_id, title, description, location, status, priority, department_id, created_at, updated_at, complaint_images(id, original_filename, content_type, storage_path), complaint_status_history(id, from_status, to_status, changed_by, note, created_at), complaint_ml_predictions(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const images = await Promise.all((data.complaint_images ?? []).map(async (image: any) => {
    const { data: signed } = await supabase.storage.from("complaint-evidence")
      .createSignedUrl(image.storage_path, 3600);
    return { ...image, signed_url: signed?.signedUrl ?? null };
  }));
  return { ...data, images, status_history: (data.complaint_status_history ?? []) as ComplaintStatusHistory[] };
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
