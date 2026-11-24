# Easy Workout

A home workout app that builds a training programme from your goal, your schedule and the equipment you own, runs each session with you, and adjusts the next ones from what you logged. French and English. It works offline and keeps your data on your device.

## What it does

- **A programme that fits your home.** Goal, level, days per week and session length, plus the equipment you actually have (dumbbell range, bands, pull-up bar, treadmill…). An 8-week cycle with lighter and heavier weeks.
- **About 250 exercises**, each with an animated figure, a key cue and step-by-step instructions.
- **A player you can read from the floor.** Large numbers, rest timer, voice, beeps and tempo pacing. One tap logs a set as planned.
- **Progress that adapts.** Loads and reps move after each session, always with the reason. Pain or missing equipment leads to a lighter option or a substitute.
- **Fits real life.** Go easy on a sore knee or a shoulder, quiet or small-space training, planned weekdays, a pause or a travel kit, a gentle restart after a break.
- **Records and recovery.** Personal records, a lighter week when you need one, warm-up sets and a cooldown after each workout.
- **Your own sessions** with the session editor, quick one-off sessions, progress charts, weekly check-ins, max tests and an end-of-cycle review.
- **Backups.** Export and restore everything as a JSON file; export logged sets as CSV.

## Your data

No account, no server. Everything you enter is stored by your browser on your device and never sent anywhere. Export a backup from Settings → Data and backup from time to time: clearing the browser's data or removing the app can erase it.

## Install

Open **https://mokaddem.github.io/easy-workout/** in your phone's browser, then add it to the home screen:

- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app.

Once installed it runs offline.

## Run it locally

Requires Node.js 22 or later.

```sh
npm install
npm run dev        # development server
npm test           # unit tests
npm run e2e        # end-to-end tests (Playwright)
npm run build      # production build in dist/
```

## Disclaimer

Easy Workout gives general training guidance, not medical advice. Check with a doctor before you start if you have a health condition or an injury, are pregnant, or haven't trained in a long time. Stop if you feel pain, dizziness or unusual breathlessness. You train at your own risk.

_Easy Workout donne des repères d'entraînement généraux, pas un avis médical. Demande l'avis d'un médecin avant de commencer si tu as un problème de santé ou une blessure, si tu es enceinte ou si tu n'as pas fait de sport depuis longtemps. Arrête-toi en cas de douleur, de vertige ou d'essoufflement inhabituel. Tu t'entraînes sous ta propre responsabilité._

## License

[MIT](LICENSE). The Archivo typeface is licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).
