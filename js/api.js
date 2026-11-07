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

  async function request(method, path, body, { form = false } = {}) {
    let response;
    try {
      const headers = { ...authHeaders() };
      if (body) headers["Content-Type"] = form ? "application/x-www-form-urlencoded" : "application/json";
      response = await fetch(base + path, {
        method,
        headers,
        body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined,
      });
    } catch (cause) {
      const error = new Error("Cannot reach the booking server.");
      error.code = "network";
      error.cause = cause;
      throw error;
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
    getReservation: (id) => request("GET", `/reservations/${id}`),
    release: (id) => request("DELETE", `/reservations/${id}`),
    checkout: (reservationId, paymentMethod) =>
      request("POST", "/checkout", { reservation_id: reservationId, payment_method: paymentMethod }),

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
      [TOKEN_KEY, "concertlyUser", "userRole"].forEach((key) => localStorage.removeItem(key));
    },

    // Account pages
    myOrders: () => request("GET", "/orders/me"),
    order: (id) => request("GET", `/orders/${encodeURIComponent(id)}`),
    cancelOrder: (id, reason) => request("POST", `/orders/${encodeURIComponent(id)}/cancel`, reason ? { reason } : undefined),
    myTickets: () => request("GET", "/tickets/me"),
    ticket: (id) => request("GET", `/tickets/${encodeURIComponent(id)}`),

    // Admin (role admin required)
    adminStats: () => request("GET", "/admin/stats"),
    adminConcertStats: () => request("GET", "/admin/stats/concerts"),
    adminOrders: (params = {}) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
      ).toString();
      return request("GET", `/admin/orders${query ? `?${query}` : ""}`);
    },
    adminAttendees: (concertId) => request("GET", `/admin/concerts/${encodeURIComponent(concertId)}/attendees`),
    adminCheckIn: (ticketId, concertId) => request("POST", "/admin/checkin", { ticketId, concertId }),
  };
})();

window.ConcertlyAPI = ConcertlyAPI;
