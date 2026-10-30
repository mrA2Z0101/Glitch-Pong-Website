const SHELL_CACHE = "glitch-pong-shell-v17";
const RUNTIME_CACHE = "glitch-pong-runtime-v17";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./glitch-pong.html",
  "./styles.css",
  "./glitchpong-site.js",
  "./glitchpong-site.js?v=glitchcade-1",
  "./glitchcade.js?v=glitchcade-1",
  "./vendor/three.module.min.js",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon128.png",
  "./assets/glitch_pong_main_menu.png",
  "./assets/glitch_pong_menu_FINAL.png?v=mobile-menu-16",
  "./assets/blue_paddle.png",
  "./assets/red_paddle.png",
  "./assets/boss_eye_left.png",
  "./assets/boss_eye_right.png",
  "./assets/boss_eye_neutral.png",
  "./assets/boss_eye_left.png?v=mobile-menu-16",
  "./assets/boss_eye_right.png?v=mobile-menu-16",
  "./assets/boss_eye_neutral.png?v=mobile-menu-16"
];

self.addEventListener("install", (event) => {
  // Cache files one by one: cache.addAll() rejects the whole install if a
  // single file is missing, which left the site with no offline cache at all.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => Promise.all(
    SHELL_FILES.map((file) => cache.add(file).catch((error) => console.warn("Glitch Pong SW: could not cache", file, error)))
  )));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await caches.match(request)) || (await caches.match("./index.html"));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const update = fetch(request).then(async (response) => {
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || update;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/socket.io/") || url.pathname.includes("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (["audio", "image", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (["script", "style", "manifest"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
