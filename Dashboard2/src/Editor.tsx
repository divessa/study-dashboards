import { useEffect, useRef, useState } from "react";
import { X, Trash2 } from "lucide-react";
import ProgressHistory from "./ProgressHistory";
import {
  assessmentTypes,
  statuses,
  statusesFor,
  categoryOf,
  categories,
  enrollmentStatuses,
  dateStatuses,
  dateOf,
  type Data,
  type Kind,
  type RecordData,
} from "./types";
type Props = {
  kind: Kind;
  item: RecordData;
  data: Data;
  onClose: () => void;
  onSave: (x: RecordData) => Promise<void>;
  onDelete: () => Promise<void>;
};
export default function Editor({
  kind,
  item,
  data,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [value, setValue] = useState<RecordData>({
    ...item,
    ...(kind === "courses"
      ? { enrollmentStatus: item.enrollmentStatus || "Unbekannt" }
      : {
          category: categoryOf(item),
          dateStatus:
            item.dateStatus ||
            (dateOf(item)
              ? item.confidence === "Unbestätigt"
                ? "Vorläufig"
                : "Bestätigt"
              : "Unbekannt"),
        }),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const set = (k: string, v: string) =>
    setValue((old) => ({
      ...old,
      [k]: v,
      ...(k === "courseId" ? { assessmentId: "" } : {}),
      ...(["date", "deadline"].includes(k) &&
      v &&
      old.dateStatus === "Unbekannt" &&
      !old.windowLabel
        ? {
            dateStatus:
              old.confidence === "Unbestätigt" ? "Vorläufig" : "Bestätigt",
          }
        : {}),
      ...(k === "confidence" &&
      !item.id &&
      v !== "Unbestätigt" &&
      dateOf(old) &&
      old.dateStatus === "Vorläufig" &&
      !old.windowLabel
        ? { dateStatus: "Bestätigt" }
        : {}),
      ...(k === "category" && v === "Freiwilliger Bonus"
        ? { classification: "Bonus" }
        : k === "category" && v === "Optionale Lernaktivität"
          ? { classification: "Optional" }
          : {}),
      ...(k === "classification" && v === "Bonus"
        ? { category: "Freiwilliger Bonus" }
        : k === "classification" &&
            v === "Optional" &&
            ["Pflichtprüfung", "Pflichtabgabe"].includes(old.category)
          ? { category: "Optionale Lernaktivität" }
          : k === "classification" &&
              v === "Pflicht" &&
              ["Freiwilliger Bonus", "Optionale Lernaktivität"].includes(
                old.category,
              )
            ? {
                category: old.type?.includes("Prüfung")
                  ? "Pflichtprüfung"
                  : "Pflichtabgabe",
              }
            : {}),
    }));
  const field = (
    key: string,
    label: string,
    type = "text",
    options?: string[] | { value: string; label: string }[],
    required = false,
  ) => (
    <label className={type === "textarea" ? "span2" : ""} key={key}>
      {label}
      {required && <span className="required"> *</span>}
      {options ? (
        <select
          value={value[key] || ""}
          onChange={(e) => set(key, e.target.value)}
          required={required}
        >
          {options.map((o) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value[key] || ""}
          onChange={(e) => set(key, e.target.value)}
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={value[key] || ""}
          onChange={(e) => set(key, e.target.value)}
          required={required}
          maxLength={30000}
          min={type === "number" ? 0 : undefined}
          step={type === "number" ? "any" : undefined}
        />
      )}
    </label>
  );
  return (
    <dialog
      ref={dialogRef}
      className="editor-dialog"
      aria-labelledby="editor-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="editor"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({ ...value, name: value.name.trim() });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">
              {kind === "courses"
                ? "KURS"
                : kind === "tasks"
                  ? "AUFGABE"
                  : "PRÜFUNGSLEISTUNG"}
            </span>
            <h2 id="editor-title">
              {item.id ? "Details bearbeiten" : "Neu anlegen"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Schließen"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="editor-body">
          <div className="form-grid">
            {field(
              "name",
              kind === "courses" ? "Kursname" : "Titel",
              "text",
              undefined,
              true,
            )}
            {kind === "courses" ? (
              <>
                {field("code", "Modulcode")}
                {field("semester", "Semester")}
                {field(
                  "enrollmentStatus",
                  "Kursbelegung (keine Prüfungsanmeldung)",
                  "text",
                  enrollmentStatuses,
                )}
                {field("teachingEvent", "Lehrveranstaltungsnummer")}
                {field("teachingHours", "SWS (unabhängig von ECTS)", "number")}
                {field("lecturers", "Lehrende", "textarea")}
                {field("ects", "ECTS", "number")}
                {field("courseType", "Kursformat")}
                {field("level", "Niveau")}
                {value.creditTarget &&
                  field(
                    "creditsManual",
                    "Bereits erworbene Übungscredits (ohne Einzeleinträge)",
                    "number",
                  )}
                {field(
                  "grading",
                  "Prüfungs- und Bewertungsstruktur",
                  "textarea",
                )}
                {field("pending", "Noch zu klärende Informationen", "textarea")}
                {field("notes", "Notizen", "textarea")}
              </>
            ) : (
              <>
                {field(
                  "courseId",
                  "Kurs",
                  "text",
                  [
                    {
                      value: "",
                      label: kind === "tasks" ? "Ohne Kurs" : "Kurs wählen",
                    },
                    ...data.courses.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ],
                  kind === "assessments",
                )}
                {kind === "assessments" &&
                  field(
                    "type",
                    "Art der Leistung",
                    "text",
                    assessmentTypes,
                    true,
                  )}
                {field(
                  "classification",
                  "Verbindlichkeit",
                  "text",
                  ["Pflicht", "Optional", "Bonus"],
                  true,
                )}
                {field("category", "Kategorie", "text", categories, true)}
                {field("status", "Status", "text", statusesFor(value), true)}
                {kind === "tasks" ? (
                  <>
                    {field("priority", "Priorität", "text", [
                      "Normal",
                      "Hoch",
                      "Niedrig",
                    ])}
                    {field("assessmentId", "Zugehörige Leistung", "text", [
                      { value: "", label: "Keine Verknüpfung" },
                      ...data.assessments
                        .filter(
                          (a) =>
                            !value.courseId || a.courseId === value.courseId,
                        )
                        .map((a) => ({ value: a.id, label: a.name })),
                    ])}
                  </>
                ) : (
                  field(
                    "confidence",
                    "Informationsstand",
                    "text",
                    ["Bestätigt", "Teilweise bekannt", "Unbestätigt"],
                    true,
                  )
                )}
                {field(
                  "date",
                  kind === "assessments"
                    ? "Veranstaltungsdatum"
                    : "Ereignisdatum (kein Fälligkeitstag)",
                  "date",
                )}
                {field("deadline", "Abgabefrist", "date")}
                {field("dateStatus", "Terminstand", "text", dateStatuses)}
                {field(
                  "windowLabel",
                  "Ungefähres Zeitfenster (kein Kalendertag)",
                )}
                {field(
                  "windowMonth",
                  "Monat des Zeitfensters (optional)",
                  "month",
                )}
                {kind === "tasks" &&
                  value.category === "Administrative Anmeldung" &&
                  field("eventRole", "Bedeutung des Ereignisdatums", "text", [
                    { value: "", label: "Sonstiges Verwaltungsereignis" },
                    {
                      value: "registration-opening",
                      label: "Anmeldungsöffnung, keine Schlussfrist",
                    },
                  ])}
                {field("time", "Uhrzeit (Europe/Berlin)", "time")}
                {kind === "assessments" && (
                  <>
                    {field("endTime", "Ende (Europe/Berlin)", "time")}
                    {field("duration", "Dauer")}
                    {field("location", "Ort")}
                    {field("platform", "Abgabeplattform")}
                    {field("attempt", "Prüfungsversuch")}
                  </>
                )}
                {field("url", "Externer Link", "url")}
                {kind === "assessments" &&
                  field("description", "Beschreibung", "textarea")}
                {(value.activity === "exercise-credit" ||
                  (kind === "assessments" &&
                    ["Teilnahme", "Gruppenpräsentation"].includes(value.type) &&
                    data.courses.some(
                      (c) => c.id === value.courseId && c.creditTarget,
                    ))) &&
                  field(
                    "creditsEarned",
                    "Tatsächlich vergebene Übungscredits",
                    "number",
                  )}
                {value.activity === "learning" && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={value.lectureCompleted === "true"}
                        onChange={(e) =>
                          set("lectureCompleted", String(e.target.checked))
                        }
                      />
                      {value.learningKind === "chapter"
                        ? "Kapitel abgeschlossen"
                        : "Lektion abgeschlossen"}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={value.quizCompleted === "true"}
                        onChange={(e) =>
                          set("quizCompleted", String(e.target.checked))
                        }
                      />
                      {value.learningKind === "chapter"
                        ? "Probeklausur abgeschlossen"
                        : "Quiz abgeschlossen"}
                    </label>
                    {value.learningKind === "chapter" && (
                      <label>
                        <input
                          type="checkbox"
                          checked={value.examSelected === "true"}
                          onChange={(e) =>
                            set("examSelected", String(e.target.checked))
                          }
                        />
                        Für Prüfung ausgewählt
                      </label>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          {kind === "assessments" && (
            <details className="advanced">
              <summary>Bewertung, Bonus & Voraussetzungen</summary>
              <div className="form-grid">
                {field("gradingModel", "Bewertungsmodell", "text", [
                  "Unbekannt",
                  "Prozentgewichtung",
                  "Punkte",
                  "Zusatzpunkte",
                  "Notenverbesserung",
                  "Bestanden / Nicht bestanden",
                  "Voraussetzung",
                  "Bedingte Gewichtung",
                  "Gleich gewichtete Laborprojekte",
                ])}
                {field("weight", "Gewichtung / Punkte (falls bekannt)")}
                {value.obligation !== undefined &&
                  field("obligation", "Offene Teilnahmeverpflichtung", "text", [
                    { value: "Unbestätigt", label: "Noch zu bestätigen" },
                    {
                      value: "",
                      label: "Geklärt; Verbindlichkeit oben festlegen",
                    },
                  ])}
                {field("maxPoints", "Maximalpunkte (falls bekannt)", "number")}
                {field("score", "Erreichte Punkte (falls bekannt)", "number")}
                {field("grade", "Erreichte Note (falls bekannt)")}
                {field("bonus", "Bonusregel", "textarea")}
                {field("prerequisites", "Voraussetzungen", "textarea")}
                {field(
                  "registration",
                  "Anmeldung / ausstehendes Verfahren",
                  "textarea",
                )}
                {field("notes", "Notizen", "textarea")}
              </div>
            </details>
          )}
          {kind === "tasks" && (
            <div className="form-grid">
              {field("notes", "Notizen", "textarea")}
            </div>
          )}
          {value.sourceNotes && (
            <p className="form-help">Quellenhinweis: {value.sourceNotes}</p>
          )}
          {item.id && <ProgressHistory kind={kind} id={item.id} />}
          {kind !== "courses" && (
            <p className="form-help">
              Unbekannte Termine leer lassen. Bonus und freiwillige Leistungen
              werden nicht als Pflicht gewertet. Ungefähre Zeitfenster erhalten
              keinen Kalendertag. Nach Bekanntgabe einer offiziellen Frist den
              Terminstand ausdrücklich auf „Bestätigt“ setzen.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
        <footer>
          {item.id && (
            <button
              type="button"
              className="danger subtle"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={16} />
              Löschen
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="button secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Speichert …" : "Speichern"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
