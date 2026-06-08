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

function elNS(tag, attrs = {}, ...children) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'style' && typeof val === 'object') {
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
  profile: null, // User Onboarding Profile
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
    { title: "High Protein Oatmeal", calories: 450, protein: 30, carbs: 45, fat: 8, desc: "Oats, whey, almond milk, banana" },
    { title: "Chicken Rice Bowl", calories: 650, protein: 45, carbs: 60, fat: 12, desc: "Chicken breast, jasmine rice, broccoli, olive oil" }
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
let activeSettingsTab = 'profile';

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
    pagesRead: 0,
    activeBurn: null,
    chatHistory: []
  };
}

function normalizeDayLog(day) {
  if (!day) return getEmptyDayLog();
  const defaults = getEmptyDayLog();
  for (const key in defaults) {
    if (day[key] === undefined || day[key] === null) {
      day[key] = defaults[key];
    }
  }
  return day;
}

function getActiveBurn(dayLog) {
  if (dayLog && typeof dayLog.activeBurn === 'number') {
    return Math.round(dayLog.activeBurn);
  }
  let burn = 0;
  if (dayLog && dayLog.steps > 0) {
    burn += dayLog.steps * 0.04;
  }
  if (dayLog && dayLog.workouts && dayLog.workouts.length > 0) {
    let totalSets = dayLog.workouts.reduce((acc, ex) => acc + (parseInt(ex.sets) || 0), 0);
    burn += 150 + (totalSets * 20);
  }
  return Math.round(burn);
}

function syncDailyProgress(day) {
  if (!day.habitsCompleted) {
    day.habitsCompleted = [];
  }
  
  const stepGoal = state.profile?.targetSteps || 10000;
  const waterGoal = state.profile?.targetWater || 8;

  // Sync Steps habit (h2)
  const stepsIndex = day.habitsCompleted.indexOf('h2');
  if (day.steps >= stepGoal) {
    if (stepsIndex === -1) day.habitsCompleted.push('h2');
  } else {
    if (stepsIndex !== -1) day.habitsCompleted.splice(stepsIndex, 1);
  }

  // Sync Hydration habit (h3)
  const waterIndex = day.habitsCompleted.indexOf('h3');
  if (day.water >= waterGoal) {
    if (waterIndex === -1) day.habitsCompleted.push('h3');
  } else {
    if (waterIndex !== -1) day.habitsCompleted.splice(waterIndex, 1);
  }
}

function getTodayLog() {
  if (!state.logs[state.dateStr]) {
    state.logs[state.dateStr] = getEmptyDayLog();
  }
  const day = normalizeDayLog(state.logs[state.dateStr]);
  state.logs[state.dateStr] = day; // save normalized back
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
  const localProfile = localStorage.getItem('life_tracker_redesign_profile');
  
  if (localProfile) state.profile = JSON.parse(localProfile);
  if (localLogs) {
    state.logs = JSON.parse(localLogs);
    for (const d in state.logs) {
      state.logs[d] = normalizeDayLog(state.logs[d]);
    }
  }
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
        habitsCompleted: Math.random() > 0.5 ? ['h1'] : [],
        pagesRead: Math.floor(Math.random() * 20)
      };
      syncDailyProgress(state.logs[dateStr]);
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
  localStorage.setItem('life_tracker_redesign_profile', JSON.stringify(state.profile));
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
  const habits = JSON.parse(localStorage.getItem('life_tracker_redesign_habits_list')) || DEFAULT_HABITS;
  const stepGoal = state.profile?.targetSteps || 10000;
  const waterGoal = state.profile?.targetWater || 8;
  
  return habits.map(h => {
    if (h.id === 'h2') {
      const stepText = stepGoal >= 1000 ? `${(stepGoal/1000).toFixed(1).replace('.0', '')}k` : stepGoal;
      return { ...h, title: `${stepText} Steps Walked` };
    }
    if (h.id === 'h3') {
      return { ...h, title: `Hydrated (${waterGoal}+ Cups)` };
    }
    return h;
  });
}

function saveHabitDefinitions(list) {
  localStorage.setItem('life_tracker_redesign_habits_list', JSON.stringify(list));
}

