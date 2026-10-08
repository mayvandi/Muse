const ctx = self as any;

ctx.onmessage = async (e: any) => {
  const url = e.data.url;
  const filename = e.data.filename;

  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();

    const res = await fetch(url);
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    let offset = 0;

    while (true) {
      const r = await reader.read();
      if (r.done) break;
      // Gunakan slice() untuk memaksa copy dengan byteOffset=0
      await writable.write(r.value.slice());
      offset += r.value.length;
      ctx.postMessage({ type: 'progress', loaded: offset });
    }

    await writable.close();
    ctx.postMessage({ type: 'done', size: offset });
  } catch (err: any) {
    ctx.postMessage({ type: 'error', message: String(err) });
  }
};