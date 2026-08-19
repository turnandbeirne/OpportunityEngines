-- 8. flow events
insert into public.flow_events (kind, company_id, title, event_date, status, format, presenter, outcome) values
('pitch', '8c1f679b-9d8a-5a4c-a01b-d154850a0057', 'LaaSy — Bridge Round Pitch', '2026-09-03', 'upcoming', 'Shark-tank style · 20 min pitch + 15 min Q&A', 'Ethan Drum, CEO', NULL),
('diligence', '545fd357-c37a-5a83-bae7-cf7f297fd379', 'Lumen Talent — Diligence Deep Dive', '2026-09-10', 'upcoming', 'Partner working session', 'Lumen Talent team', NULL),
('sme', NULL, 'SME Session: Federal Procurement 101', '2026-09-17', 'upcoming', '45 min briefing + AMA', 'Tom Whitfield', NULL),
('pitch', '9580b7fd-e20a-599f-afc9-5fdfbae83a9f', 'Cove Commerce — Seed Screening Pitch', '2026-08-28', 'upcoming', 'Shark-tank style · 15 min pitch + 10 min Q&A', 'Cove Commerce founders', NULL),
('pitch', '4c42bdca-d574-595f-8a08-7c7bcba5d5a0', 'Trestle Analytics — Series A Extension Pitch', '2026-03-01', 'past', 'Shark-tank style', 'Trestle Analytics team', 'Invested — $6.5M extension'),
('sme', NULL, 'SME Session: Underwriting Climate & Solar Risk', '2026-02-12', 'past', '45 min briefing + AMA', 'Verdant Grid CFO', '32 members attended'),
('pitch', 'fc4811f3-13e4-53fc-9ffa-7a5da2f92e64', 'Fielder Health — SME Session: Rural Healthcare Reimbursement', '2026-02-06', 'past', 'Briefing', 'Fielder Health team', 'Advisory relationship formed'),
('pitch', '567faf69-8295-51fe-95ac-2250954999a5', 'Halcyon Robotics — Series B Pitch', '2026-01-15', 'past', 'Shark-tank style', 'Halcyon Robotics team', 'Invested — $38M round'),
('pitch', NULL, 'Passed: FreshRoute Logistics — Seed Pitch', '2026-05-20', 'past', 'Shark-tank style', 'FreshRoute team', 'Passed — market too narrow');