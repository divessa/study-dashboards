export const areas = [
  { id: "core", name: "Pflichtvorlesungen", target: 10, color: "#247b65" },
  { id: "ie", name: "IE-Wahlmodule", target: 44, color: "#567bc9" },
  { id: "practical", name: "Masterpraktikum", target: 10, color: "#ad8452" },
  { id: "seminar", name: "Masterseminar", target: 5, color: "#9b77b6" },
  {
    id: "ethics",
    name: "Ethics in Information Engineering",
    target: 3,
    color: "#5b9395",
  },
  {
    id: "management",
    name: "Management & Economics",
    target: 12,
    color: "#ce936b",
  },
  { id: "general", name: "General Studies", target: 6, color: "#9b9c56" },
  { id: "thesis", name: "Masterarbeit", target: 30, color: "#708298" },
] as const;
export type Area = (typeof areas)[number]["id"];
export const semesters = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
] as const;
export const statuses = [
  "Interessant / Merkliste",
  "Geplant",
  "Angemeldet",
  "Warteliste",
  "Fixplatz",
  "In Bearbeitung",
  "Prüfung angemeldet",
  "Bestanden",
  "Nicht bestanden",
  "Abgewählt",
] as const;
export type Status = (typeof statuses)[number];
export const registrations = [
  "Unbekannt",
  "Fixplatz zugewiesen",
  "Angemeldet",
  "Warteliste",
  "Abgemeldet",
] as const;
export const plans = [
  "Verbindlich",
  "Unverbindlich",
  "Entscheidung offen",
  "Nicht vorgesehen",
] as const;
export const examRegistrations = [
  "Unbekannt",
  "Nicht angemeldet",
  "Angemeldet",
  "Abgemeldet",
] as const;
export const recognitions = [
  "Nicht beantragt",
  "In Vorbereitung",
  "Beantragt",
  "Genehmigt",
  "Abgelehnt",
] as const;
export const credits = [
  "Bestätigt",
  "Prüfung ausstehend",
  "Abgelehnt",
  "Nicht erforderlich",
] as const;
export interface Task {
  id: string;
  title: string;
  deadline: string;
  done: boolean;
}
export interface Module {
  moduleCode?: string;
  legacyStatus?: Status;
  lectureRegistration?: (typeof registrations)[number];
  exerciseRegistration?: (typeof registrations)[number];
  registrationSemester?: number;
  planStatus?: (typeof plans)[number];
  examRegistration?: (typeof examRegistrations)[number];
  recognition?: (typeof recognitions)[number];
  recognitionNotes?: string;
  planningNotes?: string;
  id: string;
  name: string;
  ects: number;
  area: Area;
  semester: number;
  status: Status;
  credit: (typeof credits)[number];
  archived: boolean;
  creditKey: string;
  notes: string;
  description: string;
  link: string;
  exam: string;
  grade: string;
  tasks: Task[];
}
export interface Data {
  version: 1;
  modules: Module[];
  updatedAt: string;
  migrations?: string[];
}
export const fixedStatuses: readonly Status[] = [
  "Angemeldet",
  "Fixplatz",
  "In Bearbeitung",
  "Prüfung angemeldet",
];
export const makeModule = (
  name: string,
  ects: number,
  area: Area,
  status: Status = "Fixplatz",
  extra: Partial<Module> = {},
): Module => ({
  id: crypto.randomUUID(),
  name,
  ects,
  area,
  semester: 0,
  status,
  credit: "Bestätigt",
  archived: false,
  creditKey: "",
  notes: "",
  description: "",
  link: "",
  exam: "",
  grade: "",
  tasks: [],
  ...extra,
});
export function initialData(): Data {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    modules: [
      makeModule("Beispielmodul", 5, "core", "Geplant", { credit: "Prüfung ausstehend", planStatus: "Unverbindlich" }),
    ],
  };
}
export const official = [
  [
    ["Pflichtmodul A", 5],
    ["Pflichtmodul B", 5],
    ["IE-Wahlmodule", 8],
    ["Ethik", 3],
    ["Management & Economics", 6],
    ["General Studies", 3],
  ],
  [
    ["Masterpraktikum", 10],
    ["Masterseminar", 5],
    ["IE-Wahlmodule", 6],
    ["Management & Economics", 6],
    ["General Studies", 3],
  ],
  [["IE-Wahlmodule", 30]],
  [["Masterarbeit", 30]],
] as const;
export const number = (value: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
