document.addEventListener("DOMContentLoaded", () => {
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
