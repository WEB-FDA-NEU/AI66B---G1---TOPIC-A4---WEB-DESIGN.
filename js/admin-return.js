const adminReturnScriptUrl = document.currentScript?.src;

function addAdminDashboardLink() {
  if (localStorage.getItem("userRole") !== "admin") return false;
  if (document.querySelector(".admin-return-link")) return true;

  const logo = document.querySelector(".site-header .container .site-logo");
  const dashboardLink = document.createElement("a");
  dashboardLink.className = `admin-return-link${logo ? "" : " admin-return-floating"}`;
  dashboardLink.href = new URL("../pages/admin/index.html", adminReturnScriptUrl || location.href).href;
  dashboardLink.setAttribute("aria-label", "Back to admin dashboard");
  dashboardLink.innerHTML = '<span aria-hidden="true">←</span><span>Back to dashboard</span>';

  if (logo) {
    const group = document.createElement("div");
    group.className = "admin-brand-group";
    logo.before(group);
    group.append(dashboardLink, logo);
  } else {
    document.body.append(dashboardLink);
  }
  return true;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (addAdminDashboardLink()) return;
    const observer = new MutationObserver(() => {
      if (addAdminDashboardLink()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });
} else if (!addAdminDashboardLink()) {
  const observer = new MutationObserver(() => {
    if (addAdminDashboardLink()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
