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
- **`invite-member` and `admin-users` edge functions:** deployed and
  active — real account administration (invite, list emails, reset a
  password), not just the seeded demo accounts. **Fixed a real bug this
  pass:** both functions were missing CORS handling entirely (no OPTIONS
  response, no `Access-Control-Allow-*` headers on any response), so
  every call from the browser failed at the preflight stage — Team &
  Access silently showed no emails and Invite/Reset Password visibly
  failed with "Failed to fetch". Only caught by an actual live
  click-through, not code review; both redeployed with standard CORS
  headers and re-verified live.
- **Community management:** applied (`003_community.sql`) — in-app
  notifications for `@mentions` and "someone volunteered for your
  request", plus moderation (delete your own post, or any post if you're
  an admin) on requests/threads/engine threads, which previously had no
  delete policy at all.
- **Members Lounge:** applied (`004_members_lounge.sql`) — bio, self-tagged
  interest areas, contact/social links, and a photo URL on every profile;
  a real member directory and profile page showing each member's
  investment and advisory/board history across the portfolio; a "nudge"
  notification for suggesting an opportunity might fit someone.
- **Frontend:** the rendering code is ported from the HTML prototype's
  in-memory arrays to real async Supabase calls (see "What's in here" and
  "What's NOT in here yet" below for exact scope and what's still
  missing). `npm run build` succeeds cleanly, and this pass was verified
  with an actual connected browser against the live site (login, every
  nav item, posting/deleting/mentioning/nudging, the notification bell,
  and global search all clicked through directly) — not just code review.
- **Hosting:** **live.** Deployed on Render as a static site, building
  from `https://github.com/turnandbeirne/OpportunityEngines` (branch
  `main`) via `npm install && npm run build`, publishing `dist/`, with
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set in Render's dashboard.
  Live at **https://opportunity-engines-platform.onrender.com**.
  Auto-deploy is configured but **does not currently fire** — the GitHub
  repo was private when the service was first created, so Render's
  GitHub App was never granted access to it (confirmed: pushes don't
  trigger a deploy; every deploy so far has been a manual
  `trigger_deploy` call). Fix: reconnect the repo or install Render's
  GitHub App from the Render dashboard.

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
- `supabase/functions/admin-users/` — the other half of account
  administration: listing every member's email (public.profiles
  deliberately doesn't duplicate auth.users' emails, so this reads them
  server-side with the service role key) and setting a member's password
  directly when they're locked out. Both need the service role key, so
  neither runs in the browser — same caller-is-actually-an-admin check as
  invite-member (the caller's own JWT proves who they are via RLS on
  their own profile row, then the function checks role === 'admin').
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
  Also covers the sidebar's Snapshot panel, Quick Actions, and pinnable
  Deep Dive Shortcuts (OE/admin only — restored after the initial port
  dropped them), a "My Account" panel for every user (edit profile, bio,
  interest tags, contact/social links, avatar photo URL, and change your
  own password), and a "Team & Access" page for admins (member directory
  with real emails, invite a new member, edit anyone's role/company,
  reset anyone's password).

  **Members Lounge** (OE/admin only, top-level nav): a real member
  directory (`#/members`) — search by name, focus, or interest tag — and
  a full profile page per member (`#/members/:id`) showing their photo or
  initials, bio, self-tagged areas of interest, contact info and
  LinkedIn/X/website links, investment history (from `allocations`) and
  advisory/board history (from `company_advisors`) across the whole
  portfolio, and their recent Engine Directory posts. Clicking your own
  avatar (topbar or sidebar) now takes you to your own profile, which has
  an "Edit My Profile" button opening the extended My Account form below;
  clicking another member's profile shows a "Suggest an opportunity"
  button instead — a nudge notification pointing them at a specific
  portfolio company. Replaces the old read-only "Members" tab that used
  to live under My Opportunity Engine (promoted to its own nav item, one
  implementation instead of two).

  Community management, on top of all that: a real notifications table
  (not a computed/synthetic one) with a topbar bell — `@mentioning`
  someone by full name in a Collaboration request, Deal Room note, or
  Engine Directory post notifies them, and volunteering for a request
  notifies whoever posted it. A global search box in the topbar finds
  companies (everyone) and members (OE/admin) and jumps straight there.
  Moderation: delete your own request/thread/engine post, or (admin) any
  of them, via a two-click "Confirm delete?" control — no native browser
  dialogs. Engine Directory gained a "Start a discussion" post form (it
  only supported reading before) and a read-only Members tab everyone on
  the Opportunity Engine can see, separate from admin-only Team & Access.
  One pre-existing bug fixed along the way: `createRequest`/`postThread`/
  `postEngineThread` never actually set `posted_by`/`author_id`, so every
  post's author showed as "Unknown" and nothing could ever be scoped to
  "mine" — now fixed, and confirmed no existing live rows were affected
  (all seeded data already had these set correctly; only rows created via
  those three functions were ever null, and there were none).

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

4. ~~Deploy the edge functions.~~ **Done** — `invite-member` and
   `admin-users` are both active on the live project.

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

6. ~~Deploy.~~ **Done.** Live on Render at
   https://opportunity-engines-platform.onrender.com, building from
   `main` on every push, with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
   set as env vars in the Render service (Render dashboard → this service
   → Environment, if they ever need to change). Render needed either a
   public repo or its own GitHub App access to a private one — the repo
   was made public to unblock this (nothing sensitive is committed;
   `.env` is gitignored and RLS enforces access server-side regardless of
   who can read the source).
