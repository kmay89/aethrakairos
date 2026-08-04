/* Möbius⁸ service worker — the everywhere-audio contract, kept honest.
 *
 * Shell (player, manifest, icons, the vendored Three.js engine, fonts):
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
const VERSION = '1092fddded';

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
  './three.min.js',                                 // the 3D engine, vendored same-origin — no CDN on the boot path
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
  // the page can ask for a shell freshness check while it stays open (a
  // home-screen copy may not navigate for days — timers ask instead)
  if (ev.data && ev.data.type === 'CHECK_SHELL') ev.waitUntil(revalidateShell());
});

/* SHELL REVALIDATION — the un-stick. The versioned cache only turns over when
 * sw.js itself changes; a deploy that forgot the stamp used to be invisible
 * until someone deleted site data. Now every boot (and every CHECK_SHELL)
 * quietly refetches index.html past the HTTP cache, compares BYTES with the
 * cached copy, and on a difference: recaches it and tells every open page a new
 * shell is ready. Stamped or not, a deploy always reaches the listener.
 *
 * Guards: response must be OK, text/html, and contain the app's own build marker
 * — a captive portal or an error page can never replace the shell. Two more were
 * added after a listener was offered, repeatedly, the build they were already
 * running: a COLD cache differs from everything and proves nothing, and the same
 * shell is never announced twice. The page verifies the claim on top of this;
 * this end simply stops making claims it cannot support. */
/* The last shell this worker told the pages about, as a fingerprint of its
   CONTENT — not its build id. Keying on the id was wrong in precisely the case
   that matters: an un-stamped deploy is the same id with different bytes, so a
   worker that had already mentioned that id once would swallow the real one.
   Measured as a one-in-two flake on "a fresh deploy raises the update badge by
   itself" before this was content-keyed. */
let announced = '';
function shellPrint(t){
  let h = 0x811c9dc5;                       // FNV-1a, enough to tell two deploys apart
  for (let i = 0; i < t.length; i++){
    h ^= t.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return t.length + ':' + h.toString(36);
}
async function revalidateShell(){
  try {
    const cache = await caches.open(SHELL_CACHE);
    const res = await fetch(new Request('./index.html', { cache: 'no-cache' }));
    if (!res || !res.ok) return;
    const ct = res.headers.get('Content-Type') || '';
    if (!/text\/html/i.test(ct)) return;
    const forRoot = res.clone(), forIndex = res.clone();
    const freshText = await res.text();
    if (!/MB8_BUILD/.test(freshText)) return;          // not our app — never cache it
    const cached = await cache.match('./index.html');
    const cachedText = cached ? await cached.clone().text() : '';
    if (freshText === cachedText) return;              // current — nothing to say
    await cache.put('./index.html', forIndex);
    await cache.put('./', forRoot);
    const m = freshText.match(/const MB8_BUILD = '([^']*)'/);
    const build = m ? m[1] : '';
    const print = shellPrint(freshText);
    /* NO REFERENCE, NO VERDICT. A cold cache differs from everything, and a new
       worker's cache is cold by construction — SHELL_CACHE is versioned, so every
       activation starts empty and this compare fired against nothing. The page it
       then told about a "fresh shell" was, of course, running that very shell.
       Populate quietly; there is nothing here worth reporting. */
    if (!cachedText) return;
    /* AND NEVER TWICE FOR THE SAME SHELL. Whatever makes two fetches of one
       deploy differ — a host that rewrites its HTML, a stamp that did not move —
       announcing it again on the next check is how a card comes back forever.
       One announcement per distinct shell, fingerprinted by CONTENT so that an
       un-stamped deploy (same id, new bytes) still counts as a different shell. */
    if (print === announced) return;
    announced = print;
    /* the fingerprint travels with the announcement: it is the only NAME an
       un-stamped deploy has, and the page needs a name to remember having
       applied one. Two announcements of the same shell are the same offer, and
       an offer already applied is not offered again. */
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.postMessage({ type: 'SHELL_FRESH', build, print });
  } catch (e){}
}

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

  /* THE PAGE'S ORIGIN PROBE GOES TO THE ORIGIN. verifyShell() asks what build is
   * actually deployed before it will believe an offer, and the request it sends
   * looked exactly like a shell request: same path, only a query string apart.
   * The shell route below matches on PATH — a query is not part of it — so the
   * probe was answered out of this cache, by us, and "past every cache" verified
   * the shell against itself. No respondWith at all here: the request leaves for
   * the network, which is the entire point of it. */
  if (url.searchParams.has('mb8probe')) return;

  // audio: bail out entirely — the browser's own fetch handles Range
  if (isAudio(req, url)) return;

  /* the shell page itself: cached INSTANTLY (second boot faster than first,
     the contract holds), revalidated in the background so the next launch —
     or this one, via the page's update card — always has the newest deploy.

     MATCHED ON PATH, AND ONLY THE SHELL'S PATH. This used to answer any
     same-origin NAVIGATION with the player, and the site has a second page:
     mac.html, the one the "Get the Mac app" button goes to. Anyone who had
     ever loaded the player therefore had a worker that served them the player
     again when they asked to download the app — the download page was reachable
     exactly once, before the worker installed, and never again. A page nobody
     with the app installed can read is a page that may as well not exist.

     The shell's paths are `/` and `/index.html`; everything else same-origin
     goes to the network, which is where it lives. A navigation that fails
     offline is honest — mac.html links to release binaries and needs the
     network anyway — where a navigation answered with the wrong page is not. */
  if (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname)){
    ev.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match('./index.html') || await cache.match('./');
      if (cached){ ev.waitUntil(revalidateShell()); return cached; }
      try {
        const res = await fetch(req);
        if (res && res.ok){ const c2 = res.clone(); ev.waitUntil(cache.put('./index.html', c2)); }
        return res;
      } catch (e){ return new Response('', { status: 504 }); }
    })());
    return;
  }

  // news.json — the update card's changelog: network-first (it exists to be
  // newer than this build), falling back to any cached copy offline
  if (/\/news\.json(\?|$)/.test(url.pathname)){
    ev.respondWith((async () => {
      const cache = await caches.open(CATALOG_CACHE);
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 6000);
        const res = await fetch(new Request(url.pathname, { cache: 'no-cache' }), { signal: ctl.signal });
        clearTimeout(timer);
        if (res && res.ok){ cache.put('./news.json', res.clone()); return res; }
      } catch (e){}
      const cached = await cache.match('./news.json');
      return cached || new Response('{"entries":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    })());
    return;
  }

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
