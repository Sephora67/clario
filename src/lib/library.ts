// Bibliothèque Clario : tout est enregistré dans le compte (base de données + stockage de fichiers).
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { tf } from "@/lib/i18n";
import { idbDel, idbGet, idbKeys, idbSet, isOffline } from "@/lib/offline-store";

export type Tone = "purple" | "pink" | "blue" | "green" | "coral" | "yellow" | "violet";
export const TONES: Tone[] = ["yellow", "green", "blue", "purple", "coral", "pink", "violet"];
export type Folder = { id: string; name: string; tone: string; courseId: string | null; parentId: string | null };
export type DocMeta = { id: string; name: string; kind: "PDF" | "Image" | "Page" | "Vidéo" | "Audio"; mime: string; size: number; folderId: string | null; courseId: string | null; storagePath: string; updatedAt: number };
export type CourseStatus = "en_cours" | "a_reviser" | "valide";
export type Course = { id: string; name: string; description: string; tone: string; status: CourseStatus; progress: number; archived: boolean; updatedAt: number };
export type CalendarEvent = { id: string; title: string; notes: string; courseId: string | null; startsAt: string; remindMinutes: number | null; done: boolean };
export type AppNotification = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
export type DocState = { marks?: Record<number, unknown[]>; bookmarks?: number[]; rotations?: Record<number, number>; pages?: string[] };

