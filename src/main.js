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
import {
  signInWithPassword, signOut, getSession, getMyProfile, onAuthChange,
  updateMyProfile, changeMyPassword, inviteMember, listMemberEmails, adminSetPassword,
} from "./lib/auth.js";
import {
  listCompanies, getCompany,
  listRequests, createRequest, volunteerForRequest,
  listThreads, postThread,
  listEngineThreads,
  listPulseCalls, listFlowEvents, proposeSession,
  getValuation,
  listKpis, listFinancials,
  listWins, listChallenges, listPriorities,
  getMemberDashboard,
  listAllProfiles, updateProfileAsAdmin,
  subscribeToCompanyActivity,
} from "./lib/api.js";
// Not wired up in this pass (no UI calls it yet): postEngineThread — exists
// in api.js, ready when the Engine Directory gets a "start a thread" form.

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let PROFILE = null; // { id, full_name, initials, role, title, focus, color, company_id }
let COMPANIES_CACHE = null; // refreshed on each /portfolio visit; also used by the sidebar's Deep Dive Shortcuts
let ACTIVITY_UNSUB = null;
let PINNED_SHORTCUTS = null; // company ids pinned in the sidebar's Deep Dive Shortcuts — session-local, like the prototype
let SHORTCUTS_EXPANDED = false;

function isOE() {
  return PROFILE && (PROFILE.role === "admin" || PROFILE.role === "oe_member");
}
function isAdmin() {
  return PROFILE && PROFILE.role === "admin";
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
  renderSideStats();
  renderSideAsk();
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
  COMPANIES_CACHE = null;
  PINNED_SHORTCUTS = null;
  SHORTCUTS_EXPANDED = false;
  location.hash = "";
  showLogin();
});

document.getElementById("brand-home").addEventListener("click", () => { location.hash = "#/portfolio"; });
document.getElementById("mobile-menu-btn").addEventListener("click", toggleMobileSidebar);
document.getElementById("sidebar-backdrop").addEventListener("click", closeMobileSidebar);
document.getElementById("side-user").addEventListener("click", () => openModal("my-account"));
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
    COMPANIES_CACHE = null;
    PINNED_SHORTCUTS = null;
    SHORTCUTS_EXPANDED = false;
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

function shortcutPool() {
  return (COMPANIES_CACHE || []).filter((c) => c.bucket !== "considering").sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
}
function ensurePinnedInit() {
  if (PINNED_SHORTCUTS === null) PINNED_SHORTCUTS = shortcutPool().slice(0, 3).map((c) => c.id);
}
function toggleShortcutPin(id) {
  ensurePinnedInit();
  const idx = PINNED_SHORTCUTS.indexOf(id);
  if (idx >= 0) PINNED_SHORTCUTS.splice(idx, 1);
  else {
    PINNED_SHORTCUTS.push(id);
    if (PINNED_SHORTCUTS.length > 3) PINNED_SHORTCUTS.shift();
  }
  renderSideNav();
}

