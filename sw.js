const CACHE = "freakshow-v7-pages-recovery-1";
const ROOT = new URL("./", self.location.href);
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
function valid(response, url) {
  if (!response?.ok) return false;
  const type = response.headers.get("content-type") || "";
  if (url.pathname.endsWith(".css")) return /text\/css/i.test(type);
  if (url.pathname.endsWith(".js")) return /(?:java|ecma)script/i.test(type);
  if (url.pathname.endsWith(".png")) return /image\/png/i.test(type);
  return true;
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Validate before caching: a host's HTML fallback must never become a stylesheet/module.
      await Promise.all(
        ASSETS.map(async (path) => {
          const url = new URL(path, ROOT);
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (!valid(response, url))
            throw new Error(`Invalid offline asset: ${url.pathname}`);
          await cache.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((k) => k.startsWith("freakshow-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== ROOT.origin ||
    !url.pathname.startsWith(ROOT.pathname)
  )
    return;
  const relative = url.pathname.slice(ROOT.pathname.length);
  // Independent development views must never receive the production HTML shell.
  if (
    relative.startsWith("public/") &&
    relative !== "public/mouth-prototype/rig.js" &&
    relative !== "public/baseline-v4.html"
  )
    return;
  const appNavigation =
    request.mode === "navigate" &&
    (relative === "" || relative === "index.html");
  if (
    request.mode === "navigate" &&
    !appNavigation &&
    relative !== "public/baseline-v4.html"
  )
    return;
  const known = ASSETS.some(
    (path) => new URL(path, ROOT).pathname === url.pathname,
  );
  if (!known && !appNavigation) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        // Prefer the deployed resource; recover from stale or invalid older caches online.
        const response = await fetch(
          new Request(request, { cache: "no-cache" }),
        );
        if (valid(response, url)) {
          await cache.put(
            appNavigation
              ? new URL("index.html", ROOT)
              : new URL(url.pathname, ROOT.origin),
            response.clone(),
          );
          return response;
        }
        const cached = await cache.match(
          appNavigation ? new URL("index.html", ROOT) : url,
          { ignoreSearch: true },
        );
        return valid(cached, url) ? cached : response;
      } catch (error) {
        const cached = await cache.match(
          appNavigation ? new URL("index.html", ROOT) : url,
          { ignoreSearch: true },
        );
        if (valid(cached, url)) return cached;
        throw error;
      }
    })(),
  );
});
