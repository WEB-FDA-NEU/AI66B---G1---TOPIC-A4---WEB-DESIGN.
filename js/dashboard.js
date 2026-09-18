// js/dashboard.js

const ORDER_STATUS_BADGE_CLASS = {
  Paid: "badge-green",
  Pending: "badge-amber",
  Refunded: "badge-red"
};
const ORDERS_PER_PAGE = 5;
let recentOrdersPage = 1;
let showAllRecentOrders = false;

function renderUpcomingConcerts() {
  const list = document.getElementById("upcoming-concerts-list");
  if (!list) return;

  const now = new Date();
  const upcoming = sortedByDate(MOCK_CONCERTS).filter(concert => {
    const status = getConcertStatus(concert, now);
    return status === "Upcoming" || status === "On Sale / Open";
  });

  list.innerHTML = upcoming.map(c => `
    <div class="mini-list-item">
      <img class="mini-thumb" src="${c.poster}" alt="">
      <div class="mini-list-info">
        <div class="mini-list-title">${c.title}</div>
        <div class="mini-list-sub">${c.artist} · ${formatDateShort(c.date)}</div>
      </div>
      <span class="badge ${badgeClassFor(getConcertStatus(c))}">${getConcertStatus(c)}</span>
    </div>
  `).join("");

  const countEl = document.getElementById("stat-upcoming-count");
  if (countEl) countEl.textContent = upcoming.length;

  const monthCountEl = document.getElementById("upcoming-month-count");
  if (monthCountEl) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonthCount = upcoming.filter(concert => {
      const concertDate = new Date(`${concert.date}T${concert.time}`);
      return concertDate >= monthStart && concertDate < nextMonthStart;
    }).length;
    monthCountEl.textContent = `${thisMonthCount} this month`;
  }
}

function renderTodayCheckins() {
  const countEl = document.getElementById("stat-checkins-today");
  const contextEl = document.getElementById("checkins-today-context");
  if (!countEl || !contextEl) return;

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
  const todayConcerts = MOCK_CONCERTS.filter(concert => concert.date === todayString);

  countEl.textContent = "0";
  contextEl.textContent = todayConcerts.length
    ? `No check-ins recorded for ${todayConcerts[0].title}`
    : "No concert scheduled today";
}

function renderConcertRevenue() {
  const chart = document.getElementById("concert-revenue-chart");
  if (!chart) return;

  const revenueByConcert = MOCK_ORDERS.reduce((totals, order) => {
    totals[order.concert] = (totals[order.concert] || 0) + order.amount;
    return totals;
  }, {});
  const revenues = MOCK_CONCERTS.map(concert => ({
    title: concert.title,
    revenue: revenueByConcert[concert.title] || 0
  }));
  const maxRevenue = Math.max(...revenues.map(item => item.revenue), 1);

  chart.innerHTML = revenues.map(item => {
    const height = item.revenue ? Math.max((item.revenue / maxRevenue) * 100, 8) : 3;
    return `
      <div class="bar-chart-col" title="${item.title}: $${item.revenue.toFixed(2)}">
        <span class="bar-chart-value">$${item.revenue.toFixed(0)}</span>
        <div class="bar-chart-bar${item.revenue === maxRevenue ? " filled" : ""}" style="height: ${height}%"></div>
        <span class="bar-chart-label">${item.title}</span>
      </div>
    `;
  }).join("");
}

function renderRecentOrders() {
  const tbody = document.getElementById("recent-orders-body");
  if (!tbody) return;

  const pageCount = Math.max(1, Math.ceil(MOCK_ORDERS.length / ORDERS_PER_PAGE));
  recentOrdersPage = Math.min(recentOrdersPage, pageCount);
  const start = (recentOrdersPage - 1) * ORDERS_PER_PAGE;
  const visibleOrders = showAllRecentOrders
    ? MOCK_ORDERS
    : MOCK_ORDERS.slice(start, start + ORDERS_PER_PAGE);

  tbody.innerHTML = visibleOrders.map(order => `
    <tr>
      <td class="text-muted">${order.orderId}</td>
      <td>${order.customer}</td>
      <td>${order.concert}</td>
      <td>$${order.amount.toFixed(2)}</td>
      <td class="text-muted">${order.date}</td>
      <td><span class="badge ${ORDER_STATUS_BADGE_CLASS[order.status] || "badge-gray"}">${order.status}</span></td>
    </tr>
  `).join("");

  const caption = document.getElementById("recent-orders-caption");
  if (caption) {
    caption.textContent = showAllRecentOrders
      ? `Showing 1–${MOCK_ORDERS.length} of ${MOCK_ORDERS.length} orders`
      : `Showing ${start + 1}–${Math.min(start + ORDERS_PER_PAGE, MOCK_ORDERS.length)} of ${MOCK_ORDERS.length} orders`;
  }
  const viewAllButton = document.getElementById("recent-orders-view-all");
  if (viewAllButton) viewAllButton.textContent = showAllRecentOrders ? "Show recent" : "View all";
  const pagination = document.getElementById("recent-orders-pagination");
  if (pagination) pagination.hidden = showAllRecentOrders;
  if (!showAllRecentOrders) renderRecentOrdersPagination(pageCount);
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
  renderUpcomingConcerts();
  renderTodayCheckins();
  renderConcertRevenue();
  renderRecentOrders();
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
