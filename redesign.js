import * as firebase from './firebase-config.js';
import * as gemini from './gemini.js';

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Redesign SW registered:', reg.scope))
      .catch(err => console.log('Redesign SW registration failed:', err));
  });
}

// --- DOM Builder Helpers (Strictly Compliant with XSS Rules) ---
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
  svg.setAttribute("stroke-width", "2.2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  
  if (classList) {
    svg.setAttribute("class", classList);
  }
  
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  return svg;
}

// Lucide Style SVG Path Dictionary
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
  sparkles: "M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  close: "M18 6L6 18M6 6l12 12",
  steps: "M4 16v-2.38C4 11.5 5.88 9.85 6 7.07l.08-1.57A1.65 1.65 0 0 1 7.72 4h.08a1.65 1.65 0 0 1 1.64 1.5l.08 1.57C9.65 9.85 11.5 11.5 11.5 13.62V16M12.5 16v-2.38c0-2.12 1.88-3.77 2-6.55l.08-1.57A1.65 1.65 0 0 1 16.22 4h.08a1.65 1.65 0 0 1 1.64 1.5l.08 1.57c.13 2.78 2 4.43 2 6.55V16"
};

const DEFAULT_HABITS = [
  { id: 'h1', title: 'Read 15 Pages', category: 'Mind' },
  { id: 'h2', title: '10k Steps Walked', category: 'Fitness' },
  { id: 'h3', title: 'Hydrated (8+ Cups)', category: 'Health' },
  { id: 'h4', title: 'No processed food', category: 'Nutrition' }
];

const VIEW_META = {
  dashboard: { title: 'Daily Digest', short: 'Digest' },
  fitness: { title: 'Training & Fuel', short: 'Fitness' },
  habits: { title: 'Daily Habits', short: 'Habits' },
  media: { title: 'Media Vault', short: 'Media' },
  settings: { title: 'App Settings', short: 'Settings' },
  auth: { title: 'Sync Portal', short: 'Auth' }
};

// --- Application State (with LocalStorage namespace for Redesign prototype) ---
let state = {
  user: null,
  activeView: 'dashboard',
  dashboardSubTab: 'today',
  dateStr: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  
  // Custom split routines
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
  
  // Daily Logs indexed by date
  logs: {},

  // Shelves for Books and Movies
  books: [
    { id: 'b1', title: 'Atomic Habits', author: 'James Clear', totalPages: 320, pagesRead: 110, status: 'reading' },
    { id: 'b2', title: 'Deep Work', author: 'Cal Newport', totalPages: 300, pagesRead: 300, status: 'completed' }
  ],
  movies: [
    { id: 'm1', title: 'Interstellar', year: 2014, rating: 5, review: 'Absolutely mindbending visual and scientific masterpiece.', status: 'watched' },
    { id: 'm2', title: 'Dune: Part Two', year: 2024, rating: 5, review: 'Unbelievable sound design and visual scope. Cinematography peak.', status: 'watched' }
  ]
};

let lastRenderedView = null;

// Get default empty daily logs structure
function getEmptyDayLog() {
  return {
    steps: 0,
    water: 0, 
    sleep: 0, 
    weight: 0, 
    calories: 0,
    protein: 0,
    meals: [],
    workouts: [], 
    habitsCompleted: [], 
    aiReview: null, 
    pagesRead: 0 
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
  const stepsIndex = day.habitsCompleted.indexOf('h2');
  if (day.steps >= 10000) {
    if (stepsIndex === -1) day.habitsCompleted.push('h2');
  } else {
    if (stepsIndex !== -1) day.habitsCompleted.splice(stepsIndex, 1);
  }

  // Sync Hydration habit (h3)
  const waterIndex = day.habitsCompleted.indexOf('h3');
  if (day.water >= 8) {
    if (waterIndex === -1) day.habitsCompleted.push('h3');
  } else {
    if (waterIndex !== -1) day.habitsCompleted.splice(waterIndex, 1);
  }
}

function getTodayLog() {
  if (!state.logs[state.dateStr]) {
    state.logs[state.dateStr] = getEmptyDayLog();
  }
  const day = state.logs[state.dateStr];
  syncDailyProgress(day);
  return day;
}

// Local Storage Handlers
function loadLocalState() {
  const localLogs = localStorage.getItem('life_tracker_redesign_logs');
  const localSplits = localStorage.getItem('life_tracker_redesign_splits');
  const localRecipes = localStorage.getItem('life_tracker_redesign_recipes');
  const localBooks = localStorage.getItem('life_tracker_redesign_books');
  const localMovies = localStorage.getItem('life_tracker_redesign_movies');
  
  if (localLogs) state.logs = JSON.parse(localLogs);
  if (localSplits) state.workoutSplit = JSON.parse(localSplits);
  if (localRecipes) state.recipes = JSON.parse(localRecipes);
  if (localBooks) state.books = JSON.parse(localBooks);
  if (localMovies) state.movies = JSON.parse(localMovies);
  
  // Seed initial values for mock completeness grid representation if empty
  if (Object.keys(state.logs).length < 5) {
    const today = new Date();
    for (let i = 1; i <= 15; i++) {
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      const dateStr = pastDate.toISOString().split('T')[0];
      state.logs[dateStr] = {
        steps: Math.floor(Math.random() * 6000) + 5000,
        water: Math.floor(Math.random() * 6) + 3,
        sleep: Math.floor(Math.random() * 3) + 5.5,
        weight: 78.4 + (Math.random() * 0.8 - 0.4),
        calories: Math.floor(Math.random() * 600) + 1500,
        protein: Math.floor(Math.random() * 60) + 80,
        workouts: Math.random() > 0.5 ? [{ name: 'Squats', sets: 4, reps: 8, weight: 70 }] : [],
        habitsCompleted: Math.random() > 0.5 ? ['h2', 'h3'] : ['h1'],
        pagesRead: Math.floor(Math.random() * 20)
      };
    }
    saveLocalState();
  }
}

function saveLocalState() {
  localStorage.setItem('life_tracker_redesign_logs', JSON.stringify(state.logs));
  localStorage.setItem('life_tracker_redesign_splits', JSON.stringify(state.workoutSplit));
  localStorage.setItem('life_tracker_redesign_recipes', JSON.stringify(state.recipes));
  localStorage.setItem('life_tracker_redesign_books', JSON.stringify(state.books));
  localStorage.setItem('life_tracker_redesign_movies', JSON.stringify(state.movies));
}

// Format Long Date strings nicely
function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDate();
  const year = date.getFullYear();
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthName = months[date.getMonth()];
  
  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';
  
  return `${monthName} ${day}${suffix}, ${year}`;
}

function getHabitDefinitions() {
  return JSON.parse(localStorage.getItem('life_tracker_redesign_habits_list')) || DEFAULT_HABITS;
}

function saveHabitDefinitions(list) {
  localStorage.setItem('life_tracker_redesign_habits_list', JSON.stringify(list));
}

// Generate Proactive Insights list
function generateInsights(day) {
  const insights = [];
  
  if (!day.sleep || day.sleep === 0) {
    insights.push({
      id: 'log-sleep',
      category: 'sleep',
      text: "You haven't recorded sleep for last night yet.",
      actionText: "Log Sleep",
      action: () => {
        openSleepLogger(day);
      }
    });
  }

  if (day.water < 8) {
    insights.push({
      id: 'hydration-refocus',
      category: 'water',
      text: `Water balance: ${day.water}/8 cups. Drink a glass to boost energy.`,
      actionText: "+ 1 Cup",
      action: () => {
        day.water = (day.water || 0) + 1;
        syncDailyProgress(day);
        queueSave();
        renderApp();
      }
    });
  }

  if (day.steps < 10000) {
    insights.push({
      id: 'steps-check',
      category: 'steps',
      text: `Step progression: ${day.steps.toLocaleString()}/10k steps logged today.`,
      actionText: "+ 2k Steps",
      action: () => {
        day.steps = (day.steps || 0) + 2000;
        syncDailyProgress(day);
        queueSave();
        renderApp();
      }
    });
  }

  return insights;
}

// ============================================================
// FOOD DATABASE (common foods with nutrition per serving)
// ============================================================
const FOOD_DATABASE = [
  { name: 'Chicken Breast', serving: '150g', cal: 248, protein: 46 },
  { name: 'Salmon Fillet', serving: '150g', cal: 312, protein: 34 },
  { name: 'Eggs (2 large)', serving: '2 eggs', cal: 156, protein: 12 },
  { name: 'Greek Yogurt', serving: '200g', cal: 146, protein: 20 },
  { name: 'Oatmeal', serving: '1 cup', cal: 154, protein: 5 },
  { name: 'Brown Rice', serving: '1 cup cooked', cal: 216, protein: 5 },
  { name: 'White Rice', serving: '1 cup cooked', cal: 242, protein: 4 },
  { name: 'Pasta', serving: '1 cup cooked', cal: 220, protein: 8 },
  { name: 'Whole Wheat Bread', serving: '2 slices', cal: 182, protein: 7 },
  { name: 'Sweet Potato', serving: '1 medium', cal: 103, protein: 2 },
  { name: 'Banana', serving: '1 medium', cal: 105, protein: 1 },
  { name: 'Apple', serving: '1 medium', cal: 95, protein: 0 },
  { name: 'Avocado', serving: '1/2 fruit', cal: 161, protein: 2 },
  { name: 'Spinach Salad', serving: '2 cups', cal: 14, protein: 2 },
  { name: 'Broccoli', serving: '1 cup', cal: 55, protein: 4 },
  { name: 'Almonds', serving: '30g (23 nuts)', cal: 170, protein: 6 },
  { name: 'Peanut Butter', serving: '2 tbsp', cal: 190, protein: 7 },
  { name: 'Protein Shake', serving: '1 scoop + water', cal: 120, protein: 24 },
  { name: 'Whey Protein Bar', serving: '1 bar', cal: 220, protein: 20 },
  { name: 'Milk (Whole)', serving: '1 cup', cal: 149, protein: 8 },
  { name: 'Cottage Cheese', serving: '1 cup', cal: 206, protein: 28 },
  { name: 'Paneer', serving: '100g', cal: 265, protein: 18 },
  { name: 'Tofu', serving: '100g', cal: 144, protein: 17 },
  { name: 'Dal (Lentils)', serving: '1 cup cooked', cal: 230, protein: 18 },
  { name: 'Chickpeas', serving: '1 cup cooked', cal: 269, protein: 15 },
  { name: 'Kidney Beans', serving: '1 cup cooked', cal: 225, protein: 15 },
  { name: 'Steak (Sirloin)', serving: '150g', cal: 316, protein: 39 },
  { name: 'Ground Turkey', serving: '150g', cal: 240, protein: 34 },
  { name: 'Tuna (Canned)', serving: '1 can (120g)', cal: 132, protein: 29 },
  { name: 'Shrimp', serving: '100g', cal: 99, protein: 24 },
  { name: 'Cheese (Cheddar)', serving: '30g', cal: 114, protein: 7 },
  { name: 'Roti / Chapati', serving: '2 pieces', cal: 220, protein: 7 },
  { name: 'Naan', serving: '1 piece', cal: 262, protein: 9 },
  { name: 'Dosa', serving: '2 pieces', cal: 260, protein: 6 },
  { name: 'Idli', serving: '3 pieces', cal: 240, protein: 6 },
  { name: 'Poha', serving: '1 plate', cal: 250, protein: 5 },
  { name: 'Upma', serving: '1 plate', cal: 210, protein: 5 },
  { name: 'Coffee (Black)', serving: '1 cup', cal: 5, protein: 0 },
  { name: 'Coffee with Milk', serving: '1 cup', cal: 60, protein: 3 },
  { name: 'Orange Juice', serving: '1 glass', cal: 112, protein: 2 },
  { name: 'Smoothie (Fruit)', serving: '1 glass', cal: 180, protein: 4 },
  { name: 'Dark Chocolate', serving: '30g', cal: 170, protein: 2 },
  { name: 'Ice Cream', serving: '1/2 cup', cal: 210, protein: 3 },
  { name: 'Pizza Slice', serving: '1 large slice', cal: 285, protein: 12 },
  { name: 'Burger', serving: '1 regular', cal: 450, protein: 22 },
  { name: 'French Fries', serving: 'medium portion', cal: 365, protein: 4 },
  { name: 'Fried Rice', serving: '1 plate', cal: 350, protein: 9 },
  { name: 'Biryani', serving: '1 plate', cal: 490, protein: 22 },
  { name: 'Butter Chicken', serving: '1 serving', cal: 438, protein: 28 },
  { name: 'Salad (Mixed)', serving: '1 bowl', cal: 90, protein: 3 },
  { name: 'Soup (Chicken)', serving: '1 bowl', cal: 150, protein: 10 },
  { name: 'Sandwich (Turkey)', serving: '1 whole', cal: 340, protein: 24 },
  { name: 'Wrap (Chicken)', serving: '1 wrap', cal: 380, protein: 28 },
  { name: 'Sushi Roll', serving: '6 pieces', cal: 280, protein: 12 },
  { name: 'Granola', serving: '1/2 cup', cal: 210, protein: 5 },
  { name: 'Trail Mix', serving: '30g', cal: 150, protein: 4 },
  { name: 'Hummus', serving: '2 tbsp', cal: 70, protein: 2 },
  { name: 'Quinoa', serving: '1 cup cooked', cal: 222, protein: 8 },
  { name: 'Mango', serving: '1 cup', cal: 99, protein: 1 },
  { name: 'Blueberries', serving: '1 cup', cal: 84, protein: 1 },
  { name: 'Strawberries', serving: '1 cup', cal: 49, protein: 1 },
  { name: 'Mixed Vegetables', serving: '1 cup', cal: 80, protein: 3 },
  { name: 'Egg White Omelette', serving: '3 whites', cal: 52, protein: 11 },
  { name: 'Masala Omelette', serving: '2 eggs', cal: 200, protein: 14 },
  { name: 'Rajma Chawal', serving: '1 plate', cal: 380, protein: 14 },
  { name: 'Chole (Chickpea Curry)', serving: '1 serving', cal: 320, protein: 12 },
  { name: 'Palak Paneer', serving: '1 serving', cal: 290, protein: 14 },
  { name: 'Samosa', serving: '2 pieces', cal: 308, protein: 4 }
];

