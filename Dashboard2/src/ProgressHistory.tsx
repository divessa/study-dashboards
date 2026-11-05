import { getHistory } from "./storage";
import { useState } from "react";
import type { Kind } from "./types";
type Entry = {
  id: number;
  saved: string;
  before: Record<string, string> | null;
  after: Record<string, string> | null;
};
const labels: Record<string, string> = {
  status: "Status",
  grade: "Erreichte Note",
  enrollmentStatus: "Kursbelegung",
  score: "Erreichte Punkte",
  creditsEarned: "Vergebene Credits",
  creditsManual: "Bereits erworbene Credits",
  lectureCompleted: "Kapitel / Lektion",
  quizCompleted: "Probeklausur / Quiz",
  examSelected: "Prüfungskapitel",
};
const value = (v: string | undefined) =>
  v === undefined
    ? "—"
    : v === "true"
      ? "Erledigt / ausgewählt"
      : v === "false"
        ? "Offen / nicht ausgewählt"
        : v || "—";
export default function ProgressHistory({
  kind,
  id,
}: {
  kind: Kind;
  id: string;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  return (
    <details
      className="advanced"
      onToggle={async (e) => {
        if (e.currentTarget.open && !entries) {
          try {
            setEntries(await getHistory(kind, id));
          } catch (e) {
            setError((e as Error).message);
          }
        }
      }}
    >
      <summary>Fortschrittsverlauf</summary>
      {error && <p role="alert">{error}</p>}
      {entries?.length === 0 && (
        <p className="form-help">Noch keine protokollierten Änderungen.</p>
      )}
      {entries?.map((e) => (
        <div className="detail-text" key={e.id}>
          <h4>
            {new Intl.DateTimeFormat("de-DE", {
              timeZone: "Europe/Berlin",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(e.saved))}
          </h4>
          {Object.keys({ ...e.before, ...e.after })
            .filter((k) => e.before?.[k] !== e.after?.[k])
            .map((k) => (
              <p key={k}>
                {labels[k] || k}: {value(e.before?.[k])} → {value(e.after?.[k])}
              </p>
            ))}
          {e.after === null && <p>Eintrag gelöscht.</p>}
        </div>
      ))}
    </details>
  );
}
