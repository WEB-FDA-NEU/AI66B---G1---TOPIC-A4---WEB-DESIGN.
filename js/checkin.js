// js/checkin.js — admin gate check-in backed by the API (#38).
// Concerts: GET /api/admin/stats/concerts; attendees: GET /api/admin/concerts/{id}/attendees;
// check-in: POST /api/admin/checkin {ticketId, concertId} (ticket id or QR ticket code).

const ATTENDEES_PER_PAGE = 5;
let attendeePage = 1;
let attendeeStatusFilter = "all";
let attendeeSearch = "";
let concerts = [];
let selectedConcertId = null;
let attendees = [];
let loadToken = 0; // ignores responses for a concert that is no longer selected

const CHECKIN_ERRORS = {
  not_found: "Ticket not found. Check the code and try again.",
  ticket_already_used: "This ticket was already checked in",
  wrong_concert: "This ticket is for a different concert",
  ticket_not_valid: "This ticket cannot be used",
};

function showCheckinFeedback(message, kind = "info") {
  const feedback = document.getElementById("checkin-feedback");
  if (!feedback) return;
  feedback.className = `checkin-feedback checkin-feedback--${kind}`;
  feedback.textContent = message;
  feedback.hidden = false;
}

function hideCheckinFeedback() {
  const feedback = document.getElementById("checkin-feedback");
  if (feedback) feedback.hidden = true;
}

function selectedConcert() {
  return concerts.find(c => c.id === selectedConcertId);
}

function checkinErrorMessage(error) {
  if ([401, 403].includes(error.status) || error.code === "network") return adminApiError(error);
  const base = CHECKIN_ERRORS[error.code];
  if (!base) return error.message || "Check-in failed.";
  if (error.code === "ticket_already_used" && error.details.checked_in_at) {
    return `${base} at ${adminDateTime(error.details.checked_in_at)}.`;
  }
  if (error.code === "wrong_concert") {
    const other = concerts.find(c => c.id === error.details.ticket_concert_id);
    return other ? `${base}: ${other.title} (${adminDate(other.starts_at)}).` : `${base}.`;
  }
  if (error.code === "ticket_not_valid") return `${base} (${error.details.ticket_status || "invalid"}).`;
  return base;
}

/* ------------------------------------------------------------------ rendering */

/* Long codes ("CTL-" + 32 hex) are shortened in the table; the full code is in the
   tooltip, searchable, and what the scanner types. */
function shortCode(code) {
  return code.length > 18 ? `${code.slice(0, 10)}…${code.slice(-6)}` : code;
}

function renderEventOptions() {
  const select = document.getElementById("event");
  select.innerHTML = concerts.map(c => `
    <option value="${c.id}">${adminEscape(c.title)} — ${adminDate(c.starts_at)}</option>
  `).join("") || `<option value="">No concerts</option>`;
  // default to the next concert that has not started yet, else the latest one
  const next = concerts.find(c => new Date(c.starts_at) >= new Date()) || concerts[concerts.length - 1];
  selectedConcertId = next ? next.id : null;
  if (next) select.value = String(next.id);
}

function renderCheckinStats() {
  const checkedIn = attendees.filter(a => a.checked_in).length;
  document.getElementById("total-attendees-count").textContent = attendees.length;
  document.getElementById("checked-in-count").textContent = checkedIn;
  document.getElementById("not-checked-in-count").textContent = attendees.length - checkedIn;
}

function setTableMessage(message) {
  document.getElementById("attendee-table-body").innerHTML =
    `<tr><td colspan="5" class="text-muted">${adminEscape(message)}</td></tr>`;
  document.getElementById("attendee-count-caption").textContent = "";
  document.getElementById("attendee-pagination").innerHTML = "";
}