const STEP_PRESETS = [
  { label: 'Short Walk', value: 2000 },
  { label: 'Moderate Walk', value: 4000 },
  { label: 'Long Walk', value: 6000 },
  { label: 'Active Day', value: 8000 },
  { label: 'Very Active', value: 10000 },
  { label: 'Intense Training', value: 12000 }
];

// ============================================================
// BOTTOM SHEET MODAL SYSTEM
// ============================================================
function showBottomSheet(title, contentBuilder) {
  const existing = document.querySelector('.bottom-sheet-overlay');
  if (existing) existing.remove();

  const overlay = el('div', { class: 'bottom-sheet-overlay' });
  const sheet = el('div', { class: 'bottom-sheet' });
  const handle = el('div', { class: 'bottom-sheet-handle' });

  const closeBtn = el('button', {
    class: 'bottom-sheet-close',
    'aria-label': 'Close',
    onClick: () => dismissSheet(overlay)
  });
  const closeIcon = icon(ICONS.close);
  closeIcon.setAttribute('width', '16');
  closeIcon.setAttribute('height', '16');
  closeBtn.appendChild(closeIcon);

  const header = el('div', { class: 'bottom-sheet-header' },
    el('h3', {}, title),
    closeBtn
  );

  const body = el('div', { class: 'bottom-sheet-body' });
  contentBuilder(body, () => dismissSheet(overlay));

  sheet.appendChild(handle);
  sheet.appendChild(header);
  sheet.appendChild(body);
  overlay.appendChild(sheet);

  // Dismiss on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismissSheet(overlay);
  });

  // Dismiss on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      dismissSheet(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
}

function dismissSheet(overlay) {
  overlay.classList.add('closing');
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 280);
}

