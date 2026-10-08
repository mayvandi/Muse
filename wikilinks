import type { Note } from './types';

const RE = /\[\[([^\]]+)\]\]/g;

/** Titles referenced as [[Title]] in Markdown. */
export const extractTitles = (md: string): string[] => [...md.matchAll(RE)].map((m) => m[1].trim());

/** Resolve [[Title]] references to note ids (case-insensitive). */
export function resolveLinks(md: string, notes: Note[]): string[] {
  const wanted = new Set(extractTitles(md).map((t) => t.toLowerCase()));
  return notes.filter((n) => wanted.has(n.title.toLowerCase())).map((n) => n.id);
}
