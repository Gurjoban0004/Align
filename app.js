import * as firebase from './firebase-config.js';
import * as gemini from './gemini.js';

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}

// --- DOM Builder Helpers (Strictly No innerHTML, conforming to Security rules) ---
function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof val === 'function') {
      element.addEventListener(key.substring(2).toLowerCase(), val);
    } else if (key === 'class') {
      element.className = val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(element.style, val);
    } else {
      element.setAttribute(key, val);
    }
  }
  for (const child of children) {
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement || child instanceof SVGElement) {
      element.appendChild(child);
    }
  }
  return element;
}

// SVG Icon Helper
function icon(d, classList = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (classList) {
    svg.setAttribute("class", classList);
  }
  
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  return svg;
}

// Standard SVG Icon Paths (Lucide style)
const ICONS = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  fitness: "M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3",
  habits: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  media: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3.5A2.5 2.5 0 0 1 6.5 1H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z",
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M20 6L9 17l-5-5",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6",
  chevronRight: "M9 18l6-6-6-6",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
};

// --- Application State ---
let state = {
  user: null,
  activeView: 'dashboard',
  dateStr: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  
  // Custom workout split routines
  workoutSplit: {
    "Push Day": [
      { name: "Bench Press", sets: 4, reps: 10, weight: 60 },
      { name: "Incline DB Press", sets: 3, reps: 12, weight: 20 },
      { name: "Tricep Pushdowns", sets: 4, reps: 15, weight: 25 }
    ],
    "Pull Day": [
      { name: "Lat Pulldown", sets: 4, reps: 10, weight: 50 },
      { name: "Barbell Row", sets: 3, reps: 8, weight: 40 },
      { name: "Bicep Curls", sets: 3, reps: 12, weight: 12 }
    ],
    "Legs Day": [
      { name: "Squats", sets: 4, reps: 8, weight: 80 },
      { name: "Romanian Deadlift", sets: 3, reps: 10, weight: 60 },
      { name: "Calf Raises", sets: 4, reps: 15, weight: 40 }
    ]
  },
  
  // Custom Recipes
  recipes: [
    { title: "High Protein Oatmeal", calories: 450, protein: 30, desc: "Oats, whey, almond milk, banana" },
    { title: "Chicken Rice Bowl", calories: 650, protein: 45, desc: "Chicken breast, jasmine rice, broccoli, olive oil" }
  ],
  
  // Daily Logs indexed by date (YYYY-MM-DD)
  logs: {}
};

// Get default empty daily logs structure
function getEmptyDayLog() {
  return {
    steps: 0,
    water: 0, // cups
    sleep: 0, // hours
    weight: 0, // kg
    calories: 0,
    protein: 0,
    meals: [],
    workouts: [], // exercises completed today
    habitsCompleted: [], // checklist IDs
    aiReview: null // cached review for the day
  };
}

function getTodayLog() {
  if (!state.logs[state.dateStr]) {
    state.logs[state.dateStr] = getEmptyDayLog();
  }
  return state.logs[state.dateStr];
}

// Local Storage Fallbacks
function loadLocalState() {
  const localLogs = localStorage.getItem('life_tracker_logs');
  const localSplits = localStorage.getItem('life_tracker_splits');
  const localRecipes = localStorage.getItem('life_tracker_recipes');
  
  if (localLogs) state.logs = JSON.parse(localLogs);
  if (localSplits) state.workoutSplit = JSON.parse(localSplits);
  if (localRecipes) state.recipes = JSON.parse(localRecipes);
}

function saveLocalState() {
  localStorage.setItem('life_tracker_logs', JSON.stringify(state.logs));
  localStorage.setItem('life_tracker_splits', JSON.stringify(state.workoutSplit));
  localStorage.setItem('life_tracker_recipes', JSON.stringify(state.recipes));
}

// --- IndexedDB Offline Sync Queue ---
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("LifeTrackerOfflineDB", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pendingWrites")) {
        db.createObjectStore("pendingWrites", { keyPath: "date" });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function queueOfflineWrite(date, data) {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction("pendingWrites", "readwrite");
    const store = tx.objectStore("pendingWrites");
    store.put({ date, data, timestamp: Date.now() });
    updateSyncStatusUI(true);
  } catch (e) {
    console.error("IndexedDB error:", e);
  }
}

async function flushOfflineQueue() {
  if (!navigator.onLine || !state.user || !firebase.db) return;
  
  try {
    const db = await openIndexedDB();
    const tx = db.transaction("pendingWrites", "readwrite");
    const store = tx.objectStore("pendingWrites");
    
    const request = store.getAll();
    request.onsuccess = async (e) => {
      const pending = e.target.result;
      if (pending.length === 0) {
        updateSyncStatusUI(false);
        return;
      }
      
      for (const item of pending) {
        const docRef = firebase.doc(firebase.db, "users", state.user.uid, "dailyLogs", item.date);
        try {
          await firebase.setDoc(docRef, item.data, { merge: true });
          const deleteTx = db.transaction("pendingWrites", "readwrite");
          deleteTx.objectStore("pendingWrites").delete(item.date);
        } catch (err) {
          console.error(`Failed to flush offline log for ${item.date}:`, err);
        }
      }
      console.log(`Synced ${pending.length} pending offline log(s) to Firestore.`);
      updateSyncStatusUI(false);
    };
  } catch (e) {
    console.error("Error flushing offline queue:", e);
  }
}

function updateSyncStatusUI(isPending) {
  const syncIndicator = document.getElementById('sync-status-indicator');
  if (syncIndicator) {
    if (isPending) {
      syncIndicator.textContent = "Offline - Local saves queued";
      syncIndicator.style.color = "var(--colors-warning)";
      syncIndicator.style.display = "inline";
    } else {
      syncIndicator.textContent = "Synced";
      syncIndicator.style.color = "var(--colors-success)";
      syncIndicator.style.display = "none";
    }
  }
}

window.addEventListener('online', flushOfflineQueue);

// --- 7-Day Trend Context Engine ---
function getWeeklyTrends(baseDateStr) {
  const baseDate = new Date(baseDateStr);
  let stepsSum = 0, stepsCount = 0;
  let sleepSum = 0, sleepCount = 0;
  let calSum = 0, calCount = 0;
  let weights = [];
  
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() - i);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const dayLog = state.logs[dateStr];
    if (dayLog) {
      if (dayLog.steps > 0) {
        stepsSum += dayLog.steps;
        stepsCount++;
      }
      if (dayLog.sleep > 0) {
        sleepSum += dayLog.sleep;
        sleepCount++;
      }
      if (dayLog.calories > 0) {
        calSum += dayLog.calories;
        calCount++;
      }
      if (dayLog.weight > 0) {
        weights.push({ date: dateStr, weight: dayLog.weight });
      }
    }
  }
  
  weights.sort((a, b) => a.date.localeCompare(b.date));
  let weightChange7d = 0;
  if (weights.length >= 2) {
    weightChange7d = weights[weights.length - 1].weight - weights[0].weight;
  }
  
  return {
    avgSteps7d: stepsCount > 0 ? Math.round(stepsSum / stepsCount) : 0,
    avgSleep7d: sleepCount > 0 ? parseFloat((sleepSum / sleepCount).toFixed(1)) : 0,
    avgCalories7d: calCount > 0 ? Math.round(calSum / calCount) : 0,
    weightChange7d
  };
}

