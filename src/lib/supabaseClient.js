// Single shared Supabase client for the browser app. Only ever use the
// anon key here — the service role key belongs in supabase/seed.mjs and
// server-side tooling only, never in anything shipped to a browser.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project's values (Supabase dashboard -> Project Settings -> API)."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 5 } },
});
