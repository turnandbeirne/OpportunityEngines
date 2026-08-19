#!/usr/bin/env node
/**
 * Seeds a fresh Supabase project with the Opportunity Engines mock
 * portfolio (the exact same data the HTML prototype shipped with),
 * transformed into the real schema in 001_schema.sql / 002_rls.sql.
 *
 * Run AFTER both migrations have been applied. Requires:
 *   SUPABASE_URL              - your project URL
 *   SUPABASE_SERVICE_ROLE_KEY - service role key (bypasses RLS; never
 *                                ship this key to a browser)
 *
 *   node supabase/seed.mjs
 *
 * Idempotent: re-running it upserts by stable, deterministic UUIDs
 * (derived from the same string ids the JS prototype used) rather than
 * creating duplicates.
 *
 * IMPORTANT: this creates real Supabase Auth accounts for every OE
 * member and portfolio-company contact below, with the placeholder
 * password DEFAULT_PASSWORD (change immediately). Michael Beirne is
 * seeded with his real email; everyone else uses an @opportunityengines.dev
 * placeholder — replace those with real invites (see src/lib/auth.js
 * inviteMember()) before this goes anywhere near production use.
 */
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the seed.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const NAMESPACE = uuidv5("opportunity-engines.local", uuidv5.DNS);
const id = (kind, key) => uuidv5(`${kind}:${key}`, NAMESPACE);

const DEFAULT_PASSWORD = "OE-seed-2026!-change-me";

// ---------------------------------------------------------------------
// Source data — verbatim from the prototype's part2_data.js / part5_dash2.js
// ---------------------------------------------------------------------
const MEMBERS = [
  { id: "m-michael", name: "Michael Beirne", email: "michaelb@acceleration-group.com", role: "Managing Partner", focus: "Growth Strategy · M&A", color: "var(--series-1)", appRole: "admin" },
  { id: "m-sarah", name: "Sarah Chen", email: "sarah.chen@opportunityengines.dev", role: "Partner", focus: "FinTech · Capital Markets", color: "var(--series-3)", appRole: "oe_member" },
  { id: "m-david", name: "David Osei", email: "david.osei@opportunityengines.dev", role: "Advisor", focus: "Enterprise SaaS · GTM", color: "var(--series-7)", appRole: "oe_member" },
  { id: "m-priya", name: "Priya Raman", email: "priya.raman@opportunityengines.dev", role: "Partner", focus: "Consumer · Marketplaces", color: "var(--series-5)", appRole: "oe_member" },
  { id: "m-tom", name: "Tom Whitfield", email: "tom.whitfield@opportunityengines.dev", role: "Advisor", focus: "Federal · GovTech · Defense", color: "var(--series-2)", appRole: "oe_member" },
  { id: "m-elena", name: "Elena Vasquez", email: "elena.vasquez@opportunityengines.dev", role: "Partner", focus: "Ops · Supply Chain", color: "var(--series-6)", appRole: "oe_member" },
  { id: "m-james", name: "James Okafor", email: "james.okafor@opportunityengines.dev", role: "Advisor", focus: "People · Talent · HR Tech", color: "var(--series-4)", appRole: "oe_member" },
];

