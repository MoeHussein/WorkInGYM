# WorkInGYM

A phone-friendly gym companion adapted from [MoeHussein/Workin](https://github.com/MoeHussein/Workin), replacing the calisthenics block with a six-week gym program.

- Three full-body sessions with push, pull and leg emphases; Saturday, Monday and Wednesday by default.
- Per-set weight, repetitions or hold-time logging, completion, previous-session reference and session notes.
- Direct demonstrations for all 19 distinct exercises; verified short-clip durations are shown where available. Variant differences are explained.
- Rest timer that uses an absolute deadline so returning from another tab updates correctly.
- Optional third working sets from week three, enabled only when recovery is good.
- Three-page plan PDF with clickable demos, session image downloads, and JSON backup import/export.
- Browser-local progress under a separate WorkInGYM storage key. No automatic cross-device sync.

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

Start with light loads and two working sets. The program is a starting routine, not a medical diagnosis or clearance. Follow existing medical advice, adapt painful movements, and review recovery and logs at the end of six weeks.
