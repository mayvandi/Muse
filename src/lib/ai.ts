import { createGemmaEngine } from 'gemma-webgpu';

const CACHE_NAME = 'aubin-model-v1';
const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q8_0.gguf';

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
  return () => { listeners.delete(l); };
};

async function ensureServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }
}

async function ensureModelCached(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const existing = await cache.match(MODEL_URL);
  if (existing) {
    const size = Number(existing.headers.get('Content-Length') || 0);
    if (size > 100 * 1024 * 1024) return;
    await cache.delete(MODEL_URL);
  }

  set({ progress: 0 });
  const response = await fetch(MODEL_URL);
  if (!response.ok || !response.body) throw new Error('Download failed: ' + response.status);

  const total = Number(response.headers.get('Content-Length') || 0);
  const [forCache, forProgress] = response.body.tee();

  const cachePromise = cache.put(
    MODEL_URL,
    new Response(forCache, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(total),
      },
    })
  );

  const reader = forProgress.getReader();
  let loaded = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    loaded += r.value.length;
    if (total) set({ progress: Math.round((loaded / total) * 100) });
  }

  await cachePromise;
  set({ progress: 100 });
}

export async function loadModel(): Promise<void> {
  if (state.status === 'ready') return;
  if (!(navigator as any).gpu) {
    set({ status: 'error', error: 'WebGPU not available. Needs iOS 26+ Safari.' });
    return;
  }

  set({ status: 'loading', error: '', progress: 0 });

  try {
    await ensureServiceWorker();
    await ensureModelCached();
    engine = await createGemmaEngine({ model: '1b' });
    set({ status: 'ready', progress: 100 });
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
    throw new Error('Model not loaded yet.');
  }
  engine.addUserMessage(o.prompt);
  let full = '';
  for await (const token of engine.generate({ temperature: 0.7 })) {
    full += token;
    o.onToken?.(token);
  }
  return full;
}