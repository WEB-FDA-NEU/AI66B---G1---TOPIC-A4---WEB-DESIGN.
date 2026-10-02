const CONCERTLY_PURCHASES_STORAGE_KEY = "concertlyPurchases";
const CONCERT_TICKET_ID_PATTERN =
  /^TK-[A-Z0-9]{3,6}-[A-Z0-9]+-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function hasCurrentTicketId(ticket) {
  return CONCERT_TICKET_ID_PATTERN.test(ticket?.id || "");
}

function readConcertlyPurchases() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(CONCERTLY_PURCHASES_STORAGE_KEY) || "{}",
    );
    const storedOrders = Array.isArray(stored.orders) ? stored.orders : [];
    const orders = storedOrders.filter(
      (order) =>
        Array.isArray(order.tickets) && order.tickets.some(hasCurrentTicketId),
    );
    const storedTickets = Array.isArray(stored.tickets) ? stored.tickets : [];
    const tickets = storedTickets.filter(hasCurrentTicketId);
    const numberedIds = orders
      .map((order) => order.id?.match(/^#CT-(\d+)$/)?.[1])
      .filter(Boolean)
      .map(Number);
    let sequence = Math.max(10482, ...numberedIds);
    let changed =
      orders.length !== storedOrders.length ||
      tickets.length !== storedTickets.length;

    orders.forEach((order) => {
      if (!Array.isArray(order.tickets)) return;
      const validTickets = order.tickets.filter(hasCurrentTicketId);
      if (validTickets.length === order.tickets.length) return;
      order.tickets = validTickets;
      changed = true;
    });

    orders
      .filter((order) => !/^#CT-\d+$/.test(order.id || ""))
      .sort((a, b) => new Date(a.orderedAt) - new Date(b.orderedAt))
      .forEach((order) => {
        const previousId = order.id;
        sequence += 1;
        order.id = `#CT-${String(sequence).padStart(5, "0")}`;
        tickets.forEach((ticket) => {
          if (ticket.orderId === previousId) ticket.orderId = order.id;
        });
        changed = true;
      });

    if (changed) {
      localStorage.setItem(
        CONCERTLY_PURCHASES_STORAGE_KEY,
        JSON.stringify({ orders, tickets }),
      );
    }

    return {
      orders,
      tickets,
    };
  } catch {
    return { orders: [], tickets: [] };
  }
}

function createConcertlyOrderId() {
  const orders = readConcertlyPurchases().orders;
  const highestId = orders.reduce((highest, order) => {
    const sequence = Number(order.id.match(/^#CT-(\d+)$/)?.[1] || 0);
    return Math.max(highest, sequence);
  }, 10482);

  return `#CT-${String(highestId + 1).padStart(5, "0")}`;
}

function getCurrentCustomerPurchases() {
  const customerAccount = localStorage.getItem("concertlyUser");
  const purchases = readConcertlyPurchases();

  return {
    orders: purchases.orders.filter(
      (order) => (order.customerAccount || order.customer) === customerAccount,
    ),
    tickets: purchases.tickets.filter(
      (ticket) => (ticket.customerAccount || ticket.customer) === customerAccount,
    ),
  };
}

function saveConcertlyPurchase(order, tickets) {
  const purchases = readConcertlyPurchases();
  purchases.orders.push(order);
  purchases.tickets.push(...tickets);
  localStorage.setItem(
    CONCERTLY_PURCHASES_STORAGE_KEY,
    JSON.stringify(purchases),
  );
}

function saveCurrentCustomerPurchases(orders, tickets) {
  const customerAccount = localStorage.getItem("concertlyUser");
  const purchases = readConcertlyPurchases();
  purchases.orders = purchases.orders.filter(
    (order) => (order.customerAccount || order.customer) !== customerAccount,
  );
  purchases.tickets = purchases.tickets.filter(
    (ticket) => (ticket.customerAccount || ticket.customer) !== customerAccount,
  );
  purchases.orders.push(...orders);
  purchases.tickets.push(...tickets);
  localStorage.setItem(
    CONCERTLY_PURCHASES_STORAGE_KEY,
    JSON.stringify(purchases),
  );
}

readConcertlyPurchases();
