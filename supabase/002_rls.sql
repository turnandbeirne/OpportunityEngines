-- Row-level security for Opportunity Engines.
--
-- This file is the FINAL, CONSOLIDATED state of the security layer as it
-- actually runs on the live project (iwpysmrmunirsvdrecmw). It folds
-- together what was originally three separate migrations applied in order:
--   002_rls                    - the initial RLS design
--   003_harden_functions       - moved SECURITY DEFINER helpers into a
--                                 non-exposed `private` schema so they
--                                 can't be called directly as REST RPCs
--   004_close_rpc_surface      - repointed every policy at private.*,
--                                 dropped the public.* wrapper functions
--   005_cleanup_remaining_advisories - dropped a dead leftover function
--                                       and revoked an unneeded grant
-- A fresh project should apply 001_schema.sql then this file, in order,
-- and end up in exactly the same state as the live project.
--
-- The core idea: OE members and admins see the whole portfolio. A
-- portfolio-company (portco) contact's queries are restricted, AT THE
-- DATABASE LEVEL, to their own company. Capital detail (allocations),
-- cross-portfolio internal discussion (engine_threads), and valuation
-- (valuation_methods / valuation_ceiling) are OE-only and never exposed
-- to a portco contact under any circumstance. company_kpis /
-- company_financials / company_wins / company_challenges /
-- company_priorities are select+write for OE (any company) and for a
-- portco contact on their OWN company only -- this is the heart of the
-- portfolio-company portal: a company updates its own KPIs, wins,
-- challenges and priorities directly, but can't touch how OE is valuing
-- it or what other companies see.

-- ---------------------------------------------------------------------
-- private schema: SECURITY DEFINER helpers, never exposed as REST RPCs.
-- ---------------------------------------------------------------------
-- Supabase/PostgREST auto-exposes every function in `public` (and any
-- schema explicitly added to the exposed-schemas config) as a callable
-- REST endpoint (/rest/v1/rpc/<fn>). These helpers must run as
-- SECURITY DEFINER so RLS policies can read `profiles` without a
-- recursive-RLS deadlock, but they were never meant to be called
-- directly by a client. Putting them in `private` keeps them fully
-- usable *inside* RLS policies (which evaluate inside Postgres itself,
-- independent of REST schema exposure) while closing the direct-RPC
-- attack surface Supabase's own security advisor flags.
create schema if not exists private;

create or replace function private.current_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.current_company_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function private.is_oe()
returns boolean
language sql stable security definer set search_path = public as $$
  select private.current_role() in ('oe_member','admin');
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select private.current_role() = 'admin';
$$;

create or replace function private.is_own_company(target_company_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select private.current_role() = 'portco_contact' and private.current_company_id() = target_company_id;
$$;

-- Auto-creates a profiles row whenever a new auth.users row appears,
-- reading role/full_name/company_id out of raw_user_meta_data (set at
-- signup/invite time). Search-path pinned per Supabase's linter
-- guidance to prevent search-path-hijacking on a SECURITY DEFINER fn.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'oe_member');
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_company uuid := nullif(new.raw_user_meta_data->>'company_id','')::uuid;
begin
  insert into public.profiles (id, full_name, initials, role, company_id)
  values (
    new.id, v_name,
    upper(left(regexp_replace(v_name, '[^A-Za-z ]', '', 'g'), 1) ||
          coalesce(left(split_part(v_name, ' ', 2), 1), '')),
    v_role, v_company
  );
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Small public helpers that are fine to expose (not SECURITY DEFINER
-- privilege-escalation risks the way the private.* helpers are).
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_portco_company()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'portco_contact' and new.company_id is null then
    raise exception 'portco_contact profiles must have company_id set';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_portco_company on public.profiles;
create trigger trg_enforce_portco_company before insert or update on public.profiles
  for each row execute function public.enforce_portco_company();

