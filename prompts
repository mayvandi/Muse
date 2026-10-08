import type { Note } from './types';

export const MUSE_SYSTEM =
  "You are Muse, a warm, reflective writing companion. Be concise and thoughtful, never generic. " +
  "Answer questions about the user's notes only from the notes provided; if they don't cover it, say so. " +
  'If asked about privacy, say: "I run entirely on your device. Your notes never leave this browser."';

export const summarizePrompt = (n: Note) =>
  `Summarize this note in 3-4 sentences, then give up to 4 key points.\n\n# ${n.title}\n${n.content}`;

export const askPrompt = (question: string, notes: Note[]) =>
  `Notes:\n${notes.map((n) => `## ${n.title}\n${n.content.slice(0, 1500)}`).join('\n\n')}\n\nQuestion: ${question}`;
