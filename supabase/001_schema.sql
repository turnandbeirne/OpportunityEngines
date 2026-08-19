-- =====================================================================
-- Opportunity Engines Platform — core schema
-- Run against a fresh Supabase project (Postgres 15+, pgcrypto + RLS).
-- Order matters: extensions -> tables -> functions/triggers -> policies.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PROFILES
-- One row per authenticated user (1:1 with auth.users). role determines
-- what a user can see: an oe_member sees the whole portfolio; a
-- portco_contact is scoped by company_id to exactly one company; admin
-- is an oe_member with elevated write access (e.g. can edit valuations).
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  initials text not null,
  role text not null check (role in ('oe_member','portco_contact','admin')),
  title text,
  focus text,
  color text default 'var(--series-1)',
  company_id uuid, -- FK added below via ALTER once public.companies exists
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Extends auth.users. role=portco_contact rows must have company_id set; enforced by trigger below.';

-- ---------------------------------------------------------------------
-- COMPANIES
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  short_code text not null,
  sector text not null,
  stage text not null,
  logo_color text default 'var(--navy-900)',
  one_liner text,
  bucket text not null check (bucket in ('considering','invested','advising')),
  relevance smallint not null default 3 check (relevance between 1 and 5),
  first_viewed date,
  first_invested date,
  last_round_date date,
  last_round_amount numeric,
  last_round_valuation numeric,
  last_round_type text,
  current_mark_low numeric,
  current_mark_mid numeric,
  current_mark_high numeric,
  sponsor_id uuid references public.profiles(id),
  top_factors text[] default '{}',
  tags text[] default '{}',
  is_reference_example boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles.company_id -> companies.id (deferred FK, companies didn't exist yet above)
alter table public.profiles
  add constraint profiles_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

-- a portco_contact must be scoped to a company
create or replace function public.enforce_portco_company() returns trigger as $$
begin
  if new.role = 'portco_contact' and new.company_id is null then
    raise exception 'portco_contact profiles must have company_id set';
  end if;
  return new;
end;
$$ language plpgsql;
create trigger trg_enforce_portco_company
  before insert or update on public.profiles
  for each row execute function public.enforce_portco_company();

create table public.company_advisors (
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  primary key (company_id, member_id)
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (company_id, member_id)
);

-- ---------------------------------------------------------------------
-- COLLABORATION: requests, volunteers, threads
-- ---------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('intro','feedback','rnd','management','capital','other')),
  title text not null,
  body text,
  posted_by uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open','in-progress','closed')),
  created_at timestamptz not null default now()
);

create table public.request_volunteers (
  request_id uuid not null references public.requests(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, member_id)
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id uuid references public.profiles(id),
  tag text default 'Note',
  tag_class text default 'pill-considering',
  body text not null,
  created_at timestamptz not null default now()
);

create table public.engine_threads (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.engine_thread_companies (
  engine_thread_id uuid not null references public.engine_threads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary key (engine_thread_id, company_id)
);

-- ---------------------------------------------------------------------
-- PULSE CALLS
-- ---------------------------------------------------------------------
create table public.pulse_calls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  call_date date not null,
  cadence text,
  news text,
  need text,
  lead text,
  challenge text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.pulse_call_attendees (
  pulse_call_id uuid not null references public.pulse_calls(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  primary key (pulse_call_id, member_id)
);

-- ---------------------------------------------------------------------
-- DEAL FLOW (pitches, SME sessions, diligence, screening)
-- ---------------------------------------------------------------------
create table public.flow_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pitch','sme','diligence')),
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  event_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming','past')),
  format text,
  presenter text,
  outcome text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- VALUATION (multi-method; only populated where OE has done real work)
-- ---------------------------------------------------------------------
create table public.valuation_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  method_key text not null,          -- 'dcf' | 'market' | 'exit' | ...
  label text not null,
  icon text,
  low numeric not null,
  mid numeric not null,
  high numeric not null,
  note text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (company_id, method_key)
);

create table public.valuation_ceiling (
  company_id uuid primary key references public.companies(id) on delete cascade,
  label text not null,
  value numeric not null,
  note text
);

-- ---------------------------------------------------------------------
-- OPERATIONS & KPIs — flexible enough for every company (not just the
-- one with a hand-built dashboard), and directly editable by a portco
-- contact via the portal. metric_key is a stable slug ("gmv_monthly",
-- "contracts_closed_won", ...); period is null for a single current
-- value or set for a time-series point (one row per month, etc).
-- ---------------------------------------------------------------------
create table public.company_kpis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_key text not null,
  label text not null,
  value numeric not null,
  unit text,                 -- 'usd' | 'count' | 'pct' | ...
  period date,                -- null = current snapshot value; set = one point in a series
  note text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index on public.company_kpis (company_id, metric_key, period);

create table public.company_financials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year text not null,        -- '2026E', '2027E', ...
  gmv numeric,
  revenue numeric,
  gross_profit numeric,
  gross_margin numeric,
  ebitda numeric,
  ebitda_margin numeric,
  note text,
  unique (company_id, year)
);

create table public.company_wins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client text not null,
  detail text,
  value numeric,
  is_pilot boolean not null default false,
  win_date date not null default current_date,
  created_by uuid references public.profiles(id)
);

create table public.company_challenges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  detail text,
  severity text not null default 'warning' check (severity in ('good','warning','serious','critical')),
  resolved boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_priorities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  owner text,
  due_date date,
  detail text,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  doc_type text,               -- 'pdf' | 'xlsx' | 'doc' | ...
  storage_path text,           -- path in the 'deal-room-docs' storage bucket
  size_bytes bigint,
  is_restricted boolean not null default false,
  owner_label text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger trg_challenges_updated_at before update on public.company_challenges
  for each row execute function public.set_updated_at();
create trigger trg_kpis_updated_at before update on public.company_kpis
  for each row execute function public.set_updated_at();
create trigger trg_valuation_methods_updated_at before update on public.valuation_methods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- Expects role/full_name/company_id passed through signup metadata;
-- defaults to 'oe_member' if not specified (admin invite flow should
-- always pass explicit metadata — see src/lib/auth.js).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'oe_member');
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_company uuid := nullif(new.raw_user_meta_data->>'company_id','')::uuid;
begin
  insert into public.profiles (id, full_name, initials, role, company_id)
  values (
    new.id,
    v_name,
    upper(left(regexp_replace(v_name, '[^A-Za-z ]', '', 'g'), 1) ||
          coalesce(left(split_part(v_name, ' ', 2), 1), '')),
    v_role,
    v_company
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();
