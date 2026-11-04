// =============================
// Application Entry Point (Modular v2.0)
// =============================

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
  unlockApp,
  toggleLockPassword,
  openMore,
  closeMore,
  toggleMonthPicker,
  selectMonth,
  openItemModal,
  openChildModal,
  openAccountModal,
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
} from "./calendar.js";

import {
  initGestures,
  initEventListeners,
} from "./events.js";

// =============================
// Window Action Registration
// =============================
// Expose actions so delegated attributes (e.g. data-action="openItemModal") work seamlessly
window.unlockApp = unlockApp;
window.toggleLockPassword = toggleLockPassword;
window.openMore = openMore;
window.closeMore = closeMore;
window.toggleMonthPicker = toggleMonthPicker;
window.selectMonth = selectMonth;
window.openItemModal = openItemModal;
window.openChildModal = openChildModal;
window.openAccountModal = openAccountModal;
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
window.toggleProjected = toggleProjected;
window.toggleInvestments = toggleInvestments;
window.prevOverviewPage = prevOverviewPage;
window.nextOverviewPage = nextOverviewPage;
window.jumpOverviewYear = jumpOverviewYear;
window.exportData = exportData;
window.openCalendarModal = openCalendarModal;
window.closeCalendarModal = closeCalendarModal;
window.fetchInvestmentRates = fetchInvestmentRates;
window.refreshInvestmentRates = refreshInvestmentRates;
window.toggleDensityMode = toggleDensityMode;

// =============================
// Boot & Lifecycle
// =============================
let firstLoad = true;

function boot() {
  applyDensityMode();
  runIntro();
  initGestures();
  initEventListeners();
  // NOTE: AI chat bar (ui/chat.js + nlp.js) is unfinished and hidden in index.html.
  // Re-enable by removing "hidden" from #chat-bar and calling import("./ui/chat.js") here.
  window.__moneykuBooted = true;
  
  // Background live ticker: updates rates periodically
  setInterval(() => {
    fetchInvestmentRates(false);
  }, 60000);

  // 1. Instant offline hydration
  const cached = getLocalCachedData();
  if (cached) {
    setAppData(cached);
    clampSelected();
    renderAll();
  }

  // 2. Firebase live database subscription
  onValue(
    dbRef,
    (snap) => {
      if (!firstLoad && getPendingEchoes() > 0) {
        decrementPendingEchoes();
        return;
      }
      const val = snap.val();
      const nextData = val ? normalize(val) : emptyData();
      setAppData(nextData);

      // Save offline copy
      try {
        localStorage.setItem("moneyku_offline", JSON.stringify(nextData));
      } catch (err) {
        console.warn("Storage error", err);
      }

      if (reconcileAutoPaid()) {
        syncSet(getAppData());
      }

      if (firstLoad) {
        firstLoad = false;
        clampSelected();
        renderAll();
        // Full intro on first visit of a session; quick reveal afterwards or with reduced motion
        const quick =
          sessionStorage.getItem("moneyku_intro_seen") === "1" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTimeout(revealApp, quick ? 250 : 1600);
      } else {
        renderAll();
      }
    },
    (err) => {
      console.error("Firebase error", err);
      if (!getAppData()) {
        setAppData(emptyData());
        renderAll();
      }
      revealApp();
      // Persistent badge (the toast alone disappears after 2s)
      const badge = document.getElementById("offline-indicator");
      if (badge) badge.classList.remove("hidden");
      toast("Offline — loaded local cache", "error");
    }
  );

  // Safety fallback: reveal UI even if Firebase is sluggish
  setTimeout(() => {
    if (firstLoad) {
      firstLoad = false;
      if (!getAppData()) {
        setAppData(emptyData());
      }
      clampSelected();
      renderAll();
      revealApp();
    }
  }, 3500);
}

// Start application
boot();

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.log("SW Reg failed:", err));
  });
}
