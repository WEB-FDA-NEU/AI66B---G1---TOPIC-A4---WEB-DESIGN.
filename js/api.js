// Thin client for the Concertly backend (backend/app). Used by ticket selection and checkout.
//
// Base URL: set window.CONCERTLY_API_BASE before this script to override.
// Identity: there is no login API yet, so requests carry an X-User-Id header
// (localStorage "concertlyUserId", default 1 = the seeded demo customer).
// When real auth lands, only authHeaders() needs to change.
const ConcertlyAPI = (() => {
  const base = (window.CONCERTLY_API_BASE || "http://localhost:8000/api").replace(/\/$/, "");

  function authHeaders() {
    return { "X-User-Id": localStorage.getItem("concertlyUserId") || "1" };
  }

  async function request(method, path, body) {
    let response;
    try {
      response = await fetch(base + path, {
        method,
        headers: { ...authHeaders(), ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
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
  };
})();

window.ConcertlyAPI = ConcertlyAPI;
