/* =========================================================
   Concertly — Mock data & shared helpers
   No backend / API calls — everything here is static mock data.
   ========================================================= */

/* ---- Concerts (referenced by tickets & orders) ---- */
const CONCERTS = {
  'anhtrai-encore': {
    name: 'Anh Trai Say Hi — Encore Concert',
    venue: 'Military Zone 7 Stadium, Ho Chi Minh City',
    datetime: '2026-12-12T19:30:00',
    gradient: 'linear-gradient(135deg,#0B0B0B,#FF3399 65%,#B3006B)'
  },
  'blackpink-deadline': {
    name: 'BLACKPINK World Tour: Deadline — Hanoi',
    venue: 'My Dinh National Stadium, Hanoi',
    datetime: '2026-11-20T18:00:00',
    gradient: 'linear-gradient(135deg,#0B0B0B,#C084FC 55%,#FF3399)'
  },
  'sontung-sky': {
    name: 'Sơn Tùng M-TP — Sky Tour 2026',
    venue: 'National Exhibition & Convention Center, Hanoi',
    datetime: '2026-12-05T19:00:00',
    gradient: 'linear-gradient(135deg,#0B0B0B,#60A5FA 55%,#FF3399)'
  },
  'hieuthuhai-24k': {
    name: 'HIEUTHUHAI — 24K Concert',
    venue: 'Phu Tho Indoor Stadium, Ho Chi Minh City',
    datetime: '2027-01-15T20:00:00',
    gradient: 'linear-gradient(135deg,#0B0B0B,#FBBF24 55%,#FF3399)'
  }
};

/* ---- Tickets — for /me/tickets ---- */
/* status: 'valid' | 'used' | 'cancelled' | 'expired' */
const MOCK_TICKETS = [
  {
    id: 'TCK-88213',
    concertId: 'anhtrai-encore',
    seat: 'Section A — Row 5 — Seat 12',
    type: 'VIP',
    orderId: 'ORD-20261012-0231',
    status: 'valid'
  },
  {
    id: 'TCK-88214',
    concertId: 'anhtrai-encore',
    seat: 'Section A — Row 5 — Seat 13',
    type: 'VIP',
    orderId: 'ORD-20261012-0231',
    status: 'valid'
  },
  {
    id: 'TCK-77410',
    concertId: 'blackpink-deadline',
    seat: 'Standing Zone — SA',
    type: 'Standing (Sky Admission)',
    orderId: 'ORD-20260930-0118',
    status: 'valid'
  },
  {
    id: 'TCK-65098',
    concertId: 'sontung-sky',
    seat: 'Section B — Row 12 — Seat 4',
    type: 'General Admission',
    orderId: 'ORD-20260820-0054',
    status: 'used'
  },
  {
    id: 'TCK-51287',
    concertId: 'hieuthuhai-24k',
    seat: 'Section C — Row 3 — Seat 21',
    type: 'Premium',
    orderId: 'ORD-20260905-0176',
    status: 'cancelled'
  },
  {
    id: 'TCK-49022',
    concertId: 'sontung-sky',
    seat: 'Section B — Row 12 — Seat 5',
    type: 'General Admission',
    orderId: 'ORD-20260820-0054',
    status: 'used'
  }
];

/* ---- Orders — for /me/orders and /me/orders/{id} ---- */
/* status: 'pending' | 'paid' | 'cancelled' | 'refunded' */
const MOCK_ORDERS = [
  {
    id: 'ORD-20261012-0231',
    concertId: 'anhtrai-encore',
    orderedAt: '2026-10-12T09:14:00',
    status: 'paid',
    paymentMethod: { name: 'MoMo Wallet', sub: 'Linked phone number •••• 8821' },
    tickets: [
      { seat: 'Section A — Row 5 — Seat 12', type: 'VIP', price: 2500000 },
      { seat: 'Section A — Row 5 — Seat 13', type: 'VIP', price: 2500000 }
    ],
    fees: 40000,
    discount: 250000
  },
  {
    id: 'ORD-20260930-0118',
    concertId: 'blackpink-deadline',
    orderedAt: '2026-09-30T21:05:00',
    status: 'paid',
    paymentMethod: { name: 'Visa Credit Card', sub: 'Ending in 4471' },
    tickets: [
      { seat: 'Standing Zone — SA', type: 'Standing (Sky Admission)', price: 3200000 }
    ],
    fees: 50000,
    discount: 0
  },
  {
    id: 'ORD-20260905-0176',
    concertId: 'hieuthuhai-24k',
    orderedAt: '2026-09-05T14:40:00',
    status: 'refunded',
    paymentMethod: { name: 'ZaloPay Wallet', sub: 'Linked phone number •••• 3390' },
    tickets: [
      { seat: 'Section C — Row 3 — Seat 21', type: 'Premium', price: 1800000 }
    ],
    fees: 30000,
    discount: 0
  },
  {
    id: 'ORD-20260820-0054',
    concertId: 'sontung-sky',
    orderedAt: '2026-08-20T11:22:00',
    status: 'paid',
    paymentMethod: { name: 'Bank Transfer', sub: 'Vietcombank — •••• 0092' },
    tickets: [
      { seat: 'Section B — Row 12 — Seat 4', type: 'General Admission', price: 900000 },
      { seat: 'Section B — Row 12 — Seat 5', type: 'General Admission', price: 900000 }
    ],
    fees: 30000,
    discount: 100000
  },
  {
    id: 'ORD-20261101-0299',
    concertId: 'blackpink-deadline',
    orderedAt: '2026-11-01T08:02:00',
    status: 'pending',
    paymentMethod: { name: 'No payment method selected', sub: 'Complete payment within 15 minutes' },
    tickets: [
      { seat: 'Standing Zone — SB', type: 'Standing (Sky Admission)', price: 3200000 }
    ],
    fees: 50000,
    discount: 0
  }
];

/* ---- Formatters ---- */
function formatCurrency(vnd){
  return vnd.toLocaleString('en-US') + ' ₫';
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
  used:      { label: 'Used',      cls: 'badge--info' },
  cancelled: { label: 'Cancelled', cls: 'badge--bad' },
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
