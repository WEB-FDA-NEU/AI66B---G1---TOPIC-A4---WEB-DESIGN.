// js/admin/utils.js
// Small shared helpers for rendering MOCK_CONCERTS across the admin pages.

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
  if (concert.cancelled) return "Cancelled";
  if (!concert.published) return "Draft";

  const concertDate = new Date(`${concert.date}T${concert.time}`);
  if (concertDate < now) return "Ended";

  if (concert.saleStart && new Date(concert.saleStart) > now) return "Upcoming";

  const tickets = concert.tickets || [];
  if (tickets.length > 0 && tickets.every(ticket => ticket.status === "Sold Out")) {
    return "Sold Out";
  }

  return "On Sale";
}

// "2026-11-20", "20:00" -> "Nov 20, 2026 · 8:00 PM"
function formatDateTime(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}`);
  const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

// "2026-11-20" -> "Nov 20, 2026"
function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sortedByDate(concerts) {
  return [...concerts].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
}
