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
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  
  // Set physical pixel bounds directly on the SVG DOM node
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  
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
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  water: "M12 2.5s6 6.42 6 11.1A6 6 0 0 1 6 13.6C6 8.92 12 2.5 12 2.5z",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  flame: "M8.5 14.5A4.5 4.5 0 0 0 12 22a6 6 0 0 0 6-6c0-4-3-6-3-9-2 1-3 3-3 5-2-1-3.5-3-3-6-3 3-4.5 6-4.5 8.5z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V5a2 2 0 0 1 2-2h14v18H6.5A2.5 2.5 0 0 1 4 19.5z",
  film: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4",
  sparkles: "M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"
};

const DEFAULT_HABITS = [
  { id: 'h1', title: 'Read 15 Pages', category: 'Mind' },
  { id: 'h2', title: '10k Steps Walked', category: 'Fitness' },
  { id: 'h3', title: 'Hydrated (8+ Cups)', category: 'Health' },
  { id: 'h4', title: 'No processed food', category: 'Nutrition' }
];

const VIEW_META = {
  dashboard: { title: 'Daily Digest', short: 'Digest' },
  fitness: { title: 'Training', short: 'Fitness' },
  habits: { title: 'Habits', short: 'Habits' },
  media: { title: 'Media Vault', short: 'Media' },
  settings: { title: 'Settings', short: 'Settings' },
  auth: { title: 'Sign In', short: 'Auth' }
};

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone shifts
  const day = date.getDate();
  const year = date.getFullYear();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = months[date.getMonth()];
  
  // Suffix calculation
  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';
  
  return `${day}${suffix} ${monthName} ${year}`;
}

function getHabitDefinitions() {
  return JSON.parse(localStorage.getItem('life_tracker_habits_list')) || DEFAULT_HABITS;
}

function renderPageHeader(title, subtitle, kicker = "Today") {
  return el('div', { class: 'page-header' },
    el('div', { class: 'page-header-copy' },
      el('span', { class: 'page-kicker' }, kicker),
      el('h1', {}, title),
      subtitle ? el('p', { class: 'page-subtitle' }, subtitle) : null
    )
  );
}

function renderMobileHeader() {
  const meta = VIEW_META[state.activeView] || VIEW_META.dashboard;
  return el('header', { class: 'mobile-app-header' },
    el('div', { class: 'mobile-app-title' },
      el('strong', {}, meta.short),
      el('span', {}, "Life Tracker")
    ),
    el('div', { class: 'custom-date-container' },
      el('span', {}, formatLongDate(state.dateStr)),
      el('input', {
        type: 'date',
        value: state.dateStr,
        onChange: (e) => {
          state.dateStr = e.target.value;
          const desktopDate = document.getElementById('global-date-picker');
          if (desktopDate) desktopDate.value = state.dateStr;
          if (state.user && firebase.db) {
            setupFirestoreLogSync(state.user, state.dateStr);
          }
          renderApp();
        }
      })
    )
  );
}

function renderActivityRingsSVG(calPercent, stepPercent, habitPercent) {
  const c1 = 2 * Math.PI * 38; // Radius 38 = 238.76
  const c2 = 2 * Math.PI * 29; // Radius 29 = 182.21
  const c3 = 2 * Math.PI * 20; // Radius 20 = 125.66

  const o1 = c1 - (Math.min(calPercent, 100) / 100 * c1);
  const o2 = c2 - (Math.min(stepPercent, 100) / 100 * c2);
  const o3 = c3 - (Math.min(habitPercent, 100) / 100 * c3);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("width", "120");
  svg.setAttribute("height", "120");
  svg.style.display = "block";

  const createRing = (r, strokeColor, bgStrokeColor, dashArray, dashOffset) => {
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bg.setAttribute("cx", "50");
    bg.setAttribute("cy", "50");
    bg.setAttribute("r", r);
    bg.setAttribute("stroke", bgStrokeColor);
    bg.setAttribute("stroke-width", "7");
    bg.setAttribute("fill", "none");

    const fg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fg.setAttribute("cx", "50");
    fg.setAttribute("cy", "50");
    fg.setAttribute("r", r);
    fg.setAttribute("stroke", strokeColor);
    fg.setAttribute("stroke-width", "7");
    fg.setAttribute("fill", "none");
    fg.setAttribute("stroke-dasharray", `${dashArray}`);
    fg.setAttribute("stroke-dashoffset", `${dashOffset}`);
    fg.setAttribute("stroke-linecap", "round");
    fg.setAttribute("transform", "rotate(-90 50 50)");

    return [bg, fg];
  };

  const [bg1, fg1] = createRing(38, "var(--colors-primary)", "#321b15", c1, o1);
  const [bg2, fg2] = createRing(29, "var(--colors-accent-teal)", "#142925", c2, o2);
  const [bg3, fg3] = createRing(20, "var(--colors-accent-amber)", "#2f2215", c3, o3);

  svg.appendChild(bg1);
  svg.appendChild(fg1);
  svg.appendChild(bg2);
  svg.appendChild(fg2);
  svg.appendChild(bg3);
  svg.appendChild(fg3);

  return svg;
}

