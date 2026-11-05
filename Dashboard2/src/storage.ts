import type { Data, Kind, RecordData } from "./types";

type Entry = { id: number; kind: Kind; recordId: string; saved: string; before: Record<string, string> | null; after: Record<string, string> | null };
const fields = ["status", "grade", "enrollmentStatus", "score", "creditsEarned", "creditsManual", "lectureCompleted", "quizCompleted", "examSelected"];
const empty = (): Data => ({ version: 1, revision: 0, courses: [], assessments: [], tasks: [] });
export function validateData(value: unknown): Data {
  if (!value || typeof value !== "object") throw Error("Ungültiges Campus-JSON.");
  const d = value as Data;
  if (d.version !== 1) throw Error("Unbekannte Version.");
  for (const kind of ["courses", "assessments", "tasks"] as const) {
    if (!Array.isArray(d[kind]) || d[kind].length > 10000) throw Error("Ungültige Einträge.");
    const ids = new Set<string>();
    for (const x of d[kind]) {
      if (!x || typeof x !== "object" || Array.isArray(x) || typeof x.id !== "string" || !x.id || ids.has(x.id) || typeof x.name !== "string" || !x.name.trim() || Object.values(x).some(v => typeof v !== "string")) throw Error("Ungültiger Eintrag oder doppelte ID.");
      ids.add(x.id);
    }
  }
  return { version: 1, revision: Number.isSafeInteger(d.revision) && d.revision >= 0 ? d.revision : 0, courses: d.courses, assessments: d.assessments, tasks: d.tasks };
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("campus-dashboard", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("data"); req.result.createObjectStore("history", { keyPath: "id", autoIncrement: true }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || Error("Browser-Speicher nicht verfügbar."));
  });
}
export async function loadData(): Promise<Data> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", "readonly"); const req = tx.objectStore("data").get("current");
    req.onsuccess = () => { try { resolve(req.result ? validateData(req.result) : empty()); } catch (e) { reject(e); } };
    tx.onerror = () => reject(tx.error); tx.oncomplete = () => db.close();
  });
}
const snapshot = (x?: RecordData): Record<string, string> | null => x ? Object.fromEntries(fields.filter(k => x[k] !== undefined).map(k => [k, x[k]])) : null;
export async function saveData(input: Data): Promise<Data> {
  const next = validateData(input); const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["data", "history"], "readwrite"); const store = tx.objectStore("data"); const req = store.get("current"); let result: Data; let conflict = false;
    req.onsuccess = () => {
      const old: Data = req.result || empty();
      if (old.revision !== next.revision) { conflict = true; tx.abort(); return; }
      result = { ...next, revision: old.revision + 1 };
      for (const kind of ["courses", "assessments", "tasks"] as const) {
        const before = new Map(old[kind].map(x => [x.id, x])); const after = new Map(next[kind].map(x => [x.id, x]));
        for (const id of new Set([...before.keys(), ...after.keys()])) {
          const a = snapshot(before.get(id)), b = snapshot(after.get(id));
          if (JSON.stringify(a) !== JSON.stringify(b) && (Object.keys(a || {}).length || Object.keys(b || {}).length)) tx.objectStore("history").add({ kind, recordId: id, saved: new Date().toISOString(), before: a, after: b });
        }
      }
      store.put(result, "current");
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(Error(conflict ? "Daten wurden in einem anderen Tab geändert. Bitte Seite neu laden." : "Speichern fehlgeschlagen.")); };
  });
}
export async function getHistory(kind: Kind, id: string): Promise<Entry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("history", "readonly"); const req = tx.objectStore("history").getAll();
    req.onsuccess = () => resolve((req.result as Entry[]).filter(e => e.kind === kind && e.recordId === id).reverse());
    tx.onerror = () => reject(tx.error); tx.oncomplete = () => db.close();
  });
}
