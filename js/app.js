// =============================
// Application Entry Point (Modular v2.0)
// =============================

import { openBudgetModal, saveBudgets, dueMarkPaid } from "./insights.js";
import { openSearch, srOpen, qlAddChooser, addNew, duplicateItem, copyLastMonth, openSettings, setTextSize, exportMonthCsv, dismissTip, initExtras } from "./extras.js";
import { tabGo, initTabs } from "./tabs.js";

import {
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import {
  dbRef,
  syncSet,
  normalize,
  emptyData,
  getLocalCachedData,
  getPendingEchoes,
  decrementPendingEchoes,
  watchAuth,
  signInWithGoogle,
  finishRedirectSignIn,
  signOutUser,
  describeAuthError,
  isPermissionDenied,
} from "./firebase.js";

import {
  setAppData,
  getAppData,
  getSelectedKey,
  setSelectedKey,
  clampSelected,
  reconcileAutoPaid,
} from "./state.js";

import {
  renderAll,
  renderBudget,
  updateHeader,
  renderMonthStrip,
  toast,
  revealApp,
  runIntro,
  enterApp,
  showSignIn,
  showAccessDenied,
  setAuthError,
  setSignInBusy,
  copyAuthInfo,
  openMore,
  closeMore,
  toggleMonthPicker,
  selectMonth,
  openItemModal,
  openChildModal,
  openAccountModal,
  openTransferModal,
  setAccountsView,
  openInvestmentModal,
  closeModal,
  saveModal,
  saveChildAndAddAnother,
  toggleField,
  pickOwner,
  updateBpiCcMonth,
  togglePaidQuick,
  togglePaidGroup,
  addSpend,
  deleteSpend,
  confirmDelete,
  closeConfirm,
  doDelete,
  qlClose,
  qlOpenKey,
  qlSaveKey,
  qlRemoveKey,
  qlConfirm,
  initQuickLog,
  toggleProjected,
  toggleInvestments,
  prevOverviewPage,
  nextOverviewPage,
  jumpOverviewYear,
  exportData,
  fetchInvestmentRates,
  refreshInvestmentRates,
  toggleDensityMode,
  applyDensityMode,
} from "./ui/index.js";

import {
  openCalendarModal,
  closeCalendarModal,
  calSetFilter,
  calAdd,
  calAddFrom,
  initCalendarGestures,
  calSelectDay,
  calGoto,
} from "./calendar.js";

import {
  initGestures,
  initEventListeners,
} from "./events.js";

// =============================
// Auth actions (sign in / out)
// =============================
async function signIn() {
  setAuthError("");
  setSignInBusy(true);
  try {
    const user = await signInWithGoogle();
    // On success onAuthStateChanged takes over (loads data, opens the app).
    // null = popup closed, or a full-page redirect is starting.
    if (!user) setSignInBusy(false);
  } catch (e) {
    console.error("Sign-in error", e);
    setAuthError(describeAuthError(e));
    setSignInBusy(false);
  }
}

async function signOut() {
  try {
    await signOutUser(); // triggers watchAuth(null)
  } catch (e) {
    console.error("Sign-out error", e);
    toast("Could not sign out", "error");
  }
}

// =============================
// Window Action Registration
// =============================
// Expose actions so delegated attributes (e.g. data-action="openItemModal") work seamlessly
window.signIn = signIn;
window.signOut = signOut;
window.copyAuthInfo = copyAuthInfo;
window.reloadApp = () => location.reload();
window.openMore = openMore;
window.closeMore = closeMore;
window.toggleMonthPicker = toggleMonthPicker;
window.selectMonth = selectMonth;
window.openItemModal = openItemModal;
window.openChildModal = openChildModal;
window.openAccountModal = openAccountModal;
window.openTransferModal = openTransferModal;
window.setAccountsView = setAccountsView;
window.openInvestmentModal = openInvestmentModal;
window.closeModal = closeModal;
window.saveModal = saveModal;
window.saveChildAndAddAnother = saveChildAndAddAnother;
window.toggleField = toggleField;
window.pickOwner = pickOwner;
window.updateBpiCcMonth = updateBpiCcMonth;
window.togglePaidQuick = togglePaidQuick;
window.togglePaidGroup = togglePaidGroup;
window.addSpend = addSpend;
window.deleteSpend = deleteSpend;
window.confirmDelete = confirmDelete;
window.closeConfirm = closeConfirm;
window.doDelete = doDelete;
window.qlClose = qlClose;
window.qlOpenKey = qlOpenKey;
window.qlSaveKey = qlSaveKey;
window.qlRemoveKey = qlRemoveKey;
window.qlConfirm = qlConfirm;
initQuickLog();
window.toggleProjected = toggleProjected;
window.toggleInvestments = toggleInvestments;
window.prevOverviewPage = prevOverviewPage;
window.nextOverviewPage = nextOverviewPage;
window.jumpOverviewYear = jumpOverviewYear;
window.exportData = exportData;
window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;
window.calSetFilter = calSetFilter;
window.calAdd = calAdd;
window.calAddFrom = calAddFrom;
window.openBudgetModal = openBudgetModal;
window.saveBudgets = saveBudgets;
window.tabGo = tabGo;
Object.assign(window, { dueMarkPaid, openSearch, srOpen, qlAddChooser, addNew, duplicateItem, copyLastMonth, openSettings, setTextSize, exportMonthCsv, dismissTip });
initExtras();
initCalendarGestures();
initTabs();
window.calSelectDay = calSelectDay;
window.calGoto = calGoto;
window.fetchInvestmentRates = fetchInvestmentRates;
window.refreshInvestmentRates = refreshInvestmentRates;
window.toggleDensityMode = toggleDensityMode;

// =============================
// Boot & Lifecycle
// =============================
const bootStart = performance.now();
let firstLoad = true;
let currentUser = null;
let unsubscribeData = null;
let syncSession = 0; // bumped whenever a sync starts/stops so stale callbacks/timers are ignored

/** Run fn once the intro splash has played (full intro first visit of a session, quick afterwards). */
function whenIntroDone(fn) {
  const quick =
    sessionStorage.getItem("moneyku_intro_seen") === "1" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = Math.max(0, (quick ? 250 : 1600) - (performance.now() - bootStart));
  setTimeout(fn, wait);
}

// Order-independent compare, used to detect local edits that never reached the cloud
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
    return o;
  }
  return v;
}
const sameData = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/**
 * Cloud sync was blocked for a while (database rules), so this device may hold newer data than the
 * cloud. Before the first cloud snapshot overwrites the local copy, check for unsynced local edits
 * and let the user keep them. A backup of the local copy is always saved first.
 * Returns the local data to keep (and upload), or null to use the cloud data.
 */