-- Lets a signed-in user edit their OWN profile row only (id = auth.uid()
-- inside the function body). Deliberately SECURITY DEFINER + RPC-callable
-- by `authenticated`: that's the point, it's the self-service profile
-- edit endpoint. It's a no-op for `anon` since auth.uid() is null when
-- unauthenticated -- reviewed and accepted, see architecture notes.
create or replace function public.update_my_profile(p_full_name text, p_title text, p_focus text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set full_name = coalesce(p_full_name, full_name),
      title = coalesce(p_title, title),
      focus = coalesce(p_focus, focus)
  where id = auth.uid();
end;
$$;
revoke execute on function public.update_my_profile(text, text, text) from anon;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_advisors enable row level security;
alter table public.allocations enable row level security;
alter table public.requests enable row level security;
alter table public.request_volunteers enable row level security;
alter table public.threads enable row level security;
alter table public.engine_threads enable row level security;
alter table public.engine_thread_companies enable row level security;
alter table public.pulse_calls enable row level security;
alter table public.pulse_call_attendees enable row level security;
alter table public.flow_events enable row level security;
alter table public.valuation_methods enable row level security;
alter table public.valuation_ceiling enable row level security;
alter table public.company_kpis enable row level security;
alter table public.company_financials enable row level security;
alter table public.company_wins enable row level security;
alter table public.company_challenges enable row level security;
alter table public.company_priorities enable row level security;
alter table public.documents enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (private.is_oe() or id = auth.uid() or role <> 'portco_contact');

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles for insert
  with check (private.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update
  using (private.is_admin());
-- (self-service edits go through update_my_profile(), not direct UPDATE)

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select
  using (private.is_oe() or private.is_own_company(id));

drop policy if exists companies_write_admin on public.companies;
create policy companies_write_admin on public.companies for all
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------
-- company_advisors, allocations -- OE/admin only, capital detail never
-- exposed to a portco contact.
-- ---------------------------------------------------------------------
drop policy if exists company_advisors_select on public.company_advisors;
create policy company_advisors_select on public.company_advisors for select
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists company_advisors_write_admin on public.company_advisors;
create policy company_advisors_write_admin on public.company_advisors for all
  using (private.is_admin()) with check (private.is_admin());

drop policy if exists allocations_select_oe on public.allocations;
create policy allocations_select_oe on public.allocations for select
  using (private.is_oe());

drop policy if exists allocations_write_admin on public.allocations;
create policy allocations_write_admin on public.allocations for all
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------
-- requests / request_volunteers -- collaboration board
-- ---------------------------------------------------------------------
drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert
  with check (private.is_oe() or private.is_own_company(company_id));

drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests for update
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists request_volunteers_select on public.request_volunteers;
create policy request_volunteers_select on public.request_volunteers for select
  using (private.is_oe() or exists (
    select 1 from public.requests r where r.id = request_volunteers.request_id and private.is_own_company(r.company_id)
  ));

drop policy if exists request_volunteers_insert_oe on public.request_volunteers;
create policy request_volunteers_insert_oe on public.request_volunteers for insert
  with check (private.is_oe());

-- ---------------------------------------------------------------------
-- threads -- per-company deal-room notes/comments
-- ---------------------------------------------------------------------
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads for select
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads for insert
  with check (private.is_oe() or private.is_own_company(company_id));

-- ---------------------------------------------------------------------
-- engine_threads / engine_thread_companies -- fully internal
-- cross-portfolio discussion. A portco contact never sees these.
-- ---------------------------------------------------------------------
drop policy if exists engine_threads_select_oe on public.engine_threads;
create policy engine_threads_select_oe on public.engine_threads for select
  using (private.is_oe());

drop policy if exists engine_threads_insert_oe on public.engine_threads;
create policy engine_threads_insert_oe on public.engine_threads for insert
  with check (private.is_oe());

drop policy if exists engine_thread_companies_select_oe on public.engine_thread_companies;
create policy engine_thread_companies_select_oe on public.engine_thread_companies for select
  using (private.is_oe());

drop policy if exists engine_thread_companies_insert_oe on public.engine_thread_companies;
create policy engine_thread_companies_insert_oe on public.engine_thread_companies for insert
  with check (private.is_oe());

-- ---------------------------------------------------------------------
-- pulse_calls / pulse_call_attendees
-- ---------------------------------------------------------------------
drop policy if exists pulse_calls_select on public.pulse_calls;
create policy pulse_calls_select on public.pulse_calls for select
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists pulse_calls_write_oe on public.pulse_calls;
create policy pulse_calls_write_oe on public.pulse_calls for all
  using (private.is_oe()) with check (private.is_oe());

drop policy if exists pulse_call_attendees_select on public.pulse_call_attendees;
create policy pulse_call_attendees_select on public.pulse_call_attendees for select
  using (private.is_oe() or exists (
    select 1 from public.pulse_calls p where p.id = pulse_call_attendees.pulse_call_id and private.is_own_company(p.company_id)
  ));

drop policy if exists pulse_call_attendees_write_oe on public.pulse_call_attendees;
create policy pulse_call_attendees_write_oe on public.pulse_call_attendees for all
  using (private.is_oe()) with check (private.is_oe());

-- ---------------------------------------------------------------------
-- flow_events -- deal-flow calendar (OE-run; portco sees its own)
-- ---------------------------------------------------------------------
drop policy if exists flow_events_select on public.flow_events;
create policy flow_events_select on public.flow_events for select
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists flow_events_write_oe on public.flow_events;
create policy flow_events_write_oe on public.flow_events for all
  using (private.is_oe()) with check (private.is_oe());

-- ---------------------------------------------------------------------
-- valuation_methods / valuation_ceiling -- OE-only, always. A portco
-- contact never sees how OE is marking their own company.
-- ---------------------------------------------------------------------
drop policy if exists valuation_methods_select_oe on public.valuation_methods;
create policy valuation_methods_select_oe on public.valuation_methods for select
  using (private.is_oe());

drop policy if exists valuation_methods_write_oe on public.valuation_methods;
create policy valuation_methods_write_oe on public.valuation_methods for all
  using (private.is_oe()) with check (private.is_oe());

drop policy if exists valuation_ceiling_select_oe on public.valuation_ceiling;
create policy valuation_ceiling_select_oe on public.valuation_ceiling for select
  using (private.is_oe());

drop policy if exists valuation_ceiling_write_oe on public.valuation_ceiling;
create policy valuation_ceiling_write_oe on public.valuation_ceiling for all
  using (private.is_oe()) with check (private.is_oe());

-- ---------------------------------------------------------------------
-- company_kpis / company_financials / company_wins / company_challenges
-- / company_priorities -- the heart of the portfolio-company portal.
-- OE sees/writes any company; a portco contact sees/writes their OWN
-- company only.
-- ---------------------------------------------------------------------
drop policy if exists company_kpis_select on public.company_kpis;
create policy company_kpis_select on public.company_kpis for select
  using (private.is_oe() or private.is_own_company(company_id));
drop policy if exists company_kpis_write on public.company_kpis;
create policy company_kpis_write on public.company_kpis for all
  using (private.is_oe() or private.is_own_company(company_id))
  with check (private.is_oe() or private.is_own_company(company_id));

drop policy if exists company_financials_select on public.company_financials;
create policy company_financials_select on public.company_financials for select
  using (private.is_oe() or private.is_own_company(company_id));
drop policy if exists company_financials_write on public.company_financials;
create policy company_financials_write on public.company_financials for all
  using (private.is_oe() or private.is_own_company(company_id))
  with check (private.is_oe() or private.is_own_company(company_id));

drop policy if exists company_wins_select on public.company_wins;
create policy company_wins_select on public.company_wins for select
  using (private.is_oe() or private.is_own_company(company_id));
drop policy if exists company_wins_write on public.company_wins;
create policy company_wins_write on public.company_wins for all
  using (private.is_oe() or private.is_own_company(company_id))
  with check (private.is_oe() or private.is_own_company(company_id));

drop policy if exists company_challenges_select on public.company_challenges;
create policy company_challenges_select on public.company_challenges for select
  using (private.is_oe() or private.is_own_company(company_id));
drop policy if exists company_challenges_write on public.company_challenges;
create policy company_challenges_write on public.company_challenges for all
  using (private.is_oe() or private.is_own_company(company_id))
  with check (private.is_oe() or private.is_own_company(company_id));

drop policy if exists company_priorities_select on public.company_priorities;
create policy company_priorities_select on public.company_priorities for select
  using (private.is_oe() or private.is_own_company(company_id));
drop policy if exists company_priorities_write on public.company_priorities;
create policy company_priorities_write on public.company_priorities for all
  using (private.is_oe() or private.is_own_company(company_id))
  with check (private.is_oe() or private.is_own_company(company_id));

-- ---------------------------------------------------------------------
-- documents -- deal-room files. Anyone with company access can list/
-- upload; only an admin or the uploader can update/delete.
-- ---------------------------------------------------------------------
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select
  using (private.is_oe() or private.is_own_company(company_id));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert
  with check (private.is_oe() or private.is_own_company(company_id));

drop policy if exists documents_update_delete on public.documents;
create policy documents_update_delete on public.documents for all
  using (private.is_admin() or uploaded_by = auth.uid())
  with check (private.is_admin() or uploaded_by = auth.uid());

-- ---------------------------------------------------------------------
-- Storage: deal-room-docs bucket, folder-scoped by company id
-- (<company_id>/<filename>).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('deal-room-docs', 'deal-room-docs', false)
on conflict (id) do nothing;

drop policy if exists deal_room_docs_select on storage.objects;
create policy deal_room_docs_select on storage.objects for select
  using (
    bucket_id = 'deal-room-docs'
    and (private.is_oe() or private.is_own_company((storage.foldername(name))[1]::uuid))
  );

drop policy if exists deal_room_docs_insert on storage.objects;
create policy deal_room_docs_insert on storage.objects for insert
  with check (
    bucket_id = 'deal-room-docs'
    and (private.is_oe() or private.is_own_company((storage.foldername(name))[1]::uuid))
  );
