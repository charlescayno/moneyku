// =============================
// UI Components & View Renderers
// =============================

import {
  HORIZON,
  MONTHS,
  MONTHS_SHORT,
  OWNERS,
  CATEGORY_LABELS,
  BANK_LABELS,
  PM_LABELS,
  BRAND_DOMAINS,
  BANK_DOMAINS,
  generateId,
  $,
  peso,
  signedPeso,
  ordinal,
  parseDueDay,
  dueDayFor,
  escapeHtml,
  parseMathAmount,
  mkKey,
  keyParts,
  addMonths,
  cmpKey,
  monthName,
  monthShort,
  currentKey,
  monthsInclusive,
  bankIconFor,
  brandIconFor,
  iconFor,
  categoryIcon,
} from "./utils.js";

import {
  getAppData,
  setAppData,
  getSelectedKey,
  setSelectedKey,
  getActiveEdit,
  setActiveEdit,
  getHideProjected,
  setHideProjected,
  getHideInvestments,
  setHideInvestments,
  getOverviewPage,
  setOverviewPage,
  timeline,
  clampSelected,
  getItems,
  itemActiveIn,
  amountIn,
  hasOverride,
  isPaid,
  accountsTotal,
  getKids,
  getSpendList,
  spentIn,
  childFinal,
  itemFinal,
  itemTotal,
  itemAmts,
  monthTotals,
  runningFundsAt,
  currentMoneyAt,
  allInstallments,
  monthsPaidCount,
  sortItems,
  itemCategory,
  findItemById,
  findItemOrChildById,
} from "./state.js";

import { syncSet } from "./firebase.js";
import { renderProjectionChart } from "./charts.js";
import { upcomingBillsWidgetHtml, openCalendarModal, closeCalendarModal } from "./calendar.js";

// =============================
// Toast & Notifications
// =============================
let toastTimer = null;
export function toast(msg, type = "ok") {
  const t = $("toast");
  if (!t) return;
  $("toast-text").textContent = msg;
  const icon = $("toast-icon");
  icon.textContent = type === "error" ? "error" : "check_circle";
  icon.className = `material-icons text-lg ${type === "error" ? "text-rose-400" : "text-emerald-400"}`;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}

// =============================
// DOM Morphing & Updates
// =============================
export function updateDOM(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.morphdom) {
    const wrapper = el.cloneNode(false);
    wrapper.innerHTML = html;
    window.morphdom(el, wrapper, {
      onBeforeNodeDiscarded: function (node) {
        if (node.classList && node.classList.contains("item-card")) {
          const rect = node.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            node.classList.add("animate-out");
            setTimeout(() => {
              if (node.parentNode) node.parentNode.removeChild(node);
            }, 200);
            return false;
          }
        }
        return true;
      },
      onNodeAdded: function (node) {
        if (node.classList && node.classList.contains("item-card")) {
          node.classList.add("animate-in");
        }
        return node;
      },
    });
  } else {
    el.innerHTML = html;
  }
}

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
// Row Icons & Components
// =============================
export function rowIconHtml(name, sz, kind = "expenses", noBg = false) {
  const brand = iconFor(name);
  if (brand && BRAND_DOMAINS[brand]) {
    if (noBg) return `<div class="flex items-center justify-center flex-shrink-0" style="width:${sz}px;height:${sz}px"><img src="https://www.google.com/s2/favicons?domain=${BRAND_DOMAINS[brand]}&sz=128" alt="" class="w-4/5 h-4/5 object-contain grayscale opacity-60" /></div>`;
    return `<div class="rounded-lg overflow-hidden flex-shrink-0" style="width:${sz}px;height:${sz}px"><img src="https://www.google.com/s2/favicons?domain=${BRAND_DOMAINS[brand]}&sz=128" alt="" class="w-full h-full object-cover bg-white" /></div>`;
  }
  const cat = categoryIcon(name);
  const iconName = cat || (kind === "income" ? "payments" : "receipt_long");
  
  if (noBg) return `<span class="material-icons text-slate-500 flex-shrink-0 flex items-center justify-center" style="font-size:${Math.round(sz * 0.85)}px; width:${sz}px; height:${sz}px;">${iconName}</span>`;
  
  if (cat) return `<div class="rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0" style="width:${sz}px;height:${sz}px"><span class="material-icons text-slate-300" style="font-size:${Math.round(sz * 0.62)}px">${cat}</span></div>`;
  return `<div class="rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center flex-shrink-0" style="width:${sz}px;height:${sz}px"><span class="material-icons text-slate-500" style="font-size:${Math.round(sz * 0.62)}px">${iconName}</span></div>`;
}

export function childRowHtml(parentId, c, k, who, kind = "expenses") {
  const paid = isPaid(c.id, k);
  const est = Number(c.amount) || 0;
  const spent = spentIn(c.id, k);
  const hasSpend = getSpendList(c.id, k).length > 0;
  const over = spent > est;
  const pct = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (spent > 0 ? 100 : 0);
  const remaining = est - spent;
  const rightMain = paid ? childFinal(c, k) : est;
  
  const spendLine = (hasSpend && !paid)
    ? `<div class="child-spendline flex items-center gap-2 mt-1">
        <div class="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-[100px]"><div class="h-full ${over ? "bg-rose-500" : "bg-emerald-400"} rounded-full" style="width:${pct}%"></div></div>
        <span class="text-[10px] font-bold ${over ? "text-rose-400" : "text-emerald-400"}">${over ? `over ${peso(-remaining)}` : `${peso(remaining)} left`}</span>
      </div>`
    : "";
    
  return `<div data-child="${c.id}" data-action="openChildModal" data-arg0="${who}" data-arg1="${parentId}" data-arg2="${c.id}" class="item-row flex items-center gap-4 py-2.5 px-6 cursor-pointer hover:bg-white/5 transition-colors">
    <button data-action="togglePaidQuick" data-arg0="${c.id}" data-arg1="expenses" title="Mark paid" class="paid-check ${paid ? "is-paid bg-emerald-500/20 border-emerald-500" : "bg-transparent border-slate-700"} w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors">
      <span class="material-icons check-icon ${paid ? "text-emerald-400 opacity-100" : "text-transparent opacity-0"} transition-opacity" style="font-size:14px">check</span>
    </button>
    ${rowIconHtml(c.name, 20, kind, true)}
    <div class="flex-1 min-w-0">
      <span class="item-name block text-sm font-bold ${paid ? "text-slate-500 line-through" : "text-slate-200"} truncate">${escapeHtml(c.name)}</span>
      ${spendLine}
    </div>
    <span class="child-amt text-sm font-black ${paid ? "text-slate-600 line-through" : "text-slate-300"} flex-shrink-0">${peso(rightMain)}</span>
  </div>`;
}

export function parentRowHtml(it, k, kind, who, opts = {}) {
  const kids = getKids(it);
  const total = itemTotal(it, k);
  const paidCount = kids.filter((c) => isPaid(c.id, k)).length;
  const allPaid = kids.length > 0 && paidCount === kids.length;
  const pct = kids.length ? Math.round((paidCount / kids.length) * 100) : 0;
  const icon = opts.hideIcon ? null : iconFor(it.name);
  const iconInner = icon
    ? `<img src="assets/banks/${icon}.png" alt="" class="w-full h-full object-cover" />`
    : `<span class="material-icons text-white" style="font-size:24px">home_work</span>`;
  const iconBg = icon ? "bg-slate-800" : "bg-gradient-to-br from-fuchsia-500 to-purple-600";
  const childRows = kids.map((c) => childRowHtml(it.id, c, k, who, kind)).join("");
  const kidsIds = kids.map(c => c.id).join(",");
  
  return `<details open class="item-parent group bg-[#1c2136] rounded-[1.25rem] border border-slate-700/60 overflow-hidden my-3 shadow-xl" data-parent="${it.id}" data-who="${who}">
    <summary class="parent-summary flex items-center gap-4 p-5 cursor-pointer list-none ${allPaid ? "opacity-70" : ""}">
      <div class="acct-icon w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-lg">${iconInner}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="item-name text-lg font-black text-white truncate ${allPaid ? "line-through" : ""}">${escapeHtml(it.name)}</p>
          <span class="parent-caret material-icons text-slate-500 transition-transform duration-300 group-open:-rotate-180" style="font-size:20px">expand_more</span>
        </div>
        <div class="flex items-center gap-3 mt-1.5">
          <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[120px]"><div class="parent-bar h-full bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full transition-all duration-300" style="width:${pct}%"></div></div>
          <span class="text-[10px] font-black text-purple-300 uppercase tracking-widest"><span class="parent-paid-count">${paidCount}</span>/${kids.length} paid</span>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1 flex-shrink-0">
        <p class="text-lg font-black text-white">${peso(total)}</p>
        <button data-action="togglePaidGroup" data-arg0="${kidsIds}" data-arg1="${k}" data-arg2="${kind}" title="${kind === 'income' ? 'Mark all received' : 'Mark all paid'}" class="text-slate-500 hover:text-purple-400 transition-colors flex items-center gap-1 ${allPaid ? "text-purple-500" : ""}">
          <span class="material-icons" style="font-size:16px">${allPaid ? "done_all" : "checklist"}</span>
        </button>
      </div>
    </summary>
    <div class="pb-4 pt-1 space-y-0 relative">
      ${childRows}
      <div class="px-6 mt-3">
        <button data-action="openChildModal" data-arg0="${who}" data-arg1="${it.id}" class="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1"><span class="material-icons" style="font-size:16px">add</span>Add sub-expense</button>
      </div>
    </div>
  </details>`;
}

