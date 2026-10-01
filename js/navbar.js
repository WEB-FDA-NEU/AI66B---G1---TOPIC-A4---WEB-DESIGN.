// Shared header behavior across all pages (index, explore, detail, 404):
// 1. Sticky header gets a solid/darker background once the page scrolls,
//    so text stays readable when content scrolls underneath it.
// 2. A single sliding underline ("nav-indicator") animates to whichever
//    nav link is hovered, and glides back to the current page's link
//    when the mouse leaves the nav — instead of a static underline.
document.addEventListener("DOMContentLoaded", () => {
  initStickyHeader();
  initNavIndicator();
  initMobileNav();
  initMobileNavMotion();
  initAuthMenu();
  initAuthGuards();
});

function initMobileNav() {
  const header = document.querySelector(".site-header");
  const actions = header?.querySelector(".header-actions");
  const nav = actions?.querySelector(".site-nav");
  if (nav) {
    const icons = {
      Home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      Explore:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/></svg>',
      Support:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.8 1.3-1.8 2.7M12 17h.01"/></svg>',
    };

    nav.querySelectorAll("a[data-nav]").forEach((link) => {
      const label = link.textContent.trim();
      const icon = icons[label];
      if (!icon || link.querySelector(".mobile-nav-icon")) return;

      link.replaceChildren();
      const iconElement = document.createElement("span");
      iconElement.className = "mobile-nav-icon";
      iconElement.innerHTML = icon;
      const labelElement = document.createElement("span");
      labelElement.className = "mobile-nav-label";
      labelElement.textContent = label;
      link.append(iconElement, labelElement);
    });
  }

  const logo = header?.querySelector(".site-logo");
  const container = header?.querySelector(".container");
  const search = actions?.querySelector(".header-search");
  const auth = actions?.querySelector(".site-auth");
  if (!header || !actions || !logo || !container || !search || !auth) return;

  const controls = document.createElement("div");
  controls.className = "mobile-header-controls";
  const searchMarker = document.createComment("search position");
  const authMarker = document.createComment("account position");
  search.before(searchMarker);
  auth.before(authMarker);
  controls.append(auth);
  logo.after(controls);
  controls.after(search);

  const mobileQuery = window.matchMedia("(max-width: 768px)");

  const syncViewport = () => {
    if (mobileQuery.matches) {
      controls.append(auth);
      controls.after(search);
    } else {
      searchMarker.before(search);
      authMarker.before(auth);
    }
  };

  mobileQuery.addEventListener("change", syncViewport);
  syncViewport();
}

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

function initMobileNavMotion() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  const links = [...nav.querySelectorAll("a[data-nav]")];
  const activeIndex = links.findIndex((link) => link.classList.contains("active"));
  if (!links.length || activeIndex < 0) return;

  const highlight = document.createElement("span");
  highlight.className = "mobile-nav-highlight";
  highlight.setAttribute("aria-hidden", "true");
  nav.append(highlight);

  links.forEach((link, index) => {
    if (index === activeIndex) link.setAttribute("aria-current", "page");
  });

  const placeHighlight = (index, animate = true) => {
    const link = links[index];
    highlight.style.transition = animate ? "" : "none";
    highlight.style.width = `${link.offsetWidth}px`;
    highlight.style.transform = `translateX(${link.offsetLeft}px)`;
    highlight.style.opacity = "1";
  };

  placeHighlight(activeIndex, false);

  links.forEach((link, index) => {
    link.addEventListener("pointerdown", () => placeHighlight(index));
    link.addEventListener("focus", () => placeHighlight(index));
  });
  nav.addEventListener("pointerleave", () => placeHighlight(activeIndex));
  window.addEventListener("resize", () => placeHighlight(activeIndex, false));
}

function initAuthMenu() {
  const auth = document.querySelector(".site-auth");
  if (!auth) return;

  const menu = auth.querySelector(".auth-menu");
  const headerActions = document.querySelector(".header-actions");
  if (!menu || !headerActions) return;

  const rootUrl = new URL(headerActions.dataset.home || "index.html", window.location.href);
  const activeUser = localStorage.getItem("concertlyUser");
  if (!activeUser) {
    const guestLinks = [
      ["data-auth-login", "Sign in", "pages/auth/login.html"],
      ["data-auth-register", "Sign up", "pages/auth/register.html"],
    ];

    guestLinks.forEach(([attribute, label, path]) => {
      let link = menu.querySelector(`a[${attribute}]`);
      if (!link) {
        link = document.createElement("a");
        link.setAttribute(attribute, "");
        link.setAttribute("role", "menuitem");
        link.textContent = label;
        menu.append(link);
      }
      link.href = new URL(path, rootUrl).href;
    });
    return;
  }

  const greeting = document.createElement("span");
  greeting.className = "auth-menu-greeting";
  greeting.textContent = `Hi, ${activeUser}`;
  menu.replaceChildren(greeting);

  if (localStorage.getItem("userRole") === "customer") {
    const accountLinks = [
      ["My Tickets", "pages/me/tickets.html"],
      ["My Orders", "pages/me/orders.html"],
    ];
    accountLinks.forEach(([label, path]) => {
      const link = document.createElement("a");
      link.href = new URL(path, rootUrl).href;
      link.textContent = label;
      menu.append(link);
    });
  }

  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "auth-menu-logout";
  const logoutIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  logoutIcon.setAttribute("viewBox", "0 0 24 24");
  logoutIcon.setAttribute("aria-hidden", "true");
  logoutIcon.innerHTML =
    '<path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />';
  const logoutLabel = document.createElement("span");
  logoutLabel.textContent = "Log out";
  logout.append(logoutIcon, logoutLabel);
  logout.addEventListener("click", () => {
    localStorage.removeItem("concertlyUser");
    localStorage.removeItem("userRole");
    window.location.reload();
  });
  menu.append(logout);
}

window.handleLogout = function(e) {
  e.preventDefault();
  localStorage.removeItem("concertlyUser");
  localStorage.removeItem("userRole");
  window.location.reload();
};

function initAuthGuards() {
  const guardedElements = document.querySelectorAll("[data-requires-auth]");
  if (!guardedElements.length || localStorage.getItem("concertlyUser")) return;

  const loginLink = document.querySelector("[data-auth-login]");
  const loginUrl = loginLink ? loginLink.href : "#";

  guardedElements.forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = loginUrl;
    });
  });
}