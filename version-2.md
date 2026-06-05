# Enhanced Life Tracker PWA - Architectural Review & Improvements

## Critical Issues with Current Plan

### 1. Security Vulnerabilities
The Gemini API key in localStorage is exposed to XSS attacks. Any injected script can read `localStorage`. Better approach:

```javascript
// Instead of localStorage, use a backend proxy or at minimum
// warn users and use sessionStorage with key obfuscation
// Better: Vercel Edge Function as a thin proxy
```

### 2. Missing State Management
No mention of how state flows between components. With Firebase real-time listeners + local state, you'll get race conditions and memory leaks without a clear pattern.

### 3. No Offline Write Strategy
Service Worker caches reads, but what happens when the user logs a workout offline? No conflict resolution strategy defined.

---

## Improved Architecture

```
src/
├── core/
│   ├── firebase.js          # Firebase init
│   ├── gemini.js            # Gemini service
│   └── queryClient.js       # React Query setup
├── hooks/                   # Custom data hooks (separation of concerns)
│   ├── useWorkouts.js
│   ├── useHabits.js
│   ├── useMedia.js
│   ├── useNutrition.js
│   └── useAuth.js
├── stores/                  # Zustand stores (local ephemeral state)
│   ├── uiStore.js           # Modal state, active tab, loading flags
│   └── sessionStore.js      # Unsaved form data, optimistic updates
├── components/
│   ├── ui/                  # Atomic design system components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   ├── ProgressBar.jsx
│   │   └── StarRating.jsx
│   ├── fitness/
│   │   ├── WorkoutLogger.jsx
│   │   ├── SplitPlanner.jsx
│   │   ├── NutritionPanel.jsx
│   │   └── ExerciseCard.jsx
│   ├── media/
│   │   ├── BookShelf.jsx
│   │   └── MovieShelf.jsx
│   ├── habits/
│   │   ├── HabitGrid.jsx
│   │   └── StreakCounter.jsx
│   └── Navigation.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── Fitness.jsx
│   ├── Habits.jsx
│   ├── Media.jsx
│   ├── Auth.jsx
│   └── Settings.jsx
├── services/
│   ├── firestoreService.js  # All DB operations in one place
│   ├── aiCoach.js           # AI + rules-based fallback
│   └── analytics.js         # Usage patterns (local only)
└── utils/
    ├── dateHelpers.js
    ├── nutritionCalculator.js
    └── validators.js
```

---

## Better Ideas & Additions

### Idea 1: Optimistic Updates with Conflict Resolution

```javascript
// hooks/useWorkouts.js
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, doc, setDoc, onSnapshot, 
  serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { useAuthStore } from '../stores/authStore';

// Pending queue for offline writes
const pendingQueue = new Map();

export function useWorkouts(date) {
  const { user } = useAuthStore();
  const [workouts, setWorkouts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [localOverrides, setLocalOverrides] = useState({});

  // Real-time listener with local override merging
  useEffect(() => {
    if (!user) return;
    
    const ref = collection(
      db, 'users', user.uid, 'workouts', date, 'exercises'
    );
    
    const unsubscribe = onSnapshot(ref, (snap) => {
      const serverData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Merge: local overrides win for fields modified in last 5 seconds
      // Server wins for everything else (handles multi-device sync)
      const merged = serverData.map(exercise => {
        const override = localOverrides[exercise.id];
        if (override && Date.now() - override.timestamp < 5000) {
          return { ...exercise, ...override.data };
        }
        return exercise;
      });
      
      setWorkouts(merged);
    }, (error) => {
      console.error('Workout listener error:', error);
    });
    
    return unsubscribe;
  }, [user, date, localOverrides]);

  // Optimistic update: UI responds instantly, syncs in background
  const logSet = useCallback(async (exerciseId, setData) => {
    const optimisticId = `${exerciseId}-${Date.now()}`;
    
    // 1. Update UI immediately
    setLocalOverrides(prev => ({
      ...prev,
      [exerciseId]: { 
        data: setData, 
        timestamp: Date.now() 
      }
    }));
    
    // 2. Queue for Firestore write
    setSyncing(true);
    try {
      const ref = doc(
        db, 'users', user.uid, 'workouts', date, 'exercises', exerciseId
      );
      await setDoc(ref, {
        ...setData,
        updatedAt: serverTimestamp(),
        deviceId: getDeviceId(), // For conflict tracking
      }, { merge: true });
      
      // Remove from pending queue on success
      pendingQueue.delete(optimisticId);
    } catch (error) {
      // If offline, store in IndexedDB for later sync
      await queueOfflineWrite({ exerciseId, setData, date, userId: user.uid });
      console.warn('Queued for offline sync:', exerciseId);
    } finally {
      setSyncing(false);
    }
  }, [user, date]);

  return { workouts, logSet, syncing };
}

// Unique device identifier for conflict tracking
function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
  }
  return id;
}

// IndexedDB queue for offline writes
async function queueOfflineWrite(data) {
  const db = await openDB('lifetracker-offline', 1, {
    upgrade(db) {
      db.createObjectStore('pendingWrites', { 
        keyPath: 'id', 
        autoIncrement: true 
      });
    }
  });
  await db.add('pendingWrites', { ...data, queuedAt: Date.now() });
}
```

