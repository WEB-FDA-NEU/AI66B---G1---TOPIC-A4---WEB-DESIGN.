// js/dashboard.js — admin dashboard backed by the API (#38).
// Figures: GET /api/admin/stats; per-concert revenue and upcoming shows:
// GET /api/admin/stats/concerts; recent orders: GET /api/admin/orders.

const ORDER_STATUS_BADGE = {
  paid: ["Paid", "badge-green"],
  pending: ["Pending", "badge-amber"],
  failed: ["Failed", "badge-red"],
  cancelled: ["Cancelled", "badge-gray"],
  refunded: ["Refunded", "badge-red"],
};
const ORDERS_PER_PAGE = 5;
const ALL_ORDERS_PAGE_SIZE = 100;
let recentOrdersPage = 1;
let showAllRecentOrders = false;
let showAllRevenue = false;
let concertStats = [];

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function errorRow(message, colspan) {
  return `<tr><td colspan="${colspan}" class="text-muted">${adminEscape(message)}</td></tr>`;
}

function errorBlock(message) {
  return `<p class="text-muted" role="alert">${adminEscape(message)}</p>`;
}

/* ---------------------------------------------------------------- stat cards */

async function loadStats() {
  const ids = ["stat-total-revenue", "stat-tickets-sold", "stat-total-orders", "stat-total-concerts",
    "stat-upcoming-count", "stat-checkins-today"];
  ids.forEach(id => setText(id, "…"));
  try {
    const s = await ConcertlyAPI.adminStats();
    setText("stat-total-revenue", adminMoney(s.totalRevenue));
    setText("stat-tickets-sold", s.ticketsSold.toLocaleString("en-US"));
    setText("stat-total-orders", s.totalOrders.toLocaleString("en-US"));
    setText("stat-total-concerts", s.totalConcerts.toLocaleString("en-US"));
    setText("stat-upcoming-count", s.upcomingConcerts.toLocaleString("en-US"));
    setText("stat-checkins-today", s.checkinsToday.toLocaleString("en-US"));
    document.getElementById("stats-error").hidden = true;
  } catch (error) {
    ids.forEach(id => setText(id, "—"));
    const box = document.getElementById("stats-error");
    box.textContent = adminApiError(error);
    box.hidden = false;
  }
}

/* ------------------------------------------------- revenue + upcoming concerts */

