// js/main.js

// Featured artist IDs for the Home page: Ariana Grande (c1), Cortis (c11), Lisa (c5), Bruno Mars (c7)
const HOME_ARTIST_IDS = ["c1", "c11", "c5", "c7"];

// Generate HTML markup for a single concert card compatible with current CSS
function createConcertCardHTML(show, isHome = false) {
  const detailLink = isHome 
    ? `pages/concerts/detail.html?id=${show.id}` 
    : `detail.html?id=${show.id}`;

  return `
    <article class="card">
      <img src="${show.poster}" alt="${show.artist}" class="card-img" style="object-position: top center;" loading="lazy">
      <div class="card-body">
        <span class="card-badge">${show.category} • ${show.status}</span>
        <a href="${detailLink}" class="card-title">${show.title}</a>
        <div class="card-meta">${show.artist} | ${show.date}</div>
        <p class="card-location" style="font-size: var(--font-xs); color: var(--color-text-secondary); margin-bottom: var(--space-xs);">${show.location}</p>
        <div class="card-footer">
          <span class="card-price">${show.priceRange}</span>
          <a href="${detailLink}" class="btn btn-primary" style="padding: 6px 14px; font-size: var(--font-xs);">Book Tickets</a>
        </div>
      </div>
    </article>
  `;
}

// 1. Render the Home page (supports both 'concert-list' and 'trending-grid' container IDs)
function renderHomePage() {
  const homeContainer = document.getElementById("concert-list") || document.getElementById("trending-grid");
  if (!homeContainer || typeof MOCK_CONCERTS === "undefined") return;

  const homeConcerts = MOCK_CONCERTS.filter(c => HOME_ARTIST_IDS.includes(c.id));
  homeContainer.innerHTML = homeConcerts.map(show => createConcertCardHTML(show, true)).join("");
}

// 2. Render the Explore page (displays full concert lineup)
function renderExplorePage(filterList = MOCK_CONCERTS) {
  const exploreContainer = document.getElementById("explore-grid");
  if (!exploreContainer || typeof MOCK_CONCERTS === "undefined") return;

  if (filterList.length === 0) {
    exploreContainer.innerHTML = `<p class="no-results">No concerts found matching your criteria.</p>`;
    return;
  }

  exploreContainer.innerHTML = filterList.map(show => createConcertCardHTML(show, false)).join("");
}

// Initialize rendering when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  renderHomePage();
  renderExplorePage();
});