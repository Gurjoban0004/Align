// =============================================================
// ALIGN v2 — Fitness View
// Workout splits, progressive overload, 1RM, and analytics
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { getState, setState, getDayLog, updateDayLog } from '../state.js';
import { showBottomSheet, formGroup, formInput } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import { createInputBar } from '../components/input-bar.js';
import { barChart, lineChart } from '../components/charts.js';

let selectedVolumeGroup = 'Total'; // 'Total' | 'Push' | 'Pull' | 'Legs'
let selectedProgressExercise = ''; // Selected exercise for 1RM progress chart

export function renderFitness(container) {
  const dateStr = getState('dateStr');
  const day = getDayLog(dateStr);
  const splits = getState('workoutSplits') || {};
  const workouts = day.workouts || [];
  const currentSplit = day.workoutSplitName || '';

  const page = el('div', { class: 'fitness-page view-enter' });
  const wrap = el('div', { class: 'container' });

  // Header
  wrap.appendChild(el('div', { class: 'page-header' },
    el('span', { class: 'kicker' }, 'Training'),
    el('h2', {}, 'Fitness')
  ));

  // Today's workout summary card
  if (workouts.length > 0) {
    const summary = el('div', { class: 'workout-summary-card' });
    const restOnly = workouts.length === 1 && workouts[0]?.restDay;

    if (restOnly) {
      summary.appendChild(el('div', { class: 'workout-summary-content' },
        icon(ICONS.moon, { size: 24 }),
        el('div', {},
          el('strong', {}, 'Rest Day'),
          el('p', { class: 'caption' }, 'Recovery is part of progress.')
        )
      ));
    } else {
      const totalSets = workouts.reduce((a, w) => a + (parseInt(w.sets) || 0), 0);
      const totalVolume = workouts.reduce((a, w) => {
        return a + ((parseFloat(w.weight) || 0) * (parseInt(w.sets) || 0) * (parseInt(w.reps) || 0));
      }, 0);

      summary.appendChild(el('div', { class: 'workout-summary-content' },
        icon(ICONS.dumbbell, { size: 24 }),
        el('div', {},
          el('strong', {}, `${workouts.length} exercises logged`),
          el('p', { class: 'caption' }, `${totalSets} sets · ${Math.round(totalVolume).toLocaleString()} kg volume`)
        )
      ));
    }
    wrap.appendChild(summary);

    // Exercise list with overload comparisons and PR indicators
    if (!restOnly) {
      const list = el('div', { class: 'exercise-list' });
      workouts.forEach((w, i) => {
        if (w.restDay) return;

        // 1. Calculate Today's Volume and 1RM
        const todayVolume = (parseFloat(w.weight) || 0) * (parseInt(w.sets) || 0) * (parseInt(w.reps) || 0);
        const estimated1RM = getEstimated1RM(w.weight, w.reps);

        // 2. Check for Progressive Overload (compared to previous session of the same split)
        const priorVolume = currentSplit ? getPriorSessionVolume(currentSplit, w.name, dateStr) : 0;
        const volDiff = todayVolume - priorVolume;

        // 3. Check for Personal Record
        const prs = getState('personalRecords') || {};
        const storedPR = prs[w.name];
        const isNewPR = storedPR && dateStr === storedPR.achievedDate;

        const infoLeft = el('div', { class: 'exercise-info' },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            el('strong', {}, w.name || 'Exercise'),
            isNewPR ? el('span', { class: 'pr-badge' }, '🏆 New PR') : null
          ),
          w.weight ? el('div', { class: 'exercise-stats-row' },
            el('span', { class: 'caption' }, `${w.weight}kg × ${w.sets}×${w.reps}`),
            el('span', { class: 'caption font-mono' }, `1RM: ${estimated1RM}kg`),
            priorVolume > 0 && volDiff > 0 ? el('span', { class: 'overload-indicator positive' }, `↑ +${Math.round(volDiff)}kg vol`) : null
          ) : null
        );

        list.appendChild(el('div', { class: 'exercise-item' },
          infoLeft,
          el('button', {
            class: 'exercise-remove',
            'aria-label': 'Remove',
            onClick: () => {
              const updated = [...(day.workouts || [])];
              updated.splice(i, 1);
              updateDayLog(dateStr, { workouts: updated });
              
              // Recalculate PRs after removing an exercise
              recalculatePRs(dateStr);
              
              container.replaceChildren();
              renderFitness(container);
            },
          }, icon(ICONS.x, { size: 14 }))
        ));
      });
      wrap.appendChild(list);
    }
  }

  // Split selector buttons
  wrap.appendChild(el('div', { class: 'section-header', style: { marginTop: 'var(--space-6)' } },
    el('h4', {}, 'Quick Log Split'),
  ));

  const splitGrid = el('div', { class: 'split-grid' });
  Object.keys(splits).forEach((splitName) => {
    const splitBtn = el('button', {
      class: 'split-card',
      onClick: () => logSplit(splitName, dateStr, container),
    },
      icon(ICONS.dumbbell, { size: 20 }),
      el('span', {}, splitName)
    );
    splitGrid.appendChild(splitBtn);
  });

  // Rest day + Custom exercise buttons
  splitGrid.appendChild(el('button', {
    class: 'split-card split-rest',
    onClick: () => {
      updateDayLog(dateStr, { workouts: [{ restDay: true, name: 'Rest Day' }], workoutSplitName: 'Rest Day' });
      showToast('Rest day logged', { type: 'success' });
      container.replaceChildren();
      renderFitness(container);
    },
  }, icon(ICONS.moon, { size: 20 }), el('span', {}, 'Rest Day')));

  splitGrid.appendChild(el('button', {
    class: 'split-card split-custom',
    onClick: () => openAddExercise(dateStr, container),
  }, icon(ICONS.plus, { size: 20 }), el('span', {}, 'Add Exercise')));

  wrap.appendChild(splitGrid);

  // ─── Analytics Panels (New in v2) ───
  const analyticsGrid = el('div', { class: 'fitness-analytics-grid' });

  // 1. Weekly Volume Analytics
  const volumeCard = el('div', { class: 'analytics-card' },
    el('div', { class: 'analytics-card-header' },
      el('h4', {}, 'Volume Analytics'),
      el('div', { class: 'tab-switcher switcher-mini' },
        ['Total', 'Push', 'Pull', 'Legs'].map(group => el('button', {
          class: `tab-btn${selectedVolumeGroup === group ? ' active' : ''}`,
          onClick: (e) => {
            selectedVolumeGroup = group;
            container.replaceChildren();
            renderFitness(container);
          }
        }, group))
      )
    ),
    el('div', { class: 'chart-container', role: 'img', 'aria-label': '8-week volume chart' },
      barChart(getWeeklyVolumeData(selectedVolumeGroup, dateStr), {
        height: 160,
        color: 'var(--accent-sage)',
        label: `${selectedVolumeGroup} Volume (8 weeks)`
      })
    )
  );
  analyticsGrid.appendChild(volumeCard);

  // 2. Strength Progress (1RM Progression)
  const allExercises = getAllExerciseNames();
  if (!selectedProgressExercise && allExercises.length > 0) {
    selectedProgressExercise = allExercises[0];
  }

  const strengthCard = el('div', { class: 'analytics-card' },
    el('div', { class: 'analytics-card-header' },
      el('h4', {}, 'Strength Progress'),
      allExercises.length > 0 ? el('select', {
        class: 'exercise-select',
        onChange: (e) => {
          selectedProgressExercise = e.target.value;
          container.replaceChildren();
          renderFitness(container);
        }
      },
        allExercises.map(exName => el('option', {
          value: exName,
          selected: selectedProgressExercise === exName
        }, exName))
      ) : null
    ),
    el('div', { class: 'chart-container' },
      selectedProgressExercise ? lineChart(get1RMProgressData(selectedProgressExercise, dateStr), {
        height: 160,
        color: 'var(--primary)',
        fillArea: true,
        label: `${selectedProgressExercise} 1RM Progress`
      }) : el('div', { class: 'placeholder-view' }, 'No exercise logged yet.')
    )
  );
  analyticsGrid.appendChild(strengthCard);

  wrap.appendChild(analyticsGrid);

  // 3. Personal Records Table
  const prs = getState('personalRecords') || {};
  const prKeys = Object.keys(prs);
  if (prKeys.length > 0) {
    const prSection = el('div', { class: 'settings-section', style: { marginTop: 'var(--space-6)' } },
      el('h4', { class: 'settings-section-title' }, '🏆 Personal Records'),
      el('div', { class: 'pr-table-wrapper' },
        el('table', { class: 'pr-table' },
          el('thead', {},
            el('tr', {},
              el('th', {}, 'Exercise'),
              el('th', {}, 'Est. 1RM'),
              el('th', {}, 'Weight & Reps'),
              el('th', {}, 'Achieved Date')
            )
          ),
          el('tbody', {},
            prKeys.map((exName) => {
              const record = prs[exName];
              return el('tr', {},
                el('td', {}, exName),
                el('td', { class: 'font-mono bold' }, `${record.bestEstimated1RM} kg`),
                el('td', { class: 'caption' }, `${record.weight}kg × ${record.reps}`),
                el('td', { class: 'caption' }, record.achievedDate)
              );
            })
          )
        )
      )
    );
    wrap.appendChild(prSection);
  }

  // Persistent Input Bar
  wrap.appendChild(createInputBar(() => {
    // Process PRs for today after manual input
    verifyTodayPRs(dateStr);
    container.replaceChildren();
    renderFitness(container);
  }));

  page.appendChild(wrap);
  container.appendChild(page);
}

