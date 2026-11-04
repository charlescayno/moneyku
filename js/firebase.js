import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { currentKey, $ } from "./utils.js";

// =============================
// Firebase config
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyDZQHg85LuRKsfEHWvS3ygULUYqizN8lOc",
  authDomain: "moneyku-db.firebaseapp.com",
  databaseURL: "https://moneyku-db-default-rtdb.firebaseio.com",
  projectId: "moneyku-db",
  storageBucket: "moneyku-db.firebasestorage.app",
  messagingSenderId: "650460099293",
  appId: "1:650460099293:web:10870c9285d78c49f4a134",
  measurementId: "G-Y75TFQMGEE",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
export const DB_PATH = "money_single_v1";
export const dbRef = ref(db, DB_PATH);

// =============================
// Authentication (Google sign-in)
// =============================
// The database rules only allow the owner's Google account (see database.rules.json),
// so nothing is read or written until the user is signed in.
export const auth = getAuth(firebaseApp);

/** Subscribe to sign-in state. cb(user | null). Returns an unsubscribe function. */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

/** Start Google sign-in. Resolves with the user, or null if the user closed the popup. */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (e) {
    if (e && e.code === "auth/popup-blocked") {
      // Some mobile browsers / installed PWAs block popups: fall back to a full-page redirect
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (e && (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request")) {
      return null;
    }
    throw e;
  }
}

/** Completes a redirect-based sign-in (if one was started). Errors are returned, not thrown. */
export async function finishRedirectSignIn() {
  try {
    await getRedirectResult(auth);
    return null;
  } catch (e) {
    return e;
  }
}

export function signOutUser() {
  return signOut(auth);
}

/** Friendly message for the common sign-in failures. */
export function describeAuthError(e) {
  const code = (e && e.code) || "";
  if (code === "auth/unauthorized-domain") {
    return "This site's domain isn't authorized. In Firebase: Authentication > Settings > Authorized domains > add " + location.hostname;
  }
  if (code === "auth/configuration-not-found") {
    return "Authentication isn't set up yet. In Firebase: Build > Authentication > Get started, then enable the Google sign-in method.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Google sign-in isn't enabled. In Firebase: Authentication > Sign-in method > enable Google.";
  }
  if (code === "auth/network-request-failed") return "Network error. Check your connection and try again.";
  if (code === "auth/popup-blocked") return "Popup was blocked. Allow popups for this site and try again.";
  return "Sign-in failed" + (code ? " (" + code + ")" : "") + ".";
}

/** True when a Realtime Database error means "signed in, but not allowed by the rules". */
export function isPermissionDenied(err) {
  const text = String((err && (err.code || err.message)) || err || "").toLowerCase();
  return text.includes("permission_denied") || text.includes("permission denied");
}

// =============================
// Sync & State Normalization
// =============================
export function showSync() { 
  const b = $("sync-bar"); 
  if (b) b.style.opacity = "1"; 
}

export function hideSync() { 
  const b = $("sync-bar"); 
  if (b) b.style.opacity = "0"; 
}

let pendingEchoes = 0;

export function decrementPendingEchoes() {
  if (pendingEchoes > 0) pendingEchoes--;
}

export function getPendingEchoes() {
  return pendingEchoes;
}

export async function syncSet(appData, onFail) {
  pendingEchoes++;
  showSync();
  // Save local copy immediately for instant offline durability
  try {
    localStorage.setItem('moneyku_offline', JSON.stringify(appData));
    // Marks "this device has changes the cloud may not have" until the write is confirmed
    localStorage.setItem('moneyku_dirty', '1');
  } catch (err) {
    console.warn("Could not save to localStorage:", err);
  }

  try { 
    await set(dbRef, appData); 
    try { localStorage.removeItem('moneyku_dirty'); } catch (err) { /* ignore */ }
  } catch (e) { 
    try { localStorage.setItem('moneyku_dirty', '1'); } catch (err) { /* ignore */ }
    pendingEchoes = Math.max(0, pendingEchoes - 1); 
    console.error("Firebase sync error:", e); 
    if (typeof onFail === "function") onFail(e);
  } finally { 
    setTimeout(hideSync, 400); 
  }
}

export function normalize(d) {
  d = d || {};
  d.accounts = Array.isArray(d.accounts) ? d.accounts : (d.accounts ? Object.values(d.accounts) : []);
  d.startMonth = d.startMonth || currentKey();
  d.items = d.items || {};
  for (const who of ["charlie", "debt"]) {
    d.items[who] = d.items[who] || {};
    for (const kind of ["income", "expenses"]) {
      const v = d.items[who][kind];
      d.items[who][kind] = Array.isArray(v) ? v : (v ? Object.values(v) : []);
    }
  }
  d.paid = d.paid || {};
  d.overrides = d.overrides || {};
  d.spend = d.spend || {};
  d.settings = d.settings || {};
  return d;
}

export function emptyData() {
  return normalize({ startMonth: currentKey() });
}

export function getLocalCachedData() {
  try {
    const raw = localStorage.getItem('moneyku_offline');
    if (raw) {
      return normalize(JSON.parse(raw));
    }
  } catch (e) {
    console.warn("Error reading offline cache:", e);
  }
  return null;
}