function renderProgressRingWidget({ label, value, meta, iconPath, percent, strokeColor, bgStrokeColor, href, quickActionText, onQuickAction }) {
  const c = 2 * Math.PI * 26; // Circumference = 163.36
  const offset = c - (Math.min(percent, 100) / 100 * c);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", "64");
  svg.setAttribute("height", "64");

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", "32");
  bg.setAttribute("cy", "32");
  bg.setAttribute("r", "26");
  bg.setAttribute("stroke", bgStrokeColor);
  bg.setAttribute("stroke-width", "5.5");
  bg.setAttribute("fill", "none");

  const fg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fg.setAttribute("cx", "32");
  fg.setAttribute("cy", "32");
  fg.setAttribute("r", "26");
  fg.setAttribute("stroke", strokeColor);
  fg.setAttribute("stroke-width", "5.5");
  fg.setAttribute("fill", "none");
  fg.setAttribute("stroke-dasharray", `${c}`);
  fg.setAttribute("stroke-dashoffset", `${offset}`);
  fg.setAttribute("stroke-linecap", "round");
  fg.setAttribute("transform", "rotate(-90 32 32)");

  svg.appendChild(bg);
  svg.appendChild(fg);

  const attrs = {
    class: 'widget-metric-card',
    onClick: (e) => {
      // Navigate if they click the card itself and not any buttons inside it
      if (!e.target.closest('.widget-quick-btn')) {
        window.location.hash = href || '#dashboard';
      }
    }
  };

  const quickActionBtn = quickActionText ? el('button', {
    class: 'widget-quick-btn',
    style: {
      marginTop: '8px',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: 'var(--font-sans)',
      backgroundColor: bgStrokeColor,
      color: strokeColor,
      border: 'none',
      borderRadius: 'var(--rounded-sm)',
      cursor: 'pointer',
      width: 'fit-content',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'var(--transition-default)',
      outline: 'none'
    },
    onClick: (e) => {
      e.stopPropagation();
      if (onQuickAction) onQuickAction();
    }
  }, quickActionText) : null;

  return el('div', attrs,
    el('div', { class: 'widget-card-left' },
      el('span', { class: 'widget-card-label' }, label),
      el('span', { class: 'widget-card-value' }, value),
      meta ? el('span', { class: 'widget-card-meta' }, meta) : null,
      quickActionBtn
    ),
    el('div', { class: 'widget-card-right', style: { position: 'relative' } },
      svg,
      el('div', {
        style: {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: strokeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }, icon(iconPath, "widget-center-icon"))
    )
  );
}

function renderMetricTile({ label, value, meta, iconPath, href, onClick }) {
  const attrs = {
    href: href || '#dashboard',
    class: 'metric-tile'
  };
  if (onClick) attrs.onClick = onClick;
  return el('a', attrs,
    el('span', { class: 'metric-label' },
      label,
      iconPath ? icon(iconPath, "btn-icon") : null
    ),
    el('span', { class: 'metric-value' }, value),
    meta ? el('span', { class: 'metric-meta' }, meta) : null
  );
}

function renderQuickAction(label, meta, iconPath, onClick) {
  return el('button', { class: 'quick-action', onClick },
    el('span', { class: 'quick-action-icon' }, icon(iconPath, "btn-icon")),
    el('span', {},
      el('span', { class: 'quick-action-label' }, label),
      el('span', { class: 'quick-action-meta' }, meta)
    )
  );
}

function renderSegmentedTabs(tabs, active, onSelect) {
  return el('div', { class: 'segmented-control' },
    ...tabs.map(tab => el('button', {
      class: `segmented-btn ${active === tab.id ? 'active' : ''}`,
      onClick: () => onSelect(tab.id)
    }, tab.label))
  );
}

function renderFieldCard(label, inputEl, meta = "") {
  return el('div', { class: 'field-card' },
    el('span', { class: 'form-label' }, label),
    inputEl,
    meta ? el('span', { class: 'metric-meta' }, meta) : null
  );
}

function updateNumberFromInput(e, setter) {
  setter(e.target.value);
  const day = getTodayLog();
  syncDailyProgress(day);
  queueSave();
}

// --- Application State ---
let state = {
  user: null,
  profile: null, // User Onboarding Profile
  activeView: 'dashboard',
  dashboardSubTab: 'today',
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

let lastRenderedView = null;

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
    aiReview: null, // cached review for the day
    pagesRead: 0 // book pages read today
  };
}

