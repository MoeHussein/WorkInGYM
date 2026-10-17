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
  PROGRAM_START,
  STORAGE_KEY,
  setsFor,
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
  programStart: string;
  extraSet: boolean;
  logs: Record<string, SessionLog>;
};
type View = "today" | "plan" | "history";
const blankSet = (): SetLog => ({ kg: "", reps: "", done: false });
const freshStore = (): Store => ({
  version: 1,
  programStart: PROGRAM_START,
  extraSet: false,
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
  const safe: Store = {
    version: 1,
    programStart: value.programStart,
    extraSet: value.extraSet === true,
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
        .slice(0, 3)
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
  const countFor = (i: number) => setsFor(week, i, store.extraSet);
  const rowsFor = (exercise: Exercise, i: number) =>
    Array.from(
      { length: countFor(i) },
      (_, index) => session?.sets[exercise.id]?.[index] ?? blankSet(),
    );
  const totalSets = day.exercises.reduce((sum, _, i) => sum + countFor(i), 0);
  const doneSets = day.exercises.reduce(
    (sum, exercise, i) =>
      sum + rowsFor(exercise, i).filter((row) => row.done).length,
    0,
  );
  const completedExercises = day.exercises.filter((exercise, i) =>
    rowsFor(exercise, i).every((row) => row.done),
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
    i: number,
    rowIndex: number,
    patch: Partial<SetLog>,
  ) {
    changeSession((log) => {
      const rows = Array.from(
        { length: countFor(i) },
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
      workoutDays
        .filter((item) => item.strength)
        .forEach((item, pageIndex) => {
          if (pageIndex) pdf.addPage();
          pdf.setFillColor(29, 57, 46);
          pdf.rect(0, 0, 210, 46, "F");
          pdf.setTextColor(223, 247, 166);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text("WORKINGYM / SIX-WEEK GYM BLOCK", 17, 16);
          pdf.setFontSize(24);
          pdf.setTextColor(255, 255, 255);
          pdf.text(`Session ${item.letter}: ${item.title}`, 17, 33);
          pdf.setTextColor(45, 57, 49);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.text(
            pdfText(
              `Week ${week} / ${item.duration} / ${week < 3 ? "3-4" : "2-3"} reps in reserve`,
            ),
            17,
            57,
          );
          let y = 69;
          for (const [i, exercise] of item.exercises.entries()) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.text(pdfText(`${i + 1}. ${exercise.name}`), 17, y);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.text(
              pdfText(
                `${setsFor(week, i, store.extraSet)} sets x ${exercise.reps}${exercise.timed ? " sec" : " reps"}${exercise.perSide ? " / side" : ""} / Rest ${exercise.rest}s`,
              ),
              17,
              y + 6,
            );
            const lines = pdf.splitTextToSize(pdfText(exercise.cue), 175);
            pdf.text(lines, 17, y + 12);
            const demo = demoFor(exercise.id);
            if (demo) {
              pdf.setTextColor(48, 104, 69);
              pdf.textWithLink(
                "Watch exercise demo",
                17,
                y + 14 + lines.length * 4,
                { url: demo.url },
              );
              pdf.setTextColor(45, 57, 49);
            }
            y += 20 + lines.length * 4;
          }
          pdf.setFontSize(8);
          pdf.text(
            "Warm up 5-8 minutes, then do 1-2 lighter practice sets for the first leg and upper-body exercises.",
            17,
            278,
          );
          pdf.text(
            "Train on nonconsecutive days. Start light, keep breathing and use your existing medical advice.",
            17,
            284,
          );
          pdf.text(`WorkInGYM / ${pageIndex + 1} of 3`, 17, 290);
        });
      pdf.save(`workingym-plan-week-${week}.pdf`);
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
            THE SIX-WEEK GYM BLOCK
          </span>
          <h1>
            A little stronger.
            <br />
            <span>Every session.</span>
          </h1>
          <p>
            Three days of focused strength. Room to recover.
            <br className="desktop-break" /> A plan you can actually keep
            showing up for.
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
              <Icon name="clock" size={15} /> 45–65 minutes
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
              {dates.map((date, i) => {
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
                      {isDone ? (
                        <Icon name="check" size={14} />
                      ) : scheduled.strength ? (
                        `SESSION ${scheduled.letter}`
                      ) : i === 6 ? (
                        "REST"
                      ) : (
                        "RECOVER"
                      )}
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
                      <span>
                        {week < 3 ? "3–4" : "2–3"} reps left in the tank
                      </span>
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
                          5–8 MIN <b>+</b>
                        </small>
                      </summary>
                      <p>
                        Walk or cycle easily for 5–8 minutes. Then do 1–2
                        lighter practice sets for your first leg exercise and
                        first upper-body exercise. These do not count as working
                        sets.
                      </p>
                    </details>
                    <div className="logging-note">
                      Log one dumbbell’s weight, the machine’s displayed weight,
                      or 0 for body weight. For each-side exercises, finish both
                      sides before checking a set.
                    </div>
                    <div className="exercise-list">
                      {day.exercises.map((exercise, i) => {
                        const rows = rowsFor(exercise, i);
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
                                  {countFor(i)} sets <i>×</i> {exercise.reps}{" "}
                                  {exercise.timed ? "sec" : "reps"}
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
                                    ? "SECONDS"
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
                                        updateSet(exercise, i, rowIndex, {
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
                                    aria-label={`${exercise.name} set ${rowIndex + 1} ${exercise.timed ? "seconds" : "repetitions"}`}
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
                                        updateSet(exercise, i, rowIndex, {
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
                                      updateSet(exercise, i, rowIndex, {
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
                    <small>3-page PDF · clickable demos</small>
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
              Three full-body sessions with a different emphasis. Recovery days
              between them.
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
                          {exercise.reps}
                          {exercise.timed ? "s" : ""}
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
              <span className="eyebrow">01 / START COMFORTABLY</span>
              <h3>Leave something in the tank.</h3>
              <p>
                In weeks 1–2, use two working sets and finish with 3–4 clean
                repetitions left. From week 3, aim for 2–3 repetitions left. Use
                a comfortable range and keep breathing.
              </p>
            </article>
            <article className="guide-card">
              <span className="eyebrow">02 / BUILD GRADUALLY</span>
              <h3>Reps first. Then weight.</h3>
              <p>
                When every set reaches the top of its range with good control
                and at least two repetitions left, use the smallest available
                weight increase. Keep equipment settings consistent.
              </p>
            </article>
            <article className="guide-card">
              <span className="eyebrow">03 / RECOVER WELL</span>
              <h3>Three good days are enough.</h3>
              <p>
                Keep a recovery day between lifting sessions. An optional fourth
                day can be an easy walk or bike ride. Reduce the workload when
                soreness or fatigue affects the next session.
              </p>
            </article>
            <article className="guide-card">
              <span className="eyebrow">04 / MOVE WITH CONTROL</span>
              <h3>Comfort guides the range.</h3>
              <p>
                Keep your neck comfortable, control your knees at the top of leg
                movements, and have a trainer check the hip hinge. Change or
                stop movements that cause joint, neck or back pain.
              </p>
            </article>
          </div>
          <section className="settings-card">
            <div>
              <span className="eyebrow">MAKE IT YOUR BLOCK</span>
              <h3>Program settings</h3>
              <p>
                Changing your start date anchors the A / recovery / B / recovery
                / C rhythm to that day. The default starts on Saturday.
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
            <label className="extra-set-label">
              <input
                type="checkbox"
                checked={store.extraSet}
                onChange={(event) =>
                  setStore((current) => ({
                    ...current,
                    extraSet: event.target.checked,
                  }))
                }
              />
              <span>
                Add a third set when ready
                <small>
                  First 3 exercises only, from week 3. Enable this when recovery
                  is good.
                </small>
              </span>
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
              The six-week block ends with a review rather than automatically
              restarting. Frequency and volume can be adjusted as your recovery
              and strength develop.
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
