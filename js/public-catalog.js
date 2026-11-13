// Merge backend-managed concerts into the presentation data used by the public pages.
window.concertlyCatalogReady = (async () => {
  if (!window.ConcertlyAPI || !Array.isArray(window.MOCK_CONCERTS)) return;

  try {
    const catalog = await window.ConcertlyAPI.concerts();
    const managedIds = new Set(catalog.managed_ids.map(String));
    const mockById = new Map(
      window.MOCK_CONCERTS.map(concert => [String(window.ConcertlyAPI.numericId(concert.id)), concert]),
    );
    const apiConcerts = catalog.items.map(item => {
      const id = `c${item.id}`;
      const mock = mockById.get(String(item.id));
      const start = new Date(item.starts_at);
      const pad = number => String(number).padStart(2, "0");
      const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const time = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const tickets = item.zones.map(zone => {
        const oldTier = mock?.tickets?.find(ticket => ticket.type === zone.name);
        return {
          type: zone.name,
          price: `$${Number(zone.price).toLocaleString("en-US")}`,
          status: item.status === "sold_out" ? "Sold Out" : oldTier?.status === "Sold Out" ? "Sold Out" : "Available",
        };
      });
      const prices = item.zones.map(zone => Number(zone.price));
      const priceRange = prices.length
        ? prices.length === 1 || Math.min(...prices) === Math.max(...prices)
          ? `$${Math.min(...prices).toLocaleString("en-US")}`
          : `$${Math.min(...prices).toLocaleString("en-US")} - $${Math.max(...prices).toLocaleString("en-US")}`
        : mock?.priceRange || "Price TBA";
      const poster = item.poster_url || mock?.poster || "";
      const status = item.status === "sold_out" ? "Sold Out" : "Available";

      return {
        ...mock,
        id,
        title: item.title,
        artist: item.artist,
        date,
        time,
        location: [item.venue, item.city].filter(Boolean).join(", "),
        description: item.description || mock?.description || "",
        poster,
        banner: mock?.banner || poster,
        category: mock?.category || "Concert",
        status,
        tickets,
        priceRange,
      };
    });

    const unmanagedMocks = window.MOCK_CONCERTS.filter(concert =>
      !managedIds.has(String(window.ConcertlyAPI.numericId(concert.id))),
    );
    window.MOCK_CONCERTS.splice(0, window.MOCK_CONCERTS.length, ...apiConcerts, ...unmanagedMocks);
  } catch (error) {
    console.warn("Could not load the current concert catalogue; showing the local preview data.", error);
  }
})();
