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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return new Response("Missing bearer token", { status: 401 });

  // Scoped to the CALLER's JWT — RLS applies, so this can only ever read
  // the caller's own profile, proving who they are.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser(jwt);
  if (!user) return new Response("Invalid session", { status: 401 });

  const { data: profile } = await callerClient.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return new Response("Only an admin can manage users", { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (body.action === "list_emails") {
    // auth.admin.listUsers() is paginated (default 50/page) — walk every
    // page so this stays correct as the org grows past one page.
    const users = {};
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) return new Response(error.message, { status: 400 });
      for (const u of data.users) users[u.id] = { email: u.email, last_sign_in_at: u.last_sign_in_at };
      if (data.users.length < perPage) break;
      page++;
    }
    return new Response(JSON.stringify({ users }), { headers: { "Content-Type": "application/json" } });
  }

  if (body.action === "set_password") {
    const { user_id, new_password } = body;
    if (!user_id || !new_password) return new Response("user_id and new_password are required", { status: 400 });
    if (String(new_password).length < 8) return new Response("Password must be at least 8 characters", { status: 400 });
    const { data, error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return new Response(error.message, { status: 400 });
    return new Response(JSON.stringify({ updated: data.user.email }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response("Unknown action", { status: 400 });
});
