// Shared header behavior across all pages (index, explore, detail, 404):
// 1. Sticky header gets a solid/darker background once the page scrolls,
//    so text stays readable when content scrolls underneath it.
// 2. A single sliding underline ("nav-indicator") animates to whichever
//    nav link is hovered, and glides back to the current page's link
//    when the mouse leaves the nav — instead of a static underline.
document.addEventListener("DOMContentLoaded", () => {
  initStickyHeader();
  initNavIndicator();
  initAuthMenu();
  initAuthGuards();
});

function initStickyHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const updateHeaderState = () => {
    header.classList.toggle("scrolled", window.scrollY > 8);
  };

  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });
}

function initNavIndicator() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  const indicator = nav.querySelector(".nav-indicator");
  const links = nav.querySelectorAll("a[data-nav]");
  if (!indicator || !links.length) return;

  const moveIndicatorTo = (el) => {
    indicator.style.left = el.offsetLeft + "px";
    indicator.style.width = el.offsetWidth + "px";
    indicator.style.opacity = "1";
  };

  const activeLink = nav.querySelector("a.active") || links[0];
  indicator.style.transition = "none";
  moveIndicatorTo(activeLink);
  requestAnimationFrame(() => { indicator.style.transition = ""; });

  // Mark JS as initialized so the CSS-only fallback underline (::after)
  // hides itself and the sliding indicator takes over.
  nav.classList.add("js-ready");

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => moveIndicatorTo(link));
  });

  nav.addEventListener("mouseleave", () => moveIndicatorTo(activeLink));
  window.addEventListener("resize", () => moveIndicatorTo(activeLink));

  // Safety net: recompute once everything (fonts/images) has fully loaded,
  // in case layout shifted slightly after the first paint.
  window.addEventListener("load", () => moveIndicatorTo(activeLink));
}

