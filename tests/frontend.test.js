/* Run with Node, or via check_project.py using macOS JavaScriptCore. No packages needed. */
(async () => {
  const sources = typeof require === "function"
    ? Object.fromEntries(["components", "checkout", "purchases", "tickets", "venue-engine"].map(name => [name, require("fs").readFileSync(`${__dirname}/../js/${name}.js`, "utf8")]))
    : globalThis.__sources;
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  async function test(name, body) {
    try { await body(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error.stack || error) }); }
  }
  function run(source, context) { new Function("context", `with (context) { ${source}\n }`)(context); }
  function environment(data, api) {
    const elements = {};
    const store = new Map([["checkoutData", JSON.stringify(data)]]);
    const clock = { now: Date.now() };
    const timers = [];
    function element() {
      return { hidden: true, disabled: false, value: "", textContent: "", innerHTML: "", dataset: {}, style: { setProperty() {} },
        listeners: {}, classList: { toggle() {}, add() {} }, replaceChildren() {}, focus() {},
        addEventListener(name, fn) { this.listeners[name] = fn; },
        reportValidity() { return true; }, setAttribute() {},
      };
    }
    const document = { listeners: {},
      getElementById(id) { return elements[id] ||= element(); },
      createElement: element,
      addEventListener(name, fn) { this.listeners[name] = fn; },
    };
    const context = { document, console,
      Date: class extends Date { static now() { return clock.now; } },
      localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
      location: { href: "", replace(url) { this.href = url; } },
      setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval() {},
      ConcertlyAPI: api,
    };
    context.window = context;
    run(sources.components, context);
    run(sources.purchases + "\n" + sources.checkout, context);
    document.listeners.DOMContentLoaded();
    function buyer() {
      document.getElementById("buyer-name").value = "Test Buyer";
      document.getElementById("buyer-email").value = "buyer@example.com";
      document.getElementById("buyer-phone").value = "+84 912 345 678";
      const method = document.getElementById("payment-method");
      method.value = "card"; method.selectedIndex = 0; method.options = [{ text: "Credit Card" }];
    }
    return { context, document, store, clock, timers, buyer,
      submit: () => document.getElementById("checkout-form").listeners.submit({ preventDefault() {} }),
    };
  }
  const sample = () => ({ concertId: "c1", concertTitle: "Test concert", artist: "Artist", banner: "", date: "2027-01-01", time: "20:00", location: "Venue", ticket: { type: "VIP", price: "$100" }, quantity: 2, total: "$200", expiresAt: new Date(Date.now() + 300000).toISOString() });
  const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
  await test("Mock validation blocks empty buyer and malformed contact", async () => {
    const env = environment(sample());
    await env.submit(); assert(!env.store.has("concertlyPurchases"), "blank buyer was charged");
    env.buyer(); env.document.getElementById("buyer-email").value = "bad";
    await env.submit(); assert(!env.store.has("concertlyPurchases"), "invalid email accepted");
    env.buyer(); env.document.getElementById("buyer-phone").value = "abc123";
    await env.submit(); assert(!env.store.has("concertlyPurchases"), "invalid phone accepted");
  });
  await test("Mock payment requires a supported payment method", async () => {
    const env = environment(sample()); env.buyer(); env.document.getElementById("payment-method").value = "forged";
    await env.submit(); assert(!env.store.has("concertlyPurchases"), "bad method accepted");
  });
  await test("Mock rejects zero, fractional and more than six tickets", () => {
    for (const quantity of [0, -1, 1.5, 7, 8, "2"]) {
      const env = environment({ ...sample(), quantity });
      assert(env.context.location.href === "session-expired.html", `accepted ${quantity}`);
    }
  });
  await test("Mock supports six tickets, one receipt, no fake admission QR", async () => {
    const env = environment({ ...sample(), quantity: 6 }); env.buyer();
    await env.submit(); await env.submit();
    const archive = JSON.parse(env.store.get("concertlyPurchases"));
    assert(archive.orders.length === 1 && archive.tickets.length === 6, "wrong purchase count");
    assert(archive.tickets.every(t => t.status === "demo" && !t.qr_data), "demo created valid tickets");
    assert(!env.document.getElementById("checkout-result").hidden, "receipt missing");
  });
  await test("Reload does not restart the five-minute mock session", () => {
    const data = { ...sample(), expiresAt: new Date(Date.now() + 120000).toISOString() };
    const env = environment(data);
    assert(env.store.get("checkoutData") === JSON.stringify(data), "expiry changed on reload");
    env.clock.now += 121000; env.timers[0]();
    assert(env.context.location.href === "session-expired.html", "expired session still active");
    assert(!env.store.has("checkoutData"), "expired data retained");
  });
  await test("Old mock checkout is upgraded once with a persistent expiry", () => {
    const data = sample(); delete data.expiresAt;
    const env = environment(data);
    const saved = JSON.parse(env.store.get("checkoutData"));
    assert(Date.parse(saved.expiresAt) === env.clock.now + 300000, "not a five-minute upgrade");
  });
  await test("Expired and corrupt checkout data are rejected", () => {
    for (const data of [null, { ...sample(), expiresAt: "invalid" }, { ...sample(), expiresAt: new Date(0).toISOString() }]) {
      const env = environment(data); assert(env.context.location.href === "session-expired.html", "invalid checkout accepted");
    }
  });
  await test("Codes identify concerts without changing stored QR payload or ids", () => {
    const env = environment(sample()); const codes = env.context.ConcertlyCodes;
    const ticket = { concert_id: 2, ticket_code: "CTL-OLD-CODE", order_number: 10483, id: 12, qr_data: "CTL-OLD-CODE" };
    assert(codes.ticket(ticket) === "C02 · CTL-OLD-CODE", "ticket display wrong");
    assert(codes.order(ticket) === "#CT-C02-10483", "order display wrong");
    assert(ticket.qr_data === "CTL-OLD-CODE" && ticket.id === 12, "identity mutated");
  });
  await test("API checkout syncs server quantity, total, and countdown", async () => {
    let calls = 0; let buyer;
    const api = { numericId: () => 1, release: async () => {},
      getReservation: async () => ({ status: "active", seconds_left: 100, concert_id: 1, seats: [{}], total_amount: 125 }),
      checkout: async (id, method, contact) => { calls++; buyer = contact; return { id: 7, order_number: 10483, tickets: [], created_at: "" }; },
    };
    const env = environment({ ...sample(), reservationId: "hold" }, api); await flush();
    assert(env.document.getElementById("checkout-timer").textContent.endsWith("1:40"), "server countdown not used");
    assert(env.document.getElementById("payment-summary").innerHTML.includes("125"), "server total not used");
    await env.submit(); assert(calls === 0, "API bypassed buyer validation");
    env.buyer(); await env.submit();
    assert(calls === 1 && buyer.email === "buyer@example.com", "validated buyer not sent");
    assert(env.context.location.href.endsWith("id=7"), "not routed to server order");
  });
  await test("API load failure offers retry without enabling fake payment", async () => {
    let fail = true;
    const api = { numericId: () => 1, getReservation: async () => {
      if (fail) throw new Error("offline");
      return { status: "active", seconds_left: 60, concert_id: 1, seats: [{}], total_amount: 100 };
    } };
    const env = environment({ ...sample(), reservationId: "hold" }, api); await flush();
    assert(env.document.getElementById("confirm-payment").disabled, "payment enabled while offline");
    assert(!env.document.getElementById("retry-reservation").hidden, "retry missing");
    fail = false; await env.document.getElementById("retry-reservation").listeners.click();
    assert(!env.document.getElementById("confirm-payment").disabled, "retry did not restore payment");
  });
  await test("API expiry navigates immediately even if release never responds", async () => {
    const api = { numericId: () => 1, getReservation: async () => ({ status: "expired", seconds_left: 0 }), release: () => new Promise(() => {}) };
    const env = environment({ ...sample(), reservationId: "hold" }, api); await flush();
    assert(env.context.location.href === "session-expired.html", "release blocked navigation");
  });
  function ticketEnvironment(api) {
    const elements = {};
    const store = new Map();
    const el = () => ({ hidden: true, disabled: false, value: "", textContent: "", innerHTML: "", dataset: {},
      listeners: {}, focus() {}, scrollIntoView() {}, style: { setProperty() {} }, classList: { toggle() {} }, contains: () => false, querySelector: () => null,
      addEventListener(name, fn) { this.listeners[name] = fn; }, querySelectorAll: () => [],
    });
    const document = {
      listeners: {}, getElementById(id) { return elements[id] ||= el(); },
      querySelector: () => document.getElementById("quantity-control"), querySelectorAll: () => [],
      addEventListener(name, fn) { this.listeners[name] = fn; },
    };
    const context = { document, console, Date, ConcertlyAPI: api, setInterval: () => 0, addEventListener() {},
      MOCK_CONCERTS: [{ id: "c1", title: "Tour", tickets: [{ type: "VIP", price: "$100", status: "Available" },{type:"Alternate",price:"$200",status:"Available"}] }],
      URLSearchParams: class { get(key) { return { id: "c1", ticketType: "VIP" }[key] || null; } },
      location: { search: "?id=c1&ticketType=VIP", href: "" },
      localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
      VenueLoader: class { async load() { return { sections: [] }; } },
      VenueEngine: class { render() {} },
    };
    context.window = context;
    run(sources.components + "\n" + sources.tickets, context);
    document.listeners.DOMContentLoaded();
    return { context, document, store, choose(name="VIP",id="demo") { document.listeners.zoneSelected({detail:{name,id}}); } };
  }
  await test("Seat API error blocks real checkout and offers retry without fake booking", async () => {
    const env = ticketEnvironment({ numericId: () => 1, seatMap: async () => { throw new Error("offline"); } });
    await flush();
    assert(env.document.getElementById("continue-payment").disabled, "silently enabled checkout");
    assert(!env.document.getElementById("retry-seats").hidden, "seat retry missing");
    await env.document.getElementById("continue-payment").listeners.click();
    assert(!env.store.has("checkoutData"), "offline page created a purchase session");
  });
  await test("Seat retry restores API mode and prevents duplicate reservation requests", async () => {
    let fail = true; let holds = 0; let resolveHold;
    const api = { numericId: () => 1,
      seatMap: async () => {
        if (fail) throw new Error("offline");
        return { concert_id: 1, status: "on_sale", zones: [{ name: "VIP", booking_type: "seated", available: 1, price: 100, seats: [{ id: 1, row: "A", number: 1, status: "available" }] }] };
      },
      hold: () => { holds++; return new Promise(resolve => { resolveHold = resolve; }); },
    };
    const env = ticketEnvironment(api); await flush();
    fail = false; await env.document.getElementById("retry-seats").listeners.click();
    env.choose();
    assert(env.document.getElementById("quantity-control").hidden, "mock quantity remains after retry");
    env.document.getElementById("seat-picker").listeners.click({ target: { closest: () => ({ disabled: false, dataset: { id: "1" } }) } });
    const first = env.document.getElementById("continue-payment").listeners.click();
    await env.document.getElementById("continue-payment").listeners.click();
    assert(holds === 1, "duplicate reservation created");
    resolveHold({ id: "hold", total_amount: 100, expires_at: new Date(Date.now() + 300000).toISOString(), seats: [{ id: 1, row_label: "A", seat_number: 1, zone_name: "VIP", price: 100 }] });
    await first;
    assert(JSON.parse(env.store.get("checkoutData")).reservationId === "hold", "API reservation was lost");
  });
  await test("Standing keeps quantity controls and never sends a numbered-seat choice", async () => {
    let body;
    const api = { numericId: () => 1,
      seatMap: async () => ({concert_id: 1, status: "on_sale", zones: [{id: 12, name: "VIP", price: 100, available: 20, booking_type: "standing", seats: []}]}),
      holdTickets: async (concert, seatIds, standing) => {
        body = {concert, seatIds, standing};
        return {id: "standing-hold", total_amount: 600, expires_at: new Date(Date.now()+300000).toISOString(), seats: Array.from({length: 6}, (_, i) => ({id:i+1,zone_name:"VIP",booking_type:"standing",row_label:null,seat_number:null,price:100}))};
      },
    };
    const env = ticketEnvironment(api); await flush();
    env.choose();
    assert(!env.document.getElementById("quantity-control").hidden, "standing has no quantity control");
    assert(env.document.getElementById("seat-picker").textContent.includes("No assigned"), "standing rendered seat numbers");
    for(let i=0;i<10;i++)env.document.getElementById("plus").listeners.click();
    assert(env.document.getElementById("quantity").textContent === "6", "standing quantity exceeded limit");
    await env.document.getElementById("continue-payment").listeners.click();
    assert(body.seatIds.length===0 && body.standing[0].quantity===6 && body.standing[0].zone_id===12, "standing sent numbered seats");
    assert(JSON.parse(env.store.get("checkoutData")).seats.every(s=>s.label==="Standing"), "standing receipt contains numbers");
  });
  await test("Changing SVG sections within a category keeps the original selected seat IDs", async () => {
    let held;
    const api={numericId:()=>1,seatMap:async()=>({concert_id:1,status:"on_sale",zones:[
      {id:1,name:"VIP",booking_type:"seated",available:1,price:100,seats:[{id:11,row:"A",number:1,status:"available"}]}]}),
      hold:async(cid,ids)=>{held=ids;return {id:"section-hold",total_amount:100,expires_at:new Date(Date.now()+300000).toISOString(),seats:[{id:11,row_label:"A",seat_number:1,zone_name:"VIP",price:100}]};}};
    const env=ticketEnvironment(api);await flush();
    env.choose("VIP","section-one");
    env.document.getElementById("seat-picker").listeners.click({target:{closest:()=>({disabled:false,dataset:{id:"11"}})}});
    env.choose("VIP","section-two");
    assert(env.document.getElementById("quantity").textContent==="1","section switch changed quantity");
    assert(env.document.getElementById("selected-ticket").innerHTML.includes("A1"),"section switch lost seat label");
    await env.document.getElementById("continue-payment").listeners.click();
    assert(JSON.stringify(held)==="[11]","checkout changed or duplicated seat IDs");
  });
  function geometryEnvironment() {
    const context = {document:{},console}; context.window=context;
    run(sources["venue-engine"],context);
    return context.SeatGeometry;
  }
  const geometrySeats = () => Array.from({length:240},(_,i)=>({id:i+1,row:String.fromCharCode(65+Math.floor(i/20)),number:i%20+1,status:"available"}));
  await test("Trapezoid and triangle layouts keep every seat inside with variable row widths", () => {
    const geometry=geometryEnvironment();
    for(const points of ["0,0 400,0 300,300 100,300","200,0 400,300 0,300"]) {
      const section={id:"demo",name:"Seated",bookingType:"seated",shape:"polygon",points};
      const seats=geometrySeats();
      const map={stage:{x:100,y:-80,width:200,height:40},sections:[section]};
      const [view]=geometry.zone(map,"Seated",seats);
      assert(view.positions.length===seats.length && new Set(view.positions.map(p=>p.seat.id)).size===seats.length,"missing or duplicate seats");
      assert(view.positions.every(p=>geometry.fits(view.points,p.geometryX,p.geometryY,view.size)),"outside boundary");
      const ranks=[...new Set(view.positions.map(p=>p.rank))];
      const widths=ranks.map(rank=>view.positions.filter(p=>p.rank===rank).length);
      assert(new Set(widths).size>1,"rectangular rows returned");
      assert(points.startsWith("0,")?widths[0]>widths.at(-1):widths[0]<widths.at(-1),"shape direction incorrect");
    }
  });
  await test("Split SVG sections never duplicate IDs or retain cached availability", () => {
    const geometry=geometryEnvironment(),seats=geometrySeats();
    const map={stage:{x:100,y:-80,width:200,height:40},sections:[
      {id:"left",name:"Seated",bookingType:"seated",shape:"polygon",points:"0,0 190,0 190,300 0,300"},
      {id:"right",name:"Seated",bookingType:"seated",shape:"polygon",points:"210,0 400,0 400,300 210,300"}]};
    const before=geometry.zone(map,"Seated",seats).flatMap(v=>v.positions);
    assert(before.length===240 && new Set(before.map(p=>p.seat.id)).size===240,"split geometry duplicated seats");
    const changed=seats.map(s=>({...s,status:"sold"}));
    const after=geometry.zone(map,"Seated",changed).flatMap(v=>v.positions);
    assert(after.every((p,i)=>p.seat.status==="sold" && p.x===before[i].x && p.y===before[i].y),"cache changed positions or returned stale status");
    assert(seats.every(s=>s.status==="available"),"inventory objects mutated");
  });
  globalThis.__testResults = results;
  if (typeof process !== "undefined") {
    results.forEach(r => console.log(`${r.passed ? "PASS" : "FAIL"} ${r.name}${r.error ? `: ${r.error}` : ""}`));
    process.exitCode = results.some(r => !r.passed) ? 1 : 0;
  }
})();
