// Opportunity Engines — live app bootstrap, router, and render functions.
// This replaces the HTML prototype's in-memory-array rendering with real
// async calls into api.js, backed by the live Supabase project. Scope of
// this pass: real auth, Portfolio grid, Company Deep Dive (Overview /
// Operations / Valuation / Priorities / Collaboration / Deal Room), and
// My Opportunity Engine (Flow / Pulse / Directory) — everything that has
// a real table behind it. LaaSy's narrative-only content from the original
// mock (team bios, board, product-line take-rates, unit economics, buyer
// universe, federal-validation quotes) has no schema table yet — it's
// intentionally left out of this port rather than hard-coded back in; see
// README "What's NOT in here yet" for the follow-up decision this needs.
import { signInWithPassword, signOut, getSession, getMyProfile, onAuthChange } from "./lib/auth.js";
import {
  listCompanies, getCompany,
  listRequests, createRequest, volunteerForRequest,
  listThreads, postThread,
  listEngineThreads,
  listPulseCalls, listFlowEvents,
  getValuation,
  listKpis, listFinancials,
  listWins, listChallenges, listPriorities,
  subscribeToCompanyActivity,
} from "./lib/api.js";
// Not wired up in this pass (no UI calls them yet): postEngineThread,
// proposeSession. Both exist in api.js, ready when that UI gets built.

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let PROFILE = null; // { id, full_name, initials, role, title, focus, color, company_id }
let COMPANIES_CACHE = null; // refreshed on each /portfolio visit
let ACTIVITY_UNSUB = null;

function isOE() {
  return PROFILE && (PROFILE.role === "admin" || PROFILE.role === "oe_member");
}

// ---------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------
function fmtMoney(n, opts) {
  opts = opts || {};
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  let out;
  if (abs >= 1_000_000_000) out = "$" + (n / 1_000_000_000).toFixed(opts.decimals ?? 2) + "B";
  else if (abs >= 1_000_000) out = "$" + (n / 1_000_000).toFixed(opts.decimals ?? 1) + "M";
  else if (abs >= 1_000) out = "$" + (n / 1_000).toFixed(opts.decimals ?? 0) + "K";
  else out = "$" + Number(n).toFixed(0);
  return out;
}
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}
const BUCKET_PILL = { considering: "pill-considering", invested: "pill-invested", advising: "pill-advising" };
const BUCKET_LABEL = { considering: "Considering", invested: "Invested", advising: "Advising" };

// ---------------------------------------------------------------------
// Boot / auth
// ---------------------------------------------------------------------
let BOOTING = false;
async function boot() {
  if (BOOTING) return;
  BOOTING = true;
  try {
    const session = await getSession();
    if (!session) {
      showLogin();
      return;
    }
    try {
      PROFILE = await getMyProfile();
    } catch (err) {
      console.error("Failed to load profile", err);
      showLogin("Signed in, but couldn't load your profile. Contact an admin.");
      await signOut();
      return;
    }
    showApp();
  } finally {
    BOOTING = false;
  }
}

