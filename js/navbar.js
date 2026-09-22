// Shared header behavior across all pages (index, explore, detail, 404):
// 1. Sticky header gets a solid/darker background once the page scrolls,
//    so text stays readable when content scrolls underneath it.
// 2. A single sliding underline ("nav-indicator") animates to whichever
//    nav link is hovered, and glides back to the current page's link
//    when the mouse leaves the nav — instead of a static underline.
document.addEventListener("DOMContentLoaded", () => {
  initStickyHeader();
  initNavIndicator();
  initAuthMenu();
});

function initStickyHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const updateHeaderState = () => {
    header.classList.toggle("scrolled", window.scrollY > 8);
  };

  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });
}

function initNavIndicator() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  const indicator = nav.querySelector(".nav-indicator");
  const links = nav.querySelectorAll("a[data-nav]");
  if (!indicator || !links.length) return;

  const moveIndicatorTo = (el) => {
    indicator.style.left = el.offsetLeft + "px";
    indicator.style.width = el.offsetWidth + "px";
    indicator.style.opacity = "1";
  };

  const activeLink = nav.querySelector("a.active") || links[0];
  indicator.style.transition = "none";
  moveIndicatorTo(activeLink);
  requestAnimationFrame(() => { indicator.style.transition = ""; });

  // Mark JS as initialized so the CSS-only fallback underline (::after)
  // hides itself and the sliding indicator takes over.
  nav.classList.add("js-ready");

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => moveIndicatorTo(link));
  });

  nav.addEventListener("mouseleave", () => moveIndicatorTo(activeLink));
  window.addEventListener("resize", () => moveIndicatorTo(activeLink));

  // Safety net: recompute once everything (fonts/images) has fully loaded,
  // in case layout shifted slightly after the first paint.
  window.addEventListener("load", () => moveIndicatorTo(activeLink));
}

function initAuthMenu() {
  const auth = document.querySelector(".site-auth");
  if (!auth) return;

  const loginLink = auth.querySelector("[data-auth-login]");
  const logoutButton = auth.querySelector("[data-auth-logout]");
  const isLoggedIn = Boolean(localStorage.getItem("concertlyUser"));

  loginLink.hidden = isLoggedIn;
  logoutButton.hidden = !isLoggedIn;

  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("concertlyUser");
    window.location.href = "index.html";
  });
}