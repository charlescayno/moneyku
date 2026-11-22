import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { applyChildOrder } from '../itemOps.js';
import { choosePayment, applyPayment, refundPayment, recordPayment, paidMessage, nameOf } from '../payfrom.js';
import { refreshReminders } from '../calendar.js';
import { setSimIncomeScale, toggleArranging, getSimPersonSort, setSimPersonSort, getExpenseSort, setExpenseSort, accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, householdProjectedAt, includedWho, setWhoIncluded, getSimView, setSimView, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { openMore, parentSummaryText, refreshMore, selectMonth, statsGridHtml } from './components.js';
import { renderAll, renderBudget } from './layout.js';
import { cardSummaryHtml } from './cardui.js';
import { toast } from './core.js';

// =============================
// Navigation & Month Header
// =============================
export function updateHeader() {
  const selectedKey = getSelectedKey();
  $("current-month-display").textContent = monthName(selectedKey).toUpperCase();
  $("current-year-display").textContent = keyParts(selectedKey).y;
  applyDensityMode();
}

export function renderMonthStrip() {
  renderMonthNav();
  renderMonthBanner();
}

export function renderMonthNav() {
  const label = $("mn-label");
  if (!label) return;
  const tl = timeline();
  const k = getSelectedKey();
  label.firstChild.textContent = `${monthName(k)} ${keyParts(k).y}`;
  $("mn-prev").disabled = !tl.length || k <= tl[0];
  $("mn-next").disabled = !tl.length || k >= tl[tl.length - 1];
}

export function scrollChipIntoView() {
  const selectedKey = getSelectedKey();
  const btn = $("month-strip")?.querySelector(`[data-k="${selectedKey}"]`);
  const strip = $("month-strip");
  // Scroll only the month strip sideways (scrollIntoView could also scroll the whole page vertically)
  if (btn && strip) strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
}

// A "Back to today" pill on its own row under the month bar (not squeezed in next to the arrows).
// Only shown when another month is on screen; the arrows never move because it is not in their row.
export function renderMonthBanner() {
  const el = $("month-banner");
  if (!el) return;
  const k = getSelectedKey(), nowK = currentKey(), tl = timeline();
  const away = k !== nowK && tl.includes(nowK);
  el.innerHTML = away ? `<button type="button" id="mn-today" data-action="goToday" class="mn-today-pill"><span class="material-icons" aria-hidden="true">${cmpKey(k, nowK) > 0 ? "arrow_back" : "arrow_forward"}</span>back to today</button>` : "";
  el.classList.toggle("hidden", !away);
}

// =============================
// Quick Paid Interactions
// =============================
// One toggle at a time per item and month, so a double tap can never charge an account twice
const paidBusy = new Set();

export async function togglePaidQuick(event, id, kind) {
  const busyKey = `${getSelectedKey()}|${id}`;
  if (paidBusy.has(busyKey)) return;
  paidBusy.add(busyKey);
  const release = () => paidBusy.delete(busyKey);
  try { await togglePaidQuickRun(event, id, kind, release); } finally { release(); }
}

async function togglePaidQuickRun(event, id, kind, release = () => {}) {
  const btn = event.target ? event.target.closest("[data-action]") : event;
  const selectedKey = getSelectedKey();
  let appData = getAppData();
  appData.paid[selectedKey] = appData.paid[selectedKey] || {};
  const nowSettled = appData.paid[selectedKey][id] !== true;
  // Checking off an expense: ask which account it came out of (not asked for Maribank / GCash / BPI Debit)
  let plan = null;
  if (nowSettled) {
    plan = await choosePayment(selectedKey, [id], nameOf(id));
    if (plan === null) return; // cancelled, leave it unpaid
    appData = getAppData(); // a sync may have swapped the data while the chooser was open
    appData.paid[selectedKey] = appData.paid[selectedKey] || {};
    if ((appData.paid[selectedKey][id] === true) === nowSettled) return;
  }
  appData.paid[selectedKey][id] = nowSettled;
  const paidNow = nowSettled ? applyPayment(selectedKey, plan) : [];
  const given = nowSettled ? null : refundPayment(selectedKey, id);
  const moved = paidNow[0] || given;
  applyPaidVisual(btn, nowSettled);
  updateInstallmentBar(btn, id);
  updateParentBadge(id);
  
  const item = findItemOrChildById(id);
  if (item) {
    const row = btn.closest(".item-row");
    const amtEl = row?.querySelector(".child-amt") || row?.lastElementChild;
    if (amtEl) amtEl.textContent = peso(nowSettled ? itemFinal(item, selectedKey) : amountIn(item, selectedKey));
    const line = row?.querySelector(".child-spendline");
    if (line) line.style.display = nowSettled ? "none" : "flex";
  }
  if (nowSettled) {
    const valEl = btn.closest(".item-row")?.lastElementChild;
    flashLabel(valEl || btn, kind === "income" ? "Received!" : "Paid!");
  }
  refreshRealized();
  if (navigator.vibrate) navigator.vibrate(12);
  if (moved || btn.closest("#reminders")) renderAll(); // account balances changed, or paid from the reminders (redraw the list rows too)
  // The change is done locally; do not keep this item locked while the cloud write waits (offline it can wait forever)
  release();
  await syncSet(appData);
  const msg = nowSettled
    ? (paidNow[0] ? paidMessage(plan, paidNow) : kind === "income" ? "Marked received" : "Marked paid")
    : (given ? (given.amt < 0 ? `Marked unreceived - ${peso(-given.amt)} taken back from ${given.acctName}` : `Marked unpaid - ${peso(given.amt)} returned to ${given.acctName}`) : "Marked unpaid");
  toast(msg, "ok", {
    actionLabel: "Undo", duration: 4000,
    onAction: async () => {
      const d = getAppData();
      d.paid[selectedKey] = d.paid[selectedKey] || {};
      if ((d.paid[selectedKey][id] === true) !== nowSettled) return; // already changed again, nothing to undo
      d.paid[selectedKey][id] = !nowSettled;
      if (paidNow[0]) refundPayment(selectedKey, id);
      else if (given) recordPayment(selectedKey, id, given.acctId, given.amt);
      await syncSet(d);
      renderAll();
    },
  });
}

export async function togglePaidGroup(event, idsStr, k, kind) {
  event.stopPropagation();
  const ids = idsStr.split(",");
  if (!ids.length) return;
  let appData = getAppData();
  
  appData.paid[k] = appData.paid[k] || {};
  const allPaid = ids.every(id => appData.paid[k][id] === true);
  const targetState = !allPaid;
  
  // Marking every expense paid: Maribank / GCash / BPI Debit items are charged to their own account,
  // the rest are asked about once
  let plan = null;
  if (targetState) {
    plan = await choosePayment(k, ids, "All items");
    if (plan === null) return;
    appData = getAppData();
    appData.paid[k] = appData.paid[k] || {};
  }
  const changed = ids.filter((id) => (appData.paid[k][id] === true) !== targetState);
  const refunded = [];
  for (const id of ids) {
    appData.paid[k][id] = targetState;
    if (!targetState) { const g = refundPayment(k, id); if (g) refunded.push(g); }
  }
  const paidNow = targetState ? applyPayment(k, plan) : [];
  
  refreshRealized();
  renderAll();
  await syncSet(appData);
  const total = (paidNow.length ? paidNow : refunded).reduce((s, x) => s + x.amt, 0);
  if (paidNow.length) {
    toast(paidMessage(plan, paidNow), "ok", {
      actionLabel: "Undo", duration: 4000,
      onAction: async () => {
        const d = getAppData();
        for (const id of changed) {
          if (d.paid?.[k]?.[id] !== true) continue;
          d.paid[k][id] = false;
          refundPayment(k, id);
        }
        await syncSet(d);
        renderAll();
      },
    });
  }
  else if (refunded.length) toast(total < 0 ? `${peso(-total)} taken back from ${refunded[0].acctName}` : `${peso(total)} returned to ${refunded[0].acctName}`);
}

export function updateParentBadge(childId) {
  let parent = null;
  for (const who of ["charlie", "debt", "partner", "pdebt", "simulated"]) {
    for (const it of getItems(who, "expenses")) {
      if (getKids(it).some((c) => c.id === childId)) { parent = it; break; }
    }
    if (parent) break;
  }
  if (!parent) return;
  const details = document.querySelector(`details.item-parent[data-parent="${parent.id}"]`);
  if (!details) return;
  const kids = getKids(parent);
  const selectedKey = getSelectedKey();
  const paidCount = kids.filter((c) => isPaid(c.id, selectedKey)).length;
  const allPaid = kids.length > 0 && paidCount === kids.length;
  const sumEl = details.querySelector(".parent-sumtext");
  if (sumEl) sumEl.textContent = parentSummaryText(parent, selectedKey);
  const countEl = details.querySelector(".parent-paid-count");
  if (countEl) countEl.textContent = paidCount;
  const bar = details.querySelector(".parent-bar");
  if (bar) bar.style.width = (kids.length ? Math.round((paidCount / kids.length) * 100) : 0) + "%";
  const summary = details.querySelector("summary");
  const name = summary?.querySelector(".item-name");
  if (summary) summary.classList.toggle("opacity-70", allPaid);
  if (name) name.classList.toggle("line-through", allPaid);
}

export function updateInstallmentBar(btn, id) {
  const it = findItemById(id);
  if (!it || !it.recurring || !it.end) return;
  const row = btn.closest(".item-row");
  if (!row) return;
  const total = monthsInclusive(it.start, it.end);
  const paidM = monthsPaidCount(it);
  const fill = row.querySelector(".inst-bar-fill");
  const cnt = row.querySelector(".inst-bar-count");
  if (fill) fill.style.width = (total ? Math.round((paidM / total) * 100) : 0) + "%";
  if (cnt) cnt.textContent = `${paidM}/${total}`;
  const rem = row.querySelector(".inst-bar-rem");
  if (rem) {
    const toPay = Math.max(0, total - paidM) * (Number(it.amount) || 0);
    rem.textContent = toPay > 0 ? `· ${peso(toPay)} to pay in full` : "· fully paid";
  }
}

export function flashLabel(anchorEl, text) {
  const r = anchorEl.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "flash-label";
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top - 4}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

export function applyPaidVisual(btn, settled) {
  const row = btn.closest(".item-row");
  const name = row ? row.querySelector(".item-name") : null;
  const icon = btn.querySelector(".check-icon");
  if (settled) {
    // Sub-expense rows start with an invisible tick and a transparent box: make both visible (and remember to restore on undo)
    if (icon && icon.classList.contains("text-transparent")) {
      btn.dataset.bare = "1";
      btn.classList.remove("bg-transparent", "border-slate-700");
      icon.classList.remove("text-transparent", "opacity-0");
      icon.classList.add("text-white", "opacity-100");
    }
    btn.classList.add("is-paid", "bg-emerald-500", "border-emerald-500");
    btn.classList.remove("border-slate-600");
    if (row) row.classList.add("opacity-60");
    if (name) { name.classList.add("line-through"); if (name.classList.contains("text-slate-200")) name.classList.replace("text-slate-200", "text-slate-500"); }
    btn.classList.remove("paid-burst"); void btn.offsetWidth; btn.classList.add("paid-burst");
    if (row) { row.classList.remove("row-sweep"); void row.offsetWidth; row.classList.add("row-sweep"); setTimeout(() => row.classList.remove("row-sweep"), 750); }
  } else {
    btn.classList.remove("is-paid", "bg-emerald-500", "border-emerald-500");
    if (btn.dataset.bare === "1" && icon) {
      delete btn.dataset.bare;
      btn.classList.add("bg-transparent", "border-slate-700");
      icon.classList.remove("text-white", "opacity-100");
      icon.classList.add("text-transparent", "opacity-0");
    }
    btn.classList.add("border-slate-600");
    if (row) row.classList.remove("opacity-60");
    if (name) { name.classList.remove("line-through"); if (name.classList.contains("text-slate-500")) name.classList.replace("text-slate-500", "text-slate-200"); }
  }
}

export function refreshRealized() {
  if (getSimView()) { renderBudget(); return; } // the simulated hero has its own numbers: redraw it
  const selectedKey = getSelectedKey();
  const t = monthTotals(selectedKey);
  const proj = $("sum-projected");
  const hideProjected = getHideProjected();
  if (proj) proj.textContent = hideProjected ? '••••••' : (() => { const n = householdProjectedAt(selectedKey); return n < 0 ? '-' + peso(-n) : peso(n); })();
  if (proj && !hideProjected && householdProjectedAt(selectedKey) < -0.005) { proj.classList.remove("text-white", "text-emerald-300", "text-amber-300", "text-blue-300", "text-ynah"); proj.classList.add("text-rose-400"); }
  const sgn = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const pc = $("sum-projected-c"), pp = $("sum-projected-p");
  if (pc) pc.textContent = hideProjected ? "••••" : sgn(runningFundsAt(selectedKey, "charlie"));
  if (pp) pp.textContent = hideProjected ? "••••" : sgn(runningFundsAt(selectedKey, "partner"));
  const pa = $("sum-projected-all");
  if (pa) pa.textContent = hideProjected ? "••••" : sgn(runningFundsAt(selectedKey, "charlie") + runningFundsAt(selectedKey, "partner"));
  const stats = $("sum-stats");
  if (stats) stats.innerHTML = statsGridHtml(t);
  refreshReminders(); // a bill marked paid leaves the reminders
  const cardSlot = $("card-summary-slot");
  if (cardSlot) cardSlot.innerHTML = cardSummaryHtml();
  refreshMore(); // an open Overview (installments) follows every paid tick
}

// =============================
// Window Action Helpers
// =============================
export function togglePersonIncluded(who) {
  setSimView(false); // picking a person leaves the simulation
  setWhoIncluded(who, !includedWho().includes(who)); // untick the last one and the other is ticked for you
  renderBudget();
}

/** Tapping a person's tile shows only that person; tapping Together shows everyone. */
export function focusPerson(who) {
  setSimView(false); // picking a person (or Together) leaves the simulation
  setWhoIncluded("charlie", who === "all" || who === "charlie");
  setWhoIncluded("partner", who === "all" || who === "partner");
  renderBudget();
}

/** The (i) icon in the projected card header opens or closes the "explain the numbers" breakdown. */
export function toggleExplain() {
  const d = document.querySelector("#budget-body details[data-persist=proj-details]");
  if (d) d.open = !d.open;
}

export function toggleProjected() {
  setHideProjected(!getHideProjected());
  renderBudget();
}

export function toggleArrange(parentId) {
  toggleArranging(parentId);
  renderBudget();
}

// Save the order produced by dragging. `orderIds` is the new order of the sub-items shown this month.
export async function reorderChildren(who, parentId, orderIds) {
  const appData = getAppData();
  const parent = getItems(who, "expenses").find((x) => x.id === parentId);
  if (!appData || !parent) return;
  const shown = getKids(parent, getSelectedKey()).map((c) => c.id);
  const changed = applyChildOrder(parent, shown, orderIds);
  renderBudget();
  if (changed) await syncSet(appData);
}

// Save the order produced by dragging income / expense rows. `orderIds` are the rows of one list (same category) in the new order.
export async function reorderItems(who, kind, orderIds) {
  const appData = getAppData();
  if (!appData) return;
  const items = getItems(who, kind);
  let changed = false;
  orderIds.forEach((id, i) => {
    const it = items.find((x) => x.id === id);
    if (it && it.ord !== i + 1) { it.ord = i + 1; changed = true; }
  });
  renderBudget();
  if (changed) await syncSet(appData);
}

export function resetSimIncome() { setSimIncomeScale(100); renderBudget(); }

// Slider (pesos added on top of the entered income): the labels follow the finger; the numbers and projection refresh when it is released
const sliderScale = (el) => {
  const entered = Number(el.dataset.entered) || 0;
  const d = Number(el.value);
  return entered > 0 && Math.abs(d) >= 1 ? ((entered + d) / entered) * 100 : 100;
};
document.addEventListener("input", (e) => {
  if (e.target?.id !== "sim-inc-slider") return;
  const d = Number(e.target.value), entered = Number(e.target.dataset.entered) || 0;
  const lab = document.getElementById("sim-inc-pct");
  if (lab) lab.textContent = Math.abs(d) < 1 ? peso(0) : signedPeso(d);
  const tot = document.getElementById("sim-inc-total");
  if (tot) tot.innerHTML = `${peso(entered)} entered${Math.abs(d) < 1 ? "" : ` &rarr; ${peso(entered + d)}`}`;
});
document.addEventListener("change", (e) => {
  if (e.target?.id !== "sim-inc-slider") return;
  setSimIncomeScale(sliderScale(e.target));
  renderBudget();
});

export function toggleSimPerson() {
  setSimPersonSort(!getSimPersonSort());
  renderBudget();
}

export function toggleExpenseSort() {
  setExpenseSort(getExpenseSort() === "name" ? "default" : "name");
  renderBudget();
}

export function toggleInvestments() {
  setHideInvestments(!getHideInvestments());
  renderBudget();
  if ($("more-overlay")?.classList.contains("open")) {
    openMore();
  }
}

export function prevOverviewPage() {
  const p = getOverviewPage();
  if (p > 0) {
    setOverviewPage(p - 1);
    renderBudget();
    if ($("more-overlay")?.classList.contains("open")) {
      openMore();
    }
  }
}

export function nextOverviewPage() {
  const p = getOverviewPage();
  const maxPage = Math.ceil(timeline().length / 6) - 1;
  if (p < maxPage) {
    setOverviewPage(p + 1);
    renderBudget();
    if ($("more-overlay")?.classList.contains("open")) {
      openMore();
    }
  }
}

export function jumpOverviewYear(selectElem) {
  const y = parseInt(selectElem.value, 10);
  const currentY = keyParts(getSelectedKey()).y;
  const yearDiff = y - currentY;
  const pageIndex = yearDiff * 2;
  if (pageIndex >= 0) {
    setOverviewPage(pageIndex);
    renderBudget();
    if ($("more-overlay")?.classList.contains("open")) {
      openMore();
    }
  }
}

export function exportData() {
  const appData = getAppData();
  if (!appData) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", "moneyku_backup_" + new Date().toISOString().split('T')[0] + ".json");
  dlAnchorElem.click();
}

// =============================
// Density Mode Helpers
// =============================
export function getDensityMode() {
  return "comfortable"; // the Compact view was removed; always Comfortable
}

export function applyDensityMode(mode) {
  const density = mode || getDensityMode();
  document.body.setAttribute("data-density", density);
  const icon = document.getElementById("density-icon");
  const btn = document.getElementById("density-toggle-btn");
  if (icon) {
    icon.textContent = density === "compact" ? "view_cozy" : "view_compact";
  }
  if (btn) {
    btn.title = density === "compact" ? "Density: Compact (click for Comfortable)" : "Density: Comfortable (click for Compact)";
  }
}

export function toggleDensityMode() {
  const current = getDensityMode();
  const next = current === "compact" ? "comfortable" : "compact";
  localStorage.setItem("moneyku_density", next);
  applyDensityMode(next);
  toast(`Switched to ${next.charAt(0).toUpperCase() + next.slice(1)} Mode`, "info");
}
