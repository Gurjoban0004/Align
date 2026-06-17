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
import { syncHealthData, getHealthServerInfo, buildWebhookUrl } from '../ai/health-sync.js';
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

  // Apple Health section
  const healthSection = el('div', { class: 'settings-section' });
  healthSection.appendChild(el('h4', { class: 'settings-section-title' }, '🍎 Apple Health'));

  // Status + last sync row
  const logs = getState('logs') || {};
  const today = getState('dateStr');
  const todayLog = logs[today] || {};
  const lastSyncTime = todayLog._healthSyncTime;
  const isConnected = !!lastSyncTime;
  const lastSyncLabel = lastSyncTime
    ? `Last sync: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not synced yet';

  const statusDot = el('span', {
    class: `health-status-dot ${isConnected ? 'connected' : 'disconnected'}`
  });
  const statusText = el('span', { class: 'health-status-label' },
    isConnected ? 'Connected' : 'Not connected'
  );
  const statusRow = el('div', { class: 'health-status-row' },
    el('div', { class: 'health-status-indicator' }, statusDot, statusText),
    el('span', { class: 'caption', style: { color: 'var(--text-subtle)' } }, lastSyncLabel)
  );
  healthSection.appendChild(statusRow);

  // Webhook URL card (loaded async)
  const webhookUrlText = el('p', { class: 'health-webhook-url', id: 'webhook-url-text' }, 'Loading...');
  const webhookCard = el('div', { class: 'health-webhook-card' },
    el('p', { class: 'health-webhook-label' }, 'Webhook URL for Health Auto Export'),
    webhookUrlText
  );

  const copyBtn = el('button', {
    class: 'btn btn-secondary',
    style: { width: '100%', marginTop: 'var(--space-2)' },
    onClick: () => {
      const url = webhookUrlText.textContent;
      if (url && url !== 'Loading...') {
        navigator.clipboard.writeText(url).then(() => {
          showToast('Webhook URL copied!', { type: 'success' });
        }).catch(() => {
          showToast('Copy failed — select and copy manually', { type: 'error' });
        });
      }
    },
  }, '📋 Copy Webhook URL');

  webhookCard.appendChild(copyBtn);
  healthSection.appendChild(webhookCard);

  // Load server info asynchronously (adaptive: handles localhost dev server port fallback and production Vercel)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    getHealthServerInfo().then(info => {
      if (info) {
        const url = buildWebhookUrl(info.ip, info.port, info.token);
        webhookUrlText.textContent = url;
      } else {
        // Local fallback using localhost address and local profile token
        let token = profile.syncToken;
        if (!token) {
          token = 't' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          profile.syncToken = token;
          setState('profile', { ...profile });
        }
        webhookUrlText.textContent = `${window.location.origin}/api/health-sync?token=${token}`;
      }
    });
  } else {
    // Production Vercel URL
    let token = profile.syncToken;
    if (!token) {
      token = 't' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      profile.syncToken = token;
      setState('profile', { ...profile });
    }
    webhookUrlText.textContent = `${window.location.origin}/api/health-sync?token=${token}`;
  }

  // Sync Now button
  const syncBtn = el('button', {
    class: 'btn btn-primary',
    style: { width: '100%', marginTop: 'var(--space-3)' },
    onClick: async () => {
      syncBtn.disabled = true;
      syncBtn.replaceChildren(el('span', { class: 'spinner' }), ' Syncing...');
      const ok = await syncHealthData(false);
      syncBtn.disabled = false;
      syncBtn.replaceChildren('🔄 Sync Now');
      if (!ok) {
        showToast('No new health data available yet', { type: 'info' });
      } else {
        container.replaceChildren();
        renderSettings(container);
      }
    },
  }, '🔄 Sync Now');
  healthSection.appendChild(syncBtn);

  // Setup guide link
  healthSection.appendChild(el('div', { class: 'health-setup-guide' },
    el('p', { class: 'caption' },
      '1. Install ',
      el('strong', {}, 'Health Auto Export'),
      ' (free) from the App Store'
    ),
    el('p', { class: 'caption' }, '2. Open app → Export → REST API → paste Webhook URL above'),
    el('p', { class: 'caption' }, '3. Set sync frequency to Hourly — done! ✓')
  ));

  wrap.appendChild(healthSection);

  // ─── Cloud Sync / Google Account Sync ───
  const cloudSection = el('div', { class: 'settings-section' });
  cloudSection.appendChild(el('h4', { class: 'settings-section-title' }, '☁️ Cloud Sync'));

  if (user) {
    // Status row (connected)
    const fbStatusDot = el('span', { class: 'health-status-dot connected' });
    const fbStatusText = el('span', { class: 'health-status-label' }, 'Sync Connected');
    cloudSection.appendChild(el('div', { class: 'health-status-row', style: { marginBottom: 'var(--space-3)' } },
      el('div', { class: 'health-status-indicator' }, fbStatusDot, fbStatusText),
      el('span', { class: 'caption', style: { color: 'var(--text-subtle)' } }, 'Sync active ✓')
    ));

    // Profile card
    const avatarImg = user.photoURL 
      ? el('img', { 
          src: user.photoURL, 
          alt: 'Avatar', 
          style: { 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            marginRight: 'var(--space-3)',
            border: '2px solid var(--accent-coral, #cc785c)'
          } 
        })
      : el('span', { 
          style: { 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--surface-soft)', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: 'var(--space-3)',
            color: 'var(--accent-coral, #cc785c)'
          } 
        }, icon(ICONS.user, { size: 20 }));

    const profileDetails = el('div', { style: { display: 'flex', flexDirection: 'column' } },
      el('span', { style: { fontWeight: '600', color: 'var(--ink)' } }, user.displayName || 'Google Account'),
      el('span', { class: 'caption', style: { color: 'var(--text-subtle)' } }, user.email)
    );

    cloudSection.appendChild(el('div', { 
      style: { 
        display: 'flex', 
        alignItems: 'center', 
        padding: 'var(--space-3)', 
        background: 'var(--surface-soft)', 
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-3)'
      } 
    }, avatarImg, profileDetails));

    // Sign out button
    cloudSection.appendChild(el('button', {
      class: 'btn btn-secondary',
      style: { width: '100%', marginTop: 'var(--space-2)' },
      onClick: async () => {
        try {
          await signOut(auth);
          setState('user', null);
          showToast('Signed out', { type: 'info' });
          setTimeout(() => window.location.reload(), 500);
        } catch (e) {
          showToast('Sign out failed', { type: 'error' });
        }
      },
    }, icon(ICONS.logOut, { size: 16 }), ' Sign Out'));
  } else {
    // Status row (disconnected)
    const fbStatusDot = el('span', { class: 'health-status-dot disconnected' });
    const fbStatusText = el('span', { class: 'health-status-label' }, 'Not Connected');
    cloudSection.appendChild(el('div', { class: 'health-status-row', style: { marginBottom: 'var(--space-3)' } },
      el('div', { class: 'health-status-indicator' }, fbStatusDot, fbStatusText),
      el('span', { class: 'caption', style: { color: 'var(--text-subtle)' } }, 'Local only')
    ));

    // Explainer text
    cloudSection.appendChild(el('div', { class: 'health-setup-guide', style: { marginBottom: 'var(--space-3)' } },
      el('p', { class: 'caption' }, 'Sign in with your Google account to automatically sync your profile, logs, and routines across devices.')
    ));

    // Sign in button
    const signInBtn = el('button', {
      class: 'btn btn-primary',
      style: { width: '100%' },
      onClick: async () => {
        signInBtn.disabled = true;
        signInBtn.replaceChildren(el('span', { class: 'spinner' }), ' Connecting...');
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          setState('user', result.user);
          showToast(`Welcome, ${result.user.displayName || 'User'}!`, { type: 'success' });
          container.replaceChildren();
          renderSettings(container);
        } catch (e) {
          console.error('Sign in failed:', e);
          showToast('Sign in failed — try again', { type: 'error' });
        } finally {
          signInBtn.disabled = false;
          signInBtn.replaceChildren(icon(ICONS.logIn, { size: 16 }), ' Sign in with Google');
        }
      },
    }, icon(ICONS.logIn, { size: 16 }), ' Sign in with Google');
    
    cloudSection.appendChild(signInBtn);
  }

  wrap.appendChild(cloudSection);


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
          } else if (stateKey === 'omdbApiKey') {
            setOmdbKey(val);
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
