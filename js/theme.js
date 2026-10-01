const THEME_STORAGE_KEY = "concertly-theme";

function getStoredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.classList.toggle("theme-light", isLight);
  document.documentElement.dataset.theme = isLight ? "light" : "dark";

  document.querySelectorAll("[data-theme-choice]").forEach((choice) => {
    choice.setAttribute(
      "aria-pressed",
      String(choice.dataset.themeChoice === (isLight ? "light" : "dark")),
    );
  });
}

function renderThemeToggle() {
  if (document.querySelector("[data-theme-toggle]")) return;

  const picker = document.createElement("div");
  picker.className = "theme-toggle";
  picker.dataset.themeToggle = "";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "theme-toggle-trigger";
  trigger.textContent = "Theme";
  trigger.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "theme-toggle-panel";
  panel.hidden = true;

  const panelHeading = document.createElement("div");
  panelHeading.className = "theme-toggle-heading";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "theme-toggle-back";
  back.textContent = "‹";
  back.setAttribute("aria-label", "Return to account menu");
  const closePicker = (restoreFocus = false) => {
    panel.hidden = true;
    trigger.hidden = false;
    trigger.setAttribute("aria-expanded", "false");
    picker.classList.remove("theme-picker-open");
    picker.parentElement?.classList.remove("theme-picker-open");
    if (restoreFocus) trigger.focus();
  };

  back.addEventListener("click", () => closePicker(true));

  ["dark", "light"].forEach((theme) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "theme-toggle-option";
    option.dataset.themeChoice = theme;
    option.textContent = theme === "dark" ? "Dark" : "Light";
    option.addEventListener("click", () => {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyTheme(theme);
    });
    panel.append(option);
  });

  trigger.addEventListener("click", () => {
    trigger.hidden = true;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    picker.classList.add("theme-picker-open");
    picker.parentElement?.classList.add("theme-picker-open");
    back.focus();
  });

  const headingLabel = document.createElement("span");
  headingLabel.className = "theme-toggle-heading-label";
  headingLabel.textContent = "Theme";
  panelHeading.append(back, headingLabel);
  panel.prepend(panelHeading);
  picker.append(trigger, panel);

  const menu =
    document.querySelector(".site-auth .auth-menu") ||
    document.querySelector(".admin-account-dropdown");
  if (menu) {
    menu.appendChild(picker);
    document.addEventListener("pointerdown", (event) => {
      if (!panel.hidden && !menu.contains(event.target)) closePicker();
    });
  } else {
    picker.classList.add("theme-toggle-floating");
    document.body.appendChild(picker);
  }

  applyTheme(getStoredTheme());
}

applyTheme(getStoredTheme());
document.addEventListener("DOMContentLoaded", renderThemeToggle);
window.addEventListener("storage", (event) => {
  if (event.key === THEME_STORAGE_KEY) applyTheme(event.newValue || "dark");
});
