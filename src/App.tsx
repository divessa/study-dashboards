import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Moon,
  Plus,
  Printer,
  Search,
  Settings2,
  Sun,
  Trash2,
  X,
  Archive,
  ChartNoAxesCombined,
  ShieldCheck,
  Menu,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  areas,
  semesters as defaultSemesters,
  statuses,
  credits,
  registrations,
  plans,
  examRegistrations,
  recognitions,
  makeModule,
  official,
  number as n,
  type Module,
  type Data,
  type Area,
} from "./model";
import {
  active,
  binding,
  pendingRecognition,
  calculate,
  percent,
  semesterStats,
} from "./calculations";
import { migrateData, legacyPlan } from "./migration";
import { parseData, serialize } from "./storage";
import type { CloudAccess } from "../private-cloud/Gate";

const SemesterContext = createContext<readonly string[]>(defaultSemesters);

type Page =
  | "overview"
  | "modules"
  | "semesters"
  | "planner"
  | "calendar"
  | "grades"
  | "archive";
const nav = [
  { id: "overview", title: "Übersicht", icon: LayoutDashboard },
  { id: "modules", title: "Meine Module", icon: BookOpen },
  { id: "semesters", title: "Semesterplanung", icon: CalendarDays },
  { id: "planner", title: "Was wäre, wenn?", icon: FlaskConical },
  { id: "calendar", title: "Termine & Aufgaben", icon: ClipboardList },
  { id: "grades", title: "Noten & Statistik", icon: ChartNoAxesCombined },
  { id: "archive", title: "Archiv / Später vielleicht", icon: Archive },
] as const;
const dateLabel = (v: string) =>
  new Date(v + "T12:00:00").toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function Progress({
  value,
  earned = 0,
  color,
}: {
  value: number;
  earned?: number;
  color?: string;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Studienfortschritt"
    >
      <div style={{ width: `${Math.min(100, value)}%`, background: color }} />
      <span style={{ width: `${Math.min(100, earned)}%` }} />
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${status === "Warteliste" || status === "Prüfung ausstehend" ? "amber" : status === "Bestanden" ? "green" : status === "Abgelehnt" || status === "Nicht bestanden" ? "red" : ""}`}
    >
      {status}
    </span>
  );
}

export default function App({initial, cloud}: {initial: Data; cloud: CloudAccess<Data>}) {
  const [data, setData] = useState<Data>(initial), [warning, setWarning] = useState("");
  const [pending, setPending] = useState<{next:Data; error:string}|null>(null);
  const [syncing, setSyncing] = useState(false);
  const pendingRef = useRef(false);
  const [page, setPage] = useState<Page>("overview"),
    [dark, setDark] = useState(() => {
      try {
        return localStorage.getItem("studienkompass-theme") === "dark";
      } catch {
        return false;
      }
    });
  const [mobile, setMobile] = useState(false),
    [editing, setEditing] = useState<Module | null>(null),
    [search, setSearch] = useState(""),
    [area, setArea] = useState(""),
    [status, setStatus] = useState(""),
    [semester, setSemester] = useState("");
  const [selectedSemester, setSelectedSemester] = useState(0),
    [showOfficial, setShowOfficial] = useState(false),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState(true);
  const [scenario, setScenario] = useState<Module[] | null>(null),
    [imported, setImported] = useState<Data | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const semesters = data.profile?.semesters ?? defaultSemesters;
  const currentSemester = data.profile?.currentSemester ?? 0;
  const stats = calculate(data.modules);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("studienkompass-theme", dark ? "dark" : "light");
    } catch {
      /* data error handled separately */
    }
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function transmit(next: Data) {
    setSyncing(true);
    try {
      await cloud.save(next);
      setPending(null); pendingRef.current = false; setSaved(true); setWarning("");
    } catch {
      setSaved(false);
      setPending({next, error: "Die Synchronisierung ist fehlgeschlagen oder der Cloud-Stand wurde geändert. Exportiere deine Änderungen, bevor du neu lädst. Bei einer Verbindungsstörung kannst du erneut versuchen."});
    } finally { setSyncing(false); }
  }
  function commit(modules: Module[]) {
    if (pendingRef.current) return;
    const next: Data = { ...data, version: 1, modules, updatedAt: new Date().toISOString() };
    pendingRef.current = true; setData(next); setPending({next,error:""}); void transmit(next);
  }
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (pending || editing) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", listener); return () => window.removeEventListener("beforeunload", listener);
  }, [pending, editing]);
  function update(module: Module) {
    commit(
      data.modules.some((m) => m.id === module.id)
        ? data.modules.map((m) => (m.id === module.id ? module : m))
        : [...data.modules, module],
    );
    setEditing(null);
    setToast("Änderung wird synchronisiert");
  }
  function go(id: Page) {
    setPage(id);
    setMobile(false);
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([serialize(data)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `Studienkompass-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Backup exportiert");
  }
  const visible = data.modules
    .filter((m) => (page === "archive" ? !active(m) : active(m)))
    .filter(
      (m) =>
        m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
        (!area || m.area === area) &&
        (!status ||
          (status === "Fixplatz"
            ? m.lectureRegistration === "Fixplatz zugewiesen"
            : status === "Angemeldet"
              ? m.lectureRegistration === "Angemeldet"
              : status === "Warteliste"
                ? m.lectureRegistration === "Warteliste"
                : m.status === status)) &&
        (semester === "" || m.semester === Number(semester)),
    );
  const upcoming = data.modules
    .filter(active)
    .flatMap((m) => [
      ...(m.exam ? [{ date: m.exam, title: "Prüfung", module: m }] : []),
      ...m.tasks
        .filter((t) => !t.done && t.deadline)
        .map((t) => ({ date: t.deadline, title: t.title, module: m })),
    ])
    .sort((a, b) => a.date.localeCompare(b.date));
  function moduleRows(modules: Module[], compact = false) {
    return (
      <div className="module-list">
        {modules.length === 0 ? (
          <div className="empty">
            <BookOpen size={28} />
            <h3>Hier ist noch Platz.</h3>
            <p>Lege ein Modul an oder passe deine Filter an.</p>
          </div>
        ) : (
          modules.map((m) => (
            <div className="module-row" key={m.id}>
              <span
                className="module-mark"
                style={{
                  background: areas.find((a) => a.id === m.area)!.color + "20",
                  color: areas.find((a) => a.id === m.area)!.color,
                }}
              >
                <BookOpen size={18} />
              </span>
              <button
                className="module-title"
                onClick={() => setEditing(structuredClone(m))}
              >
                <strong>{m.name}</strong>
                <small>
                  {areas.find((a) => a.id === m.area)?.name}
                  {!compact && ` · ${semesters[m.semester]}`}
                  {m.credit === "Prüfung ausstehend" && (
                    <span className="pending-text">
                      {" "}
                      · Bereichszuordnung offen
                    </span>
                  )}
                </small>
                <small>
                  {m.lectureRegistration === "Unbekannt"
                    ? "Belegung offen"
                    : `V: ${m.lectureRegistration}`}{" "}
                  · Ü: {m.exerciseRegistration || "Unbekannt"} ·{" "}
                  {semesters[m.registrationSemester ?? m.semester]}
                </small>
              </button>
              <span className="ects">
                {n(m.ects)} <small>ECTS</small>
              </span>
              <Badge
                status={
                  ["Bestanden", "In Bearbeitung", "Nicht bestanden"].includes(
                    m.status,
                  )
                    ? m.status
                    : legacyPlan(m)!
                }
              />
              {m.lectureRegistration === "Warteliste" && active(m) ? (
                <button
                  className="row-action"
                  onClick={() =>
                    update({ ...m, lectureRegistration: "Fixplatz zugewiesen" })
                  }
                >
                  Fixplatz erhalten
                </button>
              ) : m.status !== "Bestanden" && active(m) ? (
                <button
                  className="icon-button row-pass"
                  aria-label={`${m.name}: Bestanden`}
                  title="Als bestanden markieren"
                  onClick={() => update({ ...m, status: "Bestanden" })}
                >
                  <CircleCheck size={18} />
                </button>
              ) : !active(m) ? (
                <button
                  className="row-action"
                  onClick={() =>
                    update({
                      ...m,
                      archived: false,
                      status: "Geplant",
                      planStatus: "Unverbindlich",
                    })
                  }
                >
                  Reaktivieren
                </button>
              ) : (
                <span className="row-pass">
                  <Check size={18} />
                </span>
              )}
              <button
                className="icon-button"
                aria-label={`${m.name} bearbeiten`}
                onClick={() => setEditing(structuredClone(m))}
              >
                <Settings2 size={17} />
              </button>
            </div>
          ))
        )}
      </div>
    );
  }
  function areaCards() {
    return (
      <div className="area-grid">
        {stats.byArea.map((a) => (
          <article className="area-card" key={a.id}>
            <div className="area-top">
              <span className="dot" style={{ background: a.color }} />
              <h3>{a.name}</h3>
              <span>{n(a.progress)} %</span>
            </div>
            <div className="area-value">
              {n(a.covered)} <span>/ {a.target} ECTS</span>
              {a.missing === 0 && <CircleCheck size={17} />}
            </div>
            <Progress
              value={a.progress}
              earned={percent(a.earned, a.target)}
              color={a.color}
            />
            <div className="area-detail">
              <span>
                {n(a.earned)} erworben · {n(a.planned)} verbindlich
              </span>
              <strong>{n(a.missing)} offen</strong>
            </div>
            <details>
              <summary>
                Zugehörige Module{" "}
                <span>
                  {
                    data.modules.filter((m) => active(m) && m.area === a.id)
                      .length
                  }
                </span>
              </summary>
              <div className="area-modules">
                {data.modules
                  .filter((m) => active(m) && m.area === a.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setEditing(structuredClone(m))}
                    >
                      {m.name}
                      <small>
                        {n(m.ects)} ECTS · {m.status}
                      </small>
                    </button>
                  ))}
                {!data.modules.some((m) => active(m) && m.area === a.id) && (
                  <p>
                    Noch kein Modul zugeordnet. {a.target} ECTS erforderlich.
                  </p>
                )}
              </div>
            </details>
            {a.excess > 0 && (
              <p className="pending-text">
                {n(a.excess)} ECTS über der Bereichsgrenze
              </p>
            )}
          </article>
        ))}
      </div>
    );
  }

  return (
    <SemesterContext.Provider value={semesters}>
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-icon">
            <GraduationCap size={25} />
          </span>
          <span>
            Studienkompass<small>DEIN MASTER. DEIN PLAN.</small>
          </span>
        </a>
        <div className="workspace-label">MEIN STUDIUM</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={19} />
              {item.title}
              {item.id === "modules" && (
                <span>{data.modules.filter(active).length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="campus">
            <span className="tum">ECTS</span>
            <div>
              {data.profile?.institution || "Studienkompass"}<small>{data.profile?.program || "Studienplanung"}</small>
            </div>
          </div>
          <div className="local-status">
            <span className="status-dot" />
            {saved ? "Cloud-Speicher" : "Nicht gespeichert"}
            <ShieldCheck size={14} />
          </div>
          <small className="privacy">
            Deine Daten werden privat synchronisiert.
          </small>
        </div>
      </aside>
      {mobile && (
        <button
          className="backdrop"
          aria-label="Menü schließen"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Menü öffnen"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Mein Studium</span>
            <ChevronRight size={14} />
            <strong>{nav.find((x) => x.id === page)?.title}</strong>
          </div>
          <div className="top-actions">
            <span className="semester-chip">{semesters[currentSemester]}</span>
            <button
              className="icon-button"
              title={dark ? "Helle Darstellung" : "Dunkle Darstellung"}
              aria-label="Darstellung wechseln"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="avatar">IE</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {data.profile?.institution || "DEINE STUDIENPLANUNG"}
              </div>
              <h1>
                {page === "overview"
                  ? "Dein Master im Blick."
                  : nav.find((x) => x.id === page)?.title}
              </h1>
              <p>
                {page === "overview"
                  ? "Große Ziele, klare Schritte. Hier nimmt dein Studium Form an."
                  : page === "archive"
                    ? "Aufgehoben für später. Diese Module zählen nicht zum Fortschritt."
                    : page === "planner"
                      ? "Probiere deine nächste Entscheidung aus. Deine echten Daten bleiben bis zur Übernahme unverändert."
                      : "Plane deinen Weg durch dein Studium."}
              </p>
            </div>
            <div className="heading-actions">
              {page !== "planner" && (
                <button
                  className="button primary"
                  onClick={() => setEditing(makeModule("", 5, "ie", "Geplant"))}
                >
                  <Plus size={17} />
                  Modul hinzufügen
                </button>
              )}
            </div>
          </div>
          {warning && (
            <div className="notice warning" role="alert">
              {warning}
            </div>
          )}
          {stats.duplicates.length > 0 && (
            <div className="notice warning">
              Mögliche doppelte Anrechnung: {stats.duplicates.join(", ")}. Nur
              ein Datensatz pro Name oder Anrechnungsschlüssel zählt. Bitte im
              Editor prüfen.
            </div>
          )}
          {stats.excess > 0 && (
            <div className="notice">
              {n(stats.excess)} überschüssige ECTS werden separat geführt und
              erhöhen den Studienfortschritt nicht.
            </div>
          )}
          {page === "overview" && (
            <>
              <section className="hero">
                <div className="hero-top">
                  <div>
                    <span className="hero-tag">
                      <GraduationCap size={15} /> DEIN WEG ZUM MASTER
                    </span>
                    <h2>{data.profile?.program || "Dein Masterstudium"}</h2>
                    <p>
                      4 Semester <span>·</span> 120 ECTS
                    </p>
                  </div>
                  <div className="hero-emblem">
                    <GraduationCap size={62} />
                  </div>
                </div>
                <div className="hero-progress">
                  <div>
                    <strong>{n(stats.covered)}</strong>
                    <span> / 120 ECTS abgedeckt</span>
                  </div>
                  <span className="hero-percent">
                    {n(stats.progress)}
                    <small> %</small>
                  </span>
                </div>
                <Progress
                  value={stats.progress}
                  earned={percent(stats.earned, 120)}
                />
                <div className="hero-foot">
                  <span>
                    <i />
                    Verbindliche Planung inkl. bestandener Module
                  </span>
                  <span>
                    Noch {n(stats.missing)} ECTS einplanen{" "}
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </section>
              {data.profile?.notices?.filter(notice => notice.semester === currentSemester).map((notice, i) => <div className="notice" key={i}>{notice.message} {notice.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} </a>)}</div>)}
              <div className="metrics">
                {[
                  {
                    label: "Aktuelles Semester · geplant",
                    value: semesterStats(data.modules, currentSemester).workload,
                    caption: `${semesters[currentSemester]} · Arbeitsaufwand`,
                    icon: CalendarDays,
                  },
                  {
                    label: "Tatsächlich erworben",
                    value: stats.earned,
                    caption: "Bestanden / Anerkennung genehmigt",
                    icon: CircleCheck,
                  },
                  {
                    label: "Verbindlich eingeplant",
                    value: stats.planned,
                    caption: "Noch nicht bestanden",
                    icon: BookOpen,
                  },
                  {
                    label: "Auf der Warteliste",
                    value: stats.waiting,
                    caption: "Nicht fest eingeplant",
                    icon: ClipboardList,
                  },
                  {
                    label: "Noch einzuplanen",
                    value: stats.missing,
                    caption: "Nach verbindlicher Planung",
                    icon: ChartNoAxesCombined,
                  },
                  {
                    label: "Anerkennung ausstehend",
                    value: stats.recognitionPending,
                    caption: "Nicht genehmigt · separat",
                    icon: ShieldCheck,
                  },
                ].map((item) => (
                  <article className="metric" key={item.label}>
                    <div>
                      {item.label}
                      <item.icon size={17} />
                    </div>
                    <strong>
                      {n(item.value)}
                      <small> ECTS</small>
                    </strong>
                    <p>{item.caption}</p>
                  </article>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Anerkennung bisheriger Leistungen</h2>
                    <p>
                      {n(stats.recognitionPending)} ECTS in Vorbereitung /
                      beantragt — keine genehmigten Credits. Reguläre Planung
                      und Anerkennung sind alternative Wege zum selben Modul.
                    </p>
                  </div>
                </div>
                {moduleRows(stats.recognitionRequests, true)}
                <p className="notice">
                  Bei vollständiger Genehmigung wären{" "}
                  {n(
                    calculate(data.modules, { assumeRecognition: true })
                      .covered,
                  )}{" "}
                  / 120 ECTS abgedeckt:{" "}
                  {n(
                    calculate(data.modules, { assumeRecognition: true })
                      .covered - stats.covered,
                  )}{" "}
                  zusätzliche ECTS gegenüber dem regulären Plan. Bereits
                  geplante Module werden nicht doppelt gezählt.
                </p>
              </section>
              {stats.allocationPending > 0 && (
                <div className="notice">
                  {n(stats.allocationPending)} ECTS mit ungeklärter
                  Bereichszuordnung (getrennt von Anerkennung).{" "}
                  Bitte offene Bereichszuordnungen prüfen.
                  Die bisherige Studienplanung wurde erhalten; aus alten
                  Gesamtstatus übernommene Bindungen sind im Modul-Editor
                  gekennzeichnet und können unabhängig geändert werden.
                </div>
              )}
              <div className="section-heading">
                <div>
                  <h2>Deine Studienbereiche</h2>
                  <p>Jeder Baustein bringt dich deinem Abschluss näher.</p>
                </div>
                <span className="subtle-pill">
                  {stats.byArea.filter((a) => a.missing === 0).length} von 8
                  vollständig eingeplant
                </span>
              </div>
              {areaCards()}
              <div className="bottom-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Deine Semester im Überblick</h2>
                      <p>
                        Verbindliche Belegung · Empfehlung: 30 ECTS pro Semester
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("semesters")}
                    >
                      Planung öffnen <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <LoadChart modules={data.modules} />
                </section>
                <section className="panel next-panel">
                  <div className="panel-heading">
                    <h2>Als Nächstes</h2>
                    <CalendarDays size={19} />
                  </div>
                  {upcoming.length ? (
                    upcoming.slice(0, 3).map((e, i) => (
                      <button
                        className="event-mini"
                        key={i}
                        onClick={() => setEditing(structuredClone(e.module))}
                      >
                        <span>{dateLabel(e.date)}</span>
                        <strong>{e.title}</strong>
                        <small>{e.module.name}</small>
                      </button>
                    ))
                  ) : (
                    <div className="empty small">
                      <CalendarDays size={30} />
                      <h3>Freiraum für deinen Plan</h3>
                      <p>
                        Noch keine Prüfungstermine oder Aufgaben mit Deadline
                        eingetragen.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go("calendar")}
                      >
                        Termine organisieren <ArrowUpRight size={15} />
                      </button>
                    </div>
                  )}
                  <div className="tip">
                    Masterseminar noch offen: Ordne ein bestätigtes Seminar zu,
                    um die 5 ECTS abzudecken.
                  </div>
                </section>
              </div>
            </>
          )}
          {(page === "modules" || page === "archive") && (
            <section className="panel">
              <div className="filters">
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Module suchen"
                    placeholder="Module suchen …"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Bereich filtern"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="">Alle Bereiche</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Semester filtern"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  <option value="">Alle Semester</option>
                  {semesters.map((s, i) => (
                    <option value={i} key={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Status filtern"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Alle Status</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className="text-button"
                  onClick={() => {
                    setSearch("");
                    setArea("");
                    setStatus("");
                    setSemester("");
                  }}
                >
                  Zurücksetzen
                </button>
              </div>
              <div className="list-caption">
                {visible.length} Module <span>ECTS · Status · Bearbeiten</span>
              </div>
              {moduleRows(visible)}
            </section>
          )}
          {page === "semesters" && (
            <>
              <div className="semester-tabs">
                {semesters.map((s, i) => (
                  <button
                    className={i === selectedSemester ? "selected" : ""}
                    key={s}
                    onClick={() => setSelectedSemester(i)}
                  >
                    <small>{i + 1}. SEMESTER</small>
                    <strong>{s}</strong>
                    <span>
                      {n(semesterStats(data.modules, i).workload)} ECTS
                      geplant
                    </span>
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <div>
                  <h2>{semesters[selectedSemester]} · Dein Semesterplan</h2>
                  <p>
                    Verschiebe Module über „Bearbeiten“ frei zwischen den
                    Semestern.
                  </p>
                </div>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={showOfficial}
                    onChange={(e) => setShowOfficial(e.target.checked)}
                  />
                  Empfehlung vergleichen
                </label>
              </div>
              <div className="mini-metrics">
                {Object.entries({
                  "Geplanter Arbeitsaufwand": semesterStats(data.modules, selectedSemester).workload,
                  "Verbindlich anrechenbar": semesterStats(
                    data.modules,
                    selectedSemester,
                  ).registered,
                  "Bestanden, anrechenbar": semesterStats(
                    data.modules,
                    selectedSemester,
                  ).earned,
                  "Unverbindlich geplant": semesterStats(
                    data.modules,
                    selectedSemester,
                  ).tentative,
                  "Planungsaufwand inkl. offener Zuordnung": semesterStats(
                    data.modules,
                    selectedSemester,
                  ).workload,
                  "Kursbelegung in ECTS (ohne Planbindung)": semesterStats(
                    data.modules,
                    selectedSemester,
                  ).registeredCourses,
                  "Offene Aufgaben": semesterStats(
                    data.modules,
                    selectedSemester,
                  ).tasks,
                }).map(([k, v]) => (
                  <div className="panel" key={k}>
                    <small>{k}</small>
                    <strong>{n(v)}</strong>
                  </div>
                ))}
              </div>
              {semesterStats(data.modules, selectedSemester).workload >
                30 && (
                <div className="notice">
                  Dein geplanter Arbeitsaufwand liegt über der Empfehlung von 30
                  ECTS. Auch Module mit offener Anrechnung verursachen
                  Arbeitsaufwand.
                </div>
              )}
              <section className="panel official">
                <h2>Geplanter Arbeitsaufwand nach Studienbereich</h2>
                <p>Diese Planung zählt jedes Modul einmal. Bestandene ECTS und die Anrechenbarkeit werden getrennt ausgewiesen.</p>
                {semesterStats(data.modules, selectedSemester).workload > semesterStats(data.modules, selectedSemester).registered && <p>{n(semesterStats(data.modules, selectedSemester).workload - semesterStats(data.modules, selectedSemester).registered)} geplante ECTS sind noch nicht in der verbindlich anrechenbaren Bereichsabdeckung enthalten (offene Zuordnung oder Bereichsgrenze).</p>}
                {areas.map(a => ({...a, planned: stats.unique.filter(m => m.semester === selectedSemester && m.area === a.id && binding(m)).reduce((sum,m) => sum + m.ects,0)})).filter(a => a.planned > 0).map(a => <div key={a.id}><span>{a.name}</span><strong>{n(a.planned)} ECTS</strong></div>)}
                {Array.from(new Set(stats.unique.filter(m => m.semester === selectedSemester && binding(m) && m.provider).map(m => m.provider!))).map(provider => <div key={provider}><span>Davon {provider}</span><strong>{n(stats.unique.filter(m => m.semester === selectedSemester && binding(m) && m.provider === provider).reduce((sum,m) => sum + m.ects,0))} ECTS</strong></div>)}
              </section>
              {data.profile?.notices?.filter(notice => notice.semester === selectedSemester).map((notice, i) => <div className="notice" key={i}>{notice.message} {notice.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} </a>)}</div>)}
              <section className="panel">
                {moduleRows(
                  data.modules.filter(
                    (m) => active(m) && m.semester === selectedSemester,
                  ),
                  true,
                )}
              </section>
              {showOfficial && (
                <section className="panel official">
                  <h2>Studienverlaufsplan · Empfehlung</h2>
                  <p>
                    Von dir hinterlegte Orientierung; keine Vorgabe für die
                    Reihenfolge deiner Module.
                  </p>
                  {official[selectedSemester].map(([name, ects]) => (
                    <div key={name}>
                      <span>{name}</span>
                      <strong>{ects} ECTS</strong>
                    </div>
                  ))}
                  <div>
                    <strong>Gesamt</strong>
                    <strong>30 ECTS</strong>
                  </div>
                </section>
              )}
              <section className="panel chart-panel">
                <h2>Studienbelastung im Vergleich</h2>
                <LoadChart modules={data.modules} />
              </section>
            </>
          )}
          {page === "planner" && (
            <Planner
              modules={data.modules}
              scenario={scenario}
              setScenario={setScenario}
              apply={(modules) => {
                commit(modules);
                setScenario(null);
                setToast("Szenario übernommen");
              }}
            />
          )}
          {page === "calendar" && (
            <CalendarView
              modules={data.modules}
              edit={(m) => setEditing(structuredClone(m))}
              toggleTask={(m, id) =>
                update({
                  ...m,
                  tasks: m.tasks.map((t) =>
                    t.id === id ? { ...t, done: !t.done } : t,
                  ),
                })
              }
            />
          )}
          {page === "grades" && <Grades modules={data.modules} />}
          <footer>
            <div>
              <ShieldCheck size={15} />
              <span>Privater Studienkompass · Cloud-Speicher</span>
            </div>
            <div className="footer-actions">
              <button onClick={exportData}>
                <ArrowDownToLine size={15} />
                JSON exportieren
              </button>
              <button onClick={() => fileRef.current?.click()}>
                <ArrowUpFromLine size={15} />
                JSON importieren
              </button>
              <button onClick={() => window.print()}>
                <Printer size={15} />
                Drucken / PDF
              </button>
            </div>
            <input
              ref={fileRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file)
                  try {
                    if (file.size > 10_000_000)
                      throw new Error("Die Datei ist größer als 10 MB.");
                    setImported(migrateData(parseData(await file.text())));
                  } catch (error) {
                    setWarning(
                      error instanceof Error
                        ? error.message
                        : "Import fehlgeschlagen",
                    );
                  }
                e.target.value = "";
              }}
            />
          </footer>
        </div>
      </main>
      <section className="print-report">
        <h1>Studienübersicht · Dein Masterstudium</h1>
        <p>
          Studienkompass · Stand{" "}
          {dateLabel(today())}
        </p>
        <h2>
          {n(stats.covered)} / 120 ECTS abgedeckt ({n(stats.progress)} %)
        </h2>
        <p>
          {n(stats.earned)} erworben · {n(stats.planned)} verbindlich ·{" "}
          {n(stats.missing)} offen · {n(stats.waiting)} Warteliste ·{" "}
          {n(stats.recognitionPending)} Anerkennung ausstehend ·{" "}
          {n(stats.allocationPending)} Zuordnung offen · {n(stats.excess)}{" "}
          überschüssig
        </p>
        <table>
          <thead>
            <tr>
              <th>Studienbereich</th>
              <th>Soll</th>
              <th>Erworben</th>
              <th>Verbindlich</th>
              <th>Offen</th>
            </tr>
          </thead>
          <tbody>
            {stats.byArea.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.target}</td>
                <td>{n(a.earned)}</td>
                <td>{n(a.planned)}</td>
                <td>{n(a.missing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {semesters.map((s, i) => (
          <div key={s}>
            <h2>{s}</h2>
            <table>
              <thead>
                <tr>
                  <th>Modul</th>
                  <th>ECTS</th>
                  <th>Status</th>
                  <th>Anrechnung</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.modules
                  .filter((m) => active(m) && m.semester === i)
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{n(m.ects)}</td>
                      <td>{m.status}</td>
                      <td>{m.credit}</td>
                      <td>{m.grade || "–"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
      {pending && <div className="modal-backdrop"><div className="dialog" role="dialog" aria-modal="true"><h2>{syncing ? "Synchronisierung läuft" : "Änderung nicht synchronisiert"}</h2><p>{pending.error || "Bitte warten …"}</p>{!syncing && <div className="dialog-actions"><button className="button" onClick={() => {const url=URL.createObjectURL(new Blob([serialize(pending.next)],{type:"application/json"})); const a=document.createElement("a"); a.href=url; a.download="ungesicherte-aenderungen.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)}}>Änderungen exportieren</button><button className="button" onClick={() => void transmit(pending.next)}>Erneut versuchen</button><button className="button" onClick={() => {if(window.confirm("Neu laden? Exportiere die ungesicherten Änderungen zuerst.")) location.reload()}}>Neu laden</button></div>}</div></div>}
      {editing && (
        <ModuleEditor
          key={editing.id}
          module={editing}
          close={() => setEditing(null)}
          save={update}
          remove={(id) => {
            commit(data.modules.filter((m) => m.id !== id));
            setEditing(null);
            setToast("Modul gelöscht");
          }}
        />
      )}
      {imported && (
        <div className="modal-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <h2 id="import-title">Backup importieren?</h2>
            <p>
              {imported.modules.length} Module ·{" "}
              {n(calculate(imported.modules).covered)} anrechenbare ECTS. Dieser
              Import ersetzt deinen aktuellen Datenbestand.
            </p>
            <p>Exportiere bei Bedarf zuerst deinen bisherigen Stand.</p>
            <div className="dialog-actions">
              <button className="button" onClick={exportData}>
                Aktuellen Stand exportieren
              </button>
              <button
                autoFocus
                className="button"
                onClick={() => setImported(null)}
              >
                Abbrechen
              </button>
              <button
                className="button primary"
                onClick={() => {
                  commit(imported.modules);
                  setImported(null);
                  setScenario(null);
                  setToast("Backup importiert");
                }}
              >
                Daten ersetzen
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={17} />
          {toast}
        </div>
      )}
    </div>
    </SemesterContext.Provider>
  );
}

function LoadChart({ modules }: { modules: Module[] }) {
  const semesters = useContext(SemesterContext);
  const chart = semesters.map((s, i) => ({
    name: s,
    Verbindlich: semesterStats(modules, i).registered,
    Bestanden: semesterStats(modules, i).earned,
    Geplant: semesterStats(modules, i).tentative,
    Arbeitsaufwand: semesterStats(modules, i).workload,
    Empfehlung: 30,
  }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chart}
          margin={{ top: 12, right: 12, left: -24, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Bestanden" stackId="actual" fill="#174d3d" />
          <Bar
            dataKey="Verbindlich"
            stackId="actual"
            fill="#3b8a70"
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="Geplant" fill="#89a8d5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Arbeitsaufwand" fill="#ba8b54" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Empfehlung" fill="#dce5df" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ModuleEditor({
  module,
  close,
  save,
  remove,
}: {
  module: Module;
  close: () => void;
  save: (m: Module) => void;
  remove: (id: string) => void;
}) {
  const semesters = useContext(SemesterContext);
  const [m, setM] = useState<Module>({
      ...module,
      planStatus: legacyPlan(module),
      lectureRegistration: module.lectureRegistration || "Unbekannt",
      exerciseRegistration: module.exerciseRegistration || "Unbekannt",
      examRegistration: module.examRegistration || "Unbekannt",
      recognition: module.recognition || "Nicht beantragt",
    }),
    [task, setTask] = useState(""),
    [deadline, setDeadline] = useState(""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = dialogRef.current;
    el?.querySelector<HTMLInputElement>("input")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && el) {
        const focus = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ),
        ).filter((x) => !x.hasAttribute("disabled"));
        const first = focus[0],
          last = focus.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [close]);
  function field<K extends keyof Module>(key: K, value: Module[K]) {
    setM({ ...m, [key]: value });
  }
  function checkedSave(value: Module) {
    try {
      const clean = {
        ...value,
        name: value.name.trim(),
        grade: value.grade.replace(",", "."),
      };
      parseData(
        serialize({
          version: 1,
          modules: [clean],
          updatedAt: new Date().toISOString(),
        }),
      );
      save(clean);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    checkedSave(m);
  }
  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="editor-heading">
          <div>
            <span className="eyebrow">DEIN STUDIENBAUSTEIN</span>
            <h2 id="editor-title">Modul bearbeiten</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Editor schließen"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="editor-body">
            <label>
              Modulname
              <input
                required
                maxLength={300}
                value={m.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                ECTS
                <input
                  type="number"
                  required
                  min="0.5"
                  max="120"
                  step="0.5"
                  value={m.ects}
                  onChange={(e) => field("ects", Number(e.target.value))}
                />
              </label>
              <label>
                Semester
                <select
                  aria-label="Semester"
                  value={m.semester}
                  onChange={(e) => field("semester", Number(e.target.value))}
                >
                  {semesters.map((s, i) => (
                    <option key={s} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Studienbereich
                <select
                  aria-label="Studienbereich"
                  value={m.area}
                  onChange={(e) =>
                    setM({
                      ...m,
                      area: e.target.value as Area,
                      credit: "Prüfung ausstehend",
                    })
                  }
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Anrechnungsstatus
                <select
                  aria-label="Anrechnungsstatus"
                  value={m.credit}
                  onChange={(e) =>
                    field("credit", e.target.value as Module["credit"])
                  }
                >
                  {credits.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <small>Gilt für die Zuordnung zum ausgewählten Bereich.</small>
              </label>
              <label>
                Modulstatus
                <select
                  aria-label="Modulstatus"
                  value={m.status}
                  onChange={(e) =>
                    field("status", e.target.value as Module["status"])
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Prüfungstermin
                <input
                  type="date"
                  value={m.exam}
                  onChange={(e) => field("exam", e.target.value)}
                />
              </label>
              <label>
                Erreichte Note
                <input
                  placeholder="z. B. 1,7"
                  value={m.grade}
                  onChange={(e) => field("grade", e.target.value)}
                />
                <small>1,0 bis 5,0; unabhängig vom Modulstatus.</small>
              </label>
              <label>
                Anrechnungsschlüssel
                <input
                  placeholder="Optional: gemeinsame Modul-ID"
                  value={m.creditKey}
                  onChange={(e) => field("creditKey", e.target.value)}
                />
                <small>
                  Für Vorlesung und Übung denselben Schlüssel verwenden.
                </small>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Modulcode
                <input
                  value={m.moduleCode || ""}
                  onChange={(e) => field("moduleCode", e.target.value)}
                />
              </label>
              <label>
                Hochschule / Anbieter
                <input value={m.provider || ""} onChange={(e) => field("provider", e.target.value)} />
              </label>
              <label>
                Persönliche Studienplanung
                <select
                  aria-label="Persönliche Studienplanung"
                  value={m.planStatus}
                  onChange={(e) =>
                    field("planStatus", e.target.value as Module["planStatus"])
                  }
                >
                  {plans.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Belegungssemester
                <select
                  aria-label="Belegungssemester"
                  value={m.registrationSemester ?? m.semester}
                  onChange={(e) =>
                    field("registrationSemester", Number(e.target.value))
                  }
                >
                  {semesters.map((s, i) => (
                    <option key={s} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vorlesungsbelegung
                <select
                  aria-label="Vorlesungsbelegung"
                  value={m.lectureRegistration}
                  onChange={(e) =>
                    field(
                      "lectureRegistration",
                      e.target.value as Module["lectureRegistration"],
                    )
                  }
                >
                  {registrations.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Übungsbelegung
                <select
                  aria-label="Übungsbelegung"
                  value={m.exerciseRegistration}
                  onChange={(e) =>
                    field(
                      "exerciseRegistration",
                      e.target.value as Module["exerciseRegistration"],
                    )
                  }
                >
                  {registrations.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Prüfungsanmeldung
                <select
                  aria-label="Prüfungsanmeldung"
                  value={m.examRegistration}
                  onChange={(e) =>
                    field(
                      "examRegistration",
                      e.target.value as Module["examRegistration"],
                    )
                  }
                >
                  {examRegistrations.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Anerkennung
                <select
                  aria-label="Anerkennung"
                  value={m.recognition}
                  onChange={(e) =>
                    field(
                      "recognition",
                      e.target.value as Module["recognition"],
                    )
                  }
                >
                  {recognitions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <small>
                  „Genehmigt“ ausschließlich nach tatsächlichem
                  Anerkennungsbescheid wählen.
                </small>
              </label>
            </div>
            <label>
              Anerkennungshinweise
              <textarea
                value={m.recognitionNotes || ""}
                onChange={(e) => field("recognitionNotes", e.target.value)}
              />
            </label>
            <label>
              Planungshinweise
              <textarea
                value={m.planningNotes || ""}
                onChange={(e) => field("planningNotes", e.target.value)}
              />
            </label>
            <label>
              Moodle- / Kurs-Link
              <input
                type="url"
                placeholder="https://…"
                value={m.link}
                onChange={(e) => field("link", e.target.value)}
              />
            </label>
            {/^https?:\/\//i.test(m.link) && (
              <a
                className="text-button"
                href={m.link}
                target="_blank"
                rel="noreferrer"
              >
                Kurs öffnen <ArrowUpRight size={14} />
              </a>
            )}
            <label>
              Modulbeschreibung
              <textarea
                rows={2}
                value={m.description}
                onChange={(e) => field("description", e.target.value)}
              />
            </label>
            <label>
              Notizen
              <textarea
                rows={3}
                placeholder="Alles, was du dir merken möchtest …"
                value={m.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </label>
            <section className="task-editor">
              <h3>
                Aufgaben{" "}
                <span>{m.tasks.filter((t) => !t.done).length} offen</span>
              </h3>
              {m.tasks.map((t) => (
                <div className="task-line" key={t.id}>
                  <input
                    type="checkbox"
                    aria-label={`${t.title} erledigt`}
                    checked={t.done}
                    onChange={() =>
                      field(
                        "tasks",
                        m.tasks.map((x) =>
                          x.id === t.id ? { ...x, done: !x.done } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Aufgabentitel"
                    required
                    value={t.title}
                    onChange={(e) =>
                      field(
                        "tasks",
                        m.tasks.map((x) =>
                          x.id === t.id ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Deadline"
                    type="date"
                    value={t.deadline}
                    onChange={(e) =>
                      field(
                        "tasks",
                        m.tasks.map((x) =>
                          x.id === t.id
                            ? { ...x, deadline: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Aufgabe löschen"
                    onClick={() =>
                      field(
                        "tasks",
                        m.tasks.filter((x) => x.id !== t.id),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <div className="task-line">
                <input
                  aria-label="Neue Aufgabe"
                  placeholder="Neue Aufgabe …"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                />
                <input
                  aria-label="Neue Deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <button
                  type="button"
                  className="button"
                  disabled={!task.trim()}
                  onClick={() => {
                    field("tasks", [
                      ...m.tasks,
                      {
                        id: crypto.randomUUID(),
                        title: task.trim(),
                        deadline,
                        done: false,
                      },
                    ]);
                    setTask("");
                    setDeadline("");
                  }}
                >
                  <Plus size={16} />
                  Hinzufügen
                </button>
              </div>
            </section>
            {error && (
              <div className="notice warning" role="alert">
                {error}
              </div>
            )}
            {deleting && (
              <div className="notice warning">
                Dieses Modul samt Notizen und Aufgaben endgültig löschen?{" "}
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => remove(m.id)}
                >
                  Ja, löschen
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setDeleting(false)}
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
          <div className="editor-footer">
            <div>
              <button
                type="button"
                className="icon-button danger"
                title="Modul löschen"
                aria-label="Modul löschen"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={18} />
              </button>
              <button
                type="button"
                className="button"
                onClick={() =>
                  checkedSave({
                    ...m,
                    archived: !m.archived,
                    status: m.archived ? "Geplant" : m.status,
                  })
                }
              >
                <Archive size={16} />
                {m.archived ? "Reaktivieren" : "Archivieren"}
              </button>
            </div>
            <div>
              <button type="button" className="button" onClick={close}>
                Abbrechen
              </button>
              <button className="button primary" type="submit">
                <Check size={16} />
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Planner({
  modules,
  scenario,
  setScenario,
  apply,
}: {
  modules: Module[];
  scenario: Module[] | null;
  setScenario: (m: Module[] | null) => void;
  apply: (m: Module[]) => void;
}) {
  const semesters = useContext(SemesterContext);
  const [extra, setExtra] = useState(15),
    [sem, setSem] = useState(1),
    [area, setArea] = useState<Area>("ie"),
    [confirm, setConfirm] = useState(false),
    [draft, setDraft] = useState<Module | null>(null),
    [recognitionScenario, setRecognitionScenario] = useState(false);
  const working = scenario ?? modules,
    result = calculate(working, { assumeRecognition: recognitionScenario }),
    baseline = calculate(modules);
  const chart = semesters.map((s, i) => ({
    name: s,
    Aktuell: calculate(modules.filter((m) => m.semester <= i)).covered,
    Szenario: calculate(
      working.filter((m) => m.semester <= i),
      { assumeRecognition: recognitionScenario },
    ).covered,
    Empfehlung: (i + 1) * 30,
  }));
  return (
    <>
      <section className="panel planner-controls">
        <div className="panel-heading">
          <div>
            <h2>
              <FlaskConical size={21} />
              Dein Planungsraum
            </h2>
            <p>
              {scenario
                ? "Szenario aktiv · Änderungen sind noch nicht übernommen."
                : "Starte mit deinem aktuellen Studienstand."}
            </p>
          </div>
          <span className="subtle-pill">Simulation</span>
        </div>
        <div className="scenario-add">
          <label>
            Zusätzliche ECTS
            <input
              type="number"
              min="0.5"
              max="120"
              step="0.5"
              value={extra}
              onChange={(e) => setExtra(Number(e.target.value))}
            />
          </label>
          <label>
            Studienbereich
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Semester
            <select
              value={sem}
              onChange={(e) => setSem(Number(e.target.value))}
            >
              {semesters.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            disabled={extra <= 0 || extra > 120}
            onClick={() =>
              setScenario([
                ...structuredClone(working),
                makeModule(
                  `Planungsbudget ${areas.find((a) => a.id === area)?.name} · ${semesters[sem]}`,
                  extra,
                  area,
                  "Fixplatz",
                  {
                    semester: sem,
                    notes:
                      "Persönliches Planungsbudget aus einem Szenario. Vor Übernahme als konkretes Modul benennen.",
                  },
                ),
              ])
            }
          >
            <Plus size={17} />
            Simulieren
          </button>
        </div>
        <div className="planner-buttons">
          <button
            className="button"
            onClick={() => setRecognitionScenario(!recognitionScenario)}
          >
            {recognitionScenario
              ? "Anerkennungssimulation ausschalten"
              : "Anerkennung simulieren"}
          </button>
          <button
            className="button"
            onClick={() =>
              setScenario(
                working.map((m) =>
                  binding(m)
                    ? { ...m, status: "Bestanden" }
                    : structuredClone(m),
                ),
              )
            }
          >
            Alle verbindlichen Module bestehen
          </button>
          <button
            className="text-button"
            onClick={() => {
              setScenario(null);
              setRecognitionScenario(false);
              setConfirm(false);
            }}
          >
            Szenario zurücksetzen
          </button>
        </div>
      </section>
      <div className="mini-metrics">
        <div className="panel">
          <small>Erwartet abgedeckt</small>
          <strong>
            {n(result.covered)} <em>/ 120 ECTS</em>
          </strong>
        </div>
        <div className="panel">
          <small>Fortschritt</small>
          <strong>{n(result.progress)} %</strong>
        </div>
        <div className="panel">
          <small>Änderung zum Ist-Stand</small>
          <strong>
            {result.covered - baseline.covered >= 0 ? "+" : ""}
            {n(result.covered - baseline.covered)} <em>ECTS</em>
          </strong>
        </div>
        <div className="panel">
          <small>Noch einzuplanen</small>
          <strong>
            {n(result.missing)} <em>ECTS</em>
          </strong>
        </div>
      </div>
      <div className="bottom-grid">
        <section className="panel chart-panel">
          <h2>Erwarteter Abschlussfortschritt</h2>
          <p>
            Kumulierte anrechenbare ECTS pro Semester, inklusive angenommener
            Fixplätze.
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chart}
                margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 5" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 120]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="Aktuell" stroke="#8d9e97" strokeWidth={2} />
                <Line dataKey="Szenario" stroke="#26856b" strokeWidth={3} />
                <Line
                  dataKey="Empfehlung"
                  stroke="#7096c8"
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel gap-list">
          <h2>Was fehlt danach noch?</h2>
          {result.byArea.map((a) => (
            <div key={a.id}>
              <span>{a.name}</span>
              <strong>{n(a.missing)} ECTS</strong>
            </div>
          ))}
          {result.excess > 0 && (
            <p className="pending-text">
              {n(result.excess)} überschüssige ECTS werden nicht angerechnet.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Module im Szenario</h2>
            <p>
              Status, Semester und Anrechnung lassen sich unabhängig bearbeiten.
            </p>
          </div>
        </div>
        {working.filter(active).map((m) => (
          <div className="scenario-row" key={m.id}>
            <button
              className="module-title"
              onClick={() => setDraft(structuredClone(m))}
            >
              <strong>{m.name}</strong>
              <small>
                {n(m.ects)} ECTS · {m.credit}
              </small>
            </button>
            <div className="scenario-state">
              <select
                aria-label={`${m.name} Szenariostatus`}
                value={m.status}
                onChange={(e) =>
                  setScenario(
                    working.map((x) =>
                      x.id === m.id
                        ? { ...x, status: e.target.value as Module["status"] }
                        : x,
                    ),
                  )
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label={`${m.name} Szenarioplanung`}
                value={legacyPlan(m)}
                onChange={(e) =>
                  setScenario(
                    working.map((x) =>
                      x.id === m.id
                        ? {
                            ...x,
                            planStatus: e.target.value as Module["planStatus"],
                          }
                        : x,
                    ),
                  )
                }
              >
                {plans.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <select
              aria-label={`${m.name} Szenariosemester`}
              value={m.semester}
              onChange={(e) =>
                setScenario(
                  working.map((x) =>
                    x.id === m.id
                      ? { ...x, semester: Number(e.target.value) }
                      : x,
                  ),
                )
              }
            >
              {semesters.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label={`${m.name} im Szenario bearbeiten`}
              onClick={() => setDraft(structuredClone(m))}
            >
              <Settings2 size={17} />
            </button>
          </div>
        ))}
      </section>
      {recognitionScenario && (
        <div className="notice">
          Hypothetische Genehmigung, kein Bescheid. Diese Anerkennungssimulation
          wird nicht im echten Studienstand gespeichert und lässt sich nicht als
          Anerkennungsentscheidung übernehmen.
        </div>
      )}
      <div className="scenario-apply">
        <p>
          Planungsbudgets dienen nur der Simulation. Vor der Übernahme bitte
          durch konkrete Modulnamen ersetzen.
        </p>
        <button
          className="button primary"
          disabled={!scenario || recognitionScenario}
          onClick={() => setConfirm(true)}
        >
          Szenario übernehmen
        </button>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scenario-title"
          >
            <h2 id="scenario-title">Szenario als echten Stand übernehmen?</h2>
            {working.some((m) => m.name.startsWith("Planungsbudget ")) ? (
              <>
                <p>
                  Bitte benenne die Planungsbudgets zuerst über den Editor als
                  konkrete Module. Anschließend ist die Übernahme möglich.
                </p>
                <button className="button" onClick={() => setConfirm(false)}>
                  Zurück zum Szenario
                </button>
              </>
            ) : (
              <>
                <p>
                  Alle simulierten Planungsänderungen werden gespeichert, auch
                  Statuswechsel zu „Bestanden“. Prüfe, dass sie deinem
                  tatsächlichen Studienstand entsprechen.
                </p>
                <div className="dialog-actions">
                  <button className="button" onClick={() => setConfirm(false)}>
                    Abbrechen
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      apply(structuredClone(working));
                      setConfirm(false);
                    }}
                  >
                    Änderungen übernehmen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {draft && (
        <ModuleEditor
          module={draft}
          close={() => setDraft(null)}
          save={(m) => {
            setScenario(working.map((x) => (x.id === m.id ? m : x)));
            setDraft(null);
          }}
          remove={(id) => {
            setScenario(working.filter((x) => x.id !== id));
            setDraft(null);
          }}
        />
      )}
    </>
  );
}

function CalendarView({
  modules,
  edit,
  toggleTask,
}: {
  modules: Module[];
  edit: (m: Module) => void;
  toggleTask: (m: Module, id: string) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const records = modules.filter(active),
    exams = records
      .filter((m) => m.exam)
      .sort((a, b) => a.exam.localeCompare(b.exam)),
    tasks = records
      .flatMap((m) => m.tasks.map((t) => ({ ...t, module: m })))
      .sort((a, b) =>
        (a.deadline || "9999").localeCompare(b.deadline || "9999"),
      );
  const events = [
    ...exams.map((m) => ({
      date: m.exam,
      title: `Prüfung: ${m.name}`,
      module: m,
    })),
    ...tasks
      .filter((t) => t.deadline && !t.done)
      .map((t) => ({ date: t.deadline, title: t.title, module: t.module })),
  ];
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    offset = (month.getDay() + 6) % 7;
  return (
    <>
      <section className="panel calendar-panel">
        <div className="panel-heading">
          <h2>
            {month.toLocaleDateString("de-DE", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="calendar-actions">
            <button
              className="icon-button"
              aria-label="Vorheriger Monat"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="text-button"
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              Heute
            </button>
            <button
              className="icon-button"
              aria-label="Nächster Monat"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div className="calendar-day muted-day" key={`blank${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            return (
              <div
                className={`calendar-day ${key === today() ? "today" : ""}`}
                key={key}
              >
                <span>{i + 1}</span>
                {events
                  .filter((e) => e.date === key)
                  .map((e, j) => (
                    <button
                      title={e.title}
                      key={j}
                      onClick={() => edit(e.module)}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </section>
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Prüfungsübersicht</h2>
            <span className="subtle-pill">{exams.length} Termine</span>
          </div>
          {exams.length ? (
            exams.map((m) => (
              <button className="event-mini" key={m.id} onClick={() => edit(m)}>
                <span>{dateLabel(m.exam)}</span>
                <strong>{m.name}</strong>
                <small>{m.status}</small>
              </button>
            ))
          ) : (
            <div className="empty small">
              <CalendarDays />
              <p>Prüfungstermine trägst du im Modul-Editor ein.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Deine Aufgaben</h2>
            <span className="subtle-pill">
              {tasks.filter((t) => !t.done).length} offen
            </span>
          </div>
          {tasks.length ? (
            tasks.map((t) => (
              <div className={`todo-row ${t.done ? "done" : ""}`} key={t.id}>
                <input
                  type="checkbox"
                  checked={t.done}
                  aria-label={`${t.title} erledigt`}
                  onChange={() => toggleTask(t.module, t.id)}
                />
                <button onClick={() => edit(t.module)}>
                  <strong>{t.title}</strong>
                  <small>{t.module.name}</small>
                </button>
                <span
                  className={
                    t.deadline && t.deadline < today() && !t.done
                      ? "danger"
                      : ""
                  }
                >
                  {t.deadline ? dateLabel(t.deadline) : "Ohne Deadline"}
                </span>
              </div>
            ))
          ) : (
            <div className="empty small">
              <ClipboardList />
              <p>Ergänze Aufgaben mit optionaler Deadline in deinen Modulen.</p>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Termine & Aufgaben ergänzen</h2>
          <p>Wähle ein Modul, um es zu bearbeiten.</p>
        </div>
        <div className="module-picker">
          {records.map((m) => (
            <button className="button" key={m.id} onClick={() => edit(m)}>
              {m.name}
              <Plus size={15} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Grades({ modules }: { modules: Module[] }) {
  const semesters = useContext(SemesterContext);
  const stats = calculate(modules),
    graded = stats.unique.filter(
      (m) =>
        m.status === "Bestanden" &&
        m.grade &&
        ["Bestätigt", "Nicht erforderlich"].includes(m.credit),
    ),
    weight = graded.reduce((s, m) => s + m.ects, 0),
    avg = weight
      ? graded.reduce(
          (s, m) => s + Number(m.grade.replace(",", ".")) * m.ects,
          0,
        ) / weight
      : null;
  return (
    <>
      <div className="mini-metrics">
        <div className="panel">
          <small>ECTS-gewichteter Notenschnitt</small>
          <strong>{avg === null ? "–" : n(avg)}</strong>
        </div>
        <div className="panel">
          <small>Benotete bestandene Module</small>
          <strong>{graded.length}</strong>
        </div>
        <div className="panel">
          <small>Tatsächlich erworbene ECTS</small>
          <strong>{n(stats.earned)}</strong>
        </div>
        <div className="panel">
          <small>Überschüssige ECTS</small>
          <strong>{n(stats.excess)}</strong>
        </div>
      </div>
      <div className="notice">
        Persönliche Orientierung: Der Schnitt umfasst alle eindeutig erfassten,
        bestandenen und anrechenbaren Module mit Note, einschließlich
        überschüssiger Credits. Er ist keine verbindliche Abschlussnote nach
        Prüfungsordnung.
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Notenübersicht</h2>
        </div>
        {modules.filter((m) => active(m) && m.grade).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Modul</th>
                  <th>Semester</th>
                  <th>ECTS</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {modules
                  .filter((m) => active(m) && m.grade)
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{semesters[m.semester]}</td>
                      <td>{n(m.ects)}</td>
                      <td>{m.status}</td>
                      <td>
                        <strong>{m.grade}</strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <GraduationCap size={36} />
            <h3>Deine Erfolge kommen noch.</h3>
            <p>
              Hinterlege eine erreichte Note im Modul-Editor. Zum Start ist
              keine Prüfung bestanden.
            </p>
          </div>
        )}
      </section>
      <section className="panel chart-panel">
        <h2>Deine Studienbelastung</h2>
        <LoadChart modules={modules} />
      </section>
    </>
  );
}