function getActiveBurn(dayLog) {
  let burn = 0;
  if (dayLog.steps > 0) {
    burn += dayLog.steps * 0.04;
  }
  if (dayLog.workouts && dayLog.workouts.length > 0) {
    let totalSets = dayLog.workouts.reduce((acc, ex) => acc + (parseInt(ex.sets) || 0), 0);
    burn += 150 + (totalSets * 20);
  }
  return Math.round(burn);
}

function syncDailyProgress(day) {
  if (!day.habitsCompleted) {
    day.habitsCompleted = [];
  }
  // Sync 10k Steps habit (h2)
  if (day.steps >= 10000 && !day.habitsCompleted.includes('h2')) {
    day.habitsCompleted.push('h2');
  }
  // Sync Hydration habit (h3)
  if (day.water >= 8 && !day.habitsCompleted.includes('h3')) {
    day.habitsCompleted.push('h3');
  }
}

function generateInsights(day) {
  const insights = [];
  
  // 1. Sleep prompt
  if (!day.sleep || day.sleep === 0) {
    insights.push({
      id: 'log-sleep',
      text: "You haven't logged sleep yet today.",
      actionText: "Log Sleep",
      action: (container) => {
        container.replaceChildren(
          el('span', { style: { fontSize: '13px', fontWeight: '500', marginRight: '8px' } }, "Hours:"),
          el('input', {
            type: 'number',
            step: '0.5',
            class: 'form-control',
            style: { width: '80px', height: '28px', display: 'inline-block', padding: '2px 6px', marginRight: '8px' },
            placeholder: '8',
            id: 'inline-sleep-val'
          }),
          el('button', {
            class: 'insights-btn-quick',
            style: { height: '28px', padding: '0 12px', fontSize: '12px' },
            onClick: () => {
              const val = parseFloat(document.getElementById('inline-sleep-val').value) || 0;
              if (val > 0) {
                day.sleep = val;
                queueSave();
                renderApp();
              }
            }
          }, "Save")
        );
      }
    });
  }

  // 2. Active workout calorie burn prompt
  if (day.workouts && day.workouts.length > 0) {
    let totalSets = day.workouts.reduce((acc, ex) => acc + (parseInt(ex.sets) || 0), 0);
    const burn = 150 + (totalSets * 20);
    insights.push({
      id: 'workout-burn',
      text: `Workout active burn: -${burn} kcal calculated from ${day.workouts.length} exercises.`,
      actionText: "Check Balance",
      action: () => {
        window.location.hash = '#fitness';
      }
    });
  }

  // 3. Reading page sync prompt
  const pages = day.pagesRead || 0;
  if (pages > 0) {
    if (pages < 15 && !day.habitsCompleted.includes('h1')) {
      insights.push({
        id: 'read-pages-progress',
        text: `You read ${pages} pages of a book today. Mark 'Read 15 Pages' habit as complete?`,
        actionText: "Mark Complete",
        action: () => {
          if (!day.habitsCompleted.includes('h1')) {
            day.habitsCompleted.push('h1');
            queueSave();
            renderApp();
          }
        }
      });
    } else if (pages >= 15) {
      insights.push({
        id: 'read-pages-success',
        text: `Awesome! You read ${pages} pages today. 'Read 15 Pages' habit has been completed.`,
        actionText: "View Habits",
        action: () => {
          window.location.hash = '#habits';
        }
      });
    }
  }

  // 4. Steps prompt
  if (day.steps && day.steps >= 10000 && !day.habitsCompleted.includes('h2')) {
    insights.push({
      id: 'steps-success',
      text: `You reached your 10k steps goal (${day.steps.toLocaleString()} steps)!`,
      actionText: "Complete Habit",
      action: () => {
        if (!day.habitsCompleted.includes('h2')) {
          day.habitsCompleted.push('h2');
          queueSave();
          renderApp();
        }
      }
    });
  }

  return insights;
}

function getTodayLog() {
  if (!state.logs[state.dateStr]) {
    state.logs[state.dateStr] = getEmptyDayLog();
  }
  const day = state.logs[state.dateStr];
  syncDailyProgress(day);
  return day;
}

