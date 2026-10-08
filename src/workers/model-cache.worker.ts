// Dedicated worker: downloads the GGUF model into OPFS using
// createSyncAccessHandle (only available in dedicated workers, not SW).

const ctx = self as unknown as {
  postMessage: (m: unknown) => void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = async (e) => {
  const { url, filename } = e.data as { url: string; filename: string };

  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(filename, { create: true });
    const access = await (handle as any).createSyncAccessHandle();

    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Fetch failed: ${res.status}`);

    const total = parseInt(res.headers.get('Content-Length') || '0', 10);
    if (total > 0) access.truncate(total);

    const reader = res.body.getReader();
    let offset = 0;
    let lastReport = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Safari: ensure we never write past allocated size
      if (total > 0 && offset + value.length > total) {
        offset const remaining = total - offset;
        if (remaining > 0) {
          access.write(value.subarray(0, remaining), { at: offset });
          offset += remaining;
        }
        break;
      }

      access.write(value, { at: offset });
      offset += value.length;

      if (offset - lastReport > 4 * 1024 * 1024) {
        lastReport = offset;
        ctx.postMessage({ type: 'progress', loaded:, total });
      }
    }

    if (total > 0) access.truncate(offset);
    access.flush();
    access.close();
    ctx.postMessage({ type: 'done', size: offset });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message });
  }
};