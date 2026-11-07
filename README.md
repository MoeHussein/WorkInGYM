# WorkInGYM

A phone-friendly gym companion adapted from [MoeHussein/Workin](https://github.com/MoeHussein/Workin), running Training Plan v3.

- Three full-body sessions, legs first: A squat + upper chest, B pull-ups + hinge, C legs + dips. Sunday, Tuesday and Thursday by default, with brisk walks Monday and Wednesday and a 60-minute cardio day on Saturday (≥120 cardio minutes a week).
- Per-exercise set counts at full volume from week one, stopping 1–2 reps before failure; heavy first lifts for strength.
- Per-set weight, repetitions, seconds or metres logging, completion, previous-session reference and session notes.
- Direct demonstrations for all 27 distinct exercises; variant differences are explained.
- Posture warm-up and finishing stretches on every strength day.
- Rest timer that uses an absolute deadline so returning from another tab updates correctly.
- Plan PDF with clickable demos, session image downloads, and JSON backup import/export.
- Browser-local progress under a separate WorkInGYM storage key. Saves from the earlier schedule keep their logs and move to the new Sunday start. No automatic cross-device sync.

## Development

Use Node.js >=22.13.0.

```bash
npm ci
npm run dev:next
```

## Checks and build

```bash
npm run export:plan
npm test
npx tsc --noEmit
npm run build
```

The static site is exported to `out/`. `app/workout-data.ts` is the plan source; `app/exercise-demos.json` contains the verified demonstration mapping. `exports/workingym-plan.json` contains the generic program without a personal health profile.

## Hosting

[Open WorkInGYM on GitHub Pages](https://moehussein.github.io/WorkInGYM/)

The Sites project is configured in `.openai/hosting.json`. The GitHub Pages workflow uses `/WorkInGYM` as its base path; set the repository Pages source to **GitHub Actions** before running it. Pushes to `main` automatically rebuild and deploy GitHub Pages after Pages is configured. For a root-domain build, omit `NEXT_PUBLIC_BASE_PATH`.

## Training

Use loads that leave 1–2 clean reps in every set and add weight once every set reaches the top of its range. The program is a training routine, not a medical diagnosis or clearance. Follow existing medical advice, adapt painful movements, review logs at week 4, and rescan around week 12.