// --- Firebase Syncing Engine ---
let firestoreUserUnsubscribe = null;
let firestoreLogUnsubscribe = null;

function setupFirestoreSync(user) {
  if (!firebase.db) return;

  // 1. Sync User Preferences (splits & recipes)
  const userDocRef = firebase.doc(firebase.db, "users", user.uid);
  firestoreUserUnsubscribe = firebase.onSnapshot(userDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      if (data.workoutSplit) state.workoutSplit = data.workoutSplit;
      if (data.recipes) state.recipes = data.recipes;
      saveLocalState();
      renderApp();
    } else {
      saveUserPreferences();
    }
  }, (err) => {
    console.error("Firestore user preferences sync error:", err);
  });

  // 2. Sync Active Date Log Document
  setupFirestoreLogSync(user, state.dateStr);
  
  // Flush any writes queued while offline
  flushOfflineQueue();
}

function setupFirestoreLogSync(user, date) {
  if (!firebase.db || !user) return;
  
  if (firestoreLogUnsubscribe) {
    firestoreLogUnsubscribe();
    firestoreLogUnsubscribe = null;
  }

  const logDocRef = firebase.doc(firebase.db, "users", user.uid, "dailyLogs", date);
  firestoreLogUnsubscribe = firebase.onSnapshot(logDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      state.logs[date] = docSnapshot.data();
      saveLocalState();
      renderApp();
    } else {
      // Initialize local defaults if no database copy exists
      if (!state.logs[date]) {
        state.logs[date] = getEmptyDayLog();
        saveLocalState();
      }
    }
  }, (err) => {
    console.error(`Firestore dailyLogs sync error for ${date}:`, err);
  });
}

async function saveUserPreferences() {
  if (!firebase.db || !state.user) return;
  const userDocRef = firebase.doc(firebase.db, "users", state.user.uid);
  try {
    await firebase.setDoc(userDocRef, {
      workoutSplit: state.workoutSplit,
      recipes: state.recipes
    }, { merge: true });
  } catch (e) {
    console.error("Error saving user preferences to Firestore:", e);
  }
}

async function saveDayLog(date) {
  const dayData = state.logs[date];
  if (!dayData) return;

  saveLocalState();

  if (state.user && firebase.db) {
    const docRef = firebase.doc(firebase.db, "users", state.user.uid, "dailyLogs", date);
    try {
      await firebase.setDoc(docRef, dayData, { merge: true });
    } catch (e) {
      console.warn(`Firestore save failed for ${date}, queueing offline write:`, e);
      await queueOfflineWrite(date, dayData);
    }
  }
}

function queueSave() {
  saveLocalState();
  saveUserPreferences();
  saveDayLog(state.dateStr);
}


// --- Routing & Navigation Management ---
function handleNavigation() {
  const hash = window.location.hash || '#dashboard';
  const view = hash.replace('#', '');
  
  if (['dashboard', 'fitness', 'habits', 'media', 'settings'].includes(view)) {
    // If not authenticated and firebase is working, block access except settings
    if (firebase.auth && !state.user && firebase.isFirebaseConfigured() && view !== 'settings') {
      window.location.hash = '#auth';
      return;
    }
    
    state.activeView = view;
    renderApp();
  } else if (view === 'auth') {
    state.activeView = 'auth';
    renderApp();
  }
}

window.addEventListener('hashchange', handleNavigation);

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Load standard presets first
  loadLocalState();
  
  // Watch Authentication State
  if (firebase.auth) {
    firebase.onAuthStateChanged(firebase.auth, (user) => {
      state.user = user;
      
      if (user) {
        setupFirestoreSync(user);
        // If they were on Auth, direct to Dashboard
        if (window.location.hash === '#auth' || !window.location.hash) {
          window.location.hash = '#dashboard';
        }
      } else {
        if (firestoreUserUnsubscribe) {
          firestoreUserUnsubscribe();
          firestoreUserUnsubscribe = null;
        }
        if (firestoreLogUnsubscribe) {
          firestoreLogUnsubscribe();
          firestoreLogUnsubscribe = null;
        }
        
        if (firebase.isFirebaseConfigured()) {
          window.location.hash = '#auth';
        } else {
          // If no firebase setup, stay in local mode
          if (!window.location.hash) window.location.hash = '#dashboard';
        }
      }
      renderApp();
    });
  } else {
    // Local-only mode
    if (!window.location.hash) window.location.hash = '#dashboard';
    handleNavigation();
  }
  
  // Set up date selector listener
  const dateInput = document.getElementById('global-date-picker');
  if (dateInput) {
    dateInput.value = state.dateStr;
    dateInput.addEventListener('change', (e) => {
      state.dateStr = e.target.value;
      if (state.user && firebase.db) {
        setupFirestoreLogSync(state.user, state.dateStr);
      }
      renderApp();
    });
  }
});