// ============================================================
// CIRCULAR SLEEP CLOCK DIAL
// ============================================================
function openSleepLogger(day, onSave) {
  // Default times: sleep 11 PM, wake 7 AM
  let sleepHour = 23, sleepMin = 0;
  let wakeHour = 7, wakeMin = 0;

  // Restore from day if available
  if (day.sleepTime) {
    const [h, m] = day.sleepTime.split(':').map(Number);
    sleepHour = h; sleepMin = m;
  }
  if (day.wakeTime) {
    const [h, m] = day.wakeTime.split(':').map(Number);
    wakeHour = h; wakeMin = m;
  }

  function calcDuration(sh, sm, wh, wm) {
    let sleepMins = sh * 60 + sm;
    let wakeMins = wh * 60 + wm;
    if (wakeMins <= sleepMins) wakeMins += 24 * 60;
    const diff = wakeMins - sleepMins;
    return { hours: Math.floor(diff / 60), mins: diff % 60, total: diff / 60 };
  }

  function hourToAngle(h, m) {
    // 12-hour clock: 12 o'clock = -90deg (top), clockwise
    const h12 = ((h % 12) + m / 60);
    return (h12 / 12) * 360 - 90;
  }

  function angleToXY(angleDeg, r, cx, cy) {
    const rad = angleDeg * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    let sweep = endAngle - startAngle;
    if (sweep < 0) sweep += 360;
    const largeArc = sweep > 180 ? 1 : 0;
    const start = angleToXY(startAngle, r, cx, cy);
    const end = angleToXY(endAngle, r, cx, cy);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  function formatTime(h, m) {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  }

  showBottomSheet('Sleep Duration', (body, dismiss) => {
    const cx = 130, cy = 130, r = 100, handleR = 14;

    const container = el('div', { class: 'sleep-clock-container' });
    const svgWrap = el('div', { class: 'sleep-clock-svg-wrap' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');

    // Track circle
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', cx);
    track.setAttribute('cy', cy);
    track.setAttribute('r', r);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', '#eae6db');
    track.setAttribute('stroke-width', '28');
    svg.appendChild(track);

    // Arc path (sleep duration fill)
    const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arcPath.setAttribute('fill', 'none');
    arcPath.setAttribute('stroke', 'url(#sleepGrad)');
    arcPath.setAttribute('stroke-width', '28');
    arcPath.setAttribute('stroke-linecap', 'round');

    // Gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.id = 'sleepGrad';
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#1a3020');
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#e2a960');
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(arcPath);

    // Hour tick marks
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 360 - 90;
      const innerP = angleToXY(angle, r - 20, cx, cy);
      const outerP = angleToXY(angle, r - 16, cx, cy);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', innerP.x);
      tick.setAttribute('y1', innerP.y);
      tick.setAttribute('x2', outerP.x);
      tick.setAttribute('y2', outerP.y);
      tick.setAttribute('stroke', '#b0c2b6');
      tick.setAttribute('stroke-width', '1.5');
      svg.appendChild(tick);

      // Number labels
      const labelP = angleToXY(angle, r - 30, cx, cy);
      const hourLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      hourLabel.setAttribute('x', labelP.x);
      hourLabel.setAttribute('y', labelP.y);
      hourLabel.setAttribute('text-anchor', 'middle');
      hourLabel.setAttribute('dominant-baseline', 'central');
      hourLabel.setAttribute('fill', '#78857c');
      hourLabel.setAttribute('font-size', '10');
      hourLabel.setAttribute('font-family', 'Outfit, sans-serif');
      hourLabel.setAttribute('font-weight', '600');
      hourLabel.textContent = i === 0 ? '12' : String(i);
      svg.appendChild(hourLabel);
    }

    // Sleep handle
    const sleepHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sleepHandle.setAttribute('r', handleR);
    sleepHandle.setAttribute('fill', '#1a3020');
    sleepHandle.setAttribute('stroke', '#ffffff');
    sleepHandle.setAttribute('stroke-width', '3');
    sleepHandle.setAttribute('cursor', 'grab');
    svg.appendChild(sleepHandle);

    // Wake handle
    const wakeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wakeHandle.setAttribute('r', handleR);
    wakeHandle.setAttribute('fill', '#e2a960');
    wakeHandle.setAttribute('stroke', '#ffffff');
    wakeHandle.setAttribute('stroke-width', '3');
    wakeHandle.setAttribute('cursor', 'grab');
    svg.appendChild(wakeHandle);

    svgWrap.appendChild(svg);

    // Center label
    const centerLabel = el('div', { class: 'sleep-clock-center-label' });
    const durationStrong = el('strong', {});
    const durationSpan = el('span', {}, 'duration');
    centerLabel.appendChild(durationStrong);
    centerLabel.appendChild(durationSpan);
    svgWrap.appendChild(centerLabel);

    // Time labels below
    const sleepTimeLabel = el('strong', {});
    const wakeTimeLabel = el('strong', {});
    const timeLabels = el('div', { class: 'sleep-time-labels' },
      el('div', { class: 'sleep-time-block' },
        el('label', {}, 'Bedtime'),
        sleepTimeLabel
      ),
      el('div', { class: 'sleep-time-block' },
        el('label', {}, 'Wake up'),
        wakeTimeLabel
      )
    );

    function updateUI() {
      const sa = hourToAngle(sleepHour, sleepMin);
      const wa = hourToAngle(wakeHour, wakeMin);
      const sp = angleToXY(sa, r, cx, cy);
      const wp = angleToXY(wa, r, cx, cy);

      sleepHandle.setAttribute('cx', sp.x);
      sleepHandle.setAttribute('cy', sp.y);
      wakeHandle.setAttribute('cx', wp.x);
      wakeHandle.setAttribute('cy', wp.y);

      arcPath.setAttribute('d', describeArc(cx, cy, r, sa, wa));

      const dur = calcDuration(sleepHour, sleepMin, wakeHour, wakeMin);
      durationStrong.textContent = `${dur.hours}h ${dur.mins}m`;
      sleepTimeLabel.textContent = formatTime(sleepHour, sleepMin);
      wakeTimeLabel.textContent = formatTime(wakeHour, wakeMin);
    }

    // Drag logic
    let activeHandle = null;

    function getAngleFromEvent(e, svgEl) {
      const rect = svgEl.getBoundingClientRect();
      const scaleX = 260 / rect.width;
      const scaleY = 260 / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = (clientX - rect.left) * scaleX - cx;
      const y = (clientY - rect.top) * scaleY - cy;
      let angle = Math.atan2(y, x) * 180 / Math.PI;
      return angle;
    }

    function angleToTime(angleDeg, isSleep) {
      // Convert angle back to 12-hour position
      let adjusted = angleDeg + 90;
      if (adjusted < 0) adjusted += 360;
      adjusted = adjusted % 360;
      const totalH12 = (adjusted / 360) * 12;
      const h12 = Math.floor(totalH12);
      const mins = Math.round((totalH12 - h12) * 60 / 15) * 15;
      const finalMins = mins >= 60 ? 0 : mins;
      const finalH12 = mins >= 60 ? h12 + 1 : h12;

      // Assume sleep = PM side, wake = AM side
      let h24;
      if (isSleep) {
        // Sleep is typically PM: 8PM-3AM range
        h24 = (finalH12 % 12) + 12;
        if (h24 >= 24) h24 -= 12; // wrap 24-35 → 12-23
        // If hour ends up < 18, assume very late night (12 AM - 5 AM)
        if (h24 < 18) h24 = finalH12 % 12; // Treat as AM
      } else {
        // Wake is typically AM: 4AM-12PM
        h24 = finalH12 % 12;
      }
      return { h: h24, m: finalMins };
    }

    function onPointerDown(e) {
      e.preventDefault();
      const angle = getAngleFromEvent(e, svg);
      const sAngle = hourToAngle(sleepHour, sleepMin);
      const wAngle = hourToAngle(wakeHour, wakeMin);

      const sDiff = Math.abs(((angle - sAngle + 540) % 360) - 180);
      const wDiff = Math.abs(((angle - wAngle + 540) % 360) - 180);

      activeHandle = sDiff < wDiff ? 'sleep' : 'wake';
      svgWrap.style.cursor = 'grabbing';
    }

    function onPointerMove(e) {
      if (!activeHandle) return;
      e.preventDefault();
      const angle = getAngleFromEvent(e, svg);
      const time = angleToTime(angle, activeHandle === 'sleep');

      if (activeHandle === 'sleep') {
        sleepHour = time.h;
        sleepMin = time.m;
      } else {
        wakeHour = time.h;
        wakeMin = time.m;
      }
      updateUI();
    }

    function onPointerUp() {
      activeHandle = null;
      svgWrap.style.cursor = '';
    }

    svgWrap.addEventListener('mousedown', onPointerDown);
    svgWrap.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    // Save button
    const saveBtn = el('button', {
      class: 'btn btn-primary',
      style: { width: '100%' },
      onClick: () => {
        const dur = calcDuration(sleepHour, sleepMin, wakeHour, wakeMin);
        day.sleep = parseFloat(dur.total.toFixed(1));
        day.sleepTime = `${sleepHour}:${String(sleepMin).padStart(2, '0')}`;
        day.wakeTime = `${wakeHour}:${String(wakeMin).padStart(2, '0')}`;
        syncDailyProgress(day);
        queueSave();

        // Clean up drag listeners
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchend', onPointerUp);

        dismiss();
        renderApp();
      }
    }, 'Save Sleep Log');

    container.appendChild(svgWrap);
    container.appendChild(timeLabels);
    body.appendChild(container);
    body.appendChild(el('div', { class: 'sleep-save-row' }, saveBtn));

    updateUI();
  });
}

// ============================================================
// STEPS PRESET LOGGER
// ============================================================
function openStepsLogger(day) {
  showBottomSheet('Log Steps', (body, dismiss) => {
    const currentDisplay = el('strong', {}, day.steps.toLocaleString());
    const currentRow = el('div', { class: 'steps-current-row' },
      currentDisplay,
      el('span', {}, 'steps today')
    );
    body.appendChild(currentRow);

    const grid = el('div', { class: 'steps-presets-grid' });
    STEP_PRESETS.forEach(preset => {
      const chip = el('button', {
        class: 'step-preset-chip',
        onClick: () => {
          day.steps = (day.steps || 0) + preset.value;
          currentDisplay.textContent = day.steps.toLocaleString();
          syncDailyProgress(day);
          queueSave();
        }
      },
        el('span', { class: 'chip-label' }, preset.label),
        el('span', { class: 'chip-value' }, `+${preset.value.toLocaleString()} steps`)
      );
      grid.appendChild(chip);
    });
    body.appendChild(grid);

    // Custom input row
    const customInput = el('input', {
      type: 'number',
      placeholder: 'Custom amount',
      id: 'steps-custom-input'
    });
    const setBtn = el('button', {
      class: 'btn btn-primary',
      style: { flexShrink: '0' },
      onClick: () => {
        const val = parseInt(customInput.value) || 0;
        if (val > 0) {
          day.steps = (day.steps || 0) + val;
          currentDisplay.textContent = day.steps.toLocaleString();
          customInput.value = '';
          syncDailyProgress(day);
          queueSave();
        }
      }
    }, 'Add');

    body.appendChild(el('div', { class: 'steps-custom-row' }, customInput, setBtn));

    // Done button
    body.appendChild(el('button', {
      class: 'btn btn-secondary',
      style: { width: '100%', marginTop: '4px' },
      onClick: () => { dismiss(); renderApp(); }
    }, 'Done'));
  });
}

// ============================================================
// FOOD SEARCH + RECENT MEALS LOGGER
// ============================================================
function getRecentFoods() {
  try {
    return JSON.parse(localStorage.getItem('lt_recent_foods') || '[]');
  } catch { return []; }
}

function saveRecentFood(food) {
  const recent = getRecentFoods().filter(f => f.name !== food.name);
  recent.unshift(food);
  if (recent.length > 12) recent.length = 12;
  localStorage.setItem('lt_recent_foods', JSON.stringify(recent));
}

function openFoodLogger(day) {
  showBottomSheet('Log Food', (body, dismiss) => {
    let searchQuery = '';
    let showCustomForm = false;

    function logFoodItem(food, btn) {
      const cal = food.cal;
      const prot = food.protein;
      day.calories = (day.calories || 0) + cal;
      day.protein = (day.protein || 0) + prot;
      if (!day.meals) day.meals = [];
      day.meals.push({
        title: food.name,
        serving: food.serving || '1 serving',
        multiplier: 1,
        calories: cal,
        protein: prot
      });
      saveRecentFood(food);
      syncDailyProgress(day);
      queueSave();

      if (btn) {
        btn.innerHTML = '✓';
        btn.classList.add('added');
        setTimeout(() => {
          btn.innerHTML = '+';
          btn.classList.remove('added');
        }, 1000);
      }
    }

    function renderContent() {
      body.replaceChildren();

      // Search bar
      const searchSvg = icon(ICONS.search);
      searchSvg.setAttribute('width', '16');
      searchSvg.setAttribute('height', '16');
      const searchInput = el('input', {
        type: 'text',
        placeholder: 'Search foods...',
        value: searchQuery
      });
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderContent();
        const newInput = body.querySelector('.food-search-bar input');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      });
      const searchBar = el('div', { class: 'food-search-bar' });
      searchBar.appendChild(searchSvg);
      searchBar.appendChild(searchInput);
      body.appendChild(searchBar);

      // Results
      const results = searchQuery.length >= 2
        ? FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 15)
        : [];

      if (searchQuery.length >= 2 && results.length > 0) {
        body.appendChild(el('div', { class: 'food-section-label' }, 'Results'));
        const list = el('div', { class: 'food-results-list' });
        results.forEach(food => {
          const addBtn = el('button', {
            class: 'food-add-btn',
            onClick: (e) => {
              e.stopPropagation();
              logFoodItem(food, addBtn);
            }
          }, '+');
          const row = el('div', { class: 'food-item-row' },
            el('div', { class: 'food-item-info' },
              el('span', { class: 'food-item-name' }, food.name),
              el('span', { class: 'food-item-meta' }, `${food.cal} kcal · ${food.protein}g protein · ${food.serving}`)
            ),
            addBtn
          );
          list.appendChild(row);
        });
        body.appendChild(list);
      } else if (!searchQuery) {
        // Show recent foods
        const recent = getRecentFoods();
        if (recent.length > 0) {
          body.appendChild(el('div', { class: 'food-section-label' }, 'Recent'));
          const recentList = el('div', { class: 'food-results-list' });
          recent.forEach(food => {
            const addBtn = el('button', {
              class: 'food-add-btn',
              onClick: (e) => {
                e.stopPropagation();
                logFoodItem(food, addBtn);
              }
            }, '+');
            const row = el('div', { class: 'food-item-row' },
              el('div', { class: 'food-item-info' },
                el('span', { class: 'food-item-name' }, food.name),
                el('span', { class: 'food-item-meta' }, `${food.cal} kcal · ${food.protein}g protein`)
              ),
              addBtn
            );
            recentList.appendChild(row);
          });
          body.appendChild(recentList);
        }

        // Popular picks
        body.appendChild(el('div', { class: 'food-section-label' }, 'Popular'));
        const popularList = el('div', { class: 'food-results-list' });
        FOOD_DATABASE.slice(0, 8).forEach(food => {
          const addBtn = el('button', {
            class: 'food-add-btn',
            onClick: (e) => {
              e.stopPropagation();
              logFoodItem(food, addBtn);
            }
          }, '+');
          const row = el('div', { class: 'food-item-row' },
            el('div', { class: 'food-item-info' },
              el('span', { class: 'food-item-name' }, food.name),
              el('span', { class: 'food-item-meta' }, `${food.cal} kcal · ${food.protein}g protein · ${food.serving}`)
            ),
            addBtn
          );
          popularList.appendChild(row);
        });
        body.appendChild(popularList);
      }

      // Custom entry toggle
      const toggleBtn = el('button', {
        class: 'food-custom-toggle',
        onClick: () => { showCustomForm = !showCustomForm; renderContent(); }
      }, showCustomForm ? 'Hide custom entry' : 'Enter manually instead');
      body.appendChild(toggleBtn);

      if (showCustomForm) {
        const nameInput = el('input', { type: 'text', placeholder: 'Food name', id: 'food-custom-name' });
        const calInput = el('input', { type: 'number', placeholder: 'Calories', id: 'food-custom-cal' });
        const protInput = el('input', { type: 'number', placeholder: 'Protein (g)', id: 'food-custom-prot' });
        const saveCustom = el('button', {
          class: 'btn btn-primary',
          style: { gridColumn: '1 / -1' },
          onClick: () => {
            const cal = parseInt(calInput.value) || 0;
            const prot = parseInt(protInput.value) || 0;
            const name = nameInput.value.trim() || 'Custom meal';
            if (cal > 0) {
              day.calories = (day.calories || 0) + cal;
              day.protein = (day.protein || 0) + prot;
              if (!day.meals) day.meals = [];
              day.meals.push({ title: name, calories: cal, protein: prot });
              saveRecentFood({ name, cal, protein: prot, serving: 'custom' });
              syncDailyProgress(day);
              queueSave();
              dismiss();
              renderApp();
            }
          }
        }, 'Add Entry');
        body.appendChild(el('div', { class: 'food-custom-form' }, nameInput, calInput, protInput, saveCustom));
      }

      // Done button
      body.appendChild(el('button', {
        class: 'btn btn-secondary',
        style: { width: '100%' },
        onClick: () => { dismiss(); renderApp(); }
      }, 'Done'));
    }

    renderContent();
  });
}

// --- 7-Day Trend Analytics ---
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

// Compute daily readiness score (0-100)
function computeDailyScore(day, habitPercent) {
  const stepGoal = 10000;
  const stepPercent = Math.min(100, Math.round(((day.steps || 0) / stepGoal) * 100));
  
  const netCals = Math.max(0, (day.calories || 0) - getActiveBurn(day));
  const calGoal = 2000;
  const calPercent = Math.min(100, Math.round((netCals / calGoal) * 100));
  
  const sleepScore = Math.min(100, Math.round(((day.sleep || 0) / 8) * 100));
  const waterScore = Math.min(100, Math.round(((day.water || 0) / 8) * 100));
  
  return Math.round((stepPercent + calPercent + sleepScore + waterScore + habitPercent) / 5);
}

// --- Firebase Synchronizer ---
let firestoreUserUnsubscribe = null;
let firestoreLogUnsubscribe = null;

function setupFirestoreSync(user) {
  if (!firebase.db) return;

  const userDocRef = firebase.doc(firebase.db, "users", user.uid);
  firestoreUserUnsubscribe = firebase.onSnapshot(userDocRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      if (data.workoutSplit) state.workoutSplit = data.workoutSplit;
      if (data.recipes) state.recipes = data.recipes;
      if (data.books) state.books = data.books;
      if (data.movies) state.movies = data.movies;
      saveLocalState();
      renderApp();
    } else {
      saveUserPreferences();
    }
  }, (err) => {
    console.error("Firestore user preferences sync error:", err);
  });

  setupFirestoreLogSync(user, state.dateStr);
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
      books: state.books,
      movies: state.movies
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

