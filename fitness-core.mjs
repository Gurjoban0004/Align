export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
const movements = [
  ['Bench Press','Chest','Barbell'], ['Incline DB Press','Chest','Dumbbell'], ['Push-up','Chest','Bodyweight'], ['Cable Fly','Chest','Cable'],
  ['Lat Pulldown','Back','Cable'], ['Barbell Row','Back','Barbell'], ['Pull-up','Back','Bodyweight'], ['Seated Cable Row','Back','Cable'], ['Dumbbell Row','Back','Dumbbell'],
  ['Overhead Press','Shoulders','Barbell'], ['Lateral Raise','Shoulders','Dumbbell'], ['Face Pull','Shoulders','Cable'], ['Rear Delt Fly','Shoulders','Dumbbell'],
  ['Bicep Curls','Biceps','Dumbbell'], ['Hammer Curl','Biceps','Dumbbell'], ['Barbell Curl','Biceps','Barbell'],
  ['Tricep Pushdowns','Triceps','Cable'], ['Overhead Tricep Extension','Triceps','Dumbbell'], ['Dips','Triceps','Bodyweight'],
  ['Squats','Quads','Barbell'], ['Goblet Squat','Quads','Dumbbell'], ['Leg Press','Quads','Machine'], ['Leg Extension','Quads','Machine'], ['Split Squat','Quads','Dumbbell'],
  ['Romanian Deadlift','Hamstrings','Barbell'], ['Leg Curl','Hamstrings','Machine'], ['Deadlift','Back','Barbell'],
  ['Hip Thrust','Glutes','Barbell'], ['Glute Bridge','Glutes','Bodyweight'], ['Calf Raises','Calves','Machine'], ['Standing Calf Raise','Calves','Dumbbell'],
  ['Crunch','Core','Bodyweight'], ['Hanging Knee Raise','Core','Bodyweight'], ['Cable Crunch','Core','Cable'], ['Ab Wheel Rollout','Core','Bodyweight']
];
export const EXERCISES = movements.map(([name, muscle, equipment]) => ({ name, muscle, equipment }));
export const SET_TYPES = ['working', 'warmup', 'drop', 'failure'];
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function exerciseInfo(name) {
  return EXERCISES.find(e => e.name.toLowerCase() === name.toLowerCase()) || { name, muscle: 'Other', equipment: 'Custom' };
}
export function newSet(source = {}) {
  return { reps: source.reps ?? 10, weight: source.weight ?? 0, type: SET_TYPES.includes(source.type) ? source.type : 'working', rpe: source.rpe ?? '', done: false };
}
export function newExercise(source) {
  return { ...exerciseInfo(source.name), ...source, setEntries: Array.from({length: Math.max(1, Math.min(20, Number(source.sets) || 3))}, () => newSet(source)) };
}
export function validSet(s) {
  return Number.isInteger(Number(s.reps)) && Number(s.reps) >= 1 && Number(s.reps) <= 1000 && Number.isFinite(Number(s.weight)) && Number(s.weight) >= 0 && Number(s.weight) <= 2000 && SET_TYPES.includes(s.type) && (s.rpe === '' || s.rpe == null || (Number(s.rpe) >= 1 && Number(s.rpe) <= 10));
}
export function workingSets(ex) {
  if (Array.isArray(ex.setEntries)) return ex.setEntries.filter(s => s.done && s.type !== 'warmup' && validSet(s));
  // Older Align logs used aggregate sets and had no completion flag.
  if (ex.logged === false) return [];
  return Array.from({length: Math.max(0, Math.min(100, Number(ex.sets) || 0))}, () => newSet(ex)).filter(validSet);
}
export function volume(exercises) {
  return exercises.reduce((total, ex) => total + workingSets(ex).reduce((sum,s) => sum + Number(s.reps) * Number(s.weight), 0), 0);
}
export function records(logs) {
  const best = {};
  for (const [date, day] of Object.entries(logs).sort(([a],[b]) => a.localeCompare(b))) {
    for (const ex of day.workouts || []) {
      for (const s of workingSets(ex)) {
        const key = ex.name.toLowerCase();
        const estimated = Number(s.reps) === 1 ? Number(s.weight) : Number(s.weight) * (1 + Number(s.reps) / 30);
        const previous = best[key];
        if (!previous || estimated > previous.estimated || (estimated === previous.estimated && Number(s.reps) > previous.reps)) best[key] = { name: ex.name, weight: Number(s.weight), reps: Number(s.reps), estimated, date };
      }
    }
  }
  return Object.values(best).sort((a,b) => b.estimated - a.estimated);
}
export function weekSummary(logs, dateStr) {
  const start = new Date(dateStr + 'T12:00:00');
  start.setDate(start.getDate() - (start.getDay()+6)%7);
  return Array.from({length:7}, (_,i) => {
    const d = new Date(start); d.setDate(d.getDate()+i);
    const date = localDate(d), exercises = logs[date]?.workouts || [];
    return { date, label: ['M','T','W','T','F','S','S'][i], sets: exercises.reduce((n,e) => n + workingSets(e).length,0), volume: volume(exercises) };
  });
}
export function finishSession(day, now = Date.now()) {
  const draft = day.workoutDraft;
  if (!draft) throw new Error('No active workout.');
  const exercises = draft.exercises.map(ex => ({ ...ex, setEntries: ex.setEntries.filter(s => s.done).map(s => ({...s})) })).filter(ex => ex.setEntries.length);
  if (!exercises.length) throw new Error('Complete at least one set before finishing.');
  if (exercises.some(ex => ex.setEntries.some(s => !validSet(s)))) throw new Error('Check the reps, weight and RPE of completed sets.');
  const durationSec = Math.max(0, Math.round((now - draft.startedAt)/1000));
  const session = { id: draft.id, name: draft.name, durationSec, finishedAt: now };
  const logged = exercises.map(ex => {
    const sets = workingSets(ex);
    return { ...ex, sessionId: draft.id, sets: sets.length, reps: Number(sets[0]?.reps || 0), weight: Number(sets[0]?.weight || 0), logged: true };
  });
  day.workouts = [...(day.workouts || []), ...logged];
  day.trainingSessions = [...(day.trainingSessions || []), session];
  day.workoutDraft = null;
  return session;
}
export function workoutCSV(logs) {
  const quote = value => '"' + String(/^[=+\-@\t\r]/.test(String(value)) ? "'" + value : value).replaceAll('"','""') + '"';
  const rows = [['Date','Session','Exercise','Set','Type','Weight (kg)','Reps','RPE']];
  for (const [date,day] of Object.entries(logs).sort()) for (const ex of day.workouts || []) {
    const sets = ex.setEntries?.filter(s => s.done) || workingSets(ex);
    sets.forEach((s,i) => rows.push([date,ex.sessionId || 'Legacy',ex.name,i+1,s.type,s.weight,s.reps,s.rpe ?? '']));
  }
  return rows.map(row => row.map(quote).join(',')).join('\r\n');
}

export function sameStoredData(left, right) {
  const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
  return canonical(left) === canonical(right);
}
