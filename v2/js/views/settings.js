// =============================================================
// ALIGN v2 — Settings View
// Profile, goals, preferences, auth
// =============================================================

import { el, icon, ICONS } from '../dom.js';
import {
  getState, setState,
  getGeminiKey, setGeminiKey,
  getOmdbKey, setOmdbKey,
  computeDailyScore
} from '../state.js';
import { showBottomSheet, formGroup, formInput } from '../components/bottom-sheet.js';
import { showToast } from '../components/toast.js';
import {
  auth, db, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  doc, setDoc, getDoc,
} from '../firebase-config.js';

export function renderSettings(container) {
  const profile = getState('profile') || {};
  const user = getState('user');

  const page = el('div', { class: 'settings-page view-enter' });
  const wrap = el('div', { class: 'container' });

  // Header
  wrap.appendChild(el('div', { class: 'page-header' },
    el('span', { class: 'kicker' }, 'Preferences'),
    el('h2', {}, 'Settings')
  ));

  // Profile section
  const profileSection = el('div', { class: 'settings-section' });
  profileSection.appendChild(el('h4', { class: 'settings-section-title' }, 'Profile'));

  profileSection.appendChild(createSettingRow('Name', profile.name || 'Not set', () => {
    editField('Name', 'name', profile.name || '', container);
  }));
  profileSection.appendChild(createSettingRow('Age', profile.age ? `${profile.age} years` : 'Not set', () => {
    editField('Age', 'age', profile.age || '', container, 'number');
  }));
  profileSection.appendChild(createSettingRow('Current Weight', profile.currentWeight ? `${profile.currentWeight} kg` : 'Not set', () => {
    editField('Current Weight (kg)', 'currentWeight', profile.currentWeight || '', container, 'number');
  }));
  profileSection.appendChild(createSettingRow('Goal Weight', profile.goalWeight ? `${profile.goalWeight} kg` : 'Not set', () => {
    editField('Goal Weight (kg)', 'goalWeight', profile.goalWeight || '', container, 'number');
  }));
  wrap.appendChild(profileSection);

  // Goals section
  const goalsSection = el('div', { class: 'settings-section' });
  goalsSection.appendChild(el('h4', { class: 'settings-section-title' }, 'Daily Targets'));

  goalsSection.appendChild(createSettingRow('Steps', `${(profile.targetSteps || 10000).toLocaleString()}`, () => {
    editField('Step Goal', 'targetSteps', profile.targetSteps || 10000, container, 'number');
  }));
  goalsSection.appendChild(createSettingRow('Calories', `${profile.targetCalories || 2000} kcal`, () => {
    editField('Calorie Goal (kcal)', 'targetCalories', profile.targetCalories || 2000, container, 'number');
  }));
  goalsSection.appendChild(createSettingRow('Protein', `${profile.targetProtein || 150}g`, () => {
    editField('Protein Goal (g)', 'targetProtein', profile.targetProtein || 150, container, 'number');
  }));
  goalsSection.appendChild(createSettingRow('Water', `${profile.targetWater || 8} cups`, () => {
    editField('Water Goal (cups)', 'targetWater', profile.targetWater || 8, container, 'number');
  }));
  goalsSection.appendChild(createSettingRow('Sleep', `${profile.targetSleep || 8}h`, () => {
    editField('Sleep Goal (hours)', 'targetSleep', profile.targetSleep || 8, container, 'number');
  }));
  wrap.appendChild(goalsSection);

  // AI Config & Integrations
  const aiSection = el('div', { class: 'settings-section' });
  aiSection.appendChild(el('h4', { class: 'settings-section-title' }, 'Integrations'));

  const geminiKeyVal = getGeminiKey() || '';
  aiSection.appendChild(createSettingRow('Gemini API Key', geminiKeyVal ? '••••••' + geminiKeyVal.slice(-4) : 'Not set', () => {
    editKeyField('Gemini API Key', 'geminiApiKey', geminiKeyVal, container);
  }));

  const omdbKeyVal = getOmdbKey() || '';
  aiSection.appendChild(createSettingRow('OMDB API Key', omdbKeyVal ? '••••••' + omdbKeyVal.slice(-4) : 'Not set', () => {
    editKeyField('OMDB API Key', 'omdbApiKey', omdbKeyVal, container);
  }));

  wrap.appendChild(aiSection);

  // Account section
  const accountSection = el('div', { class: 'settings-section' });
  accountSection.appendChild(el('h4', { class: 'settings-section-title' }, 'Account'));

  if (user) {
    accountSection.appendChild(createSettingRow(
      'Signed in as',
      user.email || user.displayName || 'Google Account',
      null
    ));
    accountSection.appendChild(el('button', {
      class: 'btn btn-secondary',
      style: { width: '100%', marginTop: 'var(--space-3)' },
      onClick: async () => {
        try {
          await signOut(auth);
          setState('user', null);
          showToast('Signed out', { type: 'info' });
          container.replaceChildren();
          renderSettings(container);
        } catch (e) {
          showToast('Sign out failed', { type: 'error' });
        }
      },
    }, icon(ICONS.logOut, { size: 16 }), 'Sign Out'));
  } else {
    accountSection.appendChild(el('button', {
      class: 'btn btn-primary',
      style: { width: '100%' },
      onClick: async () => {
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          setState('user', result.user);
          showToast(`Welcome, ${result.user.displayName || 'User'}!`, { type: 'success' });
          container.replaceChildren();
          renderSettings(container);
        } catch (e) {
          console.error('Sign in failed:', e);
          showToast('Sign in failed', { type: 'error' });
        }
      },
    }, icon(ICONS.logIn, { size: 16 }), 'Sign in with Google'));
  }

  wrap.appendChild(accountSection);

  // Data section
  const dataSection = el('div', { class: 'settings-section' });
  dataSection.appendChild(el('h4', { class: 'settings-section-title' }, 'Data'));

  const exportJsonBtn = el('button', {
    class: 'btn btn-secondary',
    style: { width: '100%', marginBottom: 'var(--space-2)' },
    onClick: async () => {
      exportJsonBtn.disabled = true;
      exportJsonBtn.replaceChildren(el('span', { class: 'spinner' }), ' Preparing Export...');
      try {
        await new Promise(resolve => setTimeout(resolve, 800)); // micro-interaction loader
        exportJSON();
      } catch (e) {
        showToast('JSON Export failed', { type: 'error' });
      } finally {
        exportJsonBtn.disabled = false;
        exportJsonBtn.replaceChildren(icon(ICONS.arrowDown, { size: 16 }), ' Export Backup (JSON)');
      }
    },
  }, icon(ICONS.arrowDown, { size: 16 }), ' Export Backup (JSON)');

  const exportCsvBtn = el('button', {
    class: 'btn btn-secondary',
    style: { width: '100%' },
    onClick: async () => {
      exportCsvBtn.disabled = true;
      exportCsvBtn.replaceChildren(el('span', { class: 'spinner' }), ' Generating CSV...');
      try {
        await new Promise(resolve => setTimeout(resolve, 800)); // micro-interaction loader
        exportCSV();
      } catch (e) {
        showToast('CSV Export failed', { type: 'error' });
      } finally {
        exportCsvBtn.disabled = false;
        exportCsvBtn.replaceChildren(icon(ICONS.arrowDown, { size: 16 }), ' Export Logs (CSV)');
      }
    },
  }, icon(ICONS.arrowDown, { size: 16 }), ' Export Logs (CSV)');

  dataSection.appendChild(exportJsonBtn);
  dataSection.appendChild(exportCsvBtn);
  wrap.appendChild(dataSection);

  // Version
  wrap.appendChild(el('div', { class: 'settings-version' },
    el('p', {}, 'Align v2.0'),
    el('p', { class: 'caption' }, 'Built with intention.')
  ));

  page.appendChild(wrap);
  container.appendChild(page);
}