// --- IndexedDB Offline Sync Queue ---
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("LifeTrackerRedesignOfflineDB", 1);
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
      syncIndicator.textContent = "Offline Queue Active";
      syncIndicator.style.color = "var(--colors-accent-terracotta)";
      syncIndicator.style.display = "inline";
    } else {
      syncIndicator.textContent = "Synced Cloud";
      syncIndicator.style.color = "var(--colors-success)";
      syncIndicator.style.display = "none";
    }
  }
}

window.addEventListener('online', flushOfflineQueue);

// --- Routing & Navigation Management ---
function handleNavigation() {
  const hash = window.location.hash || '#dashboard';
  const view = hash.replace('#', '');
  
  if (['dashboard', 'fitness', 'habits', 'media', 'settings'].includes(view)) {
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

// --- VIEW RENDERING ENGINE ---

function renderMobileHeader() {
  const meta = VIEW_META[state.activeView] || VIEW_META.dashboard;
  
  const dateInput = el('input', {
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
  });

  return el('header', { class: 'mobile-app-header' },
    el('div', { class: 'mobile-app-title' },
      el('strong', {}, meta.short),
      el('span', {}, "Premium Overhaul")
    ),
    el('div', { class: 'custom-date-container' },
      el('span', {}, formatLongDate(state.dateStr)),
      dateInput
    )
  );
}

function renderApp() {
  const shouldResetScroll = lastRenderedView !== state.activeView;
  
  const desktopDate = document.getElementById('global-date-picker');
  if (desktopDate) {
    desktopDate.value = state.dateStr;
    const label = document.getElementById('desktop-date-label');
    if (label) label.textContent = formatLongDate(state.dateStr);
  }

  // Update nav link active styling
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
  mainContainer.replaceChildren();

  // Render Mobile Header first
  if (state.activeView !== 'auth') {
    mainContainer.appendChild(renderMobileHeader());
  }

  // Render view panels
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
    case 'auth':
      mainContainer.appendChild(renderAuthPage());
      break;
  }

  if (shouldResetScroll) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
  lastRenderedView = state.activeView;
}

// --- VIEW: AUTHENTICATION ---
function renderAuthPage() {
  const isConfigured = firebase.isFirebaseConfigured();
  
  const googleBtn = el('button', {
    class: 'btn btn-primary',
    style: { width: '100%', marginTop: '24px' },
    onClick: async () => {
      const provider = new firebase.GoogleAuthProvider();
      try {
        await firebase.signInWithPopup(firebase.auth, provider);
      } catch (err) {
        console.error("Sign in failed:", err);
        alert("Sign in failed: " + err.message);
      }
    }
  }, icon(ICONS.user, "btn-icon"), "Sign In with Google Account");

  return el('div', { class: 'section' },
    el('div', { class: 'container', style: { maxWidth: '440px' } },
      el('div', { class: 'form-card', style: { textAlign: 'center', padding: '40px' } },
        el('div', { style: { display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' } },
          el('div', { class: 'brand-icon-wrapper', style: { width: '48px', height: '48px' } },
            icon(ICONS.sparkles)
          )
        ),
        el('h2', {}, "Life Sync Portal"),
        el('p', { class: 'page-subtitle', style: { marginTop: '8px' } }, 
          isConfigured 
            ? "Access your dashboard on any browser with instant Firestore integration."
            : "Firebase is unconfigured. Set your project key details inside Settings to begin syncing."
        ),
        isConfigured ? googleBtn : el('button', {
          class: 'btn btn-secondary',
          style: { width: '100%', marginTop: '24px' },
          onClick: () => { window.location.hash = '#settings'; }
        }, "Configure in Settings")
      )
    )
  );
}

// --- VIEW: DASHBOARD (REDESIGNED WIDGET BOARD) ---
function renderDashboard() {
  const day = getTodayLog();
  const habits = getHabitDefinitions();
  const habitsDone = (day.habitsCompleted || []).length;
  const habitPercent = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0;
  
  const calGoal = 2000;
  const stepGoal = 10000;
  
  const dailyScore = computeDailyScore(day, habitPercent);

  // Insights List
  const insightsList = generateInsights(day);
  const insightsWidget = el('div', { class: 'insights-widget' },
    el('h3', {}, "Proactive Insights"),
    insightsList.length > 0 
      ? el('div', { class: 'insights-list' },
          ...insightsList.map(item => {
            const row = el('div', { class: `insight-item ${item.category}` });
            const text = el('span', { class: 'insight-item-text' }, item.text);
            const btn = el('button', {
              class: 'insight-action-btn',
              onClick: () => item.action(row)
            }, item.actionText);
            row.appendChild(text);
            row.appendChild(btn);
            return row;
          })
        )
      : el('div', { style: { color: 'var(--colors-muted)', fontStyle: 'italic', fontSize: '13px' } }, 
          "All core logging completed for today. Consistent progress!"
        )
  );

  // --- SUB TAB: TODAY'S ACTIVITY ---
  const renderTodayActivity = () => {
    
    // Calendar Strip Widget
    const calendarStrip = el('div', { class: 'weekly-calendar-widget' },
      el('div', { class: 'weekly-calendar-header' },
        el('h3', {}, "Weekly Progression"),
        el('span', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--colors-accent-terracotta)' } }, "Active Tracker")
      )
    );

    const weeklyStripGrid = el('div', { class: 'weekly-strip' });
    const todayObj = new Date();
    
    // Render past 7 days horizontal strip selector
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(todayObj);
      dayDate.setDate(todayObj.getDate() - i);
      const dateStr = dayDate.toISOString().split('T')[0];
      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      const dayNum = dayDate.getDate();
      
      const isSelected = dateStr === state.dateStr;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      const dayLog = state.logs[dateStr] || {};
      const dayHabitsDone = (dayLog.habitsCompleted || []).length;
      
      const dotsContainer = el('div', { class: 'day-dots' },
        el('span', { class: `day-dot ${(dayLog.steps >= 10000) ? 'completed' : ''}` }),
        el('span', { class: `day-dot ${(dayLog.water >= 8) ? 'completed' : ''}` }),
        el('span', { class: `day-dot ${(dayHabitsDone > 0) ? 'completed' : ''}` })
      );

      const dayBtn = el('button', {
        class: `calendar-day-btn ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}`,
        onClick: () => {
          state.dateStr = dateStr;
          if (state.user && firebase.db) {
            setupFirestoreLogSync(state.user, dateStr);
          }
          renderApp();
        }
      },
        el('span', { class: 'day-name' }, dayName),
        el('span', { class: 'day-number' }, dayNum),
        dotsContainer
      );
      
          weeklyStripGrid.appendChild(dayBtn);
    }
    calendarStrip.appendChild(weeklyStripGrid);

    // Readiness widget concentric rings SVG calculations
    const stepsDone = day.steps || 0;
    const stepsGoal = 10000;
    const stepsPercent = Math.min(1, stepsDone / stepsGoal);
    const stepsDash = stepsPercent * 311.02;

    const habitsTotal = habits.length;
    const habitsPercent = habitsTotal ? Math.min(1, habitsDone / habitsTotal) : 0;
    const habitsDash = habitsPercent * 235.62;

    const waterDone = day.water || 0;
    const waterGoal = 8;
    const waterPercent = Math.min(1, waterDone / waterGoal);
    const waterDash = waterPercent * 160.22;

    const readinessRingSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    readinessRingSvg.setAttribute("class", "readiness-score-ring");
    readinessRingSvg.setAttribute("viewBox", "0 0 160 160");
    readinessRingSvg.setAttribute("width", "140");
    readinessRingSvg.setAttribute("height", "140");

    function createArcRing(r, color, trackLen, circ, progressDash) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      
      // Track
      const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      track.setAttribute("cx", "80");
      track.setAttribute("cy", "80");
      track.setAttribute("r", r.toString());
      track.setAttribute("stroke", "var(--colors-surface-soft)");
      track.setAttribute("stroke-width", "8");
      track.setAttribute("stroke-linecap", "round");
      track.setAttribute("fill", "none");
      track.setAttribute("stroke-dasharray", `${trackLen} ${circ}`);
      track.setAttribute("transform", "rotate(135, 80, 80)");
      g.appendChild(track);

      // Progress
      if (progressDash > 0) {
        const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        fill.setAttribute("cx", "80");
        fill.setAttribute("cy", "80");
        fill.setAttribute("r", r.toString());
        fill.setAttribute("stroke", color);
        fill.setAttribute("fill", "none");
        fill.setAttribute("stroke-width", "8");
        fill.setAttribute("stroke-linecap", "round");
        fill.setAttribute("stroke-dasharray", `${progressDash} ${circ}`);
        fill.setAttribute("transform", "rotate(135, 80, 80)");
        g.appendChild(fill);
      }

      return g;
    }

    readinessRingSvg.appendChild(createArcRing(66, "var(--colors-accent-teal)", 311.02, 414.69, stepsDash));
    readinessRingSvg.appendChild(createArcRing(50, "var(--colors-accent-amber)", 235.62, 314.16, habitsDash));
    readinessRingSvg.appendChild(createArcRing(34, "var(--colors-accent-blue)", 160.22, 213.63, waterDash));

    const summaryPills = el('div', { class: 'readiness-metrics-summary' },
      el('div', { class: 'summary-pill steps' },
        el('span', { class: 'summary-dot steps' }),
        el('span', { class: 'summary-label' }, 'Steps '),
        el('strong', { class: 'summary-value' }, `${stepsDone.toLocaleString()}`)
      ),
      el('div', { class: 'summary-pill habits' },
        el('span', { class: 'summary-dot habits' }),
        el('span', { class: 'summary-label' }, 'Habits '),
        el('strong', { class: 'summary-value' }, `${habitsDone}/${habitsTotal}`)
      ),
      el('div', { class: 'summary-pill water' },
        el('span', { class: 'summary-dot water' }),
        el('span', { class: 'summary-label' }, 'Water '),
        el('strong', { class: 'summary-value' }, `${waterDone}/8`)
      )
    );

    const readinessCard = el('div', { class: 'readiness-widget' },
      summaryPills,
      el('div', { class: 'readiness-score-container' },
        readinessRingSvg,
        el('div', { class: 'readiness-score-value' },
          el('strong', {}, dailyScore),
          el('span', {}, "SCORE")
        )
      )
    );

    // 30-Day Consistency Grid Widget
// 30-Day Consistency Grid Widget
    const consistencyGrid = el('div', { class: 'consistency-widget' },
      el('div', { class: 'consistency-widget-header' },
        el('h3', {}, "Consistency Matrix"),
        el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)', fontWeight: '600' } }, "Last 30 Days")
      )
    );

    const matrixCells = el('div', { class: 'consistency-matrix-grid' });
    const cellDates = [];
    const cellToday = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const targetDate = new Date(cellToday);
      targetDate.setDate(cellToday.getDate() - i);
      const cellDateStr = targetDate.toISOString().split('T')[0];
      cellDates.push(cellDateStr);
    }

    cellDates.forEach(date => {
      const log = state.logs[date];
      let level = 'level-0';
      let scoreVal = 0;
      if (log) {
        const logHabitsDone = (log.habitsCompleted || []).length;
        const logHabitPercent = habits.length ? Math.round((logHabitsDone / habits.length) * 100) : 0;
        scoreVal = computeDailyScore(log, logHabitPercent);
        
        if (scoreVal >= 90) level = 'level-4';
        else if (scoreVal >= 70) level = 'level-3';
        else if (scoreVal >= 40) level = 'level-2';
        else level = 'level-1';
      }

      const cell = el('div', {
        class: `consistency-cell ${level}`,
        title: `${formatLongDate(date)}: Score ${scoreVal}/100`,
        onClick: () => {
          state.dateStr = date;
          if (state.user && firebase.db) {
            setupFirestoreLogSync(state.user, date);
          }
          renderApp();
        }
      });
      matrixCells.appendChild(cell);
    });

    consistencyGrid.appendChild(
      el('div', { class: 'consistency-matrix-container' },
        matrixCells,
        el('div', { class: 'consistency-legend' },
          el('span', {}, "Less"),
          el('span', { class: 'consistency-legend-cell level-0' }),
          el('span', { class: 'consistency-legend-cell level-1' }),
          el('span', { class: 'consistency-legend-cell level-2' }),
          el('span', { class: 'consistency-legend-cell level-3' }),
          el('span', { class: 'consistency-legend-cell level-4' }),
          el('span', {}, "More")
        )
      )
    );

    // Widget-Metric Cards
    const activeBurn = getActiveBurn(day);
    const netCals = Math.max(0, (day.calories || 0) - activeBurn);
    const calPercent = Math.min(100, Math.round((netCals / calGoal) * 100));
    const stepPercent = Math.min(100, Math.round(((day.steps || 0) / stepGoal) * 100));

    const metricsContainer = el('div', { class: 'widget-metric-grid' },
      
      // 1. Workout Widget
      el('div', { class: 'widget-metric-card', onClick: () => { window.location.hash = '#fitness'; } },
        el('div', { class: 'widget-card-header' },
          el('span', { class: 'widget-card-label' }, "Workout"),
          el('div', { class: 'widget-icon-box workout' }, icon(ICONS.fitness))
        ),
        el('div', { class: 'widget-card-center' },
          el('strong', { class: 'widget-card-value' }, day.workouts.length > 0 ? "Active" : "Rest Day"),
          el('span', { class: 'widget-card-meta' }, day.workouts.length > 0 ? `${day.workouts.length} exercise${day.workouts.length > 1 ? 's' : ''} logged` : "No exercises logged")
        )
      ),

      // 2. Steps Widget
      el('div', { class: 'widget-metric-card' },
        el('div', { class: 'widget-card-header' },
          el('span', { class: 'widget-card-label' }, "Steps"),
          el('div', { class: 'widget-icon-box steps' }, icon(ICONS.steps))
        ),
        el('div', { class: 'widget-card-center' },
          el('strong', { class: 'widget-card-value' }, day.steps.toLocaleString()),
          el('span', { class: 'widget-card-meta' }, `${stepPercent}% of 10k goal`)
        ),
        el('button', {
          class: 'widget-quick-btn',
          onClick: (e) => {
            e.stopPropagation();
            openStepsLogger(day);
          }
        }, "+ Add Steps")
      ),

      // 3. Nutrition Widget
      el('div', { class: 'widget-metric-card' },
        el('div', { class: 'widget-card-header' },
          el('span', { class: 'widget-card-label' }, "Nutrition"),
          el('div', { class: 'widget-icon-box nutrition' }, icon(ICONS.flame))
        ),
        el('div', { class: 'widget-card-center' },
          el('strong', { class: 'widget-card-value' }, `${netCals} kcal`),
          el('span', { class: 'widget-card-meta' }, `${day.calories || 0} in · ${activeBurn} burn`)
        ),
        el('button', {
          class: 'widget-quick-btn',
          onClick: (e) => {
            e.stopPropagation();
            openFoodLogger(day);
          }
        }, "+ Log Food")
      ),

      // 4. Sleep Widget
      el('div', { class: 'widget-metric-card' },
        el('div', { class: 'widget-card-header' },
          el('span', { class: 'widget-card-label' }, "Sleep"),
          el('div', { class: 'widget-icon-box sleep' }, icon(ICONS.moon))
        ),
        el('div', { class: 'widget-card-center' },
          el('strong', { class: 'widget-card-value' }, `${day.sleep || 0}h`),
          el('span', { class: 'widget-card-meta' }, `${Math.min(100, Math.round((day.sleep || 0)/8*100))}% of 8h target`)
        ),
        el('button', {
          class: 'widget-quick-btn',
          onClick: (e) => {
            e.stopPropagation();
            openSleepLogger(day);
          }
        }, "Log Sleep")
      ),

      // 5. Water Widget
      el('div', { class: 'widget-metric-card' },
        el('div', { class: 'widget-card-header' },
          el('span', { class: 'widget-card-label' }, "Water"),
          el('div', { class: 'widget-icon-box water' }, icon(ICONS.water))
        ),
        el('div', { class: 'widget-card-center' },
          el('strong', { class: 'widget-card-value' }, `${day.water || 0} / 8`),
          el('span', { class: 'widget-card-meta' }, "Cups consumed today")
        ),
        el('button', {
          class: 'widget-quick-btn',
          onClick: (e) => {
            e.stopPropagation();
            day.water = (day.water || 0) + 1;
            syncDailyProgress(day);
            queueSave();
            renderApp();
          }
        }, "+ 1 Cup")
      ),

      // 6. Habits Widget
      el('div', { class: 'widget-metric-card', onClick: () => { window.location.hash = '#habits'; } },
        el('div', { class: 'widget-card-header' },
          el('span', { class: 'widget-card-label' }, "Habits"),
          el('div', { class: 'widget-icon-box habits' }, icon(ICONS.check))
        ),
        el('div', { class: 'widget-card-center' },
          el('strong', { class: 'widget-card-value' }, `${habitsDone}/${habits.length}`),
          el('span', { class: 'widget-card-meta' }, `${habitPercent}% completion rate`)
        )
      )
    );

    return el('div', { class: 'dashboard-left' },
      readinessCard,
      metricsContainer,
      consistencyGrid,
      calendarStrip
    );



  };

  // --- SUB TAB: AI COACH & TRENDS ---
  const renderCoachAndTrends = () => {
    
    // AI Coach bubble card
    const coachPanel = el('div', { class: 'ai-coach-bubble-card' });
    const loadBtn = el('button', {
      class: 'btn btn-accent',
      style: { alignSelf: 'center', marginTop: '16px' },
      onClick: async (e) => {
        e.target.disabled = true;
        e.target.textContent = "Synthesizing logs...";
        
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
          trends: getWeeklyTrends(state.dateStr)
        }, history);
        
        day.aiReview = review;
        queueSave();
        renderCoachAndTrendsSubView();
      }
    }, "Begin AI Synthesis");

    const renderCoachAndTrendsSubView = () => {
      coachPanel.replaceChildren();

      if (day.aiReview) {
        coachPanel.appendChild(
          el('div', { class: 'ai-coach-bubble-header' },
            el('div', { class: 'ai-coach-avatar' }, "AI"),
            el('div', { class: 'ai-coach-meta-info' },
              el('strong', {}, "Coach Gemini"),
              el('span', {}, day.aiReview.rating || "Holistic Analysis")
            )
          )
        );

        const listItems = (day.aiReview.recommendation || "")
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => el('li', {}, line.replace('-', '').trim()));

        const content = el('div', { class: 'ai-coach-content' },
          el('div', { class: 'ai-coach-bubble' },
            el('p', {}, day.aiReview.critique)
          ),
          listItems.length > 0 
            ? el('div', {},
                el('h4', { style: { color: 'var(--colors-on-dark)', marginBottom: '8px' } }, "Tomorrow's Action Items:"),
                el('ul', { class: 'ai-coach-bullets' }, ...listItems)
              )
            : null,
          el('button', {
            class: 'btn btn-secondary',
            style: { alignSelf: 'flex-start', marginTop: '16px', background: 'transparent', color: 'var(--colors-on-dark)', borderColor: 'rgba(255,255,255,0.2)' },
            onClick: () => {
              day.aiReview = null;
              queueSave();
              renderCoachAndTrendsSubView();
            }
          }, "Reset Insights")
        );
        
        coachPanel.appendChild(content);
      } else {
        coachPanel.appendChild(
          el('div', { style: { textAlign: 'center', padding: '24px 0' } },
            el('h3', { style: { color: 'var(--colors-on-dark)', marginBottom: '12px' } }, "AI Holistic Lifestyle Coach"),
            el('p', { style: { color: 'var(--colors-on-dark-soft)', marginBottom: '24px', fontSize: '14.5px' } }, 
              "Synthesizes your training, steps, diet, and recovery logs to output a targeted review."
            ),
            loadBtn
          )
        );
      }
    };

    renderCoachAndTrendsSubView();

    // Trends details grid
    const trends = getWeeklyTrends(state.dateStr);
    const trendSign = trends.weightChange7d > 0 ? '+' : '';
    
    const trendsWidget = el('div', { class: 'dashboard-right' },
      el('div', { class: 'page-header' },
        el('h4', {}, "7-Day Historical Averages")
      ),
      el('div', { class: 'trend-grid' },
        el('div', { class: 'trend-tile' },
          el('span', { class: 'trend-tile-label' }, "Avg Steps"),
          el('strong', { class: 'trend-tile-value' }, trends.avgSteps7d > 0 ? trends.avgSteps7d.toLocaleString() : "-"),
          el('span', { class: 'trend-tile-meta' }, "Steps per day")
        ),
        el('div', { class: 'trend-tile' },
          el('span', { class: 'trend-tile-label' }, "Avg Sleep"),
          el('strong', { class: 'trend-tile-value' }, trends.avgSleep7d > 0 ? `${trends.avgSleep7d}h` : "-"),
          el('span', { class: 'trend-tile-meta' }, "Hours of recovery")
        ),
        el('div', { class: 'trend-tile' },
          el('span', { class: 'trend-tile-label' }, "Avg Intake"),
          el('strong', { class: 'trend-tile-value' }, trends.avgCalories7d > 0 ? `${trends.avgCalories7d} kcal` : "-"),
          el('span', { class: 'trend-tile-meta' }, "Energy logged")
        ),
        el('div', { class: 'trend-tile' },
          el('span', { class: 'trend-tile-label' }, "Weight Change"),
          el('strong', { class: 'trend-tile-value' }, trends.weightChange7d !== 0 ? `${trendSign}${trends.weightChange7d.toFixed(1)}kg` : "Stable"),
          el('span', { class: 'trend-tile-meta' }, "7-day weight shift")
        )
      )
    );

    return el('div', { class: 'dashboard-left' },
      coachPanel,
      trendsWidget
    );
  };

  const container = el('div', { class: 'section' },
    el('div', { class: 'container' },
      el('div', { class: 'page-header', style: { marginBottom: '16px' } },
        el('span', { class: 'page-kicker' }, formatLongDate(state.dateStr)),
        el('div', { class: 'page-title-row' },
          el('h1', {}, "Daily Digest")
        )
      )
    )
  );

  // Sub Tab Switcher
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

  const viewContent = el('div', { class: 'dashboard-grid' },
    state.dashboardSubTab === 'today' ? renderTodayActivity() : renderCoachAndTrends(),
    el('aside', { class: 'dashboard-right' },
      insightsWidget
    )
  );

  const targetWrapper = container.querySelector('.container');
  targetWrapper.appendChild(subTabs);
  targetWrapper.appendChild(viewContent);

  return container;
}