function renderConcertRevenue() {
  const chart = document.getElementById("concert-revenue-chart");
  if (!chart) return;

  const revenues = concertStats
    .filter(c => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const visible = showAllRevenue ? revenues : revenues.slice(0, 5);
  const maxRevenue = Math.max(...revenues.map(c => c.revenue), 1);

  chart.innerHTML = visible.map(c => `
      <div class="revenue-item" title="${adminEscape(c.title)}">
        <span class="revenue-title">${adminEscape(c.title)}</span>
        <div class="revenue-bar" aria-hidden="true">
          <span class="revenue-bar-fill" style="width: ${(c.revenue / maxRevenue) * 100}%"></span>
        </div>
        <span class="revenue-value">${adminMoney(c.revenue)}</span>
      </div>
    `).join("") || errorBlock("No paid orders yet.");

  const toggle = document.getElementById("revenue-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(showAllRevenue));
    toggle.setAttribute("aria-label", showAllRevenue ? "Show top 5 revenue concerts" : "Show full revenue list");
    toggle.title = showAllRevenue ? "Show top 5 revenue concerts" : "Show full revenue list";
  }
}

function renderUpcomingConcerts() {
  const list = document.getElementById("upcoming-concerts-list");
  if (!list) return;
  const upcoming = concertStats.filter(c => c.upcoming); // API sorts soonest first

  list.innerHTML = upcoming.slice(0, 4).map(c => {
    const capacity = Math.max(c.capacity, 1);
    const sold = Math.min(c.ticketsSold, capacity);
    const soldPercent = Math.round((sold / capacity) * 100);
    return `
      <div class="mini-list-item">
        ${c.poster_url ? `<img class="mini-thumb" src="${adminEscape(c.poster_url)}" alt="">` : ""}
        <div class="mini-list-info">
          <div class="mini-list-title">${adminEscape(c.title)}</div>
          <div class="mini-list-sub">${adminEscape(c.artist)} · ${adminDate(c.starts_at)}</div>
          <div class="mini-sales" aria-label="${sold} of ${c.capacity} tickets sold">
            <div class="mini-sales-meta">
              <span>${sold.toLocaleString("en-US")} / ${c.capacity.toLocaleString("en-US")} sold</span>
              <span>${soldPercent}%</span>
            </div>
            <div class="mini-progress" role="progressbar" aria-valuenow="${soldPercent}" aria-valuemin="0" aria-valuemax="100">
              <span style="width: ${soldPercent}%"></span>
            </div>
            <div class="mini-sales-remaining">${(c.capacity - sold).toLocaleString("en-US")} tickets remaining</div>
          </div>
        </div>
        ${adminConcertBadge(c.status)}
      </div>
    `;
  }).join("") || errorBlock("No upcoming concerts.");

  const now = new Date();
  const thisMonth = upcoming.filter(c => {
    const d = new Date(c.starts_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  setText("upcoming-month-count", `${thisMonth} this month`);
}

async function loadConcertStats() {
  document.getElementById("concert-revenue-chart").innerHTML = errorBlock("Loading…");
  document.getElementById("upcoming-concerts-list").innerHTML = errorBlock("Loading…");
  try {
    concertStats = await ConcertlyAPI.adminConcertStats();
  } catch (error) {
    const message = errorBlock(adminApiError(error));
    document.getElementById("concert-revenue-chart").innerHTML = message;
    document.getElementById("upcoming-concerts-list").innerHTML = message;
    return;
  }
  renderConcertRevenue();
  renderUpcomingConcerts();
}

/* -------------------------------------------------------------- recent orders */

function orderStatusKey(order) {
  return order.refund_status === "refunded" ? "refunded" : order.status;
}

async function renderRecentOrders() {
  const tbody = document.getElementById("recent-orders-body");
  if (!tbody) return;
  tbody.innerHTML = errorRow("Loading orders…", 6);

  let page;
  try {
    page = await ConcertlyAPI.adminOrders(
      showAllRecentOrders
        ? { page: 1, page_size: ALL_ORDERS_PAGE_SIZE }
        : { page: recentOrdersPage, page_size: ORDERS_PER_PAGE },
    );
  } catch (error) {
    tbody.innerHTML = errorRow(adminApiError(error), 6);
    setText("recent-orders-caption", "");
    document.getElementById("recent-orders-pagination").innerHTML = "";
    return;
  }

  tbody.innerHTML = page.items.map(order => {
    const [label, cls] = ORDER_STATUS_BADGE[orderStatusKey(order)] || [order.status, "badge-gray"];
    return `
    <tr>
      <td class="text-muted">${adminEscape(ConcertlyCodes.order(order))}</td>
      <td>${adminEscape(order.customer.full_name)}<div class="text-muted">${adminEscape(order.customer.email)}</div></td>
      <td>${adminEscape(order.concert_title)}</td>
      <td>${adminMoney(order.total_amount, 2)}</td>
      <td class="text-muted">${adminDate(order.created_at)}</td>
      <td><span class="badge ${cls}">${adminEscape(label)}</span></td>
    </tr>`;
  }).join("") || errorRow("No orders yet.", 6);

  const first = page.total ? (page.page - 1) * page.page_size + 1 : 0;
  const last = (page.page - 1) * page.page_size + page.items.length;
  setText(
    "recent-orders-caption",
    `Showing ${first}–${last} of ${page.total} orders`
      + (showAllRecentOrders && page.total > page.items.length ? ` (latest ${page.items.length})` : ""),
  );
  setText("recent-orders-view-all", showAllRecentOrders ? "Show recent" : "View all");
  const pagination = document.getElementById("recent-orders-pagination");
  pagination.hidden = showAllRecentOrders;
  if (!showAllRecentOrders) renderRecentOrdersPagination(Math.max(page.pages, 1));
}

function renderRecentOrdersPagination(pageCount) {
  const pagination = document.getElementById("recent-orders-pagination");
  if (!pagination) return;

  pagination.innerHTML = `
    <button class="page-btn" data-page-action="previous" aria-label="Previous page" ${recentOrdersPage === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-angle-left"></i>
    </button>
    ${Array.from({ length: pageCount }, (_, index) => `
      <button class="page-btn${index + 1 === recentOrdersPage ? " active" : ""}" data-page="${index + 1}">${index + 1}</button>
    `).join("")}
    <button class="page-btn" data-page-action="next" aria-label="Next page" ${recentOrdersPage === pageCount ? "disabled" : ""}>
      <i class="fa-solid fa-angle-right"></i>
    </button>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadConcertStats();
  renderRecentOrders();

  document.getElementById("revenue-toggle").addEventListener("click", () => {
    showAllRevenue = !showAllRevenue;
    renderConcertRevenue();
  });
  document.getElementById("recent-orders-view-all").addEventListener("click", () => {
    showAllRecentOrders = !showAllRecentOrders;
    recentOrdersPage = 1;
    renderRecentOrders();
  });
  document.getElementById("recent-orders-pagination").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.page) recentOrdersPage = Number(button.dataset.page);
    if (button.dataset.pageAction === "previous") recentOrdersPage--;
    if (button.dataset.pageAction === "next") recentOrdersPage++;
    renderRecentOrders();
  });
});
