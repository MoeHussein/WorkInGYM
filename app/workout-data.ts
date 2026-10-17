import demos from "./exercise-demos.json" with { type: "json" };
export type Exercise = {
  id: string;
  name: string;
  group: string;
  reps: string;
  rest: number;
  cue: string;
  perSide?: boolean;
  timed?: boolean;
};
export type Demo = {
  url: string;
  title: string;
  source: string;
  durationSeconds?: number | null;
  note?: string | null;
};
export type WorkoutDay = {
  day: number;
  letter: string;
  title: string;
  focus: string;
  duration: string;
  summary: string;
  strength: boolean;
  exercises: Exercise[];
};
export const PROGRAM_START = "2026-10-17";
export const STORAGE_KEY = "workingym:progress:v1";
export const scheduleVersion = 1;
export const demoFor = (id: string): Demo | undefined =>
  (demos as Record<string, Demo>)[id];
export const workoutDays: WorkoutDay[] = [
  {
    day: 1,
    letter: "A",
    title: "Push emphasis",
    focus: "Chest · shoulders · full body",
    duration: "45–60 min",
    strength: true,
    summary:
      "A steady start. Build your pressing strength, then balance it with supported back work, legs and core.",
    exercises: [
      {
        id: "leg-press",
        name: "Leg press",
        group: "Quads & glutes",
        reps: "10–12",
        rest: 120,
        cue: "Keep your pelvis against the pad. Straighten your legs under control without snapping your knees backward.",
      },
      {
        id: "chest-press",
        name: "Machine chest press",
        group: "Chest & triceps",
        reps: "8–12",
        rest: 120,
        cue: "Set the handles around mid-chest. Keep your head comfortably supported and use a pain-free range.",
      },
      {
        id: "supported-row",
        name: "Chest-supported row",
        group: "Upper back",
        reps: "10–12",
        rest: 120,
        cue: "Keep your chest on the pad. Pull smoothly without lifting your chin or shrugging.",
      },
      {
        id: "leg-curl",
        name: "Seated hamstring curl",
        group: "Hamstrings",
        reps: "10–15",
        rest: 90,
        cue: "Align your knees with the machine pivot. Control the curl and the return.",
      },
      {
        id: "lateral-raise",
        name: "Dumbbell lateral raise",
        group: "Side shoulders",
        reps: "12–15",
        rest: 60,
        cue: "Use light weights. Raise through a comfortable range without swinging or shrugging.",
      },
      {
        id: "dead-bug",
        name: "Dead bug",
        group: "Core control",
        reps: "6–8",
        rest: 60,
        perSide: true,
        cue: "Exhale as you extend opposite limbs. Shorten the movement before your lower back arches.",
      },
    ],
  },
  {
    day: 2,
    letter: "R",
    title: "Recovery day",
    focus: "Easy movement · recover",
    duration: "Optional 20–30 min",
    strength: false,
    summary:
      "An easy walk is enough. Let yesterday’s work settle and return fresh for Session B.",
    exercises: [],
  },
  {
    day: 3,
    letter: "B",
    title: "Pull emphasis",
    focus: "Back · rear shoulders · full body",
    duration: "50–65 min",
    strength: true,
    summary:
      "Build your pulling strength and shoulder control, with supported single-leg work and a simple hip extension.",
    exercises: [
      {
        id: "lat-pulldown",
        name: "Neutral-grip lat pulldown",
        group: "Lats & biceps",
        reps: "8–12",
        rest: 120,
        cue: "Use parallel handles with palms facing each other. Pull toward your upper chest without swinging.",
      },
      {
        id: "split-squat",
        name: "Supported split squat",
        group: "Quads & glutes",
        reps: "8–10",
        rest: 120,
        perSide: true,
        cue: "Begin with body weight and hold a stable support. Lower straight down through a comfortable range.",
      },
      {
        id: "incline-press",
        name: "Incline dumbbell press",
        group: "Upper chest",
        reps: "8–12",
        rest: 120,
        cue: "Use a modest bench incline. Keep your head supported, wrists steady and feet planted.",
      },
      {
        id: "glute-bridge",
        name: "Glute bridge",
        group: "Glutes",
        reps: "10–15",
        rest: 90,
        cue: "Push through your feet and lift through your hips. Finish before your lower back starts to arch.",
      },
      {
        id: "reverse-pec-deck",
        name: "Reverse pec deck",
        group: "Rear shoulders",
        reps: "12–15",
        rest: 60,
        cue: "Keep your chest supported. Open your arms smoothly without shrugging or forcing the end range.",
      },
      {
        id: "dumbbell-curl",
        name: "Dumbbell curl",
        group: "Biceps",
        reps: "10–15",
        rest: 60,
        cue: "Keep your upper arms still. Lower slowly rather than swinging your body.",
      },
      {
        id: "pallof-press",
        name: "Pallof press",
        group: "Core stability",
        reps: "8–10",
        rest: 60,
        perSide: true,
        cue: "Stand side-on to a cable at chest height. Press forward while keeping your torso facing ahead.",
      },
    ],
  },
  {
    day: 4,
    letter: "E",
    title: "Easy cardio",
    focus: "Walk or cycle · comfortable pace",
    duration: "Optional 20–30 min",
    strength: false,
    summary:
      "Walk or cycle at a pace that lets you speak in full sentences. Keep it easy enough to support tomorrow’s lifting.",
    exercises: [],
  },
  {
    day: 5,
    letter: "C",
    title: "Leg emphasis",
    focus: "Legs · posterior chain · full body",
    duration: "50–65 min",
    strength: true,
    summary:
      "Practise your squat and hip hinge, then round out the week with chest, back, calves and trunk stability.",
    exercises: [
      {
        id: "goblet-squat",
        name: "Goblet squat to a bench",
        group: "Quads & glutes",
        reps: "8–12",
        rest: 120,
        cue: "Hold a light dumbbell at your chest. Touch a stable bench lightly, then stand under control.",
      },
      {
        id: "dumbbell-rdl",
        name: "Dumbbell Romanian deadlift",
        group: "Hamstrings & glutes",
        reps: "8–12",
        rest: 120,
        cue: "Ask a trainer to check your hip hinge first. Push your hips backward, keep the weights close and stop before your back rounds.",
      },
      {
        id: "chest-press",
        name: "Machine chest press",
        group: "Chest & triceps",
        reps: "10–12",
        rest: 120,
        cue: "Keep your head supported. Press through a comfortable range without forcing your shoulders backward.",
      },
      {
        id: "cable-row",
        name: "Seated cable row",
        group: "Upper back & lats",
        reps: "10–12",
        rest: 120,
        cue: "Keep your torso steady and your neck relaxed. Avoid rocking backward to finish the pull.",
      },
      {
        id: "calf-raise",
        name: "Calf raise",
        group: "Calves",
        reps: "12–15",
        rest: 60,
        cue: "Hold a support for balance. Pause briefly at the top and lower slowly.",
      },
      {
        id: "triceps-pressdown",
        name: "Rope triceps pressdown",
        group: "Triceps",
        reps: "10–15",
        rest: 60,
        cue: "Keep your elbows near your sides. Straighten your arms without moving your shoulders or leaning on the rope.",
      },
      {
        id: "side-plank",
        name: "Side plank — knees bent",
        group: "Lateral core",
        reps: "15–25",
        rest: 60,
        perSide: true,
        timed: true,
        cue: "Start on your forearm and bent knees. Keep breathing; stop before your hips sag.",
      },
    ],
  },
  {
    day: 6,
    letter: "E",
    title: "Optional movement",
    focus: "Easy walk · comfortable mobility",
    duration: "Optional 20–30 min",
    strength: false,
    summary:
      "Choose an easy walk or a few comfortable mobility movements. Skip this if you need the rest.",
    exercises: [],
  },
  {
    day: 7,
    letter: "R",
    title: "Rest & reset",
    focus: "Recover · review the week",
    duration: "No session required",
    strength: false,
    summary:
      "Take the day off planned training. Check your energy and recovery before the next week. Missed sessions do not need to be combined.",
    exercises: [],
  },
];
export const weekGuidance = [
  {
    week: 1,
    label: "Find your starting point",
    guidance:
      "Two working sets per exercise. Finish with 3–4 clean repetitions left. Learn the equipment and record comfortable starting weights.",
  },
  {
    week: 2,
    label: "Repeat with control",
    guidance:
      "Keep two sets and 3–4 repetitions in reserve. Add repetitions within your range when your movement stays comfortable.",
  },
  {
    week: 3,
    label: "Build when ready",
    guidance:
      "If recovery is good, enable the optional third set for the first three exercises. Keep 2–3 repetitions in reserve.",
  },
  {
    week: 4,
    label: "Make progress repeatable",
    guidance:
      "Reach the top of your repetition range on every set with at least two repetitions left before adding the smallest weight increase.",
  },
  {
    week: 5,
    label: "Small steps count",
    guidance:
      "Progress one thing at a time: repetitions, then load. Keep the same exercises and equipment settings so your logs are comparable.",
  },
  {
    week: 6,
    label: "Review your block",
    guidance:
      "Review your weights, consistency, comfort and recovery. Do not automatically restart the block or test maximum lifts. Use your logs to plan what comes next.",
  },
];
export const setsFor = (week: number, index: number, extraSet: boolean) =>
  week >= 3 && index < 3 && extraSet ? 3 : 2;
