-- 9. engine threads
with ins as (
  insert into public.engine_threads (topic, author_id, body)
  values ('Federal & GovTech Engine', '06ab7d00-869a-532a-9c5a-3239ec86e74a', 'Both LaaSy and Anchorpoint are now navigating federal procurement in parallel — proposing a shared session on ATO/FedRAMP basics so both teams (and Lumen, eventually) aren''t solving this from scratch.')
  returning id
)
insert into public.engine_thread_companies (engine_thread_id, company_id) select ins.id, v.company_id from ins, (values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057'::uuid),('bbecb839-62b6-542e-aeb2-c20b8a8cd3b7'::uuid)) as v(company_id);
with ins as (
  insert into public.engine_threads (topic, author_id, body)
  values ('Ops & Scaling Engine', '7899411c-1ea2-5bbc-8756-207ae5c62a40', 'Halcyon''s ops-scaling playbook (how they structured customer success through their Series B ramp) is directly relevant to what LaaSy and Nimbus are both hitting right now. Setting up a cross-portfolio working session.')
  returning id
)
insert into public.engine_thread_companies (engine_thread_id, company_id) select ins.id, v.company_id from ins, (values ('567faf69-8295-51fe-95ac-2250954999a5'::uuid),('8c1f679b-9d8a-5a4c-a01b-d154850a0057'::uuid),('258e582a-49de-5c51-82f4-2f633063cc41'::uuid)) as v(company_id);
with ins as (
  insert into public.engine_threads (topic, author_id, body)
  values ('Capital Markets Engine', 'e6da2079-7679-563d-8136-3c01bc74a7fb', 'Three portfolio-adjacent companies are all raising bridges/seeds in the same 60-day window. Worth comparing terms across LaaSy, Cove, and Lumen before we advise any of them individually.')
  returning id
)
insert into public.engine_thread_companies (engine_thread_id, company_id) select ins.id, v.company_id from ins, (values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057'::uuid),('9580b7fd-e20a-599f-afc9-5fdfbae83a9f'::uuid),('545fd357-c37a-5a83-bae7-cf7f297fd379'::uuid)) as v(company_id);
with ins as (
  insert into public.engine_threads (topic, author_id, body)
  values ('Talent & People Engine', '1edffb86-3b0c-5a92-bd85-615a3b21e421', 'Both Nimbus and Fielder have an open VP/lead-level search right now. Sharing a shortlist of 3 candidates across both conversations.')
  returning id
)
insert into public.engine_thread_companies (engine_thread_id, company_id) select ins.id, v.company_id from ins, (values ('258e582a-49de-5c51-82f4-2f633063cc41'::uuid),('fc4811f3-13e4-53fc-9ffa-7a5da2f92e64'::uuid)) as v(company_id);