// Display labels only: database ids, stored codes and QR payloads stay unchanged.
window.ConcertlyCodes = {
  concert(id) {
    const value = String(id ?? "").replace(/^c/i, "");
    return /^\d+$/.test(value) ? `C${value.padStart(2, "0")}` : "CONCERT";
  },
  order(order) {
    return `#CT-${this.concert(order.concert_id ?? order.concertId)}-${order.order_number ?? String(order.id).replace(/^#CT-/, "")}`;
  },
  ticket(ticket) {
    return `${this.concert(ticket.concert_id ?? ticket.concertId)} · ${ticket.ticket_code ?? ticket.ticketCode ?? ticket.id}`;
  },
};

window.ConcertlyBooking = {
  maxTickets: 6,
  holdMilliseconds: 5 * 60 * 1000,
  itemLabel(item) {
    const zone = item.zone_name ?? item.zone ?? "";
    if (item.booking_type === "standing" || item.bookingType === "standing") return `${zone} · Standing`;
    return `${zone} · Row ${item.row_label ?? item.row} · Seat ${item.seat_number}`;
  },
  validQuantity(value) {
    return Number.isInteger(value) && value >= 1 && value <= this.maxTickets;
  },
  buyerError(buyer) {
    if (!buyer || buyer.full_name.trim().length < 2 || buyer.full_name.trim().length > 150)
      return "Please enter your full name (2–150 characters).";
    if (buyer.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email))
      return "Please enter a valid email address.";
    if (!/^\+?[0-9 ()-]+$/.test(buyer.phone) || !/^\d{8,15}$/.test(buyer.phone.replace(/\D/g, "")))
      return "Please enter a phone number with 8–15 digits.";
    return "";
  },
};
