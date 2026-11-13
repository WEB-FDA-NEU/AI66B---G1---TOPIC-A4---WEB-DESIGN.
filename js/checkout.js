function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// Keep the existing local purchase archive; account pages use the server as their source.
function saveServerOrderLocally(order, data, paymentName) {
	const orderId = `#CT-${order.order_number}`;
	const customer = localStorage.getItem("concertlyUser") || "Guest";
	const tickets = order.tickets.map((ticket, index) => ({
		id: `CT${order.order_number}-${index + 1}`,
		serverTicketId: ticket.id,
		ticketCode: ticket.ticket_code,
		concertId: data.concertId,
		seat: ConcertlyBooking.itemLabel(ticket),
		type: ticket.zone,
		orderId,
		status: "valid",
		customer,
	}));
	saveConcertlyPurchase(
		{
			id: orderId,
			serverOrderId: order.id,
			concertId: data.concertId,
			orderedAt: order.created_at,
			status: "paid",
			customer,
			paymentMethod: { name: paymentName, sub: "Payment completed" },
			tickets: tickets.map((ticket, index) => ({
				id: ticket.id,
				seat: ticket.seat,
				type: ticket.type,
				price: order.tickets[index].price,
			})),
			fees: 0,
			discount: 0,
		},
		tickets,
	);
}

