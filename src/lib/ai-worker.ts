// Runs Gemma 4 E4B (LiteRT-LM, WebGPU) off the UI thread. No notes-specific logic.
import { Engine, loadLiteRtLm } from '@litert-lm/core';

const MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-it-web.litertlm';

// Minimal local types so a library typing difference can't break the build.
interface Conv { sendMessageStreaming(t: string): AsyncIterable<unknown>; delete?(): Promise<void> }
interface Eng { createConversation(o?: unknown): Promise<Conv> }
type Msg = { type: 'init' } | { type: 'gen'; id: number; system: string; prompt: string };

const ctx = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent<Msg>) => void) | null };
let engine: Eng | null = null;
let queue: Promise<void> = Promise.resolve(); // one generation at a time

async function init() {
  try {
    // Tell LiteRT-LM where the WASM files are. They're in /public/wasm/, served at /wasm/.
    await loadLiteRtLm('/wasm/');

    engine = (await Engine.create({
      model: MODEL_URL,
      mainExecutorSettings: { maxNumTokens: 8192 },
    } as never)) as unknown as Eng;

    ctx.postMessage({ type: 'ready' });
  } catch (e) {
    ctx.postMessage({ type: 'init-error', message: (e as Error).message });
  }
}

async function gen(id: number, system: string, prompt: string) {
  try {
    if (!engine) throw new Error('Model not loaded');
    const conv = await engine.createConversation({
      preface: { messages: [{ role: 'system', content: system }] },
    });
    for await (const chunk of conv.sendMessageStreaming(prompt)) {
      const text = (chunk as unknown as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
      if (text) ctx.postMessage({ type: 'token', id, text });
    }
    await conv.delete?.();
    ctx.postMessage({ type: 'done', id });
  } catch (e) {
    ctx.postMessage({ type: 'error', id, message: (e as Error).message });
  }
}

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') void init();
  else queue = queue.then(() => gen(m.id, m.system, m.prompt));
};