const THEME_STORAGE_KEY = "concertly-theme";

function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.classList.toggle("theme-light", isLight);
  document.documentElement.dataset.theme = isLight ? "light" : "dark";

  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
    toggle.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode");
    toggle.querySelector(".theme-toggle-icon").textContent = isLight ? "◐" : "☼";
    toggle.querySelector(".theme-toggle-label").textContent = isLight ? "Dark" : "Light";
  }
}

function renderThemeToggle() {
  if (document.querySelector("[data-theme-toggle]")) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.dataset.themeToggle = "";
  toggle.innerHTML = '<span class="theme-toggle-icon" aria-hidden="true"></span><span class="theme-toggle-label"></span>';
  toggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  });
  document.body.appendChild(toggle);
  applyTheme(getStoredTheme());
}

applyTheme(getStoredTheme());
document.addEventListener("DOMContentLoaded", renderThemeToggle);
