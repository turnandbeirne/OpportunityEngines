-- 10. laasy detail: valuation, financials, wins, challenges, priorities, kpis
insert into public.valuation_methods (company_id, method_key, label, icon, low, mid, high, note) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'dcf', 'Discounted Cash Flow', '&#128200;', 274000000, 378000000, 513000000, 'EBITDA used as a FCF proxy across 2027E–2030E (2027–28 per company projections; 2029–30 extrapolated at decelerating GMV growth), discounted at 20–30% and a terminal value at 8–12x terminal-year EBITDA.'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'market', 'Market / Revenue Multiple', '&#128181;', 258000000, 361000000, 464000000, '5x–9x applied to 2027E revenue of $51.6M — a conservative band relative to the corporate-travel-tech comp set given LaaSy''s earlier stage.'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'exit', 'Exit / Strategic Multiple', '&#127942;', 293000000, 371000000, 468000000, '15x–24x applied to 2028E EBITDA of $19.5M, reflecting strategic-acquirer willingness to pay up (Amex, Rakuten, TravelPerk-tier buyers) to defend against participation-economy disruption.')
on conflict (company_id, method_key) do nothing;
insert into public.valuation_ceiling (company_id, label, value, note) values ('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Comp-Set Ceiling (long-run, aspirational)', 2700000000, 'TravelPerk × Yokoy priced at $2.7B in its Jan 2025 Series E — the reference comp for a fully scaled, integrated corporate-travel-and-spend platform. LaaSy is materially earlier stage; treat as a directional ceiling, not a near-term mark.') on conflict (company_id) do nothing;
insert into public.company_financials (company_id, year, gmv, revenue, gross_profit, gross_margin, ebitda, ebitda_margin, note) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', '2026E', 76.1, 6.9, 3.7, 53.0, -3.0, -43.7, NULL),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', '2027E', 717.5, 51.6, 28.9, 56.0, 13.9, 26.9, NULL),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', '2028E', 2150.5, 142.1, 82.4, 58.0, 19.5, 13.7, 'Assumes a future Series B.')
on conflict (company_id, year) do nothing;
insert into public.company_wins (company_id, client, detail, value, is_pilot, win_date) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'EKKL', 'Multi-year enterprise engagement (Amplify), 2026–2029', 50000000, false, '2026-06-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Qonsultum / SRMSDC', 'Thrive · corporate travel rollout', 30000000, false, '2026-06-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'E3 HR Inc.', 'Corporate travel', 16000000, false, '2026-06-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Rate', 'National mortgage brand · employee perks', 1750000, false, '2026-05-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Bucknell University', 'NCAA D-I · corporate + team travel', 750000, false, '2026-05-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'LTK', 'LIKEtoKNOW.it · creator-commerce group', 400000, false, '2026-04-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Stand for Life', 'Donor conference, booked for 2028', 216500, false, '2026-04-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Mega Metro', 'Event services, booked for 2027', 146800, false, '2026-04-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'USSSA', 'U.S. Specialty Sports Association · Perks', 142500, false, '2026-03-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Charlotte Hornets', 'NBA franchise · corporate travel (pilot)', 125000, true, '2026-03-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'LOVB', 'Pro volleyball league · corporate travel (pilot)', 60000, true, '2026-03-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'National Prayer Breakfast', 'National gathering · group travel', 350000, false, '2026-02-01');
insert into public.company_challenges (company_id, title, detail, severity) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Revenue-recognition lag behind bookings', '$143.2M sitting in legal/procurement — the gap between contracted GMV and recognized revenue is the single biggest near-term execution risk.', 'serious'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Capacity constrained ahead of the ramp', 'Operations & customer success headcount hasn''t kept pace with the 5x GMV growth in the last 3 months.', 'warning'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Federal upside unfunded', 'DoD/GSA engagement requires a dedicated federal capture team LaaSy hasn''t built yet.', 'warning');
insert into public.company_priorities (company_id, title, owner, due_date, detail, sort_order) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Close the $12M bridge', 'Ethan Drum, CEO', '2026-09-30', 'SAFE at $125M post-money cap, standard YC terms, MFN, no discount — designed to close in weeks.', 1),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Convert legal/procurement backlog', 'Mike Oakman, COO', '2026-09-30', '$143.2M of contracted GMV is sitting in legal/procurement — converting this on time is the biggest lever on 2026 revenue.', 2),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Stand up a federal capture function', 'Brittany Torbett, Chief of Staff', '2026-12-31', 'Formalize the GSA/DoD relationship into a funded pilot ahead of the FY2027 budget cycle.', 3),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'Scale the Bird Dog channel past 60 pointers', 'Ethan Drum, CEO', NULL, '90%+ of customers have come through this $0-CAC referral network — protecting and scaling it is the core distribution moat.', 4);
insert into public.company_kpis (company_id, metric_key, label, value, unit, period) values
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_to_date', 'GMV to Date', 134800000, 'usd', NULL),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'contracts_closed_won', 'Contracts Closed-Won', 146, 'count', NULL),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'documented_pipeline', 'Documented Pipeline', 704800000, 'usd', NULL),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 8000000, 'usd', '2025-08-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 14000000, 'usd', '2025-09-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 19000000, 'usd', '2025-10-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 24000000, 'usd', '2025-11-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 28000000, 'usd', '2025-12-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 32000000, 'usd', '2026-01-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 58000000, 'usd', '2026-02-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 87000000, 'usd', '2026-03-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 118000000, 'usd', '2026-04-01'),
('8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'gmv_monthly', 'Monthly GMV', 134800000, 'usd', '2026-05-01');