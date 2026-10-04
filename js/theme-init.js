(() => {
  const theme = localStorage.getItem("concertly-theme") === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;

  if (theme === "light") {
    document.documentElement.classList.add("theme-light");
  }
})();