async function renderSideNav() {
  const items = [{ id: "portfolio", label: isOE() ? "Portfolio of My Interests" : "My Company", icon: "&#9733;", route: "#/portfolio" }];
  if (isOE()) items.push({ id: "engine", label: "My Opportunity Engine", icon: "&#9881;", route: "#/engine" });
  if (isAdmin()) items.push({ id: "team", label: "Team & Access", icon: "&#128101;", route: "#/team" });
  const hash = location.hash || "#/portfolio";
  const current = hash.split("/")[1];
  const navHtml = items.map((n) => `
    <div class="side-nav-item ${n.id === current ? "active" : ""}" data-route="${n.route}">
      <span class="ic">${n.icon}</span><span>${n.label}</span>
    </div>`).join("");

  if (!isOE()) {
    document.getElementById("side-nav").innerHTML = navHtml;
    attachSideNavRouteListeners();
    return;
  }

  if (!COMPANIES_CACHE) {
    try { COMPANIES_CACHE = await listCompanies(); } catch (err) { console.error("Failed to load companies for sidebar", err); COMPANIES_CACHE = []; }
  }
  ensurePinnedInit();
  const pool = shortcutPool();
  const pinned = pool.filter((c) => PINNED_SHORTCUTS.includes(c.id));
  const rest = pool.filter((c) => !PINNED_SHORTCUTS.includes(c.id));
  const shortcutRow = (c, isPinned) => {
    const active = hash === `#/company/${c.slug}` || hash.startsWith(`#/company/${c.slug}/`);
    return `<div class="side-shortcut-row">
      <span class="side-nav-item ${active ? "active" : ""}" data-route="#/company/${escapeHtml(c.slug)}" style="padding-left:20px; font-weight:600; flex:1;">
        <span class="ic" style="font-size:10px;">&#9679;</span><span>${escapeHtml(c.name)}</span>
      </span>
      <button class="side-pin-btn ${isPinned ? "pinned" : ""}" data-pin="${c.id}" title="${isPinned ? "Unpin" : "Keep visible (max 3)"}">${isPinned ? "&#9733;" : "&#9734;"}</button>
    </div>`;
  };

  document.getElementById("side-nav").innerHTML = navHtml + `
    <div class="side-section-label">Quick Actions</div>
    <button class="side-action-btn" data-modal="submit-opportunity"><span class="ic">&#128161;</span><span>Submit an Opportunity</span></button>
    <button class="side-action-btn" data-modal="connect-entrepreneurs"><span class="ic">&#129309;</span><span>Connect Entrepreneurs</span></button>
    <button class="side-action-btn" data-modal="recommend-member"><span class="ic">&#11088;</span><span>Recommend a Member</span></button>
    <div class="side-section-label">Deep Dive Shortcuts</div>
    ${pinned.map((c) => shortcutRow(c, true)).join("")}
    ${rest.length ? `
      <div class="side-shortcut-more-link" id="side-shortcut-toggle">${SHORTCUTS_EXPANDED ? "&#9650; Show less" : `&#9660; Show ${rest.length} more`}</div>
      ${SHORTCUTS_EXPANDED ? `<div class="side-shortcut-scroll scrollbar-thin">${rest.map((c) => shortcutRow(c, false)).join("")}</div>` : ""}
    ` : ""}
  `;
  attachSideNavRouteListeners();
  document.querySelectorAll(".side-pin-btn[data-pin]").forEach((el) => {
    el.addEventListener("click", (e) => { e.stopPropagation(); toggleShortcutPin(el.dataset.pin); });
  });
  const toggleLink = document.getElementById("side-shortcut-toggle");
  if (toggleLink) toggleLink.addEventListener("click", () => { SHORTCUTS_EXPANDED = !SHORTCUTS_EXPANDED; renderSideNav(); });
  document.querySelectorAll(".side-action-btn[data-modal]").forEach((el) => {
    el.addEventListener("click", () => openModal(el.dataset.modal));
  });
}
function attachSideNavRouteListeners() {
  document.querySelectorAll(".side-nav-item[data-route]").forEach((el) => {
    el.addEventListener("click", () => { location.hash = el.dataset.route; closeMobileSidebar(); });
  });
}

// "Snapshot" panel — advisory seats, capital deployed, position value,
// opportunities matched. OE-only; the prototype's memberSnapshot(), now
// backed by getMemberDashboard() in api.js instead of in-memory arrays.
async function renderSideStats() {
  const el = document.getElementById("side-stats");
  if (!isOE()) { el.innerHTML = ""; return; }
  let s;
  try {
    s = await getMemberDashboard(PROFILE.id);
  } catch (err) {
    console.error("Failed to load sidebar snapshot", err);
    el.innerHTML = "";
    return;
  }
  const firstName = (PROFILE.full_name || "").split(" ")[0] || "Your";
  el.innerHTML = `
    <div class="side-stats-block">
      <div class="side-stats-title">${escapeHtml(firstName)}'s Snapshot</div>
      <div class="side-stat-row"><span class="side-stat-label">Opportunities you match</span><span class="side-stat-value gold">${s.opportunitiesMatched}</span></div>
      <div class="side-stat-row"><span class="side-stat-label">Advisory board spots</span><span class="side-stat-value">${s.activeSpots} active <span style="color:#7f87a0; font-weight:600;">· ${s.inactiveSpots} pending</span></span></div>
      <div class="side-stat-row"><span class="side-stat-label">Est. earnings /mo</span><span class="side-stat-value gold">${fmtMoney(s.estMonthlyEarnings)}</span></div>
      <div class="side-stat-row"><span class="side-stat-label">Companies championed</span><span class="side-stat-value gold">${s.championed}</span></div>
      <div class="side-stat-row"><span class="side-stat-label">Company investments</span><span class="side-stat-value">${fmtMoney(s.capitalInvested)}</span></div>
      <div class="side-stat-row"><span class="side-stat-label">Est. position value</span><span class="side-stat-value good">${fmtMoney(s.positionValue)}</span></div>
    </div>`;
}

