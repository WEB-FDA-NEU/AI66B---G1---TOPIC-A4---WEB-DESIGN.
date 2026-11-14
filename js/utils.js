// js/utils.js
// Shared helpers and XSS protection (Task #52) for rendering concert data across pages.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.escapeHtml = escapeHtml;

const STATUS_BADGE_CLASS = {
  "Draft": "badge-gray",
  "Upcoming": "badge-amber",
  "On Sale": "badge-green",
  "Sold Out": "badge-red",
  "Ended": "badge-gray",
  "Cancelled": "badge-red"
};

function badgeClassFor(status) {
  return STATUS_BADGE_CLASS[status] || "badge-gray";
}

function getConcertStatus(concert, now = new Date()) {
  if (concert.adminStatus) return concert.adminStatus;
  if (concert.cancelled) return "Cancelled";
  if (concert.published === false) return "Draft";

  const concertDate = new Date(`${concert.date}T${concert.time}`);
  if (concertDate < now) return "Ended";

  if (concert.saleStart && new Date(concert.saleStart) > now) return "Upcoming";

  const tickets = concert.tickets || [];
  if (tickets.length > 0 && tickets.every(ticket => ticket.status === "Sold Out")) {
    return "Sold Out";
  }

  return "On Sale";
}

function formatDateTime(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}`);
  const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sortedByDate(concerts) {
  return [...concerts].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
}
