# Align fitness upgrade

## Behavior

The main PWA entry point (`index.html` → `redesign.js`) now opens a fitness workspace with Workout, Exercises, Routines, Progress and the existing Nutrition page.

- Resume a workout draft after reload or navigation; add movements from a 35-exercise library filtered by muscle and equipment, or enter a custom movement.
- Log each set's kg, reps, optional RPE and working/warm-up/drop/failure type. Completed sets start the configurable rest timer. The timer uses an absolute end timestamp and catches up after app suspension; an open app is required for its visual completion alert.
- Finish multiple sessions on the selected date without replacing earlier workouts. Finish records only completed sets. Discarding a draft does not delete completed history.
- Create, edit, duplicate and delete routine templates using the existing `workoutSplit` storage and Firebase preferences.
- View weekly completed sets/volume, muscle distribution, estimated 1RM benchmarks and expandable history. Export workout CSV or a JSON backup of fitness logs and routines.
- Keep existing nutrition, dashboard and AI integrations using compatible summary exercise fields.
- Stop creating random sample history on startup. Previously stored logs are kept because old demo data cannot be reliably distinguished from user-entered data.
- Validate the existing iPhone health webhook, accept zero steps, reject malformed dates and invalid numeric values, and show server receipt time. New sync tokens use `crypto.getRandomValues`.

## Data compatibility

Completed exercise entries remain in `dailyLogs[date].workouts` with legacy `name`, `sets`, `reps`, `weight`, `logged` fields plus detailed `setEntries` and `sessionId`. The summary fields use the first working set for older consumers; per-set values are authoritative for volume and records. Session metadata lives in `trainingSessions`; unfinished work lives in `workoutDraft`. All three use the existing per-date local/cloud save path. Old aggregate logs are displayed without rewriting them.

Progress uses logs available on the current device. Existing Firebase synchronization loads the selected daily log, not every historical log; a new device's progress is incomplete until the relevant days have been loaded. No historical collection-wide fetch was added.

## GymMane reference

Reference repository: https://github.com/InlitX/GymMane, tree `39fd732f793f6773112fbcb945c3cfd8f31e7e61`.

The training workflows were informed by GymMane's README and workout/routine model behavior. This is a new JavaScript implementation for Align. No Flutter source, exercise artwork, animations, fonts or catalogue were copied into the app. The interface credits GymMane by InlitX. GymMane itself is GPL-3.0-only with an attribution term; any future direct source/asset port must preserve the applicable license and notices.

This update does not port GymMane's entire Android application. Its 500+ animated catalogue, native notifications/widgets, photos, scheduling, supersets, calculators and third-party history importers remain outside this change.

## Checks

Run `npm test` for the dependency-free fitness and health payload tests. Browser QA could not run: the environment denied local server binding, and browser policy blocked local-file navigation. No production account was exercised. The iPhone HealthKit path requires physical-device validation and server configuration, as described in `iphone-steps.md`.