document.addEventListener("DOMContentLoaded", () => {
  const rules = window.ConcertlyBooking;
  const api = window.ConcertlyAPI;
  const form = document.getElementById("checkout-form");
  const confirmBtn = document.getElementById("confirm-payment");
  const feedback = document.getElementById("checkout-feedback");
  const timer = document.getElementById("checkout-timer");
  const retry = document.getElementById("retry-reservation");
  let data;
  let deadline = 0;
  let tick;
  let busy = false;
  let completed = false;
  let expired = false;
  let ready = false;

  function message(text) {
    feedback.textContent = text;
    feedback.hidden = !text;
  }
  function expire() {
    if (completed || expired) return;
    expired = true;
    clearInterval(tick);
    confirmBtn.disabled = true;
    localStorage.removeItem("checkoutData");
    // Release is best effort; do not block navigation on a network request.
    if (data?.reservationId && api) api.release(data.reservationId).catch(() => {});
    window.location.replace("session-expired.html");
  }
  try {
    data = JSON.parse(localStorage.getItem("checkoutData"));
  } catch {
    expire();
    return;
  }
  if (!data || !rules.validQuantity(data.quantity) || !data.ticket || !data.concertId) {
    expire();
    return;
  }
  const serverMode = Boolean(data.reservationId);
  const price = Number(String(data.ticket.price).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(price) || price < 0) {
    expire();
    return;
  }
  // Old mock checkouts have no expiry: upgrade once, then persist it across reloads.
  if (!serverMode && !data.expiresAt) {
    data.expiresAt = new Date(Date.now() + rules.holdMilliseconds).toISOString();
    localStorage.setItem("checkoutData", JSON.stringify(data));
  }
  deadline = Date.parse(data.expiresAt);
  if (!Number.isFinite(deadline)) {
    expire();
    return;
  }

  const banner = document.createElement("img");
  banner.src = data.banner || "";
  banner.alt = data.concertTitle || "Concert";
  document.getElementById("concert-banner").replaceChildren(banner);
  document.getElementById("concert-info").innerHTML = `
    <h3>${escapeHtml(data.concertTitle)}</h3>
    <p>${escapeHtml(data.artist)}</p>
    <div class="event-meta"><p>${escapeHtml(data.date)} · ${escapeHtml(data.time)}</p>
      <p>${escapeHtml(data.location)}</p></div>
    <hr><p>Ticket: <strong>${escapeHtml(data.ticket.type)}</strong></p>
    <p>Quantity: ${data.quantity} (maximum ${rules.maxTickets})</p>
    <div id="held-items"></div>`;

  function renderHeldItems(items) {
    const standing = new Map();
    const seated = [];
    for (const item of items) {
      const zone = item.zone_name ?? item.zone;
      if (item.booking_type === "standing") {
        const key = `${zone}::${item.price}`;
        const group = standing.get(key) || { zone, price: item.price, quantity: 0 };
        group.quantity++;
        standing.set(key, group);
      } else {
        const label = item.row_label != null || item.row != null
          ? rules.itemLabel(item) : `${zone} · ${item.label || "Seat"}`;
        seated.push(`<li>${escapeHtml(label)} · $${Number(item.price).toLocaleString("en-US")}</li>`);
      }
    }
    document.getElementById("held-items").innerHTML = `<ul>${seated.join("")}${[...standing.values()].map(g => `<li>${escapeHtml(g.zone)} · Standing · Quantity: ${g.quantity} · $${Number(g.price).toLocaleString("en-US")} each</li>`).join("")}</ul>`;
  }
  if (serverMode) renderHeldItems(data.seats || []);

  function renderSummary(total) {
    document.getElementById("payment-summary").innerHTML = `
      <div class="checkout-row"><span>Tickets (${data.quantity})</span><strong>$${Number(total).toLocaleString("en-US")}</strong></div>
      <div class="checkout-row"><span>Total</span><strong>$${Number(total).toLocaleString("en-US")}</strong></div>`;
  }
  renderSummary(serverMode ? Number(String(data.total).replace(/[^\d.]/g, "")) : price * data.quantity);
  document.getElementById("mock-checkout-notice").hidden = serverMode;
  document.getElementById("buyer-name").value = localStorage.getItem("concertlyUser") || "";

  function renderTimer() {
    if (completed || expired || (serverMode && !ready)) return;
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    timer.textContent = `${serverMode ? "Seats held" : "Demo session"}: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    timer.classList.toggle("urgent", left <= 60);
    // Let an in-flight payment finish: the server decides validity under lock.
    if (left === 0 && !busy) expire();
  }
  async function syncReservation() {
    if (busy || completed || expired) return;
    ready = false;
    confirmBtn.disabled = true;
    retry.hidden = true;
    message("");
    try {
      const hold = await api.getReservation(data.reservationId);
      if (hold.status !== "active" || hold.seconds_left <= 0) return expire();
      if (!rules.validQuantity(hold.seats.length) || hold.concert_id !== api.numericId(data.concertId)) return expire();
      data.quantity = hold.seats.length;
      renderHeldItems(hold.seats);
      deadline = Date.now() + Math.min(hold.seconds_left * 1000, rules.holdMilliseconds);
      renderSummary(hold.total_amount);
      ready = true;
      confirmBtn.disabled = false;
      renderTimer();
    } catch (error) {
      if ([404, 410].includes(error.status)) return expire();
      message(error.status === 401 ? "Your session has expired. Sign in again before paying." : error.message);
      retry.hidden = false;
    }
  }
  retry.addEventListener("click", syncReservation);
  if (serverMode) {
    if (!api) {
      message("The booking client is unavailable. Reload this page to retry.");
    } else syncReservation();
  } else {
    // A saved timestamp must never grant a mock checkout more than five minutes.
    deadline = Math.min(deadline, Date.now() + rules.holdMilliseconds);
    ready = true;
    confirmBtn.disabled = false;
  }
  tick = setInterval(renderTimer, 1000);
  if (!serverMode) renderTimer();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || completed || expired || !ready) return;
    if (Date.now() >= deadline) return expire();
    const buyer = {
      full_name: document.getElementById("buyer-name").value.trim(),
      email: document.getElementById("buyer-email").value.trim(),
      phone: document.getElementById("buyer-phone").value.trim(),
    };
    const error = rules.buyerError(buyer);
    if (error) { message(error); return; }
    if (!form.reportValidity()) return;
    const method = document.getElementById("payment-method");
    if (!["card", "ewallet", "bank_transfer"].includes(method.value)) {
      message("Please select a payment method.");
      return;
    }
    busy = true;
    confirmBtn.disabled = true;
    message("");
    try {
      if (serverMode) {
        const order = await api.checkout(data.reservationId, method.value, buyer);
        completed = true;
        clearInterval(tick);
        // Failure to write the optional local archive must not hide a paid server order.
        try { saveServerOrderLocally(order, data, method.options[method.selectedIndex].text); } catch {}
        localStorage.removeItem("checkoutData");
        window.location.href = `../me/order-detail.html?id=${encodeURIComponent(order.id)}`;
      } else {
        if (!rules.validQuantity(data.quantity) || Date.now() >= deadline) {
          busy = false;
          return expire();
        }
        const orderId = createConcertlyOrderId();
        const customer = localStorage.getItem("concertlyUser") || "Guest";
        const tickets = Array.from({ length: data.quantity }, (_, index) => ({
          id: `${orderId.slice(1)}-${index + 1}`, concertId: data.concertId,
          seat: "Not assigned (demo)", type: data.ticket.type, orderId,
          status: "demo", customer, price,
        }));
        const order = {
          id: orderId, concertId: data.concertId, orderedAt: new Date().toISOString(),
          status: "demo", customer, buyer,
          paymentMethod: { name: method.options[method.selectedIndex].text, sub: "Demo only" },
          tickets, fees: 0, discount: 0,
        };
        saveConcertlyPurchase(order, tickets);
        completed = true;
        clearInterval(tick);
        localStorage.removeItem("checkoutData");
        timer.textContent = "Demo completed";
        document.getElementById("checkout-result").hidden = false;
        document.getElementById("checkout-result").innerHTML = `
          <h2>Demo order saved</h2><p>${escapeHtml(ConcertlyCodes.order(order))}</p>
          <p>${escapeHtml(data.concertTitle)} · ${data.quantity} tickets · $${price * data.quantity}</p>
          <p>This local demo does not reserve real seats or issue admission QR codes.</p>
          <ul>${tickets.map(t => `<li>${escapeHtml(ConcertlyCodes.ticket(t))}</li>`).join("")}</ul>
          <a class="btn btn-primary" href="../concerts/index.html">Back to concerts</a>`;
        document.getElementById("checkout-result").focus();
      }
    } catch (error) {
      if (["reservation_expired", "seat_unavailable", "standing_unavailable"].includes(error.code)) {
        busy = false;
        return expire();
      }
      message(error.message || "Payment could not be completed. Please try again.");
    } finally {
      busy = false;
      confirmBtn.disabled = completed || expired || !ready;
      if (!completed) renderTimer();
    }
  });
});