export function itemRowHtml(it, k, kind, who, opts = {}) {
  if (getKids(it).length) return parentRowHtml(it, k, kind, who, opts);
  const settled = isPaid(it.id, k);
  const est = amountIn(it, k);
  const spent = spentIn(it.id, k);
  const hasSpend = getSpendList(it.id, k).length > 0;
  const amt = settled ? itemFinal(it, k) : est;

  const remaining = est - spent;
  const over = remaining < 0;
  const pctAmount = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (spent > 0 ? 100 : 0);

  const spendLine = (hasSpend && !settled)
    ? `<div class="child-spendline flex items-center gap-2 mt-1">
        <div class="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-[100px]"><div class="h-full ${over ? "bg-rose-500" : "bg-emerald-400"} rounded-full" style="width:${pctAmount}%"></div></div>
        <span class="text-[10px] font-bold ${over ? "text-rose-400" : "text-emerald-400"}">${over ? `over ${peso(-remaining)}` : `${peso(remaining)} left`}</span>
      </div>`
    : "";

  const iconHtml = opts.hideIcon ? "" : rowIconHtml(it.name, 28, kind);
  const installment = it.recurring && it.end;
  const dd = dueDayFor(it);
  const tags = [];
  if (!opts.hidePaymentTag) {
    if (it.paymentMethod === "bpi_platinum") {
      tags.push(`<span class="text-[9px] font-black text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-0.5">💳 BPI Platinum</span>`);
    } else if (it.paymentMethod === "cc_other") {
      tags.push(`<span class="text-[9px] font-black text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600 flex items-center gap-0.5">💳 Credit Card</span>`);
    }
  }
  
  if (it.txDate) {
    tags.push(`<span class="text-[9px] font-black text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">event</span>${it.txDate}</span>`);
  }
  
  if (installment) tags.push(`<span class="text-[9px] font-bold text-amber-400/80">→ ${monthShort(it.end)}</span>`);
  else if (it.recurring && dd != null) tags.push(`<span class="text-[9px] font-bold text-sky-300 uppercase tracking-wide flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">event_available</span>${ordinal(dd)}</span>`);
  else if (it.recurring) tags.push(`<span class="text-[9px] font-bold text-indigo-300/90 uppercase tracking-wide flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">autorenew</span>Recurring</span>`);
  
  let progress = "";
  if (installment) {
    const total = monthsInclusive(it.start, it.end);
    const paidM = monthsPaidCount(it);
    const pct = total ? Math.round((paidM / total) * 100) : 0;
    progress = `<div class="flex items-center gap-2 mt-1.5 max-w-[220px]">
      <div class="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden"><div class="inst-bar-fill h-full bg-gradient-to-r ${OWNERS[who].grad} rounded-full" style="width:${pct}%"></div></div>
      <span class="inst-bar-count text-[9px] font-bold text-slate-500 flex-shrink-0">${paidM}/${total}</span>
    </div>`;
  }
  return `<div data-action="openItemModal" data-arg0="${who}" data-arg1="${kind}" data-arg2="${it.id}"
    class="item-row flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors cursor-pointer ${settled ? "opacity-60" : ""}">
    <button data-action="togglePaidQuick" data-arg0="${it.id}" data-arg1="${kind}" title="${kind === "income" ? "Mark received" : "Mark paid"}" class="paid-check ${settled ? "is-paid bg-emerald-500 border-emerald-500" : "border-slate-600"} w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border">
      <span class="material-icons check-icon text-white" style="font-size:16px">check</span>
    </button>
    ${iconHtml}
    <div class="flex-1 min-w-0">
      <p class="item-name text-sm font-bold text-slate-200 truncate ${settled ? "line-through" : ""}">${escapeHtml(it.name)}</p>
      ${spendLine}
      ${tags.length ? `<div class="flex gap-2 mt-0.5">${tags.join("")}</div>` : ""}
      ${progress}
    </div>
    <p class="text-sm font-black ${kind === "income" ? "text-emerald-400" : "text-white"} flex-shrink-0">${peso(amt)}</p>
  </div>`;
}

export function categoryGroupedHtml(items, k, kind, who) {
  if (!items.length) return "";
  const sorted = sortItems(items);
  const showHeaders = new Set(sorted.map(itemCategory)).size > 1;
  
  const buckets = {};
  for (const it of sorted) {
    const c = itemCategory(it);
    (buckets[c] = buckets[c] || []).push(it);
  }
  
  let html = "";
  for (const cStr of Object.keys(buckets).sort((a, b) => Number(a) - Number(b))) {
    const c = Number(cStr);
    const list = buckets[c];
    const subtotal = list.reduce((s, it) => s + amountIn(it, k), 0);
    const rowsHtml = list.map(it => itemRowHtml(it, k, kind, who)).join("");
    
    if (showHeaders) {
      html += `<details open class="group mb-1">
        <summary class="flex justify-between items-center px-3 pt-2 pb-1 cursor-pointer list-none select-none hover:bg-slate-800/30 rounded-lg outline-none -ml-2 -mr-2 mb-0.5">
          <div class="flex items-center gap-1.5 ml-2">
            <span class="material-icons text-[14px] text-slate-500 transition-transform group-open:rotate-90">chevron_right</span>
            <p class="text-xs font-black uppercase tracking-[0.2em] text-slate-500">${CATEGORY_LABELS[c]}</p>
          </div>
          <p class="text-sm font-black text-slate-500 mr-2">${peso(subtotal)}</p>
        </summary>
        <div class="space-y-0.5">
          ${rowsHtml}
        </div>
      </details>`;
    } else {
      html += rowsHtml;
    }
  }
  return html;
}

export function paymentMethodGroupHtml(pm, list, k, kind, who) {
  const total = list.reduce((s, it) => s + amountIn(it, k), 0);
  const allPaid = list.length > 0 && list.every(it => isPaid(it.id, k));
  const idsStr = list.map(it => it.id).join(",");
  const subs = sortItems(list).map((it) => itemRowHtml(it, k, kind, who, { hidePaymentTag: true })).join("");
  const label = PM_LABELS[pm] || pm;
  return `<details open class="py-1 mt-1 group">
    <summary class="flex justify-between items-center px-3 py-2 bg-indigo-900/10 hover:bg-indigo-900/20 rounded-xl cursor-pointer list-none select-none outline-none">
      <div class="flex items-center gap-2">
        <span class="material-icons text-[14px] text-indigo-400 transition-transform group-open:rotate-90">chevron_right</span>
        <div class="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
          <span class="text-[14px]">💳</span>
        </div>
        <p class="text-sm font-black text-indigo-300 flex-1 min-w-0 truncate">${label}</p>
      </div>
      <div class="flex items-center gap-3">
        <button data-action="togglePaidGroup" data-arg0="${idsStr}" data-arg1="${k}" data-arg2="${kind}" title="${kind === 'income' ? 'Mark all received' : 'Mark all paid'}" class="paid-check ${allPaid ? "is-paid bg-emerald-500 border-emerald-500" : "border-slate-600"} w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border">
          <span class="material-icons check-icon text-white" style="font-size:16px">check</span>
        </button>
        <p class="text-sm font-black text-indigo-300 flex-shrink-0">${peso(total)}</p>
      </div>
    </summary>
    <div class="ml-8 pl-3 border-l border-indigo-700/30 space-y-0.5 mt-2">${subs}</div>
  </details>`;
}

export function bankGroupHtml(bank, list, k, kind, who) {
  const total = list.reduce((s, it) => s + amountIn(it, k), 0);
  const subs = sortItems(list).map((it) => itemRowHtml(it, k, kind, who, { hideIcon: true })).join("");
  return `<div class="py-1">
    <div class="flex items-center gap-3 px-3 py-2">
      <div class="acct-icon flex-shrink-0"><img src="assets/banks/${bank}.png" alt="" class="w-full h-full object-cover" /></div>
      <p class="text-sm font-black text-white flex-1 min-w-0 truncate">${BANK_LABELS[bank] || bank}</p>
      <p class="text-sm font-black text-white flex-shrink-0">${peso(total)}</p>
    </div>
    <div class="ml-4 pl-3 border-l border-slate-700/60 space-y-0.5">${subs}</div>
  </div>`;
}

export function groupedRowsHtml(items, k, kind, who) {
  if (!items.length) return `<p class="text-[11px] text-slate-600 px-3 py-2">No ${kind === "income" ? "income" : "expenses"} this month</p>`;
  let html = "";
  const parents = items.filter((it) => getKids(it).length);
  for (const it of parents) html += itemRowHtml(it, k, kind, who);
  const rest = items.filter((it) => !getKids(it).length);
  
  const grouped = new Set();
  
  const pmBuckets = {}, pmOrder = [];
  for (const it of rest) {
    if (it.paymentMethod && it.paymentMethod !== 'cash' && it.paymentMethod !== 'none') {
      const pm = it.paymentMethod;
      (pmBuckets[pm] = pmBuckets[pm] || []).push(it);
    }
  }
  for (const it of rest) {
    const pm = it.paymentMethod;
    if (pm && pm !== 'cash' && pm !== 'none' && pmBuckets[pm].length > 1 && !pmOrder.includes(pm)) pmOrder.push(pm);
  }
  for (const pm of pmOrder) { 
    pmBuckets[pm].forEach((it) => grouped.add(it.id)); 
    html += paymentMethodGroupHtml(pm, pmBuckets[pm], k, kind, who); 
  }

  const buckets = {}, order = [];
  for (const it of rest) { 
    if (grouped.has(it.id)) continue;
    const b = bankIconFor(it.name); 
    if (b) (buckets[b] = buckets[b] || []).push(it); 
  }
  for (const it of rest) { 
    if (grouped.has(it.id)) continue;
    const b = bankIconFor(it.name); 
    if (b && buckets[b].length > 1 && !order.includes(b)) order.push(b); 
  }
  for (const b of order) { 
    buckets[b].forEach((it) => grouped.add(it.id)); 
    html += bankGroupHtml(b, buckets[b], k, kind, who); 
  }
  
  html += categoryGroupedHtml(rest.filter((it) => !grouped.has(it.id)), k, kind, who);
  return html;
}

