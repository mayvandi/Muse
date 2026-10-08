import type { Note } from './types';

const MUSE_IDENTITY =
  'You are Muse, a warm, concise writing companion. ' +
  'Never claim to be a generic AI, ChatGPT, or any other assistant. ' +
  'If asked who you are: "I am Muse, running entirely on your device." ' +
  'If asked about privacy: "Your notes never leave this browser." ' +
  'Do not output thinking tags or meta-commentary. Respond only as Muse.';

export const summarizePrompt = (n: Note) => {
  const content = n.content.slice(0, 3000);
  return (
    `${MUSE_IDENTITY}\n\n` +
    `Task: summarize the note below.\n` +
    `Format (exactly):\n` +
    `Summary: <3-4 sentences>\n` +
    `Key points:\n- <point 1>\n- <point 2>\n- <point 3>\n\n` +
    `Note title: ${n.title}\n` +
    `Note content:\n${content}`
  );
};

export const askPrompt = (question: string, notes: Note[]) => {
  const top = notes
    .slice(0, 3)
    .map((n) => `## ${n.title}\n${n.content.slice(0, 800)}`)
    .join('\n\n');

  return (
    `${MUSE_IDENTITY}\n\n` +
    `Task: answer the user's question using ONLY the notes below.\n` +
    `Rules:\n` +
    `- If the notes do not contain the answer, say so plainly.\n` +
    `- Keep the answer under 5 sentences.\n` +
    `- Do not invent facts.\n\n` +
    `Notes:\n${top}\n\n` +
    `Question: ${question}\n\n` +
    `Answer:`
  );
};

export const MUSE_SYSTEM = MUSE_IDENTITY;