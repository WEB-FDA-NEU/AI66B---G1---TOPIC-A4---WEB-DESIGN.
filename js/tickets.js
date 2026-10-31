document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const concertId = params.get("id");
  const concert = MOCK_CONCERTS.find((item) => item.id === concertId);

  const ticketList = document.getElementById("ticket-list");
  const mapContainer = document.getElementById("concert-map");

  if (!concert) {
    ticketList.textContent = "Concert not found. Open ticket selection from a concert page.";
    return;
  }

  const banner = document.getElementById("concert-banner");
  const title = document.getElementById("concert-title");
  const artist = document.getElementById("concert-artist");
  const meta = document.getElementById("concert-meta");
  const description = document.getElementById("concert-description");
  const eventInfo = document.getElementById("event-information");
  const selectedTicket = document.getElementById("selected-ticket");
  const quantityText = document.getElementById("quantity");
  const total = document.getElementById("total");
  const minus = document.getElementById("minus");
  const plus = document.getElementById("plus");
  const continueBtn = document.getElementById("continue-payment");

  let currentTicket = null;
  let quantity = 0;

  // Seat mode: when the booking API answers, tickets are chosen seat by seat and held on
  // the server. If it is unreachable we keep the original zone + quantity behaviour.
  const api = window.ConcertlyAPI;
  const seatCard = document.getElementById("seat-card");
  const seatPicker = document.getElementById("seat-picker");
  const seatMessage = document.getElementById("seat-message");
  const quantityControl = document.querySelector(".quantity-control");
  const MAX_SEATS = 8;
  let seatMap = null; // backend seat map; null = legacy mode
  let selectedSeats = []; // [{ id, label, price }] within the current zone

  banner.src = concert.banner;
  banner.alt = `${concert.title} concert banner`;
  title.textContent = concert.title;
  artist.textContent = concert.artist;
  meta.textContent = `${concert.location} | ${concert.date} | ${concert.time}`;
  description.textContent = concert.description;

  eventInfo.innerHTML = `
    <div class="info-row"><span>Date</span><strong>${concert.date}</strong></div>
    <div class="info-row"><span>Time</span><strong>${concert.time}</strong></div>
    <div class="info-row"><span>Venue</span><strong>${concert.location}</strong></div>
    <div class="info-row"><span>Price Range</span><strong>${concert.priceRange}</strong></div>
  `;

  ticketList.innerHTML = concert.tickets
    .map((ticket, index) => {
      const isSoldOut = ticket.status.toLowerCase().includes("sold out");
      return `
        <div
          class="ticket-item${isSoldOut ? " sold-out" : ""}"
          data-index="${index}"
          role="button"
          tabindex="${isSoldOut ? "-1" : "0"}"
          aria-disabled="${isSoldOut}"
        >
          <div>
            <h3>${ticket.type}</h3>
            <p>${ticket.status}</p>
          </div>
          <strong>${ticket.price}</strong>
        </div>
      `;
    })
    .join("");

  const ticketItems = [...ticketList.querySelectorAll(".ticket-item")];

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function currentZone() {
    return seatMap && currentTicket ? seatMap.zones.find((z) => z.name === currentTicket.type) : null;
  }

  function renderSeats() {
    const zone = currentZone();
    seatCard.hidden = !seatMap;
    if (!zone) {
      seatPicker.innerHTML = "<p>Pick a zone on the map or in the list to see its seats.</p>";
      return;
    }
    const rows = {};
    zone.seats.forEach((seat) => (rows[seat.row] = rows[seat.row] || []).push(seat));
    const chosen = new Set(selectedSeats.map((s) => s.id));
    seatPicker.innerHTML =
      '<div class="seat-stage">STAGE</div><div class="seat-rows">' +
      Object.entries(rows)
        .map(([row, seats]) => {
          const buttons = seats
            .map((seat) => {
              const taken = seat.status !== "available" && !seat.held_by_me;
              const cls = ["seat", chosen.has(seat.id) ? "selected" : "", taken ? "sold" : ""].join(" ").trim();
              const label = `Row ${escapeHtml(row)} seat ${seat.number}${taken ? " (taken)" : ""}`;
              return `<button type="button" class="${cls}" data-id="${seat.id}" ${taken ? "disabled" : ""} aria-pressed="${chosen.has(seat.id)}" aria-label="${label}">${seat.number}</button>`;
            })
            .join("");
          return `<div class="seat-row"><span class="seat-row-label">${escapeHtml(row)}</span>${buttons}</div>`;
        })
        .join("") +
      "</div>";
  }

  function toggleSeat(seatId) {
    const zone = currentZone();
    const seat = zone?.seats.find((s) => s.id === seatId);
    if (!seat) return;
    const index = selectedSeats.findIndex((s) => s.id === seatId);
    if (index >= 0) {
      selectedSeats.splice(index, 1);
    } else if (selectedSeats.length >= MAX_SEATS) {
      seatMessage.textContent = `You can select at most ${MAX_SEATS} seats.`;
      return;
    } else {
      selectedSeats.push({ id: seat.id, label: `${seat.row}${seat.number}`, price: zone.price });
    }
    seatMessage.textContent = "";
    renderSeats();
    updateSelection();
  }

  async function loadSeatMap() {
    if (!api) return;
    try {
      seatMap = await api.seatMap(api.numericId(concert.id));
    } catch (error) {
      seatMap = null; // backend not running / concert not seeded: legacy mode
      return;
    }
    quantityControl.hidden = true;
    quantity = 0;
    selectedSeats = [];
    renderSeats();
    updateSelection();
  }

  seatPicker.addEventListener("click", (event) => {
    const button = event.target.closest(".seat");
    if (button && !button.disabled) toggleSeat(Number(button.dataset.id));
  });

  function updateSelection() {
    if (seatMap) quantity = selectedSeats.length;
    if (!currentTicket) {
      selectedTicket.textContent = "No ticket selected";
      quantityText.textContent = "0";
      total.textContent = "$0";
      continueBtn.disabled = true;
      return;
    }

    selectedTicket.innerHTML = `
      <h3>${currentTicket.type}</h3>
      <p>Price: ${currentTicket.price}</p>
      ${seatMap ? `<p>Seats: ${selectedSeats.length ? selectedSeats.map((s) => s.label).join(", ") : "none selected"}</p>` : ""}
    `;
    quantityText.textContent = String(quantity);

    const price = Number(currentTicket.price.replace(/[^\d.]/g, ""));
    total.textContent = `$${seatMap ? selectedSeats.reduce((sum, s) => sum + s.price, 0) : price * quantity}`;
    continueBtn.disabled = quantity === 0;
  }

  function selectTicket(ticket) {
    if (!ticket || ticket.status.toLowerCase().includes("sold out")) return;

    if (seatMap && currentTicket !== ticket) selectedSeats = [];
    currentTicket = ticket;
    quantity = seatMap ? 0 : 1;
    if (seatMap) renderSeats();
    updateSelection();

    const selectedIndex = concert.tickets.indexOf(ticket);
    ticketItems.forEach((item) => {
      item.classList.toggle("active", Number(item.dataset.index) === selectedIndex);
    });
  }

  ticketItems.forEach((item) => {
    const chooseTicket = () => {
      selectTicket(concert.tickets[Number(item.dataset.index)]);
    };
  item.addEventListener("click", chooseTicket);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseTicket();
      }
    });
  });

  const requestedTicketType = params.get("ticketType");
  if (requestedTicketType) {
    selectTicket(concert.tickets.find((ticket) => ticket.type === requestedTicketType));
  }

  if (mapContainer && window.VenueLoader && window.VenueEngine) {
    new VenueLoader()
      .load(concert.id)
      .then((map) => {
        if (!map) {
          mapContainer.textContent = "Map is not available for this concert.";
          return;
        }
        new VenueEngine(mapContainer).render(map);
      })
      .catch((error) => {
        console.error("Could not load concert map:", error);
        mapContainer.textContent = "Could not load the concert map.";
      });
  }

  document.addEventListener("zoneSelected", (event) => {
    const ticket = concert.tickets.find((item) => item.type === event.detail.name);
    selectTicket(ticket);
  });

  plus.addEventListener("click", () => {
    if (!currentTicket) return;
    quantity += 1;
    updateSelection();
  });

  minus.addEventListener("click", () => {
    if (quantity === 0) return;
    quantity -= 1;
    updateSelection();
  });

  continueBtn.addEventListener("click", async () => {
    if (!currentTicket || quantity === 0) return;

    if (seatMap) {
      continueBtn.disabled = true;
      seatMessage.textContent = "Holding your seats…";
      try {
        const hold = await api.hold(seatMap.concert_id, selectedSeats.map((s) => s.id));
        localStorage.setItem(
          "checkoutData",
          JSON.stringify({
            concertId: concert.id,
            concertTitle: concert.title,
            artist: concert.artist,
            banner: concert.banner,
            location: concert.location,
            date: concert.date,
            time: concert.time,
            ticket: currentTicket,
            quantity: hold.seats.length,
            total: `$${hold.total_amount}`,
            reservationId: hold.id,
            expiresAt: hold.expires_at,
            seats: hold.seats.map((s) => ({
              id: s.id,
              label: `${s.row_label}${s.seat_number}`,
              zone: s.zone_name,
              price: s.price,
            })),
          }),
        );
        window.location.href = "../checkout/index.html";
      } catch (error) {
        if (error.code === "seat_unavailable") {
          selectedSeats = [];
          await loadSeatMap(); // refresh so the taken seats show as taken
          seatMessage.textContent = "Some of those seats were just taken. Please pick different seats.";
        } else {
          seatMessage.textContent = error.message;
        }
        updateSelection();
      }
      return;
    }

    const price = Number(currentTicket.price.replace(/[^\d.]/g, ""));
    const checkoutData = {
      concertId: concert.id,
      concertTitle: concert.title,
      artist: concert.artist,
      banner: concert.banner,
      location: concert.location,
      date: concert.date,
      time: concert.time,
      ticket: currentTicket,
      quantity,
      total: `$${price * quantity}`,
    };

    localStorage.setItem("checkoutData", JSON.stringify(checkoutData));
    window.location.href = "../checkout/index.html";
  });

  updateSelection();
  loadSeatMap();
});