const COMPANIES = [
  { id: "laasy", name: "LaaSy, Inc.", short: "LY", sector: "Travel FinTech · SaaS", stage: "Seed / Bridge (SAFE)", bucket: "considering", oneLiner: "Corporate travel rebuilt as a participation economy — customers earn back 60–80% of the spread legacy platforms used to keep.", firstViewed: "2026-04-02", firstInvested: null, lastRoundDate: "2026-05-01", lastRoundType: "YC SAFE (post-money cap)", lastRoundAmount: 12_000_000, lastRoundValuation: 125_000_000, currentMarkLow: 135_000_000, currentMarkMid: 210_000_000, currentMarkHigh: 340_000_000, relevance: 5, sponsor: "m-michael", advisors: ["m-michael", "m-tom", "m-sarah"], logoColor: "#0a0f1e", topFactors: ["Convert the $704.8M documented pipeline into recognized revenue", "Close the $12M bridge before the Series A comp window shifts", "Land the DoD/GSA validation into a signed federal pilot"], tags: ["Corporate Travel", "Participation Economy", "$0 CAC"], isReference: true },
  { id: "nimbus", name: "Nimbus Ledger", short: "NL", sector: "FinTech · SaaS", stage: "Series A", bucket: "invested", oneLiner: "AI-native accounts-payable automation for mid-market industrials — closes the books 5x faster with 90% fewer exceptions.", firstViewed: "2024-11-14", firstInvested: "2025-02-10", lastRoundDate: "2025-02-10", lastRoundType: "Series A (priced)", lastRoundAmount: 8_000_000, lastRoundValuation: 32_000_000, currentMarkLow: 46_000_000, currentMarkMid: 54_000_000, currentMarkHigh: 61_000_000, relevance: 4, sponsor: "m-sarah", advisors: ["m-sarah", "m-michael"], logoColor: "#1c3b6b", topFactors: ["Land 3 more mid-market ERPs as certified integrations", "Fix the enterprise sales-cycle length (now 142 days avg)", "Hire a VP Sales before Q1 2027 renewal wave"], tags: ["AP Automation", "AI", "Mid-Market"], myInvestment: 250_000 },
  { id: "halcyon", name: "Halcyon Robotics", short: "HR", sector: "Industrial · Robotics", stage: "Series B", bucket: "invested", oneLiner: "Pick-and-pack robotics-as-a-service for 3PL warehouses — deployed in 9 facilities, zero capex for the operator.", firstViewed: "2023-06-01", firstInvested: "2023-09-20", lastRoundDate: "2026-01-15", lastRoundType: "Series B (priced)", lastRoundAmount: 38_000_000, lastRoundValuation: 210_000_000, currentMarkLow: 210_000_000, currentMarkMid: 225_000_000, currentMarkHigh: 250_000_000, relevance: 3, sponsor: "m-elena", advisors: ["m-elena", "m-david"], logoColor: "#3a4a63", topFactors: ["Resolve the Q3 sensor-supplier lead-time slip", "Close 2 more 3PL logos to hit Q4 utilization target", "Finish SOC 2 Type II before enterprise pilots convert"], tags: ["Robotics", "3PL", "RaaS"], myInvestment: 400_000 },
  { id: "fielder", name: "Fielder Health", short: "FH", sector: "HealthTech", stage: "Seed", bucket: "advising", oneLiner: "Remote patient monitoring built for rural and critical-access clinics, with offline-first data capture.", firstViewed: "2025-01-22", firstInvested: null, lastRoundDate: "2025-08-01", lastRoundType: "Seed (priced)", lastRoundAmount: 3_200_000, lastRoundValuation: 14_000_000, currentMarkLow: 14_000_000, currentMarkMid: 17_500_000, currentMarkHigh: 21_000_000, relevance: 3, sponsor: "m-priya", advisors: ["m-priya", "m-james"], logoColor: "#2f5233", topFactors: ["Get CMS reimbursement code confirmed for Q1 2027", "Recruit a clinical-ops lead before next fundraise", "Land first health-system system-wide contract"], tags: ["RPM", "Rural Health", "Advisory"] },
  { id: "trestle", name: "Trestle Analytics", short: "TA", sector: "Enterprise SaaS · Supply Chain", stage: "Series A", bucket: "invested", oneLiner: "Supply-chain risk analytics that flags single-source exposure before it becomes a stockout.", firstViewed: "2024-03-11", firstInvested: "2024-07-01", lastRoundDate: "2026-03-01", lastRoundType: "Series A extension", lastRoundAmount: 6_500_000, lastRoundValuation: 41_000_000, currentMarkLow: 41_000_000, currentMarkMid: 47_000_000, currentMarkHigh: 55_000_000, relevance: 4, sponsor: "m-elena", advisors: ["m-elena", "m-michael"], logoColor: "#4a3aa7", topFactors: ["Convert the 2 F500 pilots signed in Q2 into full contracts", "Ship the tariff-exposure module ahead of Q1 renewals", "Reduce implementation time from 11 weeks to under 6"], tags: ["Supply Chain", "Risk Analytics"], myInvestment: 175_000 },
  { id: "cove", name: "Cove Commerce", short: "CC", sector: "Marketplace · Specialty Food", stage: "Seed", bucket: "considering", oneLiner: "B2B marketplace connecting independent grocers to specialty-food producers, with next-day regional fulfillment.", firstViewed: "2026-06-30", firstInvested: null, lastRoundDate: "2026-02-01", lastRoundType: "Pre-seed (SAFE)", lastRoundAmount: 1_100_000, lastRoundValuation: 9_000_000, currentMarkLow: 9_000_000, currentMarkMid: 9_500_000, currentMarkHigh: 12_000_000, relevance: 2, sponsor: "m-priya", advisors: ["m-priya"], logoColor: "#eb6834", topFactors: ["Prove repeat-order rate above 60% in 2 pilot metros", "Sign a regional cold-chain logistics partner", "Decide on seed round timing before runway tightens"], tags: ["Marketplace", "Food & Bev"] },
  { id: "anchorpoint", name: "Anchorpoint Defense Systems", short: "AD", sector: "GovTech · Logistics", stage: "Series A", bucket: "advising", oneLiner: "Logistics-planning software for defense primes, cutting convoy-routing time from days to minutes.", firstViewed: "2024-09-05", firstInvested: null, lastRoundDate: "2025-11-01", lastRoundType: "Series A (priced)", lastRoundAmount: 14_000_000, lastRoundValuation: 70_000_000, currentMarkLow: 70_000_000, currentMarkMid: 82_000_000, currentMarkHigh: 95_000_000, relevance: 4, sponsor: "m-tom", advisors: ["m-tom"], logoColor: "#16213d", topFactors: ["Convert the DoD pilot into a multi-year IDIQ contract", "Pass ATO (Authority to Operate) security review", "Hire cleared engineering staff — 4 reqs open"], tags: ["Defense", "Logistics", "Advisory"] },
  { id: "lumen", name: "Lumen Talent", short: "LT", sector: "HR Tech · AI", stage: "Seed", bucket: "considering", oneLiner: "AI recruiting copilot that shortlists and schedules candidates directly inside the hiring manager's inbox.", firstViewed: "2026-05-18", firstInvested: null, lastRoundDate: "2026-06-15", lastRoundType: "Seed (SAFE)", lastRoundAmount: 2_400_000, lastRoundValuation: 16_000_000, currentMarkLow: 16_000_000, currentMarkMid: 18_000_000, currentMarkHigh: 22_000_000, relevance: 4, sponsor: "m-james", advisors: ["m-james", "m-david"], logoColor: "#eda100", topFactors: ["Validate time-to-fill lift with 3 reference customers", "Close the ATS integration with Greenhouse + Lever", "Settle pricing model before the seed extension closes"], tags: ["Recruiting AI", "SaaS"] },
  { id: "verdant", name: "Verdant Grid", short: "VG", sector: "CleanTech · FinTech", stage: "Series A", bucket: "invested", oneLiner: "Financing platform for commercial solar installers — underwrites and funds projects in under 72 hours.", firstViewed: "2024-05-20", firstInvested: "2024-10-01", lastRoundDate: "2025-12-01", lastRoundType: "Series A (priced)", lastRoundAmount: 11_000_000, lastRoundValuation: 58_000_000, currentMarkLow: 58_000_000, currentMarkMid: 63_000_000, currentMarkHigh: 70_000_000, relevance: 3, sponsor: "m-sarah", advisors: ["m-sarah", "m-elena"], logoColor: "#1baf7a", topFactors: ["Diversify the underwriting capital stack beyond one bank line", "Expand into 4 new states before Q1 tax-credit changes", "Reduce default rate on year-1 installer cohort"], tags: ["Solar Finance", "CleanTech"], myInvestment: 200_000 },
];

