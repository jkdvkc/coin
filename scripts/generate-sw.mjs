// Generuje jednoduchý service worker do public/sw.js
// Cache-first pre statické assety, network-first pre navigáciu (offline PWA na iPhone).
import { writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, base = "") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, rel));
  } else {
    out.push(`./${rel.split("\\").join("/")}`);
  }
  }
  return out;
}

const outArg = process.argv[2] || "public";
const assets = existsSync("dist") && outArg === "dist"
  ? walk("dist").filter((p) => !p.endsWith("/sw.js"))
  : ["./", "./index.html", "./manifest.webmanifest", "./pwa-192.png", "./pwa-512.png"];

const sw = `// CoinScanner service worker (generované: ${new Date().toISOString()})
const CACHE = "coinscanner-v7-catalog";
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navigácia: network-first, fallback na cache (offline štart)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })          .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Statické súbory: cache-first
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
`;

writeFileSync(`${outArg}/sw.js`, sw);
console.log(`OK ${outArg}/sw.js`);
