// Serves the GGUF model from OPFS. Intercepts only the exact HF URL.

const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf';
const MODEL_FILENAME = 'gemma-3-1b-it-Q8_0.gguf';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.url === MODEL_URL) {
    e.respondWith(serveModel(e.request));
  }
});

async function serveModel(request) {
  let fileHandle;
  try {
    const root = await navigator.storage.getDirectory();
    fileHandle = await root.getFileHandle(MODEL_FILENAME);
  } catch {
    return new Response('Model not cached', { status: 404 });
  }

  const file = await fileHandle.getFile();
  const range = request.headers.get('Range');

  if (range) {
    const m = range.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : file.size - 1;
      const blob = file.slice(start, end + 1);
      return new Response(blob, {
        status: 206,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end}/${file.size}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }
  }

  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(file.size),
      'Accept-Ranges': 'bytes',
    },
  });
}