const REQUESTS = {
  laasy: [
    { type: "intro", postedBy: "Ethan Drum, CEO", title: "Warm intro to a Fortune 500 travel-procurement lead", body: "We're mid-funnel with three F500 accounts. A direct intro to a VP of Travel/Procurement at a large enterprise (esp. financial services or pro sports) would help us skip 2-3 sales cycle steps.", status: "open", volunteers: ["m-michael"] },
    { type: "management", postedBy: "Mike Oakman, COO", title: "Need help structuring the ops org for 5x scale", body: "GMV is growing faster than our customer-success bench. Looking for a working session with someone who has scaled an ops org through a similar inflection.", status: "open", volunteers: ["m-elena", "m-david"] },
    { type: "capital", postedBy: "Ethan Drum, CEO", title: "Feedback on SAFE terms ahead of the bridge close", body: "Would value a gut-check on the $125M cap and MFN clause from LPs who've seen similar participation-economy comps recently priced.", status: "open", volunteers: ["m-sarah"] },
    { type: "rnd", postedBy: "Asim Mohammad, CTO", title: "Exploring an AI underwriting layer for the Perks cashback engine", body: "Want a sounding board on fraud/abuse patterns before we commit engineering time next quarter.", status: "in-progress", volunteers: ["m-michael"] },
  ],
  nimbus: [
    { type: "intro", postedBy: "Founder & CEO", title: "Intro to a VP Sales candidate with mid-market FinTech experience", body: "We've struck out on 2 searches. Anyone with a strong bench of enterprise AP/FinTech sales leaders, please connect.", status: "open", volunteers: [] },
    { type: "feedback", postedBy: "Head of Product", title: "Feedback wanted on the new exception-handling UI before GA", body: "Would love 20 minutes from anyone who's used AP tools like Bill.com or Tipalti to sanity-check our new flow.", status: "open", volunteers: ["m-david"] },
  ],
  trestle: [{ type: "rnd", postedBy: "Head of Data Science", title: "Validating the tariff-exposure scoring model", body: "Looking for a supply-chain operator to stress-test our new tariff module against real sourcing data before the Q1 release.", status: "open", volunteers: ["m-elena"] }],
  fielder: [{ type: "intro", postedBy: "Founder & CEO", title: "Intro to a rural health-system CMO", body: "Trying to land our first system-wide contract — a warm intro to a CMO or VP of Clinical Ops at a rural health system would be huge.", status: "open", volunteers: ["m-priya"] }],
};

