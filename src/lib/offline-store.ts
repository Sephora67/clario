// Copie locale (IndexedDB) des documents ouverts et file d'attente des annotations hors ligne.
const DB = "clario-offline";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { for (const s of ["files", "meta", "state", "pending"]) r.result.createObjectStore(s); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  try { const db = await open(); return await new Promise((res) => { const g = db.transaction(store).objectStore(store).get(key); g.onsuccess = () => res(g.result as T); g.onerror = () => res(undefined); }); } catch { return undefined; }
}
export async function idbSet(store: string, key: string, value: unknown) {
  try { const db = await open(); await new Promise<void>((res) => { const t = db.transaction(store, "readwrite"); t.objectStore(store).put(value, key); t.oncomplete = () => res(); t.onerror = () => res(); }); } catch { /* stockage indisponible */ }
}
export async function idbDel(store: string, key: string) {
  try { const db = await open(); await new Promise<void>((res) => { const t = db.transaction(store, "readwrite"); t.objectStore(store).delete(key); t.oncomplete = () => res(); t.onerror = () => res(); }); } catch { /* ignore */ }
}
export async function idbKeys(store: string): Promise<string[]> {
  try { const db = await open(); return await new Promise((res) => { const g = db.transaction(store).objectStore(store).getAllKeys(); g.onsuccess = () => res(g.result as string[]); g.onerror = () => res([]); }); } catch { return []; }
}
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
