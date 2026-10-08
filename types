export interface Note {
  id: string; title: string; content: string; // Markdown
  createdAt: number; updatedAt: number; tags: string[]; linksTo: string[];
}
export type FactCategory = 'Person' | 'Place' | 'Project' | 'Idea' | 'Event';
export interface MemoryFact {
  id: string; category: FactCategory; text: string; weight: number; sourceNoteId: string; keywords: string[];
}
