if (
  !localStorage.getItem("concertlyUser") ||
  localStorage.getItem("userRole") !== "customer"
) {
  window.location.replace(new URL("../auth/login.html", window.location.href));
} else {
  document.documentElement.classList.add("customer-session");
}

const customerPurchases = getCurrentCustomerPurchases();
const CUSTOMER_ORDERS = customerPurchases.orders;
const CUSTOMER_TICKETS = customerPurchases.tickets;

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
  if (seat === "Not assigned") return seat;
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
  return CUSTOMER_ORDERS.find(o => o.id === id);
}

function cancelOrder(id){
  const order = getOrderById(id);
  if (!order || !["pending", "paid"].includes(order.status)) return false;

  const wasPaid = order.status === "paid";
  const confirmation = wasPaid
    ? `Cancel ${order.id}? A refund will be processed.`
    : `Cancel ${order.id}? This order has not been paid.`;
  if (!window.confirm(confirmation)) return false;

  order.status = "cancelled";
  order.refundStatus = wasPaid ? "processed" : "not-required";
  CUSTOMER_TICKETS.filter((ticket) => ticket.orderId === order.id).forEach((ticket) => {
    ticket.status = "cancelled";
  });
  saveCurrentCustomerPurchases(CUSTOMER_ORDERS, CUSTOMER_TICKETS);
  return true;
}
