import * as SecureStore from "expo-secure-store";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "grievx_access_token";

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", "Bearer " + token);
  }

  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // Keep the generic error.
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function login(email: string, password: string) {
  const payload = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setToken(payload.access_token);
  return payload;
}

export async function register(name: string, email: string, password: string) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getMe() {
  return request("/auth/me");
}

export async function createComplaint(input: {
  title: string;
  description: string;
  location: string;
}) {
  return request("/complaints", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getComplaints() {
  return request("/complaints");
}

export async function getComplaint(id: string) {
  return request("/complaints/" + id);
}

export async function uploadComplaintImage(
  complaintId: string,
  uri: string,
  filename = "evidence.jpg",
  mimeType = "image/jpeg",
) {
  const form = new FormData();
  form.append("file", {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  return request("/complaints/" + complaintId + "/images", {
    method: "POST",
    body: form,
  });
}
