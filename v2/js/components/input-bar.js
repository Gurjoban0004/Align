// =============================================================
// ALIGN v2 — Conversational Input Bar
// The killer feature — type naturally to log anything
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { getState, getDayLog, updateDayLog } from '../state.js';
import { parseInput, getInputPlaceholder } from '../ai/parser.js';
import { showToast } from './toast.js';

/**
 * Create the persistent conversational input bar.
 * @param {Function} onLogApplied - Callback when a log is applied (for re-render)
 * @returns {HTMLElement}
 */
export function createInputBar(onLogApplied) {
  const timePeriod = getState('timePeriod');

  const wrapper = el('div', { class: 'input-bar-wrapper' });

  // Quick action chips
  const chips = el('div', { class: 'input-chips' });
  const quickActions = getQuickChips(timePeriod);
  quickActions.forEach((qa) => {
    const chip = el('button', {
      class: 'input-chip',
      onClick: () => {
        applyQuickAction(qa, onLogApplied);
      },
    },
      icon(ICONS[qa.icon] || ICONS.plus, { size: 14 }),
      el('span', {}, qa.label)
    );
    chips.appendChild(chip);
  });
  wrapper.appendChild(chips);

  // Input bar
  const bar = el('div', { class: 'input-bar' });

  const input = el('input', {
    type: 'text',
    class: 'input-bar-field',
    placeholder: getInputPlaceholder(timePeriod),
    id: 'align-input',
    autocomplete: 'off',
    enterkeyhint: 'send',
  });

  // Handle Enter key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      handleSubmit(input, wrapper, onLogApplied);
    }
  });

  const sendBtn = el('button', {
    class: 'input-bar-send',
    'aria-label': 'Log entry',
    onClick: () => {
      if (input.value.trim()) {
        handleSubmit(input, wrapper, onLogApplied);
      }
    },
  }, icon(ICONS.send, { size: 18 }));

  bar.appendChild(icon(ICONS.sparkles, { size: 18, class: 'input-bar-icon' }));
  bar.appendChild(input);
  bar.appendChild(sendBtn);

  wrapper.appendChild(bar);

  return wrapper;
}

/**
 * Process user input through the parser and apply results.
 */
function handleSubmit(input, wrapper, onLogApplied) {
  const text = input.value.trim();
  if (!text) return;

  const results = parseInput(text);
  input.value = '';

  if (results.length === 0) {
    showToast('Couldn\'t parse that. Try something like "had chicken rice, walked 6k"', { type: 'warning' });
    return;
  }

  // Show confirmation cards
  showConfirmationCards(results, wrapper, onLogApplied);
}

/**
 * Show parsed results as confirmation cards.
 */
function showConfirmationCards(results, wrapper, onLogApplied) {
  // Remove any existing confirmation
  const existing = wrapper.querySelector('.confirmation-cards');
  if (existing) existing.remove();

  const container = el('div', { class: 'confirmation-cards' });

  const cardList = el('div', { class: 'confirm-card-list' });

  results.forEach((result) => {
    const typeIcon = getTypeIcon(result.type);
    const typeLabel = getTypeLabel(result.type);

    const card = el('div', { class: `confirm-card confirm-${result.type}` },
      el('div', { class: 'confirm-card-header' },
        icon(ICONS[typeIcon], { size: 16 }),
        el('span', { class: 'confirm-card-type' }, typeLabel)
      ),
      el('div', { class: 'confirm-card-summary' }, result.summary)
    );
    cardList.appendChild(card);
  });

  container.appendChild(cardList);

  // Action buttons
  const actions = el('div', { class: 'confirm-actions' });

  const confirmBtn = el('button', {
    class: 'btn-confirm',
    onClick: () => {
      applyResults(results, onLogApplied);
      container.classList.add('confirm-exit');
      setTimeout(() => container.remove(), 300);
    },
  }, icon(ICONS.check, { size: 16 }), el('span', {}, 'Confirm All'));

  const dismissBtn = el('button', {
    class: 'btn-dismiss',
    onClick: () => {
      container.classList.add('confirm-exit');
      setTimeout(() => container.remove(), 300);
    },
  }, 'Discard');

  actions.appendChild(confirmBtn);
  actions.appendChild(dismissBtn);
  container.appendChild(actions);

  // Insert before the input bar
  const bar = wrapper.querySelector('.input-bar');
  wrapper.insertBefore(container, bar);

  // Animate in
  requestAnimationFrame(() => container.classList.add('confirm-visible'));
}

/**
 * Apply parsed results to the day log.
 */
