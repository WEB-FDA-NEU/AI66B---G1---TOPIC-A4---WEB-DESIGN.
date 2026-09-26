if (
  !localStorage.getItem("concertlyUser") ||
  localStorage.getItem("userRole") !== "admin"
) {
  window.location.replace(new URL("../auth/login.html", window.location.href));
}