// --- VIEW: ADD EXERCISE MODAL (BOTTOM SHEET) ---
function openAddExerciseModal(day, onSave) {
  const common = [
    "Bench Press", "Squats", "Deadlift", "Overhead Press", 
    "Lat Pulldown", "Barbell Row", "Bicep Curls", 
    "Tricep Pushdowns", "Leg Press", "Calf Raises"
  ];

  showBottomSheet('Add Exercise', (body, dismiss) => {
    body.appendChild(el('div', { class: 'food-section-label', style: { marginBottom: '8px' } }, 'Quick Select Presets'));
    
    const chipsGrid = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } });
    common.forEach(name => {
      const chip = el('button', {
        class: 'step-preset-chip',
        style: { padding: '6px 12px', minWidth: 'auto', display: 'inline-flex', flexDirection: 'row', gap: '4px', alignItems: 'center' },
        onClick: () => {
          day.workouts.push({ name, sets: 3, reps: 10, weight: 20 });
          queueSave();
          onSave();
          dismiss();
        }
      }, name);
      chipsGrid.appendChild(chip);
    });
    body.appendChild(chipsGrid);

    body.appendChild(el('div', { class: 'food-section-label', style: { marginBottom: '8px' } }, 'Or Enter Custom Name'));
    const input = el('input', {
      type: 'text',
      placeholder: 'Exercise title...',
      class: 'form-control',
      style: { width: '100%', marginBottom: '12px' }
    });
    const addBtn = el('button', {
      class: 'btn btn-primary',
      style: { width: '100%' },
      onClick: () => {
        const name = input.value.trim();
        if (name) {
          day.workouts.push({ name, sets: 3, reps: 10, weight: 20 });
          queueSave();
          onSave();
          dismiss();
        }
      }
    }, 'Add Custom Exercise');

    body.appendChild(input);
    body.appendChild(addBtn);
  });
}

