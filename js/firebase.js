import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
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
  } catch (err) {
    console.warn("Could not save to localStorage:", err);
  }

  try { 
    await set(dbRef, appData); 
  } catch (e) { 
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

