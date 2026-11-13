document.addEventListener("DOMContentLoaded", async () => {
  await window.concertlyCatalogReady;
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

  // Booking always uses PostgreSQL. Standing keeps zone + quantity; Seated uses seat IDs.
  const api = window.ConcertlyAPI;
  const seatCard = document.getElementById("seat-card");
  const seatPicker = document.getElementById("seat-picker");
  const seatMessage = document.getElementById("seat-message");
  const quantityControl = document.querySelector(".quantity-control");
  const MAX_SEATS = ConcertlyBooking.maxTickets;
  const retrySeats = document.getElementById("retry-seats");
  const seatTitle = document.getElementById("seat-picker-title");
  const seatTools = document.getElementById("seat-picker-tools");
  const seatLegend = document.getElementById("seat-legend");
  let refreshSequence = 0;
  let seatZoom = 1;
  let fittedLayout = null;
  let renderedSectionId = null;
  let venueMap = null;
  let activeSectionId = null;
  let bookingMode = "loading";
  let holding = false;
  let seatMap = null; // authoritative availability from PostgreSQL
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

  function isSeated() {
    return currentZone()?.booking_type !== "standing";
  }
  function availableForMe(zone) {
    return Number(zone?.available || 0) + Number(zone?.held_by_me_count || 0);
  }
  function isUnavailable(ticket) {
    const zone = seatMap?.zones.find(z => z.name === ticket.type);
    return zone ? availableForMe(zone) === 0 : ticket.status.toLowerCase().includes("sold out");
  }
  function renderTicketCategories() {
    ticketItems.forEach(item => {
      const ticket = concert.tickets[Number(item.dataset.index)];
      const zone = seatMap?.zones.find(z => z.name === ticket.type);
      if (!zone) return;
      const unavailable = availableForMe(zone) === 0;
      item.classList.toggle("sold-out", unavailable);
      item.setAttribute("aria-disabled", String(unavailable));
      item.tabIndex = unavailable ? -1 : 0;
      item.querySelector("p").textContent = `${zone.booking_type === "standing" ? "Standing" : "Seated"} · ${unavailable ? "Unavailable" : `${availableForMe(zone)} available`}`;
      item.querySelector("strong").textContent = `$${zone.price}`;
    });
  }
  // Presentation only: use the full existing column width, preserving SVG proportions.
  function fitDetail() {
    const viewport = seatPicker.querySelector(".seat-rows");
    const surface = seatPicker.querySelector(".seat-surface");
    const canvas = seatPicker.querySelector(".seat-canvas");
    if (!fittedLayout || !viewport?.clientWidth || !surface || !canvas) return;
    const fit = Math.min((viewport.getBoundingClientRect().width - 6) / fittedLayout.width,
      Math.max(240, Math.min(600, window.innerHeight * .60)) / fittedLayout.height);
    const scale = fit * seatZoom;
    const width = fittedLayout.width * scale, height = fittedLayout.height * scale;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    canvas.style.transform = `scale(${scale})`;
    viewport.style.height = `${Math.ceil(seatZoom === 1 ? height : Math.min(height, window.innerHeight * .65)) + 2}px`;
    viewport.classList.toggle("is-zoomed", seatZoom > 1);
    if (seatZoom === 1) viewport.scrollLeft = viewport.scrollTop = 0;
  }
  window.addEventListener("resize", fitDetail);
  if (window.ResizeObserver) {
    let previousWidth = 0;
    new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width && width !== previousWidth) { previousWidth = width; fitDetail(); }
    }).observe(seatPicker);
  }
  function renderSeats() {
    const zone = currentZone();
    seatCard.hidden = false;
    quantityControl.hidden = !zone || isSeated();
    seatTools.hidden = !zone || !isSeated();
    seatLegend.hidden = !zone || !isSeated();
    if (!zone) {
      fittedLayout = null;
      seatTitle.textContent = "Ticket availability";
      seatPicker.innerHTML = "<p>Pick a zone on the map or in the list.</p>";
      return;
    }
    seatTitle.textContent = `${zone.name} · ${isSeated() ? "Seated" : "Standing"}`;
    if (!isSeated()) {
      fittedLayout = null;
      seatPicker.textContent = `Standing: choose a quantity (maximum ${MAX_SEATS}). ${availableForMe(zone)} tickets available. No assigned rows or seats.`;
      return;
    }
    if (!venueMap || !window.SeatGeometry) {
      seatPicker.textContent = "Loading the zone geometry…";
      return;
    }
    const oldViews = [...seatPicker.querySelectorAll(".seat-rows")].map(el => ({id:el.closest(".geometry-section").dataset.sectionId,left:el.scrollLeft,top:el.scrollTop}));
    const focusedSeat = seatPicker.contains(document.activeElement) ? document.activeElement?.dataset.id : null;
    const chosen = new Set(selectedSeats.map(s => s.id));
    let layouts;
    try {
      const availableLayouts = SeatGeometry.zone(venueMap, zone.name, zone.seats);
      fittedLayout = availableLayouts.find(view => view.section.id === activeSectionId) || availableLayouts[0];
      layouts = [fittedLayout]; // Render only the clicked SVG fragment; inventory and IDs stay unchanged.
      activeSectionId = fittedLayout.section.id;
      if (renderedSectionId !== activeSectionId) seatZoom = 1;
      renderedSectionId = activeSectionId;
    }
    catch (error) { seatPicker.textContent = error.message; return; }
    seatPicker.innerHTML = `<p class="seat-layout-note">↑ Towards stage. Seat labels keep their original row and number.</p>` + layouts.map(layout => {
      const {section,positions,points,bounds,scale,margin,width,height} = layout;
      const outline = points.map(p => `${(p[0]-bounds.left)*scale+margin},${(p[1]-bounds.top)*scale+margin}`).join(" ");
      return `<section class="geometry-section" data-section-id="${escapeHtml(section.id)}">
        <h3>${escapeHtml(section.labelText || section.name)} <small>(${positions.length} seats)</small></h3>
        <div class="seat-stage">↑ ${escapeHtml(venueMap.stage.label || "STAGE")}</div>
        <svg class="seat-preview" viewBox="0 0 ${width} ${height}" role="img" aria-label="Full zone overview; use the larger map below to select seats">
          <polygon points="${outline}"/>
          ${positions.map(({seat,x,y}) => `<circle cx="${x}" cy="${y}" r="13" class="${chosen.has(seat.id) ? "selected" : seat.status}"/>`).join("")}
        </svg>
        <p class="seat-layout-note">Full zone overview ↑ · Scroll the larger map below to select seats.</p>
        <div class="seat-rows" tabindex="0" role="region" aria-label="${escapeHtml(section.labelText || section.name)}; scroll to explore all seats">
          <div class="seat-surface"><div class="seat-canvas" style="width:${width}px;height:${height}px">
            <svg class="seat-outline" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polygon points="${outline}"/></svg>
            ${positions.map(({seat,x,y,rank}) => {
              const taken = seat.status === "sold" || (seat.status === "held" && !seat.held_by_me);
              const state = chosen.has(seat.id) ? "selected" : seat.status;
              const symbol = {available:"○",selected:"✓",held:"◷",sold:"×"}[state] || "○";
              const label = `${zone.name} / ${section.labelText || section.name}, Row ${seat.row}, Seat ${seat.number} · ${state}${seat.held_by_me ? " (held by you)" : ""} · $${zone.price}`;
              return `<button type="button" class="seat ${state}" data-id="${seat.id}" data-rank="${rank}" data-row="${escapeHtml(seat.row)}" data-number="${seat.number}" style="left:calc(${x}px * var(--seat-zoom,1));top:calc(${y}px * var(--seat-zoom,1))" ${taken ? "disabled" : ""} aria-pressed="${chosen.has(seat.id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span>${escapeHtml(seat.row)}${seat.number}</span><small aria-hidden="true">${symbol}</small></button>`;
            }).join("")}
          </div></div>
        </div>
      </section>`;
    }).join("");
    fitDetail();
    const previous = oldViews.find(view => view.id === activeSectionId);
    const viewport = seatPicker.querySelector(".seat-rows");
    if (previous && seatZoom > 1) { viewport.scrollLeft = previous.left; viewport.scrollTop = previous.top; }
    if (focusedSeat) seatPicker.querySelector(`.seat[data-id="${focusedSeat}"]`)?.focus({ preventScroll: true });
  }

  function toggleSeat(seatId) {
    const zone = currentZone();
    const seat = zone?.seats.find((s) => s.id === seatId);
    if (!seat || !isSeated() || seat.status === "sold" || (seat.status === "held" && !seat.held_by_me)) return;
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
    ++refreshSequence;
    bookingMode = "loading";
    seatMap = null;
    quantity = 0;
    selectedSeats = [];
    seatCard.hidden = false;
    quantityControl.hidden = true;
    retrySeats.hidden = true;
    seatTools.hidden = true;
    seatLegend.hidden = true;
    seatPicker.textContent = "Loading seat availability…";
    seatMessage.textContent = "";
    updateSelection();
    try {
      if (!api) throw new Error("The booking client is unavailable.");
      const result = await api.seatMap(api.numericId(concert.id));
      if (!Array.isArray(result?.zones) || result.zones.some(z => !["standing", "seated"].includes(z.booking_type))) {
        throw new Error("The server must provide an explicit Standing/Seated type for every zone. Please update the booking server and retry.");
      }
      seatMap = result;
      bookingMode = "api";
      renderTicketCategories();
      if (currentTicket && !isSeated()) quantity = Math.min(1, availableForMe(currentZone()));
      renderSeats();
      retrySeats.hidden = false;
    } catch (error) {
      bookingMode = "error";
      seatPicker.textContent = "Live ticket availability could not be loaded. Retry before booking; no seats or tickets have been reserved.";
      seatMessage.textContent = error.status === 401
        ? "Your session has expired. Please sign in again." : error.message;
      retrySeats.hidden = false;

    }
    updateSelection();
  }
  retrySeats.addEventListener("click", loadSeatMap);
  document.querySelectorAll("[data-seat-zoom]").forEach(button => {
    button.addEventListener("click", () => {
      seatZoom = button.dataset.seatZoom === "reset" ? 1 : Math.max(1, Math.min(16, seatZoom * (Number(button.dataset.seatZoom) > 0 ? 1.5 : 1/1.5)));
      fitDetail();
    });
  });
  async function refreshAvailability() {
    if (bookingMode !== "api" || holding || document.hidden) return;
    const request = ++refreshSequence;
    try {
      const fresh = await api.seatMap(api.numericId(concert.id));
      if (request !== refreshSequence || holding || bookingMode !== "api") return;
      if (!Array.isArray(fresh?.zones)) throw new Error("Invalid availability response.");
      seatMap = fresh;
      renderTicketCategories();
      const zone = currentZone();
      const stillAvailable = new Set((zone?.seats || []).filter(s => s.status === "available" || s.held_by_me).map(s => s.id));
      const previousCount = selectedSeats.length;
      selectedSeats = selectedSeats.filter(s => stillAvailable.has(s.id)).map(s => ({ ...s, price: zone.price }));
      if (selectedSeats.length !== previousCount) seatMessage.textContent = "Some selected seats are no longer available. Please review your selection.";
      if (!isSeated()) quantity = Math.min(quantity, availableForMe(zone));
      renderSeats();
      updateSelection();
    } catch {
      bookingMode = "error";
      seatMessage.textContent = "Live availability could not be refreshed. Retry before continuing.";
      retrySeats.hidden = false;
      updateSelection();
    }
  }
  setInterval(refreshAvailability, 15000);
  window.addEventListener("focus", refreshAvailability);

  seatPicker.addEventListener("click", (event) => {
    const button = event.target.closest(".seat");
    if (button && !button.disabled) toggleSeat(Number(button.dataset.id));
  });

  function updateSelection() {
    if (seatMap && isSeated()) quantity = selectedSeats.length;
    if (!currentTicket) {
      selectedTicket.textContent = "No ticket selected";
      quantityText.textContent = "0";
      total.textContent = "$0";
      continueBtn.disabled = true;
      return;
    }

    selectedTicket.innerHTML = `
      <h3>${currentTicket.type}</h3>
      <p>Price: $${currentZone()?.price ?? Number(currentTicket.price.replace(/[^\d.]/g, ""))}</p>
      ${seatMap ? (isSeated() ? `<p>Seats: ${selectedSeats.length ? selectedSeats.map(s => escapeHtml(s.label)).join(", ") : "none selected"}</p>` : "<p>Standing · no assigned seat</p>") : "<p>Load live availability to select tickets.</p>"}
    `;
    quantityText.textContent = String(quantity);
    plus.disabled = quantity >= Math.min(MAX_SEATS, availableForMe(currentZone())) || bookingMode !== "api" || isSeated();
    minus.disabled = quantity <= 1 || bookingMode !== "api" || isSeated();

    const price = Number(currentTicket.price.replace(/[^\d.]/g, ""));
    total.textContent = `$${seatMap && isSeated() ? selectedSeats.reduce((sum, s) => sum + s.price, 0) : (currentZone()?.price ?? price) * quantity}`;
    continueBtn.disabled = holding || bookingMode !== "api" || quantity < 1 || quantity > MAX_SEATS || (seatMap?.status && seatMap.status !== "on_sale");
  }

  function selectTicket(ticket) {
    if (!ticket || isUnavailable(ticket) || holding) return;

    if (seatMap && currentTicket !== ticket) selectedSeats = [];
    currentTicket = ticket;
    quantity = seatMap && isSeated() ? selectedSeats.length : (seatMap ? Math.min(1, availableForMe(currentZone())) : 0);
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
      if (seatMap && isSeated()) seatCard.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const retryVenue = document.getElementById("retry-venue-map");
  let mapZoom = 1;
  async function loadVenueMap() {
    retryVenue.hidden = true;
    mapContainer.textContent = "Loading venue map…";
    try {
      const map = await new VenueLoader().load(concert.id);
      if (!map) throw new Error("No venue diagram is available for this concert. Select a category below.");
      venueMap = map;
      new VenueEngine(mapContainer).render(map);
      if (seatMap && isSeated()) renderSeats();
      mapZoom = 1;
      mapContainer.style.setProperty("--map-zoom", "1");
    } catch (error) {
      mapContainer.textContent = error.message || String(error);
      retryVenue.hidden = false;
    }
  }
  retryVenue.addEventListener("click", loadVenueMap);
  document.querySelectorAll("[data-map-zoom]").forEach(button => {
    button.addEventListener("click", () => {
      mapZoom = button.dataset.mapZoom === "reset" ? 1
        : Math.max(1, Math.min(3, mapZoom + Number(button.dataset.mapZoom)));
      mapContainer.style.setProperty("--map-zoom", String(mapZoom));
    });
  });
  loadVenueMap();

  document.addEventListener("zoneSelected", (event) => {
    const ticket = concert.tickets.find((item) => item.type === event.detail.name);
    activeSectionId = event.detail.id;
    selectTicket(ticket);
    if (seatMap && isSeated()) {
      const target = [...seatPicker.querySelectorAll(".geometry-section")].find(el => el.dataset.sectionId === activeSectionId);
      (target || seatCard).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  plus.addEventListener("click", () => {
    if (!currentTicket || bookingMode !== "api" || isSeated() || quantity >= Math.min(MAX_SEATS, availableForMe(currentZone()))) return;
    quantity += 1;
    updateSelection();
  });

  minus.addEventListener("click", () => {
    if (quantity <= 1 || bookingMode !== "api" || isSeated()) return;
    quantity -= 1;
    updateSelection();
  });

  continueBtn.addEventListener("click", async () => {
    if (holding || !currentTicket || !ConcertlyBooking.validQuantity(quantity) || bookingMode !== "api") return;

    if (seatMap) {
      holding = true;
      continueBtn.disabled = true;
      seatMessage.textContent = "Holding your seats…";
      try {
        const hold = isSeated()
          ? await api.hold(seatMap.concert_id, selectedSeats.map(s => s.id))
          : await api.holdTickets(seatMap.concert_id, [], [{ zone_id: currentZone().id, quantity }]);
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
            ticket: { ...currentTicket, price: `$${currentZone().price}` },
            quantity: hold.seats.length,
            total: `$${hold.total_amount}`,
            reservationId: hold.id,
            expiresAt: hold.expires_at,
            seats: hold.seats.map((s) => ({
              id: s.id,
              label: s.booking_type === "standing" ? "Standing" : `${s.row_label}${s.seat_number}`,
              row: s.row_label,
              seat_number: s.seat_number,
              booking_type: s.booking_type || "seated",
              zone: s.zone_name,
              price: s.price,
            })),
          }),
        );
        window.location.href = "../checkout/index.html";
      } catch (error) {
        if (["seat_unavailable", "standing_unavailable"].includes(error.code)) {
          selectedSeats = [];
          await loadSeatMap(); // refresh so the taken seats show as taken
          seatMessage.textContent = "Some of those seats were just taken. Please pick different seats.";
        } else {
          seatMessage.textContent = error.message;
        }
      } finally {
        holding = false;
        updateSelection();
      }
      return;
    }

  });

  updateSelection();
  loadSeatMap();
});
