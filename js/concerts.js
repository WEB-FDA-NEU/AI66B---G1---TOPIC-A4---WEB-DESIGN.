const CONCERTS_PER_PAGE = 5;
const CONCERT_STATUS_LABELS = {
  draft: "Draft",
  on_sale: "On Sale",
  sold_out: "Sold Out",
  completed: "Ended",
  cancelled: "Cancelled",
};
const CONCERT_STATUS_BADGES = {
  draft: "badge-gray",
  on_sale: "badge-green",
  sold_out: "badge-red",
  completed: "badge-gray",
  cancelled: "badge-red",
};
let concerts = [];
let concertPage = 1;
let filteredConcerts = [];
let editingConcertId = null;
let posterUrl = "";

function showConcertFeedback(message, kind = "error") {
  const feedback = document.getElementById("concert-form-feedback");
  feedback.className = `checkin-feedback checkin-feedback--${kind}`;
  feedback.textContent = message;
  feedback.hidden = false;
}

function clearConcertFeedback() {
  const feedback = document.getElementById("concert-form-feedback");
  feedback.textContent = "";
  feedback.hidden = true;
}

function concertDateTime(value) {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function inputDateTime(value) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function renderConcertTable() {
  const tbody = document.getElementById("concert-table-body");
  const search = document.getElementById("concert-search").value.trim().toLowerCase();
  const status = document.getElementById("concert-status-filter").value;
  filteredConcerts = [...concerts]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .filter(concert => {
      const matchesSearch = `${concert.title} ${concert.artist}`.toLowerCase().includes(search);
      return matchesSearch && (status === "all" || concert.status === status);
    });

  const pageCount = Math.max(1, Math.ceil(filteredConcerts.length / CONCERTS_PER_PAGE));
  concertPage = Math.min(concertPage, pageCount);
  const start = (concertPage - 1) * CONCERTS_PER_PAGE;
  tbody.innerHTML = filteredConcerts.slice(start, start + CONCERTS_PER_PAGE).map(concert => `
    <tr>
      <td>
        <div class="cell-concert">
          ${concert.poster_url ? `<img class="cell-thumb" src="${adminEscape(concert.poster_url)}" alt="">` : ""}
          <span class="cell-title">${adminEscape(concert.title)}</span>
        </div>
      </td>
      <td>${adminEscape(concert.artist)}</td>
      <td>${adminEscape(concertDateTime(concert.starts_at))}</td>
      <td>${adminEscape(concert.venue)}, ${adminEscape(concert.city)}</td>
      <td><span class="badge ${CONCERT_STATUS_BADGES[concert.status] || "badge-gray"}">${adminEscape(CONCERT_STATUS_LABELS[concert.status] || concert.status)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" class="row-action-btn" aria-label="Edit ${adminEscape(concert.title)}" data-edit-concert="${concert.id}"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="row-action-btn danger" aria-label="Delete ${adminEscape(concert.title)}" data-delete-concert="${concert.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="text-muted">No concerts found.</td></tr>`;

  const first = filteredConcerts.length ? start + 1 : 0;
  const last = Math.min(start + CONCERTS_PER_PAGE, filteredConcerts.length);
  document.getElementById("concert-count-caption").textContent =
    `Showing ${first}–${last} of ${filteredConcerts.length} concerts`;
  renderConcertPagination(pageCount);
}

function renderConcertPagination(pageCount) {
  const pagination = document.getElementById("concert-pagination");
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

function ticketRowHTML(zone = null) {
  return `
    <div class="ticket-type-row" ${zone ? `data-zone-id="${zone.id}" data-zone-color="${adminEscape(zone.color || "")}"` : ""}>
      <div class="form-group">
        <label class="form-label">Type name</label>
        <input class="form-input" type="text" value="${adminEscape(zone?.name || "")}" maxlength="100" required>
      </div>
      <div class="form-group">
        <label class="form-label">Price (USD)</label>
        <input class="form-input" type="number" min="0" step="1" value="${zone ? zone.price : ""}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input class="form-input" type="number" min="1" max="20000" step="1" value="${zone ? zone.capacity : ""}" required>
      </div>
      <button type="button" class="ticket-type-remove" aria-label="Remove ticket type"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `;
}

function addEmptyTicketRow() {
  document.getElementById("ticket-type-list").insertAdjacentHTML("beforeend", ticketRowHTML());
}

function openNewConcertForm() {
  resetConcertForm();
  document.getElementById("concert-form").hidden = false;
  document.getElementById("concert-form").scrollIntoView({ behavior: "smooth" });
}

function loadConcertIntoForm(id) {
  const concert = concerts.find(item => item.id === id);
  if (!concert) return;

  const dateTime = inputDateTime(concert.starts_at);
  editingConcertId = concert.id;
  posterUrl = concert.poster_url || "";
  document.getElementById("concert-form").hidden = false;
  document.getElementById("form-card-title").textContent = "Edit Concert";
  document.getElementById("concert-name").value = concert.title;
  document.getElementById("artist-name").value = concert.artist;
  document.getElementById("concert-date").value = dateTime.date;
  document.getElementById("concert-time").value = dateTime.time;
  document.getElementById("concert-status").value = concert.status;
  document.getElementById("venue").value = concert.venue;
  document.getElementById("concert-city").value = concert.city;
  document.getElementById("description").value = concert.description || "";
  document.getElementById("cover-preview").innerHTML = posterUrl
    ? `<img src="${adminEscape(posterUrl)}" alt="">`
    : '<i class="fa-solid fa-image"></i>';
  document.getElementById("ticket-type-list").innerHTML = concert.zones.map(ticketRowHTML).join("");
  clearConcertFeedback();
  document.getElementById("concert-form").scrollIntoView({ behavior: "smooth" });
}

function resetConcertForm() {
  editingConcertId = null;
  posterUrl = "";
  document.getElementById("form-card-title").textContent = "Add New Concert";
  document.querySelector("#concert-form form").reset();
  document.getElementById("cover-preview").innerHTML = '<i class="fa-solid fa-image"></i>';
  document.getElementById("ticket-type-list").innerHTML = ticketRowHTML();
  document.getElementById("concert-form").hidden = true;
  clearConcertFeedback();
}

function concertPayload() {
  const date = document.getElementById("concert-date").value;
  const time = document.getElementById("concert-time").value;
  const start = new Date(`${date}T${time}`);
  if (!date || !time || Number.isNaN(start.getTime())) {
    throw new Error("Enter a valid concert date and time.");
  }

  const zones = Array.from(document.querySelectorAll("#ticket-type-list .ticket-type-row")).map(row => {
    const [nameInput, priceInput, capacityInput] = row.querySelectorAll("input");
    const name = nameInput.value.trim();
    const price = Number(priceInput.value);
    const capacity = Number(capacityInput.value);
    if (!name || !Number.isInteger(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Complete every ticket type with a name, whole-number price, and positive quantity.");
    }
    return {
      ...(row.dataset.zoneId ? { id: Number(row.dataset.zoneId) } : {}),
      name,
      price,
      capacity,
      color: row.dataset.zoneColor || null,
    };
  });
  if (!zones.length) throw new Error("Add at least one ticket type.");
  if (new Set(zones.map(zone => zone.name.toLowerCase())).size !== zones.length) {
    throw new Error("Ticket type names must be unique.");
  }
  if (zones.reduce((total, zone) => total + zone.capacity, 0) > 20000) {
    throw new Error("Total concert capacity cannot exceed 20,000 seats.");
  }

  const title = document.getElementById("concert-name").value.trim();
  const artist = document.getElementById("artist-name").value.trim();
  const venue = document.getElementById("venue").value.trim();
  const city = document.getElementById("concert-city").value.trim();
  if (!title || !artist || !venue || !city) {
    throw new Error("Complete the concert name, artist, venue, and city.");
  }

  return {
    title,
    artist,
    venue,
    city,
    description: document.getElementById("description").value.trim() || null,
    poster_url: posterUrl || null,
    starts_at: start.toISOString(),
    status: document.getElementById("concert-status").value,
    zones,
  };
}

async function saveConcertForm(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  clearConcertFeedback();
  try {
    const payload = concertPayload();
    if (editingConcertId) {
      await ConcertlyAPI.adminUpdateConcert(editingConcertId, payload);
    } else {
      await ConcertlyAPI.adminCreateConcert(payload);
    }
    await loadConcerts();
    resetConcertForm();
  } catch (error) {
    showConcertFeedback(error.status ? adminApiError(error) : error.message);
  } finally {
    submit.disabled = false;
  }
}

async function deleteConcert(id) {
  const concert = concerts.find(item => item.id === id);
  if (!concert || !window.confirm(`Delete "${concert.title}"? Concerts with orders or reservations cannot be deleted.`)) return;
  try {
    await ConcertlyAPI.adminDeleteConcert(id);
    if (editingConcertId === id) resetConcertForm();
    await loadConcerts();
  } catch (error) {
    showConcertFeedback(adminApiError(error));
    document.getElementById("concert-form").hidden = false;
    document.getElementById("concert-form").scrollIntoView({ behavior: "smooth" });
  }
}

async function uploadConcertImage(file) {
  if (!file) return;
  const feedback = document.getElementById("concert-form-feedback");
  const button = document.getElementById("concert-image-upload");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    showConcertFeedback("Choose a JPG, PNG, or WebP image up to 5 MB.");
    return;
  }
  button.disabled = true;
  feedback.hidden = true;
  try {
    const result = await ConcertlyAPI.adminUploadConcertImage(file);
    posterUrl = result.url;
    document.getElementById("cover-preview").innerHTML = `<img src="${adminEscape(posterUrl)}" alt="">`;
  } catch (error) {
    showConcertFeedback(adminApiError(error));
  } finally {
    button.disabled = false;
  }
}

async function loadConcerts() {
  const tbody = document.getElementById("concert-table-body");
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Loading concerts…</td></tr>`;
  try {
    concerts = await ConcertlyAPI.adminConcerts();
    concertPage = 1;
    renderConcertTable();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">${adminEscape(adminApiError(error))}</td></tr>`;
    document.getElementById("concert-count-caption").textContent = "";
    document.getElementById("concert-pagination").innerHTML = "";
  }
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
  document.getElementById("concert-table-body").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-concert]");
    const remove = event.target.closest("[data-delete-concert]");
    if (edit) loadConcertIntoForm(Number(edit.dataset.editConcert));
    if (remove) deleteConcert(Number(remove.dataset.deleteConcert));
  });
  document.getElementById("ticket-type-list").addEventListener("click", event => {
    const remove = event.target.closest(".ticket-type-remove");
    if (remove) remove.closest(".ticket-type-row").remove();
  });
  document.querySelector("#concert-form form").addEventListener("submit", saveConcertForm);
  document.getElementById("cancel-concert-form").addEventListener("click", resetConcertForm);
  document.getElementById("concert-image-upload").addEventListener("click", () => {
    document.getElementById("concert-image-file").click();
  });
  document.getElementById("concert-image-file").addEventListener("change", event => {
    uploadConcertImage(event.target.files[0]);
    event.target.value = "";
  });
  loadConcerts();
});