const BUCKET = "clario-files";
export const emit = () => window.dispatchEvent(new Event("clario-library"));
const okN = <T,>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) {
    // Limite de 5 documents (Découverte gratuite) imposée par la base de données.
    if (r.error.message.includes("DOC_LIMIT")) throw new Error(tf("Tu as atteint la limite de 5 documents de la Découverte gratuite. Passe au Pass ou au Club pour des documents illimités !"));
    throw new Error(r.error.message);
  }
  return r.data;
};
const ok = <T,>(r: { data: T; error: { message: string } | null }): NonNullable<T> => okN(r) as NonNullable<T>;
async function me() { const { data } = await supabase.auth.getUser(); if (!data.user) throw new Error("Connexion requise"); return data.user.id; }
const ext = (name: string) => (name.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
export const kindOf = (mime: string): DocMeta["kind"] => mime === "application/pdf" ? "PDF" : mime.startsWith("video/") ? "Vidéo" : mime.startsWith("audio/") ? "Audio" : "Image";

type DocRow = { id: string; name: string; kind: string; mime: string; size: number; folder_id: string | null; course_id: string | null; storage_path: string; updated_at: string };
const toDoc = (r: DocRow): DocMeta => ({ id: r.id, name: r.name, kind: r.kind as DocMeta["kind"], mime: r.mime, size: r.size, folderId: r.folder_id, courseId: r.course_id, storagePath: r.storage_path, updatedAt: new Date(r.updated_at).getTime() });
const DOC_COLS = "id,name,kind,mime,size,folder_id,course_id,storage_path,updated_at";

// ---------- Dossiers ----------
export async function listFolders(): Promise<Folder[]> {
  const rows = ok(await supabase.from("folders").select("id,name,tone,course_id,parent_id").order("created_at"));
  return rows.map((r) => ({ id: r.id, name: r.name, tone: r.tone, courseId: r.course_id, parentId: r.parent_id }));
}
export async function createFolder(name: string, courseId: string | null = null, tone?: string, parentId: string | null = null) {
  if (parentId) {
    const parent = (await listFolders()).find((folder) => folder.id === parentId);
    if (!parent) throw new Error("Le dossier parent n’existe plus.");
    if (parent.parentId) throw new Error("Deux niveaux de dossiers maximum.");
  }
  const n = (await listFolders()).length;
  ok(await supabase.from("folders").insert({ name, course_id: courseId, parent_id: parentId, tone: tone ?? TONES[n % TONES.length]! })); emit();
}
export async function renameFolder(id: string, name: string) { ok(await supabase.from("folders").update({ name }).eq("id", id)); emit(); }
export async function setFolderTone(id: string, tone: string) { ok(await supabase.from("folders").update({ tone }).eq("id", id)); emit(); }
export async function setFolderCourse(id: string, courseId: string | null) { ok(await supabase.from("folders").update({ course_id: courseId }).eq("id", id)); emit(); }
export async function setFolderParent(id: string, parentId: string | null) {
  if (id === parentId) throw new Error("Un dossier ne peut pas être placé dans lui-même.");
  if (parentId) {
    const folders = await listFolders(); const moving = folders.find((folder) => folder.id === id); const parent = folders.find((folder) => folder.id === parentId);
    if (!moving || !parent) throw new Error("Ce dossier n’existe plus.");
    if (parent.parentId || folders.some((folder) => folder.parentId === id)) throw new Error("Deux niveaux de dossiers maximum.");
  }
  ok(await supabase.from("folders").update({ parent_id: parentId }).eq("id", id)); emit();
}
export async function deleteFolder(id: string) {
  const f = okN(await supabase.from("folders").select("parent_id").eq("id", id).maybeSingle());
  const parent = f?.parent_id ?? null;
  ok(await supabase.from("folders").update({ parent_id: parent }).eq("parent_id", id));
  ok(await supabase.from("documents").update({ folder_id: parent }).eq("folder_id", id));
  ok(await supabase.from("folders").delete().eq("id", id)); emit();
}
export async function moveDocs(ids: string[], folderId: string | null) { if (ids.length) ok(await supabase.from("documents").update({ folder_id: folderId }).in("id", ids)); emit(); }

// ---------- Documents ----------
export async function listDocs(): Promise<DocMeta[]> { return ok(await supabase.from("documents").select(DOC_COLS).order("updated_at", { ascending: false })).map(toDoc); }
export async function getDoc(id: string): Promise<DocMeta | undefined> { const r = okN(await supabase.from("documents").select(DOC_COLS).eq("id", id).maybeSingle()); return r ? toDoc(r) : undefined; }
export async function touchDoc(id: string) { await supabase.from("documents").update({ updated_at: new Date().toISOString() }).eq("id", id); }
export async function moveDoc(id: string, folderId: string | null) { ok(await supabase.from("documents").update({ folder_id: folderId }).eq("id", id)); emit(); }
export async function setDocCourse(id: string, courseId: string | null) { ok(await supabase.from("documents").update({ course_id: courseId }).eq("id", id)); emit(); }
export async function renameDoc(id: string, name: string) { ok(await supabase.from("documents").update({ name }).eq("id", id)); emit(); }

export async function saveDoc(file: Blob, name: string, folderId: string | null, kind?: DocMeta["kind"], courseId: string | null = null): Promise<string> {
  const user = await me(); const id = crypto.randomUUID(); const mime = file.type || "application/octet-stream";
  const path = `${user}/docs/${id}${ext((file as File).name ?? "") || (mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : "")}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  ok(await supabase.from("documents").insert({ id, name, kind: kind ?? kindOf(mime), mime, size: file.size, folder_id: folderId, course_id: courseId, storage_path: path }));
  emit(); return id;
}
export async function getDocFile(id: string): Promise<Blob | undefined> {
  if (isOffline()) return idbGet<Blob>("files", id);
  try {
    const d = await getDoc(id); if (!d) return undefined;
    const r = await supabase.storage.from(BUCKET).download(d.storagePath); if (r.error) throw new Error(r.error.message);
    void idbSet("files", id, r.data); void idbSet("meta", id, d); return r.data;
  } catch (e) { const local = await idbGet<Blob>("files", id); if (local) return local; throw e; }
}
export async function fileUrl(path: string) { const r = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600); return r.data?.signedUrl ?? null; }
export async function deleteDoc(id: string) {
  const d = await getDoc(id); const m = ok(await supabase.from("media").select("storage_path").eq("document_id", id));
  const paths = [d?.storagePath, ...m.map((x) => x.storage_path)].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  ok(await supabase.from("documents").delete().eq("id", id)); emit();
}
export async function getDocState(id: string): Promise<DocState> {
  const pending = await idbGet<DocState>("pending", id); if (pending) return pending; // modifications locales non encore envoyées
  if (isOffline()) return (await idbGet<DocState>("state", id)) ?? {};
  try { const r = okN(await supabase.from("documents").select("state").eq("id", id).maybeSingle()); const s = (r?.state ?? {}) as DocState; void idbSet("state", id, s); return s; }
  catch (e) { const local = await idbGet<DocState>("state", id); if (local) return local; throw e; }
}
// Hors ligne : enregistré sur l'appareil puis envoyé au retour d'Internet. Renvoie "local" dans ce cas.
export async function saveDocState(id: string, state: DocState): Promise<"synced" | "local"> {
  await idbSet("state", id, state);
  if (isOffline()) { await idbSet("pending", id, state); window.dispatchEvent(new Event("clario-pending")); return "local"; }
  try { ok(await supabase.from("documents").update({ state: state as unknown as Json, updated_at: new Date().toISOString() }).eq("id", id)); await idbDel("pending", id); return "synced"; }
  catch (e) { if (e instanceof TypeError || isOffline()) { await idbSet("pending", id, state); return "local"; } throw e; }
}
export async function syncPendingStates(): Promise<number> {
  let n = 0;
  for (const id of await idbKeys("pending")) {
    const s = await idbGet<DocState>("pending", id); if (!s) continue;
    const r = await supabase.from("documents").update({ state: s as unknown as Json, updated_at: new Date().toISOString() }).eq("id", id);
    if (!r.error) { await idbDel("pending", id); n++; }
  }
  return n;
}

export async function blankPage(): Promise<Blob> {
  const c = document.createElement("canvas"); c.width = 1240; c.height = 1754;
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

// ---------- Pages ajoutées dans un cahier ----------
export async function uploadPage(docId: string, blob: Blob): Promise<string> {
  const user = await me(); const type = blob.type || "image/png"; const path = `${user}/pages/${docId}/${crypto.randomUUID()}${type === "image/jpeg" ? ".jpg" : ".png"}`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type }); if (up.error) throw new Error(up.error.message); return path;
}
export async function loadPageImage(path: string): Promise<string> { const r = await supabase.storage.from(BUCKET).download(path); if (r.error) throw new Error(r.error.message); return URL.createObjectURL(r.data); }

// ---------- Médias joints à une page ----------
export type MediaItem = { id: string; name: string; type: string; page: number; path: string };
export const MEDIA_MAX = 50 * 1024 * 1024;
export async function listMedia(docId: string): Promise<MediaItem[]> {
  return ok(await supabase.from("media").select("id,name,mime,page,storage_path").eq("document_id", docId).order("created_at")).map((r) => ({ id: r.id, name: r.name, type: r.mime, page: r.page, path: r.storage_path }));
}
export async function addMedia(docId: string, file: File, page: number): Promise<MediaItem> {
  const user = await me(); const id = crypto.randomUUID(); const path = `${user}/media/${id}${ext(file.name)}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type }); if (up.error) throw new Error(up.error.message);
  ok(await supabase.from("media").insert({ id, document_id: docId, name: file.name, mime: file.type, page, storage_path: path }));
  return { id, name: file.name, type: file.type, page, path };
}
export async function getMedia(item: MediaItem) { const r = await supabase.storage.from(BUCKET).download(item.path); return r.data ?? undefined; }
export async function removeMedia(item: MediaItem) { await supabase.storage.from(BUCKET).remove([item.path]); ok(await supabase.from("media").delete().eq("id", item.id)); }