export function applyResults(results, onLogApplied) {
  const dateStr = getState('dateStr');
  const day = getDayLog(dateStr);
  const updates = {};
  let toastMessage = '';

  for (const result of results) {
    switch (result.type) {
      case 'steps':
        updates.steps = (day.steps || 0) + result.data.steps;
        break;

      case 'sleep':
        updates.sleep = result.data.sleep;
        break;

      case 'water':
        updates.water = (day.water || 0) + result.data.water;
        break;

      case 'weight':
        updates.weight = result.data.weight;
        break;

      case 'food':
        updates.calories = (day.calories || 0) + (result.data.calories || 0);
        updates.protein = (day.protein || 0) + (result.data.protein || 0);
        const existingMeals = day.meals || [];
        updates.meals = [...existingMeals, ...(result.data.meals || [])];
        break;

      case 'workout':
        const existingWorkouts = day.workouts || [];
        updates.workouts = [...existingWorkouts, result.data];
        break;

      case 'reading':
        if (result.data.pagesRead) {
          updates.pagesRead = (day.pagesRead || 0) + result.data.pagesRead;
        }
        break;

      case 'note':
        updates.notes = ((day.notes || '') + '\n' + result.data.text).trim();
        break;
    }
  }

  updateDayLog(dateStr, updates);

  const count = results.length;
  toastMessage = count === 1
    ? results[0].summary
    : `${count} entries logged`;

  showToast(toastMessage, { type: 'success', duration: 2500 });

  if (typeof onLogApplied === 'function') {
    onLogApplied();
  }
}

/**
 * Quick action chips based on time of day.
 */
function getQuickChips(timePeriod) {
  const base = [
    { label: 'Water +1', icon: 'water', action: 'water', value: 1 },
  ];

  if (timePeriod === 'morning') {
    return [
      { label: 'Breakfast', icon: 'utensils', action: 'meal', value: 'breakfast' },
      ...base,
      { label: 'Log Sleep', icon: 'moon', action: 'sleep_prompt', value: null },
    ];
  }
  if (timePeriod === 'midday') {
    return [
      { label: 'Lunch', icon: 'utensils', action: 'meal', value: 'lunch' },
      ...base,
      { label: '+2k Steps', icon: 'footprints', action: 'steps', value: 2000 },
    ];
  }
  if (timePeriod === 'evening') {
    return [
      { label: 'Dinner', icon: 'utensils', action: 'meal', value: 'dinner' },
      ...base,
      { label: 'Workout', icon: 'dumbbell', action: 'workout_prompt', value: null },
    ];
  }
  // night
  return [
    ...base,
    { label: 'Log Sleep', icon: 'moon', action: 'sleep_prompt', value: null },
    { label: 'Review', icon: 'sparkles', action: 'review', value: null },
  ];
}

function applyQuickAction(qa, onLogApplied) {
  const dateStr = getState('dateStr');

  switch (qa.action) {
    case 'water': {
      const day = getDayLog(dateStr);
      updateDayLog(dateStr, { water: (day.water || 0) + qa.value });
      showToast(`Water +${qa.value} cup`, { type: 'success', duration: 1500 });
      if (onLogApplied) onLogApplied();
      break;
    }
    case 'steps': {
      const day = getDayLog(dateStr);
      updateDayLog(dateStr, { steps: (day.steps || 0) + qa.value });
      showToast(`+${qa.value.toLocaleString()} steps`, { type: 'success', duration: 1500 });
      if (onLogApplied) onLogApplied();
      break;
    }
    case 'meal':
    case 'sleep_prompt':
    case 'workout_prompt':
    case 'review':
      // Focus the input bar with contextual placeholder
      const input = document.getElementById('align-input');
      if (input) {
        const hints = {
          meal: `What did you have for ${qa.value}?`,
          sleep_prompt: 'How many hours did you sleep?',
          workout_prompt: 'What workout did you do?',
          review: 'Type anything to get your daily review...',
        };
        input.placeholder = hints[qa.action] || input.placeholder;
        input.focus();
      }
      break;
  }
}

function getTypeIcon(type) {
  const map = {
    food: 'utensils',
    steps: 'footprints',
    sleep: 'moon',
    water: 'water',
    weight: 'scale',
    workout: 'dumbbell',
    reading: 'book',
    habit: 'checkSquare',
    note: 'edit',
  };
  return map[type] || 'info';
}

function getTypeLabel(type) {
  const map = {
    food: 'Meal',
    steps: 'Steps',
    sleep: 'Sleep',
    water: 'Water',
    weight: 'Weight',
    workout: 'Workout',
    reading: 'Reading',
    habit: 'Habit',
    note: 'Note',
  };
  return map[type] || 'Log';
}
