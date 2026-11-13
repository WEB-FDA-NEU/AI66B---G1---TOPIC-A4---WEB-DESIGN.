// Shared header behavior across all pages (index, explore, detail, 404):
// 1. Sticky header gets a solid/darker background once the page scrolls,
//    so text stays readable when content scrolls underneath it.
// 2. A single sliding underline ("nav-indicator") animates to whichever
//    nav link is hovered, and glides back to the current page's link
//    when the mouse leaves the nav — instead of a static underline.
document.addEventListener("DOMContentLoaded", () => {
  renderSharedHeader();
  initStickyHeader();
  initNavIndicator();
  initMobileNav();
  initMobileNavMotion();
  initAuthMenu();
  initAuthGuards();
});

// One template for existing public headers and the previously empty navbar mounts.
function renderSharedHeader() {
  const mount = document.getElementById("site-navbar");
  const existing = document.querySelector(".site-header");
  if (!mount && !existing) return;
  const home = new URL(mount ? `${mount.dataset.root || ""}index.html`
    : existing.querySelector(".header-actions")?.dataset.home || "index.html", window.location.href);
  const path = window.location.pathname;
  const links = [
    ["Home", "index.html", path === home.pathname],
    ["Explore", "pages/concerts/index.html", path.includes("/pages/concerts/")],
    ["Support", "pages/404.html", path.endsWith("/pages/404.html")],
  ];
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `<div class="container">
    <a href="${home.href}" class="site-logo hover-glow">CONCERTLY</a>
    <div class="header-actions" data-home="${home.href}">
      <nav class="site-nav" aria-label="Main navigation">
        ${links.map(([label, url, active]) => `<a href="${new URL(url, home).href}" class="hover-glow${active ? " active" : ""}" data-nav${active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
        <span class="nav-indicator" aria-hidden="true"></span>
      </nav>
      <form class="header-search" action="${new URL("pages/concerts/index.html", home).href}" method="get" role="search">
        <input class="header-search-input" type="search" name="search" placeholder="Find your next live show..." aria-label="Search concerts">
        <button class="header-search-button" type="submit" aria-label="Search"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button>
      </form>
      <div class="site-auth">
        <button class="avatar-button" type="button" aria-label="Account menu"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg></button>
        <div class="auth-menu" role="menu">
          <a href="${new URL("pages/auth/login.html", home).href}" data-auth-login role="menuitem">Sign in</a>
          <a href="${new URL("pages/auth/register.html", home).href}" data-auth-register role="menuitem">Sign up</a>
        </div>
      </div>
    </div>
  </div>`;
  // Explore's inline controller may already hold a reference to this search field.
  // Preserve it so clearing filters and restoring the query still affect the live input.
  const searchInput = existing?.querySelector(".header-search-input");
  if (searchInput) header.querySelector(".header-search-input").replaceWith(searchInput);
  if (mount) mount.replaceChildren(header);
  else existing.replaceWith(header);
}

function initMobileNav() {
  const header = document.querySelector(".site-header");
  const actions = header?.querySelector(".header-actions");
  const nav = actions?.querySelector(".site-nav");
  if (nav) {
    const icons = {
      "My Tickets":
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5M8 17h3"/></svg>',
      "My Orders":
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
      Home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
      Explore:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/></svg>',
      Support:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.8 1.3-1.8 2.7M12 17h.01"/></svg>',
    };

    const homeLink = nav.querySelector('a[data-nav]:not(.mobile-only-nav-item)');
    if (homeLink && !nav.querySelector(".mobile-only-nav-item")) {
      const homeUrl = new URL(
        actions.dataset.home || "index.html",
        window.location.href,
      );
      const ticketsUrl = new URL("pages/me/tickets.html", homeUrl);
      const ordersUrl = new URL("pages/me/orders.html", homeUrl);
      const currentPath = window.location.pathname;
      const accountNavItems = [
        {
          label: "My Tickets",
          href: ticketsUrl.href,
          active:
            currentPath === ticketsUrl.pathname ||
            currentPath.endsWith("/pages/me/ticket-detail.html"),
        },
        {
          label: "My Orders",
          href: ordersUrl.href,
          active:
            currentPath === ordersUrl.pathname ||
            currentPath.endsWith("/pages/me/order-detail.html"),
        },
      ];

      accountNavItems.forEach(({ label, href, active }) => {
        const link = document.createElement("a");
        link.href = href;
        link.className = "hover-glow mobile-only-nav-item";
        link.dataset.nav = "";
        link.textContent = label;
        if (active) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
        nav.insertBefore(link, homeLink);
      });
    }

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
  const links = nav.querySelectorAll(
    "a[data-nav]:not(.mobile-only-nav-item)",
  );
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
    localStorage.removeItem("token");
    localStorage.removeItem("concertlyUserId");
    window.location.reload();
  });
  menu.append(logout);
}

window.handleLogout = function(e) {
  e.preventDefault();
  localStorage.removeItem("concertlyUser");
  localStorage.removeItem("userRole");
  localStorage.removeItem("token");
    localStorage.removeItem("concertlyUserId");
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
