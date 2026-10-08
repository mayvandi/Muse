// Generic IndexedDB helpers. No notes-specific logic; add a store name to reuse for other data.
import { openDB, type IDBPDatabase } from 'idb';

export const STORES = ['notes', 'facts'] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBPDatabase> | null = null;
const db = () =>
  (dbp ??= openDB('muse', 1, {
    upgrade(d) { STORES.forEach((s) => d.createObjectStore(s, { keyPath: 'id' })); },
  }));

export async function put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  await (await db()).put(store, value);
}
export async function getAll<T>(store: StoreName): Promise<T[]> {
  return (await (await db()).getAll(store)) as T[];
}
export async function remove(store: StoreName, id: string): Promise<void> {
  await (await db()).delete(store, id);
}
export async function exportAll(): Promise<string> {
  const out: Record<string, unknown[]> = {};
  for (const s of STORES) out[s] = await getAll(s);
  return JSON.stringify(out);
}
export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json) as Record<string, { id: string }[]>;
  for (const s of STORES) for (const v of data[s] ?? []) await put(s, v);
}