const CONCERTLY_PURCHASES_STORAGE_KEY = "concertlyPurchases";

function readConcertlyPurchases() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(CONCERTLY_PURCHASES_STORAGE_KEY) || "{}",
    );
    const orders = Array.isArray(stored.orders) ? stored.orders : [];
    const tickets = Array.isArray(stored.tickets) ? stored.tickets : [];
    const numberedIds = orders
      .map((order) => order.id?.match(/^#CT-(\d+)$/)?.[1])
      .filter(Boolean)
      .map(Number);
    let sequence = Math.max(10482, ...numberedIds);
    let changed = false;

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
  const customer = localStorage.getItem("concertlyUser");
  const purchases = readConcertlyPurchases();

  return {
    orders: purchases.orders.filter((order) => order.customer === customer),
    tickets: purchases.tickets.filter((ticket) => ticket.customer === customer),
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
  const customer = localStorage.getItem("concertlyUser");
  const purchases = readConcertlyPurchases();
  purchases.orders = purchases.orders.filter(
    (order) => order.customer !== customer,
  );
  purchases.tickets = purchases.tickets.filter(
    (ticket) => ticket.customer !== customer,
  );
  purchases.orders.push(...orders);
  purchases.tickets.push(...tickets);
  localStorage.setItem(
    CONCERTLY_PURCHASES_STORAGE_KEY,
    JSON.stringify(purchases),
  );
}
