// js/concerts.js

const CONCERTS_PER_PAGE = 5;
let concertPage = 1;
let filteredConcerts = [];
let editingConcertId = null;

function getConcertFormTicketRows() {
  const rows = document.querySelectorAll("#ticket-type-list .ticket-type-row");

  return Array.from(rows)
    .map(row => {
      const inputs = row.querySelectorAll(".form-input");
      const type = inputs[0]?.value.trim();
      const priceValue = inputs[1]?.value.trim();

      if (!type || !priceValue) return null;

      const numericPrice = Number(priceValue);
      const normalizedPrice = Number.isFinite(numericPrice) ? `$${numericPrice}` : `$${priceValue.replace(/^\$\s*/, "")}`;

      return {
        type,
        price: normalizedPrice,
        status: "Available"
      };
    })
    .filter(Boolean);
}

async function renderConcertTable() {
  const tbody = document.getElementById("concert-table-body");
  const caption = document.getElementById("concert-count-caption");
  if (!tbody) return;

  // 1. Hiển thị trạng thái Loading
  tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align: center;">Đang tải dữ liệu sự kiện...</td></tr>`;

  // 2. Lấy giá trị bộ lọc
  const search = document.getElementById("concert-search").value.trim().toLowerCase();
  const status = document.getElementById("concert-status-filter").value;

  try {
    // 3. Gọi thẳng vào API thật thay vì dùng MOCK_CONCERTS
    let apiUrl = `http://127.0.0.1:8000/api/concerts?page=${concertPage}&size=${CONCERTS_PER_PAGE}`;
    
    // Gắn thêm filter nếu có
    if (search) apiUrl += `&search=${encodeURIComponent(search)}`;
    // Lưu ý: Nếu status là "all", ta không truyền filter này vào URL
    if (status && status !== "all") apiUrl += `&status=${encodeURIComponent(status)}`;

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error("Lỗi khi tải dữ liệu từ server");
    }

    const data = await response.json();
    
    // 4. Cập nhật lại số trang từ API trả về
    const pageCount = data.pages || 1;
    concertPage = data.page || 1;

    // 5. Vẽ dữ liệu ra giao diện (dùng data.items thay cho filteredConcerts)
    tbody.innerHTML = data.items.map(c => `
      <tr>
        <td>
          <div class="cell-concert">
            <img class="cell-thumb" src="${c.poster}" alt="">
            <span class="cell-title">${c.title}</span>
          </div>
        </td>
        <td>${c.artist}</td>
        <td>${formatDateTime(c.date, c.time)}</td>
        <td>${c.location}</td>
        <td><span class="badge ${badgeClassFor(c.status)}">${c.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="row-action-btn" aria-label="Edit" onclick="loadConcertIntoForm('${c.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="row-action-btn danger" aria-label="Delete ${c.title}" data-delete-concert="${c.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="6" class="text-muted" style="text-align: center;">Không tìm thấy sự kiện nào.</td></tr>`;

    // 6. Cập nhật dòng text hiển thị số lượng
    const start = (concertPage - 1) * CONCERTS_PER_PAGE;
    const firstResult = data.items.length ? start + 1 : 0;
    const lastResult = start + data.items.length;
    if (caption) {
      caption.textContent = `Showing ${firstResult}–${lastResult} of ${data.total} concerts`;
    }

    // 7. Vẽ thanh phân trang
    renderConcertPagination(pageCount);

  } catch (error) {
    console.error("Fetch API Error:", error);
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger" style="text-align: center;">Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại Backend.</td></tr>`;
  }
}

// mock-data.js tickets only have { type, price, status } — no quantity.
// Quantity stays a plain number input the admin fills in by hand; Edit only
// pre-fills type + price from the mock ticket, quantity is left blank.
function ticketRowHTML(ticket) {
  const type = ticket ? ticket.type : "";
  const price = ticket ? String(ticket.price).replace("$", "") : "";
  return `
    <div class="ticket-type-row">
      <div class="form-group">
        <label class="form-label">Type name</label>
        <input class="form-input" type="text" value="${type}">
      </div>
      <div class="form-group">
        <label class="form-label">Price (USD)</label>
        <input class="form-input" type="number" value="${price}">
      </div>
      <div class="form-group">
        <label class="form-label">Quantity</label>
        <input class="form-input" type="number" placeholder="e.g. 200">
      </div>
      <button type="button" class="ticket-type-remove" aria-label="Remove ticket type" onclick="this.closest('.ticket-type-row').remove()"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `;
}