const THREADS = {
  laasy: [
    { author: "m-tom", text: "Talked to the DoD contact directly — the $1B savings figure is real and independently modeled, not marketing math. Worth weighting heavily in the memo.", tag: "Diligence", tagClass: "pill-considering" },
    { author: "m-sarah", text: "$125M cap on a $75M PMD floor is a fair entry given the GMV curve, but I want to see the legal/procurement backlog convert before we size up beyond pro-rata.", tag: "Terms", tagClass: "pill-gold" },
    { author: "m-michael", text: "Introduced Ethan to two enterprise travel buyers in our network — set up calls for next week. Also flagged Halcyon's ops playbook as a reference for scaling customer success.", tag: "Intro", tagClass: "pill-invested" },
    { author: "m-priya", text: "The Perks module reminds me of what Cove is trying to do on the supply side — might be a useful cross-portfolio conversation before the pitch.", tag: "Product", tagClass: "pill-advising" },
  ],
  nimbus: [
    { author: "m-sarah", text: "Pulse call recap: ARR crossed $2.1M, sales cycle still the #1 blocker. Connecting them to 2 CFOs from our network this week.", tag: "Pulse", tagClass: "pill-invested" },
    { author: "m-michael", text: "Board deck looked strong — VP Sales search is the single most important open item before year-end.", tag: "Board", tagClass: "pill-gold" },
  ],
  halcyon: [{ author: "m-elena", text: "Sensor supplier lead time slipped another 2 weeks. Introduced an alternate supplier from the Verdant network.", tag: "Ops", tagClass: "pill-advising" }],
  trestle: [{ author: "m-elena", text: "Both F500 pilots are tracking to convert in September. Tariff module ships next sprint.", tag: "Pulse", tagClass: "pill-invested" }],
  verdant: [{ author: "m-sarah", text: "Second credit line term sheet came in — reviewing with their CFO Thursday.", tag: "Capital", tagClass: "pill-gold" }],
  cove: [{ author: "m-priya", text: "Repeat-order data from the Denver pilot looks promising — waiting on the Kansas City numbers before the full memo.", tag: "Screening", tagClass: "pill-considering" }],
  lumen: [{ author: "m-james", text: "Reference calls with 2 of 3 pilot customers done — both cite meaningful time-to-fill improvement. One more call and the memo is ready.", tag: "Diligence", tagClass: "pill-considering" }],
  fielder: [{ author: "m-priya", text: "CMS reimbursement code conversation is progressing — introduced their team to a former CMS policy advisor in our network.", tag: "Advisory", tagClass: "pill-advising" }],
  anchorpoint: [{ author: "m-tom", text: "ATO review is the long pole. Connected them with a FedRAMP compliance consultant who's helped two other portfolio companies through this.", tag: "Advisory", tagClass: "pill-advising" }],
};

const PULSE_CALLS = [
  { company: "nimbus", date: "2026-08-12", cadence: "Bi-weekly", attendees: ["m-sarah", "m-michael"], news: "Crossed $2.1M ARR; closed 4 new mid-market logos.", need: "Warm intros to CFO networks to shorten the 142-day enterprise sales cycle.", lead: "Two inbound leads from a competitor's churned customers.", challenge: "Enterprise sales cycle still the top blocker; VP Sales search ongoing." },
  { company: "halcyon", date: "2026-08-11", cadence: "Bi-weekly", attendees: ["m-elena"], news: "9th facility deployment completed ahead of schedule.", need: "Alternate sensor supplier to de-risk the current lead-time slip.", lead: "3PL regional player exploring a 4-facility rollout.", challenge: "Sensor supplier lead time slipped 2 more weeks; SOC 2 Type II still in progress." },
  { company: "trestle", date: "2026-08-06", cadence: "Monthly", attendees: ["m-elena", "m-michael"], news: "Both F500 pilots tracking to convert in September.", need: "Supply-chain operator to stress-test the new tariff-exposure module.", lead: "Inbound interest from a global apparel retailer.", challenge: "Implementation time still averaging 11 weeks — targeting under 6." },
  { company: "verdant", date: "2026-07-29", cadence: "Monthly", attendees: ["m-sarah", "m-elena"], news: "Second credit-line term sheet received.", need: "Intro to a regional bank open to warehouse lending in new states.", lead: "Two installer networks in TX and AZ requesting onboarding.", challenge: "Year-1 installer cohort default rate slightly above target." },
  { company: "fielder", date: "2026-07-22", cadence: "Monthly", attendees: ["m-priya", "m-james"], news: "CMS reimbursement conversation progressing well.", need: "Intro to a rural health-system CMO for a system-wide pilot.", lead: "Regional hospital network requested a demo.", challenge: "Clinical-ops lead search still open after 6 weeks." },
  { company: "anchorpoint", date: "2026-08-03", cadence: "Monthly", attendees: ["m-tom"], news: "DoD pilot performance review scored 'exceeds expectations.'", need: "FedRAMP / ATO compliance specialist referral.", lead: "Second defense prime requesting a briefing.", challenge: "ATO review remains the long pole to a multi-year IDIQ contract." },
];

