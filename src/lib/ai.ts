import { pipeline, TextStreamer, type PipelineType } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/SmolLM2-360M-Instruct-ONNX';

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';

let generator: any = null;
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
    generator = await pipeline('text-generation' as PipelineType, MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4f16',
      progress_callback: (p: any) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          const percent = Math.min(100, Math.round(p.progress));
          if (percent !== lastProgress) {
            lastProgress = percent;
            set({ progress: percent });
          }
        }
      },
    });
    set({ status: 'ready', progress: 100 });
  } catch (e) {
    generator = null;
    set({ status: 'error', error: (e as Error).message });
  }
}

export function resetError(): void {
  if (state.status === 'error') {
    set({ status: 'idle', error: '', progress: 0 });
  }
}

export async function stopGenerate(): Promise<void> {
  if (!generator || !generating) return;
  try {
    if (typeof generator.interrupt === 'function') await generator.interrupt();
  } catch {}
}

export async function generate(o: {
  system: string;
  prompt: string;
  onToken?: (t: string) => void;
}): Promise<string> {
  if (!generator) throw new Error('Model belum dimuat.');
  if (generating) throw new Error('Model sedang sibuk. Tunggu sebentar.');

  generating = true;
  try {
    const messages = [
      { role: 'system', content: o.system },
      { role: 'user', content: o.prompt },
    ];

    let full = '';
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        full += text;
        o.onToken?.(text);
      },
    });

    await generator(messages, {
      max_new_tokens: 500,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
      streamer,
    });

    return full;
  } finally {
    generating = false;
  }
}