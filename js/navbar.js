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
  initAuthGuards();
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
    window.location.href = auth.closest("[data-home]")?.dataset.home || "index.html";
  });
}

function initAuthGuards() {
  const guardedElements = document.querySelectorAll("[data-requires-auth]");
  if (!guardedElements.length || localStorage.getItem("concertlyUser")) return;

  const loginLink = document.querySelector("[data-auth-login]");
  const loginUrl = loginLink ? loginLink.href : "#";

  guardedElements.forEach((element) => {
    const wrapper = document.createElement("span");
    wrapper.className = "auth-guard-wrapper";
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);

    const message = document.createElement("span");
    message.className = "auth-guard-message";
    message.innerHTML = `You need to sign in before continuing. <a href="${loginUrl}">Sign in</a>`;
    wrapper.appendChild(message);

    const showMessage = () => wrapper.classList.add("is-visible");
    const hideMessage = () => wrapper.classList.remove("is-visible");

    element.addEventListener("click", (event) => {
      event.preventDefault();
      showMessage();
    });
    element.addEventListener("mouseenter", showMessage);
    element.addEventListener("mouseleave", hideMessage);
    element.addEventListener("focus", showMessage);
    element.addEventListener("blur", hideMessage);
  });
}