const FLOW_EVENTS = [
  { kind: "pitch", company: "laasy", title: "LaaSy — Bridge Round Pitch", date: "2026-09-03", status: "upcoming", format: "Shark-tank style · 20 min pitch + 15 min Q&A", presenter: "Ethan Drum, CEO" },
  { kind: "diligence", company: "lumen", title: "Lumen Talent — Diligence Deep Dive", date: "2026-09-10", status: "upcoming", format: "Partner working session", presenter: "Lumen Talent team" },
  { kind: "sme", company: null, title: "SME Session: Federal Procurement 101", date: "2026-09-17", status: "upcoming", format: "45 min briefing + AMA", presenter: "Tom Whitfield" },
  { kind: "pitch", company: "cove", title: "Cove Commerce — Seed Screening Pitch", date: "2026-08-28", status: "upcoming", format: "Shark-tank style · 15 min pitch + 10 min Q&A", presenter: "Cove Commerce founders" },
  { kind: "pitch", company: "trestle", title: "Trestle Analytics — Series A Extension Pitch", date: "2026-03-01", status: "past", outcome: "Invested — $6.5M extension", format: "Shark-tank style", presenter: "Trestle Analytics team" },
  { kind: "sme", company: null, title: "SME Session: Underwriting Climate & Solar Risk", date: "2026-02-12", status: "past", outcome: "32 members attended", format: "45 min briefing + AMA", presenter: "Verdant Grid CFO" },
  { kind: "pitch", company: "fielder", title: "Fielder Health — SME Session: Rural Healthcare Reimbursement", date: "2026-02-06", status: "past", outcome: "Advisory relationship formed", format: "Briefing", presenter: "Fielder Health team" },
  { kind: "pitch", company: "halcyon", title: "Halcyon Robotics — Series B Pitch", date: "2026-01-15", status: "past", outcome: "Invested — $38M round", format: "Shark-tank style", presenter: "Halcyon Robotics team" },
  { kind: "pitch", company: null, title: "Passed: FreshRoute Logistics — Seed Pitch", date: "2026-05-20", status: "past", outcome: "Passed — market too narrow", format: "Shark-tank style", presenter: "FreshRoute team" },
];

const ENGINE_THREADS = [
  { topic: "Federal & GovTech Engine", companies: ["laasy", "anchorpoint"], author: "m-tom", text: "Both LaaSy and Anchorpoint are now navigating federal procurement in parallel — proposing a shared session on ATO/FedRAMP basics so both teams (and Lumen, eventually) aren't solving this from scratch." },
  { topic: "Ops & Scaling Engine", companies: ["halcyon", "laasy", "nimbus"], author: "m-elena", text: "Halcyon's ops-scaling playbook (how they structured customer success through their Series B ramp) is directly relevant to what LaaSy and Nimbus are both hitting right now. Setting up a cross-portfolio working session." },
  { topic: "Capital Markets Engine", companies: ["laasy", "cove", "lumen"], author: "m-sarah", text: "Three portfolio-adjacent companies are all raising bridges/seeds in the same 60-day window. Worth comparing terms across LaaSy, Cove, and Lumen before we advise any of them individually." },
  { topic: "Talent & People Engine", companies: ["nimbus", "fielder"], author: "m-james", text: "Both Nimbus and Fielder have an open VP/lead-level search right now. Sharing a shortlist of 3 candidates across both conversations." },
];