function showLogin(message) {
  document.getElementById("app").classList.remove("active");
  document.getElementById("login-screen").style.display = "flex";
  const err = document.getElementById("login-error");
  if (message) {
    err.textContent = message;
    err.classList.add("active");
  } else {
    err.classList.remove("active");
  }
}

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").classList.add("active");
  renderSidebarUser();
  renderSideNav();
  route();
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  const btn = document.getElementById("login-submit");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    await signInWithPassword(email, pass);
    await boot();
  } catch (err) {
    document.getElementById("login-error").textContent = err.message || "Sign-in failed.";
    document.getElementById("login-error").classList.add("active");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

document.getElementById("logout-link").addEventListener("click", async () => {
  if (ACTIVITY_UNSUB) { ACTIVITY_UNSUB(); ACTIVITY_UNSUB = null; }
  await signOut();
  PROFILE = null;
  location.hash = "";
  showLogin();
});

document.getElementById("brand-home").addEventListener("click", () => { location.hash = "#/portfolio"; });
document.getElementById("mobile-menu-btn").addEventListener("click", toggleMobileSidebar);
document.getElementById("sidebar-backdrop").addEventListener("click", closeMobileSidebar);
function toggleMobileSidebar() {
  document.querySelector(".sidebar").classList.toggle("mobile-open");
  document.getElementById("sidebar-backdrop").classList.toggle("active");
}
function closeMobileSidebar() {
  document.querySelector(".sidebar").classList.remove("mobile-open");
  document.getElementById("sidebar-backdrop").classList.remove("active");
}

onAuthChange((session) => {
  // Handles a magic-link/OAuth redirect landing us here already signed
  // in (session present, PROFILE not loaded yet) and cross-tab sign-out
  // (session gone, PROFILE was loaded). The BOOTING guard in boot()
  // absorbs the redundant fire this causes alongside the explicit
  // boot() call at the bottom of this file on a normal page load.
  if (session && !PROFILE) {
    boot();
  } else if (!session && PROFILE) {
    PROFILE = null;
    showLogin();
  }
});

// ---------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------
function renderSidebarUser() {
  const initials = PROFILE.initials || initialsOf(PROFILE.full_name);
  document.getElementById("side-user").innerHTML = `
    <div class="avatar">${escapeHtml(initials)}</div>
    <div>
      <div class="side-user-name">${escapeHtml(PROFILE.full_name)}</div>
      <div class="side-user-role">${escapeHtml(PROFILE.title || (isOE() ? "OE Member" : "Portfolio Company"))}</div>
    </div>`;
  document.getElementById("topbar-avatar").textContent = initials;
}

function renderSideNav() {
  const items = [{ id: "portfolio", label: isOE() ? "Portfolio of My Interests" : "My Company", icon: "&#9733;", route: "#/portfolio" }];
  if (isOE()) items.push({ id: "engine", label: "My Opportunity Engine", icon: "&#9881;", route: "#/engine" });
  const current = (location.hash || "#/portfolio").split("/")[1];
  document.getElementById("side-nav").innerHTML = items.map((n) => `
    <div class="side-nav-item ${n.id === current ? "active" : ""}" data-route="${n.route}">
      <span class="ic">${n.icon}</span><span>${n.label}</span>
    </div>`).join("");
  document.querySelectorAll(".side-nav-item[data-route]").forEach((el) => {
    el.addEventListener("click", () => { location.hash = el.dataset.route; closeMobileSidebar(); });
  });
}

// ---------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------
window.addEventListener("hashchange", route);

function route() {
  if (!PROFILE) return;
  if (ACTIVITY_UNSUB) { ACTIVITY_UNSUB(); ACTIVITY_UNSUB = null; }
  renderSideNav();
  const hash = location.hash || "#/portfolio";
  const parts = hash.replace(/^#\//, "").split("/");
  if (parts[0] === "company" && parts[1]) {
    renderDeepDive(parts[1], parts[2] || "overview");
  } else if (parts[0] === "engine") {
    renderEngine(parts[1] || "flow");
  } else {
    renderPortfolio();
  }
}

function setTopbar(title, sub) {
  document.getElementById("topbar-title").textContent = title;
  document.getElementById("topbar-sub").textContent = sub;
}
function setContent(html) {
  document.getElementById("content").innerHTML = html;
}
function loadingHtml(label) {
  return `<div class="loading-note">Loading ${escapeHtml(label || "")}…</div>`;
}
function errorHtml(err) {
  return `<div class="error-note">Couldn't load this — ${escapeHtml(err.message || String(err))}</div>`;
}

// ---------------------------------------------------------------------
// Portfolio grid
// ---------------------------------------------------------------------
async function renderPortfolio() {
  setTopbar(
    isOE() ? "Portfolio of My Interests" : "My Company",
    isOE() ? "Every opportunity relevant to you that Opportunity Engines is invested in, advising, or considering." : "Your company's page in the Opportunity Engines platform."
  );
  setContent(loadingHtml("portfolio"));
  try {
    COMPANIES_CACHE = await listCompanies();
  } catch (err) {
    setContent(errorHtml(err));
    return;
  }
  if (!COMPANIES_CACHE.length) {
    setContent(`<div class="empty-note">No companies visible to your account yet.</div>`);
    return;
  }
  const cards = COMPANIES_CACHE.map((c) => {
    const stars = Array.from({ length: 5 }, (_, i) => `<span class="star ${i < (c.relevance || 0) ? "on" : ""}">&#9733;</span>`).join("");
    return `
    <div class="company-card" data-slug="${escapeHtml(c.slug)}">
      <div class="co-top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="co-logo" style="background:${escapeHtml(c.logo_color || "var(--navy-900)")}">${escapeHtml(c.short_code || "")}</div>
          <div>
            <div class="co-name">${escapeHtml(c.name)}</div>
            <div class="co-sector">${escapeHtml(c.sector || "")}</div>
          </div>
        </div>
        <span class="pill ${BUCKET_PILL[c.bucket] || ""}">${BUCKET_LABEL[c.bucket] || c.bucket}</span>
      </div>
      <div class="stars">${stars}</div>
      <div class="co-metrics">
        <div><div class="co-metric-label">Stage</div><div class="co-metric-value">${escapeHtml(c.stage || "—")}</div></div>
        <div><div class="co-metric-label">Current Mark</div><div class="co-metric-value">${fmtMoney(c.current_mark_mid)}</div></div>
      </div>
      ${c.top_factors && c.top_factors.length ? `<div class="co-top3"><b>Top factor:</b> ${escapeHtml(c.top_factors[0])}</div>` : ""}
      <div class="chip-row">${(c.tags || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>
    </div>`;
  }).join("");
  setContent(`<div class="company-grid">${cards}</div>`);
  document.querySelectorAll(".company-card[data-slug]").forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/company/${el.dataset.slug}`; });
  });
}

// ---------------------------------------------------------------------
// Company Deep Dive
// ---------------------------------------------------------------------
const DD_TABS_OE = [
  { id: "overview", label: "Overview" },
  { id: "ops", label: "Operations" },
  { id: "valuation", label: "Valuation" },
  { id: "priorities", label: "Priorities" },
  { id: "collab", label: "Collaboration" },
  { id: "dealroom", label: "Deal Room" },
];
const DD_TABS_PORTCO = [
  { id: "overview", label: "Overview" },
  { id: "ops", label: "Operations" },
  { id: "priorities", label: "Priorities" },
  { id: "collab", label: "Collaboration" },
  { id: "dealroom", label: "Deal Room" },
];

async function renderDeepDive(slug, tab) {
  setTopbar("Loading…", "");
  setContent(loadingHtml("company"));
  let c;
  try {
    c = await getCompany(slug);
  } catch (err) {
    setContent(errorHtml(err));
    return;
  }
  setTopbar(c.name, c.one_liner || "");
  const tabs = isOE() ? DD_TABS_OE : DD_TABS_PORTCO;
  const validTab = tabs.find((t) => t.id === tab) ? tab : "overview";

  const header = `
    <div class="back-link" id="dd-back">&larr; Back to ${isOE() ? "Portfolio" : "My Company"}</div>
    <div class="co-header">
      <div class="co-header-logo" style="background:${escapeHtml(c.logo_color || "var(--navy-900)")}">${escapeHtml(c.short_code || "")}</div>
      <div>
        <div class="co-header-name">${escapeHtml(c.name)}</div>
        <div class="co-header-tag">${escapeHtml(c.sector || "")} · ${escapeHtml(c.stage || "")}</div>
      </div>
      <div class="co-header-right"><span class="pill ${BUCKET_PILL[c.bucket] || ""}">${BUCKET_LABEL[c.bucket] || c.bucket}</span></div>
    </div>
    <div class="tabs">${tabs.map((t) => `<div class="tab-btn ${t.id === validTab ? "active" : ""}" data-tab="${t.id}">${t.label}</div>`).join("")}</div>
    <div id="dd-body"></div>`;
  setContent(header);
  document.getElementById("dd-back").addEventListener("click", () => { location.hash = "#/portfolio"; });
  document.querySelectorAll(".tab-btn[data-tab]").forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/company/${slug}/${el.dataset.tab}`; });
  });

  const body = document.getElementById("dd-body");
  body.innerHTML = loadingHtml(validTab);
  try {
    if (validTab === "overview") await renderDDOverview(body, c);
    else if (validTab === "ops") await renderDDOps(body, c);
    else if (validTab === "valuation") await renderDDValuation(body, c);
    else if (validTab === "priorities") await renderDDPriorities(body, c);
    else if (validTab === "collab") await renderDDCollab(body, c);
    else if (validTab === "dealroom") await renderDDDealroom(body, c);
  } catch (err) {
    body.innerHTML = errorHtml(err);
    return;
  }

  // Realtime: re-render the current tab when this company's live tables change.
  ACTIVITY_UNSUB = subscribeToCompanyActivity(c.id, () => route());
}