// ─── Core Logic Helpers ───

function getEstimated1RM(weight, reps) {
  const w = parseFloat(weight) || 0;
  const r = parseInt(reps) || 0;
  if (r <= 0 || w <= 0) return 0;
  // Epley formula: w * (1 + r / 30)
  return parseFloat((w * (1 + r / 30)).toFixed(1));
}

function getPriorSessionVolume(splitName, exerciseName, beforeDateStr) {
  const logs = getState('logs') || {};
  const dates = Object.keys(logs).sort().reverse(); // descending

  for (const d of dates) {
    if (d >= beforeDateStr) continue;
    const log = logs[d];
    if (log.workoutSplitName === splitName) {
      const ex = (log.workouts || []).find(w => w.name === exerciseName);
      if (ex && ex.weight && ex.sets && ex.reps) {
        return ex.weight * ex.sets * ex.reps;
      }
    }
  }
  return 0;
}

function logSplit(splitName, dateStr, container) {
  const splits = getState('workoutSplits') || {};
  const exercises = splits[splitName] || [];
  const day = getDayLog(dateStr);
  const existing = day.workouts || [];

  const newWorkouts = [...existing.filter(w => !w.restDay), ...exercises.map(ex => ({ ...ex }))];
  updateDayLog(dateStr, { workouts: newWorkouts, workoutSplitName: splitName });

  // Check and apply PRs for this split
  verifyTodayPRs(dateStr);

  showToast(`${splitName} logged — ${exercises.length} exercises`, { type: 'success' });
  container.replaceChildren();
  renderFitness(container);
}