### Idea 2: Smarter AI Coach with Context Window

```javascript
// services/aiCoach.js
import { GoogleGenerativeAI } from '@google/generative-ai';

// Build rich context from all daily data
function buildDailyContext(data) {
  const {
    workouts, nutrition, steps, sleep, 
    water, weight, userProfile, history
  } = data;

  // Calculate trends from last 7 days
  const avgCalories7d = history.slice(-7)
    .reduce((sum, d) => sum + (d.calories || 0), 0) / 7;
  const avgSleep7d = history.slice(-7)
    .reduce((sum, d) => sum + (d.sleep || 0), 0) / 7;
  const workoutFrequency = history.slice(-14)
    .filter(d => d.didWorkout).length;

  return `
## User Profile
- Goal: ${userProfile.goal} (${userProfile.targetCalories} kcal target)
- Weight trend: ${weight.current}kg (${weight.change > 0 ? '+' : ''}${weight.change}kg this week)
- Workout frequency: ${workoutFrequency}/14 days this fortnight

## Today's Complete Log
### Workout: ${workouts.splitDay || 'Rest Day'}
${workouts.exercises?.map(ex => 
  `- ${ex.name}: ${ex.completedSets?.map(s => 
    `${s.weight}kg×${s.reps}`
  ).join(', ') || 'Skipped'}`
).join('\n') || 'No workout logged'}

### Nutrition
- Calories: ${nutrition.calories}/${userProfile.targetCalories} kcal
- Protein: ${nutrition.protein}g (target: ${userProfile.targetProtein}g)
- Water: ${water.cups} cups (${water.cups * 250}ml)
- Meals logged: ${nutrition.meals?.map(m => m.name).join(', ')}

### Recovery & Activity  
- Steps: ${steps.toLocaleString()} (target: 10,000)
- Sleep: ${sleep.hours}h ${sleep.minutes}m
- 7-day avg sleep: ${avgSleep7d.toFixed(1)}h

### Context
- 7-day avg calories: ${Math.round(avgCalories7d)} kcal
- User notes: "${nutrition.aiInput || 'None'}"

