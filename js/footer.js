// js/footer.js

// HOW TO USE ON A PAGE:
//   1. Put an empty mount point right before </body>:
//        <div id="site-footer" data-root="..."></div>
//      "data-root" is the relative path back to the project root:
//        - on index.html                              -> data-root=""
//        - on pages/404.html                          -> data-root="../"
//        - on pages/auth/*.html, pages/checkout/*.html,
//          pages/concerts/*.html, pages/me/*.html     -> data-root="../../"
//   2. Load this script after it: <script src="../js/footer.js"></script>
//      (path to js/ also depends on depth, same rule as your css links)

function renderSiteFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  
  const root = mount.dataset.root || "";
  const activeUser = localStorage.getItem("concertlyUser");
  
  let accountLinks = '';
  if (activeUser) {

    accountLinks = `
      <a href="#" onclick="showMyTickets(event)">My Tickets</a>
      <a href="#" onclick="handleLogout(event)">Log out</a>
    `;
  } else {
    accountLinks = `
      <a href="${root}pages/auth/login.html">Log in</a>
      <a href="${root}pages/auth/register.html">Create account</a>
    `;
  }

  mount.innerHTML = `
    <footer class="footer">
      <div class="container footer-top">
        <div class="footer-brand">
          <a href="${root}index.html" class="logo">CONCERTLY</a>
          <p>Live concerts and shows, all in one place.</p>
        </div>

        <div class="footer-col">
          <h4>Explore</h4>
          <a href="${root}pages/concerts/index.html">All Concerts</a>
        </div>

        <div class="footer-col">
          <h4>Account</h4>
          ${accountLinks}
        </div>

      </div>

      <div class="container footer-bottom">
        <span>&copy; 2026 Concertly. All rights reserved.</span>
      </div>
    </footer>
  `;
}

document.addEventListener("DOMContentLoaded", renderSiteFooter);