// Real authentication — replaces the demo-login dropdown entirely.
// Supabase Auth issues real sessions; public.profiles.role and
// company_id (populated by the handle_new_user trigger from signup
// metadata) are what RLS actually keys off, not anything client-side.
import { supabase } from "./supabaseClient.js";

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

// Passwordless is usually the better default for a portfolio-company
// contact who won't remember a password they set up once — sends a
// magic link instead.
export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Loads the row RLS actually cares about (role + company_id) alongside
// the session. Call this once after sign-in and cache it for the app.
//
// Must filter by id explicitly: the profiles_select RLS policy also
// lets every signed-in user see every non-portco_contact profile (so
// OE member names/avatars resolve in joins), so an unfiltered select
// returns every OE member's row, not just the caller's -- .single()
// would then throw "multiple rows returned" for any OE member.
export async function getMyProfile() {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error("Not signed in.");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile({ fullName, title, focus }) {
  const { error } = await supabase.rpc("update_my_profile", { p_full_name: fullName, p_title: title, p_focus: focus });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Inviting real users — an admin-only action. This CANNOT run from the
// browser with the anon key (admin.inviteUserByEmail requires the
// service role key). Two supported ways to wire this up for real:
//
//   1. A Supabase Edge Function (recommended) that receives
//      { email, full_name, role, company_id } from an authenticated
//      admin, checks the caller's own profile.role === 'admin' via
//      the request's JWT, then calls
//      supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: {...} })
//      using the service role key from the function's own env — never
//      exposed to the browser.
//   2. Any other server you control, same idea: verify admin, then
//      call the Admin API server-side.
//
// This client-side helper just calls that endpoint; swap the URL for
// wherever you deploy the edge function.
// ---------------------------------------------------------------------
export async function inviteMember({ email, fullName, role, companyId }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, full_name: fullName, role, company_id: companyId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
