-- 7. pulse calls + attendees
with ins as (
  insert into public.pulse_calls (company_id, call_date, cadence, news, need, lead, challenge)
  values ('258e582a-49de-5c51-82f4-2f633063cc41', '2026-08-12', 'Bi-weekly', 'Crossed $2.1M ARR; closed 4 new mid-market logos.', 'Warm intros to CFO networks to shorten the 142-day enterprise sales cycle.', 'Two inbound leads from a competitor''s churned customers.', 'Enterprise sales cycle still the top blocker; VP Sales search ongoing.')
  returning id
)
insert into public.pulse_call_attendees (pulse_call_id, member_id) select ins.id, v.member_id from ins, (values ('e6da2079-7679-563d-8136-3c01bc74a7fb'::uuid),('868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'::uuid)) as v(member_id);
with ins as (
  insert into public.pulse_calls (company_id, call_date, cadence, news, need, lead, challenge)
  values ('567faf69-8295-51fe-95ac-2250954999a5', '2026-08-11', 'Bi-weekly', '9th facility deployment completed ahead of schedule.', 'Alternate sensor supplier to de-risk the current lead-time slip.', '3PL regional player exploring a 4-facility rollout.', 'Sensor supplier lead time slipped 2 more weeks; SOC 2 Type II still in progress.')
  returning id
)
insert into public.pulse_call_attendees (pulse_call_id, member_id) select ins.id, v.member_id from ins, (values ('7899411c-1ea2-5bbc-8756-207ae5c62a40'::uuid)) as v(member_id);
with ins as (
  insert into public.pulse_calls (company_id, call_date, cadence, news, need, lead, challenge)
  values ('4c42bdca-d574-595f-8a08-7c7bcba5d5a0', '2026-08-06', 'Monthly', 'Both F500 pilots tracking to convert in September.', 'Supply-chain operator to stress-test the new tariff-exposure module.', 'Inbound interest from a global apparel retailer.', 'Implementation time still averaging 11 weeks — targeting under 6.')
  returning id
)
insert into public.pulse_call_attendees (pulse_call_id, member_id) select ins.id, v.member_id from ins, (values ('7899411c-1ea2-5bbc-8756-207ae5c62a40'::uuid),('868d9b69-d4c2-5ff6-aeb6-25b95fe762f5'::uuid)) as v(member_id);
with ins as (
  insert into public.pulse_calls (company_id, call_date, cadence, news, need, lead, challenge)
  values ('26463070-0e20-5741-804c-e47c6ab82a83', '2026-07-29', 'Monthly', 'Second credit-line term sheet received.', 'Intro to a regional bank open to warehouse lending in new states.', 'Two installer networks in TX and AZ requesting onboarding.', 'Year-1 installer cohort default rate slightly above target.')
  returning id
)
insert into public.pulse_call_attendees (pulse_call_id, member_id) select ins.id, v.member_id from ins, (values ('e6da2079-7679-563d-8136-3c01bc74a7fb'::uuid),('7899411c-1ea2-5bbc-8756-207ae5c62a40'::uuid)) as v(member_id);
with ins as (
  insert into public.pulse_calls (company_id, call_date, cadence, news, need, lead, challenge)
  values ('fc4811f3-13e4-53fc-9ffa-7a5da2f92e64', '2026-07-22', 'Monthly', 'CMS reimbursement conversation progressing well.', 'Intro to a rural health-system CMO for a system-wide pilot.', 'Regional hospital network requested a demo.', 'Clinical-ops lead search still open after 6 weeks.')
  returning id
)
insert into public.pulse_call_attendees (pulse_call_id, member_id) select ins.id, v.member_id from ins, (values ('80d5cae5-495d-5752-b6e0-9c6ec43cfa12'::uuid),('1edffb86-3b0c-5a92-bd85-615a3b21e421'::uuid)) as v(member_id);
with ins as (
  insert into public.pulse_calls (company_id, call_date, cadence, news, need, lead, challenge)
  values ('bbecb839-62b6-542e-aeb2-c20b8a8cd3b7', '2026-08-03', 'Monthly', 'DoD pilot performance review scored ''exceeds expectations.''', 'FedRAMP / ATO compliance specialist referral.', 'Second defense prime requesting a briefing.', 'ATO review remains the long pole to a multi-year IDIQ contract.')
  returning id
)
insert into public.pulse_call_attendees (pulse_call_id, member_id) select ins.id, v.member_id from ins, (values ('06ab7d00-869a-532a-9c5a-3239ec86e74a'::uuid)) as v(member_id);