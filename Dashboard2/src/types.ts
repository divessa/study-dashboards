export type RecordData = { id: string; name: string; [key: string]: string };
export type Data = {
  version: number;
  revision: number;
  courses: RecordData[];
  assessments: RecordData[];
  tasks: RecordData[];
};
export type Kind = "courses" | "assessments" | "tasks";
export const assessmentTypes = [
  "Schriftliche Prüfung",
  "Mündliche Prüfung",
  "Mini-Exam / Quiz",
  "Hausaufgabe",
  "Programmieraufgabe",
  "Projekt",
  "Einzelpräsentation",
  "Gruppenpräsentation",
  "Seminararbeit",
  "Praktische Prüfung",
  "Teilnahme",
  "Bonusanforderung",
  "Sonstiges",
  "Laborbericht",
];
export {
  statuses,
  isClosed,
  dateOf,
  categoryOf,
  categories,
  enrollmentStatuses,
  dateStatuses,
  hasConfirmedDate,
  isExam,
  isMainExam,
  isOutstandingWork,
  statusesFor,
} from "../academic.mjs";
import { dateOf } from "../academic.mjs";
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
export const berlinTime = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
export const isUpcoming = (x: RecordData) =>
  !!dateOf(x) &&
  `${dateOf(x)}T${x.time || "23:59"}` >= `${today()}T${berlinTime()}`;
export const dayDiff = (day: string, base = today()) =>
  Math.round(
    (Date.parse(day + "T12:00:00Z") - Date.parse(base + "T12:00:00Z")) /
      86400000,
  );
export const formatDate = (
  day: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
) =>
  day
    ? new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        ...opts,
      }).format(new Date(day + "T12:00:00Z"))
    : "Termin offen";
export const relative = (day: string, time = "") => {
  const n = dayDiff(day);
  if (n === 0 && time) {
    const minutes = (s: string) =>
      Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const left = minutes(time) - minutes(berlinTime());
    return left < 0
      ? "Heute · verstrichen"
      : left < 60
        ? `In ${left} Min.`
        : `In ${Math.floor(left / 60)} Std.`;
  }
  return n === 0
    ? "Heute"
    : n === 1
      ? "Morgen"
      : n < 0
        ? `Seit ${-n} Tagen fällig`
        : `In ${n} Tagen`;
};
export const moveDay = (day: string, n: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const monday = (day: string) =>
  moveDay(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
