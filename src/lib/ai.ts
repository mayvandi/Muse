import { Engine, loadLiteRtLm, type EngineSettings } from '@litert-lm/core';

const MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Conv {
  sendMessageStreaming(t: string): AsyncIterable<{ content: { text: string }[] }>;
  delete?(): Promise<void>;
}

let engine: Engine | null = null;
let conv: Conv | null = null;
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
  if (!navigator.gpu) {
    set('error', 'WebGPU tidak tersedia. Muse butuh iOS 26+ Safari.');
    return;
  }
  set('loading');
  try {
    // 1. Muat WASM runtime dari folder public/wasm/
    await loadLiteRtLm('/wasm/litertlm_wasm_compat_internal.js');

    // 2. Buat engine
    const settings = {
      model: MODEL_URL,
      mainExecutorSettings: { maxNumTokens: 8192 },
    } satisfies EngineSettings;

    engine = await Engine.create(settings);

    // 3. Buat conversation default
    conv = await engine.createConversation({
      preface: {
        messages: [{ role: 'system', content: 'You are Muse, a helpful assistant.' }],
      },
    }) as unknown as Conv;

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
  if (state.status !== 'ready' || !conv) {
    throw new Error('Model belum dimuat. Tap "Load Muse" dulu.');
  }

  let full = '';
  for await (const chunk of conv.sendMessageStreaming(o.prompt)) {
    const text = chunk.content?.[0]?.text ?? '';
    if (text) {
      full += text;
      o.onToken?.(text);
    }
  }
  return full;
}