function openAddExercise(dateStr, container) {
  let nameInput, weightInput, setsInput, repsInput;

  showBottomSheet({
    title: 'Add Exercise',
    render: (content) => {
      nameInput = formInput({ placeholder: 'e.g. Bench Press', id: 'ex-name' });
      weightInput = formInput({ type: 'number', placeholder: '0', inputmode: 'decimal', id: 'ex-weight' });
      setsInput = formInput({ type: 'number', placeholder: '4', inputmode: 'numeric', id: 'ex-sets' });
      repsInput = formInput({ type: 'number', placeholder: '10', inputmode: 'numeric', id: 'ex-reps' });

      content.appendChild(formGroup('Exercise Name', nameInput));
      content.appendChild(el('div', { class: 'form-row' },
        formGroup('Weight (kg)', weightInput),
        formGroup('Sets', setsInput),
        formGroup('Reps', repsInput),
      ));

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          const name = nameInput.value.trim();
          if (!name) { showToast('Enter exercise name', { type: 'warning' }); return; }

          const exercise = {
            name,
            weight: parseFloat(weightInput.value) || 0,
            sets: parseInt(setsInput.value) || 4,
            reps: parseInt(repsInput.value) || 10,
          };

          const day = getDayLog(dateStr);
          const existing = day.workouts || [];
          updateDayLog(dateStr, { workouts: [...existing.filter(w => !w.restDay), exercise] });

          // Check for PR
          verifyTodayPRs(dateStr);

          showToast(`${name} added`, { type: 'success' });
          container.replaceChildren();
          renderFitness(container);
        },
      }, 'Save Exercise');
      content.appendChild(saveBtn);
    },
  });
}

