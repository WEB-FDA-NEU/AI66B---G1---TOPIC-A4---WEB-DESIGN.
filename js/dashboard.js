// js/dashboard.js

const ORDER_STATUS_BADGE_CLASS = {
  Paid: "badge-green",
  Pending: "badge-amber",
  Refunded: "badge-red"
};
const ORDERS_PER_PAGE = 5;
let recentOrdersPage = 1;
let showAllRecentOrders = false;
let showAllRevenue = false;

function getCompletedOrders() {
  return MOCK_ORDERS.filter(order => order.status === "Paid");
}

function renderSalesStats() {
  const completedOrders = getCompletedOrders();
  const totalRevenue = completedOrders.reduce((total, order) => total + order.amount, 0);
  const revenueEl = document.getElementById("stat-total-revenue");
  const ticketsEl = document.getElementById("stat-tickets-sold");

  if (revenueEl) revenueEl.textContent = `$${totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (ticketsEl) ticketsEl.textContent = completedOrders.length.toLocaleString("en-US");
}

function renderUpcomingConcerts() {
  const list = document.getElementById("upcoming-concerts-list");
  if (!list) return;

  const now = new Date();
  const upcoming = sortedByDate(MOCK_CONCERTS).filter(concert => {
    const status = getConcertStatus(concert, now);
    return status === "Upcoming" || status === "On Sale";
  });

  list.innerHTML = upcoming.slice(0, 4).map(c => {
    const capacity = Math.max(Number(c.ticketCapacity) || 0, 1);
    const sold = Math.min(Math.max(Number(c.ticketsSold) || 0, 0), capacity);
    const remaining = capacity - sold;
    const soldPercent = Math.round((sold / capacity) * 100);
    const status = getConcertStatus(c);

    return `
      <div class="mini-list-item">
        <img class="mini-thumb" src="${c.poster}" alt="">
        <div class="mini-list-info">
          <div class="mini-list-title">${c.title}</div>
          <div class="mini-list-sub">${c.artist} · ${formatDateShort(c.date)}</div>
          <div class="mini-sales" aria-label="${sold} of ${capacity} tickets sold">
            <div class="mini-sales-meta">
              <span>${sold.toLocaleString("en-US")} / ${capacity.toLocaleString("en-US")} sold</span>
              <span>${soldPercent}%</span>
            </div>
            <div class="mini-progress" role="progressbar" aria-valuenow="${soldPercent}" aria-valuemin="0" aria-valuemax="100">
              <span style="width: ${soldPercent}%"></span>
            </div>
            <div class="mini-sales-remaining">${remaining.toLocaleString("en-US")} tickets remaining</div>
          </div>
        </div>
        <span class="badge ${badgeClassFor(status)}">${status}</span>
      </div>
    `;
  }).join("");

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

  const revenueByConcert = getCompletedOrders().reduce((totals, order) => {
    totals[order.concert] = (totals[order.concert] || 0) + order.amount;
    return totals;
  }, {});
  const revenues = MOCK_CONCERTS.map(concert => ({
    title: concert.title,
    revenue: revenueByConcert[concert.title] || 0
  }))
    .filter(item => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const visibleRevenues = showAllRevenue ? revenues : revenues.slice(0, 5);
  const maxRevenue = Math.max(...revenues.map(item => item.revenue), 1);

  chart.innerHTML = visibleRevenues.map(item => {
    const width = (item.revenue / maxRevenue) * 100;
    return `
      <div class="revenue-item" title="${item.title}">
        <span class="revenue-title">${item.title}</span>
        <div class="revenue-bar" aria-hidden="true">
          <span class="revenue-bar-fill" style="width: ${width}%"></span>
        </div>
        <span class="revenue-value">$${item.revenue.toFixed(0)}</span>
      </div>
    `;
  }).join("");

  const toggle = document.getElementById("revenue-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(showAllRevenue));
    toggle.setAttribute("aria-label", showAllRevenue ? "Show top 5 revenue concerts" : "Show full revenue list");
    toggle.title = showAllRevenue ? "Show top 5 revenue concerts" : "Show full revenue list";
  }
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
  renderSalesStats();
  renderUpcomingConcerts();
  renderTodayCheckins();
  renderConcertRevenue();
  document.getElementById("revenue-toggle").addEventListener("click", () => {
    showAllRevenue = !showAllRevenue;
    renderConcertRevenue();
  });
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