export function personSectionHtml(who) {
  const o = OWNERS[who];
  const k = getSelectedKey();
  const income = getItems(who, "income").filter((it) => itemActiveIn(it, k));
  const expenses = getItems(who, "expenses").filter((it) => itemActiveIn(it, k));
  const t = monthTotals(k);
  const incTot = who === "charlie" ? t.cI : t.dI;
  const expTot = who === "charlie" ? t.cE : t.dE;
  const net = incTot - expTot;
  const incHtml = groupedRowsHtml(income, k, "income", who);
  const expHtml = groupedRowsHtml(expenses, k, "expenses", who);

  let debtSectionHtml = "";
  if (who === "charlie") {
    const debtIncome = getItems("debt", "income").filter((it) => itemActiveIn(it, k));
    const debtExpenses = getItems("debt", "expenses").filter((it) => itemActiveIn(it, k));
    const debtIncTot = t.dI;
    const debtExpTot = t.dE;
    const debtIncHtml = groupedRowsHtml(debtIncome, k, "income", "debt");
    const debtExpHtml = groupedRowsHtml(debtExpenses, k, "expenses", "debt");
    const dO = OWNERS.debt;

    debtSectionHtml = `
      <div class="border-t border-white/[0.08] pt-3 mt-1">
        <details open class="group bg-slate-900/50 rounded-xl border border-rose-500/20 overflow-hidden">
          <summary class="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none hover:bg-white/[0.02] transition-colors">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span class="material-icons text-white" style="font-size:15px">handshake</span>
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-xs font-black uppercase tracking-wider text-white">Debt Tracker</h4>
                  <span class="material-icons text-slate-500 transition-transform group-open:rotate-180" style="font-size:14px">expand_more</span>
                </div>
                <p class="text-[9px] text-slate-400">Money owed to me &amp; I owe others</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-[11px] font-black text-rose-400">${peso(debtIncTot)} <span class="text-slate-500 font-normal">/</span> ${peso(debtExpTot)}</p>
            </div>
          </summary>
          <div class="p-3 pt-2 space-y-3 bg-slate-950/40 border-t border-white/[0.04]">
            <details open class="group">
              <summary class="flex items-center justify-between px-2 mb-1 cursor-pointer list-none select-none">
                <div class="flex items-center gap-1.5">
                  <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:14px">chevron_right</span>
                  <div class="flex items-baseline gap-2">
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Money Owed To Me</p>
                    <span class="text-xs font-bold text-emerald-400">${peso(debtIncTot)}</span>
                  </div>
                </div>
                <button data-action="openItemModal" data-arg0="debt" data-arg1="income" class="text-[11px] font-bold ${dO.text} flex items-center gap-1 transition-transform"><span class="material-icons" style="font-size:14px">add</span>Add</button>
              </summary>
              <div class="space-y-0.5 mt-2">${debtIncHtml}</div>
            </details>
            <div class="border-t border-white/[0.04] pt-2">
              <details open class="group">
                <summary class="flex items-center justify-between px-2 mb-1 cursor-pointer list-none select-none">
                  <div class="flex items-center gap-1.5">
                    <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:14px">chevron_right</span>
                    <div class="flex items-baseline gap-2">
                      <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Money I Owe Others</p>
                      <span class="text-xs font-bold text-rose-400">${peso(debtExpTot)}</span>
                    </div>
                  </div>
                  <button data-action="openItemModal" data-arg0="debt" data-arg1="expenses" class="text-[11px] font-bold ${dO.text} flex items-center gap-1 transition-transform"><span class="material-icons" style="font-size:14px">add</span>Add</button>
                </summary>
                <div class="space-y-0.5 mt-2">${debtExpHtml}</div>
              </details>
            </div>
          </div>
        </details>
      </div>`;
  }

  return `<div class="glass-card rounded-2xl overflow-hidden border ${o.ring} md:col-span-2">
    <div class="flex items-center justify-between px-5 py-4 bg-gradient-to-r ${o.grad} bg-opacity-10">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${o.grad} ring-2 ring-white/25 flex-shrink-0 flex items-center justify-center">
          <span class="text-sm font-black text-white">${o.label.charAt(0)}</span>
        </div>
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wide">${o.label}</h3>
          ${who === 'debt' ? '' : `<p class="text-[10px] font-bold ${net >= 0 ? "text-emerald-400" : "text-rose-400"}">net ${net >= 0 ? "+" : ""}${peso(net)}</p>`}
        </div>
      </div>
      ${who === 'debt' ? '' : `
      <div class="text-right">
        <p class="text-[9px] font-bold uppercase text-white/60">in / out</p>
        <p class="text-[11px] font-black text-white">${peso(incTot)} <span class="text-white/40">-</span> ${peso(expTot)}</p>
      </div>`}
    </div>
    <div class="p-3 space-y-3">
      <details open class="group">
        <summary class="flex items-center justify-between px-3 mb-1 cursor-pointer list-none select-none">
          <div class="flex items-center gap-1.5">
            <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:14px">chevron_right</span>
            <div class="flex items-baseline gap-2">
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">${who === "debt" ? "Money Owed To Me" : "Income"}</p>
              <span class="text-xs font-bold text-emerald-400">${peso(incTot)}</span>
            </div>
          </div>
          <button data-action="openItemModal" data-arg0="${who}" data-arg1="income" class="text-[11px] font-bold ${o.text} flex items-center gap-1 transition-transform"><span class="material-icons" style="font-size:14px">add</span>Add</button>
        </summary>
        <div class="space-y-0.5 mt-2">${incHtml}</div>
      </details>
      <div class="border-t border-white/[0.04] pt-3">
        <details open class="group">
          <summary class="flex items-center justify-between px-3 mb-1 cursor-pointer list-none select-none">
            <div class="flex items-center gap-1.5">
              <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:14px">chevron_right</span>
              <div class="flex items-baseline gap-2">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">${who === "debt" ? "Money I Owe Others" : "Expenses"}</p>
                <span class="text-xs font-bold text-rose-400">${peso(expTot)}</span>
              </div>
            </div>
            <button data-action="openItemModal" data-arg0="${who}" data-arg1="expenses" class="text-[11px] font-bold ${o.text} flex items-center gap-1 transition-transform"><span class="material-icons" style="font-size:14px">add</span>Add</button>
          </summary>
          <div class="space-y-0.5 mt-2">${expHtml}</div>
        </details>
      </div>
      ${debtSectionHtml}
    </div>
  </div>`;
}

// =============================
// Accounts Card & Renderers
// =============================
export function acctIconHtml(a) {
  const bank = bankIconFor(a.name);
  const ownerKey = "charlie";
  const o = OWNERS[ownerKey] || OWNERS.charlie;
  const letter = escapeHtml((a.name || "?").trim().charAt(0).toUpperCase() || "?");
  const inner = bank
    ? `<img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[bank]}&sz=128" alt="" class="w-full h-full object-cover bg-white" />`
    : `<span class="text-lg font-black text-white">${letter}</span>`;
  const bg = bank ? "" : "bg-gradient-to-br from-indigo-500 to-violet-600";
  return `<div class="acct-icon-wrap">
    <div class="acct-icon ${bg}">${inner}</div>
    <div class="acct-owner-badge flex items-center justify-center bg-gradient-to-br ${o.grad} text-[8px] font-black text-white">${o.label.charAt(0)}</div>
  </div>`;
}

export function acctRowHtml(a) {
  const o = OWNERS[a.owner] || OWNERS.charlie;
  return `<div data-action="openAccountModal" data-arg0="${a.id}" class="item-row flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer">
    ${acctIconHtml(a)}
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-200 truncate">${escapeHtml(a.name)}</p>
      <span class="text-[9px] font-bold uppercase ${o.text}">${o.label}</span>
    </div>
    <p class="text-sm font-black text-white flex-shrink-0">${peso(a.amount)}</p>
  </div>`;
}

export function acctGroupHtml(g) {
  const total = g.items.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const bank = bankIconFor(g.name);
  const letter = escapeHtml((g.name || "?").trim().charAt(0).toUpperCase() || "?");
  const inner = bank
    ? `<img src="assets/banks/${bank}.png" alt="" class="w-full h-full object-cover" />`
    : `<span class="text-lg font-black text-white">${letter}</span>`;
  const bg = bank ? "" : "bg-gradient-to-br from-indigo-500 to-violet-600";
  const subs = g.items.map((a) => {
    const o = OWNERS.charlie;
    return `<div data-action="openAccountModal" data-arg0="${a.id}" class="item-row flex items-center gap-2 py-1.5 pl-2 rounded-lg cursor-pointer">
      <div class="w-5 h-5 rounded-full bg-gradient-to-br ${o.grad} flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
        <span class="text-[10px] font-black text-white">${o.label.charAt(0)}</span>
      </div>
      <span class="text-[10px] font-bold uppercase ${o.text} flex-1">${o.label}</span>
      <span class="text-sm font-black text-white flex-shrink-0">${peso(a.amount)}</span>
    </div>`;
  }).join("");
  return `<div class="px-3 pt-2.5 pb-1.5 rounded-xl">
    <div class="flex items-center gap-3">
      <div class="acct-icon ${bg} flex-shrink-0">${inner}</div>
      <p class="text-sm font-bold text-slate-200 flex-1 min-w-0 truncate">${escapeHtml(g.name)}</p>
      <p class="text-sm font-black text-white flex-shrink-0">${peso(total)}</p>
    </div>
    <div class="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-0.5">${subs}</div>
  </div>`;
}

export function accountsCardHtml() {
  const appData = getAppData();
  const accts = appData?.accounts || [];
  const groups = [];
  const idx = {};
  for (const a of accts) {
    const key = bankIconFor(a.name) || (a.name || "").trim().toLowerCase();
    if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, name: a.name, items: [] }); }
    groups[idx[key]].items.push(a);
  }
  const rows = accts.length
    ? groups.map((g) => (g.items.length > 1 ? acctGroupHtml(g) : acctRowHtml(g.items[0]))).join("")
    : `<p class="text-[11px] text-slate-600 px-3 py-2">No accounts yet — add your current balances.</p>`;
  return `<details open class="glass-card rounded-2xl overflow-hidden border border-emerald-500/10 md:col-span-2">
    <summary class="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-600 flex items-center justify-center">
          <span class="material-icons text-white" style="font-size:18px">account_balance</span>
        </div>
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wide">Accounts</h3>
          <p class="text-[10px] text-slate-400">Starting balances on hand</p>
        </div>
      </div>
      <p class="text-base font-black text-emerald-400">${peso(accountsTotal())}</p>
    </summary>
    <div class="p-3 pt-0 space-y-0.5">
      ${rows}
      <button data-action="openAccountModal" class="w-full mt-2 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl font-bold text-emerald-400 text-[11px] flex items-center justify-center gap-1 transition-transform"><span class="material-icons" style="font-size:16px">add</span>Add account</button>
    </div>
  </details>`;
}

