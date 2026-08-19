// Supabase Edge Function: invite-member
// Deploy: supabase functions deploy invite-member
// Called by src/lib/auth.js's inviteMember(). This is the ONLY place
// the service role key is used for user creation — it never reaches
// the browser. Verifies the caller is an admin (via their own JWT and
// their own profile row, itself protected by RLS) before inviting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return new Response("Missing bearer token", { status: 401 });

  // Client scoped to the CALLER's JWT — RLS applies, so this can only
  // ever read the caller's own profile, proving who they are.
  const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser(jwt);
  if (!user) return new Response("Invalid session", { status: 401 });

  const { data: profile } = await callerClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return new Response("Only an admin can invite members", { status: 403 });
  }

  const { email, full_name, role, company_id } = await req.json();
  if (!email || !full_name || !role) return new Response("email, full_name, and role are required", { status: 400 });
  if (role === "portco_contact" && !company_id) return new Response("company_id is required for a portco_contact invite", { status: 400 });

  // Admin client — service role key, server-side only.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role, company_id: company_id ?? null },
  });
  if (error) return new Response(error.message, { status: 400 });

  return new Response(JSON.stringify({ invited: data.user.email }), { headers: { "Content-Type": "application/json" } });
});
