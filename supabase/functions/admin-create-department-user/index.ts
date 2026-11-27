import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Server configuration is incomplete." }, 500);
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in as an administrator first." }, 401);

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role").eq("id", authData.user.id).maybeSingle();
    if (profileError || profile?.role !== "admin") return json({ error: "Only administrators can create department accounts." }, 403);

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;
    const departmentId = typeof body.department_id === "string" ? body.department_id : "";
    if (name.length < 2 || name.length > 100) return json({ error: "Enter a name between 2 and 100 characters." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Password must contain between 8 and 72 characters." }, 400);
    if (role !== "staff" && role !== "department_head") return json({ error: "Choose a valid department role." }, 400);
    if (!departmentId) return json({ error: "Choose a department." }, 400);

    const { data: department } = await admin.from("departments").select("id").eq("id", departmentId).maybeSingle();
    if (!department) return json({ error: "The selected department does not exist." }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (createError || !created.user) return json({ error: createError?.message ?? "Unable to create account." }, 400);

    const { error: saveError } = await admin.from("profiles").upsert({
      id: created.user.id, name, email, role, department_id: departmentId,
    }, { onConflict: "id" });
    if (saveError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "The account could not be linked to a department: " + saveError.message }, 500);
    }
    return json({ success: true, email, role, department_id: departmentId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}