// --- RENDER ROUTER ENGINE ---
function renderApp() {
  // Update nav active states
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(item => {
    const view = item.getAttribute('data-view') || item.getAttribute('href')?.replace('#', '');
    if (view === state.activeView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const mainContainer = document.getElementById('view-target');
  if (!mainContainer) return;
  mainContainer.replaceChildren(); // Safe clear

  // Check auth block
  if (state.activeView === 'auth') {
    mainContainer.appendChild(renderAuthPage());
    return;
  }

  // Render active view
  switch (state.activeView) {
    case 'dashboard':
      mainContainer.appendChild(renderDashboard());
      break;
    case 'fitness':
      mainContainer.appendChild(renderFitness());
      break;
    case 'habits':
      mainContainer.appendChild(renderHabits());
      break;
    case 'media':
      mainContainer.appendChild(renderMedia());
      break;
    case 'settings':
      mainContainer.appendChild(renderSettings());
      break;
  }
}

// --- VIEW: AUTHENTICATION ---
function renderAuthPage() {
  const isConfigured = firebase.isFirebaseConfigured();
  
  const googleBtn = el('button', {
    class: 'btn btn-primary',
    style: { width: '100%', marginTop: '16px' },
    onClick: async () => {
      const provider = new firebase.GoogleAuthProvider();
      try {
        await firebase.signInWithPopup(firebase.auth, provider);
      } catch (err) {
        console.error("Popup failed, trying redirect...", err);
        try {
          await firebase.signInWithRedirect(firebase.auth, provider);
        } catch (redirErr) {
          alert("Sign in failed: " + redirErr.message);
        }
      }
    }
  }, icon(ICONS.user, "btn-icon"), "Sign In with Google");

  return el('div', { class: 'section' },
    el('div', { class: 'auth-container' },
      el('div', { class: 'auth-header' },
        el('svg', { class: 'brand-icon', style: { width: '48px', height: '48px' }, viewBox: '0 0 100 100' },
          // Insert Logo spikes directly
          el('circle', { cx: 50, cy: 50, r: 8, fill: '#cc785c' }),
          el('rect', { x: 20, y: 44, width: 60, height: 12, rx: 6, fill: '#cc785c' }),
          el('rect', { x: 44, y: 20, width: 12, height: 60, rx: 6, fill: '#cc785c' })
        ),
        el('h2', {}, "Life Tracker"),
        el('p', { class: 'form-label' }, "Sync your health logs between devices instantly.")
      ),
      isConfigured ? googleBtn : el('div', { style: { textAlign: 'center', padding: '12px' } },
        el('p', { style: { color: 'var(--colors-error)', fontWeight: 'bold' } }, "Firebase is not configured yet!"),
        el('p', { class: 'form-label', style: { marginTop: '8px' } }, "Please navigate to the Settings tab to enter your Firebase project parameters."),
        el('button', {
          class: 'btn btn-secondary',
          style: { marginTop: '16px', width: '100%' },
          onClick: () => { window.location.hash = '#settings'; }
        }, "Go to Settings")
      )
    )
  );
}

// --- VIEW: DASHBOARD ---
function renderDashboard() {
  const day = getTodayLog();
  
  // Calculate stats
  const totalCals = day.calories || 0;
  const calGoal = 2000; // default
  const calPercent = Math.min(100, Math.round((totalCals / calGoal) * 100));
  
  const stepGoal = 10000;
  const stepPercent = Math.min(100, Math.round(((day.steps || 0) / stepGoal) * 100));

  // AI Review Panel Section
  const coachPanel = el('div', { class: 'ai-coach-section' });
  const renderCoachPanel = () => {
    coachPanel.replaceChildren();
    
    if (day.aiReview) {
      coachPanel.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        el('div', {},
          el('span', { class: 'badge badge-coral' }, "AI Coach Rating"),
          el('h3', { style: { color: 'var(--colors-on-dark)', marginTop: '8px' } }, day.aiReview.rating)
        ),
        el('div', { style: { textAlign: 'right' } },
          el('span', { class: 'form-label', style: { color: 'var(--colors-on-dark-soft)' } }, "Daily Score"),
          el('h1', { style: { color: 'var(--colors-primary)', fontFamily: 'var(--font-mono)' } }, `${day.aiReview.score}/10`)
        )
      ));
      
      coachPanel.appendChild(el('p', { style: { marginTop: '16px', color: 'var(--colors-on-dark-soft)' } }, day.aiReview.critique));
      
      // Parse markdown bullets simply
      const listItems = day.aiReview.recommendation
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => el('li', { style: { color: 'var(--colors-on-dark)', marginLeft: '16px', marginTop: '8px' } }, line.replace('-', '').trim()));
        
      if (listItems.length > 0) {
        coachPanel.appendChild(el('h4', { style: { color: 'var(--colors-on-dark)', marginTop: '16px', fontSize: '18px' } }, "Tomorrow's Strategy:"));
        coachPanel.appendChild(el('ul', { style: { marginTop: '8px' } }, ...listItems));
      }
      
      coachPanel.appendChild(el('button', {
        class: 'btn btn-secondary',
        style: { marginTop: '24px', backgroundColor: 'transparent', color: 'var(--colors-on-dark)', borderColor: 'var(--colors-on-dark-soft)' },
        onClick: () => {
          day.aiReview = null;
          queueSave();
          renderCoachPanel();
        }
      }, "Clear Review"));
    } else {
      // Prompt to request AI review
      const hasKey = gemini.getGeminiKey();
      
      const loadBtn = el('button', {
        class: 'btn btn-primary',
        onClick: async (e) => {
          e.target.disabled = true;
          e.target.textContent = "Analyzing logs...";
          
          // Collect last 3 days of logs for context
          const history = [];
          const dates = Object.keys(state.logs).sort().reverse();
          for (let d of dates) {
            if (d !== state.dateStr && history.length < 3) {
              history.push({ date: d, ...state.logs[d] });
            }
          }
          
          const review = await gemini.getDailyReview({
            date: state.dateStr,
            workouts: day.workouts,
            calories: day.calories,
            protein: day.protein,
            steps: day.steps,
            sleep: day.sleep,
            water: day.water,
            weight: day.weight,
            calorieGoal: calGoal,
            trends: getWeeklyTrends(state.dateStr) // Pass 7-day moving averages
          }, history);
          
          day.aiReview = review;
          queueSave();
          renderCoachPanel();
        }
      }, hasKey ? "Generate Holistic AI Review" : "Generate Review (Local Engine)");

      coachPanel.appendChild(el('div', { style: { textAlign: 'center', padding: '16px 0' } },
        el('h3', { style: { color: 'var(--colors-on-dark)', marginBottom: '8px' } }, "AI Health & Fitness Coach"),
        el('p', { style: { color: 'var(--colors-on-dark-soft)', marginBottom: '24px' } }, 
          hasKey 
            ? "Gemini will critique your workouts, calorie balance, sleep, and steps."
            : "Activate full Gemini AI responses by adding a Gemini Key in Settings. Standard rules mode is active."
        ),
        loadBtn
      ));
    }
  };
  
  renderCoachPanel();

  // Dashboard Stats Grid
  const grid = el('div', { class: 'card-grid card-grid-2' },
    // Workout card
    el('div', { class: 'stat-card' },
      el('div', {},
        el('span', { class: 'form-label' }, "WORKOUT TODAY"),
        el('div', { class: 'stat-value' }, 
          day.workouts.length > 0 
            ? `${day.workouts.length} Exercise(s)` 
            : "Rest Day"
        )
      ),
      icon(ICONS.fitness, "brand-icon")
    ),
    // Steps card
    el('div', { class: 'stat-card' },
      el('div', {},
        el('span', { class: 'form-label' }, `STEPS (${stepPercent}%)`),
        el('div', { class: 'stat-value' }, `${(day.steps || 0).toLocaleString()} / 10k`),
        el('div', { class: 'progress-bar-container' },
          el('div', { class: 'progress-bar-fill', style: { width: `${stepPercent}%` } })
        )
      ),
      icon(ICONS.chevronRight, "brand-icon")
    ),
    // Calories card
    el('div', { class: 'stat-card' },
      el('div', {},
        el('span', { class: 'form-label' }, `NUTRITION (${calPercent}%)`),
        el('div', { class: 'stat-value' }, `${totalCals} / ${calGoal} kcal`),
        el('span', { class: 'form-label', style: { fontSize: '11px' } }, `Protein: ${day.protein || 0}g`),
        el('div', { class: 'progress-bar-container' },
          el('div', { class: 'progress-bar-fill', style: { width: `${calPercent}%` } })
        )
      ),
      icon(ICONS.chevronRight, "brand-icon")
    ),
    // Sleep card
    el('div', { class: 'stat-card' },
      el('div', {},
        el('span', { class: 'form-label' }, "SLEEP LOG"),
        el('div', { class: 'stat-value' }, `${day.sleep || 0} hrs`)
      ),
      icon(ICONS.chevronRight, "brand-icon")
    )
  );

  const trends = getWeeklyTrends(state.dateStr);
  const trendSign = trends.weightChange7d > 0 ? '+' : '';
  const trendsGrid = el('div', { style: { marginTop: '32px', marginBottom: '24px' } },
    el('h3', { style: { fontSize: '22px', marginBottom: '16px', fontFamily: 'var(--font-display)' } }, "7-Day Moving Averages"),
    el('div', { class: 'card-grid card-grid-2', style: { gap: '16px' } },
      el('div', { class: 'stat-card', style: { padding: '12px 16px', backgroundColor: 'var(--colors-surface-card)', border: '1px solid var(--colors-hairline)' } },
        el('div', {},
          el('span', { class: 'form-label', style: { fontSize: '11px' } }, "AVG DAILY STEPS"),
          el('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '600', color: 'var(--colors-ink)' } }, 
            trends.avgSteps7d > 0 ? `${trends.avgSteps7d.toLocaleString()} steps` : "No logs"
          )
        )
      ),
      el('div', { class: 'stat-card', style: { padding: '12px 16px', backgroundColor: 'var(--colors-surface-card)', border: '1px solid var(--colors-hairline)' } },
        el('div', {},
          el('span', { class: 'form-label', style: { fontSize: '11px' } }, "AVG DAILY CALORIES"),
          el('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '600', color: 'var(--colors-ink)' } }, 
            trends.avgCalories7d > 0 ? `${trends.avgCalories7d} kcal` : "No logs"
          )
        )
      ),
      el('div', { class: 'stat-card', style: { padding: '12px 16px', backgroundColor: 'var(--colors-surface-card)', border: '1px solid var(--colors-hairline)' } },
        el('div', {},
          el('span', { class: 'form-label', style: { fontSize: '11px' } }, "AVG DAILY SLEEP"),
          el('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '600', color: 'var(--colors-ink)' } }, 
            trends.avgSleep7d > 0 ? `${trends.avgSleep7d} hrs` : "No logs"
          )
        )
      ),
      el('div', { class: 'stat-card', style: { padding: '12px 16px', backgroundColor: 'var(--colors-surface-card)', border: '1px solid var(--colors-hairline)' } },
        el('div', {},
          el('span', { class: 'form-label', style: { fontSize: '11px' } }, "7-DAY WEIGHT CHANGE"),
          el('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '600', color: trends.weightChange7d > 0 ? 'var(--colors-primary)' : 'var(--colors-success)' } }, 
            trends.weightChange7d !== 0 ? `${trendSign}${trends.weightChange7d.toFixed(1)} kg` : "Stable / No logs"
          )
        )
      )
    )
  );

  return el('div', { class: 'section' },
    el('div', { class: 'container' },
      el('h1', { style: { fontFamily: 'var(--font-display)', marginBottom: '8px' } }, "Daily Digest"),
      el('p', { class: 'form-label', style: { marginBottom: '24px' } }, `Journal logs for ${state.dateStr}`),
      grid,
      trendsGrid,
      coachPanel
    )
  );
}