async function renderDDOverview(body, c) {
  const [kpis, wins, challenges] = await Promise.all([
    listKpis(c.id).catch(() => []),
    listWins(c.id).catch(() => []),
    listChallenges(c.id).catch(() => []),
  ]);
  const snapshotKpis = kpis.filter((k) => !k.period);
  const kpiRow = snapshotKpis.length
    ? `<div class="kpi-row">${snapshotKpis.map((k) => `
        <div class="kpi-tile">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value">${k.unit === "usd" ? fmtMoney(k.value) : Number(k.value).toLocaleString()}</div>
        </div>`).join("")}</div>`
    : "";
  const winsHtml = wins.length
    ? wins.slice(0, 8).map((w) => `
      <div class="thread-item">
        <div class="avatar-sm" style="background:linear-gradient(135deg,var(--good),var(--navy-700));">$</div>
        <div class="thread-body">
          <div class="thread-head"><span class="thread-name">${escapeHtml(w.client)}</span>${w.is_pilot ? '<span class="pill pill-considering">Pilot</span>' : ""}<span class="thread-time">${fmtDate(w.win_date)}</span></div>
          <div class="thread-text">${escapeHtml(w.detail || "")}${w.value ? ` — ${fmtMoney(w.value)}` : ""}</div>
        </div>
      </div>`).join("")
    : `<div class="empty-note">No wins logged yet.</div>`;
  const challengesHtml = challenges.length
    ? challenges.map((ch) => `
      <div class="thread-item">
        <span class="pill pill-${ch.severity}">${ch.severity}</span>
        <div class="thread-body">
          <div class="thread-head"><span class="thread-name">${escapeHtml(ch.title)}</span></div>
          <div class="thread-text">${escapeHtml(ch.detail || "")}</div>
        </div>
      </div>`).join("")
    : `<div class="empty-note">No open challenges.</div>`;

  body.innerHTML = `
    ${kpiRow}
    <div class="grid-2">
      <div class="card card-pad">
        <div class="card-head"><div class="card-title">Recent Wins</div></div>
        ${winsHtml}
      </div>
      <div class="card card-pad">
        <div class="card-head"><div class="card-title">Open Challenges</div></div>
        ${challengesHtml}
      </div>
    </div>
    ${c.top_factors && c.top_factors.length ? `
    <div class="card card-pad" style="margin-top:16px;">
      <div class="card-head"><div class="card-title">Top Factors</div></div>
      <ul style="margin:0; padding-left:18px; font-size:13px; color:var(--ink-2); line-height:1.7;">
        ${c.top_factors.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
      </ul>
    </div>` : ""}`;
}

async function renderDDOps(body, c) {
  const financials = await listFinancials(c.id).catch(() => []);
  if (!financials.length) {
    body.innerHTML = `<div class="empty-note">No financials on record yet.</div>`;
    return;
  }
  const rows = financials.map((f) => `
    <tr>
      <td>${escapeHtml(f.year)}</td>
      <td class="tabular">${f.gmv != null ? fmtMoney(f.gmv * 1_000_000) : "—"}</td>
      <td class="tabular">${f.revenue != null ? fmtMoney(f.revenue * 1_000_000) : "—"}</td>
      <td class="tabular">${f.gross_margin != null ? f.gross_margin.toFixed(1) + "%" : "—"}</td>
      <td class="tabular">${f.ebitda != null ? fmtMoney(f.ebitda * 1_000_000) : "—"}</td>
      <td class="tabular">${f.ebitda_margin != null ? f.ebitda_margin.toFixed(1) + "%" : "—"}</td>
    </tr>`).join("");
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-head"><div class="card-title">Financials</div><div class="card-sub">GMV / revenue in $M</div></div>
      <table class="data-table">
        <thead><tr><th>Year</th><th>GMV</th><th>Revenue</th><th>Gross Margin</th><th>EBITDA</th><th>EBITDA Margin</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function renderDDValuation(body, c) {
  const { methods, ceiling } = await getValuation(c.id);
  if (!methods.length) {
    body.innerHTML = `<div class="empty-note">No valuation methods on record for this company.</div>`;
    return;
  }
  const cards = methods.map((m) => {
    const span = m.high - m.low || 1;
    const midPct = ((m.mid - m.low) / span) * 100;
    return `
    <div class="val-method-card">
      <div class="val-method-title">${m.icon ? `<span>${m.icon}</span>` : ""}${escapeHtml(m.label)}</div>
      <div class="val-method-range">${fmtMoney(m.low)} – ${fmtMoney(m.high)}</div>
      <div class="val-bar-track"><div class="val-bar-fill" style="left:0; width:100%; background:var(--surface-2);"></div><div class="val-bar-marker" style="left:${midPct}%;"></div></div>
      <div class="co-sector">Mid: ${fmtMoney(m.mid)}</div>
      ${m.note ? `<div class="co-top3" style="margin-top:8px;">${escapeHtml(m.note)}</div>` : ""}
    </div>`;
  }).join("");
  body.innerHTML = `
    <div class="grid-3">${cards}</div>
    ${ceiling ? `
    <div class="card card-pad" style="margin-top:16px;">
      <div class="card-head"><div class="card-title">${escapeHtml(ceiling.label)}</div></div>
      <div class="kpi-value">${fmtMoney(ceiling.value)}</div>
      ${ceiling.note ? `<div class="co-top3" style="margin-top:8px;">${escapeHtml(ceiling.note)}</div>` : ""}
    </div>` : ""}`;
}

async function renderDDPriorities(body, c) {
  const priorities = await listPriorities(c.id).catch(() => []);
  body.innerHTML = priorities.length
    ? `<div class="card card-pad">${priorities.map((p) => `
        <div class="thread-item">
          <div class="thread-body">
            <div class="thread-head"><span class="thread-name">${escapeHtml(p.title)}</span>${p.due_date ? `<span class="thread-time">Due ${fmtDate(p.due_date)}</span>` : ""}</div>
            <div class="thread-text">${escapeHtml(p.detail || "")}</div>
            ${p.owner ? `<div class="co-sector" style="margin-top:4px;">Owner: ${escapeHtml(p.owner)}</div>` : ""}
          </div>
        </div>`).join("")}</div>`
    : `<div class="empty-note">No priorities logged yet.</div>`;
}

async function renderDDCollab(body, c) {
  const requests = await listRequests(c.id).catch(() => []);
  const cards = requests.map((r) => `
    <div class="req-card">
      <div class="req-top">
        <div class="req-title">${escapeHtml(r.title)}</div>
        <span class="pill ${r.status === "open" ? "pill-considering" : r.status === "closed" ? "pill-passed" : "pill-gold"}">${escapeHtml(r.status)}</span>
      </div>
      <div class="req-meta">${escapeHtml(r.type)} · posted ${fmtDateTime(r.created_at)}</div>
      <div class="req-body">${escapeHtml(r.body || "")}</div>
      <div class="req-foot">
        <div class="chip-row">${(r.volunteers || []).map((v) => `<span class="chip">${escapeHtml(v.member?.full_name || "member")}</span>`).join("") || '<span class="co-sector">No volunteers yet</span>'}</div>
        <button class="btn btn-sm" data-volunteer="${r.id}">Volunteer</button>
      </div>
    </div>`).join("");
  body.innerHTML = `
    <div class="card card-pad" style="margin-bottom:16px;">
      <div class="card-head"><div class="card-title">Post a request</div></div>
      <form id="new-request-form">
        <div class="modal-field"><label>Title</label><input required name="title"></div>
        <div class="modal-field"><label>Type</label>
          <select name="type">
            <option value="intro">Introduction</option>
            <option value="feedback">Feedback</option>
            <option value="rnd">R&D Idea</option>
            <option value="management">Management Challenge</option>
            <option value="capital">Capital / Fundraising</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="modal-field"><label>Details</label><textarea name="body"></textarea></div>
        <button class="btn btn-accent" type="submit">Post request</button>
      </form>
    </div>
    ${cards || `<div class="empty-note">No open requests.</div>`}`;
  document.getElementById("new-request-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await createRequest({ companyId: c.id, type: fd.get("type"), title: fd.get("title"), body: fd.get("body") });
    await renderDDCollab(body, c);
  });
  body.querySelectorAll("[data-volunteer]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await volunteerForRequest(btn.dataset.volunteer);
      await renderDDCollab(body, c);
    });
  });
}