// Generate Proactive Insights list
function generateInsights(day) {
  const insights = [];
  const stepGoal = state.profile?.targetSteps || 10000;
  const waterGoal = state.profile?.targetWater || 8;
  const stepGoalText = stepGoal >= 1000 ? `${(stepGoal/1000).toFixed(0)}k` : stepGoal;
  
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

  if (day.water < waterGoal) {
    insights.push({
      id: 'hydration-refocus',
      category: 'water',
      text: `Water balance: ${day.water}/${waterGoal} cups. Drink a glass to boost energy.`,
      actionText: "+ 1 Cup",
      action: () => {
        day.water = (day.water || 0) + 1;
        syncDailyProgress(day);
        queueSave();
        renderApp();
      }
    });
  }

  if (day.steps < stepGoal) {
    insights.push({
      id: 'steps-check',
      category: 'steps',
      text: `Step progression: ${day.steps.toLocaleString()}/${stepGoalText} steps logged today.`,
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
    stop1.setAttribute('stop-color', '#cc785c');
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#e8a55a');
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
      tick.setAttribute('stroke', '#e6dfd8');
      tick.setAttribute('stroke-width', '1.5');
      svg.appendChild(tick);

      // Number labels
      const labelP = angleToXY(angle, r - 30, cx, cy);
      const hourLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      hourLabel.setAttribute('x', labelP.x);
      hourLabel.setAttribute('y', labelP.y);
      hourLabel.setAttribute('text-anchor', 'middle');
      hourLabel.setAttribute('dominant-baseline', 'central');
      hourLabel.setAttribute('fill', '#6c6a64');
      hourLabel.setAttribute('font-size', '10');
      hourLabel.setAttribute('font-family', 'Outfit, sans-serif');
      hourLabel.setAttribute('font-weight', '600');
      hourLabel.textContent = i === 0 ? '12' : String(i);
      svg.appendChild(hourLabel);
    }

    // Sleep handle
    const sleepHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sleepHandle.setAttribute('r', handleR);
    sleepHandle.setAttribute('fill', '#cc785c');
    sleepHandle.setAttribute('stroke', '#ffffff');
    sleepHandle.setAttribute('stroke-width', '3');
    sleepHandle.setAttribute('cursor', 'grab');
    svg.appendChild(sleepHandle);

    // Wake handle
    const wakeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    wakeHandle.setAttribute('r', handleR);
    wakeHandle.setAttribute('fill', '#e8a55a');
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
  const stepGoal = state.profile?.targetSteps || 10000;
  const stepPercent = Math.min(100, Math.round(((day.steps || 0) / stepGoal) * 100));
  
  const netCals = Math.max(0, (day.calories || 0) - getActiveBurn(day));
  const calGoal = state.profile?.targetCalories || 2000;
  const calPercent = Math.min(100, Math.round((netCals / calGoal) * 100));
  
  const sleepGoal = state.profile?.targetSleep || 8;
  const sleepScore = Math.min(100, Math.round(((day.sleep || 0) / sleepGoal) * 100));
  
  const waterGoal = state.profile?.targetWater || 8;
  const waterScore = Math.min(100, Math.round(((day.water || 0) / waterGoal) * 100));
  
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
      if (data.profile) {
        state.profile = data.profile;
      }
      
      // Auto-generate sync token for existing users who don't have one
      if (!state.profile) state.profile = {};
      if (!state.profile.syncToken) {
        saveUserPreferences(); // This will auto-generate the token and save it
      }
      
      saveLocalState();
      renderApp();
    } else {
      saveUserPreferences();
      renderApp();
    }
  }, (err) => {
    console.error("Firestore user preferences sync error:", err);
    renderApp();
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
      state.logs[date] = normalizeDayLog(docSnapshot.data());
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

function generateSyncToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function saveUserPreferences() {
  if (!firebase.db || !state.user) return;
  
  if (!state.profile) state.profile = {};
  if (!state.profile.syncToken) {
    state.profile.syncToken = generateSyncToken();
  }
  
  const userDocRef = firebase.doc(firebase.db, "users", state.user.uid);
  try {
    await firebase.setDoc(userDocRef, {
      workoutSplit: state.workoutSplit,
      recipes: state.recipes,
      books: state.books,
      movies: state.movies,
      profile: state.profile
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

// ============================================================
// USER ONBOARDING WIZARD SYSTEM
// ============================================================
let onboardingStep = 1;
let onboardingData = {
  goal: 'maintain',
  gender: 'male',
  age: 30,
  height: 175,
  weight: 75,
  goalWeight: 75,
  activityLevel: 'moderate',
  targetCalories: 2000,
  targetProtein: 140,
  targetWater: 8,
  targetSteps: 10000,
  targetSleep: 8
};

function calculateOnboardingTargets() {
  const weight = parseFloat(onboardingData.weight) || 70;
  const height = parseFloat(onboardingData.height) || 170;
  const age = parseInt(onboardingData.age) || 30;
  const gender = onboardingData.gender || 'male';
  const goal = onboardingData.goal || 'maintain';
  const activity = onboardingData.activityLevel || 'moderate';

  const targets = recalcProfileTargets(goal, weight, height, age, gender, activity);
  
  onboardingData.targetCalories = targets.calories;
  onboardingData.targetProtein = targets.protein;
  onboardingData.targetWater = 8;
  onboardingData.targetSteps = 10000;
  onboardingData.targetSleep = 8;
}

function recalcProfileTargets(goal, weight, height, age, gender, activity) {
  // Mifflin-St Jeor Formula
  let bmr = 0;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === 'female') {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  }

  // Activity Multipliers
  let multiplier = 1.2;
  if (activity === 'light') multiplier = 1.375;
  else if (activity === 'moderate') multiplier = 1.55;
  else if (activity === 'active') multiplier = 1.725;

  const tdee = Math.round(bmr * multiplier);

  // Calorie adjustments
  let calories = tdee;
  if (goal === 'lose') {
    calories = Math.max(1200, tdee - 500);
  } else if (goal === 'build') {
    calories = tdee + 300;
  }

  // Protein adjustments
  let protein = 120;
  if (goal === 'lose' || goal === 'build') {
    protein = Math.round(1.8 * weight);
  } else {
    protein = Math.round(1.4 * weight);
  }

  return { calories, protein };
}

function renderOnboarding() {
  const container = el('div', { class: 'section' });
  const wrapper = el('div', { class: 'container', style: { maxWidth: '640px' } });
  
  const stepTitles = ["Objective", "Metrics", "Lifestyle", "Targets", "Review"];
  const progressPercent = ((onboardingStep - 1) / (stepTitles.length - 1)) * 100;
  
  const progressBar = el('div', { class: 'onboarding-progress-bar', style: { width: `${progressPercent}%` } });
  const progressTrack = el('div', { class: 'onboarding-progress-track' }, progressBar);
  
  const stepIndicators = stepTitles.map((title, i) => {
    const isPastOrCurrent = (i + 1) <= onboardingStep;
    return el('span', { 
      class: `onboarding-step-indicator ${isPastOrCurrent ? 'active' : ''}`,
      style: { fontWeight: isPastOrCurrent ? '700' : '500' }
    }, title);
  });
  
  const progressHeader = el('div', { class: 'onboarding-progress' },
    progressTrack,
    el('div', { class: 'onboarding-progress-steps' }, ...stepIndicators)
  );

  const card = el('div', { class: 'onboarding-card' });
  card.appendChild(progressHeader);

  if (onboardingStep === 1) {
    card.appendChild(el('h2', { style: { fontFamily: 'var(--font-display)', marginBottom: '8px' } }, "Welcome. What is your primary focus?"));
    card.appendChild(el('p', { class: 'page-subtitle' }, "Let's tailor your Life Tracker to align with your health and fitness objectives."));
    
    const goals = [
      { id: 'lose', title: 'Lose Body Fat', desc: 'Optimize nutrition with a caloric deficit and track training consistency.' },
      { id: 'maintain', title: 'Maintain Weight & Fitness', desc: 'Find your TDEE equilibrium and build solid lifestyle consistency.' },
      { id: 'build', title: 'Build Strength & Muscle', desc: 'Fuel progressive overload workouts with a caloric surplus and protein targets.' },
      { id: 'wellness', title: 'General Wellness & Habits', desc: 'Focus on sleep, hydration, and daily habit consistency without active weight tracking.' }
    ];
    
    const grid = el('div', { class: 'onboarding-choice-grid' },
      ...goals.map(g => el('div', {
        class: `onboarding-choice-card ${onboardingData.goal === g.id ? 'active' : ''}`,
        onClick: () => {
          onboardingData.goal = g.id;
          renderApp();
        }
      },
        el('strong', {}, g.title),
        el('span', {}, g.desc)
      ))
    );
    card.appendChild(grid);
    
    const nextBtn = el('button', {
      class: 'btn btn-primary',
      style: { marginLeft: 'auto' },
      onClick: () => {
        onboardingStep = 2;
        renderApp();
      }
    }, "Continue", icon(ICONS.chevronRight));
    
    card.appendChild(el('div', { class: 'onboarding-nav' }, nextBtn));

  } else if (onboardingStep === 2) {
    card.appendChild(el('h2', { style: { fontFamily: 'var(--font-display)', marginBottom: '8px' } }, "Tell us about yourself"));
    card.appendChild(el('p', { class: 'page-subtitle' }, "Your body metrics are used to calculate your basic metabolic rate (BMR) and starting targets."));
    
    const genderField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Biological Gender"),
      el('select', {
        class: 'onboarding-select',
        onChange: (e) => { onboardingData.gender = e.target.value; }
      },
        el('option', { value: 'male', selected: onboardingData.gender === 'male' }, "Male"),
        el('option', { value: 'female', selected: onboardingData.gender === 'female' }, "Female"),
        el('option', { value: 'other', selected: onboardingData.gender === 'other' }, "Prefer not to say / Neutral")
      )
    );

    const ageField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Age (Years)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.age,
        min: '10',
        max: '100',
        onInput: (e) => { onboardingData.age = parseInt(e.target.value) || 30; }
      })
    );

    const heightField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Height (cm)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.height,
        min: '100',
        max: '250',
        onInput: (e) => { onboardingData.height = parseFloat(e.target.value) || 170; }
      })
    );

    const weightField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Current Weight (kg)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.weight,
        min: '30',
        max: '300',
        step: '0.1',
        onInput: (e) => { onboardingData.weight = parseFloat(e.target.value) || 70; }
      })
    );

    const goalWeightField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Goal Weight (kg)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.goalWeight,
        min: '30',
        max: '300',
        step: '0.1',
        onInput: (e) => { onboardingData.goalWeight = parseFloat(e.target.value) || 70; }
      })
    );

    const row1 = el('div', { class: 'onboarding-field-row' }, genderField, ageField);
    const row2 = el('div', { class: 'onboarding-field-row' }, heightField, weightField);
    const row3 = el('div', { class: 'onboarding-field-row' }, goalWeightField);
    
    card.appendChild(row1);
    card.appendChild(row2);
    card.appendChild(row3);
    
    const prevBtn = el('button', {
      class: 'btn btn-secondary',
      onClick: () => {
        onboardingStep = 1;
        renderApp();
      }
    }, "Back");
    
    const nextBtn = el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        if (!onboardingData.age || !onboardingData.height || !onboardingData.weight) {
          alert("Please fill in all body metrics.");
          return;
        }
        onboardingStep = 3;
        renderApp();
      }
    }, "Continue", icon(ICONS.chevronRight));
    
    card.appendChild(el('div', { class: 'onboarding-nav' }, prevBtn, nextBtn));

  } else if (onboardingStep === 3) {
    card.appendChild(el('h2', { style: { fontFamily: 'var(--font-display)', marginBottom: '8px' } }, "What is your activity level?"));
    card.appendChild(el('p', { class: 'page-subtitle' }, "Active calorie burn calculations and TDEE targets adapt to your routine lifestyle activity."));
    
    const activities = [
      { id: 'sedentary', title: 'Sedentary', desc: 'Little to no daily exercise. Desk job, minimal walking.' },
      { id: 'light', title: 'Lightly Active', desc: 'Light exercise or walking 1–3 days per week. Moderate moving.' },
      { id: 'moderate', title: 'Moderately Active', desc: 'Moderate exercise/sports 3–5 days per week. Active daily lifestyle.' },
      { id: 'active', title: 'Very Active', desc: 'Hard training or intense sports 6–7 days per week. Highly physical job.' }
    ];
    
    const grid = el('div', { class: 'onboarding-choice-grid' },
      ...activities.map(a => el('div', {
        class: `onboarding-choice-card ${onboardingData.activityLevel === a.id ? 'active' : ''}`,
        onClick: () => {
          onboardingData.activityLevel = a.id;
          renderApp();
        }
      },
        el('strong', {}, a.title),
        el('span', {}, a.desc)
      ))
    );
    card.appendChild(grid);
    
    const prevBtn = el('button', {
      class: 'btn btn-secondary',
      onClick: () => {
        onboardingStep = 2;
        renderApp();
      }
    }, "Back");
    
    const nextBtn = el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        calculateOnboardingTargets();
        onboardingStep = 4;
        renderApp();
      }
    }, "Calculate Targets", icon(ICONS.chevronRight));
    
    card.appendChild(el('div', { class: 'onboarding-nav' }, prevBtn, nextBtn));

  } else if (onboardingStep === 4) {
    card.appendChild(el('h2', { style: { fontFamily: 'var(--font-display)', marginBottom: '8px' } }, "Here are your calculated targets"));
    card.appendChild(el('p', { class: 'page-subtitle' }, "Based on your metrics, these goals will optimize your consistency. You can adjust them below if desired."));
    
    const caloriesField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Calorie Target (kcal)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.targetCalories,
        onInput: (e) => { onboardingData.targetCalories = parseInt(e.target.value) || 2000; }
      })
    );

    const proteinField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Protein Target (g)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.targetProtein,
        onInput: (e) => { onboardingData.targetProtein = parseInt(e.target.value) || 120; }
      })
    );

    const waterField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Water Target (cups)"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.targetWater,
        onInput: (e) => { onboardingData.targetWater = parseInt(e.target.value) || 8; }
      })
    );

    const stepsField = el('div', { class: 'onboarding-field' },
      el('label', {}, "Steps Target"),
      el('input', {
        type: 'number',
        class: 'onboarding-input',
        value: onboardingData.targetSteps,
        onInput: (e) => { onboardingData.targetSteps = parseInt(e.target.value) || 10000; }
      })
    );

    const recsWrapper = el('div', { class: 'recommendations-wrapper' },
      el('div', { class: 'recommendation-summary-grid' },
        el('div', { class: 'recommendation-card primary' },
          el('span', { class: 'rec-label' }, "Daily Energy"),
          el('span', { class: 'rec-val' }, `${onboardingData.targetCalories} kcal`),
          el('span', { class: 'rec-sub' }, "Optimized Intake")
        ),
        el('div', { class: 'recommendation-card' },
          el('span', { class: 'rec-label' }, "Daily Fuel"),
          el('span', { class: 'rec-val' }, `${onboardingData.targetProtein}g`),
          el('span', { class: 'rec-sub' }, "Protein target")
        ),
        el('div', { class: 'recommendation-card' },
          el('span', { class: 'rec-label' }, "Hydration"),
          el('span', { class: 'rec-val' }, `${onboardingData.targetWater} cups`),
          el('span', { class: 'rec-sub' }, "Fluid balance")
        ),
        el('div', { class: 'recommendation-card' },
          el('span', { class: 'rec-label' }, "Steps"),
          el('span', { class: 'rec-val' }, `${onboardingData.targetSteps.toLocaleString()}`),
          el('span', { class: 'rec-sub' }, "Daily movement")
        )
      )
    );
    
    card.appendChild(recsWrapper);

    const row1 = el('div', { class: 'onboarding-field-row' }, caloriesField, proteinField);
    const row2 = el('div', { class: 'onboarding-field-row' }, waterField, stepsField);
    card.appendChild(row1);
    card.appendChild(row2);
    
    const prevBtn = el('button', {
      class: 'btn btn-secondary',
      onClick: () => {
        onboardingStep = 3;
        renderApp();
      }
    }, "Back");
    
    const nextBtn = el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        onboardingStep = 5;
        renderApp();
      }
    }, "Review Summary", icon(ICONS.chevronRight));
    
    card.appendChild(el('div', { class: 'onboarding-nav' }, prevBtn, nextBtn));

  } else if (onboardingStep === 5) {
    card.appendChild(el('h2', { style: { fontFamily: 'var(--font-display)', marginBottom: '8px' } }, "Ready to begin your tracking canvas"));
    card.appendChild(el('p', { class: 'page-subtitle' }, "Here is a summary of your profile parameters. You can edit them at any time in App Settings."));
    
    const goalText = onboardingData.goal === 'lose' ? 'Fat Loss' : onboardingData.goal === 'build' ? 'Muscle Building' : onboardingData.goal === 'maintain' ? 'Maintenance' : 'General Wellness';
    const activityText = onboardingData.activityLevel === 'sedentary' ? 'Sedentary' : onboardingData.activityLevel === 'light' ? 'Lightly Active' : onboardingData.activityLevel === 'moderate' ? 'Moderately Active' : 'Very Active';

    const summaryList = el('div', { style: { margin: '24px 0', display: 'flex', flexDirection: 'column', gap: '12px' } },
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Primary Goal: "), goalText),
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Lifestyle Activity: "), activityText),
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Current Weight: "), `${onboardingData.weight} kg (Goal: ${onboardingData.goalWeight} kg)`),
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Calorie Goal: "), `${onboardingData.targetCalories} kcal / day`),
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Protein Goal: "), `${onboardingData.targetProtein}g / day`),
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Water Goal: "), `${onboardingData.targetWater} cups / day`),
      el('p', { class: 'onboarding-summary-text' }, el('strong', {}, "Step Goal: "), `${onboardingData.targetSteps.toLocaleString()} steps / day`)
    );
    card.appendChild(summaryList);

    const prevBtn = el('button', {
      class: 'btn btn-secondary',
      onClick: () => {
        onboardingStep = 4;
        renderApp();
      }
    }, "Back");
    
    const completeBtn = el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        state.profile = {
          ...onboardingData,
          completedOnboarding: true,
          setupAt: new Date().toISOString()
        };
        
        const todayLog = getTodayLog();
        if (todayLog && (!todayLog.weight || todayLog.weight === 0)) {
          todayLog.weight = onboardingData.weight;
        }

        saveLocalState();
        if (state.user && firebase.db) {
          saveUserPreferences();
        }
        
        state.activeView = 'dashboard';
        window.location.hash = '#dashboard';
        renderApp();
      }
    }, "Complete Setup & Get Started", icon(ICONS.sparkles));

    card.appendChild(el('div', { class: 'onboarding-nav' }, prevBtn, completeBtn));
  }

  wrapper.appendChild(card);
  container.appendChild(wrapper);
  return container;
}

