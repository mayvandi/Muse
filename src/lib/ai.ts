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
    set('error', 'WebGPU not available.');
    return;
  }
  set('loading');
  try {
    engine = await createGemmaEngine({ model: '270m' });
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
    throw new Error('Model not loaded.');
  }
  engine.addUserMessage(o.prompt);
  let full = '';
  for await (const token of engine.generate({ temperature: 0.7 })) {
    full += token;
    o.onToken?.(token);
  }
  return full;
}