function verifyTodayPRs(dateStr) {
  const day = getDayLog(dateStr);
  const workouts = day.workouts || [];
  const prs = { ...(getState('personalRecords') || {}) };
  let newPRLogged = false;

  workouts.forEach((w) => {
    if (w.restDay || !w.weight || !w.reps) return;
    const est = getEstimated1RM(w.weight, w.reps);
    const existing = prs[w.name];

    if (!existing || est > existing.bestEstimated1RM) {
      prs[w.name] = {
        bestEstimated1RM: est,
        achievedDate: dateStr,
        weight: w.weight,
        reps: w.reps
      };
      newPRLogged = true;
      showToast(`🏆 New PR: ${w.name} ${est}kg!`, { type: 'success', duration: 3000 });
    }
  });

  if (newPRLogged) {
    setState('personalRecords', prs);
  }
}

function recalculatePRs(dateStr) {
  // Complete scan of history to rebuild PRs (e.g. if an exercise was deleted)
  const logs = getState('logs') || {};
  const prs = {};

  Object.keys(logs).forEach((date) => {
    const day = logs[date];
    (day.workouts || []).forEach((w) => {
      if (w.restDay || !w.weight || !w.reps) return;
      const est = getEstimated1RM(w.weight, w.reps);
      const existing = prs[w.name];

      if (!existing || est > existing.bestEstimated1RM) {
        prs[w.name] = {
          bestEstimated1RM: est,
          achievedDate: date,
          weight: w.weight,
          reps: w.reps
        };
      }
    });
  });

  setState('personalRecords', prs);
}

// ─── Analytics Data Fetchers ───

function getWeeklyVolumeData(group, baseDateStr) {
  const logs = getState('logs') || {};
  const baseDate = new Date(baseDateStr);
  const data = [];

  // Generate 8 weekly buckets
  for (let w = 7; w >= 0; w--) {
    let weeklyVol = 0;
    const label = w === 0 ? 'This Wk' : `Wk -${w}`;

    // Sum volume for the 7 days in this bucket
    for (let d = 0; d < 7; d++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() - (w * 7 + d));
      const key = date.toISOString().split('T')[0];
      const log = logs[key];

      if (log && log.workouts) {
        const split = log.workoutSplitName || '';
        let matched = false;

        if (group === 'Total') matched = true;
        else if (group === 'Push' && split.includes('Push')) matched = true;
        else if (group === 'Pull' && split.includes('Pull')) matched = true;
        else if (group === 'Legs' && split.includes('Leg')) matched = true;

        if (matched) {
          weeklyVol += log.workouts.reduce((sum, ex) => {
            if (ex.restDay) return sum;
            return sum + ((ex.weight || 0) * (ex.sets || 0) * (ex.reps || 0));
          }, 0);
        }
      }
    }

    data.push({ label, value: Math.round(weeklyVol) });
  }

  return data;
}

function get1RMProgressData(exerciseName, baseDateStr) {
  const logs = getState('logs') || {};
  const dates = Object.keys(logs).sort(); // chronological
  const data = [];

  dates.forEach((d) => {
    const log = logs[d];
    const ex = (log.workouts || []).find(w => w.name === exerciseName);
    if (ex && ex.weight && ex.reps) {
      const est = getEstimated1RM(ex.weight, ex.reps);
      data.push({ date: d, value: est });
    }
  });

  // Keep last 30 data points maximum for clarity
  return data.slice(-30);
}

function getAllExerciseNames() {
  const prs = getState('personalRecords') || {};
  return Object.keys(prs).sort();
}
