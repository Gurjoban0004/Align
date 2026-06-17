// =============================================================
// ALIGN v2 — Cloud Synchronization Engine
// Synchronizes state with Firestore for logged-in users
// =============================================================

import { db, auth, doc, setDoc, onSnapshot } from './firebase-config.js';
import { getState, setState, subscribe } from './state.js';

let userPrefUnsubscribe = null;
let dayLogUnsubscribe = null;
let currentSyncedDate = null;
let isSyncingFromRemote = false;

// Keys that represent user preferences/profile stored in the root user doc
const SYNC_PREF_KEYS = [
  'profile',
  'workoutSplits',
  'recipes',
  'habits',
  'books',
  'movies',
  'personalRecords',
  'userModel',
  'insightQueue'
];

/**
 * Initialize cloud synchronization.
 * Listens to auth changes and sets up/tears down Firestore sync.
 */
export function initCloudSync() {
  if (!auth || !db) {
    console.info('[Align Sync] Cloud sync unavailable — Firebase not initialized');
    return;
  }

  // Listen for auth state changes
  subscribe('user', (user) => {
    if (user) {
      console.log('[Align Sync] User signed in:', user.email);
      setupSync(user);
    } else {
      console.log('[Align Sync] User signed out');
      teardownSync();
    }
  });

  // Listen for date changes to shift the daily log Firestore listener
  subscribe('dateStr', (newDate) => {
    const user = getState('user');
    if (user && newDate !== currentSyncedDate) {
      setupDayLogSync(user, newDate);
    }
  });

  // Subscribe to all local state mutations and sync them to Firestore
  // We use isSyncingFromRemote flag to ignore changes originating from Firestore.
  
  // 1. Sync preferences keys
  SYNC_PREF_KEYS.forEach(key => {
    subscribe(key, (newValue) => {
      if (isSyncingFromRemote) return;
      const user = getState('user');
      if (!user) return;
      
      console.log(`[Align Sync] Local change [${key}] → Syncing to Firestore`);
      saveUserPreferences(user, key, newValue);
    });
  });

  // 2. Sync daily logs
  subscribe('logs', (newValue) => {
    if (isSyncingFromRemote) return;
    const user = getState('user');
    if (!user) return;

    const date = getState('dateStr');
    const dayData = newValue[date];
    if (dayData) {
      console.log(`[Align Sync] Local change [logs/${date}] → Syncing to Firestore`);
      saveDayLog(user, date, dayData);
    }
  });
}

function setupSync(user) {
  teardownSync();

  // 1. Listen to remote user document (preferences, profile, habits, etc.)
  const userDocRef = doc(db, 'users', user.uid);
  userPrefUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() || {};
      
      isSyncingFromRemote = true;
      try {
        SYNC_PREF_KEYS.forEach(key => {
          if (data[key] !== undefined) {
            const localVal = getState(key);
            // Compare as JSON to prevent unnecessary state updates & loops
            if (JSON.stringify(localVal) !== JSON.stringify(data[key])) {
              setState(key, data[key]);
            }
          }
        });
      } catch (err) {
        console.error('[Align Sync] Error applying remote preferences:', err);
      } finally {
        isSyncingFromRemote = false;
      }
    } else {
      // First-time login: push local preferences to cloud
      console.log('[Align Sync] Remote user doc empty — pushing local preferences');
      const prefs = {};
      SYNC_PREF_KEYS.forEach(key => {
        prefs[key] = getState(key) || null;
      });
      setDoc(userDocRef, prefs, { merge: true }).catch(err => {
        console.error('[Align Sync] Failed to push local preferences:', err);
      });
    }
  }, (err) => {
    console.error('[Align Sync] Firestore user listener error:', err);
  });

  // 2. Listen to remote day log
  const date = getState('dateStr');
  setupDayLogSync(user, date);
}

function setupDayLogSync(user, date) {
  if (dayLogUnsubscribe) {
    dayLogUnsubscribe();
    dayLogUnsubscribe = null;
  }
  
  currentSyncedDate = date;
  const logDocRef = doc(db, 'users', user.uid, 'dailyLogs', date);
  dayLogUnsubscribe = onSnapshot(logDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const remoteLog = docSnap.data();
      
      isSyncingFromRemote = true;
      try {
        const localLogs = getState('logs') || {};
        const localLog = localLogs[date];
        
        if (JSON.stringify(localLog) !== JSON.stringify(remoteLog)) {
          const updatedLogs = { ...localLogs, [date]: remoteLog };
          setState('logs', updatedLogs);
        }
      } catch (err) {
        console.error('[Align Sync] Error applying remote daily log:', err);
      } finally {
        isSyncingFromRemote = false;
      }
    } else {
      // If no remote day log exists, upload current local day log (if populated)
      const localLogs = getState('logs') || {};
      const localLog = localLogs[date];
      if (localLog) {
        console.log(`[Align Sync] Remote day log empty for ${date} — uploading local log`);
        saveDayLog(user, date, localLog);
      }
    }
  }, (err) => {
    console.error(`[Align Sync] Firestore daily log listener error for ${date}:`, err);
  });
}

function teardownSync() {
  if (userPrefUnsubscribe) {
    userPrefUnsubscribe();
    userPrefUnsubscribe = null;
  }
  if (dayLogUnsubscribe) {
    dayLogUnsubscribe();
    dayLogUnsubscribe = null;
  }
  currentSyncedDate = null;
}

async function saveUserPreferences(user, key, value) {
  if (!db) return;
  const userDocRef = doc(db, 'users', user.uid);
  try {
    await setDoc(userDocRef, { [key]: value }, { merge: true });
  } catch (err) {
    console.warn(`[Align Sync] Failed to save preference [${key}]:`, err.message);
  }
}

async function saveDayLog(user, date, dayData) {
  if (!db) return;
  const logDocRef = doc(db, 'users', user.uid, 'dailyLogs', date);
  try {
    await setDoc(logDocRef, dayData, { merge: true });
  } catch (err) {
    console.warn(`[Align Sync] Failed to save day log [${date}]:`, err.message);
  }
}