// ---------- Cours ----------
type CourseRow = { id: string; name: string; description: string; tone: string; status: string; progress: number; archived: boolean; updated_at: string };
const toCourse = (r: CourseRow): Course => ({ id: r.id, name: r.name, description: r.description, tone: r.tone, status: r.status as CourseStatus, progress: r.progress, archived: r.archived, updatedAt: new Date(r.updated_at).getTime() });
export async function listCourses(): Promise<Course[]> { return ok(await supabase.from("courses").select("*").order("updated_at", { ascending: false })).map(toCourse); }
export async function getCourse(id: string) { const r = okN(await supabase.from("courses").select("*").eq("id", id).maybeSingle()); return r ? toCourse(r) : undefined; }
export async function createCourse(name: string, tone?: string): Promise<string> {
  const n = (await listCourses()).length;
  const r = ok(await supabase.from("courses").insert({ name, tone: tone ?? TONES[n % TONES.length]! }).select("id").single()); emit(); return r.id;
}
export async function updateCourse(id: string, patch: Partial<Pick<Course, "name" | "description" | "tone" | "status" | "progress" | "archived">>) {
  ok(await supabase.from("courses").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)); emit();
}
export async function deleteCourse(id: string) { ok(await supabase.from("courses").delete().eq("id", id)); emit(); }

// ---------- Calendrier ----------
type EvRow = { id: string; title: string; notes: string; course_id: string | null; starts_at: string; remind_minutes: number | null; done: boolean };
const toEv = (r: EvRow): CalendarEvent => ({ id: r.id, title: r.title, notes: r.notes, courseId: r.course_id, startsAt: r.starts_at, remindMinutes: r.remind_minutes, done: r.done });
export async function listEvents(): Promise<CalendarEvent[]> { return ok(await supabase.from("calendar_events").select("id,title,notes,course_id,starts_at,remind_minutes,done").order("starts_at")).map(toEv); }
export async function saveEvent(ev: Omit<CalendarEvent, "id" | "done"> & { id?: string | undefined; done?: boolean }) {
  const row = { title: ev.title, notes: ev.notes, course_id: ev.courseId, starts_at: ev.startsAt, remind_minutes: ev.remindMinutes, done: ev.done ?? false };
  if (ev.id) ok(await supabase.from("calendar_events").update(row).eq("id", ev.id)); else ok(await supabase.from("calendar_events").insert(row));
  emit();
}
export async function deleteEvent(id: string) { ok(await supabase.from("calendar_events").delete().eq("id", id)); emit(); }

