"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  formatTimer,
  getCycleWeek,
  getProgramDayIndex,
  getProgramWeekStart,
  parseDateKey,
  toLocalDateKey,
} from "../lib/workout-utils.mjs";
import {
  demoFor,
  FINISH,
  PROGRAM_START,
  scheduleVersion,
  STORAGE_KEY,
  unitFor,
  WARM_UP,
  weekGuidance,
  workoutDays,
  type Exercise,
} from "./workout-data";

type SetLog = { kg: string; reps: string; done: boolean };
type SessionLog = {
  day: number;
  completed: boolean;
  notes: string;
  sets: Record<string, SetLog[]>;
};
type Store = {
  version: 1;
  scheduleVersion: number;
  programStart: string;
  logs: Record<string, SessionLog>;
};
type View = "today" | "plan" | "history";
const MAX_SETS = 6;
const blankSet = (): SetLog => ({ kg: "", reps: "", done: false });
const freshStore = (): Store => ({
  version: 1,
  scheduleVersion,
  programStart: PROGRAM_START,
  logs: {},
});
const weekday = new Intl.DateTimeFormat("en", { weekday: "short" });
const fullDate = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const shortDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});
const pdfText = (text: string) =>
  text
    .replace(/[–—−]/g, "-")
    .replace(/×/g, "x")
    .replace(/·/g, "/")
    .replace(/[’‘]/g, "'");

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    barbell: (
      <>
        <path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    play: <path d="m9 5 11 7-11 7Z" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18" />
      </>
    ),
    chart: (
      <>
        <path d="M4 4v16h17M8 15l4-5 4 2 5-7" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    reset: (
      <>
        <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.barbell}
    </svg>
  );
}

