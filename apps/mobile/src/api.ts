import { supabase } from "./supabase";

export async function register(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role: "student" } },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
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
  return data ?? [];
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

export async function uploadComplaintImage(
  complaintId: string,
  uri: string,
  filename = "evidence.jpg",
  mimeType = "image/jpeg",
) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("You are not signed in.");

  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();
  const extension = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${userData.user.id}/${complaintId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("complaint-evidence")
    .upload(storagePath, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase.from("complaint_images")
    .insert({
      complaint_id: complaintId,
      storage_path: storagePath,
      original_filename: filename,
      content_type: mimeType,
    })
    .select("id, complaint_id, storage_path, original_filename, content_type, created_at")
    .single();

  if (error) {
    await supabase.storage.from("complaint-evidence").remove([storagePath]);
    throw new Error(error.message);
  }
  return data;
}
