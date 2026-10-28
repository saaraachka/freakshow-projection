const CACHE = "freakshow-v6-mesh-live-4";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./clown-head.png",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/engine.js",
  "./src/analysis.js",
  "./src/analysis-worker.js",
  "./src/renderer.js",
  "./src/clown-rig.js",
  "./src/rig-motion.js",
  "./src/character-motion.js",
  "./src/approved-character.js",
  "./public/mouth-prototype/rig.js",
  "./Vintage%20Horror%20Clown%20Model%20Sheet.png",
  "./src/song-editor.js",
  "./src/mic-worklet.js",
  "./public/baseline-v4.html",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("freakshow-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  // Development studies are independent pages, never the cached production shell.
  const prototypePath = new URL("./public/mouth-prototype/", self.location.href)
    .pathname;
  if (new URL(event.request.url).pathname === prototypePath + "rig.js") {
    // The same approved source powers the independent study and production.
    // Keep it fresh online, with the production cache available offline.
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request, { ignoreSearch: true }),
      ),
    );
    return;
  }
  if (new URL(event.request.url).pathname.startsWith(prototypePath)) return;
  if (
    event.request.method === "GET" &&
    new URL(event.request.url).origin === self.location.origin
  )
    event.respondWith(
      caches.match(event.request).then(async (hit) => {
        if (hit) return hit;
        // Projector navigation has a query string but uses the same offline shell.
        if (event.request.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        return fetch(event.request);
      }),
    );
});
