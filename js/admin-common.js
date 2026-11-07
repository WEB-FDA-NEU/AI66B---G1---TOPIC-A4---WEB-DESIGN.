// Shared helpers for admin pages backed by the API (dashboard, check-in).
// Requires js/api.js. js/admin-guard.js already redirects visitors without an admin session.

function adminEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function adminMoney(amount, digits = 0) {
  return `$${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function adminDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function adminDateTime(iso) {
  const d = new Date(iso);
  return `${adminDate(iso)} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function adminTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const CONCERT_STATUS_LABEL = {
  draft: ["Draft", "badge-gray"],
  on_sale: ["On Sale", "badge-green"],
  sold_out: ["Sold Out", "badge-red"],
  cancelled: ["Cancelled", "badge-red"],
  completed: ["Ended", "badge-gray"],
};

function adminConcertBadge(status) {
  const [label, cls] = CONCERT_STATUS_LABEL[status] || [status, "badge-gray"];
  return `<span class="badge ${cls}">${adminEscape(label)}</span>`;
}

function adminLoginRedirect() {
  const login = new URL("../auth/login.html", window.location.href);
  login.searchParams.set("redirect", window.location.pathname);
  window.location.replace(login.href);
}

/* Message for a failed API call. 401 ends the session; 403 means not an admin. */
function adminApiError(error) {
  if (error.status === 401) {
    ConcertlyAPI.clearSession();
    adminLoginRedirect();
    return "Your session has expired. Redirecting to sign in…";
  }
  if (error.status === 403) return "You do not have permission to view this data. Sign in with an admin account.";
  if (error.code === "network") return "Cannot reach the Concertly server. Please try again later.";
  return error.message || "Something went wrong. Please try again.";
}