function restoreStore(raw: string | null): Store {
  if (!raw) return freshStore();
  const value = JSON.parse(raw) as Store;
  if (
    value.version !== 1 ||
    !value.logs ||
    typeof value.logs !== "object" ||
    Array.isArray(value.logs)
  )
    throw new Error("Invalid workout data");
  parseDateKey(value.programStart);
  // A new schedule moves the default start day; older saves keep their logs
  // but adopt the new start date so sessions land on the intended weekdays.
  const sameSchedule = value.scheduleVersion === scheduleVersion;
  const safe: Store = {
    version: 1,
    scheduleVersion,
    programStart: sameSchedule ? value.programStart : PROGRAM_START,
    logs: {},
  };
  for (const [date, log] of Object.entries(value.logs)) {
    try {
      parseDateKey(date);
    } catch {
      continue;
    }
    if (!log || !Number.isInteger(log.day) || log.day < 1 || log.day > 7)
      continue;
    const sets: Record<string, SetLog[]> = {};
    for (const [id, rows] of Object.entries(log.sets ?? {})) {
      if (!Array.isArray(rows)) continue;
      sets[id] = rows
        .slice(0, MAX_SETS)
        .map((row) => ({
          kg: typeof row?.kg === "string" ? row.kg.slice(0, 8) : "",
          reps: typeof row?.reps === "string" ? row.reps.slice(0, 4) : "",
          done: row?.done === true,
        }));
    }
    safe.logs[date] = {
      day: log.day,
      completed: log.completed === true,
      notes: typeof log.notes === "string" ? log.notes.slice(0, 2000) : "",
      sets,
    };
  }
  return safe;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function Home() {
  const [store, setStore] = useState<Store>(freshStore);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(PROGRAM_START);
  const [view, setView] = useState<View>("today");
  const [saveStatus, setSaveStatus] = useState("Saved on this device");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [timerDuration, setTimerDuration] = useState(120);
  const [running, setRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const deadline = useRef<number | null>(null);
  const sessionRef = useRef<HTMLElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const storageWritable = useRef(true);

  useEffect(() => {
    let initial = freshStore();
    try {
      initial = restoreStore(localStorage.getItem(STORAGE_KEY));
    } catch {
      storageWritable.current = false;
      setSaveStatus(
        "Saved data could not be read. Export it before making changes.",
      );
    }
    setStore(initial);
    setSelectedDate(
      toLocalDateKey(new Date()) < initial.programStart
        ? initial.programStart
        : toLocalDateKey(new Date()),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !storageWritable.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      setSaveStatus("Saved on this device");
    } catch {
      setSaveStatus("Could not save. Export a backup before leaving.");
    }
  }, [store, loaded]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil(((deadline.current ?? Date.now()) - Date.now()) / 1000),
      );
      setTimerSeconds(seconds);
      if (seconds === 0) {
        setRunning(false);
        setTimerFinished(true);
        deadline.current = null;
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  const plannedIndex = getProgramDayIndex(store.programStart, selectedDate) - 1;
  const session = store.logs[selectedDate];
  const day = workoutDays[(session?.day ?? plannedIndex + 1) - 1];
  const weekStart = getProgramWeekStart(store.programStart, selectedDate);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const week = getCycleWeek(store.programStart, selectedDate);
  const guidance = weekGuidance[week - 1];
  const history = Object.entries(store.logs)
    .filter(([, log]) => log.completed && workoutDays[log.day - 1].strength)
    .sort(([a], [b]) => b.localeCompare(a));
  const weekCompleted = dates.filter(
    (date) =>
      store.logs[date]?.completed &&
      workoutDays[store.logs[date].day - 1]?.strength,
  ).length;
  const rowsFor = (exercise: Exercise) =>
    Array.from(
      { length: exercise.sets },
      (_, index) => session?.sets[exercise.id]?.[index] ?? blankSet(),
    );
  const totalSets = day.exercises.reduce(
    (sum, exercise) => sum + exercise.sets,
    0,
  );
  const doneSets = day.exercises.reduce(
    (sum, exercise) => sum + rowsFor(exercise).filter((row) => row.done).length,
    0,
  );
  const completedExercises = day.exercises.filter((exercise) =>
    rowsFor(exercise).every((row) => row.done),
  ).length;
  const progress = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;

  function changeSession(updater: (log: SessionLog) => SessionLog) {
    setStore((current) => {
      const log = current.logs[selectedDate] ?? {
        day: day.day,
        completed: false,
        notes: "",
        sets: {},
      };
      return {
        ...current,
        logs: { ...current.logs, [selectedDate]: updater(log) },
      };
    });
  }
  function updateSet(
    exercise: Exercise,
    rowIndex: number,
    patch: Partial<SetLog>,
  ) {
    changeSession((log) => {
      const rows = Array.from(
        { length: exercise.sets },
        (_, index) => log.sets[exercise.id]?.[index] ?? blankSet(),
      );
      rows[rowIndex] = { ...rows[rowIndex], ...patch };
      return { ...log, sets: { ...log.sets, [exercise.id]: rows } };
    });
  }
  function startTimer(seconds: number) {
    setTimerDuration(seconds);
    setTimerSeconds(seconds);
    setTimerFinished(false);
    deadline.current = Date.now() + seconds * 1000;
    setRunning(true);
  }
  function pauseTimer() {
    if (running) {
      setRunning(false);
      deadline.current = null;
    } else {
      deadline.current = Date.now() + (timerSeconds || timerDuration) * 1000;
      setTimerSeconds(timerSeconds || timerDuration);
      setTimerFinished(false);
      setRunning(true);
    }
  }
  function chooseDate(date: string) {
    setSelectedDate(date);
    setView("today");
    setNotice("");
  }
  function previousFor(id: string) {
    const previous = Object.entries(store.logs)
      .filter(
        ([date, log]) =>
          date < selectedDate &&
          log.sets[id]?.some((row) => row.kg || row.reps),
      )
      .sort(([a], [b]) => b.localeCompare(a))[0];
    if (!previous) return null;
    const row = previous[1].sets[id].find((row) => row.kg || row.reps)!;
    return `${shortDate.format(parseDateKey(previous[0]))}: ${row.kg || "BW"}${row.kg ? " kg" : ""} × ${row.reps || "—"}`;
  }
  function backup() {
    saveBlob(
      new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }),
      `workingym-backup-${toLocalDateKey(new Date())}.json`,
    );
    setNotice("Backup downloaded. Keep it to restore your training history.");
  }
  async function restore(file: File) {
    try {
      const imported = restoreStore(await file.text());
      setStore((current) => ({
        ...current,
        logs: { ...imported.logs, ...current.logs },
      }));
      storageWritable.current = true;
      setNotice(
        "Backup imported. Existing sessions were kept when dates overlapped.",
      );
    } catch {
      setNotice(
        "That file is not a valid WorkInGYM backup. Your current data is unchanged.",
      );
    }
  }
  async function downloadImage() {
    if (!sessionRef.current || busy) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(sessionRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.noExport === "true"),
      });
      if (!blob) throw new Error("Image unavailable");
      saveBlob(
        blob,
        `workingym-${day.letter.toLowerCase()}-${selectedDate}.png`,
      );
      setNotice("Session image downloaded.");
    } catch {
      setNotice("Could not create the image. Your workout is still saved.");
    } finally {
      setBusy(false);
    }
  }
  async function downloadPlan() {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      const BOTTOM = 288;
      const writeBlock = (label: string, text: string, y: number) => {
        const lines = pdf.splitTextToSize(pdfText(text), 175);
        if (y + 6 + lines.length * 4 > BOTTOM) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(label, 17, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(lines, 17, y + 5);
        return y + 9 + lines.length * 4;
      };
      workoutDays
        .filter((item) => item.strength)
        .forEach((item, sessionIndex) => {
          if (sessionIndex) pdf.addPage();
          pdf.setFillColor(29, 57, 46);
          pdf.rect(0, 0, 210, 46, "F");
          pdf.setTextColor(223, 247, 166);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text("WORKINGYM / TRAINING PLAN V3", 17, 16);
          pdf.setFontSize(24);
          pdf.setTextColor(255, 255, 255);
          pdf.text(pdfText(`Session ${item.letter}: ${item.title}`), 17, 33);
          pdf.setTextColor(45, 57, 49);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.text(
            pdfText(
              `${item.duration} / stop each set with 1-2 reps left / Pair = alternate back-to-back`,
            ),
            17,
            57,
          );
          let y = writeBlock("Warm-up", WARM_UP, 64);
          for (const [i, exercise] of item.exercises.entries()) {
            const lines = pdf.splitTextToSize(pdfText(exercise.cue), 175);
            const height = 16 + lines.length * 3.4;
            if (y + height > BOTTOM) {
              pdf.addPage();
              y = 20;
            }
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10.5);
            pdf.text(pdfText(`${i + 1}. ${exercise.name}`), 17, y);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.text(
              pdfText(
                `${exercise.sets} sets x ${exercise.reps} ${unitFor(exercise)}${exercise.perSide ? " / side" : ""} / Rest ${exercise.rest}s`,
              ),
              17,
              y + 4.5,
            );
            pdf.text(lines, 17, y + 9);
            const demo = demoFor(exercise.id);
            if (demo) {
              pdf.setTextColor(48, 104, 69);
              pdf.textWithLink(
                "Watch exercise demo",
                17,
                y + 10.5 + lines.length * 3.4,
                { url: demo.url },
              );
              pdf.setTextColor(45, 57, 49);
            }
            y += height;
          }
          writeBlock("Finish", FINISH, y + 2);
        });
      pdf.save(`workingym-plan-v3.pdf`);
      setNotice(
        "Your three-session plan PDF is downloaded, with clickable demonstration links.",
      );
    } catch {
      setNotice("Could not create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a
          href="#top"
          className="brand"
          onClick={() => setView("today")}
          aria-label="WorkInGYM home"
        >
          <span className="brand-icon">
            <Icon name="barbell" size={26} />
          </span>
          <span>
            WorkIn<span className="brand-gym">GYM</span>
            <small>YOUR DAILY STRONGER</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(["today", "plan", "history"] as View[]).map((item) => (
            <button
              key={item}
              type="button"
              className={view === item ? "active" : ""}
              aria-current={view === item ? "page" : undefined}
              onClick={() => setView(item)}
            >
              {item === "today"
                ? "Today"
                : item === "plan"
                  ? "The plan"
                  : "History"}
            </button>
          ))}
        </nav>
        <span className="device-status">
          <span />
          {loaded ? "Your space. Your pace." : "Getting ready…"}
        </span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="little-line" />
            TRAINING PLAN V3 · LEGS FIRST
          </span>
          <h1>
            A little stronger.
            <br />
            <span>Every session.</span>
          </h1>
          <p>
            Three full-body strength days built from your scan: legs first,
            then posture, back width and upper chest.
            <br className="desktop-break" /> Plus 120 minutes of cardio a week
            for your heart.
          </p>
          <div className="hero-tags">
            <span>
              <Icon name="calendar" size={15} />{" "}
              {workoutDays
                .filter((item) => item.strength)
                .map((item) =>
                  weekday.format(
                    parseDateKey(addDays(store.programStart, item.day - 1)),
                  ),
                )
                .join(" · ")}
            </span>
            <span>
              <Icon name="clock" size={15} /> 65–75 minutes
            </span>
            <span>Full body · A / B / C</span>
          </div>
        </div>
        <div className="block-card">
          <div className="block-card-top">
            <span>YOUR TRAINING BLOCK</span>
            <span className="live-dot" />
          </div>
          <div className="block-week">
            0{week}
            <span>/ 06</span>
          </div>
          <p>{guidance.label}</p>
          <div className="block-bars" aria-label={`Week ${week} of six`}>
            {weekGuidance.map((item) => (
              <span
                key={item.week}
                className={item.week <= week ? "filled" : ""}
              />
            ))}
          </div>
          <div className="block-bottom">
            <span>
              <strong>
                {weekCompleted}
                <em>/3</em>
              </strong>
              sessions this week
            </span>
            <span>
              <strong>{history.length}</strong>sessions completed
            </span>
          </div>
        </div>
      </section>

      {view === "today" && (
        <>
          <section className="week-section" aria-label="Workout calendar">
            <div className="section-kicker">
              <span>
                YOUR WEEK{" "}
                <b>
                  {shortDate.format(parseDateKey(weekStart))} –{" "}
                  {shortDate.format(parseDateKey(addDays(weekStart, 6)))}
                </b>
              </span>
              <button
                type="button"
                onClick={() =>
                  chooseDate(
                    toLocalDateKey(new Date()) < store.programStart
                      ? store.programStart
                      : toLocalDateKey(new Date()),
                  )
                }
              >
                Back to today <Icon name="arrow" size={14} />
              </button>
            </div>
            <div className="day-picker">
              {dates.map((date) => {
                const scheduled =
                  workoutDays[getProgramDayIndex(store.programStart, date) - 1];
                const isDone = store.logs[date]?.completed;
                return (
                  <button
                    key={date}
                    type="button"
                    className={`day-pill ${selectedDate === date ? "selected" : ""} ${scheduled.strength ? "strength-day" : ""}`}
                    onClick={() => chooseDate(date)}
                    aria-pressed={selectedDate === date}
                    aria-label={`${fullDate.format(parseDateKey(date))}: ${scheduled.title}`}
                  >
                    <span>{weekday.format(parseDateKey(date))}</span>
                    <strong>{parseDateKey(date).getDate()}</strong>
                    <small>
                      {isDone ? <Icon name="check" size={14} /> : scheduled.tag}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="training-grid">
            <div>
              <article className="session-panel" ref={sessionRef}>
                <div className="session-header">
                  <div>
                    <div className="date-nav">
                      <button
                        type="button"
                        aria-label="Previous day"
                        disabled={selectedDate <= store.programStart}
                        onClick={() => chooseDate(addDays(selectedDate, -1))}
                      >
                        ←
                      </button>
                      <span>{fullDate.format(parseDateKey(selectedDate))}</span>
                      <button
                        type="button"
                        aria-label="Next day"
                        onClick={() => chooseDate(addDays(selectedDate, 1))}
                      >
                        →
                      </button>
                    </div>
                    <div className="session-title">
                      <span
                        className={`session-letter ${!day.strength ? "rest-letter" : ""}`}
                      >
                        {day.strength ? (
                          day.letter
                        ) : (
                          <Icon name="reset" size={26} />
                        )}
                      </span>
                      <div>
                        <span className="eyebrow">
                          {day.strength
                            ? "FULL-BODY STRENGTH"
                            : "RECOVERY IS PART OF THE PLAN"}
                        </span>
                        <h2>{day.title}</h2>
                      </div>
                    </div>
                    <p className="session-description">{day.summary}</p>
                  </div>
                  {day.strength && (
                    <div className="session-count">
                      <strong>
                        {completedExercises}
                        <span>/{day.exercises.length}</span>
                      </strong>
                      <small>exercises done</small>
                    </div>
                  )}
                </div>
                <div className="session-meta">
                  <span>
                    <Icon name="clock" size={15} />
                    {day.duration}
                  </span>
                  {day.strength && (
                    <>
                      <span>1–2 reps left in the tank</span>
                      <span>
                        {doneSets}/{totalSets} sets logged
                      </span>
                    </>
                  )}
                </div>
                {day.strength && (
                  <div className="session-progress">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                )}
                {day.strength ? (
                  <>
                    <details className="warmup">
                      <summary>
                        <span>
                          <span className="warmup-icon">↗</span>First, a little
                          warm-up
                        </span>
                        <small>
                          5 MIN <b>+</b>
                        </small>
                      </summary>
                      <p>{WARM_UP}</p>
                    </details>
                    <div className="logging-note">
                      Log one dumbbell’s weight, the machine’s displayed weight,
                      or 0 for body weight. For each-side exercises, finish both
                      sides before checking a set.
                    </div>
                    <div className="exercise-list">
                      {day.exercises.map((exercise, i) => {
                        const rows = rowsFor(exercise);
                        const demo = demoFor(exercise.id);
                        const previous = previousFor(exercise.id);
                        const done = rows.every((row) => row.done);
                        return (
                          <article
                            key={exercise.id}
                            className={`exercise-card ${done ? "exercise-done" : ""}`}
                          >
                            <div className="exercise-top">
                              <span className="exercise-number">
                                {done ? (
                                  <Icon name="check" size={19} />
                                ) : (
                                  String(i + 1).padStart(2, "0")
                                )}
                              </span>
                              <div className="exercise-name">
                                <span className="muscle-group">
                                  {exercise.group}
                                </span>
                                <h3>{exercise.name}</h3>
                                <span className="prescription">
                                  {exercise.sets} sets <i>×</i> {exercise.reps}{" "}
                                  {unitFor(exercise)}
                                  {exercise.perSide ? " / side" : ""}
                                </span>
                              </div>
                              {demo && (
                                <a
                                  className="demo-button"
                                  href={demo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Watch ${exercise.name} demonstration`}
                                >
                                  <Icon name="play" size={15} />
                                  <span>
                                    {demo.durationSeconds
                                      ? `${demo.durationSeconds}s demo`
                                      : "Watch demo"}
                                  </span>
                                </a>
                              )}
                            </div>
                            <p className="exercise-cue">{exercise.cue}</p>
                            {demo?.note && (
                              <p className="variant-note">
                                Demo note: {demo.note}
                              </p>
                            )}
                            <div className="set-table">
                              <div className="set-labels">
                                <span>SET</span>
                                <span>WEIGHT · KG</span>
                                <span>
                                  {exercise.timed
                                    ? exercise.perSide
                                      ? "SEC / SIDE"
                                      : "SECONDS"
                                    : exercise.distance
                                      ? "METRES"
                                      : exercise.perSide
                                        ? "REPS / SIDE"
                                        : "REPS"}
                                </span>
                                <span>DONE</span>
                              </div>
                              {rows.map((row, rowIndex) => (
                                <div
                                  key={rowIndex}
                                  className={`set-row ${row.done ? "set-done" : ""}`}
                                >
                                  <span className="set-index">
                                    {rowIndex + 1}
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    max="999"
                                    step="0.5"
                                    placeholder="—"
                                    aria-label={`${exercise.name} set ${rowIndex + 1} weight in kilograms`}
                                    value={row.kg}
                                    disabled={!loaded}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (
                                        value === "" ||
                                        (Number(value) >= 0 &&
                                          Number(value) <= 999)
                                      )
                                        updateSet(exercise, rowIndex, {
                                          kg: value,
                                        });
                                    }}
                                  />
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    max="999"
                                    step="1"
                                    placeholder={exercise.reps.split("–")[0]}
                                    aria-label={`${exercise.name} set ${rowIndex + 1} ${exercise.timed ? "seconds" : exercise.distance ? "metres" : "repetitions"}`}
                                    value={row.reps}
                                    disabled={!loaded}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (
                                        value === "" ||
                                        (Number.isInteger(Number(value)) &&
                                          Number(value) >= 0 &&
                                          Number(value) <= 999)
                                      )
                                        updateSet(exercise, rowIndex, {
                                          reps: value,
                                        });
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="set-check"
                                    disabled={!loaded}
                                    aria-label={`${row.done ? "Uncheck" : "Complete"} ${exercise.name} set ${rowIndex + 1}`}
                                    aria-pressed={row.done}
                                    onClick={() =>
                                      updateSet(exercise, rowIndex, {
                                        done: !row.done,
                                      })
                                    }
                                  >
                                    <Icon name="check" size={18} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="exercise-bottom">
                              <span>
                                {previous
                                  ? `Last time · ${previous}`
                                  : "Your first entry starts here"}
                              </span>
                              <button
                                type="button"
                                className="rest-link"
                                onClick={() => startTimer(exercise.rest)}
                              >
                                <Icon name="clock" size={14} />
                                Rest {exercise.rest}s
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <details className="warmup">
                      <summary>
                        <span>
                          <span className="warmup-icon">↘</span>Finish with
                          two stretches
                        </span>
                        <small>
                          3 MIN <b>+</b>
                        </small>
                      </summary>
                      <p>{FINISH}</p>
                    </details>
                  </>
                ) : (
                  <div className="recovery-content">
                    <span className="recovery-art">
                      <Icon name="reset" size={54} />
                    </span>
                    <h3>Make room for the next good session.</h3>
                    <p>{day.summary}</p>
                    <div>
                      <span>Move comfortably</span>
                      <span>Eat normally</span>
                      <span>Prioritise sleep</span>
                    </div>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        chooseDate(
                          addDays(
                            selectedDate,
                            day.day === 2 || day.day === 4 || day.day === 7
                              ? 1
                              : 2,
                          ),
                        )
                      }
                    >
                      See your next strength session{" "}
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                )}
                <div className="session-notes">
                  <label htmlFor="session-notes">
                    A note for next time <span>OPTIONAL</span>
                  </label>
                  <textarea
                    id="session-notes"
                    rows={3}
                    maxLength={2000}
                    placeholder="How did it feel? Machine settings, energy, anything to remember…"
                    value={session?.notes ?? ""}
                    disabled={!loaded}
                    onChange={(event) =>
                      changeSession((log) => ({
                        ...log,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="session-footer" data-no-export="true">
                  <button
                    type="button"
                    className={`primary-button ${session?.completed ? "completed-button" : ""}`}
                    disabled={!loaded}
                    onClick={() =>
                      changeSession((log) => ({
                        ...log,
                        completed: !log.completed,
                      }))
                    }
                  >
                    <Icon
                      name={session?.completed ? "check" : "arrow"}
                      size={18}
                    />
                    {session?.completed
                      ? "Session saved as complete"
                      : day.strength
                        ? "Finish & save session"
                        : "Log this recovery day"}
                  </button>
                  <span>
                    {day.strength
                      ? "Your effort counts. Every set needn’t be perfect."
                      : "Recovery logging is optional."}
                  </span>
                </div>
              </article>
            </div>
            <aside className="side-column">
              <section className="timer-card">
                <div className="card-kicker">
                  <span>TAKE A BREATHER</span>
                  <Icon name="clock" size={18} />
                </div>
                <h3>Rest. Then go again.</h3>
                <div
                  className={`timer-orbit ${running ? "timer-running" : ""}`}
                  style={
                    {
                      "--timer-progress": `${(timerSeconds / timerDuration) * 360}deg`,
                    } as React.CSSProperties
                  }
                >
                  <div>
                    <strong
                      role="timer"
                      aria-label={`${timerSeconds} seconds remaining`}
                    >
                      {formatTimer(timerSeconds)}
                    </strong>
                    <span>
                      {timerFinished
                        ? "READY WHEN YOU ARE"
                        : running
                          ? "BREATHE & RESET"
                          : "REST TIMER"}
                    </span>
                  </div>
                </div>
                <div className="timer-presets">
                  {[60, 90, 120].map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      className={timerDuration === seconds ? "chosen" : ""}
                      onClick={() => {
                        setRunning(false);
                        deadline.current = null;
                        setTimerDuration(seconds);
                        setTimerSeconds(seconds);
                        setTimerFinished(false);
                      }}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
                <div className="timer-controls">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={pauseTimer}
                  >
                    <Icon name={running ? "pause" : "play"} size={15} />
                    {running
                      ? "Pause"
                      : timerSeconds < timerDuration && timerSeconds > 0
                        ? "Resume"
                        : "Start timer"}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Reset rest timer"
                    onClick={() => {
                      setRunning(false);
                      deadline.current = null;
                      setTimerSeconds(timerDuration);
                      setTimerFinished(false);
                    }}
                  >
                    <Icon name="reset" />
                  </button>
                </div>
                <span className="sr-only" role="status">
                  {timerFinished
                    ? "Rest finished. Start your next set when ready."
                    : ""}
                </span>
              </section>
              <section className="guidance-card">
                <span className="eyebrow">WEEK {week} FOCUS</span>
                <h3>{guidance.label}</h3>
                <p>{guidance.guidance}</p>
                <button type="button" onClick={() => setView("plan")}>
                  See the whole plan <Icon name="arrow" size={16} />
                </button>
              </section>
              <section className="downloads-card">
                <span className="eyebrow">TAKE IT WITH YOU</span>
                <button type="button" onClick={downloadPlan} disabled={busy}>
                  <Icon name="download" size={17} />
                  <span>
                    {busy ? "Preparing download…" : "Download workout plan"}
                    <small>PDF · all three sessions · clickable demos</small>
                  </span>
                  <span>↗</span>
                </button>
                <button type="button" onClick={downloadImage} disabled={busy}>
                  <Icon name="download" size={17} />
                  <span>
                    Save this session<small>Image for your phone</small>
                  </span>
                  <span>↗</span>
                </button>
              </section>
              <div className="privacy-note">
                <span className="privacy-dot" />
                <p>
                  {saveStatus}
                  <small>
                    Logs stay in this browser. Export a backup to move them to
                    another device.
                  </small>
                </p>
              </div>
            </aside>
          </div>
        </>
      )}

      {view === "plan" && (
        <section className="plan-view">
          <div className="section-heading">
            <span className="eyebrow">SIMPLE BY DESIGN</span>
            <h2>Your plan, at a glance.</h2>
            <p>
              Three full-body sessions, legs first. Brisk walks on two rest
              days and one longer cardio day give you 120 minutes of cardio a
              week.
            </p>
          </div>
          <div className="plan-session-grid">
            {workoutDays
              .filter((item) => item.strength)
              .map((item) => (
                <article key={item.day} className="plan-session">
                  <span className="plan-day">
                    {weekday
                      .format(parseDateKey(addDays(weekStart, item.day - 1)))
                      .toUpperCase()}
                  </span>
                  <div className="plan-session-title">
                    <span>{item.letter}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <p>{item.focus}</p>
                  <ul>
                    {item.exercises.map((exercise) => (
                      <li key={exercise.id}>
                        {exercise.name}
                        <span>
                          {exercise.sets} × {exercise.reps}
                          {exercise.timed ? "s" : exercise.distance ? " m" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => chooseDate(addDays(weekStart, item.day - 1))}
                  >
                    Open session {item.letter}
                    <Icon name="arrow" size={16} />
                  </button>
                </article>
              ))}
          </div>
          <div className="guide-grid">
            <article className="guide-card">
              <span className="eyebrow">01 / TRAIN HARD ENOUGH</span>
              <h3>Stop 1–2 reps before failure.</h3>
              <p>
                Full volume from day one. Lifts marked Heavy or Main get two
                lighter warm-up sets and 2–3 minutes of rest; everything else
                60–120 seconds. Exercises marked Pair are alternated
                back-to-back.
              </p>
            </article>
            <article className="guide-card">
              <span className="eyebrow">02 / BUILD GRADUALLY</span>
              <h3>Reps first. Then weight.</h3>
              <p>
                When every set reaches the top of its range with 1–2 reps left,
                use the smallest available weight increase. Pull-ups: add one
                rep to one set each week up to 5 × 5, then 4 × 6–8.
              </p>
            </article>
            <article className="guide-card">
              <span className="eyebrow">03 / PROTECT YOUR POSTURE</span>
              <h3>More pulling than pushing.</h3>
              <p>
                Warm up with chin tucks and band pull-aparts, finish with chest
                and hip-flexor stretches. Avoid shrugs and heavy overhead
                pressing for now — your scan shows overactive upper traps.
              </p>
            </article>
            <article className="guide-card">
              <span className="eyebrow">04 / RECOVER & REVIEW</span>
              <h3>Lighter week when needed.</h3>
              <p>
                If lifts stall for two weeks and joints ache, do one week with
                half the sets. Front-shoulder pain on dips: switch to a flat
                dumbbell press. Rescan and repeat blood tests around week 12.
              </p>
            </article>
          </div>
          <section className="settings-card">
            <div>
              <span className="eyebrow">MAKE IT YOUR BLOCK</span>
              <h3>Program settings</h3>
              <p>
                Changing your start date anchors the A / walk / B / walk / C /
                rest / cardio rhythm to that day. The default starts on Sunday.
              </p>
            </div>
            <label className="start-date-label">
              Program starts
              <input
                type="date"
                aria-label="Program start date"
                value={store.programStart}
                onChange={(event) => {
                  try {
                    parseDateKey(event.target.value);
                    setStore((current) => ({
                      ...current,
                      programStart: event.target.value,
                    }));
                    setSelectedDate(event.target.value);
                  } catch {}
                }}
              />
            </label>
          </section>
          <details className="health-note">
            <summary>
              Training notes & sources <span>+</span>
            </summary>
            <p>
              This is a starting training plan, not medical clearance or a
              diagnosis from a body scan. Follow existing medical advice and
              seek assessment for unresolved exercise restrictions. Stop
              exercise and get urgent help for chest pain, fainting or unusual
              breathlessness.
            </p>
            <p>
              Volume is set where the evidence places productive training
              (about 9–16 hard sets per muscle per week), with heavier sets
              first for strength. Aerobic exercise raises HDL once it reaches
              about 120 minutes a week, with longer sessions helping most.
            </p>
            <a
              href="https://acsm.org/resistance-training-guidelines-update-2026/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ACSM resistance-training guidance ↗
            </a>
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/38595233/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Split versus full-body training review ↗
            </a>
            <a
              href="https://doi.org/10.1519/JSC.0000000000002200"
              target="_blank"
              rel="noopener noreferrer"
            >
              Heavy vs light loads for strength (Schoenfeld 2017) ↗
            </a>
            <a
              href="https://doi.org/10.1001/archinte.167.10.999"
              target="_blank"
              rel="noopener noreferrer"
            >
              Aerobic exercise and HDL (Kodama 2007) ↗
            </a>
          </details>
        </section>
      )}

      {view === "history" && (
        <section className="history-view">
          <div className="section-heading">
            <span className="eyebrow">YOUR WORK ADDS UP</span>
            <h2>A record of showing up.</h2>
            <p>
              Completed strength sessions, with your weights, repetitions and
              notes.
            </p>
          </div>
          {history.length ? (
            <div className="history-list">
              {history.map(([date, log]) => {
                const item = workoutDays[log.day - 1];
                const sets = Object.values(log.sets)
                  .flat()
                  .filter((row) => row.done).length;
                return (
                  <button
                    type="button"
                    key={date}
                    className="history-row"
                    onClick={() => chooseDate(date)}
                  >
                    <span className="history-letter">{item.letter}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {fullDate.format(parseDateKey(date))} · {sets} sets
                        checked
                      </small>
                      {log.notes && <em>{log.notes}</em>}
                    </span>
                    <Icon name="arrow" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-history">
              <Icon name="chart" size={48} />
              <h3>Your next chapter starts with one session.</h3>
              <p>
                Finish your first workout and it will appear here. Every
                session’s inputs are also saved while you train.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setView("today")}
              >
                Go to your workout <Icon name="arrow" size={17} />
              </button>
            </div>
          )}
          <div className="backup-card">
            <div>
              <h3>Keep your progress with you.</h3>
              <p>
                Download a backup to keep or import on another device. Importing
                adds missing dates and keeps your existing entries.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={backup}
              >
                <Icon name="download" size={16} />
                Export backup
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => backupRef.current?.click()}
              >
                Import backup
              </button>
              <input
                ref={backupRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Import workout backup"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void restore(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>
        </section>
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      <footer>
        <a
          href="#top"
          className="footer-wordmark"
          onClick={() => setView("today")}
        >
          WorkIn<span>GYM</span>
        </a>
        <p>Show up. Move well. Build slowly.</p>
        <span>Made for the long run.</span>
      </footer>
      {view === "today" && (
        <div className="mobile-timer">
          <span>
            <Icon name="clock" size={17} />
            <strong>{formatTimer(timerSeconds)}</strong>
            <small>
              {timerFinished
                ? "Rest finished"
                : running
                  ? "Resting"
                  : "Rest timer"}
            </small>
          </span>
          <button type="button" onClick={pauseTimer}>
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            aria-label="Reset mobile rest timer"
            onClick={() => {
              setRunning(false);
              deadline.current = null;
              setTimerSeconds(timerDuration);
              setTimerFinished(false);
            }}
          >
            <Icon name="reset" size={17} />
          </button>
        </div>
      )}
    </main>
  );
}
