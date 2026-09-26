if (
  !localStorage.getItem("concertlyUser") ||
  localStorage.getItem("userRole") !== "customer"
) {
  window.location.replace(new URL("../auth/login.html", window.location.href));
} else {
  document.documentElement.classList.add("customer-session");
}

/* Order and ticket examples share concert records from js/mock-data.js. */

/* ---- Tickets — for /me/tickets ---- */
/* status: 'valid' | 'used' | 'cancelled' | 'expired' */
const MOCK_TICKETS = [
  {
    id: 'CT-EST-10482',
    concertId: 'c1',
    seat: 'Floor — Row A — Seat 12',
    type: 'VIP Diamond Experience',
    orderId: '#CT-10482',
    status: 'valid'
  },
  {
    id: 'CT-EST-10481',
    concertId: 'c3',
    seat: 'Floor — Row A — Seat 8',
    type: 'Cactus Jack VIP Pass',
    orderId: '#CT-10481',
    status: 'valid'
  },
  {
    id: 'CT-EST-10480',
    concertId: 'c2',
    seat: 'VIP Lounge — Table 4',
    type: 'VIP After Hours Lounge',
    orderId: '#CT-10480',
    status: 'pending'
  },
  {
    id: 'CT-EST-10479',
    concertId: 'c4',
    seat: 'Lower Bowl — Section 2 — Seat 18',
    type: 'Lower Bowl Seated',
    orderId: '#CT-10479',
    status: 'valid'
  },
  {
    id: 'CT-EST-10478',
    concertId: 'c1',
    seat: 'Standard — Section 210 — Seat 34',
    type: 'Standard Tier 2',
    orderId: '#CT-10478',
    status: 'refunded'
  }
];

/* ---- Orders — for /me/orders and /me/orders/{id} ---- */
/* status: 'pending' | 'paid' | 'cancelled' | 'refunded' */
const MOCK_ORDERS = [
  {
    id: '#CT-10482',
    concertId: 'c1',
    orderedAt: '2026-09-17T09:14:00',
    status: 'paid',
    paymentMethod: { name: 'MoMo Wallet', sub: 'Linked phone number •••• 8821' },
    tickets: [
      { seat: 'Floor — Row A — Seat 12', type: 'VIP Diamond Experience', price: 350 }
    ],
    fees: 0,
    discount: 0
  },
  {
    id: '#CT-10481',
    concertId: 'c3',
    orderedAt: '2026-09-17T08:55:00',
    status: 'paid',
    paymentMethod: { name: 'Visa Credit Card', sub: 'Ending in 4471' },
    tickets: [
      { seat: 'Floor — Row A — Seat 8', type: 'Cactus Jack VIP Pass', price: 300 }
    ],
    fees: 0,
    discount: 0
  },
  {
    id: '#CT-10480',
    concertId: 'c2',
    orderedAt: '2026-09-16T18:20:00',
    status: 'pending',
    paymentMethod: { name: 'No payment method selected', sub: 'Complete payment within 15 minutes' },
    tickets: [
      { seat: 'VIP Lounge — Table 4', type: 'VIP After Hours Lounge', price: 420 }
    ],
    fees: 0,
    discount: 0
  },
  {
    id: '#CT-10479',
    concertId: 'c4',
    orderedAt: '2026-09-16T14:10:00',
    status: 'paid',
    paymentMethod: { name: 'Bank Transfer', sub: 'Vietcombank — •••• 0092' },
    tickets: [
      { seat: 'Lower Bowl — Section 2 — Seat 18', type: 'Lower Bowl Seated', price: 170 }
    ],
    fees: 0,
    discount: 0
  },
  {
    id: '#CT-10478',
    concertId: 'c1',
    orderedAt: '2026-09-15T12:30:00',
    status: 'refunded',
    paymentMethod: { name: 'Visa Credit Card', sub: 'Ending in 4471' },
    tickets: [
      { seat: 'Standard — Section 210 — Seat 34', type: 'Standard Tier 2', price: 80 }
    ],
    fees: 0,
    discount: 0
  }
];

const CANCELLATION_STORAGE_KEY = "concertly-cancelled-orders";
let cancellationRecords = [];
try {
  cancellationRecords = JSON.parse(
    localStorage.getItem(CANCELLATION_STORAGE_KEY) || "[]",
  );
} catch {
  cancellationRecords = [];
}

MOCK_ORDERS.forEach((order) => {
  const cancellation = cancellationRecords.find((item) => item.id === order.id);
  if (!cancellation) return;
  order.status = "cancelled";
  order.refundStatus = cancellation.refunded ? "processed" : "not-required";
});

MOCK_TICKETS.forEach((ticket) => {
  if (cancellationRecords.some((item) => item.id === ticket.orderId)) {
    ticket.status = "cancelled";
  }
});

/* ---- Formatters ---- */
function formatCurrency(amount){
  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDateTime(iso){
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday}, ${date} · ${time}`;
}

function formatDateShort(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* Extracts just the trailing code/number from a "Section A — Row 5 — Seat 12"
   or "Standing Zone — SA" style string, for compact display in the ticket stub. */
function seatCode(seat){
  const last = seat.split('—').pop().trim();
  return last.replace(/^[A-Za-z]+\s+/, '');
}

/* ---- Status label/class maps ---- */
const TICKET_STATUS_MAP = {
  valid:     { label: 'Valid',     cls: 'badge--ok' },
  pending:   { label: 'Pending',   cls: 'badge--warn' },
  used:      { label: 'Used',      cls: 'badge--info' },
  cancelled: { label: 'Cancelled', cls: 'badge--bad' },
  refunded:  { label: 'Refunded',  cls: 'badge--off' },
  expired:   { label: 'Expired',   cls: 'badge--neutral' }
};

const ORDER_STATUS_MAP = {
  pending:   { label: 'Pending Payment', cls: 'badge--warn' },
  paid:      { label: 'Paid',            cls: 'badge--ok' },
  cancelled: { label: 'Cancelled',       cls: 'badge--bad' },
  refunded:  { label: 'Refunded',        cls: 'badge--off' }
};

function orderTotal(order){
  const subtotal = order.tickets.reduce((sum, t) => sum + t.price, 0);
  return subtotal + order.fees - order.discount;
}

function orderSubtotal(order){
  return order.tickets.reduce((sum, t) => sum + t.price, 0);
}

function getOrderById(id){
  return MOCK_ORDERS.find(o => o.id === id);
}

function cancelOrder(id){
  const order = getOrderById(id);
  if (!order || !["pending", "paid"].includes(order.status)) return false;

  const wasPaid = order.status === "paid";
  const confirmation = wasPaid
    ? `Cancel ${order.id}? A mock refund will be processed.`
    : `Cancel ${order.id}? This order has not been paid.`;
  if (!window.confirm(confirmation)) return false;

  order.status = "cancelled";
  order.refundStatus = wasPaid ? "processed" : "not-required";
  MOCK_TICKETS.filter((ticket) => ticket.orderId === order.id).forEach((ticket) => {
    ticket.status = "cancelled";
  });
  cancellationRecords = cancellationRecords.filter((item) => item.id !== order.id);
  cancellationRecords.push({ id: order.id, refunded: wasPaid });
  localStorage.setItem(CANCELLATION_STORAGE_KEY, JSON.stringify(cancellationRecords));
  return true;
}
