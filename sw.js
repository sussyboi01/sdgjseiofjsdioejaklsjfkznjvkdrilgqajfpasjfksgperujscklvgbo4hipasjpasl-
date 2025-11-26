const CACHE_NAME = 'games-cache-v1';
const GAME_BASE_URL = 'https://sussyboi01.github.io/sdgjseiofjsdioejaklsjfkznjvkdrilgqajfpasjfksgperujscklvgbo4hipasjpasl-/';
const PROGRESS_THROTTLE = 10; // send progress update every 10 files

self.addEventListener('message', async event => {
  if (event.data === 'start-cache') {
    console.log('Service Worker: Starting caching...');
    try {
      const files = await fetchGameList();
      await cacheGamesInBatches(files, event.source);
      console.log('Service Worker: Caching complete.');
      event.source.postMessage({ done: true });
    } catch (err) {
      console.error('SW caching error:', err);
    }
  }
});

async function fetchGameList() {
  const res = await fetch('https://api.github.com/repos/sussyboi01/sdgjseiofjsdioejaklsjfkznjvkdrilgqajfpasjfksgperujscklvgbo4hipasjpasl-/git/trees/main?recursive=1');
  const data = await res.json();
  return (data.tree || []).filter(f => f.path.endsWith('.html')).map(f => GAME_BASE_URL + f.path);
}

async function cacheGamesInBatches(urls, client) {
  const cache = await caches.open(CACHE_NAME);
  let cachedCount = 0;
  const BATCH_SIZE = 50; // cache 50 files at a time

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);

    // Cache batch in parallel
    await Promise.all(batch.map(async url => {
      try {
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp.clone());
      } catch (e) {
        console.warn('Failed to cache:', url, e);
      }
      cachedCount++;
    }));

    // Throttle progress updates
    if (client) client.postMessage({ cached: cachedCount, total: urls.length });
  }
}

// Serve cached files first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
