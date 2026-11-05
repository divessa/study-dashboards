import { useState } from "react";
import type { Data, RecordData } from "./types";
import { statuses } from "./types";
type Props = {
  course: RecordData;
  data: Data;
  onSave: (next: Data) => Promise<unknown>;
  onEdit: (x: RecordData) => void;
};
export default function LearningProgress({
  course,
  data,
  onSave,
  onEdit,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Record<string, RecordData>>({});
  const units = data.tasks
    .filter((t) => t.courseId === course.id && t.activity === "learning")
    .map((t) => pending[t.id] || t);
  if (!units.length) return null;
  const chapter = units[0].learningKind === "chapter";
  const selected = units.filter((t) => t.examSelected === "true").length;
  const update = async (item: RecordData, key: string, value: string) => {
    setBusy(true);
    setError("");
    setPending({ [item.id]: { ...item, [key]: value } });
    try {
      await onSave({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === item.id ? { ...t, [key]: value } : t,
        ),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending({});
      setBusy(false);
    }
  };
  return (
    <section className="panel course-tasks">
      <div className="section-heading">
        <h2>Optionaler Lernfortschritt</h2>
        {chapter && (
          <span className="muted">
            {selected} / 2 Prüfungskapitel ausgewählt
          </span>
        )}
      </div>
      <p className="muted course-notes">
        {chapter
          ? "Zwei Kapitel für die Prüfung auswählen. Kapitel und Probeklausur getrennt abhaken."
          : "Lektionen und Selbstlernquizzes getrennt abhaken. Quizzes sind unbenotet."}{" "}
        Der Bearbeitungsstatus bleibt unabhängig wählbar.
      </p>
      {units.map((t) => (
        <div className="learning-row" key={t.id}>
          <button className="row-main" onClick={() => onEdit(t)}>
            <strong>{t.name}</strong>
            <span className="row-meta">Freiwilliger Lernabschnitt</span>
          </button>
          <div className="learning-controls">
            <label>
              <input
                type="checkbox"
                checked={t.lectureCompleted === "true"}
                disabled={busy}
                onChange={(e) =>
                  update(t, "lectureCompleted", String(e.target.checked))
                }
              />
              {chapter ? "Kapitel abgeschlossen" : "Lektion abgeschlossen"}
            </label>
            <label>
              <input
                type="checkbox"
                checked={t.quizCompleted === "true"}
                disabled={busy}
                onChange={(e) =>
                  update(t, "quizCompleted", String(e.target.checked))
                }
              />
              {chapter ? "Probeklausur abgeschlossen" : "Quiz abgeschlossen"}
            </label>
            {chapter && (
              <label>
                <input
                  type="checkbox"
                  checked={t.examSelected === "true"}
                  disabled={
                    busy || (selected >= 2 && t.examSelected !== "true")
                  }
                  onChange={(e) =>
                    update(t, "examSelected", String(e.target.checked))
                  }
                />
                Prüfungsrelevant
              </label>
            )}
            <select
              aria-label={`${t.name}: Status`}
              value={t.status}
              disabled={busy}
              onChange={(e) => update(t, "status", e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
