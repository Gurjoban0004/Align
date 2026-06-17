// =============================================================
// ALIGN v2 — Apple Health Sync Client
// Fetches health data from the local server (populated by Health Auto Export)
// and merges it into the app's daily logs
// =============================================================

import { getState, updateDayLog, getDayLog } from '../state.js';
import { showToast } from '../components/toast.js';

// ─── Fetch & Apply Health Data ───

/**
 * Pull health data from the server and merge into local logs.
 * Called on app start and on manual "Sync Now" tap.
 */
export async function syncHealthData(silent = true) {
  try {
    const res = await fetch('/api/health-data', { cache: 'no-store' });
    if (!res.ok) return false;

    const healthData = await res.json();
    const dates = Object.keys(healthData);
    if (dates.length === 0) return false;

    let synced = 0;
    dates.forEach(date => {
      const fields = healthData[date];
      if (!fields || typeof fields !== 'object') return;

      // Build a clean update object — only include fields that have real values
      const update = {};
      const HEALTH_FIELDS = [
        'steps', 'sleep', 'weight', 'activeBurn', 'calories',
        'protein', 'carbs', 'fat', 'water',
        'heartRate', 'restingHeartRate', 'respiratoryRate',
        'bloodOxygen', 'bodyFat',
      ];

      HEALTH_FIELDS.forEach(field => {
        if (fields[field] != null && fields[field] !== 0) {
          update[field] = fields[field];
        }
      });

      if (Object.keys(update).length > 0) {
        // Mark as health-synced but don't overwrite user-entered data
        // Strategy: health data wins for "device" fields, user manual entry wins for nutrition
        const existingDay = getDayLog(date);

        // Only update steps if health data > manual entry (health sensor is more accurate)
        if (update.steps && existingDay.steps > 0 && existingDay.steps > update.steps) {
          delete update.steps; // keep higher manual or prior sync value
        }

        update._healthSynced = true;
        update._healthSyncTime = fields._lastHealthSync || new Date().toISOString();

        updateDayLog(date, update);
        synced++;
      }
    });

    if (!silent && synced > 0) {
      showToast(`Apple Health synced — ${synced} day${synced === 1 ? '' : 's'} updated`, { type: 'success' });
    }
    return synced > 0;
  } catch (e) {
    if (!silent) {
      showToast('Health sync failed — is the server running?', { type: 'error' });
    }
    return false;
  }
}

/**
 * Fetch server info (IP, port, token) for display in Settings.
 */
export async function getHealthServerInfo() {
  try {
    const res = await fetch('/api/health-info', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

/**
 * Build the webhook URL the user pastes into Health Auto Export.
 */
export function buildWebhookUrl(ip, port, token) {
  return `http://${ip}:${port}/api/health-sync?token=${token}`;
}
