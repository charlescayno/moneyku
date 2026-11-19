import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { applyChildOrder } from '../itemOps.js';
import { choosePayment, applyPayment, refundPayment, recordPayment, paidMessage, nameOf } from '../payfrom.js';
import { toggleArranging, getExpenseSort, setExpenseSort, accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, householdProjectedAt, includedWho, setWhoIncluded, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { openMore, selectMonth, statsGridHtml } from './components.js';
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
  scrollChipIntoView();
}

export function renderMonthNav() {
  const strip = $("month-strip");
  if (!strip) return;
  const tl = timeline();
  const sel = getSelectedKey(), nowK = currentKey();
  const keepScroll = strip.scrollLeft;
  const byYear = [];
  for (const k of tl) {
    const y = keyParts(k).y;
    if (!byYear.length || byYear[byYear.length - 1].y !== y) byYear.push({ y, keys: [] });
    byYear[byYear.length - 1].keys.push(k);
  }
  strip.innerHTML = byYear.map((g, i) => `<div class="mstrip-year${i ? " mstrip-sep" : ""}">
      <p class="mstrip-y">${g.y}</p>
      <div class="mstrip-months">${g.keys.map((k) => `<button type="button" role="tab" aria-selected="${k === sel}" data-action="selectMonth" data-arg0="${k}" data-k="${k}" class="mstrip-m${k === sel ? " on" : ""}${k === nowK ? " now" : ""}" style="text-transform:lowercase">${MONTHS_SHORT[keyParts(k).m]}</button>`).join("")}</div>
    </div>`).join("");
  strip.scrollLeft = keepScroll;
}
export function scrollChipIntoView() {
  const selectedKey = getSelectedKey();
  const btn = $("month-strip")?.querySelector(`[data-k="${selectedKey}"]`);
  const strip = $("month-strip");
  // Scroll only the month strip sideways (scrollIntoView could also scroll the whole page vertically)
  if (btn && strip) strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
}

export function renderMonthBanner() {
  const el = $("month-banner");
  if (!el) return;
  const nowK = currentKey();
  const selectedKey = getSelectedKey();
  if (selectedKey === nowK) { 
    el.innerHTML = ""; 
    el.classList.add("hidden"); 
    return; 
  }
  el.classList.remove("hidden");
  const label = `${monthName(selectedKey)} ${keyParts(selectedKey).y}`;
  el.innerHTML = `<div class="flex items-center justify-between gap-2 py-2 pl-4 pr-2 rounded-xl bg-indigo-500/10 border border-indigo-400/20">
    <span class="text-[11px] font-black uppercase tracking-wider text-indigo-300">Viewing ${label}</span>
    <button type="button" data-action="goToday" class="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-lg bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider"><span class="material-icons" style="font-size:14px">${cmpKey(selectedKey, nowK) > 0 ? "undo" : "redo"}</span>Back to ${monthShort(nowK)}</button>
  </div>`;
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
  if (moved) renderAll(); // account balances changed
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
  for (const who of ["charlie", "debt", "partner", "pdebt"]) {
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
  if (settled) {
    btn.classList.add("is-paid", "bg-emerald-500", "border-emerald-500");
    btn.classList.remove("border-slate-600");
    if (row) row.classList.add("opacity-60");
    if (name) name.classList.add("line-through");
    btn.classList.remove("paid-burst"); void btn.offsetWidth; btn.classList.add("paid-burst");
    if (row) { row.classList.remove("row-sweep"); void row.offsetWidth; row.classList.add("row-sweep"); setTimeout(() => row.classList.remove("row-sweep"), 750); }
  } else {
    btn.classList.remove("is-paid", "bg-emerald-500", "border-emerald-500");
    btn.classList.add("border-slate-600");
    if (row) row.classList.remove("opacity-60");
    if (name) name.classList.remove("line-through");
  }
}

export function refreshRealized() {
  const selectedKey = getSelectedKey();
  const t = monthTotals(selectedKey);
  const proj = $("sum-projected");
  const hideProjected = getHideProjected();
  if (proj) proj.textContent = hideProjected ? '••••••' : peso(householdProjectedAt(selectedKey));
  const sgn = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const pc = $("sum-projected-c"), pp = $("sum-projected-p");
  if (pc) pc.textContent = hideProjected ? "••••" : sgn(runningFundsAt(selectedKey, "charlie"));
  if (pp) pp.textContent = hideProjected ? "••••" : sgn(runningFundsAt(selectedKey, "partner"));
  const stats = $("sum-stats");
  if (stats) stats.innerHTML = statsGridHtml(t);
  const cardSlot = $("card-summary-slot");
  if (cardSlot) cardSlot.innerHTML = cardSummaryHtml();
}

// =============================
// Window Action Helpers
// =============================
export function togglePersonIncluded(who) {
  setWhoIncluded(who, !includedWho().includes(who)); // untick the last one and the other is ticked for you
  renderBudget();
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
