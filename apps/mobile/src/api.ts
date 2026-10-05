import { supabase } from "./supabase";

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
    .select("id, student_id, title, description, location, status, created_at, updated_at, complaint_images(id, original_filename, content_type, storage_path)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((item: any) => ({
    ...item,
    images: item.complaint_images ?? [],
  }));
}

export async function getComplaint(id: string) {
  const { data, error } = await supabase.from("complaints")
    .select("id, student_id, title, description, location, status, created_at, updated_at, complaint_images(id, original_filename, content_type, storage_path)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const images = await Promise.all((data.complaint_images ?? []).map(async (image: any) => {
    const { data: signed } = await supabase.storage.from("complaint-evidence")
      .createSignedUrl(image.storage_path, 3600);
    return { ...image, signed_url: signed?.signedUrl ?? null };
  }));
  return { ...data, images };
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

  // Supabase recommends ArrayBuffer for React Native uploads instead of Blob/File.
  const arrayBuffer = await fetch(uri).then((response) => {
    if (!response.ok) throw new Error("Unable to read the selected image.");
    return response.arrayBuffer();
  });

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
