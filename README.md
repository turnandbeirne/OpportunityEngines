# Opportunity Engines Platform — Supabase backend

This turns the single-file HTML prototype into a real, multi-user product: a
Postgres database, real authentication, row-level security that enforces
(not just hides) who can see what, and a client library ready to replace
the prototype's in-memory JavaScript arrays. It also lays the groundwork
for the portfolio-company portal — that's what most of the schema's
row-level security is actually built around.

## Live status

This is provisioned and seeded right now, not just source on disk:

- **Project:** `iwpysmrmunirsvdrecmw` (org "OpportunityEngines", region
  us-east-1) — https://supabase.com/dashboard/project/iwpysmrmunirsvdrecmw
- **API URL:** `https://iwpysmrmunirsvdrecmw.supabase.co`
- **Schema + RLS:** applied (`001_schema.sql`, `002_rls.sql` — the latter
  is the consolidated final state; it folds in three follow-up hardening
  passes that moved the security-definer helpers into a non-exposed
  `private` schema per Supabase's own advisor guidance)
- **Seeded:** all 9 companies, all 7 OE member accounts (real Supabase Auth
  users, sign-in-ready), requests, threads, pulse calls, flow events,
  engine threads, and LaaSy's full valuation/financials/wins/challenges/
  priorities/KPI detail. See "Seeding" below — this was done via direct
  SQL (`supabase/seed_sql/`), not `seed.mjs`, because the tools used to
  provision this had no service-role key available.
- **`invite-member` edge function:** deployed and active.
- **Frontend:** the rendering code is ported from the HTML prototype's
  in-memory arrays to real async Supabase calls (see "What's in here" and
  "What's NOT in here yet" below for exact scope and what's still
  missing). `npm run build` succeeds cleanly. **Not yet verified in a live
  browser against the live project** — see the note in "Setup" step 5.
- **Hosting:** in progress — getting a Git repo to push this to and deploy
  from (see "Deploy" below for why that step exists at all).

Sign in at the app once it's deployed (or locally via `npm run dev`) with:
- `michaelb@acceleration-group.com` (role: admin)
- any `@opportunityengines.dev` placeholder account (role: oe_member —
  see MEMBERS in `supabase/seed_sql/seed_02_auth_users.sql` for the list)
- password: `OE-seed-2026!-change-me` — **rotate this immediately** and
  replace the placeholder accounts with real teammates via `inviteMember()`
  before anyone else touches this.

## What's in here

- `supabase/001_schema.sql` — every table: companies, member/portco
  profiles, allocations, the collaboration board, deal-room threads,
  pulse calls, deal-flow calendar, valuation methods, and the
  KPI/financials/wins/challenges/priorities tables a portfolio company
  will edit through their own portal.
- `supabase/002_rls.sql` — row-level security. This is the real access
  control: a portfolio-company contact's queries are restricted to their
  own company at the database level, not hidden by the UI. Read the
  comments in this file — they explain the reasoning per table (why
  valuation and internal cross-portfolio discussion are OE-only, why a
  company can edit its own KPIs but not its own valuation, etc).
- `supabase/seed.mjs` — the original seed script design, loading the exact
  mock portfolio the prototype shipped with via the Supabase JS client and
  `auth.admin.createUser()`. Requires a service-role key to run. Kept here
  as the reference implementation / for re-seeding a future environment
  that has one.
- `supabase/seed_sql/` — what was **actually run** against the live
  project, as ten ordered raw-SQL files, because no service-role key was
  available through the provisioning tools used. Same source data as
  `seed.mjs`, translated to direct `insert`s — including inserting
  straight into `auth.users`/`auth.identities` (with `pgcrypto` for the
  password hash) and relying on the already-live `handle_new_user`
  trigger to populate `profiles` correctly, exactly as validated in local
  testing beforehand. Deterministic UUIDs (RFC 4122 v5, same scheme as
  `seed.mjs`) keep company ids stable across re-runs.
- `supabase/functions/invite-member/` — an edge function for the *real*
  onboarding path: an admin invites a real teammate or portfolio-company
  contact by email, and Supabase sends them an actual invite email. This
  is what should replace the seeded placeholder accounts before launch.
- `src/lib/supabaseClient.js`, `auth.js`, `api.js` — the client library.
  `api.js` has one function per read/write the app needs (listCompanies,
  createRequest, volunteerForRequest, postThread, upsertKpi, ...) plus a
  realtime subscription helper.
- `index.html`, `src/main.js`, `src/style.css` — the actual app: real
  Supabase Auth login (no more demo member-picker), the sidebar/topbar
  shell, a hash router, and every render function wired to `api.js`
  instead of the prototype's in-memory arrays. Covers: Portfolio grid
  (scoped by RLS automatically — an OE member sees the whole portfolio,
  a portco contact sees only their own company), Company Deep Dive
  (Overview / Operations / Valuation / Priorities / Collaboration / Deal
  Room — Valuation tab only shown to OE members), and My Opportunity
  Engine (Deal Flow / Pulse Calls / Engine Directory — OE-only, hidden
  entirely for portco contacts). Realtime: opening a company deep dive
  subscribes to live changes on that company's requests/threads/
  challenges/KPIs and re-renders the current tab when anything changes,
  so two people looking at the same company converge without a refresh.

## What's NOT in here yet

Two things, deliberately scoped out rather than guessed at:

1. **LaaSy's narrative-only content.** The original mock had a lot of
   detail for LaaSy specifically that has no table behind it: team bios,
   board list, product-line take-rates, unit economics per $10M, use of
   funds, buyer universe (tier 1/2/3 acquirers), and the DoD
   federal-validation quote. None of that made it into `001_schema.sql`
   because it's LaaSy-specific narrative, not a repeatable per-company
   data model — the schema instead covers what every portfolio company
   has: KPIs, financials, wins, challenges, priorities. Whether this
   content should get its own table(s) (e.g. a flexible
   `company_narrative_sections` table) or just live as a rich-text field
   somewhere is a real design decision, not something to guess silently.
2. **Live browser verification.** `npm run build` succeeds and the code
   has been read through carefully end to end (catching and fixing two
   real bugs this way: `getMyProfile()` was missing an `id` filter and
   would throw for every OE member since RLS makes all non-portco
   profiles visible to everyone, and `listPulseCalls()` was missing its
   company join). But it has **not** been exercised in an actual browser
   against the live Supabase project — the environment that built this
   can reach the Supabase *management* API (that's how the project got
   provisioned and seeded) but its outbound network policy blocks direct
   HTTPS to `*.supabase.co` from a browser or `curl` (confirmed: a
   `curl` through its proxy to the project's `/auth/v1/health` endpoint
   returns `403 Forbidden`, while the same request to `api.github.com`
   succeeds). First real test should be `npm run dev` on a machine that
   isn't behind that restriction, or after deploying — sign in with
   `michaelb@acceleration-group.com` and the seeded password and click
   through Portfolio → a company → each tab → My Opportunity Engine.

## Setup — status against the live project

1. ~~Create the Supabase project.~~ **Done.** Project `iwpysmrmunirsvdrecmw`,
   `001_schema.sql` and `002_rls.sql` applied.

2. ~~Create the storage bucket policies.~~ **Done** — handled at the bottom
   of `002_rls.sql`, which creates the `deal-room-docs` bucket and its
   access policies.

3. ~~Seed it.~~ **Done**, via `supabase/seed_sql/` (see above) rather than
   `npm run seed`, since no service-role key was available. If you ever
   need to re-seed a *different* environment and do have a service-role
   key, `seed.mjs` remains the reference path:
   ```
   cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   npm install
   npm run seed
   ```

4. ~~Deploy the invite-member edge function.~~ **Done** — `invite-member`
   is active on the live project.

5. **Run the frontend locally — this is the real first test.**
   ```
   npm install
   npm run dev
   ```
   Then sign in with `michaelb@acceleration-group.com` /
   `OE-seed-2026!-change-me` (rotate after) and click through Portfolio,
   a company's tabs, and My Opportunity Engine. A `.env` with the live
   project's real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` is
   already included in this bundle (the anon key is safe to ship to a
   browser — RLS is what actually protects the data). If you're starting
   from a clean checkout instead, copy `.env.example` and fill in those
   two values from the Supabase dashboard → Project Settings → API.

6. **Deploy.** `npm run build` produces a static `dist/` folder for
   Render, Vercel, Netlify, or any static host, with the two `VITE_`-
   prefixed env vars set in that host's dashboard. Render's own deploy
   tools need a Git-clonable repo URL to build from, which is why this
   needed a repo pushed to first — see the top-level chat for the current
   state of that.