const LAASY_VALUATION = {
  methods: [
    { key: "dcf", label: "Discounted Cash Flow", icon: "&#128200;", low: 274_000_000, mid: 378_000_000, high: 513_000_000, note: "EBITDA used as a FCF proxy across 2027E–2030E (2027–28 per company projections; 2029–30 extrapolated at decelerating GMV growth), discounted at 20–30% and a terminal value at 8–12x terminal-year EBITDA." },
    { key: "market", label: "Market / Revenue Multiple", icon: "&#128181;", low: 258_000_000, mid: 361_000_000, high: 464_000_000, note: "5x–9x applied to 2027E revenue of $51.6M — a conservative band relative to the corporate-travel-tech comp set given LaaSy's earlier stage." },
    { key: "exit", label: "Exit / Strategic Multiple", icon: "&#127942;", low: 293_000_000, mid: 371_000_000, high: 468_000_000, note: "15x–24x applied to 2028E EBITDA of $19.5M, reflecting strategic-acquirer willingness to pay up (Amex, Rakuten, TravelPerk-tier buyers) to defend against participation-economy disruption." },
  ],
  ceiling: { label: "Comp-Set Ceiling (long-run, aspirational)", value: 2_700_000_000, note: "TravelPerk × Yokoy priced at $2.7B in its Jan 2025 Series E — the reference comp for a fully scaled, integrated corporate-travel-and-spend platform. LaaSy is materially earlier stage; treat as a directional ceiling, not a near-term mark." },
};

const LAASY_FINANCIALS = [
  { year: "2026E", gmv: 76.1, revenue: 6.9, grossProfit: 3.7, grossMargin: 53.0, ebitda: -3.0, ebitdaMargin: -43.7 },
  { year: "2027E", gmv: 717.5, revenue: 51.6, grossProfit: 28.9, grossMargin: 56.0, ebitda: 13.9, ebitdaMargin: 26.9 },
  { year: "2028E", gmv: 2150.5, revenue: 142.1, grossProfit: 82.4, grossMargin: 58.0, ebitda: 19.5, ebitdaMargin: 13.7, note: "Assumes a future Series B." },
];

const LAASY_WINS = [
  { client: "EKKL", detail: "Multi-year enterprise engagement (Amplify), 2026–2029", value: 50_000_000, date: "2026-06-01" },
  { client: "Qonsultum / SRMSDC", detail: "Thrive · corporate travel rollout", value: 30_000_000, date: "2026-06-01" },
  { client: "E3 HR Inc.", detail: "Corporate travel", value: 16_000_000, date: "2026-06-01" },
  { client: "Rate", detail: "National mortgage brand · employee perks", value: 1_750_000, date: "2026-05-01" },
  { client: "Bucknell University", detail: "NCAA D-I · corporate + team travel", value: 750_000, date: "2026-05-01" },
  { client: "LTK", detail: "LIKEtoKNOW.it · creator-commerce group", value: 400_000, date: "2026-04-01" },
  { client: "Stand for Life", detail: "Donor conference, booked for 2028", value: 216_500, date: "2026-04-01" },
  { client: "Mega Metro", detail: "Event services, booked for 2027", value: 146_800, date: "2026-04-01" },
  { client: "USSSA", detail: "U.S. Specialty Sports Association · Perks", value: 142_500, date: "2026-03-01" },
  { client: "Charlotte Hornets", detail: "NBA franchise · corporate travel (pilot)", value: 125_000, pilot: true, date: "2026-03-01" },
  { client: "LOVB", detail: "Pro volleyball league · corporate travel (pilot)", value: 60_000, pilot: true, date: "2026-03-01" },
  { client: "National Prayer Breakfast", detail: "National gathering · group travel", value: 350_000, date: "2026-02-01" },
];

const LAASY_CHALLENGES = [
  { title: "Revenue-recognition lag behind bookings", detail: "$143.2M sitting in legal/procurement — the gap between contracted GMV and recognized revenue is the single biggest near-term execution risk.", severity: "serious" },
  { title: "Capacity constrained ahead of the ramp", detail: "Operations & customer success headcount hasn't kept pace with the 5x GMV growth in the last 3 months.", severity: "warning" },
  { title: "Federal upside unfunded", detail: "DoD/GSA engagement requires a dedicated federal capture team LaaSy hasn't built yet.", severity: "warning" },
];

const LAASY_PRIORITIES = [
  { title: "Close the $12M bridge", owner: "Ethan Drum, CEO", due: "2026-09-30", detail: "SAFE at $125M post-money cap, standard YC terms, MFN, no discount — designed to close in weeks.", sort: 1 },
  { title: "Convert legal/procurement backlog", owner: "Mike Oakman, COO", due: "2026-09-30", detail: "$143.2M of contracted GMV is sitting in legal/procurement — converting this on time is the biggest lever on 2026 revenue.", sort: 2 },
  { title: "Stand up a federal capture function", owner: "Brittany Torbett, Chief of Staff", due: "2026-12-31", detail: "Formalize the GSA/DoD relationship into a funded pilot ahead of the FY2027 budget cycle.", sort: 3 },
  { title: "Scale the Bird Dog channel past 60 pointers", owner: "Ethan Drum, CEO", due: null, detail: "90%+ of customers have come through this $0-CAC referral network — protecting and scaling it is the core distribution moat.", sort: 4 },
];

