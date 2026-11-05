import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  dateOf,
  formatDate,
  today,
  moveDay,
  monday,
  isClosed,
  isExam,
  categoryOf,
  hasConfirmedDate,
  type RecordData,
} from "./types";
type Props = {
  items: RecordData[];
  courseName: (id: string) => string;
  onOpen: (x: RecordData) => void;
};
export default function Calendar({ items, courseName, onOpen }: Props) {
  const [mode, setMode] = useState("Monat");
  const [anchor, setAnchor] = useState(today());
  const start =
    mode === "Woche" ? monday(anchor) : monday(anchor.slice(0, 7) + "-01");
  const last = new Date(
    Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const count =
    mode === "Woche"
      ? 7
      : Math.ceil(
          (Math.round((Date.parse(last) - Date.parse(start)) / 86400000) + 1) /
            7,
        ) * 7;
  const occurrences = items.flatMap((x) =>
    x.date && x.deadline && x.date !== x.deadline
      ? [
          { ...x, deadline: "" },
          { ...x, date: "" },
        ]
      : [x],
  );
  const sorted = occurrences
    .filter((x) => dateOf(x))
    .sort((a, b) =>
      (dateOf(a) + (a.time || "23:59")).localeCompare(
        dateOf(b) + (b.time || "23:59"),
      ),
    );
  const navigate = (n: number) => {
    if (mode === "Woche") setAnchor(moveDay(anchor, n * 7));
    else {
      const d = new Date(anchor + "T12:00:00Z");
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + n);
      setAnchor(d.toISOString().slice(0, 10));
    }
  };
  const event = (x: RecordData) => (
    <button
      key={x.id + dateOf(x)}
      className={`cal-event ${categoryOf(x) === "Administrative Anmeldung" ? "registration" : x.deadline ? "submission" : isExam(x) ? "examination" : "presentation"} ${isClosed(x) ? "completed" : ""} ${!hasConfirmedDate(x) ? "tentative" : ""}`}
      onClick={() => onOpen(items.find((original) => original.id === x.id)!)}
      title={`${x.name} · ${courseName(x.courseId)}`}
    >
      <span>
        {!hasConfirmedDate(x) ? "? " : ""}
        {x.time ? `${x.time}${x.endTime ? `–${x.endTime}` : ""}` : ""} {x.name}
      </span>
      <small>
        {courseName(x.courseId)} ·{" "}
        {x.eventRole === "registration-opening"
          ? "Anmeldungsöffnung"
          : categoryOf(x) === "Administrative Anmeldung"
            ? "Anmeldung"
            : x.deadline
              ? "Abgabe"
              : isExam(x)
                ? "Prüfung"
                : "Präsentation / Termin"}
        {!hasConfirmedDate(x) ? " · vorläufig" : ""}
      </small>
    </button>
  );
  return (
    <section className="panel calendar">
      <div className="calendar-toolbar">
        <div className="calendar-date">
          <button
            className="icon-button"
            aria-label="Vorheriger Zeitraum"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h2>
            {mode === "Woche"
              ? `${formatDate(start)} – ${formatDate(moveDay(start, 6), { day: "2-digit", month: "long", year: "numeric" })}`
              : formatDate(anchor, { month: "long", year: "numeric" })}
          </h2>
          <button
            className="icon-button"
            aria-label="Nächster Zeitraum"
            onClick={() => navigate(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="button secondary small"
            onClick={() => setAnchor(today())}
          >
            Heute
          </button>
        </div>
        <div className="segmented">
          {["Monat", "Woche", "Agenda"].map((m) => (
            <button
              key={m}
              className={m === mode ? "selected" : ""}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="calendar-legend">
        <span>
          <i className="legend-dot" />
          Abgabe
        </span>
        <span>
          <i className="legend-dot event" />
          Prüfung
        </span>
        <span>
          <i className="legend-dot presentation" />
          Präsentation / Meilenstein
        </span>
        <span>
          <i className="legend-dot registration" />
          Anmeldung (Öffnung / Ereignis)
        </span>
        <span>Gestrichelt: unbestätigt · Europe/Berlin</span>
      </div>
      {mode === "Agenda" ? (
        <div className="agenda">
          {sorted.filter((x) => dateOf(x).slice(0, 7) === anchor.slice(0, 7))
            .length ? (
            sorted
              .filter((x) => dateOf(x).slice(0, 7) === anchor.slice(0, 7))
              .map((x) => (
                <div className="agenda-row" key={x.id + dateOf(x)}>
                  <strong>
                    {formatDate(dateOf(x), {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                  </strong>
                  {event(x)}
                </div>
              ))
          ) : (
            <div className="empty">Keine Termine in diesem Monat.</div>
          )}
        </div>
      ) : (
        <div className="calendar-scroll">
          <div className={`calendar-grid ${mode === "Woche" ? "week" : ""}`}>
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div className="weekday" key={d}>
                {d}
              </div>
            ))}
            {Array.from({ length: count }, (_, i) => {
              const day = moveDay(start, i);
              return (
                <div
                  key={day}
                  className={`day ${day.slice(0, 7) !== anchor.slice(0, 7) && mode === "Monat" ? "outside" : ""}`}
                >
                  <span
                    className={`day-number ${day === today() ? "current" : ""}`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {sorted.filter((x) => dateOf(x) === day).map(event)}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="calendar-foot">
        {items.filter((x) => !dateOf(x)).length} Einträge ohne Datum erscheinen
        in den Kursdetails.
      </div>
    </section>
  );
}
