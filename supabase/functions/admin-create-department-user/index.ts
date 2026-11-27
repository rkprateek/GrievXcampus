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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server configuration is incomplete." }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in as an administrator first." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profileError || callerProfile?.role !== "admin") {
      return json({ error: "Only administrators can create department accounts." }, 403);
    }

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role;
    const departmentId = typeof body.department_id === "string" ? body.department_id : "";
    if (name.length < 2 || name.length > 100) return json({ error: "Enter a name between 2 and 100 characters." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
    if (role !== "staff" && role !== "department_head") return json({ error: "Choose a valid department role." }, 400);
    if (!departmentId) return json({ error: "Choose a department." }, 400);

    const { data: department, error: departmentError } = await adminClient
      .from("departments").select("id").eq("id", departmentId).maybeSingle();
    if (departmentError || !department) return json({ error: "The selected department does not exist." }, 400);

    const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
    });
    if (inviteError || !invitation.user) {
      return json({ error: inviteError?.message ?? "Unable to send invitation." }, 400);
    }

    const { error: saveError } = await adminClient.from("profiles").upsert({
      id: invitation.user.id,
      name,
      email,
      role,
      department_id: departmentId,
    }, { onConflict: "id" });

    if (saveError) {
      await adminClient.auth.admin.deleteUser(invitation.user.id);
      return json({ error: "The invitation could not be linked to a department: " + saveError.message }, 500);
    }

    return json({ success: true, invited_email: email, role, department_id: departmentId }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
