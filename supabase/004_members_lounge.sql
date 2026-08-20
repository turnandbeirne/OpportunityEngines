-- Members Lounge: richer member profiles (bio, interest tags, contact and
-- social links, avatar), a nudge notification type ("this opportunity
-- could be a fit for you"), and a self-service RPC that covers all of it.
--
-- On a FRESH project: run 001_schema.sql, 002_rls.sql, 003_community.sql,
-- then this file, in order. On the LIVE project (iwpysmrmunirsvdrecmw)
-- this was the seventh migration applied.

-- ---------------------------------------------------------------------
-- profiles: new self-managed fields. All nullable/optional -- a member
-- fills in as much or as little as they want. contact_email/phone are
-- separate from the real auth.users login email on purpose: what a
-- member chooses to publish in an internal directory shouldn't be tied
-- to (or force exposure of) their actual login identity.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column bio text,
  add column interest_tags text[] not null default '{}',
  add column linkedin_url text,
  add column twitter_url text,
  add column website_url text,
  add column contact_email text,
  add column phone text,
  add column avatar_url text;

comment on column public.profiles.interest_tags is 'Self-tagged areas of interest/alignment for future opportunity matching -- shown on the Members Lounge profile card and used for future opportunity-fit matching.';
comment on column public.profiles.contact_email is 'Self-managed, separate from auth.users.email -- a member chooses what to publish in the internal directory rather than their real login email being exposed automatically.';
comment on column public.profiles.avatar_url is 'A pasted image URL (e.g. a hosted headshot), not a Storage upload -- kept simple for v1. Falls back to the existing colored-initials avatar when null.';

-- ---------------------------------------------------------------------
-- update_my_profile(): extended to cover every self-editable field, not
-- just full_name/title/focus. Direct-assign (not coalesce) on every
-- param -- the My Account form always submits the complete current form
-- state, including fields cleared back to empty, so coalescing against
-- "old value if null" would make it impossible to ever clear a field.
-- full_name is the one exception: the form's `required` attribute means
-- it's never actually blank, and this keeps a defensive fallback in case
-- a future caller omits it.
-- ---------------------------------------------------------------------
drop function if exists public.update_my_profile(text, text, text);

create or replace function public.update_my_profile(
  p_full_name text,
  p_title text,
  p_focus text,
  p_bio text default null,
  p_interest_tags text[] default '{}',
  p_linkedin_url text default null,
  p_twitter_url text default null,
  p_website_url text default null,
  p_contact_email text default null,
  p_phone text default null,
  p_avatar_url text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set full_name = coalesce(p_full_name, full_name),
      title = p_title,
      focus = p_focus,
      bio = p_bio,
      interest_tags = coalesce(p_interest_tags, '{}'),
      linkedin_url = p_linkedin_url,
      twitter_url = p_twitter_url,
      website_url = p_website_url,
      contact_email = p_contact_email,
      phone = p_phone,
      avatar_url = p_avatar_url
  where id = auth.uid();
end;
$$;
revoke execute on function public.update_my_profile(text, text, text, text, text[], text, text, text, text, text, text) from anon;

-- ---------------------------------------------------------------------
-- notifications: add 'nudge' as a third type -- "a fellow member thinks
-- this opportunity could be a fit for you." Uses the existing table/RLS
-- from 003_community.sql unchanged (notifications_insert already lets
-- any authenticated user create a notification for someone else); only
-- the type check constraint needs widening.
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('mention', 'volunteer', 'nudge'));