const LAASY_MONTHLY_GMV = [
  { period: "2025-08-01", value: 8_000_000 }, { period: "2025-09-01", value: 14_000_000 }, { period: "2025-10-01", value: 19_000_000 },
  { period: "2025-11-01", value: 24_000_000 }, { period: "2025-12-01", value: 28_000_000 }, { period: "2026-01-01", value: 32_000_000 },
  { period: "2026-02-01", value: 58_000_000 }, { period: "2026-03-01", value: 87_000_000 }, { period: "2026-04-01", value: 118_000_000 },
  { period: "2026-05-01", value: 134_800_000 },
];

const LAASY_SNAPSHOT_KPIS = [
  { key: "gmv_to_date", label: "GMV to Date", value: 134_800_000, unit: "usd" },
  { key: "contracts_closed_won", label: "Contracts Closed-Won", value: 146, unit: "count" },
  { key: "documented_pipeline", label: "Documented Pipeline", value: 704_800_000, unit: "usd" },
];

// ---------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------
async function upsertCompanies() {
  const rows = COMPANIES.map(c => ({
    id: id("company", c.id),
    slug: c.id,
    name: c.name,
    short_code: c.short,
    sector: c.sector,
    stage: c.stage,
    logo_color: c.logoColor,
    one_liner: c.oneLiner,
    bucket: c.bucket,
    relevance: c.relevance,
    first_viewed: c.firstViewed,
    first_invested: c.firstInvested,
    last_round_date: c.lastRoundDate,
    last_round_amount: c.lastRoundAmount,
    last_round_valuation: c.lastRoundValuation,
    last_round_type: c.lastRoundType,
    current_mark_low: c.currentMarkLow,
    current_mark_mid: c.currentMarkMid,
    current_mark_high: c.currentMarkHigh,
    top_factors: c.topFactors,
    tags: c.tags,
    is_reference_example: !!c.isReference,
  }));
  const { error } = await sb.from("companies").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(`companies: ${rows.length} upserted`);
}

async function createMembers() {
  const profileIds = {};
  for (const m of MEMBERS) {
    const uid = id("member", m.id);
    profileIds[m.id] = uid;
    // Create the auth user first (admin API), letting Postgres assign its own id,
    // then reconcile profiles.id to our deterministic id via update — simplest
    // approach for a seed script is to just let auth assign the id and use THAT
    // as the profile id throughout, rather than forcing our own uuid into auth.users.
    const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    let authUser = existing?.users?.find(u => u.email === m.email);
    if (!authUser) {
      const { data, error } = await sb.auth.admin.createUser({
        email: m.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: m.name, role: m.appRole },
      });
      if (error) throw error;
      authUser = data.user;
    }
    profileIds[m.id] = authUser.id; // real auth uid — this is what FKs must use
    await sb.from("profiles").update({
      title: m.role,
      focus: m.focus,
      color: m.color,
    }).eq("id", authUser.id);
  }
  console.log(`members: ${MEMBERS.length} auth accounts ready (password: ${DEFAULT_PASSWORD})`);
  return profileIds;
}

async function linkSponsorsAndAdvisors(memberIds) {
  for (const c of COMPANIES) {
    await sb.from("companies").update({ sponsor_id: memberIds[c.sponsor] }).eq("id", id("company", c.id));
    const rows = c.advisors.map(a => ({ company_id: id("company", c.id), member_id: memberIds[a] }));
    await sb.from("company_advisors").upsert(rows, { onConflict: "company_id,member_id" });
  }
  const alloc = COMPANIES.filter(c => c.myInvestment).map(c => ({
    company_id: id("company", c.id), member_id: memberIds["m-michael"], amount: c.myInvestment,
  }));
  const { error } = await sb.from("allocations").upsert(alloc, { onConflict: "company_id,member_id" });
  if (error) throw error;
  console.log(`sponsors/advisors linked; ${alloc.length} allocation rows (Michael's real amounts only — add the rest via the app)`);
}

async function seedRequests(memberIds) {
  let n = 0;
  for (const [companySlug, reqs] of Object.entries(REQUESTS)) {
    for (const r of reqs) {
      const { data, error } = await sb.from("requests").insert({
        company_id: id("company", companySlug), type: r.type, title: r.title, body: r.body,
        posted_by: memberIds["m-michael"], status: r.status,
      }).select("id").single();
      if (error) throw error;
      n++;
      if (r.volunteers.length) {
        await sb.from("request_volunteers").insert(r.volunteers.map(v => ({ request_id: data.id, member_id: memberIds[v] })));
      }
    }
  }
  console.log(`requests: ${n} inserted`);
}

async function seedThreads(memberIds) {
  let n = 0;
  for (const [companySlug, items] of Object.entries(THREADS)) {
    const rows = items.map(t => ({ company_id: id("company", companySlug), author_id: memberIds[t.author], tag: t.tag, tag_class: t.tagClass, body: t.text }));
    const { error } = await sb.from("threads").insert(rows);
    if (error) throw error;
    n += rows.length;
  }
  console.log(`threads: ${n} inserted`);
}