## Instructions
Provide a holistic coaching review. Be specific, warm but direct.
Format as JSON with keys: rating (1-10), headline (one punchy sentence),
critique (2-3 paragraphs), wins (array), improvements (array), 
tomorrowPlan (specific actionable items).
  `.trim();
}

export async function getDailyCoachReview(dailyData) {
  const apiKey = sessionStorage.getItem('gemini_key_enc'); // Encrypted
  
  if (!apiKey) {
    return getRulesBasedFeedback(dailyData); // Graceful fallback
  }

  try {
    const genAI = new GoogleGenerativeAI(decrypt(apiKey));
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', // Faster + cheaper than Pro
      generationConfig: {
        responseMimeType: 'application/json', // Structured output
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });

    const prompt = buildDailyContext(dailyData);
    const result = await model.generateContent(prompt);
    const response = JSON.parse(result.response.text());
    
    // Validate response shape before returning
    return validateCoachResponse(response);
  } catch (error) {
    console.error('Gemini error, using fallback:', error);
    return getRulesBasedFeedback(dailyData);
  }
}

// Rules-based fallback - genuinely useful without AI
function getRulesBasedFeedback(data) {
  const { nutrition, sleep, steps, workouts, water, userProfile } = data;
  
  const wins = [];
  const improvements = [];
  let score = 5;

  // Nutrition scoring
  const calRatio = nutrition.calories / userProfile.targetCalories;
  if (calRatio >= 0.9 && calRatio <= 1.1) { wins.push('Calories on target'); score += 1; }
  else if (calRatio < 0.7) improvements.push(`Ate ${Math.round((1-calRatio)*100)}% fewer calories than target`);
  else if (calRatio > 1.2) improvements.push(`Exceeded calorie target by ${Math.round((calRatio-1)*100)}%`);

  const proteinRatio = nutrition.protein / userProfile.targetProtein;
  if (proteinRatio >= 0.9) { wins.push('Protein goal achieved'); score += 1; }
  else improvements.push(`Protein ${Math.round(nutrition.protein)}g vs ${userProfile.targetProtein}g target`);

  // Sleep scoring
  if (sleep.hours >= 7.5) { wins.push('Great sleep duration'); score += 1; }
  else if (sleep.hours < 6) { improvements.push('Sleep under 6h impairs recovery and muscle growth'); score -= 1; }
  else improvements.push('Aim for 7.5-9h sleep for optimal recovery');

  // Steps scoring  
  if (steps >= 10000) { wins.push('Step goal crushed'); score += 1; }
  else if (steps < 5000) improvements.push('Low activity - even a 20min walk helps fat loss');

  // Water scoring
  if (water.cups >= 8) { wins.push('Well hydrated'); score += 0.5; }
  else improvements.push(`Only ${water.cups} cups water - target 8+`);

  // Workout scoring
  if (workouts.exercises?.some(e => e.completedSets?.length > 0)) { 
    wins.push('Training session logged'); score += 1.5; 
  }

  return {
    rating: Math.max(1, Math.min(10, Math.round(score))),
    headline: score >= 7 ? 'Solid day — consistency compounds' : 
              score >= 5 ? 'Decent foundation — a few tweaks will accelerate progress' :
              'Recovery day — refocus tomorrow',
    critique: buildNarrativeCritique({ wins, improvements, data }),
    wins,
    improvements,
    tomorrowPlan: buildTomorrowPlan(data),
    source: 'rules-engine', // So UI can show "Smart Analysis" vs "AI Analysis"
  };
}

function buildNarrativeCritique({ wins, improvements, data }) {
  const { sleep, workouts, nutrition } = data;
  const parts = [];
  
  if (workouts.splitDay && workouts.exercises?.some(e => e.completedSets?.length)) {
    const totalVolume = workouts.exercises.reduce((sum, ex) => 
      sum + (ex.completedSets?.reduce((s, set) => 
        s + (set.weight * set.reps), 0) || 0), 0);
    parts.push(`Your ${workouts.splitDay} session logged ${Math.round(totalVolume).toLocaleString()}kg total volume.`);
  }
  
  if (sleep.hours < 7) {
    parts.push(`At ${sleep.hours}h sleep, recovery will be compromised — protein synthesis peaks during deep sleep, so this directly impacts your gains.`);
  }
  
  if (nutrition.protein < data.userProfile?.targetProtein * 0.8) {
    parts.push(`Protein intake needs attention. Without adequate protein post-training, muscle protein breakdown exceeds synthesis.`);
  }

  return parts.join(' ') || 'Keep logging consistently for personalised insights.';
}
```

### Idea 3: Proper Firestore Data Model

```javascript
// This matters enormously for query performance and costs

/*
COLLECTION STRUCTURE:
─────────────────────────────────────────────────
users/{uid}/
  profile/                    ← single doc
    goals, targetCalories, targetProtein, etc.
  
  workoutSplits/              ← user-defined splits
    {splitId}/
      name: "Push Day"
      exercises: [{name, defaultWeight, sets, reps}]
  
  dailyLogs/{YYYY-MM-DD}/     ← one doc per day (cheap reads!)
    workout: {
      splitId, splitName,
      exercises: [{exerciseId, name, sets: [{weight, reps, completed}]}]
    }
    nutrition: {
      calories, protein, water,
      meals: [{recipeId, name, calories, protein, loggedAt}],
      aiInput: "..."
    }
    health: { steps, sleep: {hours, minutes}, weight }
    aiReview: { rating, headline, critique, ... }  ← cached!
  
  habits/{habitId}/
    name, color, icon, targetDays
    completions: [YYYY-MM-DD, ...]  ← array of completed dates
  
  recipes/{recipeId}/
    name, calories, protein, description
  
  books/{bookId}/
    title, author, totalPages, coverUrl, status, review
    readingLog: [{date, pagesRead}]
  
  movies/{movieId}/
    title, year, genre, coverUrl, status, rating, review, watchedDate

QUERY PATTERNS:
─────────────────────────────────────────────────
// Today's complete data - ONE read
const todayDoc = await getDoc(doc(db, 'users', uid, 'dailyLogs', today));

// Last 30 days for charts - 30 reads max, use where() + limit()
const last30 = await getDocs(
  query(
    collection(db, 'users', uid, 'dailyLogs'),
    orderBy('__name__', 'desc'),
    limit(30)
  )
);

// Habits with their completion history
const habits = await getDocs(collection(db, 'users', uid, 'habits'));
// completions array is IN the document - no join needed!
*/
```

