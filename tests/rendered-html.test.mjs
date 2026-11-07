import assert from "node:assert/strict";
import test from "node:test";
import {
  workoutDays,
  demoFor,
  setsFor,
  unitFor,
  weekGuidance,
  PROGRAM_START,
} from "../app/workout-data.ts";
import { getProgramDayIndex } from "../lib/workout-utils.mjs";

const exercises = workoutDays.flatMap((day) => day.exercises);
const find = (id) => exercises.find((exercise) => exercise.id === id);

test("plan v3 has three nonconsecutive strength days and 27 demonstrated exercises", () => {
  assert.deepEqual(
    workoutDays.filter((day) => day.strength).map((day) => day.letter),
    ["A", "B", "C"],
  );
  assert.deepEqual(
    workoutDays.filter((day) => day.strength).map((day) => day.day),
    [1, 3, 5],
  );
  assert.deepEqual(
    workoutDays
      .filter((day) => day.strength)
      .map((day) => day.exercises.length),
    [10, 10, 12],
  );
  const ids = new Set(exercises.map((exercise) => exercise.id));
  assert.equal(ids.size, 27);
  for (const id of ids) {
    const demo = demoFor(id);
    assert.ok(demo?.url, `Missing demo for ${id}`);
    const url = new URL(demo.url);
    assert.equal(url.protocol, "https:");
    assert.ok(
      !url.pathname.includes("results"),
      "Demos must not be search results",
    );
    assert.ok(demo.source);
  }
});

test("each session lists an exercise only once, so set logs never collide", () => {
  for (const day of workoutDays) {
    const ids = day.exercises.map((exercise) => exercise.id);
    assert.equal(new Set(ids).size, ids.length, `Duplicate in ${day.title}`);
  }
});

test("sets come from the plan and fit the stored log limit", () => {
  for (const exercise of exercises) {
    assert.equal(setsFor(exercise), exercise.sets);
    assert.ok(exercise.sets >= 1 && exercise.sets <= 6, exercise.id);
  }
  const pullUpsB = workoutDays[2].exercises.find((ex) => ex.id === "pull-up");
  assert.equal(pullUpsB.sets, 5);
  assert.equal(find("hack-squat").sets, 4);
  assert.equal(find("supported-row").sets, 4);
});

test("weekly hard-set volume matches the v3 priorities", () => {
  const strength = workoutDays.filter((day) => day.strength);
  const total = (ids) =>
    strength
      .flatMap((day) => day.exercises)
      .filter((exercise) => ids.includes(exercise.id))
      .reduce((sum, exercise) => sum + exercise.sets, 0);
  assert.equal(total(["hack-squat", "leg-extension", "smith-split-squat", "leg-press"]), 13);
  assert.equal(total(["leg-curl", "dumbbell-rdl"]), 9);
  assert.equal(total(["calf-raise"]), 6);
  assert.equal(total(["lateral-raise"]), 9);
  assert.equal(total(["incline-smith-press", "incline-press", "assisted-dip"]), 9);
  assert.equal(
    total(["lat-pulldown", "pull-up", "band-assisted-pull-up", "supported-row"]),
    16,
  );
});

test("side-specific, timed and distance prescriptions keep their units", () => {
  for (const id of ["smith-split-squat", "side-plank"])
    assert.equal(find(id).perSide, true);
  assert.equal(unitFor(find("side-plank")), "sec");
  assert.equal(unitFor(find("dead-hang")), "sec");
  assert.equal(unitFor(find("farmers-carry")), "m");
  assert.equal(unitFor(find("pull-up")), "reps");
});

test("the default week runs Sunday A, Tuesday B, Thursday C, Saturday cardio", () => {
  assert.equal(new Date(`${PROGRAM_START}T12:00:00`).getDay(), 0);
  const on = (date) => workoutDays[getProgramDayIndex(PROGRAM_START, date) - 1];
  assert.equal(on("2026-11-08").letter, "A");
  assert.equal(on("2026-11-09").tag, "WALK");
  assert.equal(on("2026-11-10").letter, "B");
  assert.equal(on("2026-11-12").letter, "C");
  assert.equal(on("2026-11-13").tag, "REST");
  assert.equal(on("2026-11-14").tag, "CARDIO");
  assert.equal(weekGuidance.length, 6);
});