// =============================
// Investments & Live Rates
// =============================
export function investmentsCardHtml() {
  const appData = getAppData();
  const inv = appData?.investments || { customPowiPrice: null, customUsdPhp: null, cachedPowi: 53.18, cachedUsdPhp: 58.20 };
  const shares = 99;
  const pendingShares = 36;
  const isCustomPrice = !!inv.customPowiPrice;
  const isCustomRate = !!inv.customUsdPhp;
  const price = parseFloat(inv.customPowiPrice) || parseFloat(inv.cachedPowi) || 53.18;
  const rate = parseFloat(inv.customUsdPhp) || parseFloat(inv.cachedUsdPhp) || 58.20;
  const hideInvestments = getHideInvestments();
  
  let asOfDate = "";
  if (inv.lastFetch) {
    asOfDate = new Date(inv.lastFetch).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  
  const totalUsd = shares * price;
  const totalPhp = totalUsd * rate;

  const pendingUsd = pendingShares * price;
  const pendingPhp = pendingUsd * rate;
  
  return `<details open class="glass-card rounded-2xl overflow-hidden border border-amber-500/10 md:col-span-2 mt-4">
    <summary class="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <span class="material-icons text-white" style="font-size:18px">trending_up</span>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-black text-white uppercase tracking-wide">Investments</h3>
            <button data-action="toggleInvestments" class="text-white/40 hover:text-white transition-colors focus:outline-none flex items-center justify-center">
              <span class="material-icons" style="font-size: 14px">${hideInvestments ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p class="text-[10px] text-slate-400">POWI Stock Holdings ${asOfDate ? `<span class="text-emerald-400/90 ml-1 font-semibold">· Updated ${asOfDate}</span>` : ''}</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-base font-black text-amber-400">${hideInvestments ? '••••••' : peso(totalPhp)}</p>
        <p class="text-[10px] text-slate-500 font-bold">${hideInvestments ? '••••••' : '$' + totalUsd.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
      </div>
    </summary>
    <div class="p-4 pt-0 space-y-3">
      <div class="bg-slate-900/40 rounded-xl p-3 space-y-2.5">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-xs font-bold text-slate-300">Vested Holdings</p>
            <p class="text-[10px] text-slate-500">Power Integrations (POWI)</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-black text-white">${shares} <span class="text-slate-500 text-xs font-semibold">shares</span></p>
            <p class="text-[10px] text-slate-400 font-bold">${hideInvestments ? '••••••' : peso(totalPhp)} <span class="text-slate-500 font-normal">${hideInvestments ? '' : `($${totalUsd.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})})`}</span></p>
          </div>
        </div>
        <div class="pt-2 border-t border-white/5 flex justify-between items-center">
          <div class="flex items-center gap-1.5">
            <span class="material-icons text-emerald-400" style="font-size:15px">hourglass_top</span>
            <div>
              <p class="text-xs font-bold text-emerald-400">Expected Apr 2027</p>
              <p class="text-[10px] text-slate-500">+${pendingShares} units vesting</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-black text-emerald-400">${hideInvestments ? '••••••' : peso(pendingPhp)}</p>
            <p class="text-[10px] text-emerald-500/80 font-bold">${hideInvestments ? '••••••' : '$' + pendingUsd.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1 bg-slate-900/40 rounded-xl p-3">
          <div class="flex items-center justify-between mb-1">
            <p class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Stock Price</p>
            ${isCustomPrice ? '<span class="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold">Custom</span>' : '<span class="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-bold">Live</span>'}
          </div>
          <p class="text-sm font-black text-slate-200">$${price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
        </div>
        <div class="flex-1 bg-slate-900/40 rounded-xl p-3">
          <div class="flex items-center justify-between mb-1">
            <p class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">USD to PHP</p>
            ${isCustomRate ? '<span class="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold">Custom</span>' : '<span class="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded font-bold">Live</span>'}
          </div>
          <p class="text-sm font-black text-slate-200">₱${rate.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
        </div>
      </div>
      <div class="flex gap-2 mt-2">
        <button data-action="refreshInvestmentRates" class="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl font-bold text-emerald-400 text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
          <span class="material-icons" style="font-size:16px">sync</span>Update Now
        </button>
        <button data-action="openInvestmentModal" class="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl font-bold text-amber-400 text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
          <span class="material-icons" style="font-size:16px">edit</span>Edit Rates
        </button>
      </div>
    </div>
  </details>`;
}

let isFetchingRates = false;

export async function fetchInvestmentRates(force = false) {
  if (isFetchingRates) return;
  const appData = getAppData();
  if (!appData) return;
  if (!appData.investments) {
    appData.investments = { customPowiPrice: null, customUsdPhp: null, cachedPowi: 53.18, cachedUsdPhp: 58.20, lastFetch: 0 };
  }
  const now = Date.now();
  // If not forced and updated in the last 30 seconds, debounce to prevent request spam
  if (!force && now - (appData.investments.lastFetch || 0) < 30000 && appData.investments.cachedPowi > 0) {
    return;
  }
  
  isFetchingRates = true;
  let changed = false;
  
  // 1. Fetch POWI Stock Price with fallback endpoints
  const powiEndpoints = [
    "https://query1.finance.yahoo.com/v8/finance/chart/POWI",
    "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/POWI"),
    "https://corsproxy.io/?" + encodeURIComponent("https://query1.finance.yahoo.com/v8/finance/chart/POWI")
  ];
  
  for (const url of powiEndpoints) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice || meta?.chartPreviousClose || meta?.previousClose;
      if (price && typeof price === "number" && price > 0) {
        if (appData.investments.cachedPowi !== price) {
          appData.investments.cachedPowi = price;
          changed = true;
        }
        break;
      }
    } catch (e) {
      // try next endpoint
    }
  }
  
  // 2. Fetch USD to PHP Exchange Rate with fallbacks
  const rateEndpoints = [
    "https://open.er-api.com/v6/latest/USD",
    "https://api.exchangerate-api.com/v4/latest/USD"
  ];
  
  for (const url of rateEndpoints) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) continue;
      const data = await res.json();
      const php = data?.rates?.PHP;
      if (php && typeof php === "number" && php > 0) {
        if (appData.investments.cachedUsdPhp !== php) {
          appData.investments.cachedUsdPhp = php;
          changed = true;
        }
        break;
      }
    } catch (e) {
      // try next endpoint
    }
  }
  
  appData.investments.lastFetch = now;
  isFetchingRates = false;
  
  await syncSet(appData);
  renderBudget();
  if ($("more-overlay")?.classList.contains("open")) {
    openMore();
  }
}

export async function refreshInvestmentRates() {
  toast("Updating live market rates...", "info");
  await fetchInvestmentRates(true);
  const appData = getAppData();
  const inv = appData?.investments || {};
  const price = inv.cachedPowi ? `$${inv.cachedPowi.toFixed(2)}` : "";
  const rate = inv.cachedUsdPhp ? `₱${inv.cachedUsdPhp.toFixed(2)}` : "";
  toast(`Rates updated: ${price} · ${rate}`, "success");
}

// =============================
// Overview & Stats
// =============================
export function monthOverviewCardHtml() {
  const selectedKey = getSelectedKey();
  const currentY = keyParts(selectedKey).y;
  const overviewPage = getOverviewPage();
  const keys = timeline();
  let bal = accountsTotal();
  
  const series = keys.map((k) => {
    const t = monthTotals(k);
    bal += t.netPending;
    return { k, bal, savings: t.savings };
  });

  const maxPage = Math.ceil(series.length / 6) - 1;
  const safePage = Math.max(0, Math.min(overviewPage, maxPage));
  const pageItems = series.slice(safePage * 6, safePage * 6 + 6);
  
  let rowsHtml = '';
  pageItems.forEach(s => {
    const { y, m } = keyParts(s.k);
    const savColor = s.savings > 0.005 ? "text-emerald-400" : s.savings < -0.005 ? "text-rose-400" : "text-rose-600";
    rowsHtml += `
      <div class="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <span class="text-[11px] font-bold text-slate-300 uppercase tracking-wide">${MONTHS_SHORT[m]} ${y}</span>
        <div class="text-right">
          <p class="text-[13px] font-black text-white">${peso(s.bal)}</p>
          <p class="text-[9px] font-bold ${savColor}">${s.savings > 0 ? '+' : ''}${peso(s.savings)} net</p>
        </div>
      </div>
    `;
  });
  
  let yearSelectHtml = `<select data-action="jumpOverviewYear" data-arg0="this" class="bg-transparent text-[10px] font-bold text-slate-400 uppercase tracking-wide outline-none appearance-none cursor-pointer">`;
  const endY = keyParts(keys[keys.length - 1]).y || 2046;
  for (let y = currentY; y <= endY; y++) {
    yearSelectHtml += `<option value="${y}" ${pageItems[0] && keyParts(pageItems[0].k).y === y ? 'selected' : ''}>${y}</option>`;
  }
  yearSelectHtml += `</select>`;

  return `<details open class="glass-card rounded-2xl overflow-hidden border border-spider-blue/10 md:col-span-2 mt-4">
    <summary class="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center">
          <span class="material-icons text-white" style="font-size:18px">calendar_month</span>
        </div>
        <div>
          <h3 class="text-sm font-black text-white uppercase tracking-wide">Overview to ${endY}</h3>
          <p class="text-[10px] text-slate-400">Projected Monthly Balances</p>
        </div>
      </div>
    </summary>
    <div class="p-4 pt-0">
      <div class="bg-slate-900/40 rounded-xl p-3 mb-3">
        ${rowsHtml}
      </div>
      
      <div class="flex items-center justify-between px-2">
        <button data-action="prevOverviewPage" class="text-xs font-bold ${safePage > 0 ? 'text-emerald-400' : 'text-slate-600'} flex items-center" ${safePage === 0 ? 'disabled' : ''}>
          <span class="material-icons" style="font-size:14px">chevron_left</span> Prev
        </button>
        
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-slate-500 uppercase font-bold">Year</span>
          ${yearSelectHtml}
        </div>
        
        <button data-action="nextOverviewPage" class="text-xs font-bold ${safePage < maxPage ? 'text-emerald-400' : 'text-slate-600'} flex items-center" ${safePage === maxPage ? 'disabled' : ''}>
          Next <span class="material-icons" style="font-size:14px">chevron_right</span>
        </button>
      </div>
    </div>
  </details>`;
}

export function statsGridHtml(t) {
  const current = currentMoneyAt();
  const savColor = t.savings > 0.005 ? "text-emerald-400" : t.savings < -0.005 ? "text-rose-400" : "text-amber-300";
  const cell = (icon, iconColor, label, valColor, val) =>
    `<div class="bg-black/20 rounded-2xl px-4 py-3">
      <div class="flex items-center gap-1.5">
        <span class="material-icons ${iconColor}" style="font-size:13px">${icon}</span>
        <p class="text-[9px] font-bold uppercase text-white/60">${label}</p>
      </div>
      <p class="text-base font-black ${valColor} mt-1">${val}</p>
    </div>`;
  return (
    cell("account_balance_wallet", "text-white/70", "Current Money", "text-white", peso(current)) +
    cell("savings", savColor, "Savings", savColor, signedPeso(t.savings)) +
    cell("south_west", "text-emerald-400", "To receive", "text-emerald-400", signedPeso(t.toReceive)) +
    cell("north_east", "text-rose-400", "To pay", "text-rose-400", signedPeso(-t.toPay))
  );
}

