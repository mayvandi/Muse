import { useEffect, useRef, useState } from 'react';
import { getAll, put, remove } from '../lib/db';
import { generate, stopGenerate } from '../lib/ai';
import type { Note } from '../notes/types';
import { resolveLinks } from '../notes/wikilinks';
import { MUSE_SYSTEM, summarizePrompt } from '../notes/prompts';

const box = 'w-full bg-surface border border-line rounded-lg px-3 py-2 min-h-[44px]';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const timers = useRef(new Map<string, number>());
  const cur = notes.find((n) => n.id === sel);

  useEffect(() => {
    document.title = 'Notes · Aubin';
    getAll<Note>('notes').then((ns) =>
      setNotes(ns.sort((a, b) => b.updatedAt - a.updatedAt))
    );
    const t = timers.current;
    return () => {
      void stopGenerate();
      t.forEach((id) => window.clearTimeout(id));
      t.clear();
    };
  }, []);

  const create = () => {
    const now = Date.now();
    const n: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled',
      content: '',
      createdAt: now,
      updatedAt: now,
      tags: [],
      linksTo: [],
    };
    setNotes((p) => [n, ...p]);
    setSel(n.id);
    setSummary('');
    void put('notes', n);
  };

  const edit = (patch: Partial<Pick<Note, 'title' | 'content'>>) => {
    if (!cur) return;
    const next: Note = { ...cur, ...patch, updatedAt: Date.now() };
    next.linksTo = resolveLinks(next.content, notes);
    setNotes((p) => p.map((n) => (n.id === next.id ? next : n)));
    window.clearTimeout(timers.current.get(next.id));
    timers.current.set(
      next.id,
      window.setTimeout(() => void put('notes', next), 600)
    );
  };

  const del = async () => {
    if (!cur || busy) return;
    if (!confirm('Delete this note?')) return;
    await remove('notes', cur.id);
    setNotes((p) => p.filter((n) => n.id !== cur.id));
    setSel(null);
    setSummary('');
  };

  const summarize = async () => {
    if (!cur || busy) return;
    setBusy(true);
    setSummary('');
    try {
      await generate({
        system: MUSE_SYSTEM,
        prompt: summarizePrompt(cur),
        onToken: (t) => setSummary((s) => s + t),
      });
    } catch (e) {
      setSummary(`Muse couldn't run: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (cur) {
    return (
      <section className="space-y-3">
        <div className="flex gap-2">
          <button
            className="min-h-[44px] px-3 text-muted"
            onClick={() => setSel(null)}
          >
            ← Notes
          </button>
          <button
            className="min-h-[44px] px-3 ml-auto text-accent disabled:opacity-50"
            onClick={summarize}
            disabled={busy}
          >
            {busy ? 'Thinking…' : 'Summarize'}
          </button>
          <button
            className="min-h-[44px] px-3 text-muted disabled:opacity-50"
            onClick={del}
            disabled={busy}
          >
            Delete
          </button>
        </div>
        <input
          className={`${box} font-serif text-2xl`}
          value={cur.title}
          onChange={(e) => edit({ title: e.target.value })}
          aria-label="Title"
        />
        <textarea
          className={`${box} font-mono min-h-[50vh]`}
          value={cur.content}
          placeholder="Write in Markdown. Link notes with [[Title]]."
          onChange={(e) => edit({ content: e.target.value })}
        />
        {cur.linksTo.length > 0 && (
          <p className="text-sm text-muted">
            Links to:{' '}
            {cur.linksTo
              .map((id) => notes.find((n) => n.id === id)?.title)
              .join(', ')}
          </p>
        )}
        {summary && (
          <div className="bg-surface border border-line rounded-xl p-4 whitespace-pre-wrap">
            {summary}
          </div>
        )}
      </section>
    );
  }

  const shown = notes.filter((n) =>
    (n.title + n.content).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        <input
          className={box}
          type="search"
          placeholder="Search notes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="min-h-[44px] px-4 rounded-lg bg-accent text-white shrink-0"
          onClick={create}
        >
          New
        </button>
      </div>
      {shown.length === 0 && (
        <p className="text-muted">No notes yet. Tap New to begin.</p>
      )}
      {shown.map((n) => (
        <button
          key={n.id}
          className="block w-full text-left bg-surface border border-line rounded-xl p-4 min-h-[44px]"
          onClick={() => {
            setSel(n.id);
            setSummary('');
          }}
        >
          <h2 className="text-lg">{n.title || 'Untitled'}</h2>
          <p className="text-sm text-muted line-clamp-2">
            {n.content || 'Empty note'}
          </p>
        </button>
      ))}
    </section>
  );
}