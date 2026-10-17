import { mkdir, writeFile } from "node:fs/promises";
import {
  PROGRAM_START,
  workoutDays,
  weekGuidance,
  scheduleVersion,
} from "../app/workout-data.ts";
import demos from "../app/exercise-demos.json" with { type: "json" };
const plan = {
  name: "WorkInGYM",
  schemaVersion: 1,
  scheduleVersion,
  programStart: PROGRAM_START,
  cycleLengthWeeks: 6,
  schedule:
    "Saturday / Monday / Wednesday by default; three nonconsecutive full-body sessions.",
  progression:
    "Weeks 1-2: two working sets with 3-4 repetitions left. From week 3: optional third set for the first three exercises, only when recovery is good. Increase load after reaching the top of every set with good control and at least two repetitions left.",
  weekGuidance,
  days: workoutDays.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
      initialSets: 2,
      demo: demos[exercise.id],
    })),
  })),
};
await mkdir(new URL("../exports/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../exports/workingym-plan.json", import.meta.url),
  JSON.stringify(plan, null, 2) + "\n",
);
console.log("Exported WorkInGYM exercise plan.");
