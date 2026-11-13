// Thin client for the Concertly backend (backend/app). Used by ticket selection, checkout
// and the account pages.
//
// Base URL: set window.CONCERTLY_API_BASE before this script to override.
// Identity: the JWT from POST /auth/login, kept in localStorage "token", is sent as
// "Authorization: Bearer ...". For local development without logging in, a backend started
// with ALLOW_DEV_USER_HEADER=1 also accepts localStorage "concertlyUserId" as X-User-Id.
const ConcertlyAPI = (() => {
  const base = (window.CONCERTLY_API_BASE || "http://localhost:8000/api").replace(/\/$/, "");
  const TOKEN_KEY = "token";

  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return { Authorization: `Bearer ${token}` };
    const devUserId = localStorage.getItem("concertlyUserId");
    return devUserId ? { "X-User-Id": devUserId } : {};
  }

  async function request(method, path, body, { form = false, multipart = false } = {}) {
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const headers = { ...authHeaders() };
      if (body && !multipart) headers["Content-Type"] = form ? "application/x-www-form-urlencoded" : "application/json";
      response = await fetch(base + path, {
        method,
        signal: controller.signal,
        headers,
        body: body
          ? multipart ? body : form ? new URLSearchParams(body).toString() : JSON.stringify(body)
          : undefined,
      });
    } catch (cause) {
      const error = new Error("Cannot reach the booking server.");
      error.code = "network";
      error.cause = cause;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const info = payload?.error || {};
      const error = new Error(info.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.code = info.code || "http_error";
      error.details = info;
      throw error;
    }
    return payload;
  }

  return {
    // Concert ids in the mock data look like "c3"; the backend uses the number 3.
    numericId: (mockId) => Number(String(mockId).replace(/^c/i, "")),
    seatMap: (concertId) => request("GET", `/concerts/${concertId}/seats`),
    hold: (concertId, seatIds) => request("POST", "/reservations", { concert_id: concertId, seat_ids: seatIds }),
    holdTickets: (concertId, seatIds, standing = []) =>
      request("POST", "/reservations", { concert_id: concertId, seat_ids: seatIds, standing }),
    getReservation: (id) => request("GET", `/reservations/${id}`),
    release: (id) => request("DELETE", `/reservations/${id}`),
    checkout: (reservationId, paymentMethod, buyer) =>
      request("POST", "/checkout", { reservation_id: reservationId, payment_method: paymentMethod, ...(buyer ? { buyer } : {}) }),

    // Session
    login: (email, password) => request("POST", "/auth/login", { username: email, password }, { form: true }),
    me: () => request("GET", "/auth/me"),
    hasToken: () => Boolean(localStorage.getItem(TOKEN_KEY)),
    saveSession(session) {
      localStorage.setItem(TOKEN_KEY, session.access_token);
      localStorage.setItem("concertlyUser", session.user.full_name);
      localStorage.setItem("userRole", session.user.role);
    },
    clearSession() {
      [TOKEN_KEY, "concertlyUser", "userRole", "concertlyUserId"].forEach((key) => localStorage.removeItem(key));
    },

    // Account pages
    myOrders: () => request("GET", "/orders/me"),
    order: (id) => request("GET", `/orders/${encodeURIComponent(id)}`),
    cancelOrder: (id, reason) => request("POST", `/orders/${encodeURIComponent(id)}/cancel`, reason ? { reason } : undefined),
    myTickets: () => request("GET", "/tickets/me"),
    ticket: (id) => request("GET", `/tickets/${encodeURIComponent(id)}`),

    // Public concert catalogue
    concerts: () => request("GET", "/concerts"),
    concert: (id) => request("GET", `/concerts/${encodeURIComponent(id)}`),

    // Admin (role admin required)
    adminStats: () => request("GET", "/admin/stats"),
    adminConcertStats: () => request("GET", "/admin/stats/concerts"),
    adminConcerts: () => request("GET", "/admin/concerts"),
    adminConcert: (id) => request("GET", `/admin/concerts/${encodeURIComponent(id)}`),
    adminCreateConcert: (concert) => request("POST", "/admin/concerts", concert),
    adminUpdateConcert: (id, concert) =>
      request("PUT", `/admin/concerts/${encodeURIComponent(id)}`, concert),
    adminDeleteConcert: (id) => request("DELETE", `/admin/concerts/${encodeURIComponent(id)}`),
    async adminUploadConcertImage(file) {
      const formData = new FormData();
      formData.append("image", file);
      const result = await request("POST", "/admin/concerts/upload-image", formData, { multipart: true });
      return { ...result, url: new URL(result.url, `${base}/`).href };
    },
    adminOrders: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
      ).toString();
      return request("GET", `/admin/orders${query ? `?${query}` : ""}`);
    },
    adminOrder: (id) => request("GET", `/admin/orders/${encodeURIComponent(id)}`),
    adminAttendees: (concertId) => request("GET", `/admin/concerts/${encodeURIComponent(concertId)}/attendees`),
    adminCheckIn: (ticketId, concertId) => request("POST", "/admin/checkin", { ticketId, concertId }),
  };
})();

window.ConcertlyAPI = ConcertlyAPI;
