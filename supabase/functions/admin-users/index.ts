// Supabase Edge Function: admin-users
// Deploy: supabase functions deploy admin-users
// Companion to invite-member — the other half of real account
// administration: seeing who's actually in the system (auth.users has
// emails; public.profiles deliberately doesn't duplicate them) and
// resetting a member's password when they're locked out. Both need the
// service role key, so both live server-side here, never in the browser.
// Same caller-verification pattern as invite-member: the caller's own
// JWT proves who they are (via RLS on their own profile row), then we
// check role === 'admin' before touching the admin API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// CORS: a browser calling this from the app's own origin still sends a
// preflight OPTIONS request first (Authorization + Content-Type count as
// "non-simple" headers), and every actual response also needs these
// headers or the browser discards it before the app ever sees it. This
// was missing entirely on first deploy — every call from the browser
// failed with a generic "Failed to fetch" (the OPTIONS preflight got a
// bare 405, since there was no OPTIONS handling at all), which is why
// Team & Access silently showed no emails (the failure was swallowed by
// a .catch() on the client) and Invite/Reset Password visibly failed.
// Caught by an actual live click-through, not code review — a CORS
// failure doesn't show up as a code defect, only as a runtime one.
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

  // Scoped to the CALLER's JWT — RLS applies, so this can only ever read
  // the caller's own profile, proving who they are.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser(jwt);
  if (!user) return text("Invalid session", 401);

  const { data: profile } = await callerClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return text("Only an admin can manage users", 403);
  }

  const body = await req.json().catch(() => ({}));
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (body.action === "list_emails") {
    // auth.admin.listUsers() is paginated (default 50/page) — walk every
    // page so this stays correct as the org grows past one page.
    const users: Record<string, { email: string | undefined; last_sign_in_at: string | undefined }> = {};
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) return text(error.message, 400);
      for (const u of data.users) users[u.id] = { email: u.email, last_sign_in_at: u.last_sign_in_at };
      if (data.users.length < perPage) break;
      page++;
    }
    return json({ users });
  }

  if (body.action === "set_password") {
    const { user_id, new_password } = body;
    if (!user_id || !new_password) return text("user_id and new_password are required", 400);
    if (String(new_password).length < 8) return text("Password must be at least 8 characters", 400);
    const { data, error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return text(error.message, 400);
    return json({ updated: data.user.email });
  }

  return text("Unknown action", 400);
});