// --- VIEW: FITNESS (REDESIGNED EXERCISE WORKBOOK & MEAL DIET LIST) ---
function renderFitness() {
  const day = getTodayLog();
  const fitnessWrapper = el('div', { class: 'section' });
  const container = el('div', { class: 'container' });
  
  const header = el('div', { class: 'page-header' },
    el('span', { class: 'page-kicker' }, "Training Log"),
    el('h1', {}, "Fitness & Diet")
  );
  container.appendChild(header);

  const subTabs = el('div', { class: 'segmented-control', style: { marginBottom: '24px' } });
  const activeContent = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } });
  
  const renderFitnessSubTab = (tab) => {
    activeContent.replaceChildren();
    
    subTabs.replaceChildren(
      el('button', { class: `segmented-btn ${tab === 'log' ? 'active' : ''}`, onClick: () => renderFitnessSubTab('log') }, "Exercise Log"),
      el('button', { class: `segmented-btn ${tab === 'nutrition' ? 'active' : ''}`, onClick: () => renderFitnessSubTab('nutrition') }, "Nutrition")
    );

    if (tab === 'log') {
      // Splits selection chips
      const chips = el('div', { class: 'routine-chips-container', style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' } },
        el('span', { style: { fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--colors-muted)' } }, "Active Splits:")
      );
      Object.keys(state.workoutSplit).forEach(key => {
        chips.appendChild(
          el('button', {
            class: 'routine-chip',
            onClick: () => {
              const exercises = state.workoutSplit[key];
              day.workouts = exercises.map(ex => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                logged: false
              }));
              queueSave();
              renderFitnessSubTab('log');
            }
          }, key)
        );
      });
      activeContent.appendChild(chips);

      // Exercise items log cards
      const exerciseList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
      const renderExerciseList = () => {
        exerciseList.replaceChildren();
        
        if (day.workouts.length === 0) {
          exerciseList.appendChild(
            el('div', { style: { textAlign: 'center', padding: '40px', background: 'var(--colors-surface-card)', borderRadius: 'var(--rounded-xl)', border: '1px dashed var(--colors-muted-soft)' } },
              el('p', { style: { color: 'var(--colors-muted)', fontStyle: 'italic' } }, 
                "No exercises logged for today. Select a split above to pre-populate or add a custom one below."
              )
            )
          );
        } else {
          day.workouts.forEach((ex, idx) => {
            const isLogged = !!ex.logged;
            const card = el('div', { class: `form-card exercise-logger-card ${isLogged ? 'logged' : ''}`, style: { position: 'relative' } },
              el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
                el('h4', { style: { margin: '0', fontSize: '16px', fontWeight: '700', color: 'var(--colors-ink)' } }, ex.name),
                el('button', {
                  class: 'btn btn-text',
                  style: { color: 'var(--colors-error)', padding: '4px' },
                  onClick: () => {
                    day.workouts.splice(idx, 1);
                    queueSave();
                    renderExerciseList();
                  }
                }, icon(ICONS.trash))
              ),
              el('div', { class: 'exercise-adjuster-row' },
                // Sets adjuster
                el('div', { class: 'adjuster-column' },
                  el('span', { class: 'adjuster-label' }, "Sets"),
                  el('div', { class: 'inline-adjuster' },
                    el('button', { class: 'adjuster-btn', disabled: isLogged, onClick: () => { if (ex.sets > 1) { ex.sets--; queueSave(); renderExerciseList(); } } }, "−"),
                    el('span', { class: 'adjuster-value' }, ex.sets),
                    el('button', { class: 'adjuster-btn', disabled: isLogged, onClick: () => { ex.sets++; queueSave(); renderExerciseList(); } }, "+")
                  )
                ),
                // Reps adjuster
                el('div', { class: 'adjuster-column' },
                  el('span', { class: 'adjuster-label' }, "Reps"),
                  el('div', { class: 'inline-adjuster' },
                    el('button', { class: 'adjuster-btn', disabled: isLogged, onClick: () => { if (ex.reps > 1) { ex.reps--; queueSave(); renderExerciseList(); } } }, "−"),
                    el('span', { class: 'adjuster-value' }, ex.reps),
                    el('button', { class: 'adjuster-btn', disabled: isLogged, onClick: () => { ex.reps++; queueSave(); renderExerciseList(); } }, "+")
                  )
                ),
                // Weight adjuster
                el('div', { class: 'adjuster-column' },
                  el('span', { class: 'adjuster-label' }, "Weight"),
                  el('div', { class: 'inline-adjuster' },
                    el('button', { class: 'adjuster-btn', disabled: isLogged, onClick: () => { if (ex.weight >= 2.5) { ex.weight -= 2.5; queueSave(); renderExerciseList(); } } }, "−"),
                    el('span', { class: 'adjuster-value', style: { minWidth: '70px' } }, `${ex.weight} kg`),
                    el('button', { class: 'adjuster-btn', disabled: isLogged, onClick: () => { ex.weight += 2.5; queueSave(); renderExerciseList(); } }, "+")
                  )
                ),
                // Log column aligned
                el('div', { class: 'adjuster-column', style: { justifyContent: 'flex-end' } },
                  el('span', { class: 'adjuster-label', style: { visibility: 'hidden' } }, "Action"),
                  el('button', {
                    class: `btn log-exercise-btn ${isLogged ? 'logged' : ''}`,
                    style: { height: '32px', padding: '0 16px', fontSize: '13px', borderRadius: 'var(--rounded-pill)' },
                    onClick: () => {
                      ex.logged = !isLogged;
                      queueSave();
                      renderExerciseList();
                    }
                  }, isLogged ? [icon(ICONS.check), " Logged"] : "Log")
                )
              )
            );
            exerciseList.appendChild(card);
          });
        }

        // Add exercise button
        exerciseList.appendChild(
          el('button', {
            class: 'btn btn-primary',
            style: { width: 'fit-content', alignSelf: 'center', marginTop: '8px' },
            onClick: () => {
              openAddExerciseModal(day, () => renderExerciseList());
            }
          }, icon(ICONS.plus), "Add Exercise")
        );
      };

      renderExerciseList();
      activeContent.appendChild(exerciseList);

    } else if (tab === 'nutrition') {
      const calGoal = 2000;
      const proteinGoal = 150;
      
      const calPercent = Math.min(100, Math.round(((day.calories || 0) / calGoal) * 100));
      const proteinPercent = Math.min(100, Math.round(((day.protein || 0) / proteinGoal) * 100));

      // Progress bars
      const progressCard = el('div', { class: 'form-card', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        el('h3', {}, "Intake Progress"),
        el('div', {},
          el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '6px' } },
            el('span', { style: { fontWeight: '600' } }, "Calories"),
            el('strong', {}, `${day.calories || 0} / ${calGoal} kcal (${calPercent}%)`)
          ),
          el('div', { class: 'macro-progress-bg' },
            el('div', { class: 'macro-progress-fg calories', style: { width: `${calPercent}%` } })
          )
        ),
        el('div', {},
          el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '6px' } },
            el('span', { style: { fontWeight: '600' } }, "Protein"),
            el('strong', {}, `${day.protein || 0} / ${proteinGoal} g (${proteinPercent}%)`)
          ),
          el('div', { class: 'macro-progress-bg' },
            el('div', { class: 'macro-progress-fg protein', style: { width: `${proteinPercent}%` } })
          )
        )
      );

      // Actions row inside progressCard (consolidated Water & Search button)
      const actionsRow = el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--colors-hairline-soft)', paddingTop: '16px', flexWrap: 'wrap' } },
        // Water
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          el('span', { style: { fontSize: '12px', fontWeight: '800', color: 'var(--colors-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' } }, "Water"),
          el('div', { class: 'inline-adjuster' },
            el('button', { class: 'adjuster-btn', style: { width: '28px', height: '28px', fontSize: '12px' }, onClick: () => { if (day.water > 0) { day.water--; syncDailyProgress(day); queueSave(); renderFitnessSubTab('nutrition'); } } }, "−"),
            el('span', { class: 'adjuster-value', style: { fontSize: '14px', fontWeight: '700', minWidth: '45px', textAlign: 'center' } }, `${day.water || 0} cps`),
            el('button', { class: 'adjuster-btn', style: { width: '28px', height: '28px', fontSize: '12px' }, onClick: () => { day.water = (day.water || 0) + 1; syncDailyProgress(day); queueSave(); renderFitnessSubTab('nutrition'); } }, "+")
          )
        ),
        // Search & Log Button
        el('button', {
          class: 'btn btn-primary',
          style: { height: '34px', padding: '0 16px', fontSize: '12.5px', marginLeft: 'auto' },
          onClick: () => { openFoodLogger(day); }
        }, icon(ICONS.search, "btn-icon"), "Search & Log Foods")
      );
      progressCard.appendChild(actionsRow);

      // Logged meals list
      const mealsList = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' } });
      const renderMealsList = () => {
        mealsList.replaceChildren(el('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '4px' } }, "Logged Meals"));
        
        if (!day.meals || day.meals.length === 0) {
          mealsList.appendChild(
            el('div', { style: { color: 'var(--colors-muted)', fontStyle: 'italic', fontSize: '13.5px' } }, "No meals recorded for today.")
          );
        } else {
          day.meals.forEach((m, idx) => {
            mealsList.appendChild(
              el('div', { class: 'habit-row-item' },
                el('div', { class: 'habit-left-info' },
                  el('div', { style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--colors-accent-terracotta)' } }),
                  el('span', { class: 'habit-title-text' }, `${m.title} (${m.calories} kcal, ${m.protein}g protein)`)
                ),
                el('button', {
                  class: 'btn btn-text',
                  style: { color: 'var(--colors-error)', padding: '2px' },
                  onClick: () => {
                    day.calories = Math.max(0, (day.calories || 0) - m.calories);
                    day.protein = Math.max(0, (day.protein || 0) - m.protein);
                    day.meals.splice(idx, 1);
                    queueSave();
                    renderFitnessSubTab('nutrition');
                  }
                }, icon(ICONS.trash))
              )
            );
          });
        }
      };

      // Meal Quick Library shelf
      const recipeShelf = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' } },
        el('h4', { style: { fontSize: '15px', fontWeight: '700' } }, "Meal Library Quick Add")
      );

      state.recipes.forEach(r => {
        recipeShelf.appendChild(
          el('div', { class: 'habit-row-item', style: { cursor: 'pointer' }, onClick: () => {
            if (!day.meals) day.meals = [];
            day.meals.push({ title: r.title, calories: r.calories, protein: r.protein });
            day.calories = (day.calories || 0) + r.calories;
            day.protein = (day.protein || 0) + r.protein;
            queueSave();
            renderFitnessSubTab('nutrition');
          } },
            el('div', { class: 'habit-left-info' },
              el('span', {}, "🥗"),
              el('div', {},
                el('span', { class: 'habit-title-text', style: { display: 'block' } }, r.title),
                el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, `${r.calories} kcal · ${r.protein}g protein`)
              )
            ),
            el('span', { style: { fontSize: '12px', fontWeight: 'bold', color: 'var(--colors-primary)' } }, "+ ADD")
          )
        );
      });

      // Recipe Builder Card
      const recipeBuilderCard = el('div', { class: 'form-card recipe-builder-card', style: { marginTop: '24px' } },
        el('h4', { style: { fontSize: '15px', fontWeight: '700', marginBottom: '12px' } }, "Create Custom Recipe"),
        el('div', { class: 'recipe-builder-fields', style: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' } },
          el('div', { class: 'form-group', style: { flex: '2 1 180px' } },
            el('input', { type: 'text', class: 'form-control', placeholder: 'Recipe title (e.g., Protein Oats)', id: 'new-recipe-title', style: { height: '34px', fontSize: '13px' } })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 80px' } },
            el('input', { type: 'number', class: 'form-control', placeholder: 'kcal', id: 'new-recipe-cal', style: { height: '34px', fontSize: '13px' } })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 80px' } },
            el('input', { type: 'number', class: 'form-control', placeholder: 'protein (g)', id: 'new-recipe-prot', style: { height: '34px', fontSize: '13px' } })
          )
        ),
        el('button', {
          class: 'btn btn-secondary',
          style: { height: '34px', fontSize: '13px', width: 'fit-content' },
          onClick: () => {
            const titleInput = document.getElementById('new-recipe-title');
            const calInput = document.getElementById('new-recipe-cal');
            const protInput = document.getElementById('new-recipe-prot');
            
            const title = titleInput ? titleInput.value.trim() : '';
            const calories = calInput ? parseInt(calInput.value) || 0 : 0;
            const protein = protInput ? parseInt(protInput.value) || 0 : 0;
            
            if (title && calories > 0) {
              state.recipes.push({ title, calories, protein });
              saveLocalState();
              renderFitnessSubTab('nutrition');
            } else {
              alert("Please enter a valid title and calorie count.");
            }
          }
        }, "Save to Library")
      );

      renderMealsList();
      activeContent.appendChild(progressCard);
      activeContent.appendChild(mealsList);
      activeContent.appendChild(recipeShelf);
      activeContent.appendChild(recipeBuilderCard);
    }
  };

  renderFitnessSubTab('log');
  container.appendChild(subTabs);
  container.appendChild(activeContent);
  fitnessWrapper.appendChild(container);
  return fitnessWrapper;
}