function resolveLocalConflict(cached, remote) {
  if (!cached) return null;
  const legacy = localStorage.getItem("moneyku_sync_v2") !== "1"; // first run of the sign-in version
  const dirty = localStorage.getItem("moneyku_dirty") === "1";
  localStorage.setItem("moneyku_sync_v2", "1");
  if (!(legacy || dirty)) return null;
  if (sameData(cached, remote)) {
    localStorage.removeItem("moneyku_dirty");
    return null;
  }
  try {
    localStorage.setItem("moneyku_backup_local", JSON.stringify({ savedAt: new Date().toISOString(), data: cached }));
  } catch (e) { /* storage full: continue */ }
  const keepLocal = window.confirm(
    "This device has data that differs from the cloud (changes made while syncing was blocked).\n\n" +
    "OK = keep this device's data and upload it to the cloud\n" +
    "Cancel = use the cloud data (a backup of this device's data is kept)"
  );
  return keepLocal ? cached : null;
}

function stopDataSync() {
  syncSession++;
  firstLoad = true;
  if (unsubscribeData) {
    try { unsubscribeData(); } catch (e) { /* ignore */ }
    unsubscribeData = null;
  }
}

function startDataSync(user) {
  stopDataSync();
  const session = syncSession;
  currentUser = user;

  // 1. Instant offline hydration (renders behind the lock screen until we enter the app)
  const cached = getLocalCachedData();
  if (cached) {
    setAppData(cached);
    clampSelected();
    renderAll();
  }

  // 2. Firebase live database subscription
  unsubscribeData = onValue(
    dbRef,
    (snap) => {
      if (session !== syncSession) return;
      if (!firstLoad && getPendingEchoes() > 0) {
        decrementPendingEchoes();
        return;
      }
      const val = snap.val();
      let nextData = val ? normalize(val) : emptyData();

      let uploadLocal = false;
      if (firstLoad) {
        const keep = resolveLocalConflict(cached, nextData);
        if (keep) { nextData = keep; uploadLocal = true; }
      }
      setAppData(nextData);

      // Save offline copy
      try {
        localStorage.setItem("moneyku_offline", JSON.stringify(nextData));
      } catch (err) {
        console.warn("Storage error", err);
      }

      if (uploadLocal) {
        syncSet(getAppData());
        toast("Uploaded this device's data to the cloud");
      } else if (reconcileAutoPaid()) {
        syncSet(getAppData());
      }

      if (firstLoad) {
        firstLoad = false;
        clampSelected();
        renderAll();
        whenIntroDone(() => { revealApp(); enterApp(); });
      } else {
        renderAll();
      }
    },
    (err) => {
      if (session !== syncSession) return;
      console.error("Firebase error", err);
      if (isPermissionDenied(err)) {
        // Signed in, but the rules don't allow this account: show how to whitelist it
        firstLoad = false;
        whenIntroDone(() => { revealApp(); showAccessDenied(currentUser); });
        return;
      }
      if (!getAppData()) {
        setAppData(emptyData());
        renderAll();
      }
      firstLoad = false;
      whenIntroDone(() => { revealApp(); enterApp(); });
      // Persistent badge (the toast alone disappears after 2s)
      const badge = document.getElementById("offline-indicator");
      if (badge) badge.classList.remove("hidden");
      toast("Offline — loaded local cache", "error");
    }
  );

  // Safety fallback: open the UI even if Firebase is sluggish
  setTimeout(() => {
    if (session !== syncSession) return;
    if (firstLoad) {
      firstLoad = false;
      if (!getAppData()) {
        setAppData(emptyData());
      }
      clampSelected();
      renderAll();
      revealApp();
      enterApp();
    }
  }, 3500);
}

