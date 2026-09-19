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

  // Links marked with # are placeholders — there's no Help Center / Refund
  // Policy / Terms page yet, wire these up once those pages exist.
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
          <a href="${root}pages/auth/login.html">Log in</a>
          <a href="${root}pages/auth/register.html">Create account</a>
        </div>

        <div class="footer-col">
          <h4>Support</h4>
          <a href="#">Help Center</a>
          <a href="#">Refund Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>

      <div class="container footer-bottom">
        <span>&copy; 2026 Concertly. All rights reserved.</span>
        <div class="footer-social">
          <a href="#">Instagram</a>
          <a href="#">Facebook</a>
          <a href="#">TikTok</a>
        </div>
      </div>
    </footer>
  `;
}

document.addEventListener("DOMContentLoaded", renderSiteFooter);
