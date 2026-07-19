/* Möbius⁸ service worker — the everywhere-audio contract, kept honest.
 *
 * Shell (player, manifest, icons, the Three.js CDN script, fonts):
 *   cache-first inside a VERSIONED cache. Second boot is faster than first,
 *   never slower — and a new release is a new cache, so updates actually
 *   arrive on installed home-screen copies.
 * catalog.json (+ catalog.sig):
 *   stale-while-revalidate in an UNversioned cache that survives app
 *   updates — a new album shows on second load at worst, with or without
 *   a player release.
 * AUDIO: passes through to the network UNTOUCHED. The Cache API does not
 *   speak Range; intercepting audio breaks seeking on iOS. Anything that
 *   looks like audio never even gets a respondWith().
 * UPDATES: a freshly installed worker WAITS instead of seizing the page —
 *   the player shows its "Update ready" affordance, saves the transport
 *   state, and messages SKIP_WAITING when the listener chooses. Activation
 *   deletes only stale shell caches; IndexedDB (queue, position, hearts,
 *   history, journeys) is never touched by an update.
 * Offline with a cached shell boots to the library with honest
 *   "streaming unavailable" states (the page handles those).
 * Pinning albums offline is explicitly out of scope this build — a
 *   1,000-track library is multiple GB; we don't fake it.
 */
'use strict';

// Stamped by tools/stamp_version.py (run by publish.sh): a short hash of the
// player file, so every player release is a new shell cache by construction.
const VERSION = '44068c32f0';

const SHELL_CACHE = 'mb8-shell-' + VERSION;
const CATALOG_CACHE = 'mb8-catalog-v1';          // unversioned: survives updates

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // fetch past the HTTP cache (a stale CDN copy must not become the new
    // "fresh" shell), and add each independently: one missing icon must not
    // kill the install
    await Promise.allSettled(SHELL.map(u =>
      cache.add(new Request(u, { cache: 'no-cache' }))));
    // NO skipWaiting here: the new worker waits until the page hands over,
    // so an update can never yank the shell out from under a live session
  })());
});

self.addEventListener('message', ev => {
  if (ev.data && ev.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()){
      if (k !== SHELL_CACHE && k !== CATALOG_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

function isAudio(req, url){
  return req.destination === 'audio'
    || /\/audio\//.test(url.pathname)
    || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba|webm)(\?|$)/i.test(url.pathname);
}
function isCatalog(url){
  return /catalog\.(json|sig)(\?|$)/.test(url.pathname);
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e){ return; }
  // only http(s) — data:, blob: and extension schemes throw in cache.put
  if (!/^https?:$/.test(url.protocol)) return;

  // audio: bail out entirely — the browser's own fetch handles Range
  if (isAudio(req, url)) return;

  if (isCatalog(url)){
    // stale-while-revalidate
    ev.respondWith((async () => {
      const cache = await caches.open(CATALOG_CACHE);
      const cached = await cache.match(req);
      const refresh = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached){ ev.waitUntil(refresh); return cached; }
      const fresh = await refresh;
      if (fresh) return fresh;
      return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    })());
    return;
  }

  // shell + fonts + CDN: cache-first, populate on first fetch. Uncached
  // network fetches carry a timeout so a black-holed CDN can never wedge
  // boot — an honest 504 beats a hanging stylesheet.
  ev.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: url.origin === location.origin });
    if (cached) return cached;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), url.origin === location.origin ? 20000 : 8000);
      const res = await fetch(req, { signal: ctl.signal });
      clearTimeout(timer);
      if (res && (res.ok || res.type === 'opaque')){
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e){
      // offline and uncached: an honest failure beats a fake page
      return new Response('', { status: 504 });
    }
  })());
});