// =============================
// Dashboard Main Renderer
// =============================
export function renderBudget() {
  const k = getSelectedKey();
  const t = monthTotals(k);
  const projected = runningFundsAt(k);
  const hideProjected = getHideProjected();

  const summary = `<section class="md:col-span-2 rounded-3xl overflow-hidden relative shadow-xl">
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700"></div>
    <div class="ambient-glow" style="top:-30px;right:60px"></div>
    <div class="relative p-6 md:p-7 space-y-5">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Projected · end of ${monthName(k)}</p>
            <button data-action="toggleProjected" class="text-white/40 hover:text-white transition-colors focus:outline-none flex items-center justify-center">
              <span class="material-icons" style="font-size: 14px">${hideProjected ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p id="sum-projected" class="text-3xl sm:text-4xl md:text-5xl font-black text-white mt-1 leading-none truncate">${hideProjected ? '••••••' : peso(projected)}</p>
        </div>
      </div>
      <div id="sum-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3">${statsGridHtml(t)}</div>
      ${(Math.abs(t.debtToReceive) > 0.005 || Math.abs(t.debtToPay) > 0.005) ? `
      <div id="debt-stats" class="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
        <div class="bg-black/20 rounded-2xl px-4 py-3">
          <div class="flex items-center gap-1.5">
            <span class="material-icons text-indigo-300" style="font-size:13px">arrow_downward</span>
            <p class="text-[9px] font-bold uppercase text-white/60">Owed To Me</p>
          </div>
          <p class="text-base font-black text-indigo-300 mt-1">${signedPeso(t.debtToReceive)}</p>
        </div>
        <div class="bg-black/20 rounded-2xl px-4 py-3">
          <div class="flex items-center gap-1.5">
            <span class="material-icons text-orange-300" style="font-size:13px">arrow_upward</span>
            <p class="text-[9px] font-bold uppercase text-white/60">I Owe Others</p>
          </div>
          <p class="text-base font-black text-orange-300 mt-1">${signedPeso(-t.debtToPay)}</p>
        </div>
      </div>` : ''}
    </div>
  </section>`;

  const upcomingWidget = upcomingBillsWidgetHtml();

  $("budget-body").innerHTML =
    summary +
    upcomingWidget +
    accountsCardHtml() +
    personSectionHtml("charlie");
}

export function renderAll() {
  const appData = getAppData();
  if (!appData) return;
  clampSelected();
  updateHeader();
  renderMonthStrip();
  renderBudget();
  fetchInvestmentRates();
}