function renderApp() {
  const shouldResetScroll = lastRenderedView !== state.activeView;
  
  const desktopDate = document.getElementById('global-date-picker');
  if (desktopDate) {
    desktopDate.value = state.dateStr;
    const label = document.getElementById('desktop-date-label');
    if (label) label.textContent = formatLongDate(state.dateStr);
  }

  const isOnboarding = !state.profile || !state.profile.completedOnboarding;

  // Update nav link active styling
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(item => {
    const view = item.getAttribute('data-view') || item.getAttribute('href')?.replace('#', '');
    if (view === state.activeView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Hide navigation headers/bars if onboarding is active
  const desktopHeader = document.getElementById('desktop-header');
  const mobileNavBar = document.getElementById('mobile-nav-bar');
  if (isOnboarding && state.activeView !== 'auth') {
    if (desktopHeader) desktopHeader.style.display = 'none';
    if (mobileNavBar) mobileNavBar.style.display = 'none';
  } else {
    if (desktopHeader) desktopHeader.style.display = '';
    if (mobileNavBar) mobileNavBar.style.display = '';
  }

  const mainContainer = document.getElementById('view-target');
  if (!mainContainer) return;
  mainContainer.replaceChildren();

  // Intercept with Onboarding if not completed
  if (isOnboarding && state.activeView !== 'auth') {
    mainContainer.appendChild(renderOnboarding());
    if (shouldResetScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    lastRenderedView = 'onboarding';
    return;
  }

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
  
  const calGoal = state.profile?.targetCalories || 2000;
  const stepGoal = state.profile?.targetSteps || 10000;
  
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
        el('span', { class: `day-dot ${(dayLog.steps >= stepGoal) ? 'completed' : ''}` }),
        el('span', { class: `day-dot ${(dayLog.water >= (state.profile?.targetWater || 8)) ? 'completed' : ''}` }),
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
    const stepsPercent = Math.min(1, stepsDone / stepGoal);
    const stepsDash = stepsPercent * 311.02;

    const habitsTotal = habits.length;
    const habitsPercent = habitsTotal ? Math.min(1, habitsDone / habitsTotal) : 0;
    const habitsDash = habitsPercent * 235.62;

    const waterDone = day.water || 0;
    const waterGoal = state.profile?.targetWater || 8;
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
          el('span', { class: 'widget-card-meta' }, `${stepPercent}% of ${stepGoal >= 1000 ? `${(stepGoal/1000).toFixed(0)}k` : stepGoal} goal`)
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
          el('span', { class: 'widget-card-meta' }, `${Math.min(100, Math.round((day.sleep || 0)/(state.profile?.targetSleep || 8)*100))}% of ${state.profile?.targetSleep || 8}h target`)
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
          el('strong', { class: 'widget-card-value' }, `${day.water || 0} / ${state.profile?.targetWater || 8}`),
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
    const trends = getWeeklyTrends(state.dateStr);

    // Check auto-synthesis at 9:00 PM
    const autoSynthesizeIfNeeded = async () => {
      if (day.aiReview) return;
      const todayDateStr = new Date().toISOString().split('T')[0];
      if (state.dateStr !== todayDateStr) return; // Only for current day
      
      const currentHour = new Date().getHours();
      if (currentHour >= 21) { // 9:00 PM or later
        console.log("Auto-triggering 9:00 PM AI Review synthesis...");
        const history = [];
        const dates = Object.keys(state.logs).sort().reverse();
        for (let d of dates) {
          if (d !== state.dateStr && history.length < 3) {
            history.push({ date: d, ...state.logs[d] });
          }
        }
        
        try {
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
            trends: trends
          }, history);
          
          day.aiReview = review;
          queueSave();
          renderCoachAndTrendsSubView();
        } catch (err) {
          console.error("Auto-synthesis failed:", err);
        }
      }
    };
    autoSynthesizeIfNeeded();
    
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
          trends: trends
        }, history);
        
        day.aiReview = review;
        queueSave();
        renderCoachAndTrendsSubView();
      }
    }, "Analyze Logs & Synthesize Insights");

    const renderCoachAndTrendsSubView = () => {
      coachPanel.replaceChildren();

      if (day.aiReview) {
        let recoveryColor = 'var(--colors-success)';
        let recoveryBg = 'rgba(46, 125, 50, 0.1)';
        const recNeed = day.aiReview.recoveryNeed || "Medium";
        if (recNeed === "High") {
          recoveryColor = 'var(--colors-error)';
          recoveryBg = 'rgba(198, 40, 40, 0.1)';
        } else if (recNeed === "Medium") {
          recoveryColor = 'var(--colors-accent-amber)';
          recoveryBg = 'rgba(239, 108, 0, 0.1)';
        }

        // Daily Score SVG Circle Gauge
        const scoreVal = day.aiReview.score || 0;
        const radius = 22;
        const strokeWidth = 4.5;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (scoreVal / 100) * circumference;

        const scoreGauge = elNS('svg', { 
          width: '56', 
          height: '56', 
          viewBox: '0 0 56 56',
          style: { transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 4px rgba(232, 165, 90, 0.2))' } 
        },
          elNS('circle', { 
            cx: '28', 
            cy: '28', 
            r: radius, 
            fill: 'none', 
            stroke: 'rgba(255,255,255,0.06)', 
            'stroke-width': strokeWidth 
          }),
          elNS('circle', { 
            cx: '28', 
            cy: '28', 
            r: radius, 
            fill: 'none', 
            stroke: 'var(--colors-accent-amber)', 
            'stroke-width': strokeWidth,
            'stroke-dasharray': circumference,
            'stroke-dashoffset': strokeDashoffset,
            'stroke-linecap': 'round',
            style: { transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }
          })
        );

        const scoreWidget = el('div', { 
          style: { 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '12px',
            background: 'rgba(255,255,255,0.04)',
            padding: '4px 14px 4px 6px',
            borderRadius: 'var(--rounded-pill)',
            border: '1px solid rgba(255,255,255,0.06)'
          } 
        },
          scoreGauge,
          el('div', { style: { display: 'flex', flexDirection: 'column' } },
            el('span', { style: { fontSize: '9px', textTransform: 'uppercase', color: 'var(--colors-on-dark-soft)', fontWeight: '800', letterSpacing: '0.05em' } }, "Daily Score"),
            el('strong', { style: { fontSize: '18px', color: 'var(--colors-on-dark)', fontFamily: 'var(--font-display)', fontWeight: '800', lineHeight: '1.1' } }, `${scoreVal}`),
            el('span', { style: { fontSize: '9px', color: 'var(--colors-on-dark-soft)', marginTop: '1px' } }, "points")
          )
        );

        coachPanel.appendChild(
          el('div', { class: 'ai-coach-bubble-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' } },
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
              el('div', { class: 'ai-coach-avatar' }, "AI"),
              el('div', { class: 'ai-coach-meta-info' },
                el('strong', {}, "Coach Gemini"),
                el('span', {}, `Style: ${localStorage.getItem('lt_coach_personality') || 'Elite'}`)
              )
            ),
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              scoreWidget,
              el('span', { 
                style: { 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  textTransform: 'uppercase', 
                  color: recoveryColor, 
                  backgroundColor: recoveryBg,
                  padding: '6px 12px',
                  borderRadius: 'var(--rounded-pill)',
                  border: `1px solid ${recoveryColor}33`
                } 
              }, `${recNeed} Recovery`)
            )
          )
        );

        const recommendationCard = el('div', { 
          style: { 
            background: 'rgba(255, 255, 255, 0.04)', 
            borderLeft: '4px solid var(--colors-accent-amber)', 
            padding: '12px 16px', 
            borderRadius: '0 var(--rounded-md) var(--rounded-md) 0',
            marginTop: '12px'
          } 
        },
          el('span', { style: { display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--colors-on-dark-soft)', fontWeight: '800', marginBottom: '4px' } }, "Actionable Recommendation"),
          el('p', { style: { fontSize: '14px', margin: '0', color: 'var(--colors-on-dark)', fontStyle: 'italic', lineHeight: '1.4' } }, day.aiReview.actionableRecommendation)
        );

        const winsList = (day.aiReview.wins || []).map(win => el('li', { style: { fontSize: '13.5px', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', listStyle: 'none', position: 'relative', paddingLeft: '16px' } }, 
          el('span', { style: { position: 'absolute', left: '0', color: '#81c784' } }, "✓"), 
          win
        ));
        const missesList = (day.aiReview.missedOpportunities || []).map(miss => el('li', { style: { fontSize: '13.5px', color: 'rgba(255,255,255,0.85)', marginBottom: '4px', listStyle: 'none', position: 'relative', paddingLeft: '16px' } }, 
          el('span', { style: { position: 'absolute', left: '0', color: '#e57373' } }, "•"), 
          miss
        ));

        const detailsGrid = el('div', { 
          style: { 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '16px', 
            marginTop: '16px', 
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '16px'
          } 
        },
          el('div', {},
            el('h4', { style: { color: '#81c784', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800', marginBottom: '8px' } }, "Wins"),
            el('ul', { style: { padding: '0', margin: '0' } }, ...winsList)
          ),
          el('div', {},
            el('h4', { style: { color: '#e57373', fontSize: '12px', textTransform: 'uppercase', fontWeight: '800', marginBottom: '8px' } }, "Missed Opportunities"),
            el('ul', { style: { padding: '0', margin: '0' } }, ...missesList)
          )
        );

        const prioritiesList = (day.aiReview.tomorrowPriorities || []).map((prio, idx) => el('li', { 
          style: { 
            fontSize: '13.5px', 
            color: 'var(--colors-on-dark-soft)', 
            marginBottom: '6px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          } 
        }, 
          el('span', { 
            style: { 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '18px', 
              height: '18px', 
              borderRadius: '50%', 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              fontSize: '10px', 
              fontWeight: 'bold', 
              color: 'var(--colors-accent-amber)' 
            } 
          }, idx + 1),
          el('span', {}, prio)
        ));

        const prioritiesBox = el('div', { 
          style: { 
            marginTop: '16px', 
            borderTop: '1px solid rgba(255,255,255,0.06)', 
            paddingTop: '16px' 
          } 
        },
          el('h4', { style: { color: 'var(--colors-on-dark)', fontSize: '13px', fontWeight: '700', marginBottom: '10px' } }, "Tomorrow's Top Priorities"),
          el('ul', { style: { padding: '0', margin: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' } }, ...prioritiesList)
        );

        const resetBtn = el('button', {
          class: 'btn btn-secondary',
          style: { alignSelf: 'flex-start', marginTop: '20px', background: 'transparent', color: 'var(--colors-on-dark)', borderColor: 'rgba(255,255,255,0.2)', height: '32px', fontSize: '12.5px' },
          onClick: () => {
            day.aiReview = null;
            queueSave();
            renderCoachAndTrendsSubView();
          }
        }, "Reset Insights");

        coachPanel.appendChild(recommendationCard);
        coachPanel.appendChild(detailsGrid);
        coachPanel.appendChild(prioritiesBox);
        coachPanel.appendChild(resetBtn);
      } else {
        const welcomeGraphic = el('div', { 
          style: { 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '24px 0 16px 0',
            gap: '12px'
          } 
        },
          elNS('svg', { 
            class: 'ai-orbit-graphic',
            width: '90', 
            height: '90', 
            viewBox: '0 0 120 120',
            style: { filter: 'drop-shadow(0 0 8px rgba(232, 165, 90, 0.15))', marginBottom: '4px' }
          },
            // Center glowing circle
            elNS('circle', { cx: '60', cy: '60', r: '7', fill: 'var(--colors-accent-amber)' }),
            // Outer concentric tracks
            elNS('circle', { cx: '60', cy: '60', r: '26', fill: 'none', stroke: 'rgba(255, 255, 255, 0.08)', 'stroke-width': '1.5' }),
            elNS('circle', { cx: '60', cy: '60', r: '42', fill: 'none', stroke: 'rgba(255, 255, 255, 0.05)', 'stroke-width': '1.5', 'stroke-dasharray': '15 10' }),
            elNS('circle', { cx: '60', cy: '60', r: '52', fill: 'none', stroke: 'rgba(255, 255, 255, 0.03)', 'stroke-width': '1', 'stroke-dasharray': '5 15' }),
            // Orbiting particles
            elNS('circle', { cx: '86', cy: '60', r: '4.5', fill: 'var(--colors-primary)' }),
            elNS('circle', { cx: '28', cy: '28', r: '3', fill: 'var(--colors-accent-amber)' })
          ),
          el('h3', { style: { color: 'var(--colors-on-dark)', marginBottom: '4px', fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' } }, "AI Lifestyle Command Center"),
          el('p', { style: { color: 'var(--colors-on-dark-soft)', marginBottom: '16px', fontSize: '13.5px', maxWidth: '340px', lineHeight: '1.4', textAlign: 'center' } },
            "Synthesize today's strength splits, step counts, and calories to generate an elite-level fitness performance review."
          ),
          loadBtn
        );
        coachPanel.appendChild(welcomeGraphic);
      }

      // 6. INTERACTIVE COACH CHAT SECTION
      const chatSection = el('div', { class: 'chat-section', style: { display: 'flex', flexDirection: 'column', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' } });
      
      const chatTitleRow = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
        el('h4', { style: { color: 'var(--colors-on-dark)', margin: '0', fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-display)' } }, "Interactive Health Coach Chat"),
        day.chatHistory && day.chatHistory.length > 0
          ? el('button', {
              class: 'btn btn-text',
              style: { color: 'rgba(255,255,255,0.4)', padding: '2px', fontSize: '11px', margin: '0' },
              onClick: () => {
                if (confirm("Clear chat conversation history for today?")) {
                  day.chatHistory = [];
                  queueSave();
                  renderCoachAndTrendsSubView();
                }
              }
            }, "Clear Chat")
          : null
      );
      chatSection.appendChild(chatTitleRow);

      const messagesBox = el('div', { 
        class: 'chat-messages-container', 
        style: { 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          maxHeight: '320px', 
          overflowY: 'auto', 
          padding: '4px 8px 12px 4px', 
          marginBottom: '12px',
          minHeight: '100px'
        } 
      });

      if (!day.chatHistory || day.chatHistory.length === 0) {
        messagesBox.appendChild(
          el('div', { style: { color: 'var(--colors-on-dark-soft)', fontStyle: 'italic', fontSize: '13px', textAlign: 'center', padding: '24px 12px' } },
            "Ask Coach Gemini anything about today's logs, weekly averages, step targets, or workout recovery."
          )
        );
      } else {
        day.chatHistory.forEach(msg => {
          const isUser = msg.role === 'user';
          const bubble = el('div', {
            style: {
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              gap: '8px',
              flexDirection: isUser ? 'row-reverse' : 'row',
              alignItems: 'flex-start'
            }
          },
            !isUser ? el('div', { class: 'chat-avatar-small', style: { width: '24px', height: '24px', borderRadius: '50%', background: 'var(--colors-accent-amber)', color: 'var(--colors-canvas-dark)', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0', marginTop: '2px' } }, "AI") : null,
            el('div', {
              style: {
                background: isUser ? 'rgba(232, 165, 90, 0.15)' : 'rgba(255,255,255,0.05)',
                border: isUser ? '1px solid rgba(232, 165, 90, 0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: 'var(--colors-on-dark)',
                padding: '8px 12px',
                borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                fontSize: '13.5px',
                lineHeight: '1.45',
                whiteSpace: 'pre-wrap'
              }
            }, msg.text)
          );
          messagesBox.appendChild(bubble);
        });
      }
      chatSection.appendChild(messagesBox);

      // Scroll to bottom helper
      setTimeout(() => {
        messagesBox.scrollTop = messagesBox.scrollHeight;
      }, 50);

      // Typing Bar
      const inputEl = el('input', {
        type: 'text',
        placeholder: 'Ask Coach Gemini...',
        class: 'form-control chat-input-field',
        style: {
          flex: '1',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--colors-on-dark)',
          borderRadius: 'var(--rounded-pill)',
          height: '36px',
          padding: '0 16px',
          fontSize: '13px'
        },
        onKeydown: (e) => {
          if (e.key === 'Enter') {
            sendBtn.click();
          }
        }
      });

      const sendBtn = el('button', {
        class: 'btn btn-primary chat-send-btn',
        style: {
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: '0'
        },
        onClick: async () => {
          const userText = inputEl.value.trim();
          if (!userText) return;

          inputEl.value = '';
          inputEl.disabled = true;
          sendBtn.disabled = true;

          // Add to chat history
          if (!day.chatHistory) day.chatHistory = [];
          day.chatHistory.push({ role: 'user', text: userText });
          queueSave();
          renderCoachAndTrendsSubView();

          // Render loading indicator inside chat
          const loadingBubble = el('div', {
            style: {
              alignSelf: 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              marginTop: '8px'
            }
          },
            el('div', { class: 'chat-avatar-small', style: { width: '24px', height: '24px', borderRadius: '50%', background: 'var(--colors-accent-amber)', color: 'var(--colors-canvas-dark)', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' } }, "AI"),
            el('span', { class: 'chat-typing-loader', style: { color: 'var(--colors-on-dark-soft)', fontSize: '12.5px', fontStyle: 'italic' } }, "Coach Gemini is thinking...")
          );
          messagesBox.appendChild(loadingBubble);
          messagesBox.scrollTop = messagesBox.scrollHeight;

          try {
            const reply = await gemini.sendCoachChatMessage(userText, day.chatHistory.slice(0, -1), day, trends);
            
            // Remove loader and update UI
            day.chatHistory.push({ role: 'model', text: reply });
            queueSave();
            renderCoachAndTrendsSubView();
          } catch (err) {
            console.error("Chat message error:", err);
            day.chatHistory.push({ role: 'model', text: "Error: Failed to fetch reply from coach." });
            queueSave();
            renderCoachAndTrendsSubView();
          }
        }
      }, icon(ICONS.sparkles));

      const inputRow = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        inputEl,
        sendBtn
      );
      chatSection.appendChild(inputRow);
      coachPanel.appendChild(chatSection);
    };

    renderCoachAndTrendsSubView();

    // Trends details grid
    const trendSign = trends.weightChange7d > 0 ? '+' : '';
    
    // Calculate weight status values
    const wChange = trends.weightChange7d || 0;
    let wLabel = "Stable";
    let wColor = "var(--colors-muted)";
    let wBg = "var(--colors-surface-soft)";
    
    if (wChange > 0.05) {
      wLabel = "Surplus";
      wColor = "var(--colors-accent-amber)";
      wBg = "rgba(232, 165, 90, 0.08)";
    } else if (wChange < -0.05) {
      wLabel = "Deficit";
      wColor = "var(--colors-primary)";
      wBg = "rgba(204, 120, 92, 0.08)";
    }
    
    const trendsWidget = el('div', { class: 'dashboard-right' },
      el('div', { class: 'page-header' },
        el('h4', {}, "7-Day Historical Averages")
      ),
      el('div', { class: 'trend-grid' },
        // Steps Tile (Target: stepGoal)
        el('div', { class: 'trend-tile', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          el('span', { class: 'trend-tile-label' }, "Avg Steps"),
          el('strong', { class: 'trend-tile-value' }, trends.avgSteps7d > 0 ? Math.round(trends.avgSteps7d).toLocaleString() : "-"),
          el('div', { style: { width: '100%', height: '4px', backgroundColor: 'var(--colors-surface-soft)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' } },
            el('div', { style: { width: `${Math.min(100, Math.round((trends.avgSteps7d / stepGoal) * 100))}%`, height: '100%', backgroundColor: 'var(--colors-primary)', borderRadius: '2px' } })
          ),
          el('span', { class: 'trend-tile-meta', style: { marginTop: '2px' } }, 
            trends.avgSteps7d > 0 ? `${Math.round((trends.avgSteps7d / stepGoal) * 100)}% of ${stepGoal >= 1000 ? `${(stepGoal/1000).toFixed(0)}k` : stepGoal} target` : "No steps logged"
          )
        ),
        // Sleep Tile (Target: Sleep Goal)
        el('div', { class: 'trend-tile', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          el('span', { class: 'trend-tile-label' }, "Avg Sleep"),
          el('strong', { class: 'trend-tile-value' }, trends.avgSleep7d > 0 ? `${trends.avgSleep7d.toFixed(1)}h` : "-"),
          el('div', { style: { width: '100%', height: '4px', backgroundColor: 'var(--colors-surface-soft)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' } },
            el('div', { style: { width: `${Math.min(100, Math.round((trends.avgSleep7d / (state.profile?.targetSleep || 8)) * 100))}%`, height: '100%', backgroundColor: 'var(--colors-accent-amber)', borderRadius: '2px' } })
          ),
          el('span', { class: 'trend-tile-meta', style: { marginTop: '2px' } }, 
            trends.avgSleep7d > 0 ? `${Math.round((trends.avgSleep7d / (state.profile?.targetSleep || 8)) * 100)}% of ${state.profile?.targetSleep || 8}h protocol` : "No sleep logged"
          )
        ),
        // Calories Tile (Target: calGoal)
        el('div', { class: 'trend-tile', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          el('span', { class: 'trend-tile-label' }, "Avg Intake"),
          el('strong', { class: 'trend-tile-value' }, trends.avgCalories7d > 0 ? `${Math.round(trends.avgCalories7d)} kcal` : "-"),
          el('div', { style: { width: '100%', height: '4px', backgroundColor: 'var(--colors-surface-soft)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' } },
            el('div', { style: { width: `${Math.min(100, Math.round((trends.avgCalories7d / calGoal) * 100))}%`, height: '100%', backgroundColor: 'var(--colors-accent-blue)', borderRadius: '2px' } })
          ),
          el('span', { class: 'trend-tile-meta', style: { marginTop: '2px' } }, 
            trends.avgCalories7d > 0 ? `${Math.round((trends.avgCalories7d / calGoal) * 100)}% of ${calGoal >= 1000 ? `${(calGoal/1000).toFixed(1).replace('.0', '')}k` : calGoal} target` : "No calories logged"
          )
        ),
        // Weight Tile (With custom badge)
        el('div', { class: 'trend-tile', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
          el('span', { class: 'trend-tile-label' }, "Weight Change"),
          el('strong', { class: 'trend-tile-value' }, wChange !== 0 ? `${trendSign}${wChange.toFixed(1)}kg` : "Stable"),
          el('div', { style: { marginTop: '6px' } },
            el('span', { 
              style: { 
                display: 'inline-flex', 
                fontSize: '10px', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                color: wColor, 
                backgroundColor: wBg, 
                padding: '2px 8px', 
                borderRadius: 'var(--rounded-pill)',
                border: `1px solid ${wColor}22`
              } 
            }, wLabel)
          ),
          el('span', { class: 'trend-tile-meta', style: { marginTop: '6px' } }, "7-day weight shift")
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
      const calGoal = state.profile?.targetCalories || 2000;
      const proteinGoal = state.profile?.targetProtein || 150;
      
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

      // AI Smart Meal Logger
      if (!state._aiMealText) state._aiMealText = '';
      if (state._aiMealLoading === undefined) state._aiMealLoading = false;
      if (!state._aiMealEstimate) state._aiMealEstimate = null;

      const aiLoggerCard = el('div', { class: 'form-card ai-smart-logger-card', style: { marginTop: '24px' } },
        el('h3', {}, "Smart Log with AI Coach"),
        el('p', { class: 'page-subtitle' }, "Type your meal details with quantities in grams (e.g. '150g grilled chicken, 150g jasmine rice') and the AI will estimate macros (kcal, protein, carbs, fat) and log it."),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' } },
          el('textarea', {
            class: 'form-control',
            placeholder: "Describe your meal (e.g., '3 boiled eggs, 2 slices whole wheat toast, 10g butter')...",
            style: { height: '80px', fontSize: '13.5px', resize: 'vertical' },
            value: state._aiMealText,
            onInput: (e) => { state._aiMealText = e.target.value; }
          }),
          el('button', {
            class: 'btn btn-primary',
            style: { width: 'fit-content', display: 'flex', alignItems: 'center', gap: '8px' },
            disabled: state._aiMealLoading,
            onClick: async (e) => {
              const text = state._aiMealText.trim();
              if (!text) {
                alert("Please describe your meal first.");
                return;
              }
              state._aiMealLoading = true;
              renderFitnessSubTab('nutrition');
              
              try {
                const result = await gemini.analyzeMeal(text);
                state._aiMealEstimate = result;
              } catch (err) {
                alert(`Analysis failed: ${err.message}`);
              } finally {
                state._aiMealLoading = false;
                renderFitnessSubTab('nutrition');
              }
            }
          }, state._aiMealLoading ? "Analyzing Macros..." : "Analyze Meal & Estimate")
        )
      );

      if (state._aiMealLoading) {
        aiLoggerCard.appendChild(
          el('div', { 
            style: { 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px', 
              padding: '16px', 
              marginTop: '16px', 
              background: 'var(--colors-canvas)',
              borderRadius: 'var(--rounded-md)',
              border: '1px dashed var(--colors-hairline)'
            } 
          },
            el('div', { class: 'ai-loading-pulse', style: { width: '12px', height: '12px', borderRadius: '50%', background: 'var(--colors-primary)', animation: 'pulse 1.5s infinite ease-in-out' } }),
            el('span', { style: { fontSize: '13px', color: 'var(--colors-muted)', fontWeight: '600' } }, "Coach is calculating nutritional breakdown...")
          )
        );
      } else if (state._aiMealEstimate) {
        const est = state._aiMealEstimate;
        
        const titleInput = el('input', { type: 'text', class: 'form-control', value: est.mealTitle, style: { height: '34px', fontSize: '13px' } });
        const calInput = el('input', { type: 'number', class: 'form-control', value: est.calories, style: { height: '34px', fontSize: '13px', textAlign: 'center' } });
        const protInput = el('input', { type: 'number', class: 'form-control', value: est.protein, style: { height: '34px', fontSize: '13px', textAlign: 'center' } });
        const carbsInput = el('input', { type: 'number', class: 'form-control', value: est.carbs || 0, style: { height: '34px', fontSize: '13px', textAlign: 'center' } });
        const fatInput = el('input', { type: 'number', class: 'form-control', value: est.fat || 0, style: { height: '34px', fontSize: '13px', textAlign: 'center' } });
        
        const saveToLibraryCheckbox = el('input', { type: 'checkbox', style: { cursor: 'pointer' } });
        
        const previewBlock = el('div', { 
          style: { 
            marginTop: '16px', 
            padding: '16px', 
            background: 'var(--colors-canvas)', 
            borderRadius: 'var(--rounded-md)', 
            border: '1px solid var(--colors-hairline-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          } 
        },
          el('h4', { style: { fontSize: '14px', fontWeight: '700', color: 'var(--colors-ink)', margin: '0' } }, "AI Macro Estimates"),
          el('p', { style: { fontSize: '12px', color: 'var(--colors-muted)', margin: '0', fontStyle: 'italic' } }, est.explanation),
          
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            el('span', { class: 'form-label', style: { fontSize: '11px' } }, "Meal Title"),
            titleInput
          ),
          
          el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' } },
            el('div', {}, 
              el('span', { class: 'form-label', style: { fontSize: '10px', textAlign: 'center', display: 'block' } }, "Kcal"),
              calInput
            ),
            el('div', {}, 
              el('span', { class: 'form-label', style: { fontSize: '10px', textAlign: 'center', display: 'block' } }, "Protein (g)"),
              protInput
            ),
            el('div', {}, 
              el('span', { class: 'form-label', style: { fontSize: '10px', textAlign: 'center', display: 'block' } }, "Carbs (g)"),
              carbsInput
            ),
            el('div', {}, 
              el('span', { class: 'form-label', style: { fontSize: '10px', textAlign: 'center', display: 'block' } }, "Fat (g)"),
              fatInput
            )
          ),
          
          el('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' } },
            saveToLibraryCheckbox,
            el('span', {}, "Save this custom recipe to Meal Library")
          ),
          
          el('div', { style: { display: 'flex', gap: '10px', marginTop: '8px' } },
            el('button', {
              class: 'btn btn-primary',
              style: { height: '34px', fontSize: '13px', padding: '0 16px' },
              onClick: () => {
                const finalTitle = titleInput.value.trim() || "AI Meal Log";
                const finalCal = parseInt(calInput.value) || 0;
                const finalProt = parseInt(protInput.value) || 0;
                const finalCarbs = parseInt(carbsInput.value) || 0;
                const finalFat = parseInt(fatInput.value) || 0;
                
                day.calories = (day.calories || 0) + finalCal;
                day.protein = (day.protein || 0) + finalProt;
                if (!day.meals) day.meals = [];
                day.meals.push({
                  title: finalTitle,
                  serving: '1 serving',
                  multiplier: 1,
                  calories: finalCal,
                  protein: finalProt,
                  carbs: finalCarbs,
                  fat: finalFat
                });
                
                if (saveToLibraryCheckbox.checked) {
                  state.recipes.push({
                    title: finalTitle,
                    calories: finalCal,
                    protein: finalProt,
                    carbs: finalCarbs,
                    fat: finalFat,
                    desc: est.explanation
                  });
                  saveLocalState();
                }
                
                state._aiMealText = '';
                state._aiMealEstimate = null;
                
                syncDailyProgress(day);
                queueSave();
                renderFitnessSubTab('nutrition');
              }
            }, "Confirm & Log"),
            el('button', {
              class: 'btn btn-secondary',
              style: { height: '34px', fontSize: '13px', padding: '0 16px', background: 'transparent' },
              onClick: () => {
                state._aiMealEstimate = null;
                renderFitnessSubTab('nutrition');
              }
            }, "Reset")
          )
        );
        aiLoggerCard.appendChild(previewBlock);
      }

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
                  el('span', { class: 'habit-title-text' }, `${m.title} (${m.calories} kcal · P: ${m.protein}g · C: ${m.carbs || 0}g · F: ${m.fat || 0}g)`)
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
            day.meals.push({ title: r.title, calories: r.calories, protein: r.protein, carbs: r.carbs || 0, fat: r.fat || 0 });
            day.calories = (day.calories || 0) + r.calories;
            day.protein = (day.protein || 0) + r.protein;
            queueSave();
            renderFitnessSubTab('nutrition');
          } },
            el('div', { class: 'habit-left-info' },
              el('span', {}, "🥗"),
              el('div', {},
                el('span', { class: 'habit-title-text', style: { display: 'block' } }, r.title),
                el('span', { style: { fontSize: '12px', color: 'var(--colors-muted)' } }, `${r.calories} kcal · P: ${r.protein}g · C: ${r.carbs || 0}g · F: ${r.fat || 0}g`)
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
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 80px' } },
            el('input', { type: 'number', class: 'form-control', placeholder: 'carbs (g)', id: 'new-recipe-carbs', style: { height: '34px', fontSize: '13px' } })
          ),
          el('div', { class: 'form-group', style: { flex: '1 1 80px' } },
            el('input', { type: 'number', class: 'form-control', placeholder: 'fat (g)', id: 'new-recipe-fat', style: { height: '34px', fontSize: '13px' } })
          )
        ),
        el('button', {
          class: 'btn btn-secondary',
          style: { height: '34px', fontSize: '13px', width: 'fit-content' },
          onClick: () => {
            const titleInput = document.getElementById('new-recipe-title');
            const calInput = document.getElementById('new-recipe-cal');
            const protInput = document.getElementById('new-recipe-prot');
            const carbsInput = document.getElementById('new-recipe-carbs');
            const fatInput = document.getElementById('new-recipe-fat');
            
            const title = titleInput ? titleInput.value.trim() : '';
            const calories = calInput ? parseInt(calInput.value) || 0 : 0;
            const protein = protInput ? parseInt(protInput.value) || 0 : 0;
            const carbs = carbsInput ? parseInt(carbsInput.value) || 0 : 0;
            const fat = fatInput ? parseInt(fatInput.value) || 0 : 0;
            
            if (title && calories > 0) {
              state.recipes.push({ title, calories, protein, carbs, fat });
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
      activeContent.appendChild(aiLoggerCard);
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
function getHabitStreak(habitId) {
  let streak = 0;
  let checkDate = new Date();
  
  const getFormatted = (d) => {
    return d.toISOString().split('T')[0];
  };

  const todayStr = getFormatted(checkDate);
  const todayLog = state.logs[todayStr] || {};
  const completedToday = (todayLog.habitsCompleted || []).includes(habitId);

  if (!completedToday) {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = getFormatted(checkDate);
    const yesterdayLog = state.logs[yesterdayStr] || {};
    const completedYesterday = (yesterdayLog.habitsCompleted || []).includes(habitId);
    if (!completedYesterday) {
      return 0;
    }
  }

  while (true) {
    const dateStr = getFormatted(checkDate);
    const log = state.logs[dateStr];
    if (log && (log.habitsCompleted || []).includes(habitId)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

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

  const habitsBox = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
  const headerContainer = el('div');

  const renderHabitsWelcomeAndStats = () => {
    headerContainer.replaceChildren();
    
    const habitsDone = (day.habitsCompleted || []).length;
    const habitsTotal = habitsList.length;
    const habitsPercent = habitsTotal ? Math.min(100, Math.round((habitsDone / habitsTotal) * 100)) : 0;
    
    let totalCompletions7d = 0;
    const todayObj = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayObj);
      d.setDate(todayObj.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const log = state.logs[dStr];
      if (log && log.habitsCompleted) {
        totalCompletions7d += log.habitsCompleted.length;
      }
    }
    
    let longestStreak = 0;
    habitsList.forEach(h => {
      longestStreak = Math.max(longestStreak, getHabitStreak(h.id));
    });

    const welcome = el('div', { class: 'form-card habits-welcome-card', style: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' } },
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        el('div', {},
          el('h3', { style: { fontSize: '20px', fontWeight: '700', margin: '0' } }, "Habit Progression"),
          el('p', { class: 'page-subtitle', style: { marginTop: '4px' } }, "Complete your checklist to build daily momentum.")
        ),
        el('div', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--colors-accent-amber)', background: 'rgba(226, 169, 96, 0.12)', padding: '4px 10px', borderRadius: 'var(--rounded-pill)' } }, 
          `Today: +${Math.round(habitsPercent * 0.2)}`
        )
      ),
      el('div', {},
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '6px' } },
          el('span', { style: { fontWeight: '600' } }, "Completions Checklist"),
          el('strong', {}, `${habitsDone} / ${habitsTotal} Done (${habitsPercent}%)`)
        ),
        el('div', { class: 'macro-progress-bg' },
          el('div', { class: 'macro-progress-fg habits', style: { width: `${habitsPercent}%` } })
        )
      )
    );

    const stats = el('div', { class: 'trend-tiles-row', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' } },
      el('div', { class: 'trend-tile', style: { margin: '0' } },
        el('span', { class: 'trend-tile-label' }, "7d Completions"),
        el('strong', { class: 'trend-tile-value' }, totalCompletions7d),
        el('span', { class: 'trend-tile-meta' }, "Habits done last 7 days")
      ),
      el('div', { class: 'trend-tile', style: { margin: '0' } },
        el('span', { class: 'trend-tile-label' }, "Longest Streak"),
        el('strong', { class: 'trend-tile-value' }, longestStreak > 0 ? `${longestStreak}d` : "0d"),
        el('span', { class: 'trend-tile-meta' }, "🔥 Max consecutive days")
      )
    );

    headerContainer.appendChild(welcome);
    headerContainer.appendChild(stats);
  };

  const renderHabitsCategorized = () => {
    habitsBox.replaceChildren();
    
    if (habitsList.length === 0) {
      habitsBox.appendChild(
        el('div', { style: { textAlign: 'center', padding: '40px', background: 'var(--colors-surface-card)', borderRadius: 'var(--rounded-xl)', border: '1px dashed var(--colors-muted-soft)' } },
          el('p', { style: { color: 'var(--colors-muted)', fontStyle: 'italic' } }, 
            "No habits defined. Go to Settings to configure your daily habits checklist."
          )
        )
      );
      return;
    }

    Object.keys(categories).forEach(cat => {
      const categoryCard = el('div', { class: 'habits-category-card', style: { marginBottom: '16px' } });
      
      categoryCard.appendChild(
        el('h4', { class: 'habits-category-header' }, cat)
      );

      const listContainer = el('div', { class: 'habits-category-list' });
      
      categories[cat].forEach(h => {
        const isCompleted = (day.habitsCompleted || []).includes(h.id);
        const streak = getHabitStreak(h.id);

        const checkbox = el('div', { class: 'habit-checkbox' }, icon(ICONS.check));
        
        const row = el('div', {
          class: `habit-list-row ${isCompleted ? 'completed' : ''}`,
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
            renderHabitsWelcomeAndStats();
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

        listContainer.appendChild(row);
      });

      categoryCard.appendChild(listContainer);
      habitsBox.appendChild(categoryCard);
    });
  };

  renderHabitsWelcomeAndStats();
  renderHabitsCategorized();
  
  container.appendChild(headerContainer);
  container.appendChild(habitsBox);
  habitsWrapper.appendChild(container);
  return habitsWrapper;
}

// --- VIEW: MEDIA VAULT (REDESIGNED BOOK PROGRESS & MOVIE CARD RATING) ---
// --- VIEW: EDIT BOOK MODAL (BOTTOM SHEET) ---
function openEditBookModal(b, onSave) {
  showBottomSheet('Edit Book Details', (body, dismiss) => {
    const percent = Math.min(100, Math.round((b.pagesRead / b.totalPages) * 100));

    // Show nice details header on top
    body.appendChild(el('div', { 
      style: { 
        padding: '16px', 
        marginBottom: '20px', 
        backgroundColor: 'var(--colors-canvas)', 
        borderRadius: 'var(--rounded-lg)',
        border: '1px solid var(--colors-hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      } 
    },
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        el('span', { 
          style: { 
            fontSize: '10px', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            padding: '4px 8px', 
            borderRadius: 'var(--rounded-pill)',
            backgroundColor: 'rgba(180, 120, 20, 0.08)',
            color: '#9c6518',
            border: '1px solid rgba(180, 120, 20, 0.2)'
          } 
        }, b.status),
        el('span', { style: { fontSize: '12.5px', color: 'var(--colors-muted)', fontWeight: '600' } }, `${percent}% Complete`)
      ),
      el('h2', { style: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '800', margin: '0', color: 'var(--colors-ink)', lineHeight: '1.25' } }, b.title),
      el('span', { style: { fontSize: '14px', color: 'var(--colors-body)', fontStyle: 'italic' } }, `by ${b.author}`),
      
      // Progress Bar
      el('div', { style: { marginTop: '8px' } },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', fontWeight: '600', color: 'var(--colors-ink)' } },
          el('span', {}, "Reading Progression"),
          el('strong', {}, `${b.pagesRead} of ${b.totalPages} pages`)
        ),
        el('div', { class: 'macro-progress-bg' },
          el('div', { class: 'macro-progress-fg', style: { width: `${percent}%`, backgroundColor: 'var(--colors-accent-blue)' } })
        )
      )
    ));

    body.appendChild(el('div', { class: 'form-group', style: { marginBottom: '12px' } },
      el('span', { class: 'form-label' }, "Book Title"),
      el('input', { type: 'text', class: 'form-control', value: b.title, id: 'edit-book-title' })
    ));
    body.appendChild(el('div', { class: 'form-group', style: { marginBottom: '12px' } },
      el('span', { class: 'form-label' }, "Author"),
      el('input', { type: 'text', class: 'form-control', value: b.author, id: 'edit-book-author' })
    ));
    body.appendChild(el('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px' } },
      el('div', { class: 'form-group', style: { flex: '1' } },
        el('span', { class: 'form-label' }, "Pages Read"),
        el('input', { type: 'number', class: 'form-control', value: b.pagesRead, id: 'edit-book-read' })
      ),
      el('div', { class: 'form-group', style: { flex: '1' } },
        el('span', { class: 'form-label' }, "Total Pages"),
        el('input', { type: 'number', class: 'form-control', value: b.totalPages, id: 'edit-book-total' })
      )
    ));
    body.appendChild(el('div', { class: 'form-group', style: { marginBottom: '20px' } },
      el('span', { class: 'form-label' }, "Reading Status"),
      el('select', { class: 'form-control', id: 'edit-book-status' },
        el('option', { value: 'reading', selected: b.status === 'reading' }, "Reading"),
        el('option', { value: 'completed', selected: b.status === 'completed' }, "Completed")
      )
    ));

    const actions = el('div', { style: { display: 'flex', gap: '12px' } });
    
    const saveBtn = el('button', {
      class: 'btn btn-primary',
      style: { flex: '2' },
      onClick: () => {
        const title = document.getElementById('edit-book-title').value.trim();
        const author = document.getElementById('edit-book-author').value.trim();
        const read = parseInt(document.getElementById('edit-book-read').value) || 0;
        const total = parseInt(document.getElementById('edit-book-total').value) || 100;
        const status = document.getElementById('edit-book-status').value;

        if (title) {
          b.title = title;
          b.author = author;
          b.pagesRead = Math.min(total, read);
          b.totalPages = total;
          b.status = b.pagesRead === total ? 'completed' : status;
          queueSave();
          onSave();
          dismiss();
        }
      }
    }, 'Save Changes');

    const deleteBtn = el('button', {
      class: 'btn btn-accent',
      style: { flex: '1', backgroundColor: 'var(--colors-error)' },
      onClick: () => {
        if (confirm(`Remove "${b.title}" from your library?`)) {
          const idx = state.books.indexOf(b);
          if (idx !== -1) state.books.splice(idx, 1);
          queueSave();
          onSave();
          dismiss();
        }
      }
    }, 'Delete');

    actions.appendChild(saveBtn);
    actions.appendChild(deleteBtn);
    body.appendChild(actions);
  });
}

// --- VIEW: EDIT MOVIE MODAL (BOTTOM SHEET) ---
function openEditMovieModal(m, onSave) {
  showBottomSheet('Edit Movie Log', (body, dismiss) => {
    let stars = '';
    for (let i = 0; i < m.rating; i++) stars += '★';
    for (let i = m.rating; i < 5; i++) stars += '☆';

    // Details block on top
    body.appendChild(el('div', { 
      style: { 
        padding: '16px', 
        marginBottom: '20px', 
        backgroundColor: 'var(--colors-canvas)', 
        borderRadius: 'var(--rounded-lg)',
        border: '1px solid var(--colors-hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      } 
    },
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        el('span', { 
          style: { 
            fontSize: '10px', 
            fontWeight: '800', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            padding: '4px 8px', 
            borderRadius: 'var(--rounded-pill)',
            backgroundColor: 'rgba(180, 120, 20, 0.08)',
            color: '#9c6518',
            border: '1px solid rgba(180, 120, 20, 0.2)'
          } 
        }, m.status || 'watched'),
        el('span', { style: { fontSize: '14px', color: 'var(--colors-accent-amber)' } }, stars)
      ),
      el('h2', { style: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '800', margin: '0', color: 'var(--colors-ink)', lineHeight: '1.25' } }, m.title),
      el('span', { style: { fontSize: '13.5px', color: 'var(--colors-muted)' } }, `Released in ${m.year}`),
      
      el('div', { style: { marginTop: '8px', borderLeft: '3px solid var(--colors-accent-amber)', paddingLeft: '10px' } },
        el('span', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--colors-muted)', display: 'block', marginBottom: '2px', fontWeight: '700' } }, "Your Review"),
        el('p', { style: { fontSize: '14px', fontStyle: 'italic', color: 'var(--colors-body)', margin: '0', lineHeight: '1.4' } }, m.review || 'No review logged.')
      )
    ));

    body.appendChild(el('div', { class: 'form-group', style: { marginBottom: '12px' } },
      el('span', { class: 'form-label' }, "Movie Title"),
      el('input', { type: 'text', class: 'form-control', value: m.title, id: 'edit-movie-title' })
    ));
    body.appendChild(el('div', { style: { display: 'flex', gap: '12px', marginBottom: '12px' } },
      el('div', { class: 'form-group', style: { flex: '1' } },
        el('span', { class: 'form-label' }, "Release Year"),
        el('input', { type: 'number', class: 'form-control', value: m.year, id: 'edit-movie-year' })
      ),
      el('div', { class: 'form-group', style: { flex: '1' } },
        el('span', { class: 'form-label' }, "Rating"),
        el('select', { class: 'form-control', id: 'edit-movie-rating' },
          [1, 2, 3, 4, 5].map(r => el('option', { value: r, selected: m.rating === r }, `${r} Star${r > 1 ? 's' : ''}`))
        )
      )
    ));
    body.appendChild(el('div', { class: 'form-group', style: { marginBottom: '20px' } },
      el('span', { class: 'form-label' }, "Review / Notes"),
      el('textarea', { class: 'form-control', id: 'edit-movie-review', style: { height: '80px' } }, m.review)
    ));

    const actions = el('div', { style: { display: 'flex', gap: '12px' } });
    
    const saveBtn = el('button', {
      class: 'btn btn-primary',
      style: { flex: '2' },
      onClick: () => {
        const title = document.getElementById('edit-movie-title').value.trim();
        const year = parseInt(document.getElementById('edit-movie-year').value) || 2026;
        const rating = parseInt(document.getElementById('edit-movie-rating').value) || 5;
        const review = document.getElementById('edit-movie-review').value.trim();

        if (title) {
          m.title = title;
          m.year = year;
          m.rating = rating;
          m.review = review || 'No review logged.';
          queueSave();
          onSave();
          dismiss();
        }
      }
    }, 'Save Changes');

    const deleteBtn = el('button', {
      class: 'btn btn-accent',
      style: { flex: '1', backgroundColor: 'var(--colors-error)' },
      onClick: () => {
        if (confirm(`Delete log for "${m.title}"?`)) {
          const idx = state.movies.indexOf(m);
          if (idx !== -1) state.movies.splice(idx, 1);
          queueSave();
          onSave();
          dismiss();
        }
      }
    }, 'Delete');

    actions.appendChild(saveBtn);
    actions.appendChild(deleteBtn);
    body.appendChild(actions);
  });
}

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
        bookGrid.appendChild(
          el('div', { 
            class: 'vault-item-card', 
            style: { 
              padding: '16px 20px', 
              display: 'flex', 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              gap: '20px', 
              cursor: 'pointer' 
            },
            onClick: () => {
              openEditBookModal(b, () => renderMediaSubView('books'));
            }
          },
            el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', paddingRight: '12px' } },
              el('h3', { style: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', margin: '0', color: 'var(--colors-ink)', lineHeight: '1.25' } }, b.title),
              el('span', { style: { fontSize: '13.5px', color: 'var(--colors-muted)' } }, `by ${b.author}`)
            ),
            el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: '0' } },
              el('span', { 
                style: { 
                  fontSize: '10px', 
                  fontWeight: '800', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em',
                  padding: '6px 12px', 
                  borderRadius: 'var(--rounded-pill)',
                  backgroundColor: 'rgba(180, 120, 20, 0.08)',
                  color: '#9c6518',
                  border: '1px solid rgba(180, 120, 20, 0.2)',
                  display: 'inline-block'
                } 
              }, b.status),
              b.status !== 'completed' 
                ? el('span', { style: { fontSize: '12.5px', color: 'var(--colors-muted)', fontWeight: '600' } }, `${b.pagesRead} / ${b.totalPages}`)
                : null
            )
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
        movieGrid.appendChild(
          el('div', { 
            class: 'vault-item-card', 
            style: { 
              padding: '16px 20px', 
              display: 'flex', 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              gap: '20px', 
              cursor: 'pointer' 
            },
            onClick: () => {
              openEditMovieModal(m, () => renderMediaSubView('movies'));
            }
          },
            el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', paddingRight: '12px' } },
              el('h3', { style: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', margin: '0', color: 'var(--colors-ink)', lineHeight: '1.25' } }, m.title),
              el('span', { style: { fontSize: '13.5px', color: 'var(--colors-muted)' } }, `Released in ${m.year}`)
            ),
            el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: '0' } },
              el('span', { 
                style: { 
                  fontSize: '10px', 
                  fontWeight: '800', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em',
                  padding: '6px 12px', 
                  borderRadius: 'var(--rounded-pill)',
                  backgroundColor: 'rgba(180, 120, 20, 0.08)',
                  color: '#9c6518',
                  border: '1px solid rgba(180, 120, 20, 0.2)',
                  display: 'inline-block'
                } 
              }, m.status || 'watched')
            )
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

  const subTabs = el('div', { class: 'segmented-control', style: { marginBottom: '24px' } });
  const settingsContent = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px' } });
  
  const renderSettingsSubView = (tab) => {
    activeSettingsTab = tab;
    settingsContent.replaceChildren();

    subTabs.replaceChildren(
      el('button', { 
        class: `segmented-btn ${tab === 'profile' ? 'active' : ''}`, 
        onClick: () => renderSettingsSubView('profile') 
      }, "User Profile"),
      el('button', { 
        class: `segmented-btn ${tab === 'templates' ? 'active' : ''}`, 
        onClick: () => renderSettingsSubView('templates') 
      }, "Routines & Habits"),
      el('button', { 
        class: `segmented-btn ${tab === 'system' ? 'active' : ''}`, 
        onClick: () => renderSettingsSubView('system') 
      }, "System Hub")
    );

    if (tab === 'profile') {
      const profile = state.profile || {
        goal: 'maintain',
        gender: 'male',
        age: 30,
        height: 175,
        weight: 70,
        goalWeight: 70,
        activityLevel: 'moderate',
        targetCalories: 2000,
        targetProtein: 140,
        targetWater: 8,
        targetSteps: 10000,
        targetSleep: 8
      };

      const profileCard = el('div', { class: 'form-card' },
        el('h3', {}, "User Profile Parameters"),
        el('p', { class: 'page-subtitle', style: { marginBottom: '16px' } }, "Configure your biometrics and daily targets. Daily scores, progress bars, and calendar ticks adapt to these metrics.")
      );

      const grid1 = el('div', { class: 'onboarding-field-row' },
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Primary Goal"),
          el('select', {
            class: 'onboarding-select',
            id: 'settings-profile-goal',
            onChange: (e) => {
              const goalVal = e.target.value;
              const weightVal = parseFloat(document.getElementById('settings-profile-weight').value) || profile.weight;
              const heightVal = parseFloat(document.getElementById('settings-profile-height').value) || profile.height;
              const ageVal = parseInt(document.getElementById('settings-profile-age').value) || profile.age;
              const genderVal = document.getElementById('settings-profile-gender').value || profile.gender;
              const activityVal = document.getElementById('settings-profile-activity').value || profile.activityLevel;
              
              const calculated = recalcProfileTargets(goalVal, weightVal, heightVal, ageVal, genderVal, activityVal);
              document.getElementById('settings-profile-calories').value = calculated.calories;
              document.getElementById('settings-profile-protein').value = calculated.protein;
            }
          },
            el('option', { value: 'lose', selected: profile.goal === 'lose' }, "Lose Body Fat"),
            el('option', { value: 'maintain', selected: profile.goal === 'maintain' }, "Maintain Weight"),
            el('option', { value: 'build', selected: profile.goal === 'build' }, "Build Muscle & Strength"),
            el('option', { value: 'wellness', selected: profile.goal === 'wellness' }, "General Wellness")
          )
        ),
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Biological Gender"),
          el('select', {
            class: 'onboarding-select',
            id: 'settings-profile-gender'
          },
            el('option', { value: 'male', selected: profile.gender === 'male' }, "Male"),
            el('option', { value: 'female', selected: profile.gender === 'female' }, "Female"),
            el('option', { value: 'other', selected: profile.gender === 'other' }, "Other / Neutral")
          )
        )
      );

      const grid2 = el('div', { class: 'onboarding-field-row' },
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Age (Years)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-age',
            value: profile.age
          })
        ),
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Height (cm)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-height',
            value: profile.height
          })
        )
      );

      const grid3 = el('div', { class: 'onboarding-field-row' },
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Current Weight (kg)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-weight',
            value: profile.weight,
            step: '0.1'
          })
        ),
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Goal Weight (kg)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-goal-weight',
            value: profile.goalWeight,
            step: '0.1'
          })
        )
      );

      const grid4 = el('div', { class: 'onboarding-field-row' },
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Lifestyle Activity"),
          el('select', {
            class: 'onboarding-select',
            id: 'settings-profile-activity',
            onChange: (e) => {
              const activityVal = e.target.value;
              const goalVal = document.getElementById('settings-profile-goal').value || profile.goal;
              const weightVal = parseFloat(document.getElementById('settings-profile-weight').value) || profile.weight;
              const heightVal = parseFloat(document.getElementById('settings-profile-height').value) || profile.height;
              const ageVal = parseInt(document.getElementById('settings-profile-age').value) || profile.age;
              const genderVal = document.getElementById('settings-profile-gender').value || profile.gender;
              
              const calculated = recalcProfileTargets(goalVal, weightVal, heightVal, ageVal, genderVal, activityVal);
              document.getElementById('settings-profile-calories').value = calculated.calories;
              document.getElementById('settings-profile-protein').value = calculated.protein;
            }
          },
            el('option', { value: 'sedentary', selected: profile.activityLevel === 'sedentary' }, "Sedentary (No exercise)"),
            el('option', { value: 'light', selected: profile.activityLevel === 'light' }, "Lightly Active (1-3 days/wk)"),
            el('option', { value: 'moderate', selected: profile.activityLevel === 'moderate' }, "Moderately Active (3-5 days/wk)"),
            el('option', { value: 'active', selected: profile.activityLevel === 'active' }, "Very Active (6-7 days/wk)")
          )
        )
      );

      const gridTargets = el('div', { class: 'onboarding-field-row', style: { borderTop: '1px dashed var(--colors-hairline)', paddingTop: '16px', marginTop: '16px' } },
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Calorie Goal (kcal)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-calories',
            value: profile.targetCalories
          })
        ),
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Protein Goal (g)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-protein',
            value: profile.targetProtein
          })
        )
      );

      const gridTargets2 = el('div', { class: 'onboarding-field-row' },
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Water Goal (cups)"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-water',
            value: profile.targetWater
          })
        ),
        el('div', { class: 'onboarding-field' },
          el('label', {}, "Steps Goal"),
          el('input', {
            type: 'number',
            class: 'onboarding-input',
            id: 'settings-profile-steps',
            value: profile.targetSteps
          })
        )
      );

      const saveBtn = el('button', {
        class: 'btn btn-primary',
        style: { width: 'fit-content', marginTop: '16px' },
        onClick: () => {
          const goal = document.getElementById('settings-profile-goal').value;
          const gender = document.getElementById('settings-profile-gender').value;
          const age = parseInt(document.getElementById('settings-profile-age').value) || profile.age;
          const height = parseFloat(document.getElementById('settings-profile-height').value) || profile.height;
          const weight = parseFloat(document.getElementById('settings-profile-weight').value) || profile.weight;
          const goalWeight = parseFloat(document.getElementById('settings-profile-goal-weight').value) || profile.goalWeight;
          const activityLevel = document.getElementById('settings-profile-activity').value;
          const targetCalories = parseInt(document.getElementById('settings-profile-calories').value) || profile.targetCalories;
          const targetProtein = parseInt(document.getElementById('settings-profile-protein').value) || profile.targetProtein;
          const targetWater = parseInt(document.getElementById('settings-profile-water').value) || profile.targetWater;
          const targetSteps = parseInt(document.getElementById('settings-profile-steps').value) || profile.targetSteps;

          state.profile = {
            goal, gender, age, height, weight, goalWeight, activityLevel,
            targetCalories, targetProtein, targetWater, targetSteps,
            targetSleep: profile.targetSleep || 8,
            completedOnboarding: true
          };

          const todayLog = getTodayLog();
          if (todayLog) {
            todayLog.weight = weight;
          }

          saveLocalState();
          if (state.user && firebase.db) {
            saveUserPreferences();
          }

          alert("User Profile successfully saved.");
          renderApp();
        }
      }, icon(ICONS.check), "Save Profile Parameters");

      profileCard.appendChild(grid1);
      profileCard.appendChild(grid2);
      profileCard.appendChild(grid3);
      profileCard.appendChild(grid4);
      profileCard.appendChild(gridTargets);
      profileCard.appendChild(gridTargets2);
      profileCard.appendChild(saveBtn);
      settingsContent.appendChild(profileCard);
      
    } else if (tab === 'templates') {
      // 1. WORKOUT SPLITS TEMPLATES
      const splitsCard = el('div', { class: 'form-card splits-configurator-card' },
        el('h3', {}, "Workout Splits Templates"),
        el('p', { class: 'page-subtitle' }, "Customize your routine templates. These default values populate when you load a split in the fitness tracker.")
      );

      Object.keys(state.workoutSplit).forEach(splitName => {
        const splitWrapper = el('div', { 
          class: 'settings-split-wrapper', 
          style: { borderBottom: '1px solid var(--colors-hairline)', paddingBottom: '16px', marginBottom: '16px' } 
        },
          el('h4', { style: { color: 'var(--colors-ink)', fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', marginBottom: '12px' } }, `${splitName} Routine`)
        );

        const exercisesContainer = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

        state.workoutSplit[splitName].forEach((ex, exIdx) => {
          const row = el('div', { 
            class: 'settings-split-row', 
            style: { 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '12px', 
              flexWrap: 'wrap', 
              marginBottom: '4px',
              padding: '8px 12px',
              backgroundColor: 'var(--colors-canvas)',
              borderRadius: 'var(--rounded-md)',
              border: '1px solid var(--colors-hairline-soft)'
            } 
          },
            el('span', { style: { fontWeight: '700', flex: '1 1 120px', fontSize: '13.5px', color: 'var(--colors-ink)' } }, ex.name),
            el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } },
              el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
                el('span', { style: { fontSize: '11px', color: 'var(--colors-muted)', textTransform: 'uppercase', fontWeight: '700' } }, "Sets"),
                el('input', {
                  type: 'number',
                  class: 'form-control',
                  style: { width: '42px', padding: '2px 4px', textAlign: 'center', height: '24px', fontSize: '12.5px' },
                  value: ex.sets,
                  onInput: (e) => {
                    ex.sets = parseInt(e.target.value) || 0;
                    saveLocalState();
                  }
                })
              ),
              el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
                el('span', { style: { fontSize: '11px', color: 'var(--colors-muted)', textTransform: 'uppercase', fontWeight: '700' } }, "Reps"),
                el('input', {
                  type: 'number',
                  class: 'form-control',
                  style: { width: '42px', padding: '2px 4px', textAlign: 'center', height: '24px', fontSize: '12.5px' },
                  value: ex.reps,
                  onInput: (e) => {
                    ex.reps = parseInt(e.target.value) || 0;
                    saveLocalState();
                  }
                })
              ),
              el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
                el('span', { style: { fontSize: '11px', color: 'var(--colors-muted)', textTransform: 'uppercase', fontWeight: '700' } }, "Wt"),
                el('input', {
                  type: 'number',
                  class: 'form-control',
                  style: { width: '50px', padding: '2px 4px', textAlign: 'center', height: '24px', fontSize: '12.5px' },
                  value: ex.weight,
                  onInput: (e) => {
                    ex.weight = parseFloat(e.target.value) || 0;
                    saveLocalState();
                  }
                }),
                el('span', { style: { fontSize: '11.5px', color: 'var(--colors-muted)' } }, "kg")
              )
            ),
            el('button', {
              class: 'btn btn-text',
              style: { color: 'var(--colors-error)', padding: '4px', margin: '0' },
              onClick: () => {
                state.workoutSplit[splitName].splice(exIdx, 1);
                saveLocalState();
                renderApp();
              }
            }, icon(ICONS.trash))
          );
          exercisesContainer.appendChild(row);
        });

        const addRow = el('div', { style: { display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' } },
          el('input', {
            type: 'text',
            placeholder: 'Add new exercise name...',
            class: 'form-control',
            style: { flex: '1', height: '32px', fontSize: '13px' },
            id: `add-ex-name-${splitName.replace(/\s+/g, '-')}`
          }),
          el('button', {
            class: 'btn btn-primary',
            style: { padding: '4px 16px', fontSize: '12.5px', height: '32px' },
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

      // 2. DAILY HABITS MANAGER
      const habitsList = getHabitDefinitions();
      const habitsCard = el('div', { class: 'form-card splits-configurator-card', style: { marginTop: '24px' } },
        el('h3', {}, "Daily Habits Checklist Definitions"),
        el('p', { class: 'page-subtitle' }, "Configure custom habits definitions. Custom checklist items immediately show up in your trackers.")
      );

      const habitsListContainer = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
      const categories = { Mind: [], Fitness: [], Health: [], Nutrition: [] };
      habitsList.forEach((h, hIdx) => {
        if (categories[h.category]) {
          categories[h.category].push({ habit: h, realIndex: hIdx });
        }
      });

      Object.keys(categories).forEach(cat => {
        const listForCat = categories[cat];
        if (listForCat.length > 0) {
          const catBox = el('div', { 
            style: { 
              padding: '12px 16px', 
              backgroundColor: 'var(--colors-canvas)', 
              borderRadius: 'var(--rounded-lg)', 
              border: '1px solid var(--colors-hairline-soft)' 
            } 
          });
          catBox.appendChild(el('h4', { 
            style: { 
              margin: '0 0 8px 0', 
              fontSize: '11px', 
              fontWeight: '800', 
              textTransform: 'uppercase', 
              letterSpacing: '0.06em', 
              color: '#9c6518'
            } 
          }, cat));
          
          const listRows = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
          listForCat.forEach(({ habit, realIndex }) => {
            const row = el('div', { 
              style: { 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '6px 0', 
                borderBottom: '1px solid rgba(0,0,0,0.03)' 
              } 
            },
              el('span', { style: { fontWeight: '600', fontSize: '13.5px', color: 'var(--colors-ink)' } }, habit.title),
              el('button', {
                class: 'btn btn-text',
                style: { color: 'var(--colors-error)', padding: '2px' },
                onClick: () => {
                  habitsList.splice(realIndex, 1);
                  saveHabitDefinitions(habitsList);
                  saveLocalState();
                  renderApp();
                }
              }, icon(ICONS.trash))
            );
            listRows.appendChild(row);
          });
          catBox.appendChild(listRows);
          habitsListContainer.appendChild(catBox);
        }
      });

      const addHabitRow = el('div', { style: { display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center', flexWrap: 'wrap' } },
        el('input', {
          type: 'text',
          placeholder: 'New habit title (e.g. Read 15 mins)...',
          class: 'form-control',
          style: { flex: '2 1 200px', height: '32px', fontSize: '13px' },
          id: 'settings-new-habit-title'
        }),
        el('select', {
          class: 'form-control',
          style: { flex: '1 1 100px', height: '32px', fontSize: '13px', padding: '0 4px' },
          id: 'settings-new-habit-cat'
        },
          el('option', { value: 'Mind' }, "Mind"),
          el('option', { value: 'Fitness' }, "Fitness"),
          el('option', { value: 'Health' }, "Health"),
          el('option', { value: 'Nutrition' }, "Nutrition")
        ),
        el('button', {
          class: 'btn btn-primary',
          style: { padding: '4px 16px', fontSize: '12.5px', height: '32px' },
          onClick: () => {
            const titleInput = document.getElementById('settings-new-habit-title');
            const catSelect = document.getElementById('settings-new-habit-cat');
            const title = titleInput ? titleInput.value.trim() : '';
            const cat = catSelect ? catSelect.value : 'Mind';
            
            if (title) {
              const newId = `h-${Date.now()}`;
              habitsList.push({ id: newId, title, category: cat });
              saveHabitDefinitions(habitsList);
              saveLocalState();
              renderApp();
            }
          }
        }, "Add")
      );

      habitsCard.appendChild(habitsListContainer);
      habitsCard.appendChild(addHabitRow);

      settingsContent.appendChild(splitsCard);
      settingsContent.appendChild(habitsCard);

    } else if (tab === 'system') {
      // Diagnostics tiles
      const habitsList = getHabitDefinitions();
      
      const diagnosticsGrid = el('div', { 
        style: { 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '12px', 
          marginBottom: '20px' 
        } 
      },
        el('div', { class: 'trend-tile', style: { margin: '0', padding: '12px' } },
          el('span', { class: 'trend-tile-label', style: { fontSize: '11px' } }, "Daily Logs"),
          el('strong', { class: 'trend-tile-value', style: { fontSize: '18px' } }, Object.keys(state.logs).length),
          el('span', { class: 'trend-tile-meta', style: { fontSize: '10px' } }, "tracked history")
        ),
        el('div', { class: 'trend-tile', style: { margin: '0', padding: '12px' } },
          el('span', { class: 'trend-tile-label', style: { fontSize: '11px' } }, "Habits Checklist"),
          el('strong', { class: 'trend-tile-value', style: { fontSize: '18px' } }, habitsList.length),
          el('span', { class: 'trend-tile-meta', style: { fontSize: '10px' } }, "daily checklist items")
        ),
        el('div', { class: 'trend-tile', style: { margin: '0', padding: '12px' } },
          el('span', { class: 'trend-tile-label', style: { fontSize: '11px' } }, "Routines Templates"),
          el('strong', { class: 'trend-tile-value', style: { fontSize: '18px' } }, Object.keys(state.workoutSplit).length),
          el('span', { class: 'trend-tile-meta', style: { fontSize: '10px' } }, "splits routines templates")
        ),
        el('div', { class: 'trend-tile', style: { margin: '0', padding: '12px' } },
          el('span', { class: 'trend-tile-label', style: { fontSize: '11px' } }, "Recipes Library"),
          el('strong', { class: 'trend-tile-value', style: { fontSize: '18px' } }, state.recipes.length),
          el('span', { class: 'trend-tile-meta', style: { fontSize: '10px' } }, "saved food recipes")
        ),
        el('div', { class: 'trend-tile', style: { margin: '0', padding: '12px' } },
          el('span', { class: 'trend-tile-label', style: { fontSize: '11px' } }, "Library Books"),
          el('strong', { class: 'trend-tile-value', style: { fontSize: '18px' } }, state.books.length),
          el('span', { class: 'trend-tile-meta', style: { fontSize: '10px' } }, "books shelf count")
        ),
        el('div', { class: 'trend-tile', style: { margin: '0', padding: '12px' } },
          el('span', { class: 'trend-tile-label', style: { fontSize: '11px' } }, "Logged Movies"),
          el('strong', { class: 'trend-tile-value', style: { fontSize: '18px' } }, state.movies.length),
          el('span', { class: 'trend-tile-meta', style: { fontSize: '10px' } }, "movies logs count")
        )
      );

      // 1. AUTHENTICATION CARD
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

      // 3. GEMINI CARD
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

      // 4. AI COACH SETTINGS CARD
      const currentPersonality = localStorage.getItem('lt_coach_personality') || 'elite';
      const coachSettingsCard = el('div', { class: 'form-card', style: { marginTop: '24px' } },
        el('h3', {}, "AI Coach Personality Settings"),
        el('p', { class: 'page-subtitle' }, "Configure the feedback style and tone of Coach Gemini to align with your personal habits and fitness philosophy."),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' } },
          el('div', { class: 'personality-chips-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' } },
            [
              { id: 'elite', label: 'Elite Performance', icon: '🏆', desc: 'Objective, evidence-driven, no-nonsense.' },
              { id: 'supportive', label: 'Supportive Mentor', icon: '🌱', desc: 'Warm, encouraging, positive reinforcement.' },
              { id: 'hardcore', label: 'Drill Sergeant', icon: '🔥', desc: 'High energy, raw, absolute accountability.' },
              { id: 'mindfulness', label: 'Mindful Balance', icon: '🧘', desc: 'Recovery focus, sleep, stress management.' }
            ].map(p => {
              const active = currentPersonality === p.id;
              return el('button', {
                class: `segmented-btn ${active ? 'active' : ''}`,
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '16px',
                  borderRadius: 'var(--rounded-lg)',
                  border: active ? '2px solid var(--colors-primary)' : '1px solid var(--colors-hairline)',
                  background: active ? 'rgba(156, 101, 24, 0.08)' : 'var(--colors-canvas)',
                  textAlign: 'left',
                  height: 'auto',
                  gap: '6px'
                },
                onClick: () => {
                  localStorage.setItem('lt_coach_personality', p.id);
                  alert(`AI Coach personality set to: ${p.label}`);
                  renderSettingsSubView('system');
                }
              },
                el('span', { style: { fontSize: '20px', marginBottom: '2px' } }, p.icon),
                el('span', { style: { fontWeight: '700', fontSize: '13.5px', color: 'var(--colors-ink)', display: 'block' } }, p.label),
                el('span', { style: { fontSize: '11px', color: 'var(--colors-muted)', lineHeight: '1.3' } }, p.desc)
              );
            })
          )
        )
      );

      // 5. APPLE HEALTH INTEGRATION CARD
      const fbConfigured = firebase.isFirebaseConfigured();
      const fbConfig = firebase.getFirebaseConfig();
      const signedIn = !!state.user;
      let healthSyncCard;
      if (!fbConfigured || !signedIn) {
        healthSyncCard = el('div', { class: 'form-card health-sync-card', style: { marginTop: '24px' } },
          el('h3', {}, " Apple Health Integration"),
          el('p', { class: 'page-subtitle' }, "Configure a secure, automatic sync from your iPhone using Apple Shortcuts."),
          el('div', { 
            style: { 
              padding: '16px', 
              borderRadius: 'var(--rounded-lg)', 
              background: 'rgba(232, 165, 90, 0.08)', 
              border: '1px solid rgba(232, 165, 90, 0.2)',
              marginTop: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            } 
          },
            el('span', { style: { fontSize: '20px' } }, "⚠️"),
            el('span', { style: { fontSize: '13px', color: 'var(--colors-ink)', fontWeight: '500' } }, 
              "Firebase database and authentication must be configured and active to access Apple Health REST webhook setup details."
            )
          )
        );
      } else {
        const syncToken = state.profile?.syncToken || "Generating token... Please wait or refresh.";

        healthSyncCard = el('div', { class: 'form-card health-sync-card', style: { marginTop: '24px' } },
          el('h3', {}, " Apple Health Integration"),
          el('p', { class: 'page-subtitle' }, "Synchronize steps, sleep, and active energy burn automatically from your iPhone using the built-in iOS Shortcuts app. Completely free, secure, and offline-compatible."),
          
          el('div', { class: 'settings-split-wrapper', style: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' } },
            el('div', {},
              el('h4', { style: { fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)', marginBottom: '8px' } }, "Step 1: Your Secure Sync Token"),
              el('p', { style: { fontSize: '13px', color: 'var(--colors-muted)', lineHeight: '1.4', marginBottom: '8px' } }, 
                "This token securely connects your iPhone to your tracker without exposing your database credentials. Keep it secret."
              ),
              el('div', { class: 'form-group' },
                el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  el('span', { class: 'form-label', style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' } }, "SYNC TOKEN"),
                  el('button', { 
                    class: 'btn btn-text copy-btn', 
                    style: { fontSize: '11px', padding: '2px 8px' },
                    onClick: () => {
                      navigator.clipboard.writeText(syncToken);
                      alert("Sync Token copied!");
                    }
                  }, "Copy Token")
                ),
                el('div', { class: 'health-sync-code-box', style: { fontSize: '15px', letterSpacing: '0.05em', textAlign: 'center', padding: '16px' } }, syncToken)
              )
            ),

            el('div', {},
              el('h4', { style: { fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)', marginBottom: '8px' } }, "Step 2: Get the Universal Apple Shortcut"),
              el('p', { style: { fontSize: '13px', color: 'var(--colors-muted)', lineHeight: '1.4', marginBottom: '8px' } }, 
                "Download the pre-built Apple Shortcut. When prompted during installation, paste your Sync Token from above."
              ),
              el('a', {
                href: 'https://www.icloud.com/shortcuts/64c67bd770ea4502b85e05a2f5f4007b',
                target: '_blank',
                class: 'btn btn-primary',
                style: { width: '100%', textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }
              }, icon(ICONS.sparkles, "btn-icon"), "Download Apple Shortcut")
            ),

            el('div', {},
              el('h4', { style: { fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)', marginBottom: '8px' } }, "Step 3: Set up iOS Automation (Optional)"),
              el('p', { style: { fontSize: '13px', color: 'var(--colors-muted)', lineHeight: '1.4' } }, 
                "Inside the iOS Shortcuts app, navigate to Automation -> Create Personal Automation. Trigger it when you close an app (like Messages or Safari) to sync automatically in the background all day."
              )
            )
          )
        );
      }

      // Danger card
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
              localStorage.removeItem('life_tracker_redesign_habits_list');
              localStorage.removeItem('life_tracker_redesign_recipes');
              localStorage.removeItem('life_tracker_redesign_books');
              localStorage.removeItem('life_tracker_redesign_movies');
              window.location.reload();
            }
          }
        }, "Clear Local Cache Logs")
      );

      settingsContent.appendChild(diagnosticsGrid);
      settingsContent.appendChild(authCard);
      settingsContent.appendChild(geminiCard);
      settingsContent.appendChild(coachSettingsCard);
      if (healthSyncCard) settingsContent.appendChild(healthSyncCard);
      settingsContent.appendChild(dangerCard);
    }
  };

  renderSettingsSubView(activeSettingsTab);

  container.appendChild(subTabs);
  container.appendChild(settingsContent);
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
        if (window.location.hash === '#auth' || !window.location.hash) {
          window.location.hash = '#dashboard';
        } else {
          renderApp();
        }
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
