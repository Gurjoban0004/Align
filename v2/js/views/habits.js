// =============================================================
// ALIGN v2 — Habits View
// Habit cards with streaks, custom creator, and calendar heatmaps
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { getState, setState, getDayLog, updateDayLog } from '../state.js';
import { showBottomSheet, formGroup, formInput } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import { calendarHeatmap } from '../components/charts.js';

let activeTooltip = null;

export function renderHabits(container) {
  const dateStr = getState('dateStr');
  const day = getDayLog(dateStr);
  const habits = getState('habits') || [];
  const completed = day.habitsCompleted || [];

  const completedCount = completed.length;
  const totalCount = habits.length || 1;
  const percent = Math.round((completedCount / totalCount) * 100);

  const page = el('div', { class: 'habits-page view-enter' });
  const wrap = el('div', { class: 'container' });

  // Header
  wrap.appendChild(el('div', { class: 'page-header' },
    el('span', { class: 'kicker' }, 'Daily Rituals'),
    el('div', { class: 'page-title-row' },
      el('h2', {}, 'Habits'),
      el('span', { class: 'habits-score' }, `${completedCount}/${totalCount}`)
    )
  ));

  // Progress bar
  const progressWrap = el('div', { class: 'habits-progress-wrap' });
  const progressBar = el('div', { class: 'habits-progress-bar' });
  const progressFill = el('div', {
    class: 'habits-progress-fill',
    style: { width: '0%', background: 'var(--primary)' },
  });
  progressBar.appendChild(progressFill);
  progressWrap.appendChild(progressBar);
  progressWrap.appendChild(el('span', { class: 'habits-progress-label' }, `${percent}% complete`));
  wrap.appendChild(progressWrap);

  // Animate progress bar fill
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progressFill.style.width = percent + '%';
    });
  });

  // Habit cards list
  const list = el('div', { class: 'habit-list stagger' });

  habits.forEach((habit) => {
    const isDone = completed.includes(habit.id);
    const streak = getStreak(habit);
    const completions = habit.completions || [];

    // Main Card Element
    const card = el('div', {
      class: `habit-card${isDone ? ' habit-done' : ''}`,
      onClick: () => toggleHabit(habit.id, dateStr, container),
    },
      // Card content row
      el('div', { class: 'habit-card-main' },
        el('div', { class: 'habit-card-left' },
          el('div', { class: `habit-check${isDone ? ' checked' : ''}` },
            isDone ? icon(ICONS.check, { size: 16 }) : null
          ),
          el('div', { class: 'habit-info' },
            el('strong', { class: 'habit-title' }, habit.title),
            el('span', { class: 'habit-category' }, habit.category || '')
          )
        ),
        el('div', { class: 'habit-card-right' },
          streak > 0 ? el('div', { class: 'habit-streak' },
            icon(ICONS.flame, { size: 14 }),
            el('span', {}, `${streak}`)
          ) : null,
          el('button', {
            class: 'habit-delete-btn',
            style: { marginLeft: '8px', color: 'var(--text-subtle)', cursor: 'pointer' },
            onClick: (e) => {
              e.stopPropagation();
              deleteHabitWithUndo(habit.id, habit.title, container);
            }
          }, icon(ICONS.trash, { size: 14 }))
        )
      ),
      // Heatmap row
      el('div', {
        class: 'habit-heatmap-row',
        onClick: (e) => {
          e.stopPropagation(); // prevent card toggle when tapping heatmap
          handleHeatmapClick(e);
        }
      },
        calendarHeatmap(completions, {
          days: 30,
          cellSize: 10,
          gap: 3,
          layout: 'strip',
        })
      )
    );

    list.appendChild(card);
  });

  wrap.appendChild(list);

  // Add custom habit button
  wrap.appendChild(el('button', {
    class: 'btn btn-secondary',
    style: { width: '100%', marginTop: 'var(--space-4)' },
    onClick: () => openAddHabit(container),
  }, icon(ICONS.plus, { size: 16 }), 'Add Custom Habit'));

  page.appendChild(wrap);
  container.appendChild(page);
}