async function seedPulseCalls(memberIds) {
  for (const p of PULSE_CALLS) {
    const { data, error } = await sb.from("pulse_calls").insert({
      company_id: id("company", p.company), call_date: p.date, cadence: p.cadence,
      news: p.news, need: p.need, lead: p.lead, challenge: p.challenge,
    }).select("id").single();
    if (error) throw error;
    await sb.from("pulse_call_attendees").insert(p.attendees.map(a => ({ pulse_call_id: data.id, member_id: memberIds[a] })));
  }
  console.log(`pulse_calls: ${PULSE_CALLS.length} inserted`);
}

async function seedFlowEvents() {
  const rows = FLOW_EVENTS.map(e => ({
    kind: e.kind, company_id: e.company ? id("company", e.company) : null, title: e.title,
    event_date: e.date, status: e.status, format: e.format, presenter: e.presenter, outcome: e.outcome || null,
  }));
  const { error } = await sb.from("flow_events").insert(rows);
  if (error) throw error;
  console.log(`flow_events: ${rows.length} inserted`);
}

async function seedEngineThreads(memberIds) {
  for (const t of ENGINE_THREADS) {
    const { data, error } = await sb.from("engine_threads").insert({ topic: t.topic, author_id: memberIds[t.author], body: t.text }).select("id").single();
    if (error) throw error;
    await sb.from("engine_thread_companies").insert(t.companies.map(c => ({ engine_thread_id: data.id, company_id: id("company", c) })));
  }
  console.log(`engine_threads: ${ENGINE_THREADS.length} inserted`);
}

async function seedLaasyDetail() {
  const laasyId = id("company", "laasy");

  await sb.from("valuation_methods").upsert(
    LAASY_VALUATION.methods.map(m => ({ company_id: laasyId, method_key: m.key, label: m.label, icon: m.icon, low: m.low, mid: m.mid, high: m.high, note: m.note })),
    { onConflict: "company_id,method_key" }
  );
  await sb.from("valuation_ceiling").upsert({ company_id: laasyId, label: LAASY_VALUATION.ceiling.label, value: LAASY_VALUATION.ceiling.value, note: LAASY_VALUATION.ceiling.note }, { onConflict: "company_id" });

  await sb.from("company_financials").upsert(
    LAASY_FINANCIALS.map(f => ({ company_id: laasyId, year: f.year, gmv: f.gmv, revenue: f.revenue, gross_profit: f.grossProfit, gross_margin: f.grossMargin, ebitda: f.ebitda, ebitda_margin: f.ebitdaMargin, note: f.note || null })),
    { onConflict: "company_id,year" }
  );

  await sb.from("company_wins").insert(LAASY_WINS.map(w => ({ company_id: laasyId, client: w.client, detail: w.detail, value: w.value, is_pilot: !!w.pilot, win_date: w.date })));
  await sb.from("company_challenges").insert(LAASY_CHALLENGES.map(c => ({ company_id: laasyId, title: c.title, detail: c.detail, severity: c.severity })));
  await sb.from("company_priorities").insert(LAASY_PRIORITIES.map(p => ({ company_id: laasyId, title: p.title, owner: p.owner, due_date: p.due, detail: p.detail, sort_order: p.sort })));

  const kpiRows = [
    ...LAASY_SNAPSHOT_KPIS.map(k => ({ company_id: laasyId, metric_key: k.key, label: k.label, value: k.value, unit: k.unit, period: null })),
    ...LAASY_MONTHLY_GMV.map(g => ({ company_id: laasyId, metric_key: "gmv_monthly", label: "Monthly GMV", value: g.value, unit: "usd", period: g.period })),
  ];
  await sb.from("company_kpis").insert(kpiRows);

  console.log("LaaSy detail: valuation methods, financials, wins, challenges, priorities, KPIs seeded");
}

async function main() {
  await upsertCompanies();
  const memberIds = await createMembers();
  await linkSponsorsAndAdvisors(memberIds);
  await seedRequests(memberIds);
  await seedThreads(memberIds);
  await seedPulseCalls(memberIds);
  await seedFlowEvents();
  await seedEngineThreads(memberIds);
  await seedLaasyDetail();
  console.log("\nSeed complete. Sign in as any @opportunityengines.dev member (or michaelb@acceleration-group.com) with password:");
  console.log(`  ${DEFAULT_PASSWORD}`);
  console.log("Rotate that password immediately, and invite real teammates instead of relying on the placeholder accounts.");
}

main().catch(err => { console.error(err); process.exit(1); });