// Local Storage Fallbacks
function loadLocalState() {
  const localLogs = localStorage.getItem('life_tracker_logs');
  const localSplits = localStorage.getItem('life_tracker_splits');
  const localRecipes = localStorage.getItem('life_tracker_recipes');
  const localProfile = localStorage.getItem('life_tracker_profile');
  
  if (localProfile) state.profile = JSON.parse(localProfile);
  if (localLogs) state.logs = JSON.parse(localLogs);
  if (localSplits) state.workoutSplit = JSON.parse(localSplits);
  if (localRecipes) state.recipes = JSON.parse(localRecipes);
}

function saveLocalState() {
  localStorage.setItem('life_tracker_logs', JSON.stringify(state.logs));
  localStorage.setItem('life_tracker_splits', JSON.stringify(state.workoutSplit));
  localStorage.setItem('life_tracker_recipes', JSON.stringify(state.recipes));
  localStorage.setItem('life_tracker_profile', JSON.stringify(state.profile));
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
      if (data.profile) state.profile = data.profile;
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
      recipes: state.recipes,
      profile: state.profile || null
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
    const label = document.getElementById('desktop-date-label');
    if (label) label.textContent = formatLongDate(state.dateStr);
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
  const shouldResetScroll = lastRenderedView !== state.activeView;
  const desktopDate = document.getElementById('global-date-picker');
  if (desktopDate) {
    desktopDate.value = state.dateStr;
    const label = document.getElementById('desktop-date-label');
    if (label) label.textContent = formatLongDate(state.dateStr);
  }

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
    mainContainer.appendChild(renderMobileHeader());
    mainContainer.appendChild(renderAuthPage());
    if (shouldResetScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
    }
    lastRenderedView = state.activeView;
    return;
  }

  mainContainer.appendChild(renderMobileHeader());

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

  if (shouldResetScroll) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
  }
  lastRenderedView = state.activeView;
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

  const totalCals = day.calories || 0;
  const activeBurn = getActiveBurn(day);
  const netCals = Math.max(0, totalCals - activeBurn);
  const calGoal = 2000; // default
  const calPercent = Math.min(100, Math.round((netCals / calGoal) * 100));
  const stepGoal = 10000;
  const stepPercent = Math.min(100, Math.round(((day.steps || 0) / stepGoal) * 100));
  const habits = getHabitDefinitions();
  const habitsDone = (day.habitsCompleted || []).length;
  const habitPercent = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0;
  const dailyScore = Math.round((
    Math.min(stepPercent, 100) +
    Math.min(calPercent, 100) +
    Math.min((day.sleep || 0) / 8 * 100, 100) +
    Math.min((day.water || 0) / 8 * 100, 100) +
    habitPercent
  ) / 5);

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

  const trends = getWeeklyTrends(state.dateStr);
  const trendSign = trends.weightChange7d > 0 ? '+' : '';
  const trendsGrid = el('div', { class: 'panel-card' },
    el('h3', {}, "7-Day Pattern"),
    el('div', { class: 'card-grid card-grid-2' },
      renderMetricTile({
        label: "Avg Steps",
        value: trends.avgSteps7d > 0 ? trends.avgSteps7d.toLocaleString() : "No logs",
        meta: "Daily movement average",
        iconPath: ICONS.chevronRight,
        href: '#fitness'
      }),
      renderMetricTile({
        label: "Avg Calories",
        value: trends.avgCalories7d > 0 ? `${trends.avgCalories7d}` : "No logs",
        meta: "Calories logged per day",
        iconPath: ICONS.flame,
        href: '#fitness'
      }),
      renderMetricTile({
        label: "Avg Sleep",
        value: trends.avgSleep7d > 0 ? `${trends.avgSleep7d}h` : "No logs",
        meta: "Sleep rhythm this week",
        iconPath: ICONS.moon,
        href: '#fitness'
      }),
      renderMetricTile({
        label: "Weight",
        value: trends.weightChange7d !== 0 ? `${trendSign}${trends.weightChange7d.toFixed(1)}kg` : "Stable",
        meta: trends.weightChange7d !== 0 ? "7-day change" : "No weekly change logged",
        iconPath: ICONS.sparkles,
        href: '#fitness'
      })
    )
  );

  const insightsList = generateInsights(day);
  let insightsCard = null;
  if (insightsList.length > 0) {
    insightsCard = el('div', { class: 'insights-card' },
      el('div', { class: 'insights-header' },
        icon("M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "btn-icon"),
        "Proactive Insights"
      ),
      el('div', { style: { display: 'flex', flexDirection: 'column' } },
        ...insightsList.map(item => {
          const itemContainer = el('div', { class: 'insights-item' });
          const textEl = el('span', { class: 'insights-item-text' }, item.text);
          const btnEl = el('button', {
            class: 'insights-btn-quick',
            onClick: () => {
              item.action(itemContainer);
            }
          }, item.actionText);
          
          itemContainer.appendChild(textEl);
          itemContainer.appendChild(btnEl);
          return itemContainer;
        })
      )
    );
  }

  const metrics = el('div', { class: 'widget-metric-grid' },
    renderProgressRingWidget({
      label: "Workout",
      value: day.workouts.length > 0 ? `${day.workouts.length} logged` : "Rest day",
      meta: day.workouts.length > 0 ? "Today's exercises" : "No lift logged yet",
      iconPath: ICONS.fitness,
      percent: day.workouts.length > 0 ? 100 : 0,
      strokeColor: "var(--colors-primary)",
      bgStrokeColor: "rgba(204, 120, 92, 0.15)",
      href: '#fitness'
    }),
    renderProgressRingWidget({
      label: "Steps",
      value: `${(day.steps || 0).toLocaleString()}`,
      meta: `${stepGoal.toLocaleString()} step goal`,
      iconPath: ICONS.chevronRight,
      percent: stepPercent,
      strokeColor: "var(--colors-accent-teal)",
      bgStrokeColor: "rgba(93, 184, 166, 0.15)",
      href: '#fitness',
      quickActionText: "+ Add Steps",
      onQuickAction: () => {
        const val = prompt("Enter today's total steps:", day.steps || "");
        if (val !== null) {
          day.steps = parseInt(val) || 0;
          syncDailyProgress(day);
          queueSave();
          renderApp();
        }
      }
    }),
    renderProgressRingWidget({
      label: "Nutrition",
      value: `${netCals}`,
      meta: `${totalCals} in · ${activeBurn} burn`,
      iconPath: ICONS.flame,
      percent: calPercent,
      strokeColor: "var(--colors-primary)",
      bgStrokeColor: "rgba(204, 120, 92, 0.15)",
      href: '#fitness',
      quickActionText: "+ Log Cal",
      onQuickAction: () => {
        const name = prompt("Enter meal description (optional):", "Quick log");
        if (name !== null) {
          const calsVal = prompt("Enter calories (kcal):", "300");
          if (calsVal !== null) {
            const cals = parseInt(calsVal) || 0;
            const protVal = prompt("Enter protein (g, optional):", "0");
            const prot = parseInt(protVal) || 0;
            if (!day.meals) day.meals = [];
            day.meals.push({ title: name || "Quick log", calories: cals, protein: prot });
            day.calories = (day.calories || 0) + cals;
            day.protein = (day.protein || 0) + prot;
            syncDailyProgress(day);
            queueSave();
            renderApp();
          }
        }
      }
    }),
    renderProgressRingWidget({
      label: "Sleep",
      value: `${day.sleep || 0}h`,
      meta: "8h daily sleep goal",
      iconPath: ICONS.moon,
      percent: Math.min(100, Math.round(((day.sleep || 0) / 8) * 100)),
      strokeColor: "var(--colors-accent-amber)",
      bgStrokeColor: "rgba(232, 165, 90, 0.15)",
      href: '#fitness',
      quickActionText: "Log Sleep",
      onQuickAction: () => {
        const val = prompt("How many hours did you sleep?", day.sleep || "");
        if (val !== null) {
          day.sleep = parseFloat(val) || 0;
          syncDailyProgress(day);
          queueSave();
          renderApp();
        }
      }
    }),
    renderProgressRingWidget({
      label: "Water",
      value: `${day.water || 0}/8`,
      meta: "8 cup hydration goal",
      iconPath: ICONS.water,
      percent: Math.min(100, Math.round(((day.water || 0) / 8) * 100)),
      strokeColor: "var(--colors-accent-teal)",
      bgStrokeColor: "rgba(93, 184, 166, 0.15)",
      href: '#fitness',
      quickActionText: "+ 1 Cup",
      onQuickAction: () => {
        day.water = (day.water || 0) + 1;
        syncDailyProgress(day);
        queueSave();
        renderApp();
      }
    }),
    renderProgressRingWidget({
      label: "Habits",
      value: `${habitsDone}/${habits.length}`,
      meta: "Routine check items",
      iconPath: ICONS.check,
      percent: habitPercent,
      strokeColor: "var(--colors-accent-amber)",
      bgStrokeColor: "rgba(232, 165, 90, 0.15)",
      href: '#habits'
    })
  );

  const cockpitRings = renderActivityRingsSVG(calPercent, stepPercent, habitPercent);

  const heroCard = el('section', { class: 'activity-cockpit' },
    cockpitRings,
    el('div', { class: 'activity-cockpit-info' },
      el('span', { class: 'page-kicker', style: { color: 'var(--colors-on-dark-soft)' } }, "Today's readiness"),
      el('h2', { style: { fontSize: '24px', margin: '0' } }, dailyScore >= 70 ? "You are building momentum." : "Start with one clean log."),
      el('div', { class: 'activity-cockpit-score' },
        el('strong', {}, `${dailyScore}`),
        el('span', {}, "/ 100 daily score")
      ),
      el('div', { class: 'activity-legend' },
        el('div', { class: 'activity-legend-item' },
          el('span', { class: 'activity-dot calories' }),
          el('span', {}, `Calories: ${calPercent}%`)
        ),
        el('div', { class: 'activity-legend-item' },
          el('span', { class: 'activity-dot steps' }),
          el('span', {}, `Steps: ${stepPercent}%`)
        ),
        el('div', { class: 'activity-legend-item' },
          el('span', { class: 'activity-dot habits' }),
          el('span', {}, `Habits: ${habitPercent}%`)
        )
      )
    )
  );

  const subTabs = el('div', { class: 'segmented-control', style: { marginBottom: '24px' } },
    el('button', {
      class: `segmented-btn ${state.dashboardSubTab === 'today' ? 'active' : ''}`,
      onClick: () => {
        state.dashboardSubTab = 'today';
        renderApp();
      }
    }, "Today's Activity"),
    el('button', {
      class: `segmented-btn ${state.dashboardSubTab === 'coach' ? 'active' : ''}`,
      onClick: () => {
        state.dashboardSubTab = 'coach';
        renderApp();
      }
    }, "AI Coach & Trends")
  );

  let dashboardContent;
  if (state.dashboardSubTab === 'today') {
    dashboardContent = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } },
      el('div', { class: 'command-center' },
        heroCard,
        el('aside', { class: 'panel-card' },
          el('h3', {}, "Next Best Actions"),
          insightsCard || el('div', { class: 'empty-state' }, "No urgent prompts. Keep logging the basics as the day moves."),
          el('button', { class: 'btn btn-primary', style: { marginTop: '16px', width: '100%' }, onClick: () => { window.location.hash = '#fitness'; } }, "Open Quick Log")
        )
      ),
      el('div', {}, metrics)
    );
  } else {
    dashboardContent = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } },
      coachPanel,
      trendsGrid
    );
  }

  return el('div', { class: 'section' },
    el('div', { class: 'container' },
      el('div', { class: 'page-header', style: { marginBottom: '16px' } },
        el('div', { class: 'page-header-copy' },
          el('h1', { style: { fontSize: '36px', margin: 0 } }, "Daily Digest")
        )
      ),
      subTabs,
      dashboardContent
    )
  );
}