// --- VIEW: DAILY HABITS (REDESIGNED BY CATEGORY WITH STREAKS) ---
function renderHabits() {
  const day = getTodayLog();
  const habitsList = getHabitDefinitions();
  
  const habitsWrapper = el('div', { class: 'section' });
  const container = el('div', { class: 'container' });
  
  const header = el('div', { class: 'page-header' },
    el('span', { class: 'page-kicker' }, "Checklist"),
    el('h1', {}, "Daily Habits")
  );
  container.appendChild(header);

  // Group habits by category
  const categories = {};
  habitsList.forEach(h => {
    if (!categories[h.category]) {
      categories[h.category] = [];
    }
    categories[h.category].push(h);
  });

  const habitsBox = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } });

  const renderHabitsCategorized = () => {
    habitsBox.replaceChildren();
    
    Object.keys(categories).forEach(cat => {
      const section = el('div', { class: 'habits-category-section' },
        el('h4', { class: 'habits-category-header' }, cat)
      );

      categories[cat].forEach(h => {
        const isCompleted = (day.habitsCompleted || []).includes(h.id);
        
        // Mock streak calculation
        let streak = 0;
        if (isCompleted) {
          streak = 5; // default streak
        }

        const checkbox = el('div', { class: 'habit-checkbox' }, icon(ICONS.check));
        
        const row = el('div', {
          class: `habit-row-item ${isCompleted ? 'completed' : ''}`,
          onClick: () => {
            if (!day.habitsCompleted) day.habitsCompleted = [];
            const idx = day.habitsCompleted.indexOf(h.id);
            if (idx === -1) {
              day.habitsCompleted.push(h.id);
            } else {
              day.habitsCompleted.splice(idx, 1);
            }
            queueSave();
            renderHabitsCategorized();
          }
        },
          el('div', { class: 'habit-left-info' },
            checkbox,
            el('span', { class: 'habit-title-text' }, h.title)
          ),
          streak > 0 
            ? el('span', { class: 'habit-streak-badge' }, "🔥 ", el('strong', {}, streak))
            : null
        );

        section.appendChild(row);
      });

      habitsBox.appendChild(section);
    });

    // Form to create custom habit
    const customHabitForm = el('div', { class: 'form-card', style: { marginTop: '32px' } },
      el('h3', {}, "Add Custom Habit"),
      el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
        el('div', { class: 'form-group', style: { flex: '1 1 200px' } },
          el('span', { class: 'form-label' }, "Habit Title"),
          el('input', { type: 'text', class: 'form-control', placeholder: 'Read 15 Pages', id: 'new-habit-title' })
        ),
        el('div', { class: 'form-group', style: { flex: '1 1 120px' } },
          el('span', { class: 'form-label' }, "Category"),
          el('select', { class: 'form-control', id: 'new-habit-cat', style: { padding: '0 8px' } },
            el('option', { value: 'Mind' }, "Mind"),
            el('option', { value: 'Fitness' }, "Fitness"),
            el('option', { value: 'Health' }, "Health"),
            el('option', { value: 'Nutrition' }, "Nutrition")
          )
        )
      ),
      el('button', {
        class: 'btn btn-primary',
        style: { width: 'fit-content', alignSelf: 'flex-start', marginTop: '8px' },
        onClick: () => {
          const titleInput = document.getElementById('new-habit-title');
          const catInput = document.getElementById('new-habit-cat');
          if (titleInput && titleInput.value.trim()) {
            const newId = `h-${Date.now()}`;
            habitsList.push({ id: newId, title: titleInput.value.trim(), category: catInput.value });
            saveHabitDefinitions(habitsList);
            titleInput.value = '';
            
            // Reload local references
            categories[catInput.value] = categories[catInput.value] || [];
            categories[catInput.value].push({ id: newId, title: titleInput.value.trim(), category: catInput.value });
            
            // Re-render
            window.location.reload(); // Quick refresh to repopulate categories
          }
        }
      }, "Add Habit Item")
    );

    habitsBox.appendChild(customHabitForm);
  };

  renderHabitsCategorized();
  container.appendChild(habitsBox);
  habitsWrapper.appendChild(container);
  return habitsWrapper;
}

// --- VIEW: MEDIA VAULT (REDESIGNED BOOK PROGRESS & MOVIE CARD RATING) ---
function renderMedia() {
  const mediaWrapper = el('div', { class: 'section' });
  const container = el('div', { class: 'container' });
  
  const header = el('div', { class: 'page-header' },
    el('span', { class: 'page-kicker' }, "Journal Logs"),
    el('h1', {}, "Media Vault")
  );
  container.appendChild(header);

  const subTabs = el('div', { class: 'segmented-control', style: { marginBottom: '24px' } });
  const shelfContent = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } });
  
  const renderMediaSubView = (tab) => {
    shelfContent.replaceChildren();

    subTabs.replaceChildren(
      el('button', { class: `segmented-btn ${tab === 'books' ? 'active' : ''}`, onClick: () => renderMediaSubView('books') }, "Bookshelf"),
      el('button', { class: `segmented-btn ${tab === 'movies' ? 'active' : ''}`, onClick: () => renderMediaSubView('movies') }, "Movie Log")
    );

    if (tab === 'books') {
      const bookGrid = el('div', { class: 'vault-shelves-grid' });
      state.books.forEach(b => {
        const percent = Math.min(100, Math.round((b.pagesRead / b.totalPages) * 100));
        
        bookGrid.appendChild(
          el('div', { class: 'vault-item-card' },
            el('div', { class: 'vault-cover-placeholder' },
              el('span', {}, "📖"),
              el('span', { style: { fontSize: '11px', textTransform: 'uppercase', color: 'var(--colors-muted)', marginTop: '8px' } }, b.status)
            ),
            el('div', { class: 'vault-info' },
              el('span', { class: 'vault-title' }, b.title),
              el('span', { class: 'vault-author' }, `by ${b.author}`),
              el('span', { style: { fontSize: '12px', marginTop: '6px', color: 'var(--colors-ink)', fontWeight: '700' } }, 
                `${b.pagesRead}/${b.totalPages} pages`
              ),
              el('div', { class: 'vault-progress-bar-bg' },
                el('div', { class: 'vault-progress-bar-fg', style: { width: `${percent}%` } })
              )
            ),
            el('button', {
              class: 'widget-quick-btn',
              onClick: () => {
                const val = prompt(`Update pages read (current: ${b.pagesRead}):`, b.pagesRead);
                if (val !== null) {
                  b.pagesRead = Math.min(b.totalPages, parseInt(val) || 0);
                  if (b.pagesRead === b.totalPages) b.status = 'completed';
                  queueSave();
                  renderMediaSubView('books');
                }
              }
            }, "Update Pages")
          )
        );
      });

      // Form to add book
      const addBookForm = el('div', { class: 'form-card', style: { marginTop: '32px' } },
        el('h3', {}, "Add Book to Shelf"),
        el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
          el('div', { class: 'form-group', style: { flex: '1 1 180px' } },
            el('span', { class: 'form-label' }, "Book Title"),
            el('input', { type: 'text', class: 'form-control', id: 'book-title', placeholder: 'The Creative Act' })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 140px' } },
            el('span', { class: 'form-label' }, "Author"),
            el('input', { type: 'text', class: 'form-control', id: 'book-author', placeholder: 'Rick Rubin' })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 100px' } },
            el('span', { class: 'form-label' }, "Total Pages"),
            el('input', { type: 'number', class: 'form-control', id: 'book-pages', placeholder: '300' })
          )
        ),
        el('button', {
          class: 'btn btn-primary',
          style: { width: 'fit-content', alignSelf: 'flex-start', marginTop: '8px' },
          onClick: () => {
            const title = document.getElementById('book-title').value.trim();
            const author = document.getElementById('book-author').value.trim();
            const pages = parseInt(document.getElementById('book-pages').value) || 200;
            if (title) {
              state.books.push({ id: `b-${Date.now()}`, title, author, totalPages: pages, pagesRead: 0, status: 'reading' });
              queueSave();
              renderMediaSubView('books');
            }
          }
        }, "Add to Bookshelf")
      );

      shelfContent.appendChild(bookGrid);
      shelfContent.appendChild(addBookForm);

    } else if (tab === 'movies') {
      const movieGrid = el('div', { class: 'vault-shelves-grid' });
      state.movies.forEach(m => {
        let stars = '';
        for (let i = 0; i < m.rating; i++) stars += '★';
        for (let i = m.rating; i < 5; i++) stars += '☆';
        
        movieGrid.appendChild(
          el('div', { class: 'vault-item-card' },
            el('div', { class: 'vault-cover-placeholder' },
              el('span', {}, "🎬"),
              el('span', { style: { fontSize: '11px', textTransform: 'uppercase', color: 'var(--colors-muted)', marginTop: '8px' } }, m.year)
            ),
            el('div', { class: 'vault-info' },
              el('span', { class: 'vault-title' }, m.title),
              el('span', { style: { fontSize: '13px', color: 'var(--colors-accent-amber)', margin: '4px 0' } }, stars),
              el('p', { style: { fontSize: '12px', fontStyle: 'italic', color: 'var(--colors-body)', overflow: 'hidden', height: '36px' } }, m.review)
            ),
            el('button', {
              class: 'btn btn-text',
              style: { color: 'var(--colors-error)', marginTop: '8px' },
              onClick: () => {
                const idx = state.movies.indexOf(m);
                state.movies.splice(idx, 1);
                queueSave();
                renderMediaSubView('movies');
              }
            }, "Remove Logs")
          )
        );
      });

      // Form to add movie logs
      const addMovieForm = el('div', { class: 'form-card', style: { marginTop: '32px' } },
        el('h3', {}, "Log Watched Movie"),
        el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
          el('div', { class: 'form-group', style: { flex: '1 1 200px' } },
            el('span', { class: 'form-label' }, "Movie Title"),
            el('input', { type: 'text', class: 'form-control', id: 'movie-title', placeholder: 'Oppenheimer' })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 100px' } },
            el('span', { class: 'form-label' }, "Release Year"),
            el('input', { type: 'number', class: 'form-control', id: 'movie-year', placeholder: '2023' })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 120px' } },
            el('span', { class: 'form-label' }, "Rating (1-5)"),
            el('select', { class: 'form-control', id: 'movie-rating', style: { padding: '0 8px' } },
              el('option', { value: 5 }, "5 Stars"),
              el('option', { value: 4 }, "4 Stars"),
              el('option', { value: 3 }, "3 Stars"),
              el('option', { value: 2 }, "2 Stars"),
              el('option', { value: 1 }, "1 Star")
            )
          )
        ),
        el('div', { class: 'form-group' },
          el('span', { class: 'form-label' }, "Review / Notes"),
          el('textarea', { class: 'form-control', id: 'movie-review', placeholder: 'Enter movie critique...' })
        ),
        el('button', {
          class: 'btn btn-primary',
          style: { width: 'fit-content', alignSelf: 'flex-start', marginTop: '8px' },
          onClick: () => {
            const title = document.getElementById('movie-title').value.trim();
            const year = parseInt(document.getElementById('movie-year').value) || 2026;
            const rating = parseInt(document.getElementById('movie-rating').value) || 5;
            const review = document.getElementById('movie-review').value.trim() || 'No review logged.';
            if (title) {
              state.movies.push({ id: `m-${Date.now()}`, title, year, rating, review, status: 'watched' });
              queueSave();
              renderMediaSubView('movies');
            }
          }
        }, "Log watched movie")
      );

      shelfContent.appendChild(movieGrid);
      shelfContent.appendChild(addMovieForm);
    }
  };

  renderMediaSubView('books');
  container.appendChild(subTabs);
  container.appendChild(shelfContent);
  mediaWrapper.appendChild(container);
  return mediaWrapper;
}

