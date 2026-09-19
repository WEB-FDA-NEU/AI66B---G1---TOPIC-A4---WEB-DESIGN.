// js/checkin.js

const ATTENDEES_PER_PAGE = 5;
let attendeePage = 1;
let attendeeStatusFilter = "all";
let attendeeSearch = "";
let selectedEventId = "";

const MOCK_ATTENDEES = MOCK_ORDERS
  .filter(order => order.status === "Paid" || order.status === "Pending")
  .map(order => {
    const concert = MOCK_CONCERTS.find(item => item.title === order.concert);
    const attendeeName = order.customer.toLowerCase().replace(/\s+/g, ".");

    return {
      id: order.orderId.replace("#CT-", ""),
      eventId: concert ? concert.id : "",
      name: order.customer,
      email: `${attendeeName}@gmail.com`,
      type: order.amount >= 300 ? "VIP" : "Standard",
      checkedIn: false
    };
  })
  .filter(attendee => attendee.eventId);

function getConcertForAttendee(attendee) {
  return MOCK_CONCERTS.find(concert => concert.id === attendee.eventId);
}

function hasConcertStarted(attendee) {
  const concert = getConcertForAttendee(attendee);
  return concert && new Date(`${concert.date}T${concert.time}`) <= new Date();
}

function resetFutureConcertAttendees() {
  MOCK_ATTENDEES.forEach(attendee => {
    if (!hasConcertStarted(attendee)) {
      attendee.checkedIn = false;
      delete attendee.time;
    }
  });
}

function renderEventOptions() {
  const select = document.getElementById("event");
  if (!select) return;

  select.innerHTML = sortedByDate(MOCK_CONCERTS).map(c => `
    <option value="${c.id}">${c.title} — ${formatDateShort(c.date)}</option>
  `).join("");
  selectedEventId = select.value;
}

function getSelectedEventAttendees() {
  return MOCK_ATTENDEES.filter(attendee => attendee.eventId === selectedEventId);
}

function renderCheckinStats() {
  const attendees = getSelectedEventAttendees();
  const checkedIn = attendees.filter(attendee => attendee.checkedIn).length;
  const totalEl = document.getElementById("total-attendees-count");
  const checkedEl = document.getElementById("checked-in-count");
  const pendingEl = document.getElementById("not-checked-in-count");
  if (totalEl) totalEl.textContent = attendees.length;
  if (checkedEl) checkedEl.textContent = checkedIn;
  if (pendingEl) pendingEl.textContent = attendees.length - checkedIn;
}

function renderAttendees() {
  const tbody = document.getElementById("attendee-table-body");
  if (!tbody) return;

  const filteredAttendees = getSelectedEventAttendees().filter(attendee => {
    const searchableText = `${attendee.id} ${attendee.name} ${attendee.email}`.toLowerCase();
    const matchesSearch = searchableText.includes(attendeeSearch);
    const matchesStatus = attendeeStatusFilter === "all"
      || (attendeeStatusFilter === "checked" && attendee.checkedIn)
      || (attendeeStatusFilter === "pending" && !attendee.checkedIn);
    return matchesSearch && matchesStatus;
  });

  const pageCount = Math.max(1, Math.ceil(filteredAttendees.length / ATTENDEES_PER_PAGE));
  attendeePage = Math.min(attendeePage, pageCount);
  const start = (attendeePage - 1) * ATTENDEES_PER_PAGE;

  tbody.innerHTML = filteredAttendees.slice(start, start + ATTENDEES_PER_PAGE).map(attendee => `
    <tr>
      <td class="ticket-code">CT-EST-${attendee.id}</td>
      <td>
        <div class="attendee-name">${attendee.name}</div>
        <div class="attendee-email">${attendee.email}</div>
      </td>
      <td>${attendee.type}</td>
      <td><span class="badge ${attendee.checkedIn ? "badge-green" : "badge-gray"}">${attendee.checkedIn ? "Checked in" : "Not checked in"}</span></td>
      <td>
        ${attendee.checkedIn
          ? `<span class="btn-checked"><i class="fa-solid fa-circle-check"></i> ${attendee.time}</span>`
          : `<button class="btn btn-primary btn-checkin" data-attendee-id="${attendee.id}">Check in</button>`}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="text-muted">No attendees found.</td></tr>`;

  const caption = document.getElementById("attendee-count-caption");
  const firstResult = filteredAttendees.length ? start + 1 : 0;
  const lastResult = Math.min(start + ATTENDEES_PER_PAGE, filteredAttendees.length);
  if (caption) caption.textContent = `Showing ${firstResult}–${lastResult} of ${filteredAttendees.length} attendees`;
  renderAttendeePagination(pageCount);
}

function renderAttendeePagination(pageCount) {
  const pagination = document.getElementById("attendee-pagination");
  if (!pagination) return;

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

document.addEventListener("DOMContentLoaded", () => {
  resetFutureConcertAttendees();
  renderEventOptions();
  renderCheckinStats();
  renderAttendees();

  document.getElementById("event").addEventListener("change", event => {
    selectedEventId = event.target.value;
    attendeePage = 1;
    attendeeSearch = "";
    document.getElementById("attendee-search").value = "";
    attendeeStatusFilter = "all";
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.status === "all"));
    renderCheckinStats();
    renderAttendees();
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
    if (!button) return;
    const attendee = MOCK_ATTENDEES.find(item => item.id === button.dataset.attendeeId);
    if (!attendee) return;
    if (!hasConcertStarted(attendee)) return;
    attendee.checkedIn = true;
    attendee.time = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    renderCheckinStats();
    renderAttendees();
  });
});