async function renderDDDealroom(body, c) {
  const threads = await listThreads(c.id).catch(() => []);
  const items = threads.map((t) => `
    <div class="thread-item">
      <div class="avatar-sm">${escapeHtml(t.author?.initials || initialsOf(t.author?.full_name))}</div>
      <div class="thread-body">
        <div class="thread-head">
          <span class="thread-name">${escapeHtml(t.author?.full_name || "Unknown")}</span>
          ${t.tag ? `<span class="pill ${escapeHtml(t.tag_class || "pill-considering")}">${escapeHtml(t.tag)}</span>` : ""}
          <span class="thread-time">${fmtDateTime(t.created_at)}</span>
        </div>
        <div class="thread-text">${escapeHtml(t.body)}</div>
      </div>
    </div>`).join("");
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-head"><div class="card-title">Deal Room</div></div>
      ${items || `<div class="empty-note">No notes yet.</div>`}
      <div class="comment-input">
        <textarea id="new-thread-body" placeholder="Add a note…"></textarea>
        <button class="btn btn-accent" id="new-thread-submit">Post</button>
      </div>
    </div>`;
  document.getElementById("new-thread-submit").addEventListener("click", async () => {
    const ta = document.getElementById("new-thread-body");
    if (!ta.value.trim()) return;
    await postThread({ companyId: c.id, body: ta.value.trim() });
    await renderDDDealroom(body, c);
  });
}

// ---------------------------------------------------------------------
// My Opportunity Engine (OE-only: flow calendar, pulse calls, directory)
// ---------------------------------------------------------------------
const ENGINE_TABS = [
  { id: "flow", label: "Deal Flow" },
  { id: "pulse", label: "Pulse Calls" },
  { id: "directory", label: "Engine Directory" },
];

async function renderEngine(tab) {
  if (!isOE()) { location.hash = "#/portfolio"; return; }
  setTopbar("My Opportunity Engine", "Cross-portfolio deal flow, pulse calls, and internal discussion.");
  const validTab = ENGINE_TABS.find((t) => t.id === tab) ? tab : "flow";
  setContent(`
    <div class="tabs">${ENGINE_TABS.map((t) => `<div class="tab-btn ${t.id === validTab ? "active" : ""}" data-etab="${t.id}">${t.label}</div>`).join("")}</div>
    <div id="engine-body">${loadingHtml(validTab)}</div>`);
  document.querySelectorAll(".tab-btn[data-etab]").forEach((el) => {
    el.addEventListener("click", () => { location.hash = `#/engine/${el.dataset.etab}`; });
  });
  const body = document.getElementById("engine-body");
  try {
    if (validTab === "flow") await renderEngineFlow(body);
    else if (validTab === "pulse") await renderEnginePulse(body);
    else await renderEngineDirectory(body);
  } catch (err) {
    body.innerHTML = errorHtml(err);
  }
}