function toggleHabit(habitId, dateStr, container) {
  const day = getDayLog(dateStr);
  let completed = [...(day.habitsCompleted || [])];

  // 1. Toggle in Day Log (for Dashboard Rings)
  if (completed.includes(habitId)) {
    completed = completed.filter(id => id !== habitId);
  } else {
    completed.push(habitId);
  }
  updateDayLog(dateStr, { habitsCompleted: completed });

  // 2. Toggle in Habit completions list (for heatmap/streaks)
  const habits = getState('habits') || [];
  const updatedHabits = habits.map(h => {
    if (h.id === habitId) {
      let completions = [...(h.completions || [])];
      if (completions.includes(dateStr)) {
        completions = completions.filter(d => d !== dateStr);
      } else {
        completions.push(dateStr);
      }
      
      // Multiples of 7 streak celebration trigger
      const currentStreak = calculateStreakFromCompletions(completions);
      if (!completions.includes(dateStr) === false && currentStreak > 0 && currentStreak % 7 === 0) {
        setTimeout(() => showToast(`🔥 ${currentStreak}-day streak! Keep it up!`, { type: 'success' }), 300);
      }
      
      return { ...h, completions };
    }
    return h;
  });
  setState('habits', updatedHabits);

  container.replaceChildren();
  renderHabits(container);
}

/**
 * Calculates a streak from a static completions list.
 */
function calculateStreakFromCompletions(completions) {
  if (!completions || completions.length === 0) return 0;
  const completionSet = new Set(completions);
  const today = new Date();
  let streak = 0;

  let currentDate = new Date(today);
  let dateStr = currentDate.toISOString().split('T')[0];

  if (!completionSet.has(dateStr)) {
    // Check if streak was kept alive up to yesterday
    currentDate.setDate(today.getDate() - 1);
    dateStr = currentDate.toISOString().split('T')[0];
    if (!completionSet.has(dateStr)) {
      return 0;
    }
  }

  while (completionSet.has(dateStr)) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
    dateStr = currentDate.toISOString().split('T')[0];
  }

  return streak;
}

function getStreak(habit) {
  return calculateStreakFromCompletions(habit.completions || []);
}

function handleHeatmapClick(e) {
  const cell = e.target.closest('.heatmap-cell');
  if (!cell) return;

  const dateStr = cell.dataset.date;
  const completed = cell.dataset.completed === 'true';

  showTooltip(cell, `${dateStr}: ${completed ? 'Done ✓' : 'Missed ✗'}`);
}

function showTooltip(target, text) {
  if (activeTooltip) activeTooltip.remove();

  const rect = target.getBoundingClientRect();
  const tooltip = el('div', {
    class: 'heatmap-tooltip fade-in',
    style: {
      position: 'fixed',
      top: `${rect.top - 32}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      background: 'var(--surface-dark)',
      color: 'var(--text-on-dark)',
      padding: '4px 8px',
      borderRadius: 'var(--radius-xs)',
      fontSize: 'var(--text-xs)',
      zIndex: '1000',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-sm)',
    }
  }, text);

  document.body.appendChild(tooltip);
  activeTooltip = tooltip;

  setTimeout(() => {
    if (tooltip && tooltip.parentNode) tooltip.remove();
    if (activeTooltip === tooltip) activeTooltip = null;
  }, 2000);
}

function openAddHabit(container) {
  let nameInput, categoryInput;

  showBottomSheet({
    title: 'Add Habit',
    render: (content) => {
      nameInput = formInput({ placeholder: 'e.g. Meditate 10 min', id: 'habit-name' });
      categoryInput = formInput({ placeholder: 'e.g. Mind, Health', id: 'habit-category' });

      content.appendChild(formGroup('Habit Name', nameInput));
      content.appendChild(formGroup('Category', categoryInput));

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          const title = nameInput.value.trim();
          if (!title) { showToast('Enter habit name', { type: 'warning' }); return; }

          const habits = [...(getState('habits') || [])];
          habits.push({
            id: 'h' + Date.now(),
            title,
            category: categoryInput.value.trim() || 'General',
            icon: 'checkSquare',
            completions: [],
          });
          setState('habits', habits);

          showToast(`"${title}" added`, { type: 'success' });
          container.replaceChildren();
          renderHabits(container);
        },
      }, 'Save Habit');
      content.appendChild(saveBtn);
    },
  });
}

function deleteHabitWithUndo(habitId, habitTitle, container) {
  const habits = getState('habits') || [];
  const habitToDelete = habits.find(h => h.id === habitId);
  if (!habitToDelete) return;

  // Optimistically remove
  const filteredHabits = habits.filter(h => h.id !== habitId);
  setState('habits', filteredHabits);

  container.replaceChildren();
  renderHabits(container);

  let undone = false;
  showToast(`Deleted "${habitTitle}"`, {
    type: 'info',
    duration: 3000,
    action: {
      label: 'Undo',
      callback: () => {
        undone = true;
        // Put it back
        const currentHabits = getState('habits') || [];
        setState('habits', [...currentHabits, habitToDelete]);
        container.replaceChildren();
        renderHabits(container);
      }
    }
  });
}