function renderAttendees() {
  const tbody = document.getElementById("attendee-table-body");
  const filtered = attendees.filter(a => {
    const text = `${a.ticket_code} ${a.customer.full_name} ${a.customer.email} #CT-${a.order_number}`.toLowerCase();
    const matchesStatus = attendeeStatusFilter === "all"
      || (attendeeStatusFilter === "checked" && a.checked_in)
      || (attendeeStatusFilter === "pending" && !a.checked_in);
    return text.includes(attendeeSearch) && matchesStatus;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / ATTENDEES_PER_PAGE));
  attendeePage = Math.min(attendeePage, pageCount);
  const start = (attendeePage - 1) * ATTENDEES_PER_PAGE;

  tbody.innerHTML = filtered.slice(start, start + ATTENDEES_PER_PAGE).map(a => `
    <tr>
      <td class="ticket-code" title="${adminEscape(a.ticket_code)}">${adminEscape(shortCode(a.ticket_code))}</td>
      <td>
        <div class="attendee-name">${adminEscape(a.customer.full_name)}</div>
        <div class="attendee-email">${adminEscape(a.customer.email)}</div>
      </td>
      <td>
        <div>${adminEscape(a.zone)}</div>
        <div class="attendee-email">Row ${adminEscape(a.row)} · Seat ${a.seat_number}</div>
      </td>
      <td><span class="badge ${a.checked_in ? "badge-green" : "badge-gray"}">${a.checked_in ? "Checked in" : "Not checked in"}</span></td>
      <td>
        ${a.checked_in
          ? `<span class="btn-checked"><i class="fa-solid fa-circle-check"></i> ${adminTime(a.checked_in_at)}</span>`
          : `<button class="btn btn-primary btn-checkin" data-ticket-id="${a.ticket_id}">Check in</button>`}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="text-muted">No attendees found.</td></tr>`;

  const first = filtered.length ? start + 1 : 0;
  const last = Math.min(start + ATTENDEES_PER_PAGE, filtered.length);
  document.getElementById("attendee-count-caption").textContent =
    `Showing ${first}–${last} of ${filtered.length} attendees`;
  renderAttendeePagination(pageCount);
}

function renderAttendeePagination(pageCount) {
  const pagination = document.getElementById("attendee-pagination");
  pagination.innerHTML = `
    <button class="page-btn" data-page-action="previous" aria-label="Previous page" ${attendeePage === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-angle-left"></i>
    </button>
    ${Array.from({ length: pageCount }, (_, index) => `
      <button class="page-btn${index + 1 === attendeePage ? " active" : ""}" data-page="${index + 1}">${index + 1}</button>
    `).join("")}
    <button class="page-btn" data-page-action="next" aria-label="Next page" ${attendeePage === pageCount ? "disabled" : ""}>
      <i class="fa-solid fa-angle-right"></i>
    </button>
  `;
}

/* ---------------------------------------------------------------------- data */

async function loadAttendees() {
  const token = ++loadToken;
  attendees = [];
  renderCheckinStats();
  if (!selectedConcertId) {
    setTableMessage("No concert selected.");
    return;
  }
  setTableMessage("Loading attendees…");
  try {
    const data = await ConcertlyAPI.adminAttendees(selectedConcertId);
    if (token !== loadToken) return;
    attendees = data.items;
  } catch (error) {
    if (token !== loadToken) return;
    setTableMessage(adminApiError(error));
    showCheckinFeedback(adminApiError(error), "error");
    return;
  }
  renderCheckinStats();
  renderAttendees();
}

/* Check a ticket in on the server, then refresh the list from the server. */
async function checkIn(ticketRef, button) {
  const concert = selectedConcert();
  if (!concert) return false;
  if (new Date(concert.starts_at) > new Date()) {
    const when = adminDateTime(concert.starts_at);
    if (!window.confirm(`${concert.title} starts ${when}. Check this ticket in early?`)) return false;
  }
  if (button) button.disabled = true;
  try {
    const result = await ConcertlyAPI.adminCheckIn(ticketRef, concert.id);
    showCheckinFeedback(
      `${result.customer.full_name} checked in — ${result.zone}, Row ${result.row}, Seat ${result.seat_number}.`,
      "success",
    );
    await loadAttendees();
    return true;
  } catch (error) {
    const kind = error.code === "ticket_already_used" ? "warning" : "error";
    showCheckinFeedback(checkinErrorMessage(error), kind);
    // the list may be stale (e.g. checked in at another gate): reload it
    if (error.code === "ticket_already_used") await loadAttendees();
    else if (button) button.disabled = false;
    return false;
  }
}

async function init() {
  setTableMessage("Loading concerts…");
  try {
    concerts = await ConcertlyAPI.adminConcertStats();
  } catch (error) {
    setTableMessage(adminApiError(error));
    showCheckinFeedback(adminApiError(error), "error");
    document.getElementById("event").innerHTML = `<option value="">Unavailable</option>`;
    return;
  }
  renderEventOptions();
  await loadAttendees();
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  document.getElementById("event").addEventListener("change", event => {
    selectedConcertId = Number(event.target.value) || null;
    attendeePage = 1;
    attendeeSearch = "";
    document.getElementById("attendee-search").value = "";
    attendeeStatusFilter = "all";
    hideCheckinFeedback();
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.status === "all"));
    loadAttendees();
  });

  document.getElementById("attendee-search").addEventListener("input", event => {
    attendeeSearch = event.target.value.trim().toLowerCase();
    attendeePage = 1;
    renderAttendees();
  });

  document.querySelectorAll(".filter-tab").forEach(button => {
    button.addEventListener("click", () => {
      attendeeStatusFilter = button.dataset.status;
      attendeePage = 1;
      document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.remove("active"));
      button.classList.add("active");
      renderAttendees();
    });
  });

  document.getElementById("attendee-pagination").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.page) attendeePage = Number(button.dataset.page);
    if (button.dataset.pageAction === "previous") attendeePage--;
    if (button.dataset.pageAction === "next") attendeePage++;
    renderAttendees();
  });

  document.getElementById("attendee-table-body").addEventListener("click", event => {
    const button = event.target.closest(".btn-checkin");
    if (button) checkIn(Number(button.dataset.ticketId), button);
  });

  document.getElementById("ticket-entry-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("ticket-code-input");
    const code = input.value.trim();
    if (!code) return;
    const submit = event.target.querySelector("button[type=submit]");
    submit.disabled = true;
    if (await checkIn(code)) input.value = "";
    submit.disabled = false;
    input.focus();
  });
});
