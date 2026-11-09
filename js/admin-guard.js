// Runs in <head> of every admin page: without an admin session (login token + admin role)
// go to the login page. The API enforces the role on every request as well.
if (
  !localStorage.getItem("token") ||
  !localStorage.getItem("concertlyUser") ||
  localStorage.getItem("userRole") !== "admin"
) {
  const login = new URL("../auth/login.html", window.location.href);
  login.searchParams.set("redirect", window.location.pathname);
  window.location.replace(login.href);
}
