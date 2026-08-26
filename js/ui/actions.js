import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { renderProjectionChart } from '../charts.js';
import { openMore, projectionInnerHtml, selectMonth, statsGridHtml } from './components.js';
import { renderAll, renderBudget } from './layout.js';

// =============================
// Navigation & Month Header
// =============================
export function updateHeader() {
  const selectedKey = getSelectedKey();
  $("current-month-display").textContent = monthName(selectedKey).toUpperCase();
  $("current-year-display").textContent = keyParts(selectedKey).y;
}

export function renderMonthStrip() {
  const strip = $("month-strip");
  if (!strip) return;
  const nowK = currentKey();
  const selectedKey = getSelectedKey();
  strip.innerHTML = timeline().map((k) => {
    const active = k === selectedKey;
    const isNow = k === nowK;
    const cls = active
      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 ring-2 ring-indigo-400/60"
      : "bg-slate-800/60 text-slate-400";
    const year = keyParts(k).y;
    return `<button data-action="selectMonth" data-arg0="${k}" data-k="${k}"
      class="month-chip ${isNow ? "is-now" : ""} flex-shrink-0 relative px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wide transition-colors ${cls}">
      ${isNow ? '<span class="now-banner">Now</span>' : ""}
      <div class="flex flex-col items-center">
        <span>${monthShort(k)}</span>
        <span class="text-[9px] opacity-60 tracking-[0.1em] mt-0.5">${year}</span>
      </div>
    </button>`;
  }).join("");
  renderMonthBanner();
}

export function scrollChipIntoView() {
  const selectedKey = getSelectedKey();
  const btn = $("month-strip")?.querySelector(`[data-k="${selectedKey}"]`);
  if (btn) btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
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
  const jump = timeline().includes(nowK)
    ? `<button data-action="selectMonth" data-arg0="${nowK}" class="text-[11px] font-black uppercase tracking-wider text-white bg-indigo-500/80 hover:bg-indigo-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow-lg shadow-indigo-900/30 transition-colors"><span class="material-icons" style="font-size:15px">undo</span>Back to ${monthShort(nowK)}</button>`
    : "";
  el.innerHTML = `<div class="flex items-center justify-between gap-2 py-2 pl-4 pr-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
    <span class="text-[11px] font-black uppercase tracking-wider text-amber-400">Viewing ${label}</span>
    ${jump}
  </div>`;
}

// =============================
// Quick Paid Interactions
// =============================
export async function togglePaidQuick(event, id, kind) {
  const btn = event.target ? event.target.closest("[data-action]") : event;
  const appData = getAppData();
  const selectedKey = getSelectedKey();
  appData.paid[selectedKey] = appData.paid[selectedKey] || {};
  const nowSettled = appData.paid[selectedKey][id] !== true;
  appData.paid[selectedKey][id] = nowSettled;
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
  await syncSet(appData);
}

export async function togglePaidGroup(event, idsStr, k, kind) {
  event.stopPropagation();
  const ids = idsStr.split(",");
  if (!ids.length) return;
  const appData = getAppData();
  
  appData.paid[k] = appData.paid[k] || {};
  const allPaid = ids.every(id => appData.paid[k][id] === true);
  const targetState = !allPaid;
  
  for (const id of ids) {
    appData.paid[k][id] = targetState;
  }
  
  refreshRealized();
  renderAll();
  await syncSet(appData);
}

export function updateParentBadge(childId) {
  let parent = null;
  for (const who of ["charlie", "debt"]) {
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
  if (proj) proj.textContent = hideProjected ? '••••••' : peso(runningFundsAt(selectedKey));
  const stats = $("sum-stats");
  if (stats) stats.innerHTML = statsGridHtml(t);
  const pi = $("projection-inner");
  if (pi) pi.innerHTML = projectionInnerHtml();
}

// =============================
// Window Action Helpers
// =============================
export function toggleProjected() {
  setHideProjected(!getHideProjected());
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
  const maxPage = Math.ceil(HORIZON / 6) - 1;
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