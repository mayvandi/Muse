import { useEffect, useState, useSyncExternalStore } from 'react';
import { generate, getState, loadModel, resetError, stopGenerate, subscribe } from '../lib/ai';
import { getAll } from '../lib/db';
import type { Note } from '../notes/types';
import { MUSE_SYSTEM, askPrompt } from '../notes/prompts';

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
    return () => {
      void stopGenerate();
    };
  }, []);

  const ask = async () => {
    if (!q.trim() || busy) return;
    const question = q;
    setBusy(true);
    setAnswer('');
    setQ('');
    try {
      const notes = topNotes(question, await getAll<Note>('notes'));
      await generate({
        system: MUSE_SYSTEM,
        prompt: askPrompt(question, notes),
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

  const retry = () => {
    resetError();
    void loadModel().catch(() => {});
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
          Load Muse (~350 MB, first time only)
        </button>
      )}

      {ai.status === 'loading' && (
        <p className="text-muted text-sm">
          Loading the model… {ai.progress}%. Don't close this tab.
        </p>
      )}

      {ai.status === 'error' && (
        <div className="space-y-2">
          <p className="text-accent text-sm">{ai.error}</p>
          <button
            type="button"
            className="min-h-[44px] px-4 rounded-lg border border-line bg-surface text-sm"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      )}

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
        <div className="space-y-2">
          {(() => {
            const parts = answer.split(/<\/?think>/);
            const thinking = (parts[1] || '').trim();
            const clean = (parts[2] || parts[0] || '').trim();
            return (
              <>
                {thinking && (
                  <details className="bg-surface border border-line rounded-xl p-3 text-sm text-muted">
                    <summary className="cursor-pointer">Muse's thinking</summary>
                    <div className="mt-2 whitespace-pre-wrap">{thinking}</div>
                  </details>
                )}
                <div className="bg-surface border border-line rounded-xl p-4 whitespace-pre-wrap">
                  {clean}
                  {busy && <span className="ml-1 animate-pulse">▍</span>}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}