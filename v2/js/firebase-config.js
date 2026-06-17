// =============================================================
// ALIGN v2 — Firebase Configuration
// Config is entered by the user in the setup screen and stored
// in localStorage — NO credentials are hardcoded here.
// =============================================================

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─── Load config from localStorage (set by the user in Settings) ───
function loadFirebaseConfig() {
  try {
    const stored = localStorage.getItem('align_v2_firebase_config');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // ignore
  }
  return null;
}

let app = null;
let auth = null;
let db = null;

const firebaseConfig = loadFirebaseConfig();

if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.warn('[Align] Firebase init failed — running in local-only mode:', error.message);
  }
} else {
  console.info('[Align] No Firebase config found — running in local-only mode. Add your config in Settings → Cloud Sync.');
}

export {
  app,
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  deleteDoc,
};