// --- VIEW: FITNESS ---
function renderFitness() {
  const day = getTodayLog();
  
  // Track active visual tab (Split Planner vs Log)
  const tabs = el('div', { class: 'tabs-container' });
  const fitnessContent = el('div', {});

  const renderActiveFitnessTab = (tabName) => {
    fitnessContent.replaceChildren();
    
    // Rerender tabs buttons
    tabs.replaceChildren(
      el('button', { class: `tab-btn ${tabName === 'log' ? 'active' : ''}`, onClick: () => renderActiveFitnessTab('log') }, "Daily Log"),
      el('button', { class: `tab-btn ${tabName === 'planner' ? 'active' : ''}`, onClick: () => renderActiveFitnessTab('planner') }, "Split Routine Planner"),
      el('button', { class: `tab-btn ${tabName === 'diet' ? 'active' : ''}`, onClick: () => renderActiveFitnessTab('diet') }, "Nutrition & Recipes")
    );

    if (tabName === 'log') {
      // Split Routine selector
      const splitKeys = Object.keys(state.workoutSplit);
      const splitChips = el('div', { class: 'split-days-container' });
      
      const renderSplitSelector = () => {
        splitChips.replaceChildren(
          ...splitKeys.map(key => el('div', {
            class: 'split-day-chip',
            onClick: () => {
              // Load split exercises as logs for today if not already present
              const exercises = state.workoutSplit[key];
              day.workouts = exercises.map(ex => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight
              }));
              queueSave();
              renderActiveFitnessTab('log');
            }
          }, key))
        );
      };
      
      renderSplitSelector();

      // Exercises Log Grid
      const exercisesList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
      const renderExercisesLog = () => {
        exercisesList.replaceChildren();
        
        if (day.workouts.length === 0) {
          exercisesList.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', backgroundColor: 'var(--colors-surface-card)', borderRadius: '12px' } },
            el('p', {}, "No workout split loaded for today. Select one of your custom splits above to start logging, or create custom ones in the Split Routine Planner.")
          ));
          return;
        }

        day.workouts.forEach((ex, idx) => {
          exercisesList.appendChild(
            el('div', { class: 'stat-card', style: { flexDirection: 'column', alignItems: 'stretch', gap: '12px' } },
              el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                el('h3', { style: { fontSize: '20px' } }, ex.name),
                el('button', {
                  class: 'btn btn-text',
                  style: { color: 'var(--colors-error)' },
                  onClick: () => {
                    day.workouts.splice(idx, 1);
                    queueSave();
                    renderExercisesLog();
                  }
                }, icon(ICONS.trash, "btn-icon"))
              ),
              el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
                // Sets Control
                el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                  el('span', { class: 'form-label' }, "Sets"),
                  el('div', { class: 'number-adjuster' },
                    el('button', { class: 'adjust-btn', onClick: () => { if (ex.sets > 1) { ex.sets--; queueSave(); renderExercisesLog(); } } }, "-"),
                    el('div', { class: 'adjust-val' }, ex.sets),
                    el('button', { class: 'adjust-btn', onClick: () => { ex.sets++; queueSave(); renderExercisesLog(); } }, "+")
                  )
                ),
                // Reps Control
                el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                  el('span', { class: 'form-label' }, "Reps"),
                  el('div', { class: 'number-adjuster' },
                    el('button', { class: 'adjust-btn', onClick: () => { if (ex.reps > 1) { ex.reps--; queueSave(); renderExercisesLog(); } } }, "-"),
                    el('div', { class: 'adjust-val' }, ex.reps),
                    el('button', { class: 'adjust-btn', onClick: () => { ex.reps++; queueSave(); renderExercisesLog(); } }, "+")
                  )
                ),
                // Weight Control (Adjust by 2.5kg or 5lb steps)
                el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                  el('span', { class: 'form-label' }, "Weight (kg)"),
                  el('div', { class: 'number-adjuster' },
                    el('button', { class: 'adjust-btn', onClick: () => { if (ex.weight >= 2.5) { ex.weight -= 2.5; queueSave(); renderExercisesLog(); } } }, "-"),
                    el('div', { class: 'adjust-val', style: { width: '64px' } }, `${ex.weight}kg`),
                    el('button', { class: 'adjust-btn', onClick: () => { ex.weight += 2.5; queueSave(); renderExercisesLog(); } }, "+")
                  )
                )
              )
            )
          );
        });
        
        // Add single exercise button
        exercisesList.appendChild(
          el('button', {
            class: 'btn btn-secondary',
            onClick: () => {
              const name = prompt("Enter Exercise Name:");
              if (name) {
                day.workouts.push({ name, sets: 3, reps: 10, weight: 20 });
                queueSave();
                renderExercisesLog();
              }
            }
          }, icon(ICONS.plus, "btn-icon"), "Add Custom Exercise")
        );
      };
      
      renderExercisesLog();

      // Additional Stats Section (Steps, Sleep, Weight)
      const statsPanel = el('div', { style: { marginTop: '32px' } },
        el('h2', { style: { fontSize: '26px', marginBottom: '16px' } }, "Daily Metrics"),
        el('div', { class: 'card-grid card-grid-3' },
          // Steps Input
          el('div', { class: 'feature-card' },
            el('span', { class: 'form-label' }, "Daily Steps"),
            el('input', {
              type: 'number',
              class: 'form-control',
              value: day.steps || '',
              placeholder: '10000',
              onChange: (e) => {
                day.steps = parseInt(e.target.value) || 0;
                queueSave();
              }
            })
          ),
          // Sleep Input
          el('div', { class: 'feature-card' },
            el('span', { class: 'form-label' }, "Sleep Hours"),
            el('input', {
              type: 'number',
              step: '0.5',
              class: 'form-control',
              value: day.sleep || '',
              placeholder: '8',
              onChange: (e) => {
                day.sleep = parseFloat(e.target.value) || 0;
                queueSave();
              }
            })
          ),
          // Weight Input
          el('div', { class: 'feature-card' },
            el('span', { class: 'form-label' }, "Body Weight (kg)"),
            el('input', {
              type: 'number',
              step: '0.1',
              class: 'form-control',
              value: day.weight || '',
              placeholder: '75.5',
              onChange: (e) => {
                day.weight = parseFloat(e.target.value) || 0;
                queueSave();
              }
            })
          )
        )
      );

      fitnessContent.appendChild(el('div', {},
        el('h2', { style: { fontSize: '26px', marginBottom: '16px' } }, "Today's Lift"),
        el('p', { class: 'form-label', style: { marginBottom: '16px' } }, "Pick a split template to auto-fill, or manually log items:"),
        splitChips,
        exercisesList,
        statsPanel
      ));

    } else if (tabName === 'planner') {
      // Split Routine Planner View
      const splitEditor = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } });
      const renderSplitEditor = () => {
        splitEditor.replaceChildren();
        
        Object.entries(state.workoutSplit).forEach(([splitName, exercises]) => {
          const exercisesSublist = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' } });
          
          exercises.forEach((ex, idx) => {
            exercisesSublist.appendChild(
              el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--colors-surface-soft)', padding: '8px 12px', borderRadius: '6px' } },
                el('div', {},
                  el('span', { style: { fontWeight: 'bold' } }, ex.name),
                  el('span', { style: { color: 'var(--colors-muted)', marginLeft: '12px', fontSize: '13px' } }, `${ex.sets}s × ${ex.reps}r @ ${ex.weight}kg`)
                ),
                el('button', {
                  class: 'btn btn-text',
                  style: { color: 'var(--colors-error)' },
                  onClick: () => {
                    exercises.splice(idx, 1);
                    queueSave();
                    renderSplitEditor();
                  }
                }, icon(ICONS.trash, "btn-icon"))
              )
            );
          });

          // Add exercise to split btn
          const addExForm = el('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
            el('input', { type: 'text', placeholder: 'Exercise Name', class: 'form-control', style: { flexGrow: '1' }, id: `new-ex-name-${splitName.replace(/ /g, '')}` }),
            el('input', { type: 'number', placeholder: 'Sets', class: 'form-control', style: { width: '60px' }, id: `new-ex-sets-${splitName.replace(/ /g, '')}` }),
            el('input', { type: 'number', placeholder: 'Reps', class: 'form-control', style: { width: '60px' }, id: `new-ex-reps-${splitName.replace(/ /g, '')}` }),
            el('input', { type: 'number', placeholder: 'Wt (kg)', class: 'form-control', style: { width: '70px' }, id: `new-ex-wt-${splitName.replace(/ /g, '')}` }),
            el('button', {
              class: 'btn btn-primary',
              onClick: () => {
                const suffix = splitName.replace(/ /g, '');
                const name = document.getElementById(`new-ex-name-${suffix}`).value;
                const sets = parseInt(document.getElementById(`new-ex-sets-${suffix}`).value) || 3;
                const reps = parseInt(document.getElementById(`new-ex-reps-${suffix}`).value) || 10;
                const weight = parseFloat(document.getElementById(`new-ex-wt-${suffix}`).value) || 20;
                
                if (name) {
                  exercises.push({ name, sets, reps, weight });
                  queueSave();
                  renderSplitEditor();
                }
              }
            }, "Add")
          );

          splitEditor.appendChild(
            el('div', { class: 'feature-card' },
              el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                el('h3', {}, splitName),
                el('button', {
                  class: 'btn btn-text',
                  style: { color: 'var(--colors-error)' },
                  onClick: () => {
                    delete state.workoutSplit[splitName];
                    queueSave();
                    renderSplitEditor();
                  }
                }, "Delete Split")
              ),
              exercisesSublist,
              addExForm
            )
          );
        });

        // Add whole split routine block
        splitEditor.appendChild(
          el('button', {
            class: 'btn btn-secondary',
            onClick: () => {
              const name = prompt("Enter Split Name (e.g. Upper Day, Full Body):");
              if (name && !state.workoutSplit[name]) {
                state.workoutSplit[name] = [];
                queueSave();
                renderSplitEditor();
              }
            }
          }, icon(ICONS.plus, "btn-icon"), "Create New Split Routine")
        );
      };

      renderSplitEditor();
      fitnessContent.appendChild(splitEditor);

    } else if (tabName === 'diet') {
      // Nutrition & Recipe View
      const mealsList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' } });
      const renderMealsLog = () => {
        mealsList.replaceChildren();
        if (day.meals.length === 0) {
          mealsList.appendChild(el('p', { style: { color: 'var(--colors-muted)', textAlign: 'center', padding: '16px' } }, "No meals logged yet today. Log using custom recipes or quick addition below."));
          return;
        }

        day.meals.forEach((meal, idx) => {
          mealsList.appendChild(
            el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--colors-surface-card)', borderRadius: '8px' } },
              el('div', {},
                el('span', { style: { fontWeight: 'bold' } }, meal.title),
                el('span', { style: { color: 'var(--colors-muted)', marginLeft: '12px' } }, `${meal.calories} kcal · ${meal.protein}g protein`)
              ),
              el('button', {
                class: 'btn btn-text',
                style: { height: 'auto', padding: 0, color: 'var(--colors-error)' },
                onClick: () => {
                  day.calories = Math.max(0, day.calories - meal.calories);
                  day.protein = Math.max(0, day.protein - meal.protein);
                  day.meals.splice(idx, 1);
                  queueSave();
                  renderActiveFitnessTab('diet');
                }
              }, icon(ICONS.trash, "btn-icon"))
            )
          );
        });
      };
      
      renderMealsLog();

      // Quick meal fields
      const logForm = el('div', { class: 'feature-card' },
        el('h3', { style: { fontSize: '20px' } }, "Quick Meal Log"),
        el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' } },
          el('input', { type: 'text', placeholder: 'Meal Name (e.g. Protein shake)', class: 'form-control', style: { flexGrow: '1' }, id: 'quick-meal-name' }),
          el('input', { type: 'number', placeholder: 'Calories', class: 'form-control', style: { width: '90px' }, id: 'quick-meal-cals' }),
          el('input', { type: 'number', placeholder: 'Protein (g)', class: 'form-control', style: { width: '90px' }, id: 'quick-meal-prot' }),
          el('button', {
            class: 'btn btn-primary',
            onClick: () => {
              const name = document.getElementById('quick-meal-name').value;
              const cals = parseInt(document.getElementById('quick-meal-cals').value) || 0;
              const prot = parseInt(document.getElementById('quick-meal-prot').value) || 0;
              
              if (name) {
                day.meals.push({ title: name, calories: cals, protein: prot });
                day.calories = (day.calories || 0) + cals;
                day.protein = (day.protein || 0) + prot;
                queueSave();
                renderActiveFitnessTab('diet');
              }
            }
          }, "Log Meal")
        )
      );

      // Recipe Quick List Selector
      const recipeSelector = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' } });
      const renderRecipeSelection = () => {
        recipeSelector.replaceChildren();
        if (state.recipes.length === 0) return;
        
        recipeSelector.appendChild(el('h3', { style: { fontSize: '20px', marginBottom: '8px' } }, "Your Recipe Catalog"));
        state.recipes.forEach(rec => {
          recipeSelector.appendChild(
            el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--colors-surface-soft)', padding: '12px', borderRadius: '8px' } },
              el('div', {},
                el('div', { style: { fontWeight: 'bold' } }, rec.title),
                el('div', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, `${rec.calories} kcal · ${rec.protein}g protein · ${rec.desc}`)
              ),
              el('button', {
                class: 'btn btn-secondary',
                onClick: () => {
                  day.meals.push({ title: rec.title, calories: rec.calories, protein: rec.protein });
                  day.calories = (day.calories || 0) + rec.calories;
                  day.protein = (day.protein || 0) + rec.protein;
                  queueSave();
                  renderActiveFitnessTab('diet');
                }
              }, "Eat Meal")
            )
          );
        });
      };
      
      renderRecipeSelection();

      // Add Recipe Catalog Creation Form
      const createRecipeForm = el('div', { class: 'feature-card', style: { marginTop: '24px' } },
        el('h3', { style: { fontSize: '20px' } }, "Create Saved Recipe"),
        el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' } },
          el('input', { type: 'text', placeholder: 'Recipe Title', class: 'form-control', style: { flexGrow: '1' }, id: 'rec-title' }),
          el('input', { type: 'number', placeholder: 'Total Calories', class: 'form-control', style: { width: '120px' }, id: 'rec-cals' }),
          el('input', { type: 'number', placeholder: 'Protein (g)', class: 'form-control', style: { width: '120px' }, id: 'rec-prot' }),
          el('input', { type: 'text', placeholder: 'Quick Ingredients Description', class: 'form-control', style: { width: '100%' }, id: 'rec-desc' }),
          el('button', {
            class: 'btn btn-secondary',
            onClick: () => {
              const title = document.getElementById('rec-title').value;
              const calories = parseInt(document.getElementById('rec-cals').value) || 0;
              const protein = parseInt(document.getElementById('rec-prot').value) || 0;
              const desc = document.getElementById('rec-desc').value || '';
              
              if (title) {
                state.recipes.push({ title, calories, protein, desc });
                queueSave();
                renderActiveFitnessTab('diet');
              }
            }
          }, "Save to Catalog")
        )
      );

      // Water Cups tracker
      const waterLog = el('div', { class: 'feature-card', style: { marginTop: '24px', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
        el('div', {},
          el('h3', { style: { fontSize: '20px' } }, "Water Hydration"),
          el('span', { class: 'form-label' }, "Cups (250ml) logged today")
        ),
        el('div', { class: 'number-adjuster' },
          el('button', { class: 'adjust-btn', onClick: () => { if (day.water > 0) { day.water--; queueSave(); renderActiveFitnessTab('diet'); } } }, "-"),
          el('div', { class: 'adjust-val' }, day.water || 0),
          el('button', { class: 'adjust-btn', onClick: () => { day.water = (day.water || 0) + 1; queueSave(); renderActiveFitnessTab('diet'); } }, "+")
        )
      );

      fitnessContent.appendChild(el('div', {},
        logForm,
        mealsList,
        waterLog,
        recipeSelector,
        createRecipeForm
      ));
    }
  };

  // Select Log tab by default
  renderActiveFitnessTab('log');

  return el('div', { class: 'section' },
    el('div', { class: 'container' },
      el('h1', { style: { marginBottom: '24px' } }, "Training & Nutrition"),
      tabs,
      fitnessContent
    )
  );
}

