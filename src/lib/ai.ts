import { createGemmaEngine } from 'gemma-webgpu';

const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf';
const MODEL_FILENAME = 'gemma-3-1b-it-Q8_0.gguf';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';

let engine: any = null;
let state: { status: AiStatus; error: string; progress: number } = {
  status: 'idle',
  error: '',
  progress: 0,
};
const listeners = new Set<() => void>();

const set = (patch: Partial<typeof state>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const getState = () => state;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

async function isCached(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(MODEL_FILENAME);
    const file = await handle.getFile();
    return file.size > 100 * 1024 * 1024; // > 100MB = valid
  } catch {
    return false;
  }
}

async function downloadToOPFS(): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/model-cache.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') {
        const pct = m.total ? Math.round((m.loaded / m.total) * 100) : 0;
        set({ progress: pct });
      } else if (m.type === 'done') {
        worker.terminate();
        set({ progress: 100 });
        resolve();
      } else if (m.type === 'error') {
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ url: MODEL_URL, filename: MODEL_FILENAME });
  });
}

export async function loadModel(): Promise<void> {
  if (state.status === 'ready') return;
  if (!(navigator as any).gpu) {
    set({ status: 'error', error: 'WebGPU tidak tersedia. Butuh iOS 26+ Safari.' });
    return;
  }

  set({ status: 'loading', error: '', progress: 0 });

  try {
    // Ensure SW is active so it can intercept model fetches.
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    }

    // Ask for persistent storage (PWA must be installed for this to matter).
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }

    // Download to OPFS if not already there.
    if (!(await isCached())) {
      await downloadToOPFS();
    }

    // Now create the engine. gemma-webgpu will fetch the model URL,
    // and our SW will serve it from OPFS.
    engine = await createGemmaEngine({
      model: '1b',
      onProgress: (p: any) => {
        if (p?.status) console.log('[engine]', p.status);
      },
    });

    set({ status: 'ready' });
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
}

export async function generate(o: {
  system: string;
  prompt: string;
  onToken?: (t: string) => void;
}): Promise<string> {
  if (state.status !== 'ready' || !engine) {
    throw new Error('Model belum dimuat. Tap "Load Muse" dulu.');
  }
  engine.addUserMessage(o.prompt);
  let full = '';
  for await (const token of engine.generate({ temperature: 0.7 })) {
    full += token;
    o.onToken?.(token);
  }
  return full;
}