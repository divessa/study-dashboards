export const enrollmentStatuses = [
  "Fixplatz zugewiesen",
  "Angemeldet",
  "Warteliste",
  "Geplant",
  "Nicht mehr vorgesehen",
  "Unbekannt",
];
export const categories = [
  "Pflichtprüfung",
  "Pflichtabgabe",
  "Freiwilliger Bonus",
  "Optionale Lernaktivität",
  "Projektmeilenstein",
  "Administrative Anmeldung",
  "Information offen",
];
export const dateStatuses = [
  "Bestätigt",
  "Vorläufig",
  "Zeitfenster",
  "Unbekannt",
];
export const statuses = [
  "Offen",
  "In Bearbeitung",
  "Erledigt",
  "Abgegeben",
  "Übersprungen",
  "Nicht zutreffend",
  "Entfällt",
  "Bewertet",
  "Keine Teilnahme",
];
export const isClosed = (x) =>
  [
    "Erledigt",
    "Abgegeben",
    "Übersprungen",
    "Nicht zutreffend",
    "Entfällt",
    "Bewertet",
    "Keine Teilnahme",
  ].includes(x.status);
export const dateOf = (x) => x.deadline || x.date || "";
export const hasConfirmedDate = (x) =>
  !!dateOf(x) &&
  (x.dateStatus
    ? x.dateStatus === "Bestätigt"
    : x.confidence !== "Unbestätigt");
export const isExam = (x) =>
  x.category === "Pflichtprüfung" ||
  [
    "Schriftliche Prüfung",
    "Mündliche Prüfung",
    "Mini-Exam / Quiz",
    "Praktische Prüfung",
  ].includes(x.type);
export const isMainExam = (x) => isExam(x) && x.type !== "Mini-Exam / Quiz";
export const categoryOf = (x) =>
  x.category ||
  (x.activity === "registration"
    ? "Administrative Anmeldung"
    : x.activity === "information"
      ? "Information offen"
      : x.classification === "Bonus"
        ? "Freiwilliger Bonus"
        : x.activity === "learning" ||
            (!x.type && x.classification === "Optional")
          ? "Optionale Lernaktivität"
          : isExam(x) || x.id === "ethics-ai-exam"
            ? "Pflichtprüfung"
            : x.obligation === "Unbestätigt"
              ? "Projektmeilenstein"
              : x.deadline
                ? "Pflichtabgabe"
                : x.type === "Bonusanforderung"
                  ? "Freiwilliger Bonus"
                  : x.type === "Teilnahme"
                    ? "Optionale Lernaktivität"
                    : "Pflichtabgabe");
export const isOutstandingWork = (x) =>
  !isClosed(x) &&
  !["Optionale Lernaktivität", "Information offen"].includes(categoryOf(x)) &&
  x.activity !== "exercise-credit";
export const statusesFor = (x) =>
  x.workflow === "optional-midterm"
    ? [
        "Offen",
        "In Bearbeitung",
        "Abgegeben",
        "Bewertet",
        "Keine Teilnahme",
        "Erledigt",
        "Übersprungen",
        "Nicht zutreffend",
        "Entfällt",
      ]
    : statuses.filter(
        (s) => !["Bewertet", "Keine Teilnahme"].includes(s) || s === x.status,
      );
