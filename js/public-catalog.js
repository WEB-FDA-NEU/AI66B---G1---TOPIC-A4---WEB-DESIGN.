// Merge backend-managed concerts into the presentation data used by the public pages (Task #51).
window.PUBLIC_CONCERTS = [];
window.publicCatalogError = null;

function mapApiConcertToView(item, mockById = new Map()) {
  const id = `c${item.id}`;
  const mock = mockById.get(String(item.id));
  const start = new Date(item.starts_at);
  const pad = number => String(number).padStart(2, "0");
  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const tickets = (item.zones || []).map(zone => {
    const oldTier = mock?.tickets?.find(ticket => ticket.type === zone.name);
    return {
      id: zone.id,
      type: zone.name,
      price: `$${Number(zone.price).toLocaleString("en-US")}`,
      booking_type: zone.booking_type || "seated",
      status: item.status === "sold_out" ? "Sold Out" : oldTier?.status === "Sold Out" ? "Sold Out" : "Available",
    };
  });
  const prices = (item.zones || []).map(zone => Number(zone.price));
  const priceRange = prices.length
    ? prices.length === 1 || Math.min(...prices) === Math.max(...prices)
      ? `$${Math.min(...prices).toLocaleString("en-US")}`
      : `$${Math.min(...prices).toLocaleString("en-US")} - $${Math.max(...prices).toLocaleString("en-US")}`
    : mock?.priceRange || "Price TBA";
  const poster = item.poster_url || mock?.poster || "";
  const status = item.status === "sold_out" ? "Sold Out" : (mock?.status || "Available");

  return {
    ...mock,
    id,
    concert_id: item.id,
    title: item.title,
    artist: item.artist,
    date,
    time,
    location: [item.venue, item.city].filter(Boolean).join(", "),
    description: item.description || mock?.description || "",
    poster,
    banner: mock?.banner || poster,
    category: item.category || mock?.category || "Concert",
    status,
    tickets,
    priceRange,
  };
}

window.mapApiConcertToView = mapApiConcertToView;

window.concertlyCatalogReady = (async () => {
  if (!window.ConcertlyAPI || !Array.isArray(window.MOCK_CONCERTS)) return;

  const mockById = new Map(
    window.MOCK_CONCERTS.map(concert => [String(window.ConcertlyAPI.numericId(concert.id)), concert]),
  );

  try {
    const detailIdParam = new URLSearchParams(window.location.search).get("id");
    const isDetailPage = window.location.pathname.endsWith("/detail.html") && detailIdParam;

    const catalog = await window.ConcertlyAPI.concerts();
    const managedIds = new Set((catalog.managed_ids || []).map(String));
    const apiConcerts = (catalog.items || []).map(item => mapApiConcertToView(item, mockById));

    if (isDetailPage) {
      try {
        const numId = window.ConcertlyAPI.numericId(detailIdParam);
        const detailItem = await window.ConcertlyAPI.concert(numId);
        const mappedDetail = mapApiConcertToView(detailItem, mockById);
        const idx = apiConcerts.findIndex(c => c.id === mappedDetail.id);
        if (idx !== -1) apiConcerts[idx] = mappedDetail;
        else apiConcerts.push(mappedDetail);
      } catch (_) {
        // Fallback to catalog list if individual endpoint is unreachable
      }
    }

    const unmanagedMocks = window.MOCK_CONCERTS.filter(concert =>
      !managedIds.has(String(window.ConcertlyAPI.numericId(concert.id))),
    );
    window.PUBLIC_CONCERTS = apiConcerts;
    window.MOCK_CONCERTS.splice(0, window.MOCK_CONCERTS.length, ...apiConcerts, ...unmanagedMocks);
  } catch (error) {
    window.publicCatalogError = error;
    console.warn("Could not load the current concert catalogue; showing the local preview data.", error);
  }
})();
