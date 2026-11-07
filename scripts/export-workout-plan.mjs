import { mkdir, writeFile } from "node:fs/promises";
import {
  FINISH,
  PROGRAM_START,
  WARM_UP,
  workoutDays,
  weekGuidance,
  scheduleVersion,
} from "../app/workout-data.ts";
import demos from "../app/exercise-demos.json" with { type: "json" };
const plan = {
  name: "WorkInGYM",
  schemaVersion: 2,
  scheduleVersion,
  programStart: PROGRAM_START,
  schedule:
    "Sunday A / Monday walk / Tuesday B / Wednesday walk / Thursday C / Friday rest / Saturday cardio by default.",
  progression:
    "Full volume from week 1. Stop each set with 1-2 reps left. Add weight after reaching the top of the range on every set. Pull-ups: add one rep to one set each week up to 5 x 5, then 4 x 6-8, then add weight.",
  warmUp: WARM_UP,
  finish: FINISH,
  cardio:
    "At least 120 minutes a week: 60-minute cardio day plus two 30-minute brisk walks.",
  weekGuidance,
  days: workoutDays.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
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