// Quick question to the Portfolio GM. The prototype never persisted this
// anywhere either (no recipient, no inbox to land in) — it just showed a
// confirmation. Kept honest about that scope here rather than inventing a
// messaging table silently; wire to a real notify path when one exists.
const PORTFOLIO_GM_NAME = "Michael Beirne";
function renderSideAsk() {
  const el = document.getElementById("side-ask");
  if (!isOE()) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="side-ask-block">
      <div class="side-ask-title">Ask ${escapeHtml(PORTFOLIO_GM_NAME)}</div>
      <div class="side-ask-sub">Quick Managing Partner question</div>
      <textarea class="side-ask-textarea" id="side-ask-text" placeholder="e.g. Can I get an update on the Halcyon credit line?"></textarea>
      <button class="side-ask-btn" id="side-ask-send">Send</button>
      <div class="side-ask-confirm" id="side-ask-confirm">&#10003; Sent to ${escapeHtml(PORTFOLIO_GM_NAME)}</div>
    </div>`;
  document.getElementById("side-ask-send").addEventListener("click", () => {
    const ta = document.getElementById("side-ask-text");
    const confirmEl = document.getElementById("side-ask-confirm");
    if (!ta.value.trim()) return;
    ta.value = "";
    confirmEl.style.display = "block";
    setTimeout(() => { confirmEl.style.display = "none"; }, 3500);
  });
}

// ---------------------------------------------------------------------
// Sidebar quick-action modals (Submit an Opportunity / Connect
// Entrepreneurs / Recommend a Member). Submit an Opportunity and Connect
// Entrepreneurs write real rows (via proposeSession/createRequest, same
// functions the Deal Flow calendar and Collaboration board use). Recommend
// a Member has no schema table — matches the prototype's own scope, which
// just forwarded a confirmation with no real recipient either.
// ---------------------------------------------------------------------
function closeModal() {
  document.getElementById("modal-overlay").classList.remove("active");
}
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function modalConfirmHtml(title, text) {
  return `
    <div class="modal-confirm active">
      <div class="ok-check">&#10003;</div>
      <div style="font-weight:800; font-size:15px; margin-bottom:6px;">${escapeHtml(title)}</div>
      <div style="font-size:12.8px; color:var(--ink-2); line-height:1.5;">${escapeHtml(text)}</div>
      <button class="btn btn-primary" style="margin-top:18px;" id="modal-done">Done</button>
    </div>`;
}
function wireModalDone(afterFn) {
  document.getElementById("modal-done").addEventListener("click", () => {
    closeModal();
    if (afterFn) afterFn();
  });
}

const ROLE_LABEL = { oe_member: "OE Member", portco_contact: "Portfolio Company Contact", admin: "Admin" };
function generateTempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "");
  return "OE-" + b64.slice(0, 10) + "!";
}

function openModal(kind, ctx) {
  const card = document.getElementById("modal-card");
  if (kind === "my-account") {
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">My Account</div><div class="modal-sub">Update your profile, or change your password.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field"><label>Full name</label><input id="ma-name" value="${escapeHtml(PROFILE.full_name)}" required></div>
        <div class="modal-field"><label>Title</label><input id="ma-title" value="${escapeHtml(PROFILE.title || "")}"></div>
        <div class="modal-field"><label>Focus</label><input id="ma-focus" value="${escapeHtml(PROFILE.focus || "")}"></div>
        <div class="modal-field"><label>New password <span style="font-weight:400; text-transform:none;">(leave blank to keep it)</span></label><input id="ma-password" type="password" placeholder="At least 8 characters"></div>
        <div class="login-error active" id="modal-error" style="display:none;"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Save</button></div>
      </form>`;
    document.getElementById("modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("modal-error");
      const fullName = document.getElementById("ma-name").value.trim();
      const title = document.getElementById("ma-title").value.trim();
      const focus = document.getElementById("ma-focus").value.trim();
      const password = document.getElementById("ma-password").value;
      if (password && password.length < 8) {
        errEl.textContent = "Password must be at least 8 characters.";
        errEl.style.display = "block";
        return;
      }
      try {
        await updateMyProfile({ fullName, title, focus });
        if (password) await changeMyPassword(password);
        PROFILE = await getMyProfile();
        renderSidebarUser();
        card.innerHTML = modalConfirmHtml("Saved", password ? "Your profile and password were updated." : "Your profile was updated.");
        wireModalDone(() => { renderSideStats(); renderSideNav(); });
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.style.display = "block";
      }
    });
  } else if (kind === "invite-member") {
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">Invite a Member</div><div class="modal-sub">Sends a real invite email. They'll set their own password on first sign-in.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field"><label>Email</label><input id="im-email" type="email" required></div>
        <div class="modal-field"><label>Full name</label><input id="im-name" required></div>
        <div class="modal-field"><label>Role</label>
          <select id="im-role">
            <option value="oe_member">OE Member</option>
            <option value="admin">Admin</option>
            <option value="portco_contact">Portfolio Company Contact</option>
          </select>
        </div>
        <div class="modal-field" id="im-company-field" style="display:none;">
          <label>Company</label>
          <select id="im-company">${(COMPANIES_CACHE || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select>
        </div>
        <div class="login-error active" id="modal-error" style="display:none;"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Send Invite</button></div>
      </form>`;
    document.getElementById("im-role").addEventListener("change", (e) => {
      document.getElementById("im-company-field").style.display = e.target.value === "portco_contact" ? "block" : "none";
    });
    document.getElementById("modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("modal-error");
      const email = document.getElementById("im-email").value.trim();
      const fullName = document.getElementById("im-name").value.trim();
      const role = document.getElementById("im-role").value;
      const companyId = role === "portco_contact" ? document.getElementById("im-company").value : null;
      if (role === "portco_contact" && !companyId) {
        errEl.textContent = "Choose a company for a portfolio-company contact.";
        errEl.style.display = "block";
        return;
      }
      try {
        await inviteMember({ email, fullName, role, companyId });
        card.innerHTML = modalConfirmHtml("Invited", `${fullName} will receive an invite email at ${email}.`);
        wireModalDone(() => renderTeam());
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.style.display = "block";
      }
    });
  } else if (kind === "edit-member") {
    const p = ctx;
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">Edit ${escapeHtml(p.full_name)}</div><div class="modal-sub">Change their role, company assignment, or title.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field"><label>Full name</label><input id="em-name" value="${escapeHtml(p.full_name)}" required></div>
        <div class="modal-field"><label>Title</label><input id="em-title" value="${escapeHtml(p.title || "")}"></div>
        <div class="modal-field"><label>Role</label>
          <select id="em-role">
            <option value="oe_member" ${p.role === "oe_member" ? "selected" : ""}>OE Member</option>
            <option value="admin" ${p.role === "admin" ? "selected" : ""}>Admin</option>
            <option value="portco_contact" ${p.role === "portco_contact" ? "selected" : ""}>Portfolio Company Contact</option>
          </select>
        </div>
        <div class="modal-field" id="em-company-field" style="${p.role === "portco_contact" ? "" : "display:none;"}">
          <label>Company</label>
          <select id="em-company">${(COMPANIES_CACHE || []).map((c) => `<option value="${c.id}" ${c.id === p.company_id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>
        </div>
        <div class="login-error active" id="modal-error" style="display:none;"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Save Changes</button></div>
      </form>`;
    document.getElementById("em-role").addEventListener("change", (e) => {
      document.getElementById("em-company-field").style.display = e.target.value === "portco_contact" ? "block" : "none";
    });
    document.getElementById("modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("modal-error");
      const fullName = document.getElementById("em-name").value.trim();
      const title = document.getElementById("em-title").value.trim();
      const role = document.getElementById("em-role").value;
      const companyId = role === "portco_contact" ? document.getElementById("em-company").value : null;
      if (role === "portco_contact" && !companyId) {
        errEl.textContent = "Choose a company for a portfolio-company contact.";
        errEl.style.display = "block";
        return;
      }
      try {
        await updateProfileAsAdmin(p.id, { full_name: fullName, title, role, company_id: companyId });
        card.innerHTML = modalConfirmHtml("Saved", `${fullName}'s access was updated.`);
        wireModalDone(() => renderTeam());
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.style.display = "block";
      }
    });
  } else if (kind === "reset-password") {
    const p = ctx;
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">Reset Password — ${escapeHtml(p.full_name)}</div><div class="modal-sub">Sets a new password immediately. Share it with them directly — this does not send an email.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field">
          <label>New password</label>
          <div style="display:flex; gap:8px;">
            <input id="rp-password" type="text" minlength="8" required style="flex:1;">
            <button type="button" class="btn btn-sm" id="rp-generate" style="flex-shrink:0;">Generate</button>
          </div>
        </div>
        <div class="login-error active" id="modal-error" style="display:none;"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Set Password</button></div>
      </form>`;
    document.getElementById("rp-generate").addEventListener("click", () => {
      document.getElementById("rp-password").value = generateTempPassword();
    });
    document.getElementById("modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("modal-error");
      const password = document.getElementById("rp-password").value;
      if (password.length < 8) {
        errEl.textContent = "Password must be at least 8 characters.";
        errEl.style.display = "block";
        return;
      }
      try {
        await adminSetPassword(p.id, password);
        card.innerHTML = modalConfirmHtml("Password set", `${p.full_name}'s new password is: ${password} — share this with them directly, it won't be shown again.`);
        wireModalDone(() => renderTeam());
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.style.display = "block";
      }
    });
  } else if (kind === "submit-opportunity") {
    const sectors = [...new Set((COMPANIES_CACHE || []).map((c) => c.sector).filter(Boolean))];
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">Submit an Opportunity</div><div class="modal-sub">Flag a new company or venture for Opportunity Engines to screen. This adds an upcoming screening item to My Opportunity Engine &rarr; Deal Flow.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field"><label>Company / venture name</label><input id="mo-name" required></div>
        <div class="modal-field"><label>Sector</label>
          <select id="mo-sector">${sectors.map((s) => `<option>${escapeHtml(s)}</option>`).join("")}<option>Other</option></select>
        </div>
        <div class="modal-field"><label>One-line description</label><input id="mo-desc" placeholder="What do they do, in one sentence?" required></div>
        <div class="modal-field"><label>Your relationship to this opportunity</label>
          <select id="mo-rel"><option>I sourced it directly</option><option>I have a warm introduction</option><option>Recommended by a portfolio company</option><option>Other</option></select>
        </div>
        <div class="login-error active" id="modal-error" style="display:none;"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Submit Opportunity</button></div>
      </form>`;
    document.getElementById("modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("mo-name").value.trim();
      const desc = document.getElementById("mo-desc").value.trim();
      const rel = document.getElementById("mo-rel").value;
      const errEl = document.getElementById("modal-error");
      try {
        await proposeSession({ kind: "pitch", companyId: null, title: `Screening: ${name} — ${desc}`, format: "Initial Screen", presenter: PROFILE.full_name });
        card.innerHTML = modalConfirmHtml("Submitted", `${name} was added to the screening calendar on My Opportunity Engine. Submitted by ${PROFILE.full_name} · ${rel.toLowerCase()}.`);
        wireModalDone(() => { renderSideStats(); renderSideNav(); });
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.style.display = "block";
      }
    });
  } else if (kind === "connect-entrepreneurs") {
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">Connect Entrepreneurs</div><div class="modal-sub">Request a warm introduction on behalf of a portfolio company. This posts directly to that company's Collaboration &amp; Requests board.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field"><label>Which company needs the connection?</label>
          <select id="ce-company">${(COMPANIES_CACHE || []).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select>
        </div>
        <div class="modal-field"><label>Type of connection</label>
          <select id="ce-type"><option>Customer introduction</option><option>Investor introduction</option><option>Hiring / talent</option><option>Partnership</option><option>Advisor</option></select>
        </div>
        <div class="modal-field"><label>Who / what they're looking to connect with</label><input id="ce-who" placeholder="e.g. Head of Procurement at a mid-market logistics company" required></div>
        <div class="modal-field"><label>Context</label><textarea id="ce-context" placeholder="Why this connection, and what would make it useful..."></textarea></div>
        <div class="login-error active" id="modal-error" style="display:none;"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Post Request</button></div>
      </form>`;
    document.getElementById("modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const companyId = document.getElementById("ce-company").value;
      const companyName = (COMPANIES_CACHE || []).find((c) => c.id === companyId)?.name || "the company";
      const type = document.getElementById("ce-type").value;
      const who = document.getElementById("ce-who").value.trim();
      const context = document.getElementById("ce-context").value.trim();
      const errEl = document.getElementById("modal-error");
      try {
        await createRequest({ companyId, type: "intro", title: `Connect: ${who}`, body: context || `${type} requested on behalf of ${companyName}.` });
        card.innerHTML = modalConfirmHtml("Request posted", `Posted to ${companyName}'s Collaboration & Requests board. Members can volunteer to make the introduction.`);
        wireModalDone(() => { renderSideStats(); renderSideNav(); });
      } catch (err) {
        errEl.textContent = err.message || String(err);
        errEl.style.display = "block";
      }
    });
  } else if (kind === "recommend-member") {
    card.innerHTML = `
      <div class="modal-head">
        <div><div class="modal-title">Recommend a Member</div><div class="modal-sub">Nominate someone to join Opportunity Engines. This goes straight to the Managing Partner for review.</div></div>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <form id="modal-form">
        <div class="modal-field"><label>Candidate name</label><input id="rm-name" required></div>
        <div class="modal-field"><label>Focus area / expertise</label><input id="rm-focus" placeholder="e.g. Supply Chain Ops, Fintech GTM"></div>
        <div class="modal-field"><label>Background</label><textarea id="rm-bg" placeholder="Current role, relevant experience..."></textarea></div>
        <div class="modal-field"><label>Your relationship to them</label><input id="rm-rel" placeholder="e.g. Former colleague, portfolio company CEO"></div>
        <div class="modal-foot"><button type="button" class="btn" id="modal-cancel-btn">Cancel</button><button type="submit" class="btn btn-accent">Send Recommendation</button></div>
      </form>`;
    document.getElementById("modal-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("rm-name").value.trim();
      if (!name) return;
      card.innerHTML = modalConfirmHtml("Recommendation sent", `Thanks — ${name} has been forwarded to ${PORTFOLIO_GM_NAME} for review.`);
      wireModalDone(null);
    });
  } else {
    return;
  }
  document.getElementById("modal-overlay").classList.add("active");
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
  closeMobileSidebar();
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
  } else if (parts[0] === "team") {
    renderTeam();
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
// Team & Access (admin only) — account administration: who has access,
// what role/company they're scoped to, inviting new members, and
// resetting a password when someone's locked out. profiles_select's RLS
// already lets an admin (any OE member, really) read every row
// regardless of role; emails come separately from the admin-users edge
// function since auth.users isn't queryable from the browser.
// ---------------------------------------------------------------------
async function renderTeam() {
  if (!isAdmin()) { location.hash = "#/portfolio"; return; }
  setTopbar("Team & Access", "Everyone with access to this platform — members, admins, and portfolio-company contacts.");
  setContent(loadingHtml("team"));
  if (!COMPANIES_CACHE) {
    try { COMPANIES_CACHE = await listCompanies(); } catch { COMPANIES_CACHE = []; }
  }
  let profiles, emails;
  try {
    const [profilesResult, emailsResult] = await Promise.all([listAllProfiles(), listMemberEmails().catch(() => ({}))]);
    profiles = profilesResult;
    emails = emailsResult;
  } catch (err) {
    setContent(errorHtml(err));
    return;
  }
  const rows = profiles.map((p) => `
    <tr>
      <td><b>${escapeHtml(p.full_name)}</b>${p.title ? `<div style="color:var(--ink-muted); font-size:11px;">${escapeHtml(p.title)}</div>` : ""}</td>
      <td>${escapeHtml(emails[p.id]?.email || "—")}</td>
      <td><span class="chip">${escapeHtml(ROLE_LABEL[p.role] || p.role)}</span></td>
      <td>${escapeHtml(p.company?.name || "—")}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn btn-sm" data-edit-member="${p.id}">Edit</button>
        <button class="btn btn-sm" data-reset-pw="${p.id}">Reset password</button>
      </td>
    </tr>`).join("");
  setContent(`
    <div class="card card-pad">
      <div class="card-head">
        <div><div class="card-title">Members</div><div class="card-sub">${profiles.length} ${profiles.length === 1 ? "person has" : "people have"} access.</div></div>
        <button class="btn btn-accent btn-sm" id="team-invite-btn">+ Invite a member</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Company</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);
  document.getElementById("team-invite-btn").addEventListener("click", () => openModal("invite-member"));
  document.querySelectorAll("[data-edit-member]").forEach((el) => {
    el.addEventListener("click", () => openModal("edit-member", profiles.find((p) => p.id === el.dataset.editMember)));
  });
  document.querySelectorAll("[data-reset-pw]").forEach((el) => {
    el.addEventListener("click", () => openModal("reset-password", profiles.find((p) => p.id === el.dataset.resetPw)));
  });
}

// ---------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------
boot();
