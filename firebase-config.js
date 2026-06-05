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

// Check if a custom Firebase configuration is stored in LocalStorage
export function getFirebaseConfig() {
  const stored = localStorage.getItem('firebase_config');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Invalid stored Firebase config:", e);
    }
  }
  
  // Default fallback placeholders (Users can override in Settings)
  return {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  };
}

export function saveFirebaseConfig(config) {
  if (config && config.apiKey && config.projectId) {
    localStorage.setItem('firebase_config', JSON.stringify(config));
    return true;
  } else {
    localStorage.removeItem('firebase_config');
    return false;
  }
}

// Check if Firebase is configured with real credentials
export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return config && config.apiKey && config.apiKey !== "YOUR_API_KEY";
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