function addEmptyTicketRow() {
  document.getElementById("ticket-type-list").insertAdjacentHTML("beforeend", ticketRowHTML(null));
}

function openNewConcertForm() {
  resetConcertForm();
  const formCard = document.getElementById("concert-form");
  formCard.hidden = false;
  formCard.scrollIntoView({ behavior: "smooth" });
}

function saveConcertForm(event) {
  event.preventDefault();

  const name = document.getElementById("concert-name").value.trim();
  const artist = document.getElementById("artist-name").value.trim();
  const date = document.getElementById("concert-date").value;
  const time = document.getElementById("concert-time").value;
  const adminStatus = document.getElementById("concert-status").value;
  const location = document.getElementById("venue").value.trim();
  const description = document.getElementById("description").value.trim();
  const previewImage = document.querySelector("#cover-preview img");
  const tickets = getConcertFormTicketRows();

  if (!name || !artist || !date || !time || !location) {
    alert("Please fill in all required concert details before saving.");
    return;
  }

  const concertPayload = {
    title: name,
    artist,
    date,
    time,
    adminStatus,
    location,
    description: description || "No description provided yet.",
    poster: previewImage ? previewImage.src : "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
    tickets: tickets.length ? tickets : [
      { type: "General Admission", price: "$0", status: "Available" }
    ]
  };

  if (editingConcertId) {
    const index = MOCK_CONCERTS.findIndex(concert => concert.id === editingConcertId);
    if (index !== -1) {
      MOCK_CONCERTS[index] = { ...MOCK_CONCERTS[index], ...concertPayload };
    }
  } else {
    MOCK_CONCERTS.unshift({
      id: `c${Date.now()}`,
      ...concertPayload,
      priceRange: "From $0",
      banner: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
      category: "Live",
      status: "Selling Fast"
    });
  }

  resetConcertForm();
  renderConcertTable();
}

function loadConcertIntoForm(id) {
  const c = MOCK_CONCERTS.find(x => x.id === id);
  if (!c) return;

  editingConcertId = id;
  document.getElementById("concert-form").hidden = false;
  document.getElementById("form-card-title").textContent = "Edit Concert";
  document.getElementById("concert-name").value = c.title;
  document.getElementById("artist-name").value = c.artist;
  document.getElementById("concert-date").value = c.date;
  document.getElementById("concert-time").value = c.time;
  document.getElementById("concert-status").value = c.adminStatus || getConcertStatus(c);
  document.getElementById("venue").value = c.location;
  document.getElementById("description").value = c.description;
  document.getElementById("cover-preview").innerHTML = `<img src="${c.poster}" alt="">`;
  document.getElementById("ticket-type-list").innerHTML = c.tickets.map(ticketRowHTML).join("");

  document.getElementById("concert-form").scrollIntoView({ behavior: "smooth" });
}

function deleteConcert(id) {
  const index = MOCK_CONCERTS.findIndex(concert => concert.id === id);
  if (index === -1) return;

  const concert = MOCK_CONCERTS[index];
  if (!window.confirm(`Delete "${concert.title}" from concerts?`)) return;

  MOCK_CONCERTS.splice(index, 1);
  if (editingConcertId === id) resetConcertForm();
  renderConcertTable();
}

function resetConcertForm() {
  editingConcertId = null;
  document.getElementById("form-card-title").textContent = "Add New Concert";
  document.querySelector("#concert-form form").reset();
  document.getElementById("cover-preview").innerHTML = '<i class="fa-solid fa-image"></i>';
  document.getElementById("ticket-type-list").innerHTML = ticketRowHTML(null) + ticketRowHTML(null);
  document.getElementById("concert-form").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("concert-table-body").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-concert]");
    if (button) deleteConcert(button.dataset.deleteConcert);
  });

  document.getElementById("concert-search").addEventListener("input", () => {
    concertPage = 1;
    renderConcertTable();
  });
  document.getElementById("concert-status-filter").addEventListener("change", () => {
    concertPage = 1;
    renderConcertTable();
  });
  document.getElementById("concert-pagination").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.page) concertPage = Number(button.dataset.page);
    if (button.dataset.pageAction === "previous") concertPage--;
    if (button.dataset.pageAction === "next") concertPage++;
    renderConcertTable();
  });
  document.querySelector("#concert-form form").addEventListener("submit", saveConcertForm);
  renderConcertTable();
});