### Idea 4: Better PWA Offline Strategy

```javascript
// public/sw.js - Workbox-free but production-grade

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const MAX_DYNAMIC_ITEMS = 50;

// What to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API, Cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Firebase/Gemini API - Network only (never cache auth/data)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('google') ||
      url.hostname.includes('googleapis')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets - Cache first, network fallback
  if (request.destination === 'image' || 
      request.destination === 'font' ||
      url.pathname.match(/\.(js|css|woff2)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - Network first, cache fallback (shows stale UI offline)
  event.respondWith(networkFirstWithFallback(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetchAndCache(request, DYNAMIC_CACHE);
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(DYNAMIC_CACHE, request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/index.html'); // SPA fallback
  }
}

async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  await cacheResponse(cacheName, request, response.clone());
  return response;
}

async function cacheResponse(cacheName, request, response) {
  if (!response.ok) return;
  const cache = await caches.open(cacheName);
  
  // Trim dynamic cache to prevent unbounded growth
  const keys = await cache.keys();
  if (keys.length >= MAX_DYNAMIC_ITEMS) {
    await cache.delete(keys[0]);
  }
  
  await cache.put(request, response);
}

// Background sync for offline workout logs
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-logs') {
    event.waitUntil(syncPendingLogs());
  }
});

async function syncPendingLogs() {
  // Open IndexedDB and flush pending writes to Firestore
  // This fires automatically when connectivity returns
  const client = await self.clients.matchAll();
  client.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE' }));
}
```

### Idea 5: Component Architecture with Proper Patterns

```jsx
// components/fitness/WorkoutLogger.jsx
// Shows the pattern for all interactive components

import { useState, useCallback, memo } from 'react';
import { useWorkouts } from '../../hooks/useWorkouts';
import { getTodayString } from '../../utils/dateHelpers';

// Memoized to prevent re-renders when parent updates
const ExerciseRow = memo(function ExerciseRow({ exercise, onLogSet }) {
  const [currentSet, setCurrentSet] = useState({
    weight: exercise.defaultWeight,
    reps: exercise.defaultReps,
  });
  const [completedSets, setCompletedSets] = useState(
    exercise.completedSets || []
  );
  const [saving, setSaving] = useState(false);

  const adjust = useCallback((field, delta) => {
    setCurrentSet(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta)
    }));
  }, []);

  const logSet = useCallback(async () => {
    setSaving(true);
    const newSet = { ...currentSet, completedAt: new Date().toISOString() };
    
    // Optimistic local update
    setCompletedSets(prev => [...prev, newSet]);
    
    try {
      await onLogSet(exercise.id, newSet);
    } catch {
      // Rollback on failure
      setCompletedSets(prev => prev.slice(0, -1));
    } finally {
      setSaving(false);
    }
  }, [currentSet, exercise.id, onLogSet]);

  return (
    <div className="exercise-row">
      <div className="exercise-header">
        <span className="exercise-name">{exercise.name}</span>
        <span className="sets-indicator">
          {completedSets.length}/{exercise.targetSets} sets
        </span>
      </div>
      
      {/* Completed sets display */}
      <div className="completed-sets">
        {completedSets.map((set, i) => (
          <span key={i} className="set-badge">
            {set.weight}kg × {set.reps}
          </span>
        ))}
      </div>

      {/* Controls for next set */}
      <div className="set-controls">
        <AdjusterControl 
          label="kg"
          value={currentSet.weight}
          step={2.5}
          onAdjust={(delta) => adjust('weight', delta)}
        />
        <AdjusterControl
          label="reps"
          value={currentSet.reps}
          step={1}
          onAdjust={(delta) => adjust('reps', delta)}
        />
        <button 
          onClick={logSet} 
          disabled={saving}
          className="log-set-btn"
        >
          {saving ? '...' : '+ Log Set'}
        </button>
      </div>
    </div>
  );
});

// Reusable +/- adjuster - used everywhere in fitness module
const AdjusterControl = memo(function AdjusterControl({ 
  label, value, step, onAdjust 
}) {
  return (
    <div className="adjuster">
      <button 
        onClick={() => onAdjust(-step)}
        className="adjuster-btn"
        aria-label={`Decrease ${label}`}
      >−</button>
      <span className="adjuster-value">
        {value}<small>{label}</small>
      </span>
      <button 
        onClick={() => onAdjust(step)}
        className="adjuster-btn"
        aria-label={`Increase ${label}`}
      >+</button>
    </div>
  );
});

export default function WorkoutLogger() {
  const today = getTodayString(); // 'YYYY-MM-DD'
  const { workouts, activeSplit, logSet, syncing } = useWorkouts(today);

  return (
    <section className="workout-logger">
      <header className="section-header">
        <h2>{activeSplit?.name || 'Select Today\'s Split'}</h2>
        {syncing && <span className="sync-badge">Syncing...</span>}
      </header>
      
      {workouts.map(exercise => (
        <ExerciseRow
          key={exercise.id}
          exercise={exercise}
          onLogSet={logSet}
        />
      ))}
    </section>
  );
}
```