// --- VIEW: SETTINGS (FIREBASE CONFIG & GEMINI API KEY) ---
function renderSettings() {
  const settingsWrapper = el('div', { class: 'section' });
  const container = el('div', { class: 'container' });
  
  const header = el('div', { class: 'page-header' },
    el('span', { class: 'page-kicker' }, "Configuration"),
    el('h1', {}, "Settings")
  );
  container.appendChild(header);

  // Authenticated State Indicator
  const authCard = el('div', { class: 'form-card' },
    el('h3', {}, "User Authentication"),
    state.user 
      ? el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          el('div', {},
            el('p', { style: { fontWeight: '700', color: 'var(--colors-ink)' } }, state.user.displayName || "Google User"),
            el('p', { class: 'page-subtitle' }, state.user.email)
          ),
          el('button', {
            class: 'btn btn-secondary',
            onClick: async () => {
              await firebase.signOut(firebase.auth);
              state.user = null;
              window.location.reload();
            }
          }, "Sign Out")
        )
      : el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          el('p', { class: 'page-subtitle' }, "Currently in Local Sandbox mode. Authenticate to sync Firestore."),
          el('button', {
            class: 'btn btn-primary',
            onClick: () => { window.location.hash = '#auth'; }
          }, "Open Auth Portal")
        )
  );

  // Firebase configurations
  const fbConfig = firebase.getFirebaseConfig();
  const fbConfigured = firebase.isFirebaseConfigured();
  
  const firebaseCard = el('div', { class: `form-card settings-key-card ${fbConfigured ? 'configured' : ''}` },
    el('h3', {}, "Firebase Database Settings"),
    el('p', { class: 'page-subtitle' }, "Save your Google Firebase config to cloud-sync metrics."),
    el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      el('div', { class: 'form-group' },
        el('span', { class: 'form-label' }, "API Key"),
        el('input', { type: 'password', class: 'form-control', value: fbConfig.apiKey || '', id: 'settings-fb-key' })
      ),
      el('div', { class: 'form-group' },
        el('span', { class: 'form-label' }, "Project ID"),
        el('input', { type: 'text', class: 'form-control', value: fbConfig.projectId || '', id: 'settings-fb-pid' })
      )
    ),
    el('button', {
      class: 'btn btn-primary',
      style: { width: 'fit-content', marginTop: '12px' },
      onClick: () => {
        const key = document.getElementById('settings-fb-key').value.trim();
        const pid = document.getElementById('settings-fb-pid').value.trim();
        if (key && pid) {
          const config = {
            apiKey: key,
            projectId: pid,
            authDomain: `${pid}.firebaseapp.com`,
            storageBucket: `${pid}.appspot.com`,
            messagingSenderId: "123456789",
            appId: `1:${pid}:web:12345`
          };
          firebase.saveFirebaseConfig(config);
          alert("Firebase credentials configured. App will reload to sync.");
          firebase.reinitializeFirebase();
        } else {
          firebase.saveFirebaseConfig(null);
          alert("Firebase config cleared. Sandbox fallback active.");
          window.location.reload();
        }
      }
    }, fbConfigured ? "Update Config" : "Save Credentials")
  );

  // Gemini API Key obfuscated form
  const geminiKey = gemini.getGeminiKey();
  const geminiConfigured = !!geminiKey;

  const geminiCard = el('div', { class: `form-card settings-key-card ${geminiConfigured ? 'configured' : ''}` },
    el('h3', {}, "Gemini AI Engine Key"),
    el('p', { class: 'page-subtitle' }, "Input your Gemini API key to enable direct AI health coaching feedback on the Dashboard. Get your key free at Google AI Studio."),
    el('div', { class: 'form-group' },
      el('span', { class: 'form-label' }, "API Key"),
      el('input', { 
        type: 'password', 
        class: 'form-control', 
        value: geminiKey || '', 
        id: 'settings-gemini-key',
        placeholder: geminiConfigured ? '••••••••••••••••••••••••••••••••••••' : 'AIzaSy...'
      })
    ),
    el('button', {
      class: 'btn btn-primary',
      style: { width: 'fit-content', marginTop: '12px' },
      onClick: () => {
        const keyVal = document.getElementById('settings-gemini-key').value.trim();
        if (keyVal) {
          gemini.saveGeminiKey(keyVal);
          alert("Gemini key saved securely (obfuscated against browser memory extraction).");
          window.location.reload();
        } else {
          gemini.saveGeminiKey('');
          alert("Gemini API key cleared.");
          window.location.reload();
        }
      }
    }, geminiConfigured ? "Update AI Key" : "Save AI Key")
  );

  // Reset database options
  const dangerCard = el('div', { class: 'form-card', style: { borderLeft: '4px solid var(--colors-error)' } },
    el('h3', { style: { color: 'var(--colors-error)' } }, "System Maintenance"),
    el('p', { class: 'page-subtitle' }, "Danger zone: clear local cache logs, resets habits splits and books database."),
    el('button', {
      class: 'btn btn-accent',
      style: { width: 'fit-content', backgroundColor: 'var(--colors-error)' },
      onClick: () => {
        if (confirm("Reset application? All local mock data will be deleted.")) {
          localStorage.removeItem('life_tracker_redesign_logs');
          localStorage.removeItem('life_tracker_redesign_splits');
          localStorage.removeItem('life_tracker_redesign_recipes');
          localStorage.removeItem('life_tracker_redesign_books');
          localStorage.removeItem('life_tracker_redesign_movies');
          window.location.reload();
        }
      }
    }, "Clear Local Cache Logs")
  );

  // Splits Configurator Card
  const splitsCard = el('div', { class: 'form-card splits-configurator-card' },
    el('h3', {}, "Workout Splits Configurator"),
    el('p', { class: 'page-subtitle' }, "Customize your routine templates. These default values populate when you load a split in the fitness tracker.")
  );

  Object.keys(state.workoutSplit).forEach(splitName => {
    const splitWrapper = el('div', { class: 'settings-split-wrapper', style: { borderBottom: '1px solid var(--colors-hairline)', paddingBottom: '16px', marginBottom: '16px' } },
      el('h4', { style: { color: 'var(--colors-primary)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, 
        splitName
      )
    );

    const exercisesContainer = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

    state.workoutSplit[splitName].forEach((ex, exIdx) => {
      const row = el('div', { class: 'settings-split-row', style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' } },
        el('span', { style: { fontWeight: '700', flex: '1 1 120px', fontSize: '13.5px' } }, ex.name),
        // Sets input
        el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
          el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, "Sets"),
          el('input', {
            type: 'number',
            class: 'form-control',
            style: { width: '50px', padding: '2px 4px', textAlign: 'center', height: '26px' },
            value: ex.sets,
            onInput: (e) => {
              ex.sets = parseInt(e.target.value) || 0;
              saveLocalState();
            }
          })
        ),
        // Reps input
        el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
          el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, "Reps"),
          el('input', {
            type: 'number',
            class: 'form-control',
            style: { width: '50px', padding: '2px 4px', textAlign: 'center', height: '26px' },
            value: ex.reps,
            onInput: (e) => {
              ex.reps = parseInt(e.target.value) || 0;
              saveLocalState();
            }
          })
        ),
        // Weight input
        el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
          el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, "Weight"),
          el('input', {
            type: 'number',
            class: 'form-control',
            style: { width: '60px', padding: '2px 4px', textAlign: 'center', height: '26px' },
            value: ex.weight,
            onInput: (e) => {
              ex.weight = parseFloat(e.target.value) || 0;
              saveLocalState();
            }
          }),
          el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, "kg")
        ),
        // Delete button
        el('button', {
          class: 'btn btn-text',
          style: { color: 'var(--colors-error)', padding: '2px', marginLeft: 'auto' },
          onClick: () => {
            state.workoutSplit[splitName].splice(exIdx, 1);
            saveLocalState();
            renderApp(); // Re-render Settings view
          }
        }, icon(ICONS.trash))
      );
      exercisesContainer.appendChild(row);
    });

    // Add new exercise row
    const addRow = el('div', { style: { display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' } },
      el('input', {
        type: 'text',
        placeholder: 'Add new exercise name...',
        class: 'form-control',
        style: { flex: '1', height: '28px', fontSize: '13px' },
        id: `add-ex-name-${splitName.replace(/\s+/g, '-')}`
      }),
      el('button', {
        class: 'btn btn-primary',
        style: { padding: '4px 12px', fontSize: '12.5px', height: '28px' },
        onClick: () => {
          const inputEl = document.getElementById(`add-ex-name-${splitName.replace(/\s+/g, '-')}`);
          const name = inputEl.value.trim();
          if (name) {
            state.workoutSplit[splitName].push({ name, sets: 3, reps: 10, weight: 20 });
            saveLocalState();
            renderApp();
          }
        }
      }, "Add")
    );

    splitWrapper.appendChild(exercisesContainer);
    splitWrapper.appendChild(addRow);
    splitsCard.appendChild(splitWrapper);
  });

  container.appendChild(authCard);
  container.appendChild(firebaseCard);
  container.appendChild(splitsCard);
  container.appendChild(geminiCard);
  container.appendChild(dangerCard);
  settingsWrapper.appendChild(container);
  return settingsWrapper;
}

// --- App Bootstrapper & Firebase Listeners ---
function initApp() {
  loadLocalState();
  
  if (firebase.auth) {
    firebase.onAuthStateChanged(firebase.auth, (user) => {
      if (user) {
        state.user = user;
        setupFirestoreSync(user);
      } else {
        state.user = null;
        renderApp();
      }
    });
  } else {
    renderApp();
  }
  
  handleNavigation();
}

initApp();
