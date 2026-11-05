import { validateData } from "./storage";
import type { CloudAccess } from "../../private-cloud/Gate";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  AlertCircle,
  Sun,
  Moon,
  Download,
  Upload,
  GraduationCap,
  SlidersHorizontal,
  CheckCheck,
  CalendarClock,
  FileText,
  ExternalLink,
  X,
  MoreHorizontal,
  PanelLeftClose,
} from "lucide-react";
import Editor from "./Editor";
import Calendar from "./Calendar";
import LearningProgress from "./LearningProgress";
import {
  assessmentTypes,
  statuses,
  isClosed,
  hasConfirmedDate,
  isMainExam,
  isOutstandingWork,
  categoryOf,
  isUpcoming,
  dateOf,
  today,
  dayDiff,
  formatDate,
  relative,
  monday,
  moveDay,
  type Data,
  type Kind,
  type RecordData,
} from "./types";
const nav = [
  { id: "overview", name: "Übersicht", icon: LayoutDashboard },
  { id: "courses", name: "Meine Kurse", icon: BookOpen },
  { id: "calendar", name: "Kalender", icon: CalendarDays },
  { id: "tasks", name: "Aufgaben", icon: ListTodo },
];
const titles: Record<string, string> = {
  overview: "Alles im Blick.",
  courses: "Dein Semester, strukturiert.",
  calendar: "Raum für das Wesentliche.",
  tasks: "Ein Schritt nach dem anderen.",
  settings: "Deine Daten. Dein Überblick.",
};
const subtitles: Record<string, string> = {
  overview: "Prüfungen, Abgaben und nächste Schritte an einem Ort.",
  courses: "Prüfungsstrukturen verstehen. Anforderungen im Blick behalten.",
  calendar: "Alle Prüfungen und Abgaben — ohne Vorlesungsplan.",
  tasks: "Kleine Schritte für ein entspanntes Semester.",
  settings: "Privat synchronisiert. Jederzeit in deiner Hand.",
};
export default function App({initial, cloud}: {initial: Data; cloud: CloudAccess<Data>}) {
  const [data, setData] = useState<Data | null>(initial);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState("overview");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [editor, setEditor] = useState<{ kind: Kind; item: RecordData } | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState(
    localStorage.getItem("campus-theme") || "light",
  );
  const [mobile, setMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const [confirmation, setConfirmation] = useState<{
    text: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("campus-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    if (confirmation) confirmRef.current?.showModal();
  }, [confirmation]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  async function persist(next: Data) {
    if (savingRef.current) throw Error("Ein Speichervorgang läuft bereits.");
    savingRef.current = true;
    setSaving(true);
    try {
      const body = await cloud.save({ ...next, revision: cloud.revision() + 1 });
      setData(body);
      return body;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (saving || editor || confirmBusy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", listener); return () => window.removeEventListener("beforeunload", listener);
  }, [saving, editor, confirmBusy]);
  const openNew = (kind: Kind, courseId = selectedCourse) =>
    setEditor({
      kind,
      item: {
        id: "",
        name: "",
        ...(kind === "courses"
          ? { semester: "Beispielsemester" }
          : {
              courseId,
              status: "Offen",
              classification: kind === "tasks" ? "Pflicht" : "Optional",
              ...(kind === "assessments"
                ? {
                    type: assessmentTypes[0],
                    confidence: "Unbestätigt",
                    gradingModel: "Unbekannt",
                  }
                : { priority: "Normal" }),
            }),
      },
    });
  const go = (p: string) => {
    setPage(p);
    setSelectedCourse("");
    setQuery("");
    setCourseFilter("");
    setTypeFilter("");
    setStatusFilter("active");
    setMobile(false);
  };
  if (!data)
    return (
      <div className="loading">
        <GraduationCap size={40} />
        <h1>Campus</h1>
        <p>{loadError || "Dein Semester wird geladen …"}</p>
        {loadError && (
          <button className="button primary" onClick={() => location.reload()}>
            Erneut versuchen
          </button>
        )}
      </div>
    );
  const courseName = (id: string) =>
    data.courses.find((c) => c.id === id)?.name || "Allgemein";
  const kindOf = (x: RecordData): Kind =>
    data.tasks.some((t) => t.id === x.id) ? "tasks" : "assessments";
  const all = [...data.assessments, ...data.tasks];
  const matches = (x: RecordData) =>
    `${x.name} ${courseName(x.courseId)} ${x.description || ""} ${x.notes || ""}`
      .toLocaleLowerCase("de")
      .includes(query.toLocaleLowerCase("de")) &&
    (!courseFilter || x.courseId === courseFilter) &&
    (!typeFilter || x.type === typeFilter) &&
    (statusFilter === "all" ||
      (statusFilter === "active" ? !isClosed(x) : x.status === statusFilter));
  const searchMatches = all.filter((x) =>
    `${x.name} ${courseName(x.courseId)} ${x.description || ""} ${x.notes || ""}`
      .toLocaleLowerCase("de")
      .includes(query.toLocaleLowerCase("de")),
  );
  const filtered = all.filter(matches);
  const dated = filtered
    .filter(
      (x) =>
        hasConfirmedDate(x) &&
        categoryOf(x) !== "Optionale Lernaktivität" &&
        categoryOf(x) !== "Information offen" &&
        (x.eventRole !== "registration-opening" || dateOf(x) >= today()),
    )
    .sort((a, b) =>
      (dateOf(a) + (a.time || "23:59")).localeCompare(
        dateOf(b) + (b.time || "23:59"),
      ),
    );
  const active = all.filter((x) => !isClosed(x));
  const future = active
    .filter((x) => isUpcoming(x) && hasConfirmedDate(x))
    .sort((a, b) =>
      (dateOf(a) + (a.time || "23:59")).localeCompare(
        dateOf(b) + (b.time || "23:59"),
      ),
    );
  const nextExam = future.find(isMainExam);
  const nextDeadline = future.find((x) => x.deadline);
  const seven = future.filter((x) => x.deadline && dayDiff(x.deadline) <= 7);
  const weekStart = monday(today()),
    weekEnd = moveDay(weekStart, 6);
  const weekItems = dated.filter(
    (x) => dateOf(x) >= weekStart && dateOf(x) <= weekEnd,
  );
  const pending = data.courses.filter(
    (c) => c.pending || !data.assessments.some((a) => a.courseId === c.id),
  );
  const pendingRegistrations = data.tasks.filter(
    (t) =>
      categoryOf(t) === "Administrative Anmeldung" &&
      !t.deadline &&
      !isClosed(t),
  );
  const unresolved = data.assessments.filter(
    (a) =>
      a.confidence !== "Bestätigt" ||
      (!dateOf(a) && a.type !== "Bonusanforderung") ||
      a.registration,
  );
  const pendingItems = [...data.assessments, ...data.tasks].filter(
    (x) =>
      !isClosed(x) &&
      (categoryOf(x) === "Information offen" ||
        x.dateStatus === "Zeitfenster" ||
        x.dateStatus === "Vorläufig"),
  );
  const bonusItems = data.assessments.filter(
    (x) => !isClosed(x) && categoryOf(x) === "Freiwilliger Bonus",
  );
  const complete = async (x: RecordData) => {
    const kind = kindOf(x);
    try {
      await persist({
        ...data,
        [kind]: data[kind].map((t) =>
          t.id === x.id
            ? {
                ...t,
                status: isClosed(x)
                  ? "Offen"
                  : x.deadline
                    ? "Abgegeben"
                    : "Erledigt",
              }
            : t,
        ),
      });
      setToast(isClosed(x) ? "Wieder geöffnet." : "Fortschritt gespeichert.");
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const row = (x: RecordData, compact = false) => (
    <div
      className={`assessment-row ${isClosed(x) ? "is-done" : ""}`}
      key={x.id}
    >
      <button
        className={`complete ${isClosed(x) ? "checked" : ""}`}
        aria-label={`${x.name}: ${isClosed(x) ? "wieder öffnen" : "abschließen"}`}
        disabled={saving}
        onClick={() => complete(x)}
      >
        {isClosed(x) && <Check size={14} />}
      </button>
      {!compact && (
        <div
          className={`date-tile ${dateOf(x) && dayDiff(dateOf(x)) <= 2 ? "near" : ""}`}
        >
          {dateOf(x) ? (
            <>
              <strong>{Number(dateOf(x).slice(8))}</strong>
              <span>{formatDate(dateOf(x), { month: "short" })}</span>
            </>
          ) : (
            <Clock3 size={19} />
          )}
        </div>
      )}
      <button
        className="row-main"
        onClick={() => setEditor({ kind: kindOf(x), item: x })}
      >
        <span className="row-course">
          {courseName(x.courseId)}
          {x.confidence === "Unbestätigt" ? " · Unbestätigt" : ""}
        </span>
        <strong>{x.name}</strong>
        <span className="row-meta">
          {x.deadline ? "Abgabe" : x.type || "Aufgabe"}
          {x.time ? ` · ${x.time}${x.endTime ? `–${x.endTime}` : ""} Uhr` : ""}
          {x.location ? ` · ${x.location}` : ""}
          {x.dateStatus === "Vorläufig"
            ? " · Vorläufig"
            : x.windowLabel && !hasConfirmedDate(x)
              ? ` · ${x.windowLabel} (ungefähr)`
              : !dateOf(x)
                ? " · Termin noch nicht bekannt"
                : ""}
          {x.eventRole === "registration-opening"
            ? " · Anmeldungsöffnung, kein Anmeldeschluss"
            : ""}
        </span>
      </button>
      <div className="row-end">
        <span
          className={`badge ${x.classification === "Pflicht" ? "required-badge" : x.classification === "Bonus" ? "bonus" : "optional"}`}
        >
          {x.obligation === "Unbestätigt"
            ? "Pflichtstatus offen"
            : x.classification}
        </span>
        <span
          className={
            x.deadline &&
            hasConfirmedDate(x) &&
            dayDiff(dateOf(x)) <= 1 &&
            !isClosed(x)
              ? "soon"
              : ""
          }
        >
          {isClosed(x)
            ? x.status
            : dateOf(x)
              ? x.eventRole === "registration-opening" && dayDiff(dateOf(x)) < 0
                ? "Anmeldung geöffnet"
                : !x.deadline && dayDiff(dateOf(x)) < 0
                  ? "Termin vergangen"
                  : relative(dateOf(x), x.time)
              : "Offen"}
        </span>
      </div>
      <button
        className="icon-button row-arrow"
        aria-label={`${x.name} bearbeiten`}
        onClick={() => setEditor({ kind: kindOf(x), item: x })}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
  const empty = (message: string, action?: () => void) => (
    <div className="empty">
      <CheckCheck size={26} />
      <p>{message}</p>
      {action && (
        <button className="text-button" onClick={action}>
          Eintrag hinzufügen <Plus size={14} />
        </button>
      )}
    </div>
  );
  const courseCard = (c: RecordData) => {
    const components = data.assessments.filter((a) => a.courseId === c.id);
    const next = future.find((a) => a.courseId === c.id);
    return (
      <button
        className="course-card"
        key={c.id}
        onClick={() => {
          setPage("courses");
          setSelectedCourse(c.id);
          setQuery("");
        }}
      >
        <div className="course-card-top">
          <span className="course-code">
            {c.code || (c.teachingEvent ? `LV ${c.teachingEvent}` : "Kurs")}
          </span>
          <ArrowUpRight size={17} />
        </div>
        <h3>{c.name}</h3>
        <div className="course-card-info">
          <span>
            {components.length
              ? `${components.length} Leistungsbausteine`
              : "Prüfungsstruktur offen"}
          </span>
          <span>
            {components.filter(isClosed).length}/{components.length} erledigt
          </span>
        </div>
        <div className="progress">
          <i
            style={{
              width: `${components.length ? (components.filter(isClosed).length / components.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="course-next">
          {next ? (
            <>
              <CalendarClock size={14} />
              <span>
                {formatDate(dateOf(next))} · {next.name}
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={14} />
              <span>Termine noch zu klären</span>
            </>
          )}
        </div>
      </button>
    );
  };
  const filters = (
    <div className="filters">
      <SlidersHorizontal size={16} />
      <select
        aria-label="Nach Kurs filtern"
        value={courseFilter}
        onChange={(e) => setCourseFilter(e.target.value)}
      >
        <option value="">Alle Kurse</option>
        {data.courses.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Nach Art filtern"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="">Alle Arten</option>
        {assessmentTypes.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select
        aria-label="Nach Status filtern"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="active">Offene Einträge</option>
        <option value="all">Alle Status</option>
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {(courseFilter || typeFilter || statusFilter !== "active") && (
        <button
          className="text-button"
          onClick={() => {
            setCourseFilter("");
            setTypeFilter("");
            setStatusFilter("active");
          }}
        >
          Zurücksetzen
        </button>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-mark">
            <GraduationCap size={23} />
          </span>
          <span>
            campus<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">IE</span>
          <div>
            <strong>Mein Studium</strong>
            <small>Persönlicher Arbeitsbereich</small>
          </div>
        </div>
        <span className="nav-label">DEIN STUDIUM</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              {n.name}
              {n.id === "tasks" &&
                data.tasks.filter(isOutstandingWork).length > 0 && (
                  <span className="nav-count">
                    {data.tasks.filter(isOutstandingWork).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="semester-card">
            <span className="semester-dot" />
            <span>Mein Semester</span>
            <small>Schritt für Schritt durchs Semester.</small>
          </div>
          <button
            className={`settings-link ${page === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <SlidersHorizontal size={17} />
            Daten & Einstellungen
          </button>
          <div className="local-note">
            <span className="local-dot" />
            Privat synchronisiert{" "}
            <button
              className="icon-button"
              aria-label={
                theme === "light"
                  ? "Dunkelmodus aktivieren"
                  : "Hellmodus aktivieren"
              }
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Navigation öffnen"
              onClick={() => setMobile(!mobile)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>Mein Studium</span>
            <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n.id === page)?.name || "Einstellungen"}
            </strong>
          </div>
          <label className="global-search">
            <Search size={16} />
            <input
              ref={searchRef}
              placeholder="Kurse und Leistungen suchen …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Kurse und Leistungen suchen"
            />
            <kbd>Ctrl K</kbd>
            {query && (
              <button
                className="icon-button"
                aria-label="Suche leeren"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <span className="profile">IE</span>
        </header>
        <main>
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? formatDate(today(), {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "DEIN AKADEMISCHER KOMPASS"}
              </div>
              <h1>{titles[page]}</h1>
              <p>{subtitles[page]}</p>
            </div>
            <div className="intro-actions">
              <span className="semester-pill">Beispielsemester</span>
              <button
                className="button primary"
                onClick={() =>
                  openNew(
                    page === "courses" && !selectedCourse
                      ? "courses"
                      : page === "tasks"
                        ? "tasks"
                        : "assessments",
                  )
                }
              >
                <Plus size={17} />
                {page === "courses" && !selectedCourse
                  ? "Neuer Kurs"
                  : page === "tasks"
                    ? "Neue Aufgabe"
                    : "Neue Leistung"}
              </button>
            </div>
          </div>
          {query && (
            <section className="panel search-results">
              <div className="section-heading">
                <h2>Suchergebnisse</h2>
                <span className="count">
                  {searchMatches.length +
                    data.courses.filter((c) =>
                      (c.name + " " + c.code)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ).length}
                </span>
              </div>
              {data.courses
                .filter((c) =>
                  (c.name + " " + c.code)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <button
                    className="search-course"
                    key={c.id}
                    onClick={() => {
                      setSelectedCourse(c.id);
                      setPage("courses");
                      setQuery("");
                    }}
                  >
                    <BookOpen size={17} />
                    {c.name}
                    <span>{c.code}</span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              {searchMatches.map((x) => row(x, true))}
              {!searchMatches.length &&
                !data.courses.some((c) =>
                  (c.name + " " + c.code)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ) &&
                empty(
                  "Keine passenden Einträge. Andere Suchbegriffe versuchen.",
                )}
            </section>
          )}
          {page === "overview" && (
            <>
              <div className="stats-grid">
                <div className="stat featured">
                  <span>
                    Nächste Abgabe <ArrowUpRight size={16} />
                  </span>
                  <strong>
                    {nextDeadline
                      ? formatDate(nextDeadline.deadline, {
                          day: "2-digit",
                          month: "short",
                        })
                      : "Keine Frist"}
                  </strong>
                  <p>
                    {nextDeadline
                      ? `${nextDeadline.name} · ${relative(nextDeadline.deadline, nextDeadline.time)}`
                      : "Keine bestätigte Abgabe geplant"}
                  </p>
                </div>
                <div className="stat">
                  <span>
                    Offene Aufgaben <ListTodo size={16} />
                  </span>
                  <strong>
                    {data.tasks.filter(isOutstandingWork).length}
                    <small>Aufgaben</small>
                  </strong>
                  <p>
                    {
                      active.filter(
                        (x) =>
                          x.classification === "Pflicht" &&
                          kindOf(x) === "tasks" &&
                          isOutstandingWork(x),
                      ).length
                    }{" "}
                    davon verpflichtend
                  </p>
                </div>
                <div className="stat">
                  <span>
                    Nächste Prüfung <CalendarDays size={16} />
                  </span>
                  <strong>
                    {nextExam ? formatDate(dateOf(nextExam)) : "Termin offen"}
                  </strong>
                  <p>
                    {nextExam
                      ? `${courseName(nextExam.courseId)}${nextExam.time ? ` · ${nextExam.time} Uhr` : ""}`
                      : "Keine Hauptprüfung datiert"}
                  </p>
                </div>
                <div className="stat">
                  <span>
                    In den nächsten 7 Tagen <Clock3 size={16} />
                  </span>
                  <strong>
                    {seven.length}
                    <small>{seven.length === 1 ? "Abgabe" : "Abgaben"}</small>
                  </strong>
                  <p>
                    {seven.filter((x) => x.classification === "Pflicht").length}{" "}
                    Pflicht ·{" "}
                    {seven.filter((x) => x.classification !== "Pflicht").length}{" "}
                    freiwillig / Bonus
                  </p>
                </div>
              </div>
              <div className="overview-columns">
                <div className="primary-column">
                  <section className="panel next-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">DEIN NÄCHSTER SCHRITT</span>
                        <h2>
                          Als Nächstes{" "}
                          <span className="count">
                            {dated.filter((x) => !isClosed(x)).length}
                          </span>
                        </h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go("calendar")}
                      >
                        Kalender <ArrowRight size={15} />
                      </button>
                    </div>
                    {dated
                      .filter((x) => !isClosed(x))
                      .slice(0, 5)
                      .map((x) => row(x))}
                    {!dated.filter((x) => !isClosed(x)).length &&
                      empty(
                        "Alles im grünen Bereich. Keine bestätigten Termine offen.",
                        () => openNew("assessments"),
                      )}
                    <div className="panel-foot">
                      <span>
                        <span className="tiny-dot" />
                        Freiwillige Leistungen sind immer als solche
                        gekennzeichnet.
                      </span>
                    </div>
                  </section>
                  {bonusItems.length > 0 && (
                    <details className="panel course-tasks">
                      <summary className="section-heading">
                        <h2>
                          Freiwillige Bonusmöglichkeiten{" "}
                          <span className="count">{bonusItems.length}</span>
                        </h2>
                      </summary>
                      {bonusItems.map((x) => row(x, true))}
                    </details>
                  )}
                  <section>
                    <div className="section-heading outside-heading">
                      <h2>
                        Meine Kurse{" "}
                        <span className="count">{data.courses.length}</span>
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => go("courses")}
                      >
                        Alle Kurse <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="course-grid">
                      {data.courses.map(courseCard)}
                    </div>
                    {!data.courses.length &&
                      empty("Dein erster Kurs wartet.", () =>
                        openNew("courses"),
                      )}
                  </section>
                </div>
                <div className="secondary-column">
                  <section className="panel week-panel">
                    <div className="section-heading">
                      <h2>Diese Woche</h2>
                      <span className="week-label">
                        {formatDate(weekStart)} – {formatDate(weekEnd)}
                      </span>
                    </div>
                    <div className="week-strip">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = moveDay(weekStart, i);
                        return (
                          <div key={d} className={d === today() ? "today" : ""}>
                            <span>
                              {["M", "D", "M", "D", "F", "S", "S"][i]}
                            </span>
                            <strong>{Number(d.slice(8))}</strong>
                            <i
                              className={
                                weekItems.some((x) => dateOf(x) === d)
                                  ? "has-event"
                                  : ""
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                    {weekItems.slice(0, 4).map((x) => (
                      <button
                        className="week-item"
                        key={x.id}
                        onClick={() => setEditor({ kind: kindOf(x), item: x })}
                      >
                        <span
                          className={`week-item-icon ${x.deadline ? "" : "event"}`}
                        >
                          {x.deadline ? (
                            <FileText size={17} />
                          ) : (
                            <CalendarDays size={17} />
                          )}
                        </span>
                        <span>
                          <strong>{x.name}</strong>
                          <small>
                            {x.deadline ? "Abgabe" : "Termin"} ·{" "}
                            {formatDate(dateOf(x), {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                            {x.time ? ` · ${x.time}` : ""}
                          </small>
                        </span>
                        <span className="tiny-classification">
                          {x.obligation === "Unbestätigt"
                            ? "Pflichtstatus offen"
                            : x.classification}
                        </span>
                      </button>
                    ))}
                    {!weekItems.length && (
                      <p className="quiet-empty">
                        Keine bestätigten Termine diese Woche.
                      </p>
                    )}
                    <button
                      className="week-add"
                      onClick={() => openNew("tasks")}
                    >
                      <Plus size={16} />
                      Aufgabe hinzufügen
                    </button>
                  </section>
                  <section className="panel attention-panel">
                    <div className="section-heading">
                      <h2>
                        <AlertCircle size={17} />
                        Information offen
                      </h2>
                      <span className="count">{pending.length}</span>
                    </div>
                    <p className="attention-intro">
                      Einige Informationen fehlen noch. Hier bleibt nichts unter
                      dem Radar.
                    </p>
                    {pending.map((c) => (
                      <button
                        className="attention-item"
                        key={c.id}
                        onClick={() => {
                          setPage("courses");
                          setSelectedCourse(c.id);
                        }}
                      >
                        <span className="attention-dot" />
                        <span>
                          <strong>{c.name}</strong>
                          <small>
                            {c.id === "ml"
                              ? "Prüfungstermine & Teilnahmeverfahren offen"
                              : c.pending || "Prüfungsstruktur noch offen"}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    {!pending.length &&
                      empty("Alle Kursinformationen sind geklärt.")}
                    {pendingRegistrations.length > 0 && (
                      <details className="attention-details" open>
                        <summary>
                          Anmeldungen ohne bekannte Frist (
                          {pendingRegistrations.length})
                        </summary>
                        {pendingRegistrations.map((t) => (
                          <button
                            className="attention-item"
                            key={t.id}
                            onClick={() =>
                              setEditor({ kind: "tasks", item: t })
                            }
                          >
                            <span>
                              <strong>{t.name}</strong>
                              <small>
                                {courseName(t.courseId)} · Frist noch nicht
                                bekannt
                              </small>
                            </span>
                          </button>
                        ))}
                      </details>
                    )}
                    {pendingItems.length > 0 && (
                      <details className="attention-details" open>
                        <summary>
                          Zeitfenster und offene Angaben ({pendingItems.length})
                        </summary>
                        {pendingItems.map((x) => (
                          <button
                            className="attention-item"
                            key={x.id}
                            onClick={() =>
                              setEditor({ kind: kindOf(x), item: x })
                            }
                          >
                            <span>
                              <strong>{x.name}</strong>
                              <small>
                                {x.windowLabel
                                  ? `${x.windowLabel} · ungefähres Zeitfenster`
                                  : x.notes ||
                                    x.description ||
                                    "Noch zu bestätigen"}
                              </small>
                            </span>
                          </button>
                        ))}
                      </details>
                    )}
                    {unresolved.length > 0 && (
                      <details className="attention-details">
                        <summary>
                          {unresolved.length} Leistungen mit offenen
                          Informationen
                        </summary>
                        {unresolved.map((a) => (
                          <button
                            key={a.id}
                            className="attention-item"
                            onClick={() =>
                              setEditor({ kind: "assessments", item: a })
                            }
                          >
                            <span>
                              <strong>{a.name}</strong>
                              <small>
                                {!dateOf(a) ? "Termin offen · " : ""}
                                {a.confidence}
                                {a.registration ? ` · ${a.registration}` : ""}
                              </small>
                            </span>
                          </button>
                        ))}
                      </details>
                    )}
                    <div className="attention-note">
                      Unbestätigte Angaben werden nicht als feste Termine
                      gewertet.
                    </div>
                  </section>
                  <div className="calm-note">
                    <GraduationCap size={22} />
                    <p>
                      Weniger im Kopf.
                      <br />
                      <strong>Mehr Fokus fürs Studium.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {page === "courses" && !selectedCourse && (
            <>
              <div className="section-heading outside-heading">
                <h2>
                  Kursübersicht{" "}
                  <span className="count">{data.courses.length}</span>
                </h2>
                <span className="muted">
                  Vorläufige Kursliste · frei bearbeitbar
                </span>
              </div>
              <div className="course-grid full">
                {data.courses
                  .filter((c) =>
                    (c.name + " " + c.code)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map(courseCard)}
                <button
                  className="course-card add-course"
                  onClick={() => openNew("courses")}
                >
                  <Plus size={25} />
                  <strong>Kurs hinzufügen</strong>
                  <span>Platz für dein nächstes Thema.</span>
                </button>
              </div>
            </>
          )}
          {page === "courses" &&
            selectedCourse &&
            (() => {
              const c = data.courses.find((x) => x.id === selectedCourse);
              if (!c) return null;
              const components = data.assessments.filter(
                (x) => x.courseId === c.id,
              );
              return (
                <>
                  <button
                    className="text-button back"
                    onClick={() => setSelectedCourse("")}
                  >
                    ← Alle Kurse
                  </button>
                  <section className="panel course-detail">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">
                          {c.code || `LV ${c.teachingEvent || "unbekannt"}`} ·{" "}
                          {c.semester}
                          {c.ects ? ` · ${c.ects} ECTS` : ""}
                          {c.courseType ? ` · ${c.courseType}` : ""}
                          {c.level ? ` · ${c.level}` : ""}
                        </span>
                        <h2>{c.name}</h2>
                      </div>
                      <button
                        className="button secondary"
                        onClick={() => setEditor({ kind: "courses", item: c })}
                      >
                        Kurs bearbeiten
                      </button>
                    </div>
                    {c.grading ? (
                      <div className="grading-info">
                        <GraduationCap size={21} />
                        <div>
                          <h3>So setzt sich die Bewertung zusammen</h3>
                          <p>{c.grading}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="info-box">
                        <AlertCircle size={18} />
                        Die Prüfungsstruktur ist noch nicht bestätigt.
                      </div>
                    )}
                    {c.pending && (
                      <div className="info-box pending">
                        <Clock3 size={18} />
                        <div>
                          <strong>Noch zu klären</strong>
                          <p>{c.pending}</p>
                        </div>
                      </div>
                    )}
                    {c.notes && <p className="muted course-notes">{c.notes}</p>}
                    <p className="muted course-notes">
                      Kursbelegung: {c.enrollmentStatus || "Unbekannt"} ·
                      unabhängig von der Prüfungsanmeldung
                      {c.teachingHours
                        ? ` · ${c.teachingHours} SWS (keine ECTS-Angabe)`
                        : ""}
                      {c.lecturers
                        ? ` · Lehrende: ${c.lecturers.replaceAll("\n", ", ")}`
                        : ""}
                    </p>
                    <div className="detail-caption">
                      <h3>
                        Leistungsbausteine{" "}
                        <span className="count">{components.length}</span>
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => openNew("assessments", c.id)}
                      >
                        <Plus size={16} />
                        Leistung hinzufügen
                      </button>
                    </div>
                    {components.map((a) => (
                      <details className="component" key={a.id}>
                        <summary>
                          <span
                            className={`component-icon ${a.deadline ? "submission" : ""}`}
                          >
                            {isClosed(a) ? (
                              <Check size={17} />
                            ) : a.deadline ? (
                              <FileText size={17} />
                            ) : (
                              <CalendarDays size={17} />
                            )}
                          </span>
                          <span className="component-name">
                            <strong>{a.name}</strong>
                            <small>
                              {a.type} ·{" "}
                              {dateOf(a)
                                ? formatDate(dateOf(a), {
                                    day: "2-digit",
                                    month: "long",
                                    year: "numeric",
                                  })
                                : a.windowLabel
                                  ? `${a.windowLabel} (ungefähres Zeitfenster)`
                                  : "Termin noch nicht bekannt"}
                              {a.time
                                ? ` · ${a.time}${a.endTime ? `–${a.endTime}` : ""} Uhr`
                                : ""}
                            </small>
                          </span>
                          <span
                            className={`badge ${a.classification === "Bonus" ? "bonus" : a.classification === "Optional" ? "optional" : "required-badge"}`}
                          >
                            {a.obligation === "Unbestätigt"
                              ? "Pflichtstatus offen"
                              : a.classification}
                          </span>
                          <ChevronRight size={16} />
                        </summary>
                        <div className="component-body">
                          <div className="detail-grid">
                            {[
                              ["Status", a.status],
                              ["Informationsstand", a.confidence],
                              ["Kategorie", categoryOf(a)],
                              ["Terminstand", a.dateStatus],
                              ["Zeitfenster", a.windowLabel],
                              ["Erreichte Note", a.grade],
                              ["Ort", a.location],
                              ["Abgabe", a.platform],
                              ["Dauer", a.duration],
                              ["Prüfungsversuch", a.attempt],
                              ["Maximalpunkte", a.maxPoints],
                              ["Erreichte Punkte", a.score],
                              ["Vergebene Übungscredits", a.creditsEarned],
                              [
                                "Bewertungsmodell",
                                a.gradingModel || "Unbekannt",
                              ],
                              [
                                "Gewichtung / Punkte",
                                a.weight || "Nicht festgelegt",
                              ],
                            ].map(
                              ([label, v]) =>
                                v && (
                                  <div key={label}>
                                    <span>{label}</span>
                                    <strong>{v}</strong>
                                  </div>
                                ),
                            )}
                          </div>
                          {[
                            ["Beschreibung", a.description],
                            ["Bonusregel", a.bonus],
                            ["Voraussetzungen", a.prerequisites],
                            ["Anmeldung", a.registration],
                            ["Notizen", a.notes],
                            ["Quellenhinweis", a.sourceNotes],
                          ].map(
                            ([label, v]) =>
                              v && (
                                <div className="detail-text" key={label}>
                                  <h4>{label}</h4>
                                  <p>{v}</p>
                                </div>
                              ),
                          )}
                          {a.url && (
                            <a
                              className="text-button"
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Externen Link öffnen <ExternalLink size={14} />
                            </a>
                          )}
                          <div className="component-actions">
                            <button
                              className="button secondary small"
                              onClick={() =>
                                setEditor({ kind: "assessments", item: a })
                              }
                            >
                              Bearbeiten
                            </button>
                            <button
                              className="text-button"
                              disabled={saving}
                              onClick={() => complete(a)}
                            >
                              <Check size={15} />
                              {isClosed(a)
                                ? "Wieder öffnen"
                                : "Als erledigt markieren"}
                            </button>
                          </div>
                        </div>
                      </details>
                    ))}
                    {!components.length &&
                      empty("Noch keine Prüfungsleistungen erfasst.", () =>
                        openNew("assessments", c.id),
                      )}
                    <p className="form-help">
                      Eine Gesamtnote wird erst mit einer vollständig
                      definierten Bewertungsformel sinnvoll. Hier werden die
                      Regeln dokumentiert.
                    </p>
                  </section>
                  <LearningProgress
                    course={c}
                    data={data}
                    onSave={persist}
                    onEdit={(t) => setEditor({ kind: "tasks", item: t })}
                  />
                  {c.creditTarget && (
                    <section className="panel course-tasks">
                      <div className="section-heading">
                        <h2>
                          Übungscredits:{" "}
                          {Number(c.creditsManual || 0) +
                            [...data.assessments, ...data.tasks]
                              .filter((x) => x.courseId === c.id)
                              .reduce(
                                (sum, x) => sum + Number(x.creditsEarned || 0),
                                0,
                              )}{" "}
                          / {c.creditTarget}
                        </h2>
                        <button
                          className="text-button"
                          onClick={() =>
                            setEditor({
                              kind: "tasks",
                              item: {
                                id: "",
                                courseId: c.id,
                                name: "Übungscredit erfassen",
                                activity: "exercise-credit",
                                classification: "Bonus",
                                status: "Offen",
                                priority: "Normal",
                                creditsEarned: "",
                                date: "",
                                deadline: "",
                                time: "",
                                notes:
                                  "Nur tatsächlich individuell vergebene Credits erfassen; Abgleich mit Moodle.",
                              },
                            })
                          }
                        >
                          <Plus size={16} />
                          Credit erfassen
                        </button>
                      </div>
                      <p className="muted course-notes">
                        Vier Credits ermöglichen einen Notenschritt, aber kein
                        Bestehen einer nicht bestandenen Prüfung. Vergabe
                        ausschließlich manuell, unabhängig von Teilnahme oder
                        Abschluss. Bereits erworbene Credits lassen sich unter
                        „Kurs bearbeiten“ ergänzen; neue Credits am jeweiligen
                        Termin oder als Einzeleintrag erfassen.
                      </p>
                      {[...data.assessments, ...data.tasks]
                        .filter(
                          (x) =>
                            x.courseId === c.id && Number(x.creditsEarned) > 0,
                        )
                        .map((x) => row(x, true))}
                    </section>
                  )}
                  <section className="panel course-tasks">
                    <div className="section-heading">
                      <h2>Aufgaben zu diesem Kurs</h2>
                      <button
                        className="text-button"
                        onClick={() => openNew("tasks", c.id)}
                      >
                        <Plus size={16} />
                        Aufgabe
                      </button>
                    </div>
                    {data.tasks
                      .filter(
                        (t) => t.courseId === c.id && t.activity !== "learning",
                      )
                      .sort((a, b) =>
                        (dateOf(a) || "9999").localeCompare(
                          dateOf(b) || "9999",
                        ),
                      )
                      .map((t) => row(t, true))}
                    {!data.tasks.some(
                      (t) => t.courseId === c.id && t.activity !== "learning",
                    ) && empty("Keine Aufgaben für diesen Kurs.")}
                  </section>
                </>
              );
            })()}
          {page === "calendar" && (
            <>
              {filters}
              <Calendar
                items={filtered}
                courseName={courseName}
                onOpen={(x) => setEditor({ kind: kindOf(x), item: x })}
              />
            </>
          )}
          {page === "tasks" && (
            <>
              {filters}
              <section className="panel task-panel">
                <div className="section-heading">
                  <h2>
                    Meine Aufgaben{" "}
                    <span className="count">
                      {data.tasks.filter(matches).length}
                    </span>
                  </h2>
                  <span className="muted">
                    Ein Klick auf den Kreis speichert den Fortschritt.
                  </span>
                </div>
                {data.tasks
                  .filter(matches)
                  .sort((a, b) =>
                    (dateOf(a) || "9999").localeCompare(dateOf(b) || "9999"),
                  )
                  .map((x) => (
                    <div className="task-with-priority" key={x.id}>
                      {row(x)}
                      {x.priority === "Hoch" && (
                        <span className="priority-label">Hohe Priorität</span>
                      )}
                    </div>
                  ))}
                {!data.tasks.filter(matches).length &&
                  empty(
                    "Freier Kopf. Hier ist Platz für deinen nächsten Schritt.",
                    () => openNew("tasks"),
                  )}
              </section>
            </>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <span className="settings-icon">
                  <Download size={23} />
                </span>
                <h2>Daten sichern & übertragen</h2>
                <p>
                  Kurse, Leistungen und Aufgaben als JSON exportieren. Die Datei
                  lässt sich später wieder importieren.
                </p>
                <div className="settings-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      const { revision, ...exportData } = data;
                      const blob = new Blob(
                        [JSON.stringify(exportData, null, 2)],
                        { type: "application/json" },
                      );
                      const u = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = u;
                      a.download = `campus-${today()}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(u), 1000);
                      setToast("Export erstellt.");
                    }}
                  >
                    <Download size={16} />
                    JSON exportieren
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={16} />
                    Importieren
                  </button>
                </div>
                <p className="form-help">
                  Ein Import ersetzt den aktuellen Datenbestand nach deiner
                  Bestätigung. Der Fortschrittsverlauf wird privat synchronisiert.
                </p>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      if (file.size > 8_000_000)
                        throw Error("Datei zu groß (max. 8 MB).");
                      const parsed = validateData(JSON.parse(await file.text()));
                      if (
                        parsed.version !== 1 ||
                        !Array.isArray(parsed.courses) ||
                        !Array.isArray(parsed.assessments) ||
                        !Array.isArray(parsed.tasks)
                      )
                        throw Error("Ungültiges Campus-JSON.");
                      setConfirmation({
                        text: `${parsed.courses.length} Kurse, ${parsed.assessments.length} Leistungen und ${parsed.tasks.length} Aufgaben importieren? Der aktuelle Datenbestand wird ersetzt. Sichere ihn vorher per Export.`,
                        run: async () => {
                          await persist({ ...parsed, revision: data.revision });
                          setToast("Import erfolgreich.");
                        },
                      });
                    } catch (e) {
                      setToast((e as Error).message);
                    }
                  }}
                />
              </section>
              <section className="panel settings-panel">
                <span className="settings-icon">
                  <Sun size={23} />
                </span>
                <h2>Dein Arbeitsbereich</h2>
                <p>Eine ruhige Oberfläche für jede Tageszeit.</p>
                <div className="theme-options">
                  {["light", "dark"].map((t) => (
                    <button
                      key={t}
                      className={`theme-option ${theme === t ? "chosen" : ""}`}
                      onClick={() => setTheme(t)}
                    >
                      {t === "light" ? <Sun size={20} /> : <Moon size={20} />}
                      <strong>{t === "light" ? "Hell" : "Dunkel"}</strong>
                      {theme === t && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <div className="settings-facts">
                  <span>
                    Zeitzone<strong>Europe/Berlin</strong>
                  </span>
                  <span>
                    Speicherung<strong>Privater Cloud-Speicher</strong>
                  </span>
                  <span>
                    Version<strong>Campus 1.0</strong>
                  </span>
                </div>
              </section>
            </div>
          )}
          <footer className="main-footer">
            <span>
              campus. <span className="footer-divider">/</span> Dein Raum für
              akademischen Überblick.
            </span>
            <span>
              {saving ? "Wird gespeichert …" : "Privat & synchronisiert"}
              <span className="tiny-dot" />
              Europe/Berlin
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <Editor
          key={editor.kind + editor.item.id}
          kind={editor.kind}
          item={editor.item}
          data={data}
          getHistory={async (kind, id) => {
            const backup = await cloud.history();
            const fields = ["status", "grade", "enrollmentStatus", "score", "creditsEarned", "creditsManual", "lectureCompleted", "quizCompleted", "examSelected"];
            const pick = (x: RecordData | undefined) => x ? Object.fromEntries(fields.filter(k => x[k] !== undefined).map(k => [k,x[k]])) : null;
            const versions = [...backup.history, {data: backup.current.data, savedAt: new Date().toISOString()}];
            const generated = versions.slice(1).flatMap((entry: any, i: number) => {
              const a = pick(versions[i].data[kind].find((x:RecordData)=>x.id===id));
              const b = pick(entry.data[kind].find((x:RecordData)=>x.id===id));
              return JSON.stringify(a) === JSON.stringify(b) ? [] : [{id:`cloud-${i}`,saved:entry.savedAt,before:a,after:b}];
            });
            const legacy = backup.legacy.filter((x:any)=>x.type==='progress' && x.kind===kind && x.recordId===id).map((x:any)=>({id:`legacy-${x.id}`,saved:x.saved,before:x.before,after:x.after}));
            return [...legacy,...generated].reverse();
          }}
          onClose={() => setEditor(null)}
          onSave={async (value) => {
            const id = value.id || crypto.randomUUID();
            const next = { ...value, id };
            await persist({
              ...data,
              [editor.kind]: value.id
                ? data[editor.kind].map((x) => (x.id === id ? next : x))
                : [...data[editor.kind], next],
            });
            setEditor(null);
            setToast("Gespeichert.");
          }}
          onDelete={async () => {
            const target = editor;
            setConfirmation({
              text:
                target.kind === "courses"
                  ? "Diesen Kurs mit allen zugehörigen Leistungen und Aufgaben endgültig löschen?"
                  : target.kind === "assessments"
                    ? "Diese Leistung endgültig löschen? Verknüpfte Aufgaben bleiben ohne Zuordnung erhalten."
                    : "Diese Aufgabe endgültig löschen?",
              run: async () => {
                let next = {
                  ...data,
                  [target.kind]: data[target.kind].filter(
                    (x) => x.id !== target.item.id,
                  ),
                };
                if (target.kind === "courses") {
                  next.assessments = next.assessments.filter(
                    (x) => x.courseId !== target.item.id,
                  );
                  next.tasks = next.tasks
                    .filter((x) => x.courseId !== target.item.id)
                    .map((t) => ({
                      ...t,
                      assessmentId: next.assessments.some(
                        (a) => a.id === t.assessmentId,
                      )
                        ? t.assessmentId
                        : "",
                    }));
                  if (selectedCourse === target.item.id) setSelectedCourse("");
                }
                if (target.kind === "assessments")
                  next.tasks = next.tasks.map((t) =>
                    t.assessmentId === target.item.id
                      ? { ...t, assessmentId: "" }
                      : t,
                  );
                await persist(next);
                setEditor(null);
                setToast("Eintrag gelöscht.");
              },
            });
          }}
        />
      )}
      {confirmation && (
        <dialog
          ref={confirmRef}
          className="confirm-dialog"
          onCancel={() => setConfirmation(null)}
          aria-labelledby="confirm-title"
        >
          <h2 id="confirm-title">Bitte bestätigen</h2>
          <p>{confirmation.text}</p>
          <div className="confirm-actions">
            <button
              className="button secondary"
              disabled={confirmBusy}
              onClick={() => setConfirmation(null)}
            >
              Abbrechen
            </button>
            <button
              className="button primary"
              disabled={confirmBusy}
              onClick={async () => {
                setConfirmBusy(true);
                try {
                  await confirmation.run();
                  setConfirmation(null);
                } catch (e) {
                  setToast((e as Error).message);
                } finally {
                  setConfirmBusy(false);
                }
              }}
            >
              {confirmBusy ? "Bitte warten …" : "Bestätigen"}
            </button>
          </div>
        </dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Hinweis schließen"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