// =============================
// Installments & Projection
// =============================
export function installmentsCardHtml() {
  const insts = allInstallments();
  if (!insts.length) return "";
  let grandRemaining = 0, grandMonthly = 0;
  const rows = insts.map((it) => {
    const o = OWNERS[it.who];
    const total = monthsInclusive(it.start, it.end);
    const monthsPaid = monthsPaidCount(it);
    const monthsLeft = Math.max(0, total - monthsPaid);
    const monthly = Number(it.amount) || 0;
    const remaining = monthly * monthsLeft;
    const pct = total ? Math.round((monthsPaid / total) * 100) : 0;
    grandRemaining += remaining; if (monthsLeft > 0) grandMonthly += monthly;
    const urgency = monthsLeft === 0 ? "text-emerald-400 bg-emerald-500/15" : monthsLeft <= 6 ? "text-rose-400 bg-rose-500/15" : monthsLeft <= 12 ? "text-amber-400 bg-amber-500/15" : "text-slate-400 bg-slate-500/15";
    return `<div class="px-3 py-2.5 rounded-xl space-y-2">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2"><p class="text-sm font-bold text-slate-200 truncate">${escapeHtml(it.name)}</p><span class="text-[9px] font-bold uppercase ${o.text}">${o.label}</span></div>
          <p class="text-[10px] text-slate-500">${monthShort(it.start)} → ${monthShort(it.end)} · ${peso(monthly)}/mo · ${peso(remaining)} left</p>
        </div>
        <span class="text-[10px] font-black px-2.5 py-1 rounded-lg ${urgency} uppercase flex-shrink-0">${monthsLeft === 0 ? "Done" : monthsLeft + " mo left"}</span>
      </div>
      <div class="h-2 bg-slate-900/60 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r ${o.grad} rounded-full" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
  return `<details open class="glass-card rounded-2xl overflow-hidden border border-fuchsia-500/15 md:col-span-2">
    <summary class="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center"><span class="material-icons text-white" style="font-size:18px">hourglass_top</span></div>
        <div><h3 class="text-sm font-black text-white uppercase tracking-wide">Installments</h3><p class="text-[10px] text-slate-400">${insts.length} running · ${peso(grandMonthly)}/mo</p></div>
      </div>
      <p class="text-base font-black text-fuchsia-300">${peso(grandRemaining)}</p>
    </summary>
    <div class="p-3 pt-0 space-y-1">${rows}</div>
  </details>`;
}

export function projectionInnerHtml() {
  const keys = timeline();
  let bal = accountsTotal();
  const series = keys.map((k) => { const t = monthTotals(k); bal += t.netPending; return { k, bal, savings: t.savings, income: t.income }; });
  const years = {};
  series.forEach((s) => { const y = keyParts(s.k).y; years[y] = years[y] || { income: 0, savings: 0, endBal: s.bal }; years[y].income += s.income; years[y].savings += s.savings; years[y].endBal = s.bal; });
  const yearCards = Object.entries(years).map(([y, v]) => `
    <div class="bg-slate-900/40 rounded-xl p-3 flex items-center justify-between">
      <div><p class="text-sm font-black text-white">${y}</p><p class="text-[10px] text-slate-500">end ${peso(v.endBal)}</p></div>
      <div class="text-right"><p class="text-[9px] uppercase text-slate-500 font-bold">Saved</p><p class="text-xs font-black ${v.savings >= 0 ? "text-emerald-400" : "text-amber-400"}">${v.savings >= 0 ? "+" : ""}${peso(v.savings)}</p></div>
    </div>`).join("");
  return `
    <div class="h-48 mb-4">
      <canvas id="projectionChart"></canvas>
    </div>
    <div class="space-y-2">${yearCards}</div>
  `;
}

export function projectionCardHtml() {
  const endBal = runningFundsAt(timeline()[HORIZON - 1]);
  return `<details open class="glass-card rounded-2xl overflow-hidden border border-indigo-500/10 md:col-span-2">
    <summary class="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center"><span class="material-icons text-white" style="font-size:18px">trending_up</span></div>
        <div><h3 class="text-sm font-black text-white uppercase tracking-wide">5-Year Projection</h3><p class="text-[10px] text-slate-400">Running balance + yearly savings</p></div>
      </div>
      <p class="text-base font-black text-indigo-300">${peso(endBal)}</p>
    </summary>
    <div id="projection-inner" class="p-4 pt-0 space-y-4">${projectionInnerHtml()}</div>
  </details>`;
}

export function openMore() {
  const body = $("more-body");
  const inst = installmentsCardHtml() || `<div class="glass-card rounded-2xl p-6 text-center text-[12px] text-slate-500">No installments yet — add an expense with a "runs until" month.</div>`;
  body.innerHTML = `
    ${investmentsCardHtml()}
    ${monthOverviewCardHtml()}
    ${inst}
    ${projectionCardHtml()}
  `;
  body.querySelectorAll("details").forEach((d) => (d.open = true));
  const ov = $("more-overlay");
  ov.classList.add("open");
  
  setTimeout(() => {
    renderProjectionChart();
  }, 10);
  fetchInvestmentRates();
}

export function closeMore() {
  $("more-overlay").classList.remove("open");
}

export function selectMonth(k) {
  setSelectedKey(k);
  updateHeader();
  renderMonthStrip();
  renderBudget();
  scrollChipIntoView();
  if ($("month-picker").classList.contains("open")) toggleMonthPicker();
}

export function toggleMonthPicker() {
  const mp = $("month-picker");
  const open = mp.classList.toggle("open");
  mp.style.opacity = open ? "1" : "0";
  mp.style.pointerEvents = open ? "auto" : "none";
  if (open) {
    const years = {};
    const selectedKey = getSelectedKey();
    timeline().forEach((k) => { const y = keyParts(k).y; (years[y] = years[y] || []).push(k); });
    $("month-picker-grid").innerHTML = Object.entries(years).map(([y, keys]) => `
      <div>
        <p class="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">${y}</p>
        <div class="grid grid-cols-3 gap-3">
          ${keys.map((k) => `<button data-action="selectMonth" data-arg0="${k}" class="py-4 rounded-2xl font-black text-sm ${k === selectedKey ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"} transition-transform">${MONTHS_SHORT[keyParts(k).m]}</button>`).join("")}
        </div>
      </div>`).join("");
  }
}

// =============================
// Modals — Inputs & Forms
// =============================
export function inputBlock(label, id, value, type = "text", extra = "") {
  return `<div class="space-y-1">
    <label class="text-[10px] font-bold uppercase text-slate-500 ml-1">${label}</label>
    <input type="${type}" id="${id}" value="${escapeHtml(value)}" ${extra}
      class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-lg font-black text-white focus:outline-none" />
  </div>`;
}

export function monthSelect(id, value, includeOngoing, minKey) {
  const opts = [];
  if (includeOngoing) opts.push(`<option value="">Ongoing (no end)</option>`);
  timeline().forEach((k) => {
    if (minKey && cmpKey(k, minKey) < 0) return;
    const label = `${monthName(k)} ${keyParts(k).y}`;
    opts.push(`<option value="${k}" ${k === value ? "selected" : ""}>${label}</option>`);
  });
  return opts.join("");
}

export function updateBpiCcMonth(isExistingInit = false) {
  const method = $("f-paymethod") ? $("f-paymethod").value : "cash";
  const box = $("bpi-cc-box");
  if (!box) return;

  if (method !== "bpi_platinum") {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");

  const txDay = parseInt($("f-txday")?.value || "15", 10);
  const cutoff = parseInt($("f-cutoff")?.value || "14", 10);

  const baseK = getSelectedKey() || currentKey();
  const { y, m } = keyParts(baseK);

  let cutoffDate = new Date(y, m, cutoff);
  if (txDay > cutoff) {
    cutoffDate = new Date(y, m + 1, cutoff);
  }

  const dueDate = new Date(cutoffDate.getTime());
  dueDate.setDate(dueDate.getDate() + 20);

  const targetK = mkKey(dueDate.getFullYear(), dueDate.getMonth());

  if (!isExistingInit) {
    const startSelect = $("f-start");
    if (startSelect) {
      startSelect.value = targetK;
    }

    const dueDayInput = $("f-dueday");
    if (dueDayInput) {
      dueDayInput.value = dueDate.getDate();
    }
  }

  const hintEl = $("bpi-cc-hint");
  if (hintEl) {
    const cutMonth = MONTHS_SHORT[cutoffDate.getMonth()];
    const dueMonth = MONTHS[dueDate.getMonth()];
    hintEl.innerHTML = `💡 Charge on ${MONTHS_SHORT[m]} ${ordinal(txDay)} → Statement Cut-off ${cutMonth} ${ordinal(cutoff)} → <b>Placed in ${dueMonth} ${dueDate.getFullYear()} budget</b> (Due on ${MONTHS_SHORT[dueDate.getMonth()]} ${ordinal(dueDate.getDate())}).`;
  }
}

export function openModalShell() {
  $("save-btn").onclick = saveModal;
  const ov = $("modal-overlay");
  ov.classList.add("open");
}

export function closeModal() {
  $("modal-overlay").classList.remove("open");
  setActiveEdit(null);
}

export function openItemModal(who, kind, id) {
  const list = getItems(who, kind);
  const it = id ? list.find((x) => x.id === id) : null;
  const isNew = !it;
  const o = OWNERS[who];
  const selectedKey = getSelectedKey();
  setActiveEdit({ kind: "item", who, type: kind, id });

  const recurring = it ? it.recurring !== false : true;
  const start = it ? it.start : selectedKey;
  const end = it && it.end ? it.end : "";
  const name = it ? it.name : "";
  const amount = it ? amountIn(it, selectedKey) : "";
  const settledNow = it ? isPaid(it.id, selectedKey) : false;

  let title = isNew ? `Add ${kind === "income" ? "Income" : "Expense"}` : "Edit";
  if (who === "debt" && isNew) {
    title = kind === "income" ? "Add Person (They owe me)" : "Add Person (I owe them)";
  }
  $("modal-title").textContent = title;
  $("modal-title").className = `text-2xl font-black uppercase tracking-tight ${o.text}`;

  const kids = it ? getKids(it) : [];
  let body = "";
  body += inputBlock(kind === "income" ? "Source" : (who === "debt" ? "Name" : "Name"), "f-name", name, "text", 'placeholder="e.g. Rent"');
  if (kids.length) {
    body += `<div class="space-y-1"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Amount (₱)</label>
      <div class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-base font-black text-slate-300">${peso(itemTotal(it, selectedKey))} <span class="text-[11px] font-bold text-slate-500">· sum of ${kids.length} sub-expenses</span></div></div>`;
  } else {
    body += inputBlock("Amount (₱)", "f-amount", amount, "text", 'inputmode="text" placeholder="0"');
  }

  body += `<div class="flex items-center justify-between bg-slate-900 rounded-2xl px-5 py-4">
    <div><p class="text-sm font-bold text-white">Recurring</p><p class="text-[10px] text-slate-500">Repeats every month</p></div>
    <button type="button" id="f-recurring" data-on="${recurring}" data-action="toggleField" data-arg0="this" class="w-14 h-8 rounded-full transition-colors ${recurring ? "bg-indigo-600" : "bg-slate-700"} relative flex-shrink-0">
      <span class="absolute top-1 ${recurring ? "left-7" : "left-1"} w-6 h-6 bg-white rounded-full transition-all"></span>
    </button>
  </div>`;

  const payMethod = it ? (it.paymentMethod || "cash") : "cash";
  const txDayVal = it ? (it.txDay || 15) : 15;
  const cutoffDayVal = it ? (it.cutoffDay || 14) : 14;

  if (kind === "expenses") {
    body += `<div class="space-y-1">
      <label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Payment Method / Category</label>
      <select id="f-paymethod" data-action="updateBpiCcMonth" class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-base font-bold text-white focus:outline-none">
        <option value="cash" ${payMethod === "cash" ? "selected" : ""}>Cash / Bank / E-Wallet</option>
        <option value="bpi_platinum" ${payMethod === "bpi_platinum" ? "selected" : ""}>💳 BPI Platinum Rewards Mastercard</option>
        <option value="cc_other" ${payMethod === "cc_other" ? "selected" : ""}>💳 Other Credit Card</option>
      </select>
    </div>`;

    const txDateVal = it ? (it.txDate || "") : "";

    body += `<div id="bpi-cc-box" class="${payMethod === "bpi_platinum" ? "" : "hidden"} p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-3">
      <div class="flex items-center gap-2 text-indigo-300 text-xs font-black">
        <span class="material-icons text-sm">credit_card</span>
        <span>BPI Credit Card Auto-Scheduling</span>
      </div>
      <div>
        <label class="text-[10px] font-bold uppercase text-slate-400">Date of Purchase</label>
        <input type="date" id="f-txdate" value="${txDateVal}" class="w-full bg-slate-900 rounded-xl py-2.5 px-3 text-sm font-bold text-white focus:outline-none" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[10px] font-bold uppercase text-slate-400">Charge Day</label>
          <input type="number" id="f-txday" min="1" max="31" value="${txDayVal}" data-action="updateBpiCcMonth" class="w-full bg-slate-900 rounded-xl py-2.5 px-3 text-sm font-bold text-white focus:outline-none" />
        </div>
        <div>
          <label class="text-[10px] font-bold uppercase text-slate-400">Cut-off Day</label>
          <input type="number" id="f-cutoff" min="1" max="31" value="${cutoffDayVal}" data-action="updateBpiCcMonth" class="w-full bg-slate-900 rounded-xl py-2.5 px-3 text-sm font-bold text-white focus:outline-none" />
        </div>
      </div>
      <div id="bpi-cc-hint" class="text-[11px] text-indigo-200/80 font-medium bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-500/20"></div>
    </div>`;
  }

  body += `<div class="space-y-1"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Starts</label>
    <select id="f-start" class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-base font-bold text-white focus:outline-none">${monthSelect("f-start", start, false)}</select></div>`;

  body += `<div class="space-y-1" id="f-end-wrap"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Runs until <span class="text-amber-400">(installment)</span></label>
    <select id="f-end" class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-base font-bold text-white focus:outline-none">${monthSelect("f-end", end, true, start)}</select></div>`;

  const ddVal = it ? (dueDayFor(it) ?? "") : "";
  body += `<div class="space-y-1"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Auto-completes on day <span class="text-slate-600">(1-31, optional)</span></label>
    <input type="number" id="f-dueday" min="1" max="31" inputmode="numeric" value="${ddVal}" placeholder="e.g. 29" class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-base font-bold text-white focus:outline-none" /></div>`;

  if (!isNew && recurring && !kids.length) {
    body += `<div class="space-y-1"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Apply amount to</label>
      <select id="f-scope" class="w-full bg-slate-900 rounded-2xl py-4 px-5 text-base font-bold text-white focus:outline-none">
        <option value="all">All months</option>
        <option value="future">This and future months</option>
        <option value="month" ${hasOverride(id, selectedKey) ? "selected" : ""}>${monthName(selectedKey)} ${keyParts(selectedKey).y} only</option>
      </select></div>`;
  }

  if (!isNew && !kids.length) {
    if (kind === "expenses") {
      body += `<div id="spend-section">${spendSectionHtml(it)}</div>`;
    }
    const verb = kind === "income" ? "Received" : "Paid";
    let hint = kind === "income" ? "Mark this month's income received" : "Mark this month settled";
    if (kind === "expenses") {
      hint = `Locks the final for this month${getSpendList(it.id, selectedKey).length ? "" : " (at the estimate)"}`;
    }
    body += `<div class="flex items-center justify-between bg-slate-900 rounded-2xl px-5 py-4">
      <div><p class="text-sm font-bold text-white">${verb} in ${monthShort(selectedKey)}</p><p class="text-[10px] text-slate-500">${hint}</p></div>
      <button type="button" id="f-paid" data-on="${settledNow}" data-action="toggleField" data-arg0="this" class="w-14 h-8 rounded-full transition-colors ${settledNow ? "bg-emerald-600" : "bg-slate-700"} relative flex-shrink-0">
        <span class="absolute top-1 ${settledNow ? "left-7" : "left-1"} w-6 h-6 bg-white rounded-full transition-all"></span>
      </button>
    </div>`;
  }

  if (!isNew && kind === "expenses") {
    body += `<button type="button" data-action="openChildModal" data-arg0="${who}" data-arg1="${id}" class="w-full py-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl font-bold text-violet-300 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><span class="material-icons" style="font-size:18px">account_tree</span>Add sub-expense</button>`;
  }

  $("modal-body").innerHTML = body;

  const delBtn = $("delete-btn");
  if (isNew) { delBtn.classList.add("hidden"); }
  else { delBtn.classList.remove("hidden"); delBtn.onclick = () => confirmDelete(); }

  openModalShell();
  if (kind === "expenses") updateBpiCcMonth(!!it);

  setTimeout(() => $("f-name")?.focus(), 50);
}

export function openChildModal(who, parentId, childId) {
  const parent = getItems(who, "expenses").find((x) => x.id === parentId);
  if (!parent) return;
  const c = childId ? getKids(parent).find((x) => x.id === childId) : null;
  const isNew = !c;
  const selectedKey = getSelectedKey();
  setActiveEdit({ kind: "child", who, parentId, id: childId });
  $("modal-title").textContent = isNew ? "Add Sub-expense" : "Edit Sub-expense";
  $("modal-title").className = "text-2xl font-black uppercase tracking-tight text-violet-300";
  const settledNow = c ? isPaid(c.id, selectedKey) : false;
  let body = `<p class="text-[11px] text-slate-500 mb-1">Under <span class="font-bold text-slate-300">${escapeHtml(parent.name)}</span></p>`;
  body += inputBlock("Name", "f-name", c ? c.name : "", "text", 'placeholder="e.g. Electricity"');
  body += inputBlock("Estimate (₱)", "f-amount", c ? c.amount : "", "text", 'inputmode="text" placeholder="0"');
  if (!isNew) {
    body += `<div id="spend-section">${spendSectionHtml(c)}</div>`;
    body += `<div class="flex items-center justify-between bg-slate-900 rounded-2xl px-5 py-4">
      <div><p class="text-sm font-bold text-white">Paid in ${monthShort(selectedKey)}</p><p class="text-[10px] text-slate-500">Locks the final for this month${getSpendList(c.id, selectedKey).length ? "" : " (at the estimate)"}</p></div>
      <button type="button" id="f-paid" data-on="${settledNow}" data-action="toggleField" data-arg0="this" class="w-14 h-8 rounded-full transition-colors ${settledNow ? "bg-emerald-600" : "bg-slate-700"} relative flex-shrink-0"><span class="absolute top-1 ${settledNow ? "left-7" : "left-1"} w-6 h-6 bg-white rounded-full transition-all"></span></button>
    </div>`;
  } else {
    body += `<button type="button" data-action="saveChildAndAddAnother" class="w-full py-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl font-bold text-violet-300 text-sm flex items-center justify-center gap-2"><span class="material-icons" style="font-size:18px">playlist_add</span>Save &amp; add another</button>`;
  }
  $("modal-body").innerHTML = body;
  const delBtn = $("delete-btn");
  if (isNew) delBtn.classList.add("hidden");
  else { delBtn.classList.remove("hidden"); delBtn.onclick = () => confirmDelete(); }
  openModalShell();
}

export function openInvestmentModal() {
  const appData = getAppData();
  const inv = appData?.investments || {};
  setActiveEdit({ kind: "investment" });
  $("modal-title").textContent = "Edit Rates";
  $("modal-title").className = "text-2xl font-black uppercase tracking-tight text-amber-400";
  
  $("modal-body").innerHTML = `
    <div class="space-y-4">
      <div>
        <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Custom POWI Price (USD)</label>
        <input type="number" id="mod-powi" step="0.01" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500 transition-colors" placeholder="Leave empty for auto" value="${inv.customPowiPrice || ''}">
      </div>
      <div>
        <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Custom Exchange Rate (PHP)</label>
        <input type="number" id="mod-rate" step="0.01" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500 transition-colors" placeholder="Leave empty for auto" value="${inv.customUsdPhp || ''}">
      </div>
    </div>
  `;
  $("delete-btn").classList.add("hidden");
  openModalShell();
}

export function openAccountModal(id) {
  const appData = getAppData();
  const a = id ? (appData?.accounts || []).find((x) => x.id === id) : null;
  const isNew = !a;
  setActiveEdit({ kind: "account", id });
  $("modal-title").textContent = isNew ? "Add Account" : "Edit Account";
  $("modal-title").className = "text-2xl font-black uppercase tracking-tight text-emerald-400";

  let body = "";
  body += inputBlock("Account name", "f-name", a ? a.name : "", "text", 'placeholder="e.g. BPI"');
  body += inputBlock("Balance (₱)", "f-amount", a ? a.amount : "", "text", 'inputmode="text" placeholder="0"');
  $("modal-body").innerHTML = body;

  const delBtn = $("delete-btn");
  if (isNew) delBtn.classList.add("hidden");
  else { delBtn.classList.remove("hidden"); delBtn.onclick = () => confirmDelete(); }

  openModalShell();
}

export function pickOwner(btn, w) {
  const wrap = $("f-owner");
  if (!wrap) return;
  wrap.dataset.val = w;
  [...wrap.children].forEach((c) => {
    const on = c === btn;
    c.className = `py-3 rounded-xl font-bold text-xs ${on ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"}`;
  });
}

// =============================
// Spending Tracker per Item
// =============================
export function spendSectionHtml(it) {
  const k = getSelectedKey();
  const list = getSpendList(it.id, k);
  const spent = spentIn(it.id, k);
  const est = amountIn(it, k);
  const remaining = est - spent;
  const over = remaining < 0;
  const pct = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (spent > 0 ? 100 : 0);
  const rows = list.map((e, i) => `
    <div class="flex items-center gap-2 py-2 px-3 bg-slate-900/60 rounded-xl">
      <span class="material-icons text-emerald-400" style="font-size:16px">payments</span>
      <span class="flex-1 min-w-0 truncate text-[12px] font-bold text-slate-500">#${i + 1}</span>
      <span class="text-[13px] font-black text-white">${peso(e.amount)}</span>
      <button type="button" data-action="deleteSpend" data-arg0="${e.id}" title="Remove" class="text-slate-500 hover:text-rose-400 flex-shrink-0"><span class="material-icons" style="font-size:16px">close</span></button>
    </div>`).join("");
  return `<div class="space-y-2">
    <div class="flex items-center justify-between ml-1">
      <label class="text-[10px] font-bold uppercase text-slate-500">Spending in ${monthShort(k)}</label>
      <span class="text-[10px] font-black uppercase ${over ? "text-rose-400" : "text-emerald-400"}">${over ? `Over by ${peso(-remaining)}` : `${peso(remaining)} left`}</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden"><div class="h-full ${over ? "bg-rose-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"} rounded-full transition-all duration-300" style="width:${pct}%"></div></div>
      <span class="text-[11px] font-bold text-slate-400 flex-shrink-0">${peso(spent)} / ${peso(est)}</span>
    </div>
    ${rows ? `<div class="space-y-1.5">${rows}</div>` : `<p class="text-[11px] text-slate-600 text-center py-1">No spending logged yet.</p>`}
    <div class="spend-add flex items-center gap-2">
      <input type="number" id="f-spend-amount" inputmode="decimal" placeholder="Add spending  ₱0" class="spend-amt bg-slate-900 rounded-xl text-[13px] font-bold text-white focus:outline-none" />
      <button type="button" data-action="addSpend" title="Log spending" class="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 flex items-center justify-center active:scale-95 transition-transform"><span class="material-icons" style="font-size:22px">add</span></button>
    </div>
  </div>`;
}

export function refreshSpendSection(id) {
  const item = findItemOrChildById(id);
  const host = $("spend-section");
  if (item && host) host.innerHTML = spendSectionHtml(item);
}

export async function addSpend() {
  const activeEdit = getActiveEdit();
  if (!activeEdit || !activeEdit.id) return;
  const amount = parseFloat($("f-spend-amount")?.value) || 0;
  if (!amount) return toast("Amount required", "error");
  const { id } = activeEdit, k = getSelectedKey();
  const appData = getAppData();
  const cur = getSpendList(id, k);
  cur.push({ id: generateId(), amount });
  appData.spend = appData.spend || {};
  appData.spend[k] = appData.spend[k] || {};
  appData.spend[k][id] = cur;
  await syncSet(appData);
  refreshSpendSection(id);
  renderAll();
  toast("Logged");
  setTimeout(() => $("f-spend-amount")?.focus(), 60);
}

export async function deleteSpend(entryId) {
  const activeEdit = getActiveEdit();
  if (!activeEdit || !activeEdit.id) return;
  const { id } = activeEdit, k = getSelectedKey();
  const appData = getAppData();
  const cur = getSpendList(id, k).filter((e) => e.id !== entryId);
  appData.spend = appData.spend || {};
  appData.spend[k] = appData.spend[k] || {};
  appData.spend[k][id] = cur;
  await syncSet(appData);
  refreshSpendSection(id);
  renderAll();
}

export function toggleField(btn) {
  const on = btn.dataset.on !== "true";
  btn.dataset.on = on;
  const knob = btn.querySelector("span");
  const isPaidToggle = btn.id === "f-paid";
  btn.className = `w-14 h-8 rounded-full transition-colors ${on ? (isPaidToggle ? "bg-emerald-600" : "bg-indigo-600") : "bg-slate-700"} relative flex-shrink-0`;
  knob.className = `absolute top-1 ${on ? "left-7" : "left-1"} w-6 h-6 bg-white rounded-full transition-all`;
}

export async function saveChildAndAddAnother() {
  const activeEdit = getActiveEdit();
  if (!activeEdit || activeEdit.kind !== "child") return;
  const name = ($("f-name")?.value || "").trim();
  const amount = parseMathAmount($("f-amount")?.value);
  if (!name) return toast("Name required", "error");
  const { who, parentId } = activeEdit;
  const appData = getAppData();
  const parent = getItems(who, "expenses").find((x) => x.id === parentId);
  if (parent) {
    if (!Array.isArray(parent.children)) parent.children = [];
    parent.children.push({ id: generateId(), name, amount });
  }
  await syncSet(appData);
  renderAll();
  openChildModal(who, parentId, null);
  toast("Added");
  setTimeout(() => $("f-name")?.focus(), 60);
}

export async function saveModal() {
  const activeEdit = getActiveEdit();
  if (!activeEdit) return;
  const name = ($("f-name")?.value || "").trim();
  const amount = parseMathAmount($("f-amount")?.value);
  const appData = getAppData();
  const selectedKey = getSelectedKey();

  if (activeEdit.kind === "investment") {
    const powiVal = $("mod-powi").value;
    const rateVal = $("mod-rate").value;
    
    if (!appData.investments) appData.investments = {};
    appData.investments.customPowiPrice = powiVal ? parseFloat(powiVal) : null;
    appData.investments.customUsdPhp = rateVal ? parseFloat(rateVal) : null;
    
    await syncSet(appData);
    closeModal(); renderAll(); toast("Saved");
    if ($("more-overlay")?.classList.contains("open")) {
      openMore();
    }
    return;
  }

  if (activeEdit.kind === "account") {
    if (!name) return toast("Name required", "error");
    const owner = "charlie";
    if (activeEdit.id) {
      const a = appData.accounts.find((x) => x.id === activeEdit.id);
      if (a) { a.name = name; a.amount = amount; a.owner = owner; }
    } else {
      appData.accounts.push({ id: generateId(), name, amount, owner });
    }
    await syncSet(appData);
    closeModal(); renderAll(); toast("Saved");
    return;
  }

  if (activeEdit.kind === "child") {
    if (!name) return toast("Name required", "error");
    const { who, parentId, id } = activeEdit;
    const parent = getItems(who, "expenses").find((x) => x.id === parentId);
    if (parent) {
      if (!Array.isArray(parent.children)) parent.children = [];
      if (id) {
        const c = parent.children.find((x) => x.id === id);
        if (c) { c.name = name; c.amount = amount; }
        const pf = $("f-paid");
        if (pf) { appData.paid[selectedKey] = appData.paid[selectedKey] || {}; appData.paid[selectedKey][id] = pf.dataset.on === "true"; }
      } else {
        parent.children.push({ id: generateId(), name, amount });
      }
    }
    await syncSet(appData);
    closeModal(); renderAll(); toast("Saved");
    return;
  }

  // Regular item
  if (!name) return toast("Name required", "error");
  const { who, type, id } = activeEdit;
  const recurring = $("f-recurring").dataset.on === "true";
  const start = $("f-start").value;
  const end = $("f-end").value || null;
  const ddInput = $("f-dueday");
  let dueDay = null;
  if (ddInput && ddInput.value !== "") { const d = parseInt(ddInput.value, 10); if (d >= 1 && d <= 31) dueDay = d; }
  const list = appData.items[who][type];

  const payMethod = $("f-paymethod") ? $("f-paymethod").value : "cash";
  const txDay = $("f-txday") ? parseInt($("f-txday").value, 10) : null;
  const cutoffDay = $("f-cutoff") ? parseInt($("f-cutoff").value, 10) : null;
  const txDate = $("f-txdate") ? $("f-txdate").value : null;

  if (id) {
    const it = list.find((x) => x.id === id);
    if (it) {
      it.name = name;
      it.recurring = recurring;
      it.start = start;
      it.end = recurring ? end : null;
      it.dueDay = dueDay;
      it.paymentMethod = payMethod;
      it.txDay = txDay;
      it.cutoffDay = cutoffDay;
      if (txDate) it.txDate = txDate; else delete it.txDate;
      const scope = $("f-scope") ? $("f-scope").value : "all";
      if (getKids(it).length) {
        // Amount is sum of children
      } else if (recurring && scope === "month") {
        appData.overrides[selectedKey] = appData.overrides[selectedKey] || {};
        appData.overrides[selectedKey][id] = amount;
      } else if (recurring && scope === "future" && cmpKey(selectedKey, it.start) > 0) {
        const prevMonth = addMonths(selectedKey, -1);
        const clone = JSON.parse(JSON.stringify(it));
        clone.id = generateId();
        clone.start = selectedKey;
        clone.amount = amount;
        list.push(clone);
        it.end = prevMonth;
      } else {
        it.amount = amount;
        if (appData.overrides[selectedKey]) delete appData.overrides[selectedKey][id];
      }
    }
    const pf = $("f-paid");
    if (pf) {
      const on = pf.dataset.on === "true";
      appData.paid[selectedKey] = appData.paid[selectedKey] || {};
      appData.paid[selectedKey][id] = on;
    }
  } else {
    const newItem = { id: generateId(), name, amount, start, end: recurring ? end : null, recurring, dueDay, paymentMethod: payMethod, txDay, cutoffDay };
    if (txDate) newItem.txDate = txDate;
    list.push(newItem);
  }
  await syncSet(appData);
  closeModal(); renderAll(); toast("Saved");
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
// Deletions
// =============================
export function confirmDelete() {
  const c = $("confirm-overlay");
  const activeEdit = getActiveEdit();
  let isRecurring = false;
  if (activeEdit && activeEdit.kind !== "account") {
    let item;
    if (activeEdit.kind === "child") {
      const parent = getItems(activeEdit.who, "expenses").find(x => x.id === activeEdit.parentId);
      item = parent ? getKids(parent).find(x => x.id === activeEdit.id) : null;
    } else {
      item = getItems(activeEdit.who, activeEdit.type).find(x => x.id === activeEdit.id);
    }
    if (item && item.recurring) {
      isRecurring = true;
    }
  }

  const btnContainer = $("confirm-buttons");
  if (isRecurring) {
     $("confirm-title").textContent = "Delete recurring item?";
     $("confirm-sub").textContent = "How do you want to handle this deletion?";
     btnContainer.innerHTML = `
        <button data-action="doDelete" data-arg0="month" class="w-full py-4 font-black text-white bg-rose-600/80 hover:bg-rose-600 rounded-2xl transition-colors shadow-lg">This month only</button>
        <button data-action="doDelete" data-arg0="future" class="w-full py-4 font-black text-white bg-rose-600/80 hover:bg-rose-600 rounded-2xl transition-colors shadow-lg">This & future months</button>
        <button data-action="doDelete" data-arg0="all" class="w-full py-4 font-black text-rose-200 bg-rose-900/50 hover:bg-rose-900 rounded-2xl transition-colors mt-4">All occurrences</button>
        <button data-action="closeConfirm" class="w-full py-4 font-bold text-slate-400 bg-slate-700/50 rounded-2xl transition-transform mt-2">Cancel</button>
     `;
  } else {
     $("confirm-title").textContent = "Delete item?";
     $("confirm-sub").textContent = "This removes it from every month.";
     btnContainer.innerHTML = `
        <button data-action="doDelete" data-arg0="all" class="w-full py-4 font-black text-white bg-rose-600 rounded-2xl transition-transform shadow-lg shadow-rose-900/30">Delete</button>
        <button data-action="closeConfirm" class="w-full py-4 font-bold text-slate-400 bg-slate-700/50 rounded-2xl transition-transform">Cancel</button>
     `;
  }

  c.classList.add("open");
  c.style.opacity = "1"; c.style.pointerEvents = "auto";
}

export function closeConfirm() {
  const c = $("confirm-overlay");
  c.classList.remove("open");
  c.style.opacity = "0"; c.style.pointerEvents = "none";
}

export async function doDelete(scope = "all") {
  const activeEdit = getActiveEdit();
  if (!activeEdit) return;
  const appData = getAppData();
  const selectedKey = getSelectedKey();

  if (activeEdit.kind === "account") {
    appData.accounts = appData.accounts.filter((a) => a.id !== activeEdit.id);
  } else if (activeEdit.kind === "child") {
    const { who, parentId, id } = activeEdit;
    const parent = getItems(who, "expenses").find((x) => x.id === parentId);
    if (!parent) return;
    const kids = getKids(parent);
    const item = kids.find(x => x.id === id);
    if (!item) return;

    if (scope === "month") {
      appData.deleted = appData.deleted || {};
      appData.deleted[selectedKey] = appData.deleted[selectedKey] || {};
      appData.deleted[selectedKey][id] = true;
    } else if (scope === "future") {
      item.end = addMonths(selectedKey, -1);
      if (cmpKey(item.end, item.start) < 0) {
        parent.children = kids.filter((c) => c.id !== id);
      }
    } else {
      parent.children = kids.filter((c) => c.id !== id);
      for (const k of Object.keys(appData.paid || {})) delete appData.paid[k][id];
      for (const k of Object.keys(appData.spend || {})) { if (appData.spend[k]) delete appData.spend[k][id]; }
      for (const k of Object.keys(appData.deleted || {})) { if (appData.deleted[k]) delete appData.deleted[k][id]; }
    }
  } else {
    const { who, type, id } = activeEdit;
    const list = appData.items[who][type];
    const item = list.find((x) => x.id === id);

    if (scope === "month") {
      appData.deleted = appData.deleted || {};
      appData.deleted[selectedKey] = appData.deleted[selectedKey] || {};
      appData.deleted[selectedKey][id] = true;
    } else if (scope === "future") {
      if (item) {
        item.end = addMonths(selectedKey, -1);
        if (cmpKey(item.end, item.start) < 0) {
          appData.items[who][type] = list.filter(x => x.id !== id);
        }
      }
    } else {
      appData.items[who][type] = list.filter((x) => x.id !== id);
      for (const k of Object.keys(appData.paid || {})) delete appData.paid[k][id];
      for (const k of Object.keys(appData.overrides || {})) delete appData.overrides[k][id];
      for (const k of Object.keys(appData.deleted || {})) { if (appData.deleted[k]) delete appData.deleted[k][id]; }
    }
  }
  await syncSet(appData);
  closeConfirm(); closeModal(); renderAll(); toast("Deleted");
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

// =============================
// Particle Effects & Celebration
// =============================
export function celebrate() {
  const canvas = $("money-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.opacity = "1";
  const emojis = ["💸", "💵", "🪙"];
  const bills = Array.from({ length: 18 }, () => ({
    x: Math.random() * canvas.width,
    y: -40 - Math.random() * 200,
    vy: 3 + Math.random() * 4,
    vx: (Math.random() - 0.5) * 2,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    e: emojis[Math.floor(Math.random() * emojis.length)],
    size: 24 + Math.random() * 16,
  }));
  let frames = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bills.forEach((b) => {
      b.y += b.vy; b.x += b.vx; b.rot += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.font = `${b.size}px serif`;
      ctx.textAlign = "center";
      ctx.fillText(b.e, 0, 0);
      ctx.restore();
    });
    frames++;
    if (frames < 90) requestAnimationFrame(draw);
    else { canvas.style.opacity = "0"; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  draw();
}

export function initParticles() {
  const app = $("app");
  if (!app) return;
  const colors = ["#6366f1", "#8b5cf6", "#3b82f6", "#f43f5e"];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement("div");
    p.className = "bg-particle";
    const size = 3 + Math.random() * 4;
    p.style.cssText = `width:${size}px;height:${size}px;left:${5 + Math.random() * 90}%;bottom:-10px;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${12 + Math.random() * 18}s;animation-delay:${Math.random() * 10}s;`;
    app.appendChild(p);
  }
}

// =============================
// Lock Screen & App Reveal
// =============================
export function unlockApp() {
  const pwd = $("lock-password").value.toLowerCase();
  if (pwd === "lokomoko") {
    const lock = $("lock-screen");
    const app = $("app");
    lock.style.opacity = "0";
    lock.style.pointerEvents = "none";
    setTimeout(() => { lock.classList.remove("flex"); lock.classList.add("hidden"); }, 700);
    app.style.opacity = "1";
    initParticles();
  } else {
    const err = $("lock-error");
    err.style.opacity = "1";
    setTimeout(() => { err.style.opacity = "0"; }, 2000);
  }
}

export function toggleLockPassword() {
  const input = $("lock-password");
  const icon = $("lock-toggle-icon");
  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "visibility_off";
  } else {
    input.type = "password";
    icon.textContent = "visibility";
  }
}

export function revealApp() {
  const intro = $("intro-screen");
  if (intro) {
    intro.style.opacity = "0";
    intro.style.pointerEvents = "none";
    setTimeout(() => { intro.style.display = "none"; }, 700);
  }
  
  const lock = $("lock-screen");
  if (lock) {
    lock.classList.remove("hidden");
    lock.classList.add("flex");
  }
}

export function runIntro() {
  const tag = $("intro-tag");
  setTimeout(() => { if (tag) tag.style.opacity = "1"; }, 1150);
}