function initAuthMenu() {
  const auth = document.querySelector(".site-auth");
  if (!auth) return;

  const user = localStorage.getItem("concertlyUser");
  const role = localStorage.getItem("userRole");

  if (user) {
    auth.innerHTML = `
      <style>
        /* Dropdown container */
        .user-dropdown { position: relative; display: inline-block; padding: 10px 0; }
        
        /* Dropdown menu styling */
        .dropdown-content { 
            display: none; 
            position: absolute; 
            right: 0; 
            top: 100%; 
            background-color: #161616; 
            min-width: 180px; 
            box-shadow: 0px 8px 24px rgba(0,0,0,0.8); 
            z-index: 999; 
            border-radius: 8px; 
            border: 1px solid #333; 
            overflow: hidden;
        }
        
        /* Show menu on hover */
        .user-dropdown:hover .dropdown-content { display: block; }
        
        /* Menu items styling */
        .dropdown-item { color: #ccc; padding: 12px 16px; text-decoration: none; display: block; font-size: 14px; transition: 0.2s; }
        .dropdown-item:hover { background-color: #222; color: #ff3399; padding-left: 20px; }
        
        /* Header section styling */
        .dropdown-header { padding: 16px; border-bottom: 1px solid #333; background-color: #0b0b0b; }
      </style>
      
      <div class="user-dropdown">
        <!-- Visible Navbar trigger: Icon and Name -->
        <div style="cursor: pointer; display: flex; align-items: center; gap: 8px; color: #fff; font-weight: bold; font-size: 14px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            ${user}
        </div>
        
        <!-- Hover Dropdown Content -->
        <div class="dropdown-content">
            
            <!-- User Profile Header: Name and Role ONLY -->
            <div class="dropdown-header">
                <div style="font-weight: bold; font-size: 15px; color: #fff; margin-bottom: 8px;">${user}</div>
                <div style="display: inline-block; background: rgba(255, 51, 153, 0.15); color: #ff3399; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px;">
                    ${role ? role.toUpperCase() : 'CUSTOMER'}
                </div>
            </div>
            
            <!-- Navigation Links -->
            <a href="#" onclick="showMyTickets(event)" class="dropdown-item">My Tickets</a>
            <div style="border-top: 1px solid #333;"></div>
            <a href="#" onclick="handleLogout(event)" class="dropdown-item" style="color: #ff4d4d;">Log Out</a>
        </div>
      </div>
    `;
  }
}
// Global logout function
window.handleLogout = function(e) {
  e.preventDefault();
  
  // Clear user data
  localStorage.removeItem("concertlyUser");
  localStorage.removeItem("userRole");
  
  // Redirect to home page instead of just reloading
  // Note: Adjust '/index.html' if your project runs in a specific sub-folder
  window.location.href = '/index.html'; 
};
window.showMyTickets = function(e) {
    if(e) e.preventDefault();
    
    let modal = document.getElementById('ticket-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ticket-modal';
        document.body.appendChild(modal);
    }
    
    // 1. LẤY DỮ LIỆU TỪ LOCAL STORAGE (Định dạng mảng JSON)
    // Nếu chưa có, trả về mảng rỗng []
    let myTickets = [];
    try {
        myTickets = JSON.parse(localStorage.getItem('myPurchasedTickets')) || [];
    } catch (err) {
        myTickets = [];
    }

    // 2. TẠO HTML CHO DANH SÁCH VÉ TỪ MOCK_CONCERTS
    let ticketsHTML = '';
    let totalTickets = 0;
    
    if (myTickets.length > 0) {
        myTickets.forEach(item => {
            // Đối chiếu ID vé đã mua với MOCK_CONCERTS (khai báo trong mock-data.js)
            const concert = typeof MOCK_CONCERTS !== 'undefined' ? MOCK_CONCERTS.find(c => c.id === item.id) : null;
            
            if (concert) {
                totalTickets += item.qty;
                ticketsHTML += `
                    <div class="ticket-card" style="background: #222; border-left: 4px solid #ff3399; padding: 12px; margin-top: 16px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                        <!-- Hiển thị Poster của sự kiện -->
                        <img src="${concert.poster}" alt="poster" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;">
                        
                        <!-- Thông tin sự kiện -->
                        <div style="flex-grow: 1;">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: #fff;">${concert.title}</h4>
                            <div style="font-size: 12px; color: #ccc; margin-bottom: 2px;">📅 ${concert.date} - ${concert.time}</div>
                            <div style="font-size: 12px; color: #ff3399; font-weight: bold;">🎟️ ${item.type}</div>
                        </div>
                        
                        <!-- Số lượng -->
                        <div style="text-align: center; border-left: 1px dashed #444; padding-left: 12px; min-width: 50px;">
                            <div style="font-size: 10px; color: #888; text-transform: uppercase;">Qty</div>
                            <div style="font-weight: bold; color: #ff3399; font-size: 18px;">x${item.qty}</div>
                        </div>
                    </div>
                `;
            }
        });
    }
    
    // Xử lý trường hợp chưa có vé nào
    if (totalTickets === 0) {
        ticketsHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #888;">
                <div style="font-size: 40px; margin-bottom: 12px;">🎫</div>
                <p style="margin: 0;">You haven't purchased any tickets yet.</p>
            </div>
        `;
    }
    
    // 3. ĐƯA HTML VÀO MODAL
    modal.innerHTML = `
        <style>
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 9999; }
            .modal-box { background: #161616; border: 1px solid #333; border-radius: 12px; width: 90%; max-width: 450px; max-height: 80vh; padding: 24px; color: #fff; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.7); display: flex; flex-direction: column; }
            .close-btn { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: #aaa; font-size: 24px; cursor: pointer; transition: 0.2s; }
            .close-btn:hover { color: #ff3399; }
            .ticket-container { overflow-y: auto; padding-right: 8px; margin-top: 10px; }
            .ticket-container::-webkit-scrollbar { width: 6px; }
            .ticket-container::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
        </style>
        
        <div class="modal-overlay" onclick="closeMyTickets(event)">
            <div class="modal-box" onclick="event.stopPropagation()">
                <button class="close-btn" onclick="closeMyTickets(event)">&times;</button>
                <h3 style="color: #ff3399; margin-top: 0; margin-bottom: 4px; font-size: 20px;">My Tickets</h3>
                <p style="color: #aaa; font-size: 14px; margin-top: 0;">${totalTickets} ticket(s) found</p>
                <div class="ticket-container">
                    ${ticketsHTML}
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
};

window.closeMyTickets = function(e) {
    if(e) e.preventDefault();
    const modal = document.getElementById('ticket-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};
window.closeMyTickets = function(e) {
    if(e) e.preventDefault();
    const modal = document.getElementById('ticket-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

function initAuthGuards() {
  const guardedElements = document.querySelectorAll("[data-requires-auth]");
  if (!guardedElements.length || localStorage.getItem("concertlyUser")) return;

  const loginLink = document.querySelector("[data-auth-login]");
  const loginUrl = loginLink ? loginLink.href : "#";

  guardedElements.forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = loginUrl;
    });
  });
}