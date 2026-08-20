// Data-access layer — every read/write the app needs, backed by
// Supabase instead of the in-memory arrays the HTML prototype used.
// RLS (see supabase/002_rls.sql) enforces access control server-side;
// this file does not need to re-check roles, it just issues queries —
// a portco contact calling listCompanies() simply gets one row back,
// not because the client filtered anything, but because Postgres did.
import { supabase } from "./supabaseClient.js";

// ---------------------------------------------------------------------
// Companies / portfolio
// ---------------------------------------------------------------------
export async function listCompanies() {
  const { data, error } = await supabase.from("companies").select("*, sponsor:sponsor_id(id,full_name,initials,color)").order("name");
  if (error) throw error;
  return data;
}
export async function getCompany(slug) {
  const { data, error } = await supabase.from("companies").select("*, sponsor:sponsor_id(id,full_name,initials,color)").eq("slug", slug).single();
  if (error) throw error;
  return data;
}
export async function listMyAllocations(memberId) {
  const { data, error } = await supabase.from("allocations").select("*, company:company_id(*)").eq("member_id", memberId);
  if (error) throw error;
  return data;
}

// Sidebar "snapshot" panel (OE members only) — advisory seats, companies
// championed, capital deployed/position value, and a portfolio-wide
// "opportunities you match" count. Mirrors the HTML prototype's
// memberSnapshot()/opportunitiesMatchedCount(), just backed by real
// queries instead of in-memory arrays. Every table read here is OE/admin
// -visible for every row (see 002_rls.sql: company_advisors_select,
// allocations_select_oe), so filtering to "mine" happens client-side by
// member_id/sponsor_id, same pattern as getMyProfile().
const ADVISOR_SEAT_MONTHLY = 1500;
export async function getMemberDashboard(memberId) {
  const [
    { data: advisorRows, error: e1 },
    { count: championed, error: e2 },
    { data: allocRows, error: e3 },
    { count: consideringCount, error: e4 },
    { count: openRequestsCount, error: e5 },
    { count: upcomingEventsCount, error: e6 },
  ] = await Promise.all([
    supabase.from("company_advisors").select("company:company_id(bucket)").eq("member_id", memberId),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("sponsor_id", memberId),
    supabase.from("allocations").select("amount, company:company_id(last_round_valuation, current_mark_mid)").eq("member_id", memberId),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("bucket", "considering"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("flow_events").select("id", { count: "exact", head: true }).eq("status", "upcoming"),
  ]);
  for (const e of [e1, e2, e3, e4, e5, e6]) if (e) throw e;

  const activeSpots = advisorRows.filter((r) => r.company?.bucket !== "considering").length;
  const inactiveSpots = advisorRows.filter((r) => r.company?.bucket === "considering").length;
  const capitalInvested = allocRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const positionValue = allocRows.reduce((s, r) => {
    const valuation = Number(r.company?.last_round_valuation || 0);
    const mark = Number(r.company?.current_mark_mid || 0);
    if (!valuation) return s;
    return s + (Number(r.amount || 0) / valuation) * mark;
  }, 0);

  return {
    activeSpots, inactiveSpots,
    championed: championed || 0,
    capitalInvested, positionValue,
    estMonthlyEarnings: activeSpots * ADVISOR_SEAT_MONTHLY,
    opportunitiesMatched: (consideringCount || 0) + (openRequestsCount || 0) + (upcomingEventsCount || 0),
  };
}

// ---------------------------------------------------------------------
// Collaboration board
// ---------------------------------------------------------------------
export async function listRequests(companyId) {
  const { data, error } = await supabase
    .from("requests")
    .select("*, volunteers:request_volunteers(member_id, member:member_id(full_name,initials,color))")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function createRequest({ companyId, type, title, body }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("requests").insert({ company_id: companyId, type, title, body, posted_by: user?.id || null }).select().single();
  if (error) throw error;
  return data;
}
export async function volunteerForRequest(requestId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("request_volunteers").insert({ request_id: requestId, member_id: user.id });
  if (error) throw error;
  await supabase.from("requests").update({ status: "in-progress" }).eq("id", requestId).eq("status", "open");
}

// ---------------------------------------------------------------------
// Threads (deal room notes + cross-portfolio Engine discussion)
// ---------------------------------------------------------------------
export async function listThreads(companyId) {
  const { data, error } = await supabase
    .from("threads")
    .select("*, author:author_id(full_name,initials,color)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function postThread({ companyId, body, tag = "Note", tagClass = "pill-considering" }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("threads").insert({ company_id: companyId, body, tag, tag_class: tagClass, author_id: user?.id || null });
  if (error) throw error;
}
export async function listEngineThreads() {
  const { data, error } = await supabase
    .from("engine_threads")
    .select("*, author:author_id(full_name,initials,color), companies:engine_thread_companies(company:company_id(id,name,slug))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function postEngineThread({ topic, body }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("engine_threads").insert({ topic, body, author_id: user?.id || null });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Pulse calls / deal flow
// ---------------------------------------------------------------------
export async function listPulseCalls(companyId) {
  const q = supabase.from("pulse_calls").select("*, company:company_id(name,slug), attendees:pulse_call_attendees(member:member_id(full_name,initials,color))").order("call_date", { ascending: false });
  const { data, error } = await (companyId ? q.eq("company_id", companyId) : q);
  if (error) throw error;
  return data;
}
export async function listFlowEvents(status) {
  const q = supabase.from("flow_events").select("*, company:company_id(name,slug)").order("event_date", { ascending: status === "past" });
  const { data, error } = await (status ? q.eq("status", status) : q);
  if (error) throw error;
  return data;
}
export async function proposeSession({ kind, companyId, title, format, presenter }) {
  const { error } = await supabase.from("flow_events").insert({ kind, company_id: companyId || null, title, format, presenter, event_date: new Date().toISOString().slice(0, 10), status: "upcoming" });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Valuation (OE-internal only — RLS blocks portco reads entirely)
// ---------------------------------------------------------------------
export async function getValuation(companyId) {
  const [{ data: methods, error: e1 }, { data: ceiling, error: e2 }] = await Promise.all([
    supabase.from("valuation_methods").select("*").eq("company_id", companyId),
    supabase.from("valuation_ceiling").select("*").eq("company_id", companyId).maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { methods, ceiling };
}

// ---------------------------------------------------------------------
// Operations & KPIs / financials / wins / challenges / priorities —
// the portfolio-company portal writes here, scoped to its own company
// by RLS regardless of what companyId a client sends.
// ---------------------------------------------------------------------
export async function listKpis(companyId, metricKey) {
  const q = supabase.from("company_kpis").select("*").eq("company_id", companyId).order("period", { ascending: true });
  const { data, error } = await (metricKey ? q.eq("metric_key", metricKey) : q);
  if (error) throw error;
  return data;
}
export async function upsertKpi({ id, companyId, metricKey, label, value, unit, period, note }) {
  const { error } = await supabase.from("company_kpis").upsert({ id, company_id: companyId, metric_key: metricKey, label, value, unit, period: period || null, note });
  if (error) throw error;
}
export async function listFinancials(companyId) {
  const { data, error } = await supabase.from("company_financials").select("*").eq("company_id", companyId).order("year");
  if (error) throw error;
  return data;
}
export async function upsertFinancials(row) {
  const { error } = await supabase.from("company_financials").upsert(row, { onConflict: "company_id,year" });
  if (error) throw error;
}
export async function listWins(companyId) {
  const { data, error } = await supabase.from("company_wins").select("*").eq("company_id", companyId).order("win_date", { ascending: false });
  if (error) throw error;
  return data;
}
export async function addWin({ companyId, client, detail, value, isPilot, winDate }) {
  const { error } = await supabase.from("company_wins").insert({ company_id: companyId, client, detail, value, is_pilot: isPilot, win_date: winDate });
  if (error) throw error;
}
export async function listChallenges(companyId, { includeResolved = false } = {}) {
  const q = supabase.from("company_challenges").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  const { data, error } = await (includeResolved ? q : q.eq("resolved", false));
  if (error) throw error;
  return data;
}
export async function upsertChallenge(row) {
  const { error } = await supabase.from("company_challenges").upsert(row);
  if (error) throw error;
}
export async function resolveChallenge(id) {
  const { error } = await supabase.from("company_challenges").update({ resolved: true }).eq("id", id);
  if (error) throw error;
}
export async function listPriorities(companyId) {
  const { data, error } = await supabase.from("company_priorities").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data;
}
export async function upsertPriority(row) {
  const { error } = await supabase.from("company_priorities").upsert(row);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Documents (Deal Room) — metadata in Postgres, bytes in Storage.
// ---------------------------------------------------------------------
export async function listDocuments(companyId) {
  const { data, error } = await supabase.from("documents").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function uploadDocument({ companyId, file, isRestricted = false, ownerLabel }) {
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${companyId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("deal-room-docs").upload(path, file);
  if (upErr) throw upErr;
  const { error } = await supabase.from("documents").insert({
    company_id: companyId, name: file.name, doc_type: file.name.split(".").pop(),
    storage_path: path, size_bytes: file.size, is_restricted: isRestricted, owner_label: ownerLabel, uploaded_by: user.id,
  });
  if (error) throw error;
}
export async function getDocumentUrl(storagePath) {
  const { data, error } = await supabase.storage.from("deal-room-docs").createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------
// Team & Access (admin only) — the member directory behind "add other
// members/users" / "manage access". profiles_select's RLS lets an
// OE/admin caller see every row regardless of role (see 002_rls.sql),
// so this is a plain select; emails come separately from the
// admin-users edge function (auth.admin.listMemberEmails() in auth.js)
// since auth.users isn't queryable from the browser.
// ---------------------------------------------------------------------
export async function listAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*, company:company_id(id,name,slug)").order("full_name");
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Members Lounge — a single member's full profile plus their investment/
// advisory track record and recent Engine Directory activity. Same
// profiles_select RLS as everything above (any OE/admin can read any
// non-portco profile), so no new policies needed for the profile row
// itself; allocations/company_advisors are already OE/admin-readable for
// any member (see 002_rls.sql's allocations_select_oe/
// company_advisors_select), not just the caller's own.
// ---------------------------------------------------------------------
export async function getMemberProfile(id) {
  const { data, error } = await supabase.from("profiles").select("*, company:company_id(id,name,slug)").eq("id", id).single();
  if (error) throw error;
  return data;
}

// Companies this member has capital allocated to — the "invested in"
// half of their track record.
export async function listMemberAllocations(memberId) {
  const { data, error } = await supabase
    .from("allocations")
    .select("*, company:company_id(id,name,slug,logo_color,short_code,sector,bucket)")
    .eq("member_id", memberId)
    .order("amount", { ascending: false });
  if (error) throw error;
  return data;
}

// Companies this member advises/sits on the board of — the "served on
// the board of" half.
export async function listMemberAdvisories(memberId) {
  const { data, error } = await supabase
    .from("company_advisors")
    .select("*, company:company_id(id,name,slug,logo_color,short_code,sector,bucket)")
    .eq("member_id", memberId);
  if (error) throw error;
  return data;
}

// Recent Engine Directory posts by this member — evidence of how they
// weigh in on opportunities presented to the group, shown on their
// profile rather than duplicating a posting UI there.
export async function listMemberEngineThreads(memberId, limit = 5) {
  const { data, error } = await supabase
    .from("engine_threads")
    .select("id, topic, body, created_at")
    .eq("author_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Admin editing someone else's role/company/title — allowed by
// profiles_update_admin (using private.is_admin(), no with-check, so any
// column can change). Self-service edits go through updateMyProfile()
// in auth.js instead, which is scoped to auth.uid() server-side.
export async function updateProfileAsAdmin(id, patch) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// Lightweight member list for @mention matching — works for a portco
// contact too (they'll just see OE/admin rows plus their own, per
// profiles_select's RLS), not just admins.
export async function listMentionableMembers() {
  const { data, error } = await supabase.from("profiles").select("id, full_name, initials, color, role").order("full_name");
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Notifications — @mentions and "someone volunteered for your request".
// Created client-side right after a successful post/volunteer (see
// notifyMentions()/the volunteer handler in main.js), not by a DB
// trigger — see 003_community.sql for why (and for the RLS: any OE/admin
// can create a notification FOR someone else, but only the recipient can
// read or mark their own as read).
// ---------------------------------------------------------------------
export async function createNotification({ recipientId, actorId, type, companyId, message, link }) {
  if (!recipientId || recipientId === actorId) return; // never notify yourself
  const { error } = await supabase.from("notifications").insert({
    recipient_id: recipientId, actor_id: actorId, type, company_id: companyId || null, message, link: link || null,
  });
  if (error) throw error;
}
export async function listMyNotifications(limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*, actor:actor_id(full_name,initials,color)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
export async function countUnreadNotifications() {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
  if (error) throw error;
  return count || 0;
}
export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}
export async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("notifications").update({ read: true }).eq("recipient_id", user.id).eq("read", false);
  if (error) throw error;
}
export function subscribeToMyNotifications(userId, onChange) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------------------------------------------------------------------
// Moderation — delete your own post, or (admin) anyone's. Nothing could
// be removed before this: 002_rls.sql never defined a delete policy for
// any of these tables, so RLS silently denied every delete.
// ---------------------------------------------------------------------
export async function deleteThread(id) {
  const { error } = await supabase.from("threads").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteRequest(id) {
  const { error } = await supabase.from("requests").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteEngineThread(id) {
  const { error } = await supabase.from("engine_threads").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Realtime — subscribe once per company/table pair; call the returned
// unsubscribe() on route change / unmount. This is what makes two
// members' browsers actually converge, which a static JS array never could.
// ---------------------------------------------------------------------
export function subscribeToCompanyActivity(companyId, onChange) {
  const channel = supabase
    .channel(`company-${companyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "requests", filter: `company_id=eq.${companyId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "threads", filter: `company_id=eq.${companyId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "company_challenges", filter: `company_id=eq.${companyId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "company_kpis", filter: `company_id=eq.${companyId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
