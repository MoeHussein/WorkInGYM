import assert from "node:assert/strict";
import test from "node:test";
import {
  workoutDays,
  demoFor,
  setsFor,
  weekGuidance,
} from "../app/workout-data.ts";

test("the agreed gym program has three nonconsecutive strength days and 19 unique demonstrations", () => {
  assert.deepEqual(
    workoutDays.filter((day) => day.strength).map((day) => day.day),
    [1, 3, 5],
  );
  assert.deepEqual(
    workoutDays
      .filter((day) => day.strength)
      .map((day) => day.exercises.length),
    [6, 7, 7],
  );
  const ids = new Set(
    workoutDays.flatMap((day) => day.exercises.map((exercise) => exercise.id)),
  );
  assert.equal(ids.size, 19);
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

test("third working sets are optional, apply from week three, and only affect the first three exercises", () => {
  assert.equal(setsFor(1, 0, true), 2);
  assert.equal(setsFor(2, 2, true), 2);
  assert.equal(setsFor(3, 0, false), 2);
  assert.equal(setsFor(3, 2, true), 3);
  assert.equal(setsFor(3, 3, true), 2);
  assert.equal(setsFor(6, 0, true), 3);
  assert.equal(weekGuidance.length, 6);
});

test("side-specific and hold prescriptions keep their correct units", () => {
  const exercises = workoutDays.flatMap((day) => day.exercises);
  for (const id of ["dead-bug", "split-squat", "pallof-press", "side-plank"])
    assert.equal(exercises.find((ex) => ex.id === id).perSide, true);
  assert.equal(exercises.find((ex) => ex.id === "side-plank").timed, true);
  assert.equal(exercises.find((ex) => ex.id === "side-plank").reps, "15–25");
  assert.equal(exercises.find((ex) => ex.id === "leg-curl").rest, 90);
});