function createSettingRow(label, value, onClick) {
  const row = el('div', {
    class: `setting-row${onClick ? ' setting-tappable' : ''}`,
    onClick: onClick || undefined,
  },
    el('span', { class: 'setting-label' }, label),
    el('div', { class: 'setting-right' },
      el('span', { class: 'setting-value' }, value),
      onClick ? icon(ICONS.chevronRight, { size: 16 }) : null
    )
  );
  return row;
}

function editField(label, key, currentValue, container, type = 'text') {
  let input;

  const sheet = showBottomSheet({
    title: `Edit ${label}`,
    render: (content) => {
      input = formInput({
        type,
        placeholder: label,
        value: String(currentValue),
        id: 'edit-field',
        inputmode: type === 'number' ? 'decimal' : 'text',
      });
      content.appendChild(formGroup(label, input));

      // Auto-focus
      requestAnimationFrame(() => input.focus());

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          let val = input.value.trim();
          if (type === 'number') val = parseFloat(val) || 0;

          const profile = { ...(getState('profile') || {}), [key]: val };
          setState('profile', profile);

          showToast(`${label} updated`, { type: 'success' });
          sheet.close();
          container.replaceChildren();
          renderSettings(container);
        },
      }, 'Save');
      content.appendChild(saveBtn);
    },
  });
}

