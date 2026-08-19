-- 2. auth users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'authenticated', 'authenticated', 'michaelb@acceleration-group.com', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Michael Beirne", "role": "admin"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', '{"sub": "868d9b69-d4c2-5ff6-aeb6-25b95fe762f5", "email": "michaelb@acceleration-group.com"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'e6da2079-7679-563d-8136-3c01bc74a7fb', 'authenticated', 'authenticated', 'sarah.chen@opportunityengines.dev', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Sarah Chen", "role": "oe_member"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), 'e6da2079-7679-563d-8136-3c01bc74a7fb', 'e6da2079-7679-563d-8136-3c01bc74a7fb', '{"sub": "e6da2079-7679-563d-8136-3c01bc74a7fb", "email": "sarah.chen@opportunityengines.dev"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9', 'authenticated', 'authenticated', 'david.osei@opportunityengines.dev', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "David Osei", "role": "oe_member"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9', '58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9', '{"sub": "58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9", "email": "david.osei@opportunityengines.dev"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '80d5cae5-495d-5752-b6e0-9c6ec43cfa12', 'authenticated', 'authenticated', 'priya.raman@opportunityengines.dev', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Priya Raman", "role": "oe_member"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '80d5cae5-495d-5752-b6e0-9c6ec43cfa12', '80d5cae5-495d-5752-b6e0-9c6ec43cfa12', '{"sub": "80d5cae5-495d-5752-b6e0-9c6ec43cfa12", "email": "priya.raman@opportunityengines.dev"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '06ab7d00-869a-532a-9c5a-3239ec86e74a', 'authenticated', 'authenticated', 'tom.whitfield@opportunityengines.dev', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Tom Whitfield", "role": "oe_member"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '06ab7d00-869a-532a-9c5a-3239ec86e74a', '06ab7d00-869a-532a-9c5a-3239ec86e74a', '{"sub": "06ab7d00-869a-532a-9c5a-3239ec86e74a", "email": "tom.whitfield@opportunityengines.dev"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '7899411c-1ea2-5bbc-8756-207ae5c62a40', 'authenticated', 'authenticated', 'elena.vasquez@opportunityengines.dev', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "Elena Vasquez", "role": "oe_member"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '7899411c-1ea2-5bbc-8756-207ae5c62a40', '7899411c-1ea2-5bbc-8756-207ae5c62a40', '{"sub": "7899411c-1ea2-5bbc-8756-207ae5c62a40", "email": "elena.vasquez@opportunityengines.dev"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '1edffb86-3b0c-5a92-bd85-615a3b21e421', 'authenticated', 'authenticated', 'james.okafor@opportunityengines.dev', extensions.crypt('OE-seed-2026!-change-me', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name": "James Okafor", "role": "oe_member"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '1edffb86-3b0c-5a92-bd85-615a3b21e421', '1edffb86-3b0c-5a92-bd85-615a3b21e421', '{"sub": "1edffb86-3b0c-5a92-bd85-615a3b21e421", "email": "james.okafor@opportunityengines.dev"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;