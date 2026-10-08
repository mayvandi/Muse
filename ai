// Main-thread client for the model worker. Pure engine: no notes-specific logic.
export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';
interface Job { text: string; onToken?: (t: string) => void; resolve: (s: string) => void; reject: (e: Error) => void }

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let initDone: { resolve: () => void; reject: (e: Error) => void } | null = null;
let state: { status: AiStatus; error: string } = { status: 'idle', error: '' };
let nextId = 1;
const jobs = new Map<number, Job>();
const listeners = new Set<() => void>();

const set = (status: AiStatus, error = '') => { state = { status, error }; listeners.forEach((l) => l()); };
export const getState = () => state;
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function loadModel(): Promise<void> {
  if (ready) return ready;
  if (!(navigator as unknown as { gpu?: unknown }).gpu) {
    set('error', 'WebGPU is not available. Muse needs iOS 26+ Safari (or a WebGPU browser). It will not fall back to the cloud.');
    return Promise.reject(new Error(state.error));
  }
  set('loading');
  ready = new Promise<void>((resolve, reject) => {
    initDone = { resolve, reject };
    worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; id?: number; text?: string; message?: string };
      if (m.type === 'ready') { set('ready'); initDone?.resolve(); }
      else if (m.type === 'init-error') { set('error', m.message ?? 'Model failed to load'); initDone?.reject(new Error(state.error)); }
      else if (m.id !== undefined) {
        const j = jobs.get(m.id);
        if (!j) return;
        if (m.type === 'token') { j.text += m.text ?? ''; j.onToken?.(m.text ?? ''); }
        else { jobs.delete(m.id); if (m.type === 'done') j.resolve(j.text); else j.reject(new Error(m.message)); }
      }
    };
    worker.postMessage({ type: 'init' });
  });
  ready.catch(() => { worker?.terminate(); worker = null; ready = null; });
  return ready;
}

export async function generate(o: { system: string; prompt: string; onToken?: (t: string) => void }): Promise<string> {
  await loadModel();
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    jobs.set(id, { text: '', onToken: o.onToken, resolve, reject });
    worker!.postMessage({ type: 'gen', id, system: o.system, prompt: o.prompt });
  });
}
