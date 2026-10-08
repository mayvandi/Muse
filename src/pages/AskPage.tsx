import { useEffect, useState, useSyncExternalStore } from 'react';
import { generate, getState, loadModel, subscribe } from '../lib/ai';
import { getAll } from '../lib/db';
import type { Note } from '../notes/types';
import { MUSE_SYSTEM, askPrompt } from '../notes/prompts';

// Keyword retrieval: top 3 notes by word overlap (semantic search comes later).
function topNotes(q: string, notes: Note[]): Note[] {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const score = (n: Note) =>
    words.reduce(
      (s, w) => s + ((n.title + ' ' + n.content).toLowerCase().split(w).length - 1),
      0
    );
  return notes
    .map((n) => ({ n, s: score(n) }))
    .sort((a, b) => b.s - a.s || b.n.updatedAt - a.n.updatedAt)
    .slice(0, 3)
    .map((x) => x.n);
}

export default function AskPage() {
  const ai = useSyncExternalStore(subscribe, getState);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Ask Muse · Aubin';
  }, []);

  const ask = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setAnswer('');
    try {
      const notes = topNotes(q, await getAll<Note>('notes'));
      await generate({
        system: MUSE_SYSTEM,
        prompt: askPrompt(q, notes),
        onToken: (t) => setAnswer((a) => a + t),
      });
    } catch (e) {
      const msg = (e as Error).message || 'Unknown error';
      setAnswer(
        msg.includes('memory') || msg.includes('Aborted')
          ? 'Model ran out of memory. Close other tabs, then reload Aubin.'
          : `Muse couldn't answer: ${msg}`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <p className="text-muted text-sm">
        Muse runs entirely on your device. Your notes never leave this browser.
      </p>

      {ai.status === 'idle' && (
        <button
          type="button"
          className="min-h-[44px] px-4 rounded-lg bg-accent text-white"
          onClick={() => loadModel().catch(() => {})}
        >
          Load Muse (~2 GB, first time only)
        </button>
      )}

      {ai.status === 'loading' && (
        <p className="text-muted text-sm">
          Loading the model… this can take 1–3 minutes on WiFi. Don't close this tab.
        </p>
      )}

      {ai.status === 'error' && <p className="text-accent text-sm">{ai.error}</p>}

      <textarea
        className="w-full bg-surface border border-line rounded-lg px-3 py-2 min-h-[96px]"
        placeholder="What did I write about…?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={busy}
      />

      <button
        type="button"
        className="min-h-[44px] px-4 rounded-lg border border-line bg-surface disabled:opacity-50"
        onClick={ask}
        disabled={busy || ai.status !== 'ready'}
      >
        {busy ? 'Thinking…' : 'Ask'}
      </button>

      {answer && (
        <div className="bg-surface border border-line rounded-xl p-4 whitespace-pre-wrap">
          {answer}
          {busy && <span className="ml-1 animate-pulse">▍</span>}
        </div>
      )}
    </section>
  );
}