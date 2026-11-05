import {
  areas,
  credits,
  initialData,
  statuses,
  registrations,
  plans,
  examRegistrations,
  recognitions,
  type Data,
} from "./model";
import { migrateData } from "./migration";
export const STORAGE_KEY = "studienkompass-public-v1";
export const BACKUP_KEY = STORAGE_KEY + "-backup";
export const serialize = (data: Data) => JSON.stringify(data, null, 2);
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const validDate = (v: unknown) =>
  typeof v === "string" &&
  (v === "" ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v));
export function parseData(raw: string): Data {
  const d: unknown = JSON.parse(raw);
  if (
    !obj(d) ||
    d.version !== 1 ||
    !Array.isArray(d.modules) ||
    d.modules.length > 5000 ||
    typeof d.updatedAt !== "string"
  )
    throw new Error(
      "Unbekanntes oder beschädigtes Dateiformat. Erwartet wird ein Studienkompass-Export (Version 1).",
    );
  const ids = new Set<string>();
  if (
    d.migrations !== undefined &&
    (!Array.isArray(d.migrations) ||
      !d.migrations.every((x) => typeof x === "string"))
  )
    throw Error("Ungültiger Migrationsstand.");
  for (const m of d.modules) {
    if (
      !obj(m) ||
      ![
        "id",
        "name",
        "creditKey",
        "notes",
        "description",
        "link",
        "exam",
        "grade",
      ].every((k) => typeof m[k] === "string") ||
      !(m.name as string).trim() ||
      !(m.id as string) ||
      ids.has(m.id as string) ||
      typeof m.ects !== "number" ||
      !Number.isFinite(m.ects) ||
      m.ects <= 0 ||
      m.ects > 120 ||
      !Number.isInteger(m.semester) ||
      Number(m.semester) < 0 ||
      Number(m.semester) > 3 ||
      !areas.some((a) => a.id === m.area) ||
      !statuses.includes(m.status as never) ||
      !credits.includes(m.credit as never) ||
      typeof m.archived !== "boolean" ||
      !validDate(m.exam) ||
      (m.grade !== "" &&
        (!/^\d(?:[.,]\d)?$/.test(m.grade as string) ||
          Number((m.grade as string).replace(",", ".")) < 1 ||
          Number((m.grade as string).replace(",", ".")) > 5)) ||
      (m.link !== "" && !/^https?:\/\//i.test(m.link as string)) ||
      !Array.isArray(m.tasks)
    )
      throw new Error(
        "Ungültige Moduldaten. Bitte ECTS, Status, Termine, Noten und IDs prüfen.",
      );
    ids.add(m.id as string);
    if (
      m.legacyStatus !== undefined &&
      !statuses.includes(m.legacyStatus as never)
    )
      throw Error("Ungültiger bisheriger Status.");
    for (const [key, values] of [
      ["planStatus", plans],
      ["lectureRegistration", registrations],
      ["exerciseRegistration", registrations],
      ["examRegistration", examRegistrations],
      ["recognition", recognitions],
    ] as const)
      if (m[key] !== undefined && !values.includes(m[key] as never))
        throw Error(
          "Ungültiger Planungs-, Anmeldungs- oder Anerkennungsstatus.",
        );
    for (const key of ["moduleCode", "recognitionNotes", "planningNotes"])
      if (m[key] !== undefined && typeof m[key] !== "string")
        throw Error("Ungültige Zusatzinformationen.");
    if (
      m.registrationSemester !== undefined &&
      (!Number.isInteger(m.registrationSemester) ||
        Number(m.registrationSemester) < 0 ||
        Number(m.registrationSemester) > 3)
    )
      throw Error("Ungültiges Belegungssemester.");
    const tasks = new Set<string>();
    for (const t of m.tasks) {
      if (
        !obj(t) ||
        typeof t.id !== "string" ||
        !t.id ||
        tasks.has(t.id) ||
        typeof t.title !== "string" ||
        !t.title.trim() ||
        !validDate(t.deadline) ||
        typeof t.done !== "boolean"
      )
        throw new Error("Ungültige Aufgabendaten.");
      tasks.add(t.id);
    }
  }
  return d as unknown as Data;
}
export function loadData(
  storage: Pick<Storage, "getItem"> & Partial<Pick<Storage, "setItem">>,
): {
  data: Data;
  warning: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: migrateData(initialData()), warning: "" };
    return { data: parseData(raw), warning: "" };
  } catch {
    try {
      const backup = storage.getItem(BACKUP_KEY);
      if (backup)
        return {
          data: migrateData(parseData(backup)),
          warning:
            "Die letzte Speicherung war beschädigt. Die vorherige Sicherung wurde wiederhergestellt.",
        };
    } catch {
      /* handled below */
    }
    return {
      data: migrateData(initialData()),
      warning:
        "Lokale Daten konnten nicht gelesen werden. Ausgangsdaten werden angezeigt; vorhandene Daten werden erst nach einer Änderung überschrieben. Du kannst ein JSON-Backup importieren.",
    };
  }
}
export function saveData(
  storage: Pick<Storage, "getItem" | "setItem">,
  data: Data,
) {
  const next = serialize(data);
  parseData(next);
  const previous = storage.getItem(STORAGE_KEY);
  if (previous) {
    try {
      parseData(previous);
      storage.setItem(BACKUP_KEY, previous);
    } catch {
      /* retain valid backup */
    }
  }
  storage.setItem(STORAGE_KEY, next);
}
