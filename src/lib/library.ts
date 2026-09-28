// Bibliothèque locale : dossiers (localStorage) + fichiers (IndexedDB, sur l'appareil).
export type Folder = { id: string; name: string; tone: string };
export type DocMeta = { id: string; name: string; kind: "PDF" | "Image" | "Page"; folderId: string | null; updatedAt: number };

const TONES = ["purple", "pink", "blue", "green", "coral", "yellow", "violet"];
const FKEY = "clario-folders";
const DKEY = "clario-docs";
const uid = () => Math.random().toString(36).slice(2, 10);
const emit = () => window.dispatchEvent(new Event("clario-library"));

const DEFAULT_FOLDERS: Folder[] = ["Comptabilité de management II", "Statistiques", "Microéconomie", "Fiscalité", "Finance", "Droit des affaires"]
  .map((name, i) => ({ id: `f${i}`, name, tone: TONES[i % TONES.length]! }));

function read<T>(k: string, fallback: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function write(k: string, v: unknown) { localStorage.setItem(k, JSON.stringify(v)); emit(); }

export const listFolders = () => read<Folder[]>(FKEY, DEFAULT_FOLDERS);
export function createFolder(name: string) { const f = listFolders(); write(FKEY, [...f, { id: uid(), name, tone: TONES[f.length % TONES.length]! }]); }
export function renameFolder(id: string, name: string) { write(FKEY, listFolders().map((f) => (f.id === id ? { ...f, name } : f))); }
export function deleteFolder(id: string) { write(FKEY, listFolders().filter((f) => f.id !== id)); write(DKEY, listDocs().map((d) => (d.folderId === id ? { ...d, folderId: null } : d))); }

export const listDocs = () => read<DocMeta[]>(DKEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
export const getDoc = (id: string) => listDocs().find((d) => d.id === id);
export function touchDoc(id: string) { write(DKEY, listDocs().map((d) => (d.id === id ? { ...d, updatedAt: Date.now() } : d))); }
export function moveDoc(id: string, folderId: string | null) { write(DKEY, listDocs().map((d) => (d.id === id ? { ...d, folderId } : d))); }
export function renameDoc(id: string, name: string) { write(DKEY, listDocs().map((d) => (d.id === id ? { ...d, name } : d))); }

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open("clario", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const r = fn(d.transaction("files", mode).objectStore("files")); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function saveDoc(file: Blob, name: string, folderId: string | null, kind?: DocMeta["kind"]): Promise<string> {
  const id = uid();
  await tx("readwrite", (s) => s.put(file, id));
  write(DKEY, [...listDocs(), { id, name, kind: kind ?? (file.type === "application/pdf" ? "PDF" : "Image"), folderId, updatedAt: Date.now() }]);
  return id;
}
export const getDocFile = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id));
export async function deleteDoc(id: string) { await tx("readwrite", (s) => s.delete(id)); write(DKEY, listDocs().filter((d) => d.id !== id)); localStorage.removeItem(`clario-notes:${id}`); }

export async function blankPage(): Promise<Blob> {
  const c = document.createElement("canvas"); c.width = 1240; c.height = 1754;
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

// Médias joints (audio, vidéo, image) stockés sur l'appareil.
export type MediaItem = { id: string; name: string; type: string; page: number };
export const MEDIA_MAX = 50 * 1024 * 1024;
export const listMedia = (docId: string) => read<MediaItem[]>(`clario-media:${docId}`, []);
export async function addMedia(docId: string, file: File, page: number): Promise<MediaItem> {
  const item = { id: uid(), name: file.name, type: file.type, page };
  await tx("readwrite", (s) => s.put(file, `media:${item.id}`));
  localStorage.setItem(`clario-media:${docId}`, JSON.stringify([...listMedia(docId), item]));
  return item;
}
export const getMedia = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(`media:${id}`));
export async function removeMedia(docId: string, id: string) { await tx("readwrite", (s) => s.delete(`media:${id}`)); localStorage.setItem(`clario-media:${docId}`, JSON.stringify(listMedia(docId).filter((m) => m.id !== id))); }

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000);
}
