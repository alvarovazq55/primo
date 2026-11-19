// Service Worker para MiDNI PWA (iOS / Android / Web)
const CACHE_NAME = "midni-app-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icono_app.png",
  "./logo.png",
  "./logo_policia.png",
  "./foto_perfil.png",
  "./emblema_policia.png",
  "./escudo_espana.png",
  "./qr_edad_exact.png",
  "./qr_logo_edad.png",
  "./qr_logo_simple.png",
  "./qr_logo_completo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("Error precaching assets:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Estrategia: Cache First con fallback a Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        return cachedResponse;
      });
    })
  );
});