function editKeyField(label, stateKey, currentValue, container) {
  let input;

  const sheet = showBottomSheet({
    title: `Edit ${label}`,
    render: (content) => {
      input = formInput({
        type: 'text',
        placeholder: label,
        value: String(currentValue),
        id: 'edit-field',
      });
      content.appendChild(formGroup(label, input));

      // Auto-focus
      requestAnimationFrame(() => input.focus());

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: '100%', marginTop: 'var(--space-4)' },
        onClick: () => {
          const val = input.value.trim();
          
          if (stateKey === 'geminiApiKey') {
            setGeminiKey(val);
            const profile = { ...(getState('profile') || {}) };
            profile.hasGeminiKey = !!val;
            setState('profile', profile);
          } else if (stateKey === 'omdbApiKey') {
            setOmdbKey(val);
            const profile = { ...(getState('profile') || {}) };
            profile.hasOmdbKey = !!val;
            setState('profile', profile);
          }

          showToast(`${label} updated`, { type: 'success' });
          sheet.close();
          container.replaceChildren();
          renderSettings(container);
        },
      }, 'Save');
      content.appendChild(saveBtn);
    },
  });
}

function exportJSON() {
  try {
    const cleanProfile = { ...(getState('profile') || {}) };
    delete cleanProfile.geminiApiKey;
    delete cleanProfile.omdbApiKey;
    delete cleanProfile.deviceId;
    delete cleanProfile.deviceToken;
    delete cleanProfile.token;
    delete cleanProfile.authToken;
    delete cleanProfile.credential;
    delete cleanProfile.credentials;

    const data = {
      exportDate: new Date().toISOString(),
      profile: cleanProfile,
      dailyLogs: getState('logs') || {},
      habits: getState('habits') || [],
      workoutSplits: getState('workoutSplits') || {},
      recipes: getState('recipes') || [],
      books: getState('books') || [],
      movies: getState('movies') || [],
      personalRecords: getState('personalRecords') || {},
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `align-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Data exported successfully', { type: 'success' });
  } catch (e) {
    console.error('Export JSON failed:', e);
    showToast('Export failed', { type: 'error' });
  }
}

function exportCSV() {
  try {
    const logs = getState('logs') || {};
    const dates = Object.keys(logs).sort();

    const headers = [
      'date',
      'steps',
      'water',
      'sleep',
      'weight',
      'calories',
      'protein',
      'habitsCompleted count',
      'workoutSplitName',
      'dailyScore'
    ];
    const rows = [headers.join(',')];

    dates.forEach(date => {
      const day = logs[date];
      const steps = day.steps || 0;
      const water = day.water || 0;
      const sleep = day.sleep || 0;
      const weight = day.weight || 0;
      const calories = day.calories || 0;
      const protein = day.protein || 0;
      const habitsCount = day.habitsCompleted ? day.habitsCompleted.length : 0;
      const workoutSplitName = day.workoutSplitName || '';
      const dailyScore = computeDailyScore(day);

      const escapedSplit = workoutSplitName.includes(',') ? `"${workoutSplitName.replace(/"/g, '""')}"` : workoutSplitName;

      const row = [
        date,
        steps,
        water,
        sleep,
        weight,
        calories,
        protein,
        habitsCount,
        escapedSplit,
        dailyScore
      ];
      rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `align-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Logs exported successfully', { type: 'success' });
  } catch (e) {
    console.error('Export CSV failed:', e);
    showToast('CSV Export failed', { type: 'error' });
  }
}
