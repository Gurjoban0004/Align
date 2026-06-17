// =============================================================
// ALIGN v2 — Command Palette (⌘K / Ctrl+K)
// Quick-search modal for logging + navigation
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import { navigate } from '../router.js';
import { getDayLog, updateDayLog, getState } from '../state.js';
import { showToast } from './toast.js';

let paletteEl = null;
let overlayEl = null;
let isOpen = false;

const COMMANDS = [
  { id: 'nav-dashboard', label: 'Go to Dashboard',   icon: 'home',      type: 'nav', action: () => navigate('dashboard') },
  { id: 'nav-fitness',   label: 'Go to Fitness',     icon: 'dumbbell',  type: 'nav', action: () => navigate('fitness') },
  { id: 'nav-habits',    label: 'Go to Habits',      icon: 'checkSquare', type: 'nav', action: () => navigate('habits') },
  { id: 'nav-media',     label: 'Go to Media',       icon: 'book',      type: 'nav', action: () => navigate('media') },
  { id: 'nav-settings',  label: 'Go to Settings',    icon: 'settings',  type: 'nav', action: () => navigate('settings') },
  { id: 'log-water',     label: 'Log Water (+1 cup)', icon: 'water',    type: 'log', action: () => quickLog('water', 1) },
  { id: 'log-steps',     label: 'Log Steps (+1000)',  icon: 'footprints', type: 'log', action: () => quickLog('steps', 1000) },
  { id: 'log-weight',    label: 'Log Weight',         icon: 'scale',    type: 'log', action: () => promptLog('weight', 'Enter weight (kg)') },
  { id: 'log-sleep',     label: 'Log Sleep',          icon: 'moon',     type: 'log', action: () => promptLog('sleep', 'Enter sleep hours') },
  { id: 'log-calories',  label: 'Log Calories',       icon: 'flame',    type: 'log', action: () => promptLog('calories', 'Enter calories') },
  { id: 'log-protein',   label: 'Log Protein',        icon: 'target',   type: 'log', action: () => promptLog('protein', 'Enter protein (g)') },
];

function quickLog(field, increment) {
  const dateStr = getState('dateStr');
  const day = getDayLog(dateStr);
  const newVal = (day[field] || 0) + increment;
  updateDayLog(dateStr, { [field]: newVal });
  showToast(`${field} updated to ${newVal.toLocaleString()}`, 'success');
  closePalette();
}

function promptLog(field, promptText) {
  closePalette();
  // Use setTimeout to avoid focus conflict
  setTimeout(() => {
    const value = window.prompt(promptText);
    if (value !== null && value.trim() !== '') {
      const num = parseFloat(value.trim());
      if (!isNaN(num) && num > 0) {
        const dateStr = getState('dateStr');
        updateDayLog(dateStr, { [field]: num });
        showToast(`${field} logged: ${num}`, 'success');
      } else {
        showToast('Invalid number', 'warning');
      }
    }
  }, 100);
}

function filterCommands(query) {
  if (!query) return COMMANDS;
  const lower = query.toLowerCase();
  return COMMANDS.filter(c => c.label.toLowerCase().includes(lower));
}

function renderResults(results, selectedIndex) {
  const list = document.getElementById('cmd-results');
  if (!list) return;
  list.replaceChildren();

  results.forEach((cmd, i) => {
    const item = el('div', {
      class: `cmd-item${i === selectedIndex ? ' cmd-selected' : ''}`,
      id: `cmd-item-${i}`,
      onClick: () => {
        cmd.action();
        closePalette();
      },
    },
      el('div', { class: 'cmd-item-left' },
        icon(ICONS[cmd.icon], { size: 16 }),
        el('span', {}, cmd.label)
      ),
      el('span', { class: 'cmd-type-badge' }, cmd.type === 'nav' ? 'Navigate' : 'Quick Log')
    );
    list.appendChild(item);
  });
}

export function openPalette() {
  if (isOpen) return;
  isOpen = true;

  // Overlay
  overlayEl = el('div', {
    class: 'cmd-overlay',
    onClick: closePalette,
  });

  // Palette
  paletteEl = el('div', { class: 'cmd-palette', id: 'command-palette' });

  const input = el('input', {
    class: 'cmd-input',
    type: 'text',
    placeholder: 'Type a command…',
    id: 'cmd-search',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  const results = el('div', { class: 'cmd-results', id: 'cmd-results' });
  const hint = el('div', { class: 'cmd-hint' },
    el('span', {}, '↑↓ Navigate'),
    el('span', {}, '↵ Select'),
    el('span', {}, 'Esc Close')
  );

  paletteEl.appendChild(el('div', { class: 'cmd-header' },
    icon(ICONS.search, { size: 18 }),
    input
  ));
  paletteEl.appendChild(results);
  paletteEl.appendChild(hint);

  document.body.appendChild(overlayEl);
  document.body.appendChild(paletteEl);

  // Animate in
  requestAnimationFrame(() => {
    overlayEl.classList.add('cmd-overlay-visible');
    paletteEl.classList.add('cmd-visible');
    input.focus();
  });

  let selectedIndex = 0;
  let currentResults = COMMANDS;
  renderResults(currentResults, selectedIndex);

  // Input handler
  input.addEventListener('input', () => {
    currentResults = filterCommands(input.value);
    selectedIndex = 0;
    renderResults(currentResults, selectedIndex);
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      renderResults(currentResults, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderResults(currentResults, selectedIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        currentResults[selectedIndex].action();
        closePalette();
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });
}

export function closePalette() {
  if (!isOpen) return;
  isOpen = false;

  if (paletteEl) paletteEl.classList.remove('cmd-visible');
  if (overlayEl) overlayEl.classList.remove('cmd-overlay-visible');

  setTimeout(() => {
    if (paletteEl) { paletteEl.remove(); paletteEl = null; }
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }, 200);
}

export function togglePalette() {
  if (isOpen) closePalette();
  else openPalette();
}

// ─── Global Keyboard Shortcuts ───

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (mod && e.key === 'k') {
      e.preventDefault();
      togglePalette();
      return;
    }

    if (mod && !e.shiftKey) {
      switch (e.key) {
        case '1': e.preventDefault(); navigate('dashboard'); break;
        case '2': e.preventDefault(); navigate('fitness'); break;
        case '3': e.preventDefault(); navigate('habits'); break;
        case '4': e.preventDefault(); navigate('media'); break;
        case '5': e.preventDefault(); navigate('settings'); break;
      }
    }
  });
}
