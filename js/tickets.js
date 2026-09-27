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

  function updateSelection() {
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
    `;
    quantityText.textContent = String(quantity);

    const price = Number(currentTicket.price.replace(/[^\d.]/g, ""));
    total.textContent = `$${price * quantity}`;
    continueBtn.disabled = quantity === 0;
  }

  function selectTicket(ticket) {
    if (!ticket || ticket.status.toLowerCase().includes("sold out")) return;

    currentTicket = ticket;
    quantity = 1;
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

  continueBtn.addEventListener("click", () => {
    if (!currentTicket || quantity === 0) return;

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
});