async function renderEngineFlow(body) {
  const events = await listFlowEvents().catch(() => []);
  const rows = events.map((e) => `
    <tr>
      <td>${fmtDate(e.event_date)}</td>
      <td>${escapeHtml(e.title)}</td>
      <td>${escapeHtml(e.company?.name || "—")}</td>
      <td><span class="pill ${e.status === "upcoming" ? "pill-considering" : "pill-passed"}">${escapeHtml(e.status)}</span></td>
      <td>${escapeHtml(e.outcome || e.format || "")}</td>
    </tr>`).join("");
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-head"><div class="card-title">Deal Flow Calendar</div></div>
      <table class="data-table">
        <thead><tr><th>Date</th><th>Title</th><th>Company</th><th>Status</th><th>Outcome / Format</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty-note">No flow events yet.</td></tr>'}</tbody>
      </table>
    </div>`;
}

async function renderEnginePulse(body) {
  const calls = await listPulseCalls().catch(() => []);
  const items = calls.map((p) => `
    <div class="thread-item">
      <div class="thread-body">
        <div class="thread-head"><span class="thread-name">${escapeHtml(p.company?.name || "")}</span><span class="thread-time">${fmtDate(p.call_date)} · ${escapeHtml(p.cadence || "")}</span></div>
        <div class="thread-text"><b>News:</b> ${escapeHtml(p.news || "—")}</div>
        <div class="thread-text"><b>Need:</b> ${escapeHtml(p.need || "—")}</div>
        <div class="thread-text"><b>Challenge:</b> ${escapeHtml(p.challenge || "—")}</div>
        <div class="chip-row" style="margin-top:6px;">${(p.attendees || []).map((a) => `<span class="chip">${escapeHtml(a.member?.full_name || "")}</span>`).join("")}</div>
      </div>
    </div>`).join("");
  body.innerHTML = `<div class="card card-pad"><div class="card-head"><div class="card-title">Pulse Calls</div></div>${items || `<div class="empty-note">No pulse calls logged.</div>`}</div>`;
}

async function renderEngineDirectory(body) {
  const threads = await listEngineThreads().catch(() => []);
  const items = threads.map((t) => `
    <div class="thread-item">
      <div class="avatar-sm">${escapeHtml(t.author?.initials || initialsOf(t.author?.full_name))}</div>
      <div class="thread-body">
        <div class="thread-head"><span class="thread-name">${escapeHtml(t.topic)}</span><span class="thread-time">${fmtDateTime(t.created_at)}</span></div>
        <div class="thread-text">${escapeHtml(t.body)}</div>
        <div class="chip-row" style="margin-top:6px;">${(t.companies || []).map((cc) => `<span class="chip">${escapeHtml(cc.company?.name || "")}</span>`).join("")}</div>
      </div>
    </div>`).join("");
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-head"><div class="card-title">Engine Directory</div><div class="card-sub">Internal cross-portfolio discussion — never visible to portfolio-company contacts.</div></div>
      ${items || `<div class="empty-note">No engine discussion yet.</div>`}
    </div>`;
}

// ---------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------
boot();
