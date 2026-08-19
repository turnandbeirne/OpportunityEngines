-- 5. requests + volunteers
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'intro', 'Warm intro to a Fortune 500 travel-procurement lead', 'We''re mid-funnel with three F500 accounts. A direct intro to a VP of Travel/Procurement at a large enterprise (esp. financial services or pro sports) would help us skip 2-3 sales cycle steps.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'::uuid)) as v(member_id);
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'management', 'Need help structuring the ops org for 5x scale', 'GMV is growing faster than our customer-success bench. Looking for a working session with someone who has scaled an ops org through a similar inflection.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('7899411c-1ea2-5bbc-8756-207ae5c62a40'::uuid),('58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9'::uuid)) as v(member_id);
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'capital', 'Feedback on SAFE terms ahead of the bridge close', 'Would value a gut-check on the $125M cap and MFN clause from LPs who''ve seen similar participation-economy comps recently priced.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('e6da2079-7679-563d-8136-3c01bc74a7fb'::uuid)) as v(member_id);
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'rnd', 'Exploring an AI underwriting layer for the Perks cashback engine', 'Want a sounding board on fraud/abuse patterns before we commit engineering time next quarter.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'in-progress')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'::uuid)) as v(member_id);
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('258e582a-49de-5c51-82f4-2f633063cc41', 'intro', 'Intro to a VP Sales candidate with mid-market FinTech experience', 'We''ve struck out on 2 searches. Anyone with a strong bench of enterprise AP/FinTech sales leaders, please connect.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
select id from ins;
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('258e582a-49de-5c51-82f4-2f633063cc41', 'feedback', 'Feedback wanted on the new exception-handling UI before GA', 'Would love 20 minutes from anyone who''s used AP tools like Bill.com or Tipalti to sanity-check our new flow.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('58ae37a9-aed3-5fc5-aca6-9e9ed37b68a9'::uuid)) as v(member_id);
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('4c42bdca-d574-595f-8a08-7c7bcba5d5a0', 'rnd', 'Validating the tariff-exposure scoring model', 'Looking for a supply-chain operator to stress-test our new tariff module against real sourcing data before the Q1 release.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('7899411c-1ea2-5bbc-8756-207ae5c62a40'::uuid)) as v(member_id);
with ins as (
  insert into public.requests (company_id, type, title, body, posted_by, status)
  values ('fc4811f3-13e4-53fc-9ffa-7a5da2f92e64', 'intro', 'Intro to a rural health-system CMO', 'Trying to land our first system-wide contract — a warm intro to a CMO or VP of Clinical Ops at a rural health system would be huge.', '868d9b69-d4c2-5ff6-aeb6-25b95fe762f5', 'open')
  returning id
)
insert into public.request_volunteers (request_id, member_id) select ins.id, v.member_id from ins, (values ('80d5cae5-495d-5752-b6e0-9c6ec43cfa12'::uuid)) as v(member_id);