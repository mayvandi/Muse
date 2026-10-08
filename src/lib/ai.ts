import { CreateMLCEngine, prebuiltAppConfig, type MLCEngine } from '@mlc-ai/web-llm';

const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';

let engine: MLCEngine | null = null;
let generating = false;
let lastProgress = -1;
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

export async function loadModel(): Promise<void> {
  if (state.status === 'ready' || state.status === 'loading') return;
  if (!(navigator as any).gpu) {
    set({ status: 'error', error: 'WebGPU tidak tersedia. Butuh iOS 26+ Safari.' });
    return;
  }
  set({ status: 'loading', error: '', progress: 0 });
  lastProgress = -1;

  try {
    engine = await CreateMLCEngine(MODEL_ID, {
      appConfig: {
        ...prebuiltAppConfig,
        cacheBackend: 'indexeddb',
      },
      initProgressCallback: (p) => {
        const percent = Math.min(100, Math.round((p.progress || 0) * 100));
        if (percent !== lastProgress) {
          lastProgress = percent;
          set({ progress: percent });
        }
      },
    });
    set({ status: 'ready', progress: 100 });
  } catch (e) {
    engine = null;
    set({ status: 'error', error: (e as Error).message });
  }
}

export function resetError(): void {
  if (state.status === 'error') {
    set({ status: 'idle', error: '', progress: 0 });
  }
}

export async function stopGenerate(): Promise<void> {
  if (!engine || !generating) return;
  try { await engine.interruptGenerate(); } catch {}
}

export async function generate(o: {
  system: string;
  prompt: string;
  onToken?: (t: string) => void;
}): Promise<string> {
  if (!engine) throw new Error('Model belum dimuat.');
  if (generating) throw new Error('Model sedang sibuk. Tunggu sebentar.');

  generating = true;
  try {
    engine.resetChat();

    const reply = (await engine.chat.completions.create({
      messages: [
        { role: 'system', content: o.system },
        { role: 'user', content: o.prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
      extra_body: { enable_thinking: false },
    } as any)) as any;

    let full = '';
    for await (const chunk of reply) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        full += token;
        o.onToken?.(token);
      }
    }
    return full;
  } finally {
    generating = false;
  }
}