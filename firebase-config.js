/**
 * Firebase Client Setup and Initialization using official Google CDNs (ESM).
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function getFirebaseConfig() {
  return {
    apiKey: "AIzaSyBX2AsGr8I2C0cgNTyoWEC9B-L4uu1SIAE",
    authDomain: "align-50edf.firebaseapp.com",
    projectId: "align-50edf",
    storageBucket: "align-50edf.firebasestorage.app",
    messagingSenderId: "478516175608",
    appId: "1:478516175608:web:63a460c0da88fdab10910d"
  };
}

export function saveFirebaseConfig(config) {
  // Disabled in production (config is hardcoded in firebase-config.js)
  return false;
}

// Check if Firebase is configured with real credentials
export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return config && config.apiKey && config.apiKey !== "YOUR_PRODUCTION_API_KEY" && config.apiKey !== "YOUR_API_KEY";
}

let app;
let auth;
let db;

// Initialize Firebase if configured
if (isFirebaseConfigured()) {
  try {
    const config = getFirebaseConfig();
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

// Re-initialize helper (called when user saves new config in Settings)
export function reinitializeFirebase() {
  if (getApps().length > 0) {
    // Cannot easily reinitialize Firebase web app in-place without reload,
    // so we recommend reload on setting changes
    window.location.reload();
  }
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
  deleteDoc
};