let authResolved = false;
function onAuth(user) {
  authResolved = true;
  if (user) {
    startDataSync(user);
    return;
  }
  // Signed out: stop listening, hide data. (The offline cache is kept on purpose: it may hold
  // edits that haven't reached the cloud yet, and is only reused after the same sign-in.)
  currentUser = null;
  stopDataSync();
  setAppData(null);
  try { closeMore(); } catch (e) { /* ignore */ }
  const badge = document.getElementById("offline-indicator");
  if (badge) badge.classList.add("hidden");
  whenIntroDone(() => { revealApp(); showSignIn(); });
}

function boot() {
  applyDensityMode();
  runIntro();
  initGestures();
  initEventListeners();  window.__moneykuBooted = true;

  // Background live ticker: updates rates periodically (only while signed in)
  setInterval(() => {
    if (currentUser && getAppData()) fetchInvestmentRates(false);
  }, 60000);

  // Complete a redirect-based sign-in if we just came back from Google
  finishRedirectSignIn().then((err) => { if (err) setAuthError(describeAuthError(err)); });

  watchAuth(onAuth);

  // If auth state never resolves (e.g. storage blocked), fall back to the sign-in screen
  setTimeout(() => { if (!authResolved) onAuth(null); }, 6000);
}

// Start application
boot();

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.log("SW Reg failed:", err));
  });
}
