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

  // Only feature a handful of slides in the hero (not the whole catalogue) —
  // keeps the dots readable and the banner feeling curated.
  const MAX_HERO_SLIDES = 5;
  const slides = concerts.slice(0, MAX_HERO_SLIDES);
  const slideCount = slides.length;

  // True infinite loop: clone the last slide to the front and the first
  // slide to the end, so "next" from the last real slide and "prev" from
  // the first real slide both animate smoothly in one direction instead of
  // snapping/rewinding backwards across the whole track.
  let currentIndex = 1; // index 0 is the cloned last slide
  let autoTimer = null;
  let isDragging = false;
  let startX = 0;
  let currentTranslate = 0;
  let prevTranslate = 0;
  let isSnapping = false;
  let ignoreNextSlideClick = false;

  function renderSlide(concert) {
    const bannerUrl = concert.banner || concert.image || concert.poster || concert.cover || '';
    const descText = concert.description || concert.desc || 'Experience world-class concerts live on stage.';
    const categoryText = concert.category || 'World Tour';
    const statusText = concert.status || 'Selling Fast';
    const statusClass = getStatusTagClass(statusText);
    const titleText = concert.title || concert.name || 'Concert Tour';

    return `
      <div class="hero-slide" data-href="pages/concerts/detail.html?id=${concert.id}" style="background-image: linear-gradient(180deg, rgba(11, 11, 15, 0.15) 0%, rgba(11, 11, 15, 0.35) 45%, rgba(11, 11, 15, 0.85) 78%, var(--color-bg) 100%), url('${bannerUrl}'); background-position: center 20%;">
        <div class="container">
          <div class="hero-tags">
            <span class="hero-tag">${categoryText}</span>
            <span class="status-tag inline ${statusClass}">${statusText}</span>
          </div>
          <h1 class="hero-title">${titleText}</h1>
          <p class="hero-desc">${descText}</p>
        </div>
      </div>
    `;
  }

  // Render slides into the track, with clones at each end for the loop
  const slidesMarkup = [slides[slideCount - 1], ...slides, slides[0]].map(renderSlide);
  track.innerHTML = slidesMarkup.join("");

  track.querySelectorAll(".hero-slide").forEach((slide) => {
    slide.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      if (ignoreNextSlideClick) {
        ignoreNextSlideClick = false;
        return;
      }
      window.location.href = slide.dataset.href;
    });
  });

  // Render pagination dots (only for the real slides)
  if (heroDots) {
    heroDots.innerHTML = slides.map((_, idx) =>
      `<span class="carousel-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>`
    ).join("");

    heroDots.querySelectorAll(".carousel-dot").forEach(dot => {
      dot.addEventListener("click", (e) => {
        currentIndex = parseInt(e.target.dataset.index, 10) + 1;
        setPositionByIndex();
        resetTimer();
      });
    });
  }

  function setSliderPosition() {
    track.style.transform = `translateX(${currentTranslate}px)`;
  }

  function updateDots() {
    if (!heroDots) return;
    const realIndex = (currentIndex - 1 + slideCount) % slideCount;
    heroDots.querySelectorAll(".carousel-dot").forEach((dot, idx) => {
      dot.classList.toggle("active", idx === realIndex);
    });
  }

  function setPositionByIndex(withTransition = true) {
    currentTranslate = currentIndex * -wrapper.offsetWidth;
    prevTranslate = currentTranslate;
    track.style.transition = withTransition ? 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
    setSliderPosition();
    updateDots();
  }

  // After the slide animation into a cloned edge finishes, jump instantly
  // (no transition) to the matching real slide so the loop feels seamless.
  track.addEventListener('transitionend', () => {
    if (isSnapping) return;
    if (currentIndex === 0) {
      isSnapping = true;
      currentIndex = slideCount;
      setPositionByIndex(false);
      requestAnimationFrame(() => { isSnapping = false; });
    } else if (currentIndex === slideCount + 1) {
      isSnapping = true;
      currentIndex = 1;
      setPositionByIndex(false);
      requestAnimationFrame(() => { isSnapping = false; });
    }
  });

  function nextSlide() {
    currentIndex += 1;
    setPositionByIndex();
  }

  function prevSlide() {
    currentIndex -= 1;
    setPositionByIndex();
  }

  function resetTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(nextSlide, 4500); // auto-slide interval
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
    if (Math.abs(movedBy) > 10) ignoreNextSlideClick = true;
    if (movedBy < -100) {
      currentIndex += 1;
    } else if (movedBy > 100) {
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

  window.addEventListener('resize', () => setPositionByIndex(false));

  setPositionByIndex(false);
  resetTimer();
}

// Map a concert's status text to a clean color-coded tag (no emoji)
function getStatusTagClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('selling')) return 'selling-fast';
  if (s.includes('popular')) return 'hot';
  if (s.includes('limited availability')) return 'high-demand';
  return 'default';
}

function getStatusTagTitle(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('selling')) return 'Vé đang bán nhanh — sắp hết';
  if (s.includes('popular')) return 'Most popular concert';
  if (s.includes('limited availability')) return 'Limited tickets remaining';
  return 'Còn vé';
}

// 2. Generate HTML markup for a concert card
function createConcertCardHTML(show, isHome = false) {
  const detailLink = isHome 
    ? `pages/concerts/detail.html?id=${show.id}` 
    : `detail.html?id=${show.id}`;

  const posterUrl = show.poster || show.image || show.banner || '';
  const statusClass = getStatusTagClass(show.status);

  return `
    <article class="card concert-card" data-href="${detailLink}" tabindex="0" role="link">
      <div class="card-media">
        <img src="${posterUrl}" alt="${show.artist || show.title}" class="card-img" style="object-position: top center;" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-labels">
          <span class="card-badge">${show.category || 'Concert'}</span>
          <span class="status-tag ${statusClass}" title="${getStatusTagTitle(show.status)}">${show.status || 'Available'}</span>
        </div>
        <a href="${detailLink}" class="card-title">${show.title}</a>
        <div class="card-meta">${show.artist} | ${show.date}</div>
        <div class="card-footer">
          <span class="card-price">${show.priceRange || '$50 - $250'}</span>
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
  initClickableConcertCards(homeContainer);
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
  initClickableConcertCards(exploreContainer);
}

function initClickableConcertCards(container) {
  container.querySelectorAll(".concert-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      window.location.href = card.dataset.href;
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.href = card.dataset.href;
    });
  });
}

// Global execution
document.addEventListener("DOMContentLoaded", () => {
  initHeroCarousel();
  renderHomePage();
  renderExplorePage();
});