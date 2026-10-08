const CACHE_NAME = 'aubin-model-v1';
const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.url !== MODEL_URL) return;
  e.respondWith(handleModel(e.request));
});

async function handleModel(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(MODEL_URL);
  if (!cached) {
    return new Response('not cached', { status: 404 });
  }

  const blob = await cached.blob();
  const range = request.headers.get('Range');

  if (range) {
    const m = range.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : blob.size - 1;
      const slice = blob.slice(start, end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': 'bytes ' + start + '-' + end + '/' + blob.size,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(slice.size),
        },
      });
    }
  }

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(blob.size),
      'Accept-Ranges': 'bytes',
    },
  });
}