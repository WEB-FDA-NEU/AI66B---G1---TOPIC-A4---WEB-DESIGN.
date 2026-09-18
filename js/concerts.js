// js/concerts.js

const CONCERTS_PER_PAGE = 5;
let concertPage = 1;
let filteredConcerts = [];

function renderConcertTable() {
  const tbody = document.getElementById("concert-table-body");
  if (!tbody) return;

  const search = document.getElementById("concert-search").value.trim().toLowerCase();
  const status = document.getElementById("concert-status-filter").value;
  filteredConcerts = sortedByDate(MOCK_CONCERTS).filter(c => {
    const matchesSearch = `${c.title} ${c.artist}`.toLowerCase().includes(search);
    const matchesStatus = status === "all" || getConcertStatus(c) === status;
    return matchesSearch && matchesStatus;
  });

  const pageCount = Math.max(1, Math.ceil(filteredConcerts.length / CONCERTS_PER_PAGE));
  concertPage = Math.min(concertPage, pageCount);
  const start = (concertPage - 1) * CONCERTS_PER_PAGE;

  tbody.innerHTML = filteredConcerts.slice(start, start + CONCERTS_PER_PAGE).map(c => `
    <tr>
      <td>
        <div class="cell-concert">
          <img class="cell-thumb" src="${c.poster}" alt="">
          <span class="cell-title">${c.title}</span>
        </div>
      </td>
      <td>${c.artist}</td>
      <td>${formatDateTime(c.date, c.time)}</td>
      <td>${c.location}</td>
      <td><span class="badge ${badgeClassFor(getConcertStatus(c))}">${getConcertStatus(c)}</span></td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn" aria-label="Edit" onclick="loadConcertIntoForm('${c.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="row-action-btn danger" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="text-muted">No concerts found.</td></tr>`;

  const caption = document.getElementById("concert-count-caption");
  const firstResult = filteredConcerts.length ? start + 1 : 0;
  const lastResult = Math.min(start + CONCERTS_PER_PAGE, filteredConcerts.length);
  if (caption) caption.textContent = `Showing ${firstResult}–${lastResult} of ${filteredConcerts.length} concerts`;
  renderConcertPagination(pageCount);
}

function renderConcertPagination(pageCount) {
  const pagination = document.getElementById("concert-pagination");
  if (!pagination) return;

  pagination.innerHTML = `
    <button class="page-btn" data-page-action="previous" aria-label="Previous page" ${concertPage === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-angle-left"></i>
    </button>
    ${Array.from({ length: pageCount }, (_, index) => `
      <button class="page-btn${index + 1 === concertPage ? " active" : ""}" data-page="${index + 1}">${index + 1}</button>
    `).join("")}
    <button class="page-btn" data-page-action="next" aria-label="Next page" ${concertPage === pageCount ? "disabled" : ""}>
      <i class="fa-solid fa-angle-right"></i>
    </button>
  `;
}

// mock-data.js tickets only have { type, price, status } — no quantity.
// Quantity stays a plain number input the admin fills in by hand; Edit only
// pre-fills type + price from the mock ticket, quantity is left blank.
function ticketRowHTML(ticket) {
  const type = ticket ? ticket.type : "";
  const price = ticket ? String(ticket.price).replace("$", "") : "";
  return `
    <div class="ticket-type-row">
      <div class="form-group">
        <label class="form-label">Type name</label>
        <input class="form-input" type="text" value="${type}">
      </div>
      <div class="form-group">
        <label class="form-label">Price (USD)</label>
        <input class="form-input" type="number" value="${price}">
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input class="form-input" type="number" placeholder="e.g. 200">
      </div>
      <button type="button" class="ticket-type-remove" aria-label="Remove ticket type" onclick="this.closest('.ticket-type-row').remove()"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `;
}

function addEmptyTicketRow() {
  document.getElementById("ticket-type-list").insertAdjacentHTML("beforeend", ticketRowHTML(null));
}

function openNewConcertForm() {
  resetConcertForm();
  const formCard = document.getElementById("concert-form");
  formCard.hidden = false;
  formCard.scrollIntoView({ behavior: "smooth" });
}

function loadConcertIntoForm(id) {
  const c = MOCK_CONCERTS.find(x => x.id === id);
  if (!c) return;

  document.getElementById("concert-form").hidden = false;
  document.getElementById("form-card-title").textContent = "Edit Concert";
  document.getElementById("concert-name").value = c.title;
  document.getElementById("artist-name").value = c.artist;
  document.getElementById("concert-date").value = c.date;
  document.getElementById("concert-time").value = c.time;
  document.getElementById("venue").value = c.location;
  document.getElementById("description").value = c.description;
  document.getElementById("cover-preview").innerHTML = `<img src="${c.poster}" alt="">`;
  document.getElementById("ticket-type-list").innerHTML = c.tickets.map(ticketRowHTML).join("");

  document.getElementById("concert-form").scrollIntoView({ behavior: "smooth" });
}

function resetConcertForm() {
  document.getElementById("form-card-title").textContent = "Add New Concert";
  document.querySelector("#concert-form form").reset();
  document.getElementById("cover-preview").innerHTML = '<i class="fa-solid fa-image"></i>';
  document.getElementById("ticket-type-list").innerHTML = ticketRowHTML(null) + ticketRowHTML(null);
  document.getElementById("concert-form").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("concert-search").addEventListener("input", () => {
    concertPage = 1;
    renderConcertTable();
  });
  document.getElementById("concert-status-filter").addEventListener("change", () => {
    concertPage = 1;
    renderConcertTable();
  });
  document.getElementById("concert-pagination").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.page) concertPage = Number(button.dataset.page);
    if (button.dataset.pageAction === "previous") concertPage--;
    if (button.dataset.pageAction === "next") concertPage++;
    renderConcertTable();
  });
  renderConcertTable();
});