---

## Additional Features Worth Adding

### Feature 1: Body Metrics & Progress Photos
```
Daily weight log with moving average trend line
Body measurements (chest, waist, arms, legs)
Progress photo upload with date stamps (stored in Firebase Storage)
Visual progress comparison slider (before/after)
```

### Feature 2: Workout Volume Analytics
```
Weekly volume per muscle group (Push/Pull/Legs breakdown)
Progressive overload tracker (did you beat last week's weights?)
1-rep max estimator using Epley formula
Personal record notifications
```

### Feature 3: Smart Notifications (Web Push)
```javascript
// Morning: "Today is Push Day - 3 exercises planned"
// Evening: "You haven't logged today - 2h until midnight"
// Streak alerts: "Log today to keep your 14-day streak!"

// Request permission gracefully (not on page load)
async function requestNotificationPermission() {
  if (Notification.permission === 'default') {
    // Only ask after user has used the app 3+ times
    const uses = parseInt(localStorage.getItem('appUses') || '0');
    if (uses >= 3) {
      await Notification.requestPermission();
    }
  }
}
```

### Feature 4: Data Export & Import
```javascript
// Never lock users into your app
async function exportAllData(userId) {
  const data = {
    exportDate: new Date().toISOString(),
    workoutLogs: await fetchCollection('dailyLogs'),
    habits: await fetchCollection('habits'),
    books: await fetchCollection('books'),
    movies: await fetchCollection('movies'),
  };
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(data, null, 2)], 
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifetracker-export-${getTodayString()}.json`;
  a.click();
}
```

### Feature 5: Keyboard Shortcuts (Mac Power User)
```javascript
// Makes the Mac experience genuinely excellent
const shortcuts = {
  'cmd+1': () => navigate('/dashboard'),
  'cmd+2': () => navigate('/fitness'),
  'cmd+3': () => navigate('/habits'),
  'cmd+4': () => navigate('/media'),
  'cmd+k': () => openCommandPalette(),  // Quick log anything
  'space':  () => toggleTodayHabit(),   // When habit is focused
};
```

---

## Security Improvements

```javascript
// Simple XOR obfuscation for Gemini key in sessionStorage
// Not cryptographically secure but prevents trivial theft
// For production: use a backend proxy instead

function encryptKey(key) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const encoded = btoa(key.split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ salt[i % 16])
  ).join(''));
  return `${saltHex}:${encoded}`;
}

function decryptKey(stored) {
  const [saltHex, encoded] = stored.split(':');
  const salt = saltHex.match(/.{2}/g).map(h => parseInt(h, 16));
  return atob(encoded).split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ salt[i % 16])
  ).join('');
}
```

```
# firestore.rules - Strict security
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null 
        && request.auth.uid == userId
        && request.auth.token.email_verified == true;
    }
  }
}
```

---

## What to Build First (Priority Order)

```
Phase 1 - Core Loop (Week 1)
─────────────────────────────
✓ Auth (Google Sign-In)
✓ Daily workout logger (most used feature)
✓ Habit checklist
✓ Basic dashboard

Phase 2 - Nutrition & Media (Week 2)
──────────────────────────────────────
✓ Recipe manager + calorie logger
✓ Book & movie trackers
✓ Steps + sleep logging

Phase 3 - Intelligence (Week 3)
────────────────────────────────
✓ AI coach integration
✓ Charts & analytics
✓ PWA install + offline support

Phase 4 - Polish (Week 4)
──────────────────────────
✓ Notifications
✓ Data export
✓ Keyboard shortcuts
✓ Performance audit
```

The biggest improvements over your original plan are the **offline-first write queue**, the **single-doc-per-day Firestore model** (dramatically reduces read costs), the **structured AI output** using `responseMimeType: 'application/json'`, and the **rules-based fallback** that's actually useful rather than just a placeholder.