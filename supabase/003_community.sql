-- Community management layer: notifications (@mentions, "someone
-- volunteered for your request"), and moderation (delete a thread/
-- request/engine post you posted, or any of them if you're an admin --
-- previously there was no delete policy on any of these tables at all,
-- so nothing could ever be removed once posted).
--
-- On a FRESH project: run 001_schema.sql, then 002_rls.sql, then this
-- file, in order. On the LIVE project (iwpysmrmunirsvdrecmw) this was
-- the sixth migration applied (after 002_rls's own consolidated 002-005)
-- -- numbered 003 here only to keep a from-scratch bootstrap simple.

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('mention','volunteer')),
  company_id uuid references public.companies(id) on delete cascade,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'In-app notifications: @mentions in threads/requests/engine posts, and "someone volunteered for your request". Created client-side by the app after a successful post/volunteer, not by a DB trigger -- see api.js createNotification().';

alter table public.notifications enable row level security;

-- A recipient can only ever see/manage their own notifications.
create policy notifications_select_own on public.notifications for select
  using (recipient_id = auth.uid());
create policy notifications_update_own on public.notifications for update
  using (recipient_id = auth.uid());

-- Any signed-in user can create a notification FOR someone else (that's
-- the point -- mentioning or volunteering notifies another person, not
-- yourself; createNotification() in api.js already refuses to notify the
-- caller). Deliberately not restricted to is_oe(): a portco contact
-- posting to their own company's Deal Room can @mention an OE member
-- too, and that has to be able to create a notification for them.
create policy notifications_insert on public.notifications for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------
-- Moderation -- delete your own post, or (admin) anyone's. Previously
-- missing entirely: no delete policy existed on any of these tables, so
-- RLS silently denied every delete attempt.
-- ---------------------------------------------------------------------
create policy threads_delete on public.threads for delete
  using (private.is_admin() or author_id = auth.uid());

create policy requests_delete on public.requests for delete
  using (private.is_admin() or posted_by = auth.uid());

create policy engine_threads_delete on public.engine_threads for delete
  using (private.is_admin() or author_id = auth.uid());
