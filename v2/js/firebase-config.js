// =============================================================
// ALIGN v2 — Firebase Configuration
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

const firebaseConfig = {
  apiKey: 'AIzaSyBX2AsGr8I2C0cgNTyoWEC9B-L4uu1SIAE',
  authDomain: 'align-50edf.firebaseapp.com',
  projectId: 'align-50edf',
  storageBucket: 'align-50edf.firebasestorage.app',
  messagingSenderId: '478516175608',
  appId: '1:478516175608:web:63a460c0da88fdab10910d',
};

let app = null;
let auth = null;
let db = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn('[Align] Firebase initialization failed — running in local-only mode:', error.message);
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