// --- VIEW: HABITS ---
function renderHabits() {
  const day = getTodayLog();
  
  // Custom Habits definitions
  let habits = JSON.parse(localStorage.getItem('life_tracker_habits_list')) || [
    { id: 'h1', title: 'Read 15 Pages', category: 'Mind' },
    { id: 'h2', title: '10k Steps Walked', category: 'Fitness' },
    { id: 'h3', title: 'Hydrated (8+ Cups)', category: 'Health' },
    { id: 'h4', title: 'No processed food', category: 'Nutrition' }
  ];
  
  const saveHabits = () => {
    localStorage.setItem('life_tracker_habits_list', JSON.stringify(habits));
    queueSave();
  };

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  
  const renderHabitsChecklist = () => {
    list.replaceChildren();
    
    habits.forEach(habit => {
      const isCompleted = day.habitsCompleted.includes(habit.id);
      
      const checkBtn = el('div', {
        class: `checkbox-custom ${isCompleted ? 'checked' : ''}`,
        onClick: () => {
          if (isCompleted) {
            day.habitsCompleted = day.habitsCompleted.filter(id => id !== habit.id);
          } else {
            day.habitsCompleted.push(habit.id);
          }
          queueSave();
          renderHabitsChecklist();
        }
      }, icon(ICONS.check));
      
      list.appendChild(
        el('div', { class: 'checklist-item' },
          checkBtn,
          el('div', { style: { flexGrow: '1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            el('span', { class: isCompleted ? 'line-through-text' : '' }, habit.title),
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              el('span', { class: 'badge badge-pill-cream', style: { fontSize: '11px' } }, habit.category),
              el('button', {
                class: 'btn btn-text',
                style: { height: 'auto', padding: 0, color: 'var(--colors-error)' },
                onClick: () => {
                  habits = habits.filter(h => h.id !== habit.id);
                  day.habitsCompleted = day.habitsCompleted.filter(id => id !== habit.id);
                  saveHabits();
                  renderHabitsChecklist();
                }
              }, icon(ICONS.trash, "btn-icon"))
            )
          )
        )
      );
    });

    // Add Habit input
    const addInput = el('div', { style: { display: 'flex', gap: '12px', marginTop: '16px' } },
      el('input', { type: 'text', placeholder: 'New habit title...', class: 'form-control', style: { flexGrow: 1 }, id: 'new-habit-title' }),
      el('input', { type: 'text', placeholder: 'Category (e.g. Mind)', class: 'form-control', style: { width: '140px' }, id: 'new-habit-cat' }),
      el('button', {
        class: 'btn btn-primary',
        onClick: () => {
          const title = document.getElementById('new-habit-title').value;
          const category = document.getElementById('new-habit-cat').value || 'General';
          if (title) {
            habits.push({
              id: 'h_' + Date.now(),
              title,
              category
            });
            saveHabits();
            renderHabitsChecklist();
          }
        }
      }, "Add Habit")
    );
    list.appendChild(addInput);
  };
  
  renderHabitsChecklist();

  // Weekly Grid Progress Tracker View
  const weeklyGrid = el('div', { class: 'feature-card', style: { marginTop: '32px' } },
    el('h3', {}, "Weekly Routine Progress"),
    el('p', { class: 'form-label', style: { marginBottom: '16px' } }, "Completion rates over the current calendar week.")
  );
  
  const renderWeeklyGrid = () => {
    // Generate dates for current Mon-Sun
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1; // Mon
    const daysArr = [];
    
    const gridRows = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    
    // Add grid headers (Days of week)
    const headerRow = el('div', { style: { display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: '600', fontSize: '13px' } },
      el('div', { style: { textAlign: 'left' } }, "Habit"),
      el('div', {}, "Mon"),
      el('div', {}, "Tue"),
      el('div', {}, "Wed"),
      el('div', {}, "Thu"),
      el('div', {}, "Fri"),
      el('div', {}, "Sat"),
      el('div', {}, "Sun")
    );
    gridRows.appendChild(headerRow);

    habits.forEach(habit => {
      const rowCols = [el('div', { style: { textAlign: 'left', fontWeight: '500', fontSize: '14px' } }, habit.title)];
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(curr.setDate(first + i));
        const dateKey = d.toISOString().split('T')[0];
        const dayLogs = state.logs[dateKey];
        const done = dayLogs && dayLogs.habitsCompleted.includes(habit.id);
        
        rowCols.push(
          el('div', { 
            style: { 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '32px',
              backgroundColor: done ? 'var(--colors-primary)' : 'var(--colors-surface-soft)', 
              borderRadius: '6px',
              color: done ? 'var(--colors-on-primary)' : 'transparent',
              fontSize: '11px'
            } 
          }, done ? "✓" : "")
        );
      }
      
      gridRows.appendChild(
        el('div', { style: { display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', gap: '8px', alignItems: 'center' } }, ...rowCols)
      );
    });

    weeklyGrid.replaceChildren(
      el('h3', {}, "Weekly Routine Progress"),
      el('p', { class: 'form-label', style: { marginBottom: '16px' } }, "Completion rates over the current calendar week."),
      gridRows
    );
  };
  
  renderWeeklyGrid();

  return el('div', { class: 'section' },
    el('div', { class: 'container' },
      el('h1', { style: { marginBottom: '24px' } }, "Habit Journal"),
      list,
      weeklyGrid
    )
  );
}

// --- VIEW: MEDIA (BOOKS & MOVIES) ---
function renderMedia() {
  const tabs = el('div', { class: 'tabs-container' });
  const mediaContent = el('div', {});

  // Custom Local Storage for Media lists
  let books = JSON.parse(localStorage.getItem('life_tracker_books')) || [
    { title: "Dune", author: "Frank Herbert", pages: 600, read: 250, shelf: "Reading", review: "", cover: "" }
  ];
  let movies = JSON.parse(localStorage.getItem('life_tracker_movies')) || [
    { title: "Interstellar", year: 2014, shelf: "Completed", rating: 5, review: "Masterpiece. Visuals and score are unmatched.", cover: "" }
  ];

  const saveMedia = () => {
    localStorage.setItem('life_tracker_books', JSON.stringify(books));
    localStorage.setItem('life_tracker_movies', JSON.stringify(movies));
    queueSave();
  };

  const renderActiveMediaTab = (tabName) => {
    mediaContent.replaceChildren();
    
    // Rerender tabs buttons
    tabs.replaceChildren(
      el('button', { class: `tab-btn ${tabName === 'books' ? 'active' : ''}`, onClick: () => renderActiveMediaTab('books') }, "Book Reading"),
      el('button', { class: `tab-btn ${tabName === 'movies' ? 'active' : ''}`, onClick: () => renderActiveMediaTab('movies') }, "Movies & Shows")
    );

    if (tabName === 'books') {
      const grid = el('div', { class: 'media-grid' });
      
      const renderBooksGrid = () => {
        grid.replaceChildren();
        
        books.forEach((book, idx) => {
          const percent = Math.min(100, Math.round((book.read / book.pages) * 100));
          
          // Reading progress input
          const progressInput = book.shelf === 'Reading' ? el('div', { style: { marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' } },
            el('input', {
              type: 'number',
              class: 'form-control',
              style: { width: '70px', height: '32px' },
              value: book.read,
              onChange: (e) => {
                const readPages = parseInt(e.target.value) || 0;
                book.read = Math.min(book.pages, readPages);
                if (book.read === book.pages) {
                  book.shelf = 'Completed';
                }
                saveMedia();
                renderActiveMediaTab('books');
              }
            }),
            el('span', { class: 'form-label' }, `/ ${book.pages} p.`)
          ) : el('span', { class: 'form-label', style: { marginTop: '8px', display: 'block' } }, `${book.read} / ${book.pages} pages (${percent}%)`);

          grid.appendChild(
            el('div', { class: 'media-card' },
              // Dummy book cover
              el('div', { class: 'media-cover' }, book.title[0]),
              el('div', { class: 'media-info' },
                el('div', {},
                  el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
                    el('h3', { class: 'media-title' }, book.title),
                    el('button', {
                      class: 'btn btn-text',
                      style: { height: 'auto', padding: 0, color: 'var(--colors-error)' },
                      onClick: () => {
                        books.splice(idx, 1);
                        saveMedia();
                        renderActiveMediaTab('books');
                      }
                    }, icon(ICONS.trash, "btn-icon"))
                  ),
                  el('div', { class: 'media-author' }, `by ${book.author}`),
                  el('span', { class: 'badge badge-pill-cream', style: { fontSize: '11px' } }, book.shelf)
                ),
                el('div', {},
                  progressInput,
                  el('div', { class: 'progress-bar-container', style: { marginTop: '4px' } },
                    el('div', { class: 'progress-bar-fill', style: { width: `${percent}%` } })
                  )
                )
              )
            )
          );
        });

        // Add Book Form
        grid.appendChild(
          el('div', { class: 'media-card', style: { flexDirection: 'column', gap: '8px' } },
            el('h3', { style: { fontSize: '20px' } }, "Add Book"),
            el('input', { type: 'text', placeholder: 'Book Title', class: 'form-control', id: 'book-in-title' }),
            el('input', { type: 'text', placeholder: 'Author', class: 'form-control', id: 'book-in-author' }),
            el('div', { style: { display: 'flex', gap: '8px' } },
              el('input', { type: 'number', placeholder: 'Pages', class: 'form-control', style: { width: '50%' }, id: 'book-in-pages' }),
              el('select', { class: 'form-control', style: { width: '50%' }, id: 'book-in-shelf' },
                el('option', { value: 'To Read' }, "To Read"),
                el('option', { value: 'Reading' }, "Reading"),
                el('option', { value: 'Completed' }, "Completed")
              )
            ),
            el('button', {
              class: 'btn btn-primary',
              style: { marginTop: '8px' },
              onClick: () => {
                const title = document.getElementById('book-in-title').value;
                const author = document.getElementById('book-in-author').value || 'Unknown';
                const pages = parseInt(document.getElementById('book-in-pages').value) || 100;
                const shelf = document.getElementById('book-in-shelf').value;
                
                if (title) {
                  books.push({
                    title,
                    author,
                    pages,
                    read: shelf === 'Completed' ? pages : 0,
                    shelf,
                    review: '',
                    cover: ''
                  });
                  saveMedia();
                  renderActiveMediaTab('books');
                }
              }
            }, "Save Book")
          )
        );
      };

      renderBooksGrid();
      mediaContent.appendChild(grid);

    } else if (tabName === 'movies') {
      const grid = el('div', { class: 'media-grid' });
      
      const renderMoviesGrid = () => {
        grid.replaceChildren();
        
        movies.forEach((movie, idx) => {
          // Render ratings stars
          const starCluster = el('div', { class: 'star-rating', style: { marginTop: '8px' } });
          const renderStars = () => {
            starCluster.replaceChildren();
            for (let i = 1; i <= 5; i++) {
              starCluster.appendChild(
                icon(ICONS.star, `btn-icon ${i <= (movie.rating || 0) ? 'active' : ''}`)
              );
            }
          };
          renderStars();

          grid.appendChild(
            el('div', { class: 'media-card' },
              el('div', { class: 'media-cover' }, "🎬"),
              el('div', { class: 'media-info' },
                el('div', {},
                  el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
                    el('h3', { class: 'media-title' }, movie.title),
                    el('button', {
                      class: 'btn btn-text',
                      style: { height: 'auto', padding: 0, color: 'var(--colors-error)' },
                      onClick: () => {
                        movies.splice(idx, 1);
                        saveMedia();
                        renderActiveMediaTab('movies');
                      }
                    }, icon(ICONS.trash, "btn-icon"))
                  ),
                  el('div', { class: 'media-author' }, `Year: ${movie.year || 'N/A'}`),
                  el('span', { class: 'badge badge-pill-cream', style: { fontSize: '11px', marginTop: '4px' } }, movie.shelf)
                ),
                el('div', {},
                  movie.shelf === 'Completed' ? starCluster : el('button', {
                    class: 'btn btn-secondary',
                    style: { height: '32px', padding: '0 12px', fontSize: '12px', marginTop: '8px' },
                    onClick: () => {
                      movie.shelf = 'Completed';
                      movie.rating = 5;
                      saveMedia();
                      renderActiveMediaTab('movies');
                    }
                  }, "Mark Completed"),
                  movie.review ? el('p', { style: { fontSize: '12px', fontStyle: 'italic', marginTop: '8px', color: 'var(--colors-muted)' } }, `"${movie.review}"`) : null
                )
              )
            )
          );
        });

        // Add Movie Form
        grid.appendChild(
          el('div', { class: 'media-card', style: { flexDirection: 'column', gap: '8px' } },
            el('h3', { style: { fontSize: '20px' } }, "Add Movie / Show"),
            el('input', { type: 'text', placeholder: 'Title', class: 'form-control', id: 'mov-in-title' }),
            el('input', { type: 'number', placeholder: 'Release Year', class: 'form-control', id: 'mov-in-year' }),
            el('select', { class: 'form-control', id: 'mov-in-shelf' },
              el('option', { value: 'To Watch' }, "To Watch"),
              el('option', { value: 'Completed' }, "Completed")
            ),
            el('input', { type: 'text', placeholder: 'Quick review note...', class: 'form-control', id: 'mov-in-rev' }),
            el('button', {
              class: 'btn btn-primary',
              style: { marginTop: '8px' },
              onClick: () => {
                const title = document.getElementById('mov-in-title').value;
                const year = parseInt(document.getElementById('mov-in-year').value) || new Date().getFullYear();
                const shelf = document.getElementById('mov-in-shelf').value;
                const review = document.getElementById('mov-in-rev').value || '';
                
                if (title) {
                  movies.push({
                    title,
                    year,
                    shelf,
                    rating: shelf === 'Completed' ? 5 : 0,
                    review,
                    cover: ''
                  });
                  saveMedia();
                  renderActiveMediaTab('movies');
                }
              }
            }, "Save Entry")
          )
        );
      };

      renderMoviesGrid();
      mediaContent.appendChild(grid);
    }
  };

  renderActiveMediaTab('books');

  return el('div', { class: 'section' },
    el('div', { class: 'container' },
      el('h1', { style: { marginBottom: '24px' } }, "Media Vault"),
      tabs,
      mediaContent
    )
  );
}

// --- VIEW: SETTINGS ---
function renderSettings() {
  const geminiKeyEl = el('input', {
    type: 'password',
    class: 'form-control',
    placeholder: 'Enter Gemini API Key...',
    value: gemini.getGeminiKey(),
    onChange: (e) => {
      gemini.saveGeminiKey(e.target.value);
    }
  });

  const firebaseConfigInput = el('textarea', {
    class: 'form-control',
    style: { height: '140px', fontFamily: 'var(--font-mono)', fontSize: '12px' },
    placeholder: JSON.stringify(firebase.getFirebaseConfig(), null, 2)
  });
  
  if (firebase.isFirebaseConfigured()) {
    firebaseConfigInput.value = JSON.stringify(firebase.getFirebaseConfig(), null, 2);
  }

  const saveConfigBtn = el('button', {
    class: 'btn btn-primary',
    onClick: () => {
      try {
        const config = JSON.parse(firebaseConfigInput.value);
        const success = firebase.saveFirebaseConfig(config);
        if (success) {
          alert("Firebase config saved successfully! Reloading application...");
          firebase.reinitializeFirebase();
        } else {
          alert("Invalid config. API Key and Project ID are required.");
        }
      } catch (e) {
        alert("Invalid JSON format! Please copy-paste correct JSON config.");
      }
    }
  }, "Save Firebase Config");

  return el('div', { class: 'section' },
    el('div', { class: 'container', style: { display: 'flex', flexDirection: 'column', gap: '32px' } },
      el('h1', {}, "System Settings"),
      
      // Gemini API Settings
      el('div', { class: 'feature-card' },
        el('h3', {}, "Gemini API Coach"),
        el('p', { class: 'form-label', style: { marginBottom: '12px' } }, 
          "Input your Gemini API Key to enable direct AI health coaching feedback on the Dashboard. Get your key free at Google AI Studio."
        ),
        el('div', { style: { display: 'flex', gap: '8px' } },
          geminiKeyEl,
          el('button', {
            class: 'btn btn-secondary',
            onClick: () => {
              geminiKeyEl.type = geminiKeyEl.type === 'password' ? 'text' : 'password';
            }
          }, "Toggle View")
        )
      ),
      
      // Firebase Settings
      el('div', { class: 'feature-card' },
        el('h3', {}, "Firebase Database Connection"),
        el('p', { class: 'form-label', style: { marginBottom: '12px' } }, 
          "Paste your Firebase Project Web Configuration object (JSON) below to enable cross-device syncing with Firebase Auth Google Sign-In and Cloud Firestore."
        ),
        firebaseConfigInput,
        el('div', { style: { display: 'flex', gap: '12px', marginTop: '16px' } },
          saveConfigBtn,
          el('button', {
            class: 'btn btn-secondary',
            onClick: () => {
              firebase.saveFirebaseConfig(null);
              alert("Custom Firebase settings cleared. Reverting to Local-First mode.");
              window.location.reload();
            }
          }, "Reset to Local-First")
        )
      ),

      // Reset cache warning
      el('div', { class: 'feature-card', style: { borderColor: 'var(--colors-error)' } },
        el('h3', { style: { color: 'var(--colors-error)' } }, "System Cache Reset"),
        el('p', { class: 'form-label' }, "Clear all logged data, workout splits, recipes, and cached states from the local browser storage."),
        el('button', {
          class: 'btn btn-secondary',
          style: { alignSelf: 'flex-start', color: 'var(--colors-error)', borderColor: 'var(--colors-error)', marginTop: '16px' },
          onClick: () => {
            if (confirm("Are you absolutely sure you want to clear all local tracker logs and configs? This cannot be undone.")) {
              localStorage.clear();
              alert("Data cleared. App reloading...");
              window.location.reload();
            }
          }
        }, "Wipe App Cache")
      )
    )
  );
}
