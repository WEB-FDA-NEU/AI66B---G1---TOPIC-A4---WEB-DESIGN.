class VenueLoader {
  async load(concertId) {
    if (!/^c(?:[1-9]|10|11)$/.test(concertId)) return null;
    const name = `${concertId.toUpperCase()}_MAP`;
    if (window[name]) return window[name];
    const source = new URL(`venues/${concertId}-map.js`, VenueLoader.scriptURL);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error("The venue map took too long to load. Please retry."));
      }, 12000);
      script.src = source.href;
      script.onload = () => {
        clearTimeout(timeout);
        if (window[name]) resolve(window[name]);
        else reject(new Error("Venue map data is unavailable."));
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error("Could not load the venue map. Please retry."));
      };
      document.body.appendChild(script);
    });
  }
}
VenueLoader.scriptURL = document.currentScript.src;
window.VenueLoader = VenueLoader;
