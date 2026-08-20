// Supabase Edge Function: invite-member
// Deploy: supabase functions deploy invite-member
// Called by src/lib/auth.js's inviteMember(). This is the ONLY place
// the service role key is used for user creation — it never reaches
// the browser. Verifies the caller is an admin (via their own JWT and
// their own profile row, itself protected by RLS) before inviting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS — see the matching comment in admin-users/index.ts. Missing here
// too until a live click-through caught it: every invite attempt from
// the browser failed with "Failed to fetch" before the request even
// reached this function's own logic (blocked at the OPTIONS preflight).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function text(body: string, status = 200) {
  return new Response(body, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return text("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return text("Missing bearer token", 401);

  // Client scoped to the CALLER's JWT — RLS applies, so this can only
  // ever read the caller's own profile, proving who they are.
  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser(jwt);
  if (!user) return text("Invalid session", 401);

  const { data: profile } = await callerClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return text("Only an admin can invite members", 403);
  }

  const { email, full_name, role, company_id } = await req.json();
  if (!email || !full_name || !role) return text("email, full_name, and role are required", 400);
  if (role === "portco_contact" && !company_id) return text("company_id is required for a portco_contact invite", 400);

  // Admin client — service role key, server-side only.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role, company_id: company_id ?? null },
  });
  if (error) return text(error.message, 400);

  return json({ invited: data.user.email });
});
