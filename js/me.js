// Shared helpers for the account pages (pages/me/*). Data comes from the backend through
// ConcertlyAPI (js/api.js must be loaded first); nothing is read from mock data or
// localStorage purchases.

const LOGIN_URL = new URL("../auth/login.html", window.location.href);

function redirectToLogin() {
  LOGIN_URL.searchParams.set("redirect", window.location.pathname + window.location.search);
  window.location.replace(LOGIN_URL.href);
}

if (!window.ConcertlyAPI || !ConcertlyAPI.hasToken()) {
  redirectToLogin();
} else {
  document.documentElement.classList.add("customer-session");
}

/* ---- Formatters ---- */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${weekday}, ${date} · ${time}`;
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---- Server data -> display ---- */
function orderCode(order) {
  return ConcertlyCodes.order(order);
}

function concertLocation(item) {
  return [item.venue, item.city].filter(Boolean).join(", ");
}

function seatLabel(ticket) {
  if (ticket.booking_type === "standing") return `${ticket.zone} — Standing (no assigned seat)`;
  return `${ticket.zone} — Row ${ticket.row} — Seat ${ticket.seat_number}`;
}

function seatCode(ticket) {
  if (ticket.booking_type === "standing") return "Standing";
  return `${ticket.row}${ticket.seat_number}`;
}

/* A cancelled order that was paid has been refunded (mock gateway, full refund). */
function orderDisplayStatus(order) {
  return order.refund_status === "refunded" ? "refunded" : order.status;
}

const PAYMENT_METHODS = {
  card: "Credit / debit card",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

/* ---- Status label/class maps ---- */
const TICKET_STATUS_MAP = {
  valid:     { label: "Valid",     cls: "badge--ok" },
  used:      { label: "Used",      cls: "badge--info" },
  cancelled: { label: "Cancelled", cls: "badge--bad" },
  refunded:  { label: "Refunded",  cls: "badge--off" },
};

const ORDER_STATUS_MAP = {
  pending:   { label: "Pending Payment", cls: "badge--warn" },
  paid:      { label: "Paid",            cls: "badge--ok" },
  failed:    { label: "Payment Failed",  cls: "badge--bad" },
  cancelled: { label: "Cancelled",       cls: "badge--bad" },
  refunded:  { label: "Refunded",        cls: "badge--off" },
};

function statusBadge(map, key) {
  const status = map[key] || { label: key, cls: "badge--neutral" };
  return `<span class="badge ${status.cls}">${escapeHtml(status.label)}</span>`;
}

/* ---- Loading / errors ---- */
function loadingHTML(message = "Loading…") {
  return `<div class="empty"><p>${escapeHtml(message)}</p></div>`;
}

/* Turns an API error into a message; a 401 means the session ended, so go to login. */
function apiErrorMessage(error) {
  if (error.status === 401) {
    ConcertlyAPI.clearSession();
    redirectToLogin();
    return "Your session has expired. Redirecting to sign in…";
  }
  if (error.code === "network") return "Cannot reach the Concertly server. Please try again later.";
  return error.message || "Something went wrong. Please try again.";
}

function errorHTML(error, retryLabel = "Try again") {
  return `<div class="empty empty--detail">
    <h3>Couldn't load your data</h3>
    <p>${escapeHtml(apiErrorMessage(error))}</p>
    <button class="btn btn--primary" type="button" onclick="window.location.reload()">${escapeHtml(retryLabel)}</button>
  </div>`;
}

/* ---- Actions ---- */
/* Cancels on the server. Returns the updated order, or null if not cancelled. */
async function cancelOrder(order) {
  const wasPaid = order.payment_status === "paid";
  const confirmation = wasPaid
    ? `Cancel ${orderCode(order)}? A full refund of ${formatCurrency(order.total_amount)} will be processed.`
    : `Cancel ${orderCode(order)}? This order has not been paid.`;
  if (!window.confirm(confirmation)) return null;
  try {
    return await ConcertlyAPI.cancelOrder(order.id);
  } catch (error) {
    window.alert(apiErrorMessage(error));
    return null;
  }
}