// ---------- Notifications ----------
export async function checkReminders() { const r = await supabase.rpc("generate_my_reminders"); return (r.data as number | null) ?? 0; }
export async function listNotifications(): Promise<AppNotification[]> {
  return ok(await supabase.from("notifications").select("id,title,body,link,read_at,created_at").order("created_at", { ascending: false }).limit(30)).map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link, readAt: r.read_at, createdAt: r.created_at }));
}
export async function markRead(id: string) { ok(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id)); emit(); }
export async function markAllRead() { ok(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null)); emit(); }

// ---------- Profil ----------
export type Profile = { id: string; displayName: string | null; timezone: string; avatar: string | null; locale: "en" | "fr" };
export async function getProfile(): Promise<Profile | null> {
  const id = await me();
  const r = okN(await supabase.from("profiles").select("id,display_name,timezone,avatar,locale").eq("id", id).maybeSingle());
  return r ? { id: r.id, displayName: r.display_name, timezone: r.timezone, avatar: r.avatar, locale: r.locale === "fr" ? "fr" : "en" } : null;
}
export async function updateProfile(patch: { displayName?: string | null; avatar?: string | null; locale?: "en" | "fr" }) {
  const id = await me();
  const row: { display_name?: string | null; avatar?: string | null; locale?: "en" | "fr" } = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.avatar !== undefined) row.avatar = patch.avatar;
  if (patch.locale !== undefined) row.locale = patch.locale;
  ok(await supabase.from("profiles").update(row).eq("id", id));
  emit();
}

// ---------- Recherche ----------
export async function searchAll(q: string) {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const [c, f, d] = await Promise.all([
    supabase.from("courses").select("id,name").ilike("name", like).limit(8),
    supabase.from("folders").select("id,name").ilike("name", like).limit(8),
    supabase.from("documents").select("id,name,kind").ilike("name", like).limit(12),
  ]);
  return { courses: c.data ?? [], folders: f.data ?? [], docs: d.data ?? [] };
}

// ---------- Anciennes données de l'appareil ----------
type LocalDoc = { id: string; name: string; kind: DocMeta["kind"] };
export function listLocalDocs(): LocalDoc[] { try { return JSON.parse(localStorage.getItem("clario-docs") ?? "[]") as LocalDoc[]; } catch { return []; } }
function idbGetLegacy(key: string): Promise<Blob | undefined> {
  return new Promise((res) => { const r = indexedDB.open("clario", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onerror = () => res(undefined);
    r.onsuccess = () => { try { const g = r.result.transaction("files", "readonly").objectStore("files").get(key); g.onsuccess = () => res(g.result as Blob | undefined); g.onerror = () => res(undefined); } catch { res(undefined); } }; });
}
export async function importLocalDocs(): Promise<number> {
  let n = 0;
  for (const d of listLocalDocs()) {
    const blob = await idbGetLegacy(d.id); if (!blob) continue;
    const id = await saveDoc(blob, d.name, null, d.kind);
    const read = (k: string) => { try { return JSON.parse(localStorage.getItem(`${k}:${d.id}`) ?? "null"); } catch { return null; } };
    await saveDocState(id, { marks: read("clario-notes") ?? {}, bookmarks: read("clario-bookmarks") ?? [], rotations: read("clario-rotations") ?? {} });
    n++;
  }
  localStorage.setItem("clario-docs-migrated", "1"); emit(); return n;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000);
}

// ---------- Animations ----------
import type { AnimScript, SavedAnimation } from "@/lib/animation-types";
type AnimRow = { id: string; document_id: string; course_id: string | null; page: number; title: string; script: unknown; audio_path: string | null; created_at: string };
const toAnim = (r: AnimRow): SavedAnimation => ({ id: r.id, documentId: r.document_id, courseId: r.course_id, page: r.page, title: r.title, script: r.script as AnimScript, audioPath: r.audio_path, createdAt: r.created_at });
export async function listDocAnimations(documentId: string): Promise<SavedAnimation[]> {
  return ok(await supabase.from("animations").select("*").eq("document_id", documentId).order("created_at", { ascending: false })).map(toAnim);
}
export async function listCourseAnimations(courseId: string): Promise<SavedAnimation[]> {
  return ok(await supabase.from("animations").select("*").eq("course_id", courseId).order("created_at", { ascending: false })).map(toAnim);
}
// Recale une animation sur une autre page (ajout, déplacement, suppression de pages).
export async function setAnimationPage(id: string, page: number) { ok(await supabase.from("animations").update({ page }).eq("id", id)); }
export async function getAnimationAudio(path: string): Promise<string | null> {
  const r = await supabase.storage.from(BUCKET).download(path);
  return r.data ? URL.createObjectURL(r.data) : null;
}
