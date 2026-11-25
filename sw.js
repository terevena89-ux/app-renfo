// Service worker : copie des fichiers pour marcher hors ligne.
// À CHAQUE NOUVELLE VERSION : changer le numéro ci-dessous.
const CACHE = "renfo-v0.2.0";

const FICHIERS = [
  "./", "index.html", "style.css", "app.js", "champs-mobile.js", "notes-idees.js", "excel-style.js",
  "manifest.json", "icones/icone.svg", "icones/icone-192.png"
];

// GitHub lets phones keep files 10 min without checking: always ask the server
// ("reload" / "no-cache"), or an old file could be stored under the new version.
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FICHIERS.map(f => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // ExcelJS: fixed version, cache copy is fine.
  if (url.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(
      caches.match(req).then(copie => copie || fetch(req).then(rep => {
        const clone = rep.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return rep;
      }))
    );
    return;
  }

  // App files: network first, copy as offline fallback.
  // (req.url, not req: navigation requests can't be modified)
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req.url, { cache: "no-cache" }).then(rep => {
        const clone = rep.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return rep;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
  }
});
