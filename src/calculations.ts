import { areas, type Module } from "./model";
import { legacyPlan } from "./migration";
export const percent = (value: number, target: number) =>
  target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
const normalize = (s: string) =>
  s.normalize("NFKC").toLocaleLowerCase("de").trim().replace(/\s+/g, " ");
export const active = (m: Module) => !m.archived && m.status !== "Abgewählt";
export const eligible = (m: Module) =>
  m.credit === "Bestätigt" || m.credit === "Nicht erforderlich";
export const binding = (m: Module) =>
  active(m) &&
  legacyPlan(m) === "Verbindlich" &&
  m.status !== "Bestanden" &&
  m.recognition !== "Genehmigt";
export const pendingRecognition = (m: Module) =>
  ["In Vorbereitung", "Beantragt"].includes(m.recognition || "");
function identityName(m: Module) {
  const n = normalize(m.name)
    .replace(/^masterpraktikum\s+/, "")
    .replace(/\s*[·–-]?\s*(vorlesung|übung|lecture|exercise)\s*$/, "");
  return n
    .replace(/^advanced topics on /, "advanced topics of ")
    .replace(/^masterseminar(?=\s|$)/, "master seminar");
}
export function calculate(
  modules: Module[],
  options: { assumeRecognition?: boolean } = {},
) {
  const namedSeminars = new Set(modules.filter(m => m.area === "seminar").map(identityName).filter(name => name.startsWith("master seminar ")));
  const identity = (m: Module) => {
    const name = identityName(m);
    return m.area === "seminar" && name === "master seminar" && namedSeminars.size === 1 ? [...namedSeminars][0] : name;
  };
  const ids = modules.map((_, i) => i);
  const find = (i: number): number =>
    ids[i] === i ? i : (ids[i] = find(ids[i]));
  const seen = new Map<string, number>();
  modules.forEach((m, i) => {
    for (const key of [
      "id:" + m.id,
      "name:" + identity(m),
      ...(m.moduleCode ? ["key:" + normalize(m.moduleCode)] : []),
      ...(m.creditKey ? ["key:" + normalize(m.creditKey)] : []),
    ]) {
      const prior = seen.get(key);
      if (prior !== undefined) ids[find(i)] = find(prior);
      else seen.set(key, i);
    }
  });
  const buckets = new Map<number, Module[]>();
  modules.forEach((m, i) => {
    const key = find(i);
    buckets.set(key, [...(buckets.get(key) || []), m]);
  });
  const approved = (m: Module) =>
    m.recognition === "Genehmigt" ||
    (!!options.assumeRecognition && pendingRecognition(m));
  const earnedRecord = (m: Module) =>
    eligible(m) && (m.status === "Bestanden" || approved(m));
  const priority = (m: Module) =>
    earnedRecord(m) ? 0 : binding(m) ? 1 : active(m) ? 2 : 3;
  const groups = [...buckets.values()].map((group) =>
    group
      .slice()
      .sort((a, b) => priority(a) - priority(b) || a.semester - b.semester),
  );
  const unique = groups
    .map((g) => g.find((m) => active(m) || approved(m)))
    .filter((m): m is Module => !!m)
    .sort((a, b) => priority(a) - priority(b) || a.semester - b.semester);
  const duplicates = groups.flatMap((g) =>
    g
      .filter((m) => active(m))
      .slice(1)
      .map((m) => m.name),
  );
  const recognitionRequests = groups
    .map((g) => g.find((m) => pendingRecognition(m)))
    .filter((m): m is Module => !!m);
  const allocation: Record<string, { earned: number; planned: number }> = {};
  const byArea = areas.map((area) => {
    const records = unique.filter((m) => m.area === area.id && eligible(m));
    let earned = 0,
      planned = 0;
    let rawEarned = 0,
      rawPlanned = 0;
    for (const m of records.filter(earnedRecord)) {
      const value = Math.min(Math.max(0, area.target - earned), m.ects);
      earned += value;
      rawEarned += m.ects;
      allocation[m.id] = { earned: value, planned: 0 };
    }
    for (const m of records.filter((m) => !earnedRecord(m) && binding(m))) {
      const value = Math.min(
        Math.max(0, area.target - earned - planned),
        m.ects,
      );
      planned += value;
      rawPlanned += m.ects;
      allocation[m.id] = { earned: 0, planned: value };
    }
    return {
      ...area,
      earned,
      planned,
      covered: earned + planned,
      missing: area.target - earned - planned,
      excess: Math.max(0, rawEarned + rawPlanned - area.target),
      progress: percent(earned + planned, area.target),
    };
  });
  const sum = (key: "earned" | "planned" | "missing" | "excess") =>
    byArea.reduce((s, a) => s + a[key], 0);
  const earned = sum("earned"),
    planned = sum("planned");
  const waiting = unique
    .filter(
      (m) =>
        (m.lectureRegistration ??
          (m.status === "Warteliste" ? "Warteliste" : "Unbekannt")) ===
        "Warteliste",
    )
    .reduce((s, m) => s + m.ects, 0);
  const unresolvedAllocations = unique.filter(
    (m) => active(m) && m.credit === "Prüfung ausstehend",
  );
  const unresolvedBinding = unresolvedAllocations.filter(binding);
  const unresolvedOutside = unresolvedAllocations.filter((m) => !binding(m));
  const unclear = unresolvedAllocations.reduce((s, m) => s + m.ects, 0);
  return {
    byArea,
    earned,
    planned,
    covered: earned + planned,
    missing: sum("missing"),
    excess: sum("excess"),
    progress: percent(earned + planned, 120),
    waiting,
    unclear,
    allocationPending: unresolvedBinding.reduce((s, m) => s + m.ects, 0),
    allocationPendingRecords: unresolvedBinding,
    allocationPendingOutside: unresolvedOutside.reduce((s, m) => s + m.ects, 0),
    allocationPendingOutsideRecords: unresolvedOutside,
    recognitionPending: recognitionRequests.reduce((s, m) => s + m.ects, 0),
    recognitionRequests,
    duplicates,
    unique,
    allocation,
  };
}
export function semesterStats(modules: Module[], semester: number) {
  const stats = calculate(modules);
  const unique = stats.unique.filter((m) => m.semester === semester);
  const sum = (filter: (m: Module) => boolean) =>
    unique.filter(filter).reduce((s, m) => s + m.ects, 0);
  return {
    registered: unique.reduce(
      (s, m) => s + (stats.allocation[m.id]?.planned || 0),
      0,
    ),
    earned: unique.reduce(
      (s, m) => s + (stats.allocation[m.id]?.earned || 0),
      0,
    ),
    workload: sum(binding),
    tentative: sum(
      (m) =>
        legacyPlan(m) === "Unverbindlich" &&
        m.status !== "Bestanden" &&
        m.recognition !== "Genehmigt",
    ),
    registeredCourses: stats.unique
      .filter(
        (m) =>
          (m.registrationSemester ?? m.semester) === semester &&
          ["Fixplatz zugewiesen", "Angemeldet"].includes(
            m.lectureRegistration || "",
          ),
      )
      .reduce((s, m) => s + m.ects, 0),
    tasks: unique
      .filter(binding)
      .reduce((s, m) => s + m.tasks.filter((t) => !t.done).length, 0),
  };
}