// --- VIEW: FITNESS ---
function renderFitness() {
  const day = getTodayLog();
  
  // Track active visual tab (Split Planner vs Log)
  const tabs = el('div', { class: 'segmented-control' });
  const fitnessContent = el('div', {});

  const renderActiveFitnessTab = (tabName) => {
    fitnessContent.replaceChildren();
    
    // Rerender tabs buttons
    tabs.replaceChildren(
      el('button', { class: `segmented-btn ${tabName === 'log' ? 'active' : ''}`, onClick: () => renderActiveFitnessTab('log') }, "Quick Log"),
      el('button', { class: `segmented-btn ${tabName === 'diet' ? 'active' : ''}`, onClick: () => renderActiveFitnessTab('diet') }, "Nutrition"),
      el('button', { class: `segmented-btn ${tabName === 'planner' ? 'active' : ''}`, onClick: () => renderActiveFitnessTab('planner') }, "Planner")
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
          exercisesList.appendChild(el('div', { class: 'empty-state' },
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
      const statsPanel = el('div', { class: 'panel-card', style: { marginBottom: '24px' } },
        el('h2', { style: { fontSize: '26px' } }, "Quick Metrics"),
        el('div', { class: 'quick-log-grid' },
          // Steps Input
          renderFieldCard("Daily Steps",
            el('input', {
              type: 'number',
              class: 'form-control',
              value: day.steps || '',
              onInput: (e) => updateNumberFromInput(e, (value) => {
                day.steps = parseInt(value) || 0;
              }),
              placeholder: '10000',
              onChange: (e) => {
                day.steps = parseInt(e.target.value) || 0;
                syncDailyProgress(day);
                queueSave();
              }
            }),
            "Updates the 10k habit automatically."
          ),
          // Sleep Input
          renderFieldCard("Sleep Hours",
            el('input', {
              type: 'number',
              step: '0.5',
              class: 'form-control',
              value: day.sleep || '',
              onInput: (e) => updateNumberFromInput(e, (value) => {
                day.sleep = parseFloat(value) || 0;
              }),
              placeholder: '8',
              onChange: (e) => {
                day.sleep = parseFloat(e.target.value) || 0;
                syncDailyProgress(day);
                queueSave();
              }
            }),
            "Used in your daily score."
          ),
          // Weight Input
          renderFieldCard("Body Weight (kg)",
            el('input', {
              type: 'number',
              step: '0.1',
              class: 'form-control',
              value: day.weight || '',
              onInput: (e) => updateNumberFromInput(e, (value) => {
                day.weight = parseFloat(value) || 0;
              }),
              placeholder: '75.5',
              onChange: (e) => {
                day.weight = parseFloat(e.target.value) || 0;
                syncDailyProgress(day);
                queueSave();
              }
            }),
            "Feeds the weekly weight pattern."
          )
        )
      );

      fitnessContent.appendChild(el('div', {},
        statsPanel,
        el('h2', { style: { fontSize: '26px', marginBottom: '16px' } }, "Today's Lift"),
        el('p', { class: 'form-label', style: { marginBottom: '16px' } }, "Pick a split template to auto-fill, or manually log items:"),
        splitChips,
        exercisesList
      ));

    } else if (tabName === 'planner') {
      // Split Routine Planner View
      const splitEditor = el('div', { class: 'split-planner-grid' });
      const renderSplitEditor = () => {
        splitEditor.replaceChildren();
        
        Object.entries(state.workoutSplit).forEach(([splitName, exercises]) => {
          const exercisesSublist = el('div', { class: 'split-exercise-list' });
          
          exercises.forEach((ex, idx) => {
            exercisesSublist.appendChild(
              el('div', { class: 'split-exercise-item' },
                el('div', {},
                  el('span', { class: 'split-exercise-name' }, ex.name),
                  el('span', { class: 'split-exercise-info' }, `${ex.sets}s × ${ex.reps}r @ ${ex.weight}kg`)
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
            el('div', { class: 'split-planner-card' },
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
            style: { gridColumn: '1 / -1', justifySelf: 'start' },
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
      const activeBurn = getActiveBurn(day);
      const netCals = Math.max(0, (day.calories || 0) - activeBurn);
      const calGoal = 2000;
      const calPercent = Math.min(100, Math.round((netCals / calGoal) * 100));

      const nutritionSummary = el('div', { class: 'feature-card', style: { marginBottom: '24px', backgroundColor: 'var(--colors-surface-soft)' } },
        el('h3', { style: { fontSize: '22px' } }, "Daily Calorie Balance"),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' } },
          el('div', {},
            el('div', { style: { fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: '600' } }, `${netCals} / ${calGoal} kcal`),
            el('p', { class: 'form-label', style: { marginTop: '4px' } }, `Intake: ${day.calories || 0} kcal  ·  Active Burn: -${activeBurn} kcal`)
          ),
          el('div', { style: { textAlign: 'right' } },
            el('span', { class: 'badge badge-coral' }, `Protein: ${day.protein || 0}g`)
          )
        ),
        el('div', { class: 'progress-bar-container', style: { marginTop: '12px' } },
          el('div', { class: 'progress-bar-fill', style: { width: `${calPercent}%` } })
        )
      );

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
        nutritionSummary,
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
      renderPageHeader("Training & Nutrition", "Fast-log daily metrics first, then drill into workouts, meals, and saved routines.", "Fitness"),
      tabs,
      fitnessContent
    )
  );
}

// --- VIEW: HABITS ---
function renderHabits() {
  const day = getTodayLog();
  
  // Custom Habits definitions
  let habits = getHabitDefinitions();
  
  const saveHabits = () => {
    localStorage.setItem('life_tracker_habits_list', JSON.stringify(habits));
    queueSave();
  };

  const completedCount = () => habits.filter(habit => day.habitsCompleted.includes(habit.id)).length;
  const list = el('div', { class: 'panel-card' });
  
  const renderHabitsChecklist = () => {
    const habitRows = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
    
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
      
      habitRows.appendChild(
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
    const addInput = el('div', { class: 'form-row', style: { marginTop: '16px' } },
      el('input', { type: 'text', placeholder: 'New habit title...', class: 'form-control', style: { flex: '1 1 220px' }, id: 'new-habit-title' }),
      el('input', { type: 'text', placeholder: 'Category', class: 'form-control', style: { flex: '1 1 130px' }, id: 'new-habit-cat' }),
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
    list.replaceChildren(
      el('div', { class: 'page-header', style: { marginBottom: '16px' } },
        el('div', {},
          el('h2', { style: { fontSize: '28px' } }, "Today's Checklist"),
          el('p', { class: 'page-subtitle' }, `${completedCount()} of ${habits.length} habits complete for ${state.dateStr}.`)
        ),
        el('span', { class: 'badge badge-coral' }, `${habits.length ? Math.round((completedCount() / habits.length) * 100) : 0}%`)
      ),
      habitRows,
      addInput
    );
  };
  
  renderHabitsChecklist();

  // Weekly Grid Progress Tracker View
  const weeklyGrid = el('div', { class: 'feature-card', style: { marginTop: '32px' } },
    el('h3', {}, "Weekly Routine Progress"),
    el('p', { class: 'form-label', style: { marginBottom: '16px' } }, "Completion rates over the current calendar week.")
  );
  
  const renderWeeklyGrid = () => {
    // Generate dates for current Mon-Sun
    const curr = new Date(state.dateStr);
    const first = curr.getDate() - curr.getDay() + 1; // Mon
    
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
        const d = new Date(curr);
        d.setDate(first + i);
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
      renderPageHeader("Habit Journal", "Keep the checklist on top, then use the weekly grid to spot what is sticking.", "Routines"),
      list,
      weeklyGrid
    )
  );
}

// --- VIEW: MEDIA (BOOKS & MOVIES) ---
function renderMedia() {
  const tabs = el('div', { class: 'segmented-control' });
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
      el('button', { class: `segmented-btn ${tabName === 'books' ? 'active' : ''}`, onClick: () => renderActiveMediaTab('books') }, "Books"),
      el('button', { class: `segmented-btn ${tabName === 'movies' ? 'active' : ''}`, onClick: () => renderActiveMediaTab('movies') }, "Movies & Shows")
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
              style: { width: '92px', height: '40px' },
              value: book.read,
              onChange: (e) => {
                const readPages = Math.min(book.pages, parseInt(e.target.value) || 0);
                const diff = readPages - book.read;
                
                book.read = readPages;
                if (book.read === book.pages) {
                  book.shelf = 'Completed';
                }
                
                if (diff > 0) {
                  const today = getTodayLog();
                  today.pagesRead = (today.pagesRead || 0) + diff;
                  
                  // Auto-complete reading habit (h1) if total read pages today >= 15
                  if (today.pagesRead >= 15 && !today.habitsCompleted.includes('h1')) {
                    today.habitsCompleted.push('h1');
                  }
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
              starCluster.appendChild(el('button', {
                class: 'btn btn-text star-btn',
                onClick: () => {
                  movie.rating = i;
                  saveMedia();
                  renderStars();
                }
              },
                icon(ICONS.star, `btn-icon ${i <= (movie.rating || 0) ? 'active' : ''}`)
              )
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
      renderPageHeader("Media Vault", "Track pages, shelves, watch status, and quick reflections without turning the library into a form maze.", "Books & Shows"),
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
    el('div', { class: 'container' },
      renderPageHeader("System Settings", "Manage sync, AI coaching, and local data without digging through one long technical panel.", "App Setup"),
      el('div', { class: 'settings-grid' },
        el('div', { class: 'feature-card' },
          el('h3', {}, "Account & Sync"),
          el('p', { class: 'form-label' }, state.user ? `Signed in as ${state.user.email || 'Google user'}.` : "Running in local-first mode."),
          el('div', { class: 'form-row', style: { marginTop: '16px' } },
            el('span', { class: 'badge badge-pill-cream' }, firebase.isFirebaseConfigured() ? "Firebase configured" : "Local only"),
            el('span', { class: 'badge badge-teal' }, navigator.onLine ? "Online" : "Offline")
          )
        ),
      
      // Gemini API Settings
      el('div', { class: 'feature-card' },
        el('h3', {}, "Gemini API Coach"),
        el('p', { class: 'form-label', style: { marginBottom: '12px' } }, 
          "Input your Gemini API Key to enable direct AI health coaching feedback on the Dashboard. Get your key free at Google AI Studio."
        ),
        el('div', { class: 'form-row' },
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
        el('div', { class: 'form-row', style: { marginTop: '16px' } },
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
      el('div', { class: 'feature-card danger-card' },
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
    )
  );
}
