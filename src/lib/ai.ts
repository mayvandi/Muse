import { createGemmaEngine } from 'gemma-webgpu';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';

let engine: any = null;
let state: { status: AiStatus; error: string } = { status: 'idle', error: '' };
const listeners = new Set<() => void>();

const set = (status: AiStatus, error = '') => {
  state = { status, error };
  listeners.forEach((l) => l());
};

export const getState = () => state;
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export async function loadModel(): Promise<void> {
  if (state.status === 'ready') return;
    if (!(navigator as any).gpu) {
    set('error', 'WebGPU tidak tersedia. Aubin butuh iOS 26+ Safari.');
    return;
  }
  set('loading');
  try {
    // '1b' akan otomatis mengunduh model Gemma 3 1B (~1GB) secara streaming.
    engine = await createGemmaEngine({
      model: '1b',
      onProgress: (p: any) => console.log('Loading:', p.status),
    });
    set('ready');
  } catch (e) {
    set('error', (e as Error).message);
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