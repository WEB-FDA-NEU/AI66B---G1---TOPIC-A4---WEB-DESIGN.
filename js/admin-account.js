document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".admin-nav");
  if (nav) nav.setAttribute("aria-label", "Admin navigation");
  document.querySelectorAll(".data-table").forEach(table => {
    const wrapper = document.createElement("div");
    wrapper.className = "admin-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Scrollable data table");
    table.before(wrapper);
    wrapper.append(table);
  });
  const accountButton = document.querySelector(".admin-account-button");
  const accountDropdown = document.getElementById("admin-account-dropdown");
  const logoutButton = document.getElementById("admin-logout");

  if (!accountButton || !accountDropdown) return;

  accountButton.addEventListener("click", event => {
    event.stopPropagation();
    accountDropdown.hidden = !accountDropdown.hidden;
    accountButton.setAttribute("aria-expanded", String(!accountDropdown.hidden));
  });

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      accountDropdown.hidden = true;
      accountButton.setAttribute("aria-expanded", "false");
      localStorage.removeItem("concertlyUser");
      localStorage.removeItem("userRole");
      localStorage.removeItem("token");
      localStorage.removeItem("concertlyUserId");
      window.location.href = "../auth/login.html";
    });
  }

  document.addEventListener("click", event => {
    if (!accountDropdown.contains(event.target) && !accountButton.contains(event.target)) {
      accountDropdown.hidden = true;
      accountButton.setAttribute("aria-expanded", "false");
    }
  });
});
