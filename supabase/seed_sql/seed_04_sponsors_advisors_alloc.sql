-- 4. sponsors, advisors, allocations
update public.companies set sponsor_id = '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5' where id = '8c1f679b-9d8a-5a4c-a01b-d154850a0057';
update public.companies set sponsor_id = 'e6da2079-7679-563d-8136-3c01bc74a7fb' where id = '258e582a-49de-5c51-82f4-2f633063cc41';
update public.companies set sponsor_id = '7899411c-1ea2-5bbc-8756-207ae5c62a40' where id = '567faf69-8295-51fe-95ac-2250954999a5';
update public.companies set sponsor_id = '80d5cae5-495d-5752-b6e0-9c6ec43cfa12' where id = 'fc4811f3-13e4-53fc-9ffa-7a5da2f92e64';
update public.companies set sponsor_id = '7899411c-1ea2-5bbc-8756-207ae5c62a40' where id = '4c42bdca-d574-595f-8a08-7c7bcba5d5a0';
update public.companies set sponsor_id = '80d5cae5-495d-5752-b6e0-9c6ec43cfa12' where id = '9580b7fd-e20a-599f-afc9-5fdfbae83a9f';
update public.companies set sponsor_id = '06ab7d00-869a-532a-9c5a-3239ec86e74a' where id = 'bbecb839-62b6-542e-aeb2-c20b8a8cd3b7';
update public.companies set sponsor_id = '1edffb86-3b0c-5a92-bd85-615a3b21e421' where id = '545fd357-c37a-5a83-bae7-cf7f297fd379';
update public.companies set sponsor_id = 'e6da2079-7679-563d-8136-3c01bc74a7fb' where id = '26463070-0e20-5741-804c-e47c6ab82a83';
insert into public.company_advisors (company_id, member_id) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', '06ab7d00-869a-532a-9c5a-3239ec86e74a'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'e6da2079-7679-563d-8136-3c01bc74a7fb'),
('258e582a-49de-5c51-82f4-2f633063cc41', 'e6da2079-7679-563d-8136-3c01bc74a7fb'),
('258e582a-49de-5c51-82f4-2f633063cc41', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'),
('567faf69-8295-51fe-95ac-2250954999a5', '7899411c-1ea2-5bbc-8756-207ae5c62a40'),
('567faf69-8295-51fe-95ac-2250954999a5', '58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9'),
('fc4811f3-13e4-53fc-9ffa-7a5da2f92e64', '80d5cae5-495d-5752-b6e0-9c6ec43cfa12'),
('fc4811f3-13e4-53fc-9ffa-7a5da2f92e64', '1edffb86-3b0c-5a92-bd85-615a3b21e421'),
('4c42bdca-d574-595f-8a08-7c7bcba5d5a0', '7899411c-1ea2-5bbc-8756-207ae5c62a40'),
('4c42bdca-d574-595f-8a08-7c7bcba5d5a0', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'),
('9580b7fd-e20a-599f-afc9-5fdfbae83a9f', '80d5cae5-495d-5752-b6e0-9c6ec43cfa12'),
('bbecb839-62b6-542e-aeb2-c20b8a8cd3b7', '06ab7d00-869a-532a-9c5a-3239ec86e74a'),
('545fd357-c37a-5a83-bae7-cf7f297fd379', '1edffb86-3b0c-5a92-bd85-615a3b21e421'),
('545fd357-c37a-5a83-bae7-cf7f297fd379', '58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9'),
('26463070-0e20-5741-804c-e47c6ab82a83', 'e6da2079-7679-563d-8136-3c01bc74a7fb'),
('26463070-0e20-5741-804c-e47c6ab82a83', '7899411c-1ea2-5bbc-8756-207ae5c62a40')
on conflict do nothing;
insert into public.allocations (company_id, member_id, amount) values
('258e582a-49de-5c51-82f4-2f633063cc41', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 250000),
('567faf69-8295-51fe-95ac-2250954999a5', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 400000),
('4c42bdca-d574-595f-8a08-7c7bcba5d5a0', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 175000),
('26463070-0e20-5741-804c-e47c6ab82a83', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 200000)
on conflict (company_id, member_id) do nothing;