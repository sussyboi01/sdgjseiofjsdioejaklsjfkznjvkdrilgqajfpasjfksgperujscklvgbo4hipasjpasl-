const CACHE_NAME = 'games-cache-v1';
const GAME_BASE_URL = 'https://sussyboi01.github.io/sdgjseiofjsdioejaklsjfkznjvkdrilgqajfpasjfksgperujscklvgbo4hipasjpasl-/';

// Start caching when page sends "start-cache"
self.addEventListener('message', async event => {
  if (event.data === 'start-cache') {
    console.log('Service Worker: Starting caching...');
    try {
      const files = await fetchGameList();
      await cacheGamesInBatches(files);
      console.log('Service Worker: Caching complete.');
      event.source.postMessage({ done: true });
    } catch (err) {
      console.error('SW caching error:', err);
    }
  }
});

// Get all HTML files in repo
async function fetchGameList() {
  const res = await fetch(
    'https://api.github.com/repos/sussyboi01/sdgjseiofjsdioejaklsjfkznjvkdrilgqajfpasjfksgperujscklvgbo4hipasjpasl-/git/trees/main?recursive=1'
  );
  const data = await res.json();

  return (data.tree || [])
    .filter(f => f.path.endsWith('.html'))
    .map(f => GAME_BASE_URL + f.path);
}

// Cache all games in safe batches
async function cacheGamesInBatches(urls) {
  const cache = await caches.open(CACHE_NAME);
  let cachedCount = 0;

  async function cacheSingle(url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;

      await cache.put(url, resp.clone());
      cachedCount++;

      // Send progress message to all pages
      const clients = await self.clients.matchAll();
      clients.forEach(c =>
        c.postMessage({ cached: cachedCount, total: urls.length })
      );
    } catch (e) {
      console.warn("Cache fail:", url, e);
    }
  }

  let batch = [];

  for (let i = 0; i < urls.length; i++) {
    batch.push(urls[i]);

    // Limit batch to 20 to avoid overload
    if (batch.length >= 20) {
      await Promise.all(batch.map(u => cacheSingle(u)));
      batch = [];
    }
  }

  // Remaining
  if (batch.length) {
    await Promise.all(batch.map(u => cacheSingle(u)));
  }
}

// MAIN FETCH HANDLER (this makes jsDelivr offline!)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      // Serve cached file if exists
      if (cached) return cached;

      try {
        // Fetch normally
        const resp = await fetch(event.request);

        // Cache successful GET responses (including jsDelivr!)
        if (event.request.method === "GET" && resp.status === 200) {
          cache.put(event.request, resp.clone());
        }

        return resp;
      } catch (e) {
        return cached || new Response("Offline", { status: 503 });
      }
    })
  );
});
