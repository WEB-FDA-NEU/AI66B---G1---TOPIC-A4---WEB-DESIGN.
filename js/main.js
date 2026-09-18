// 4 Featured artists displayed on Home page: Ariana (c1), Cortis (c11), Lisa (c5), Bruno Mars (c7)
const HOME_ARTIST_IDS = ["c1", "c11", "c5", "c7"];

// 1. Hero Carousel Controller with Sliding & Touch/Mouse Drag
function initHeroCarousel() {
  const wrapper = document.getElementById("hero-wrapper");
  const track = document.getElementById("hero-track");
  if (!wrapper || !track) return;

  const concerts = (typeof MOCK_CONCERTS !== "undefined" && Array.isArray(MOCK_CONCERTS)) ? MOCK_CONCERTS : [];
  if (concerts.length === 0) return;

  const heroDots = document.getElementById("hero-dots");
  const prevBtn = document.getElementById("hero-prev");
  const nextBtn = document.getElementById("hero-next");

  let currentIndex = 0;
  let autoTimer = null;
  let isDragging = false;
  let startX = 0;
  let currentTranslate = 0;
  let prevTranslate = 0;

  // Render slides into the track
  track.innerHTML = concerts.map((concert) => {
    const bannerUrl = concert.banner || concert.image || concert.poster || concert.cover || '';
    const descText = concert.description || concert.desc || 'Experience world-class concerts live on stage.';
    const categoryText = concert.category || 'World Tour';
    const statusText = concert.status || 'Selling Fast';
    const titleText = concert.title || concert.name || 'Concert Tour';

    return `
      <div class="hero-slide" style="background-image: linear-gradient(rgba(11, 11, 15, 0.75), rgba(11, 11, 15, 0.95)), url('${bannerUrl}'); background-position: center 20%;">
        <div class="container">
          <span class="hero-tag">${categoryText} • ${statusText}</span>
          <h1 class="hero-title">${titleText}</h1>
          <p class="hero-desc">${descText}</p>
          <div class="hero-actions">
            <a href="pages/concerts/detail.html?id=${concert.id}" class="btn btn-primary">Book Tickets</a>
            <a href="pages/concerts/index.html" class="btn btn-secondary">Explore All Tours</a>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Render pagination dots
  if (heroDots) {
    heroDots.innerHTML = concerts.map((_, idx) => 
      `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>`
    ).join("");

    heroDots.querySelectorAll(".carousel-dot").forEach(dot => {
      dot.addEventListener("click", (e) => {
        currentIndex = parseInt(e.target.dataset.index, 10);
        setPositionByIndex();
        resetTimer();
      });
    });
  }

  function setSliderPosition() {
    track.style.transform = `translateX(${currentTranslate}px)`;
  }

  function setPositionByIndex() {
    currentTranslate = currentIndex * -wrapper.offsetWidth;
    prevTranslate = currentTranslate;
    track.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
    setSliderPosition();

    if (heroDots) {
      heroDots.querySelectorAll(".carousel-dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentIndex);
      });
    }
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % concerts.length;
    setPositionByIndex();
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + concerts.length) % concerts.length;
    setPositionByIndex();
  }

  function resetTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(nextSlide, 2800); // 2.8-second auto-slide interval
  }

  if (nextBtn) nextBtn.addEventListener("click", () => { nextSlide(); resetTimer(); });
  if (prevBtn) prevBtn.addEventListener("click", () => { prevSlide(); resetTimer(); });

  // Mouse and Touch Gesture Handlers
  function dragStart(e) {
    isDragging = true;
    startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    track.classList.add('dragging');
    clearInterval(autoTimer);
  }

  function dragMove(e) {
    if (!isDragging) return;
    const currentX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    currentTranslate = prevTranslate + (currentX - startX);
    setSliderPosition();
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    track.classList.remove('dragging');

    const movedBy = currentTranslate - prevTranslate;
    if (movedBy < -100 && currentIndex < concerts.length - 1) {
      currentIndex += 1;
    } else if (movedBy > 100 && currentIndex > 0) {
      currentIndex -= 1;
    }

    setPositionByIndex();
    resetTimer();
  }

  track.addEventListener('mousedown', dragStart);
  track.addEventListener('mousemove', dragMove);
  track.addEventListener('mouseup', dragEnd);
  track.addEventListener('mouseleave', () => { if (isDragging) dragEnd(); });

  track.addEventListener('touchstart', dragStart, { passive: true });
  track.addEventListener('touchmove', dragMove, { passive: true });
  track.addEventListener('touchend', dragEnd);

  window.addEventListener('resize', setPositionByIndex);

  setPositionByIndex();
  resetTimer();
}

// 2. Generate HTML markup for a concert card
function createConcertCardHTML(show, isHome = false) {
  const detailLink = isHome 
    ? `pages/concerts/detail.html?id=${show.id}` 
    : `detail.html?id=${show.id}`;

  const posterUrl = show.poster || show.image || show.banner || '';

  return `
    <article class="card">
      <img src="${posterUrl}" alt="${show.artist || show.title}" class="card-img" style="object-position: top center;" loading="lazy">
      <div class="card-body">
        <span class="card-badge">${show.category || 'Concert'} • ${show.status || 'Available'}</span>
        <a href="${detailLink}" class="card-title">${show.title}</a>
        <div class="card-meta">${show.artist} | ${show.date}</div>
        <div class="card-footer">
          <span class="card-price">${show.priceRange || '$50 - $250'}</span>
          <a href="${detailLink}" class="btn btn-primary" style="padding: 6px 14px; font-size: var(--font-xs);">Details</a>
        </div>
      </div>
    </article>
  `;
}

// 3. Render Home page (4 featured artists)
function renderHomePage() {
  const homeContainer = document.getElementById("concert-list") || document.getElementById("trending-grid");
  if (!homeContainer || typeof MOCK_CONCERTS === "undefined") return;

  const homeConcerts = MOCK_CONCERTS.filter(c => HOME_ARTIST_IDS.includes(c.id));
  homeContainer.innerHTML = homeConcerts.map(show => createConcertCardHTML(show, true)).join("");
}

// 4. Render Explore page (all concerts)
function renderExplorePage(filterList = (typeof MOCK_CONCERTS !== "undefined" ? MOCK_CONCERTS : [])) {
  const exploreContainer = document.getElementById("explore-grid");
  if (!exploreContainer) return;

  if (filterList.length === 0) {
    exploreContainer.innerHTML = `<p class="no-results">No concerts found matching your criteria.</p>`;
    return;
  }

  exploreContainer.innerHTML = filterList.map(show => createConcertCardHTML(show, false)).join("");
}

// Global execution
document.addEventListener("DOMContentLoaded", () => {
  initHeroCarousel();
  renderHomePage();
  renderExplorePage();
});