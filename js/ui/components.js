import { accountForMethod, accountName, autoDeduct, paidMessage, payableAccounts, refundPayment } from "../payfrom.js";
import { chooseScope } from "../scope.js";
import { isCardItem } from "../card.js";
import { cardSectionHtml } from "./cardui.js";
import { childAmt } from "../state.js";
import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, ACCOUNT_PAYMENT_METHODS, isAccountMethod, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { stepKey } from '../utils.js';
import { DEFAULT_SHARES, DEFAULT_PENDING_SHARES, sharesOf, fmtShares } from '../utils.js';
import { isArranging, getExpenseSort, acctOwner, acctType, accountsTotal, allInstallments, allRecurring, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, householdTotals, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, outlookRows, outlookKeys, includedWho, flowItems, staleBalanceDays, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { addItemData, applyItemAmount } from '../itemOps.js';
import { budgetAlert, budgetBefore, householdRealMoney, realMoney } from '../insights.js';
import { showSheet } from './quicklog.js';
import { lastMonthOneTimes } from '../extras.js';
import { toast } from './core.js';
import { closeModal, openAccountModal, openChildModal, openInvestmentModal, openItemModal } from './modals.js';
import { jumpOverviewYear, nextOverviewPage, prevOverviewPage, renderMonthStrip, scrollChipIntoView, toggleInvestments, togglePaidGroup, togglePaidQuick, updateHeader } from './actions.js';
import { renderAll, renderBudget } from './layout.js';

// =============================
// UI Components & View Renderers
// =============================









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

export function childRowHtml(parentId, c, k, who, kind = "expenses", arr = null) {
  const paid = isPaid(c.id, k);
  const est = childAmt(c, k);
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
    
  if (arr) {
    return `<div data-child="${c.id}" class="arr-row flex items-center gap-3 py-1.5 px-6 bg-[#1c2136]">
    ${rowIconHtml(c.name, 20, kind, true)}
    <div class="flex-1 min-w-0"><span class="item-name block text-sm font-bold text-slate-200 truncate">${escapeHtml(c.name)}</span></div>
    <span class="text-xs font-bold text-slate-500 flex-shrink-0">${peso(rightMain)}</span>
    <div data-drag-handle role="button" aria-label="Drag to reorder ${escapeHtml(c.name)}" title="Drag to reorder" class="arr-handle w-11 h-11 -mr-2 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-300 bg-indigo-500/15" style="touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none"><span class="material-icons" style="font-size:22px;pointer-events:none">drag_handle</span></div>
  </div>`;
  }

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
  const kids = getKids(it, k);
  const total = itemTotal(it, k);
  const paidCount = kids.filter((c) => isPaid(c.id, k)).length;
  const allPaid = kids.length > 0 && paidCount === kids.length;
  const pct = kids.length ? Math.round((paidCount / kids.length) * 100) : 0;
  const icon = opts.hideIcon ? null : iconFor(it.name);
  const iconInner = icon
    ? `<img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[icon] || ''}&sz=128" alt="" class="w-full h-full object-cover bg-white" />`
    : `<span class="material-icons text-white" style="font-size:24px">home_work</span>`;
  const iconBg = icon ? "bg-slate-800" : "bg-gradient-to-br from-fuchsia-500 to-purple-600";
  const arrange = isArranging(it.id) && kids.length > 1;
  const childRows = kids.map((c, i) => childRowHtml(it.id, c, k, who, kind, arrange ? { i, n: kids.length } : null)).join("");
  const kidsIds = kids.map(c => c.id).join(",");
  
  return `<details data-persist="parent-${it.id}" class="item-parent group bg-[#1c2136] rounded-[1.25rem] border border-slate-700/60 overflow-hidden my-3 shadow-xl" data-parent="${it.id}" data-who="${who}">
    <summary class="parent-summary flex items-center gap-4 p-5 cursor-pointer list-none ${allPaid || it.excluded ? "opacity-70" : ""}">
      <div class="acct-icon w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-lg">${iconInner}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="item-name text-lg font-black text-white truncate ${allPaid ? "line-through" : ""}">${escapeHtml(it.name)}</p>
          ${it.excluded ? `<span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex-shrink-0">Not counted</span>` : ""}
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
      <div class="child-list" data-who="${who}" data-parent="${it.id}">${childRows}</div>
      <div class="px-6 mt-3 flex items-center gap-2">
        ${arrange ? "" : `<button data-action="openChildModal" data-arg0="${who}" data-arg1="${it.id}" class="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1"><span class="material-icons" style="font-size:16px">add</span>Add sub-expense</button>`}
        ${arrange ? "" : `<button data-action="openItemModal" data-arg0="${who}" data-arg1="${kind}" data-arg2="${it.id}" class="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1"><span class="material-icons" style="font-size:16px">edit</span>Edit group</button>`}
        ${kids.length > 1 ? `<button data-action="toggleArrange" data-arg0="${it.id}" aria-pressed="${arrange}" class="${arrange ? "flex-1 bg-indigo-600 text-white" : "text-slate-500 hover:text-white"} py-2.5 px-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"><span class="material-icons" style="font-size:16px">${arrange ? "check" : "swap_vert"}</span>${arrange ? "Done" : "Arrange"}</button>` : ""}
      </div>
    </div>
  </details>`;
}

/** Due state of an unpaid expense: overdue, due within 7 days, or later (future months and items without a due day are never flagged). */
export function dueStatus(it, k) {
  const dd = dueDayFor(it);
  if (dd == null || isPaid(it.id, k)) return null;
  const c = cmpKey(k, currentKey());
  if (c > 0) return null;
  if (c < 0) return { state: "overdue", days: 0 };
  const [y, m] = k.split("-").map(Number);
  const day = Math.min(dd, new Date(y, m, 0).getDate());
  const diff = day - new Date().getDate();
  if (diff < 0) return { state: "overdue", days: -diff };
  if (diff <= 7) return { state: "week", days: diff };
  return { state: "later", days: diff };
}

export function itemRowHtml(it, k, kind, who, opts = {}) {
  if (getKids(it, k).length) return parentRowHtml(it, k, kind, who, opts);
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
      tags.push(`<span class="text-[11px] font-black text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-0.5">💳 BPI Platinum</span>`);
    } else if (isAccountMethod(it.paymentMethod)) {
      const m = ACCOUNT_PAYMENT_METHODS.find((x) => x.id === it.paymentMethod);
      tags.push(`<span class="text-[11px] font-black text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600 flex items-center gap-0.5">${m.icon} ${escapeHtml(m.short)}</span>`);
    } else if (it.paymentMethod && it.paymentMethod.startsWith("cc_")) {
      tags.push(`<span class="text-[11px] font-black text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600 flex items-center gap-0.5">💳 ${escapeHtml(PM_LABELS[it.paymentMethod] || "Credit Card")}</span>`);
    }
  }
  
  if (it.txDate) {
    tags.push(`<span class="text-[11px] font-black text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">event</span>${it.txDate}</span>`);
  }
  
  const ds = kind === "expenses" ? dueStatus(it, k) : null;
  if (ds && ds.state === "overdue") tags.unshift(`<span class="due-chip due-overdue text-[11px] font-black text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/40 flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">error_outline</span>Overdue${ds.days ? ` ${ds.days}d` : ""}</span>`);
  else if (ds && ds.state === "week") tags.unshift(`<span class="due-chip due-soon text-[11px] font-black text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">schedule</span>${ds.days === 0 ? "Due today" : `Due in ${ds.days}d`}</span>`);
  if (installment) tags.push(`<span class="text-[11px] font-bold text-amber-400/80">→ ${monthShort(it.end)}</span>`);
  else if (it.recurring && dd != null) tags.push(`<span class="text-[11px] font-bold text-sky-300 uppercase tracking-wide flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">event_available</span>${ordinal(dd)}</span>`);
  else if (it.recurring) tags.push(`<span class="text-[11px] font-bold text-indigo-300/90 uppercase tracking-wide flex items-center gap-0.5"><span class="material-icons" style="font-size:11px">autorenew</span>Recurring</span>`);
  
  let progress = "";
  if (installment) {
    const total = monthsInclusive(it.start, it.end);
    const paidM = monthsPaidCount(it);
    const pct = total ? Math.round((paidM / total) * 100) : 0;
    const toPay = Math.max(0, total - paidM) * (Number(it.amount) || 0);
    progress = `<div class="flex items-center gap-2 mt-1.5 max-w-full">
      <div class="flex-1 min-w-[24px] max-w-[110px] h-1 bg-slate-800 rounded-full overflow-hidden"><div class="inst-bar-fill h-full bg-gradient-to-r ${OWNERS[who].grad} rounded-full" style="width:${pct}%"></div></div>
      <span class="inst-bar-count text-[11px] font-bold text-slate-500 flex-shrink-0">${paidM}/${total}</span>
      <span class="inst-bar-rem text-[11px] font-semibold text-slate-500 whitespace-nowrap">${toPay > 0 ? `· ${peso(toPay)} to pay in full` : "· fully paid"}</span>
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
  const sorted = sortItems(items, kind);
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
  const subs = sortItems(list, kind).map((it) => itemRowHtml(it, k, kind, who, { hidePaymentTag: true })).join("");
  const label = PM_LABELS[pm] || (String(pm).startsWith("cc_") ? "Credit Card" : pm);
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
  const subs = sortItems(list, kind).map((it) => itemRowHtml(it, k, kind, who, { hideIcon: true })).join("");
  return `<div class="py-1">
    <div class="flex items-center gap-3 px-3 py-2">
      <div class="acct-icon flex-shrink-0"><img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[bank] || ''}&sz=128" alt="" class="w-full h-full object-cover bg-white" /></div>
      <p class="text-sm font-black text-white flex-1 min-w-0 truncate">${BANK_LABELS[bank] || bank}</p>
      <p class="text-sm font-black text-white flex-shrink-0">${peso(total)}</p>
    </div>
    <div class="ml-4 pl-3 border-l border-slate-700/60 space-y-0.5">${subs}</div>
  </div>`;
}

const dueHeader = (label, cls, icon, n) => `<p class="due-group flex items-center gap-1 px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] ${cls}"><span class="material-icons" style="font-size:13px">${icon}</span>${label}<span class="opacity-60">· ${n}</span></p>`;

/** Expenses of the current/past months: Overdue and This week come first, everything else is Later. */
export function groupedRowsHtml(items, k, kind, who) {
  if (kind !== "expenses" || who === "debt" || who === "pdebt" || !items.length) return groupedRowsInner(items, k, kind, who);
  const over = [], week = [], later = [];
  for (const it of items) {
    const ds = getKids(it, k).length ? null : dueStatus(it, k);
    if (ds && ds.state === "overdue") over.push(it); else if (ds && ds.state === "week") week.push(it); else later.push(it);
  }
  if (!over.length && !week.length) return groupedRowsInner(items, k, kind, who);
  const rows = (list) => list.sort((a, b) => (dueDayFor(a) || 0) - (dueDayFor(b) || 0)).map((it) => itemRowHtml(it, k, kind, who)).join("");
  let html = "";
  if (over.length) html += dueHeader("Overdue", "text-rose-400", "error_outline", over.length) + rows(over);
  if (week.length) html += dueHeader("This week", "text-amber-300", "schedule", week.length) + rows(week);
  if (later.length) html += dueHeader("Later", "text-slate-500", "event", later.length) + groupedRowsInner(later, k, kind, who);
  return html;
}

function groupedRowsInner(items, k, kind, who) {
  if (!items.length) {
    const isInc = kind === "income";
    return `<div class="empty-state flex flex-col items-center gap-1 px-3 py-4 text-center">
      <span class="material-icons text-slate-600" style="font-size:22px" aria-hidden="true">${isInc ? "savings" : "receipt_long"}</span>
      <p class="text-[11px] font-bold text-slate-500">No ${isInc ? "income" : "expenses"} this month</p>
      <p class="text-[10px] text-slate-600">Tap <span class="font-black">Add</span> above to create one</p>
    </div>`;
  }
  let html = "";
  const parents = sortItems(items.filter((it) => getKids(it, k).length), kind);
  for (const it of parents) html += itemRowHtml(it, k, kind, who);
  const rest = items.filter((it) => !getKids(it, k).length);
  
  const grouped = new Set();
  
  const pmBuckets = {}, pmOrder = [];
  for (const it of rest) {
    if (it.paymentMethod && it.paymentMethod !== 'cash' && it.paymentMethod !== 'none' && !isAccountMethod(it.paymentMethod)) {
      const pm = it.paymentMethod;
      (pmBuckets[pm] = pmBuckets[pm] || []).push(it);
    }
  }
  for (const it of rest) {
    const pm = it.paymentMethod;
    if (pm && pmBuckets[pm] && pmBuckets[pm].length > 1 && !pmOrder.includes(pm)) pmOrder.push(pm);
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

export function debtTrackerCardHtml(who = "debt") {
  const isP = who === "pdebt";
  const k = getSelectedKey();
  const t = monthTotals(k);
  const debtIncome = getItems(who, "income").filter((it) => itemActiveIn(it, k));
  const debtExpenses = getItems(who, "expenses").filter((it) => itemActiveIn(it, k));
  const debtIncTot = isP ? t.pdI : t.dI;
  const debtExpTot = isP ? t.pdE : t.dE;
  const debtIncHtml = groupedRowsHtml(debtIncome, k, "income", who);
  const debtExpHtml = groupedRowsHtml(debtExpenses, k, "expenses", who);
  const dO = OWNERS[who];

  return `
    <details open data-persist="debts${isP ? "-p" : ""}" class="glass-card rounded-xl border ${isP ? "border-ynah" : "border-rose-500/20"} overflow-hidden w-full flex-shrink-0">
      <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none select-none hover:bg-white/[0.02] transition-colors">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${isP ? "ynah-grad" : "from-rose-500 to-pink-600"} flex items-center justify-center flex-shrink-0 shadow-sm">
            <span class="material-icons text-white" style="font-size:14px">handshake</span>
          </div>
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-white">${isP ? OWNERS.partner.label + " " : ""}Debt Tracker</h4>
            <p class="text-[8px] text-slate-400">Owed to me &amp; owe others</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-[10px] font-black text-rose-400">${peso(debtIncTot)} <span class="text-slate-500 font-normal">/</span> ${peso(debtExpTot)}</p>
        </div>
      </summary>
      <div class="p-2.5 pt-1 space-y-2 bg-slate-950/40 border-t border-white/[0.04]">
        <details open class="group">
          <summary class="flex items-center justify-between px-1.5 mb-1 cursor-pointer list-none select-none">
            <div class="flex items-center gap-1">
              <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:12px">chevron_right</span>
              <div class="flex items-baseline gap-1.5">
                <p class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Owed To Me</p>
                <span class="text-[11px] font-bold text-emerald-400">${peso(debtIncTot)}</span>
              </div>
            </div>
            <button data-action="openItemModal" data-arg0="${who}" data-arg1="income" class="text-[10px] font-bold ${dO.text} flex items-center gap-0.5"><span class="material-icons" style="font-size:12px">add</span>Add</button>
          </summary>
          <div class="space-y-0.5 mt-1">${debtIncHtml}</div>
        </details>
        <div class="border-t border-white/[0.04] pt-1.5">
          <details open class="group">
            <summary class="flex items-center justify-between px-1.5 mb-1 cursor-pointer list-none select-none">
              <div class="flex items-center gap-1">
                <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:12px">chevron_right</span>
                <div class="flex items-baseline gap-1.5">
                  <p class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">I Owe</p>
                  <span class="text-[11px] font-bold text-rose-400">${peso(debtExpTot)}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">${expenseSortBtnHtml()}<button data-action="openItemModal" data-arg0="${who}" data-arg1="expenses" class="text-[10px] font-bold ${dO.text} flex items-center gap-0.5"><span class="material-icons" style="font-size:12px">add</span>Add</button></div>
            </summary>
            <div class="space-y-0.5 mt-1">${debtExpHtml}</div>
          </details>
        </div>
      </div>
    </details>`;
}

export function expenseSortBtnHtml() {
  const on = getExpenseSort() === "name";
  return `<button data-action="toggleExpenseSort" title="${on ? "Sorted A-Z (tap for default order)" : "Sort A-Z"}" aria-label="Sort expenses by name" aria-pressed="${on}" class="text-[10px] font-bold ${on ? "text-indigo-300 bg-indigo-500/20" : "text-slate-500"} px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-colors"><span class="material-icons" style="font-size:12px">sort_by_alpha</span>A-Z</button>`;
}

const spSigned = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
// Real money value plus a one-line explanation for one person
function realFields(who) {
  const r = realMoney(who);
  const realNote = who === "partner"
    ? "cash & bank only (no card owed)"
    : r.owed.total > 0 ? `cash ${peso(r.cash)} − BPI Platinum owed ${peso(r.owed.total)}` : "cash & bank (no card owed)";
  return { realMoney: r.real, realNote };
}
// A label/value row; `sub` rows are indented "of which" lines
const subRow = (label, val, cls, sub = false) => `<div class="flex items-center justify-between ${sub ? "pl-4 text-[10px]" : "text-[11px]"}"><span class="${sub ? "text-slate-500" : "font-bold text-slate-300"}">${label}</span><span class="font-black ${cls}">${val}</span></div>`;
const subHead = (label, cls) => `<p class="text-[9px] font-black uppercase tracking-[0.15em] ${cls} pt-1.5 pb-0.5">${label}</p>`;
// One person's subtotal, kept short: inflow, outflow, net, then the money position. v comes from householdTotals(k)
function subtotalBlockHtml(title, v, titleCls) {
  const hide = getHideProjected();
  const netCls = v.net >= 0 ? "text-emerald-400" : "text-rose-400";
  return `<div>
      <p class="text-[10px] font-black uppercase tracking-wider ${titleCls} px-0.5 mb-0.5">${title}</p>
      <div class="rounded-lg bg-black/20 px-2.5 py-2 space-y-1">
        ${subRow("Inflow", peso(v.income), "text-emerald-400")}
        ${subRow("Outflow", peso(v.expenses), "text-rose-400")}
        ${subRow("Net", spSigned(v.net), netCls)}
        <div class="border-t border-white/10 pt-1 space-y-1">
          ${subRow("Cash &amp; bank", peso(v.cash), "text-slate-100")}
          ${v.realMoney != null ? subRow("Real money", spSigned(v.realMoney), v.realMoney >= 0 ? "text-white" : "text-rose-400") : ""}
          ${subRow(`Projected (${monthShort(getSelectedKey())})`, hide ? "••••••" : spSigned(v.projected), v.projected >= 0 ? "text-white" : "text-rose-400")}
        </div>
      </div>
    </div>`;
}

// Household total: one compact table, a column per person plus the combined total
export function householdCardHtml() {
  const k = getSelectedKey();
  const h = householdTotals(k);
  const hide = getHideProjected();
  const sp = spSigned;
  const c = { ...h.charlie, realMoney: realFields("charlie").realMoney };
  const p = { ...h.partner, realMoney: realFields("partner").realMoney };
  const a = { ...h, realMoney: householdRealMoney().real };
  const money = (n, tone) => `<span class="font-black ${tone}">${sp(n)}</span>`;
  const row = (label, f, tone = () => "text-slate-100", strong = false) => `<div class="grid grid-cols-[3.4rem_1fr_1fr_1fr] gap-1 items-center py-1 text-[10px] ${strong ? "border-t border-white/10" : ""}"><span class="font-bold text-slate-400">${label}</span>${[c, p, a].map((v) => `<span class="text-right">${money(f(v), tone(f(v)))}</span>`).join("")}</div>`;
  const sign = (n) => (n >= 0 ? "text-emerald-400" : "text-rose-400");
  const white = (n) => (n >= 0 ? "text-white" : "text-rose-400");
  return `<details open data-persist="household" class="glass-card rounded-xl border border-indigo-500/20 overflow-hidden w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0"><span class="material-icons text-white" style="font-size:14px">group</span></div>
        <div>
          <h3 class="text-xs font-black text-white uppercase tracking-wide">Household total</h3>
          <p class="text-[8px] text-slate-400">${monthShort(k)}</p>
        </div>
      </div>
      <p class="text-xs font-black ${sign(h.net)}">${sp(h.net)}</p>
    </summary>
    <div class="px-3 pb-3">
      <div class="grid grid-cols-[3.4rem_1fr_1fr_1fr] gap-1 pb-1 text-[9px] font-black uppercase tracking-wide"><span></span><span class="text-right ${OWNERS.charlie.text}">${OWNERS.charlie.label}</span><span class="text-right ${OWNERS.partner.text}">${OWNERS.partner.label}</span><span class="text-right text-indigo-300">All</span></div>
      ${row("Inflow", (v) => v.income, () => "text-emerald-400")}
      ${row("Outflow", (v) => v.expenses, () => "text-rose-400")}
      ${row("Net", (v) => v.net, sign, true)}
      ${row("Cash", (v) => v.cash, () => "text-slate-100", true)}
      ${row("Real", (v) => v.realMoney, white)}
      ${hide ? "" : row("Proj.", (v) => v.projected, white)}
    </div>
  </details>`;
}

export function personSectionHtml(who, includeDebt = true) {
  const o = OWNERS[who];
  const k = getSelectedKey();
  const income = getItems(who, "income").filter((it) => itemActiveIn(it, k));
  // Card purchases live in their own BPI Platinum section, not in the normal groups
  const expenses = getItems(who, "expenses").filter((it) => itemActiveIn(it, k) && !(who === "charlie" && isCardItem(it)));
  const t = monthTotals(k);
  const incTot = who === "charlie" ? t.cI : who === "partner" ? t.pI : t.dI;
  const expTot = who === "charlie" ? t.cE : who === "partner" ? t.pE : t.dE;
  const net = incTot - expTot;
  const incHtml = groupedRowsHtml(income, k, "income", who);
  const emptyRow = (w, kind) => `<button type="button" data-action="openItemModal" data-arg0="${w}" data-arg1="${kind}" class="w-full py-3 text-[11px] font-bold text-slate-500 border border-dashed border-slate-700 rounded-lg flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">add</span>No ${kind === "income" ? "income" : "expenses"} this month · add one</button>`;
  const copyN = who === "charlie" ? lastMonthOneTimes().length : 0;
  const copyBtn = copyN ? `<button type="button" data-action="openCopyPicker" class="w-full mt-1 py-2 text-[11px] font-bold text-indigo-300 flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">content_copy</span>Copy from last month (${copyN})</button>` : "";
  const expHtml = groupedRowsHtml(expenses, k, "expenses", who);

  let debtSectionHtml = "";
  if ((who === "charlie" || who === "partner") && includeDebt) {
    debtSectionHtml = `<div class="border-t border-white/[0.08] pt-2 mt-1">${debtTrackerCardHtml(who === "partner" ? "pdebt" : "debt")}</div>`;
  }

  return `<div class="glass-card rounded-xl overflow-hidden border ${o.ring} w-full flex flex-col">
    <div class="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r ${o.grad} bg-opacity-10 flex-shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${o.grad} ring-1 ring-white/25 flex-shrink-0 flex items-center justify-center">
          ${who === "partner" || who === "charlie" ? `<img src="assets/avatar-${who === "partner" ? "ynah" : "charles"}.jpg" alt="${who === "partner" ? "Ynah" : "Charles"}" class="w-full h-full rounded-lg object-cover">` : `<span class="text-xs font-black text-white">${o.label.charAt(0)}</span>`}
        </div>
        <div>
          <h3 class="text-xs font-black text-white uppercase tracking-wide">${o.label}</h3>
          ${who === 'debt' ? '' : `<p class="text-[8px] font-bold ${net >= 0 ? "text-emerald-400" : "text-rose-400"}">net ${net >= 0 ? "+" : ""}${peso(net)}</p>`}
        </div>
      </div>
      ${who === 'debt' ? '' : `
      <div class="text-right">
        <p class="text-[7px] font-bold uppercase text-white/60">in / out</p>
        <p class="text-[9px] font-black text-white">${peso(incTot)} <span class="text-white/40">-</span> ${peso(expTot)}</p>
      </div>`}
    </div>
    <div class="p-2.5 space-y-2 no-scrollbar">
      <details open data-persist="sec-income${who === "partner" ? "-p" : ""}" class="group">
        <summary class="flex items-center justify-between px-1.5 mb-1 cursor-pointer list-none select-none">
          <div class="flex items-center gap-1">
            <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:12px">chevron_right</span>
            <div class="flex items-baseline gap-1.5">
              <p class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">${who === "debt" ? "Money Owed To Me" : "Income"}</p>
              <span class="text-[11px] font-bold text-emerald-400">${peso(incTot)}</span>
            </div>
          </div>
          <button data-action="openItemModal" data-arg0="${who}" data-arg1="income" class="text-[10px] font-bold ${o.text} flex items-center gap-0.5"><span class="material-icons" style="font-size:12px">add</span>Add</button>
        </summary>
        <div class="space-y-0.5 mt-1">${incHtml || emptyRow(who, "income")}</div>
      </details>
      <div class="border-t border-white/[0.04] pt-2">
        <details open data-persist="sec-expenses${who === "partner" ? "-p" : ""}" class="group">
          <summary class="flex items-center justify-between px-1.5 mb-1 cursor-pointer list-none select-none">
            <div class="flex items-center gap-1">
              <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:12px">chevron_right</span>
              <div class="flex items-baseline gap-1.5">
                <p class="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">${who === "debt" ? "Money I Owe Others" : "Expenses"}</p>
                <span class="text-[11px] font-bold text-rose-400">${peso(expTot)}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">${expenseSortBtnHtml()}<button data-action="openItemModal" data-arg0="${who}" data-arg1="expenses" class="text-[10px] font-bold ${o.text} flex items-center gap-0.5"><span class="material-icons" style="font-size:12px">add</span>Add</button></div>
          </summary>
          <div class="space-y-0.5 mt-1">${expHtml || emptyRow(who, "expenses")}</div>
          ${copyBtn}
        </details>
      </div>
      ${who === "charlie" ? cardSectionHtml(k) : ""}
      ${debtSectionHtml}
      ${who === "charlie" || who === "partner" ? `<div class="border-t border-white/[0.08] pt-2">${subtotalBlockHtml(`Subtotal · ${o.label}`, { ...householdTotals(k)[who], ...realFields(who) }, o.text)}</div>` : ""}
    </div>
  </div>`;
}

// =============================
// Accounts Card & Renderers
// =============================
export function acctIconHtml(a) {
  const key = bankIconFor(a.name);
  const domain = key && BANK_DOMAINS[key];
  const isCash = !key && /cash/i.test(a.name || "");
  const fallback = `<span class="material-icons text-slate-300" style="font-size:18px">${isCash ? "payments" : "account_balance"}</span>`;
  if (!domain) return fallback;
  // Bank logo (favicon service); falls back to the generic bank icon if it can't load (offline)
  return `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" alt="${escapeHtml(BANK_LABELS[key] || a.name)}" loading="lazy" class="w-full h-full object-cover bg-white" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="material-icons text-slate-300 items-center justify-center" style="font-size:18px;display:none">account_balance</span>`;
}
export function acctRowHtml(a) {
  return `<div class="item-row flex items-center justify-between px-2.5 py-1.5 rounded-lg group">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <div class="w-9 h-9 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
        ${acctIconHtml(a)}
      </div>
      <p class="text-sm font-bold text-slate-100 truncate">${escapeHtml(a.name)}</p>
    </div>
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <p class="text-xs font-black text-white">${peso(a.amount)}</p>
      <button data-action="openAccountModal" data-arg0="${a.id}" class="text-slate-400 hover:text-white transition-opacity p-0.5"><span class="material-icons" style="font-size:13px">edit</span></button>
    </div>
  </div>`;
}

export function acctGroupHtml(group) {
  const tot = group.items.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const subs = group.items.map((a) => acctRowHtml(a)).join("");
  const first = group.items[0];
  return `<div class="rounded-lg bg-slate-900/30 border border-white/[0.04] p-1.5 space-y-1">
    <div class="flex items-center justify-between px-1.5 py-0.5">
      <div class="flex items-center gap-1.5 min-w-0">
        <div class="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          ${acctIconHtml(first)}
        </div>
        <p class="text-[11px] font-black text-slate-300 truncate uppercase tracking-wider">${escapeHtml(group.name)}</p>
      </div>
      <p class="text-xs font-black text-emerald-400">${peso(tot)}</p>
    </div>
    <div class="space-y-0.5">${subs}</div>
  </div>`;
}

// ---- Wallet-style account cards ----
const CARD_THEMES = {
  bpi:          { bg: "#c8283f", label: "BPI" },
  maribank:     { bg: "#ff8f45", label: "MariBank" },
  gcash:        { bg: "#3a82ff", label: "GCash" },
  metrobank:    { bg: "#2f5fb3", label: "Metrobank" },
  bdo:          { bg: "#2a5db0", label: "BDO" },
  unionbank:    { bg: "#f59a3c", label: "UnionBank" },
  securitybank: { bg: "#35a066", label: "Security Bank" },
  cash:         { bg: "#34343a", label: "Cash" },
  other:        { bg: "#4f5d75", label: "" },
  credit:       { bg: "#eceff3", label: "" },
};

export function acctCardHtml(a) {
  const key = bankIconFor(a.name);
  const isCredit = acctType(a) === "credit";
  const isCash = !key && /cash/i.test(a.name || "");
  const theme = isCredit ? { ...CARD_THEMES.credit, label: BANK_LABELS[key] || "" } : (CARD_THEMES[key] || (isCash ? CARD_THEMES.cash : CARD_THEMES.other));
  const dark = isCredit; // silver card uses dark text
  const fg = dark ? "#111827" : "#ffffff";
  const sub = dark ? "rgba(17,24,39,.65)" : "rgba(255,255,255,.75)";
  const domain = key && BANK_DOMAINS[key];
  const logo = domain
    ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" loading="lazy" class="w-4 h-4 rounded-[4px] bg-white object-cover flex-shrink-0" onerror="this.style.display='none'">`
    : `<span class="material-icons" style="font-size:15px;color:${fg}">${isCash ? "payments" : "account_balance"}</span>`;
  const network = /debit|credit|mastercard|platinum|rewards/i.test(a.name || "") || isCredit;
  const chip = (key && !isCash) || isCredit
    ? `<div class="mt-3 w-7 h-[22px] rounded-[5px] border" style="background:rgba(255,255,255,.7);border-color:rgba(255,255,255,.4)"></div>
       <span class="material-icons mt-2 block" style="font-size:18px;color:${sub};transform:rotate(90deg);width:18px">contactless</span>`
    : "";
  return `<button type="button" data-action="openAccountModal" data-arg0="${a.id}" aria-label="Edit ${escapeHtml(a.name)}" class="acct-card relative flex-shrink-0 snap-start text-left rounded-xl overflow-hidden active:scale-[0.98] transition-transform" style="width:124px;height:172px;background:${theme.bg};color:${fg};border:1px solid rgba(255,255,255,.12)">
    <div class="relative h-full p-2.5 flex flex-col">
      <div class="flex items-center gap-1.5 min-h-[18px]">${logo}${theme.label ? `<span class="text-[11px] font-black tracking-tight truncate">${escapeHtml(theme.label)}</span>` : ""}</div>
      ${chip}
      <div class="mt-auto">
        <p class="text-[9px] font-semibold leading-tight truncate" style="color:${sub}">${escapeHtml(a.name)}</p>
        <p class="text-[13px] font-black leading-tight whitespace-nowrap">${peso(a.amount)}</p>
        <div class="flex justify-end mt-1 h-3">
          ${network ? `<span class="flex flex-shrink-0"><i class="block w-3 h-3 rounded-full" style="background:#eb001b"></i><i class="block w-3 h-3 rounded-full -ml-1.5" style="background:#f79e1b;opacity:.9"></i></span>` : ""}
        </div>
      </div>
    </div>
  </button>`;
}

function acctCardSection(title, list, total) {
  if (!list.length) return "";
  return `<div class="mt-1">
    <div class="flex items-center justify-between px-1 mb-1.5">
      <p class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">${title}</p>
      <p class="text-[10px] font-black text-slate-400">${peso(total)}</p>
    </div>
    <div class="flex gap-2.5 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1.5 -mx-0.5 px-0.5">${list.map(acctCardHtml).join("")}</div>
  </div>`;
}

export function getAccountsView() {
  try { return localStorage.getItem("moneyku_accts_view") === "list" ? "list" : "cards"; } catch (e) { return "cards"; }
}
export function setAccountsView(v) {
  try { localStorage.setItem("moneyku_accts_view", v === "list" ? "list" : "cards"); } catch (e) { /* ignore */ }
  renderBudget();
}

export function accountsCardHtml(who = "charlie") {
  const appData = getAppData();
  const accts = (appData?.accounts || []).filter((a) => acctOwner(a) === who)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true }));
  const view = getAccountsView();
  const groups = [];
  const idx = {};
  for (const a of accts) {
    const key = bankIconFor(a.name) || (a.name || "").trim().toLowerCase();
    if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, name: a.name, items: [] }); }
    groups[idx[key]].items.push(a);
  }
  const sum = (l) => l.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const bank = accts.filter((a) => acctType(a) !== "credit");
  const credit = accts.filter((a) => acctType(a) === "credit");
  const empty = `<p class="text-[10px] text-slate-600 px-2 py-1.5">No accounts yet. Add one below to see your balances here.</p>`;
  const rows = !accts.length ? empty
    : view === "cards"
      ? acctCardSection("Cash & Bank", bank, sum(bank)) + acctCardSection("Credit", credit, sum(credit))
      : groups.map((g) => (g.items.length > 1 ? acctGroupHtml(g) : acctRowHtml(g.items[0]))).join("");
  const tgl = (v, icon, label) => `<button type="button" data-action="setAccountsView" data-arg0="${v}" aria-label="${label}" aria-pressed="${view === v}" class="w-7 h-6 flex items-center justify-center rounded-md ${view === v ? "bg-slate-600/70 text-white" : "text-slate-400"}"><span class="material-icons" style="font-size:15px">${icon}</span></button>`;
  const isP = who === "partner";
  return `<details open data-persist="accounts${isP ? "-p" : ""}" class="glass-card rounded-xl overflow-hidden border ${isP ? "border-ynah" : "border-emerald-500/10"} w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${isP ? "ynah-grad" : "from-indigo-500 to-teal-600"} flex items-center justify-center flex-shrink-0">
          <span class="material-icons text-white" style="font-size:14px">account_balance</span>
        </div>
        <div>
          <h3 class="text-xs font-black text-white uppercase tracking-wide">${isP ? OWNERS.partner.label : OWNERS.charlie.label} Accounts</h3>
          <p class="text-[8px] text-slate-400">Balances on hand${(() => { const d = staleBalanceDays(who); return d != null && d > 7 ? ` · <span class="text-amber-300">oldest update ${d}d ago</span>` : ""; })()}</p>
        </div>
      </div>
      <p class="text-xs font-black text-emerald-400">${peso(accountsTotal(who))}</p>
    </summary>
    <div class="p-2.5 pt-0 space-y-1">
      <div class="flex justify-end"><div class="inline-flex gap-0.5 p-0.5 rounded-lg bg-slate-900/70 border border-white/5">${tgl("cards", "view_carousel", "Card view")}${tgl("list", "view_list", "List view")}</div></div>
      ${rows}
      <div class="flex gap-2 mt-1.5">
        <button data-action="openAccountModal" data-arg0="" data-arg1="${who}" class="flex-1 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg font-bold text-emerald-400 text-[11px] flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">add</span>Add account</button>
        ${accts.length >= 2 ? `<button data-action="openTransferModal" data-arg0="${who}" class="flex-1 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg font-bold text-indigo-300 text-[11px] flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">swap_horiz</span>Transfer</button>` : ""}
      </div>
    </div>
  </details>`;
}
// =============================
// Investments & Live Rates
// =============================
export function investmentsCardHtml() {
  const appData = getAppData();
  const inv = appData?.investments || { customPowiPrice: null, customUsdPhp: null, cachedPowi: 53.18, cachedUsdPhp: 58.20 };
  const shares = sharesOf(inv, "shares", DEFAULT_SHARES);
  const pendingShares = sharesOf(inv, "pendingShares", DEFAULT_PENDING_SHARES);
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
  
  return `<details open class="glass-card rounded-xl overflow-hidden border border-amber-500/10 w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
          <span class="material-icons text-white" style="font-size:14px">trending_up</span>
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <h3 class="text-xs font-black text-white uppercase tracking-wide">Investments</h3>
            <button data-action="toggleInvestments" class="text-white/40 hover:text-white transition-colors focus:outline-none flex items-center">
              <span class="material-icons" style="font-size: 11px">${hideInvestments ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p class="text-[8px] text-slate-400">POWI Stock Holdings</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-xs font-black text-amber-400">${hideInvestments ? '••••••' : peso(totalPhp)}</p>
        <p class="text-[8px] text-slate-500 font-bold">${hideInvestments ? '••••••' : '$' + totalUsd.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
      </div>
    </summary>
    <div class="p-2.5 pt-0 space-y-2">
      <div class="bg-slate-900/40 rounded-lg p-2 space-y-1.5">
        <div class="flex justify-between items-center">
          <div>
            <p class="text-[11px] font-bold text-slate-300">Vested</p>
            <p class="text-[8px] text-slate-500">Power Integrations (${fmtShares(shares)} shs)</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-black text-white">${hideInvestments ? '••••••' : peso(totalPhp)}</p>
            <p class="text-[8px] text-slate-400 font-bold">${hideInvestments ? '••••••' : `($${totalUsd.toFixed(2)})`}</p>
          </div>
        </div>
        <div class="pt-1.5 border-t border-white/5 flex justify-between items-center">
          <div class="flex items-center gap-1">
            <span class="material-icons text-emerald-400" style="font-size:11px">hourglass_top</span>
            <p class="text-[10px] font-bold text-emerald-400">Apr 2027 (+${fmtShares(pendingShares)})</p>
          </div>
          <p class="text-[11px] font-black text-emerald-400">${hideInvestments ? '••••••' : peso(pendingPhp)}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <div class="bg-slate-900/40 rounded-lg p-1.5">
          <div class="flex items-center justify-between mb-0.5">
            <p class="text-[8px] text-slate-500 uppercase font-bold">POWI Price</p>
            ${isCustomPrice ? '<span class="text-[7px] px-1 bg-amber-500/20 text-amber-300 rounded font-bold">Custom</span>' : '<span class="text-[7px] px-1 bg-emerald-500/20 text-emerald-400 rounded font-bold">Live</span>'}
          </div>
          <p class="text-xs font-black text-slate-200">$${price.toFixed(2)}</p>
        </div>
        <div class="bg-slate-900/40 rounded-lg p-1.5">
          <div class="flex items-center justify-between mb-0.5">
            <p class="text-[8px] text-slate-500 uppercase font-bold">USD/PHP</p>
            ${isCustomRate ? '<span class="text-[7px] px-1 bg-amber-500/20 text-amber-300 rounded font-bold">Custom</span>' : '<span class="text-[7px] px-1 bg-emerald-500/20 text-emerald-400 rounded font-bold">Live</span>'}
          </div>
          <p class="text-xs font-black text-slate-200">₱${rate.toFixed(2)}</p>
        </div>
      </div>
      <div class="flex gap-2 mt-2">
        <button data-action="refreshInvestmentRates" class="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-xl font-bold text-emerald-400 text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
          <span class="material-icons" style="font-size:16px">sync</span>Update Now
        </button>
        <button data-action="openInvestmentModal" class="flex-1 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl font-bold text-amber-400 text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
          <span class="material-icons" style="font-size:16px">edit</span>Edit Shares &amp; Rates
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
  
  // Nothing on the main page shows these rates, so never re-render it from a background fetch:
  // replacing the DOM mid-swipe interrupts touch scrolling. Only save when something changed and
  // refresh the Overview sheet (keeping its scroll position) if it is open.
  if (changed) await syncSet(appData);
  if ($("more-overlay")?.classList.contains("open")) {
    const mb = $("more-body");
    const tops = [mb, mb?.parentElement].map((el) => (el ? el.scrollTop : 0));
    openMore();
    [mb, mb?.parentElement].forEach((el, i) => { if (el) el.scrollTop = tops[i]; });
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

  return `<details open class="glass-card rounded-2xl overflow-hidden border border-indigo-500/10 w-full">
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
    <div class="p-2.5 pt-0">
      <div class="bg-slate-900/40 rounded-lg p-2 mb-2 max-h-32 overflow-y-auto no-scrollbar">
        ${rowsHtml}
      </div>
      
      <div class="flex items-center justify-between px-1">
        <button data-action="prevOverviewPage" class="text-[11px] font-bold ${safePage > 0 ? 'text-emerald-400' : 'text-slate-600'} flex items-center" ${safePage === 0 ? 'disabled' : ''}>
          <span class="material-icons" style="font-size:12px">chevron_left</span> Prev
        </button>
        
        <div class="flex items-center gap-1">
          <span class="text-[9px] text-slate-500 uppercase font-bold">Year</span>
          ${yearSelectHtml}
        </div>
        
        <button data-action="nextOverviewPage" class="text-[11px] font-bold ${safePage < maxPage ? 'text-emerald-400' : 'text-slate-600'} flex items-center" ${safePage === maxPage ? 'disabled' : ''}>
          Next <span class="material-icons" style="font-size:12px">chevron_right</span>
        </button>
      </div>
    </div>
  </details>`;
}

export function statsGridHtml(t) {
  const current = currentMoneyAt();
  const savColor = t.savings > 0.005 ? "text-emerald-400" : t.savings < -0.005 ? "text-rose-400" : "text-amber-300";
  const cell = (icon, iconColor, label, valColor, val) =>
    `<div class="bg-black/20 rounded-lg px-2.5 py-1.5">
      <div class="flex items-center gap-1">
        <span class="material-icons ${iconColor}" style="font-size:11px">${icon}</span>
        <p class="text-[8px] font-bold uppercase text-white/60 truncate">${label}</p>
      </div>
      <p class="text-xs font-black ${valColor} mt-0.5 truncate">${val}</p>
    </div>`;
  return (
    cell("account_balance_wallet", "text-white/70", "Current Money", "text-white", peso(current)) +
    cell("savings", savColor, "Savings", savColor, signedPeso(t.savings)) +
    cell("south_west", "text-emerald-400", "To receive", "text-emerald-400", signedPeso(t.toReceive)) +
    cell("north_east", "text-rose-400", "To pay", "text-rose-400", signedPeso(-t.toPay))
  );
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
    return `<div data-action="openItemModal" data-arg0="${it.who}" data-arg1="expenses" data-arg2="${it.id}" class="item-row px-2.5 py-1.5 rounded-lg space-y-1 bg-slate-900/30 cursor-pointer">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5"><p class="text-xs font-bold text-slate-200 truncate">${escapeHtml(it.name)}</p><span class="text-[8px] font-bold uppercase ${o.text}">${o.label}</span></div>
          <p class="text-[9px] text-slate-500">${monthShort(it.start)} → ${monthShort(it.end)} · ${peso(monthly)}/mo · ${peso(remaining)} left · <span class="text-indigo-300">tap to edit</span></p>
        </div>
        <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${urgency} uppercase flex-shrink-0">${monthsLeft === 0 ? "Done" : monthsLeft + " mo left"}</span>
      </div>
      <div class="h-1.5 bg-slate-900/60 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r ${o.grad} rounded-full" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
  return `<details open class="glass-card rounded-xl overflow-hidden border border-fuchsia-500/15 w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center"><span class="material-icons text-white" style="font-size:14px">hourglass_top</span></div>
        <div><h3 class="text-xs font-black text-white uppercase tracking-wide">Installments</h3><p class="text-[8px] text-slate-400">${insts.length} running · ${peso(grandMonthly)}/mo</p></div>
      </div>
      <p class="text-xs font-black text-fuchsia-300">${peso(grandRemaining)}</p>
    </summary>
    <div class="p-2.5 pt-0 space-y-1">${rows}</div>
  </details>`;
}

/** 13-month outlook (this month + 12): income, spending, net and balance per month, with plain-language findings. */
const OUTLOOK_KEY = "moneyku_outlook_who";
export function getOutlookWho() {
  try { const v = localStorage.getItem(OUTLOOK_KEY); return v === "charlie" || v === "partner" ? v : "all"; } catch (e) { return "all"; }
}
const OUTLOOK_OPTS_KEY = "moneyku_outlook_opts";
// "cons" = count only recurring income; "noInst" = leave installments out (what-if)
export function getOutlookOpts() {
  try { const o = JSON.parse(localStorage.getItem(OUTLOOK_OPTS_KEY) || "{}"); return { cons: !!o.cons, noInst: !!o.noInst }; } catch (e) { return { cons: false, noInst: false }; }
}
function redrawOutlook() {
  const el = document.querySelector('details[data-persist="outlook"]');
  if (!el) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = yearOutlookCardHtml();
  const next = tmp.firstElementChild;
  if (next) { next.open = el.open; el.replaceWith(next); }
}
// Switch the outlook between everyone, Charles' and Ynah's and redraw just that card
export function setOutlookWho(w) {
  try { localStorage.setItem(OUTLOOK_KEY, w === "charlie" || w === "partner" ? w : "all"); } catch (e) { /* ignore */ }
  redrawOutlook();
}
export function toggleOutlookOpt(name) {
  const o = getOutlookOpts();
  if (name === "cons" || name === "noInst") o[name] = !o[name];
  try { localStorage.setItem(OUTLOOK_OPTS_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ }
  redrawOutlook();
}
// Open Overview straight on the outlook, for a person or everyone (used by the Projected block at the top)
export function openOutlook(w, opt) {
  try {
    localStorage.setItem(OUTLOOK_KEY, w === "charlie" || w === "partner" ? w : "all");
    if (opt === "cons") localStorage.setItem(OUTLOOK_OPTS_KEY, JSON.stringify({ ...getOutlookOpts(), cons: true }));
  } catch (e) { /* ignore */ }
  openMore();
  setTimeout(() => document.querySelector('details[data-persist="outlook"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
}
// What is in a month's In and Out for the chosen view
export function openOutlookMonth(m) {
  const view = getOutlookWho(), opts = getOutlookOpts();
  const people = view === "all" ? includedWho() : [view];
  const income = [], expense = [];
  for (const w of people) {
    const f = flowItems(m, w, opts);
    income.push(...f.income); expense.push(...f.expense);
  }
  const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const label = (x) => (view === "all" ? ` <span class="${x.who === "partner" || x.who === "pdebt" ? "text-ynah" : "text-blue-300"}">${x.who === "partner" || x.who === "pdebt" ? OWNERS.partner.label : OWNERS.charlie.label}</span>` : "");
  const section = (title, cls, list) => {
    const sorted = [...list].sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt));
    const tot = list.reduce((s, x) => s + x.amt, 0);
    const rowsHtml = sorted.slice(0, 8).map((x) => `<div class="flex items-center justify-between gap-2 text-[12px]"><span class="truncate text-slate-200">${escapeHtml(x.name)}${label(x)}</span><span class="font-black ${cls} flex-shrink-0">${sp(x.amt)}</span></div>`).join("");
    const more = sorted.length > 8 ? `<p class="text-[10px] text-slate-500">+${sorted.length - 8} smaller item${sorted.length - 8 === 1 ? "" : "s"} (${sp(sorted.slice(8).reduce((s, x) => s + x.amt, 0))})</p>` : "";
    return `<div class="space-y-1"><div class="flex items-center justify-between"><p class="text-[10px] font-black uppercase tracking-wider ${cls}">${title}</p><p class="text-xs font-black ${cls}">${sp(tot)}</p></div>${rowsHtml || `<p class="text-[11px] text-slate-500">Nothing</p>`}${more}</div>`;
  };
  const inc = income.reduce((s, x) => s + x.amt, 0), out = expense.reduce((s, x) => s + x.amt, 0);
  const ks = outlookKeys();
  const balRow = ks.includes(m) ? outlookRows(ks, opts).find((r) => r.m === m) : null;
  const bal = balRow ? balRow[view].bal : null;
  const note = [opts.cons ? "recurring income only" : "", opts.noInst ? "without installments" : ""].filter(Boolean).join(" · ");
  showSheet(`${monthName(m)} · ${view === "all" ? "Everyone" : OWNERS[view].label}`,
    `<div class="space-y-3">${section("Inflow", "text-emerald-400", income)}${section("Outflow", "text-rose-400", expense)}
      <div class="flex items-center justify-between border-t border-white/10 pt-2 text-[12px]"><span class="font-bold text-slate-300">Net</span><span class="font-black ${inc - out >= 0 ? "text-emerald-400" : "text-rose-400"}">${sp(inc - out)}</span></div>
      ${bal == null ? "" : `<div class="flex items-center justify-between text-[12px]"><span class="font-bold text-slate-300">Projected balance</span><span class="font-black ${bal >= 0 ? "text-white" : "text-rose-400"}">${sp(bal)}</span></div>`}
      <p class="text-[10px] text-slate-500">Still to receive / pay${cmpKey(m, currentKey()) === 0 ? " this month (already settled items are not counted)" : ""}.${note ? ` Showing ${note}.` : ""}</p></div>`,
    `<button type="button" data-action="qlClose" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Close</button>`);
}

export function yearOutlookCardHtml() {
  const start = currentKey();
  const tl = timeline();
  if (!tl.length) return "";
  const keys = [];
  for (let i = 0; i < 13; i++) { const m = addMonths(start, i); if (tl.includes(m)) keys.push(m); }
  if (!keys.length) return "";
  const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const view = getOutlookWho(); // "all" | "charlie" | "partner"
  const viewLabel = view === "all" ? "Everyone" : OWNERS[view].label;
  const opts = getOutlookOpts();
  const all = outlookRows(keys, opts);
  let totIn = 0, totOut = 0, low = null, neg = [], peak = null;
  const rows = all.map((r) => {
    const { inc, out, net, bal } = r[view];
    totIn += inc; totOut += out;
    if (!low || bal < low.bal) low = { m: r.m, bal };
    if (bal < 0) neg.push(r.m);
    if (!peak || out > peak.out) peak = { m: r.m, out };
    return { m: r.m, inc, out, net, bal, c: r.charlie.bal, p: r.partner.bal };
  });
  const last = keys[keys.length - 1];
  const instOwners = view === "all" ? ["charlie", "debt", "partner", "pdebt"] : view === "charlie" ? ["charlie", "debt"] : ["partner", "pdebt"];
  const insts = instOwners.flatMap((w) => getItems(w, "expenses").filter((it) => it.recurring && it.end)).filter((i) => cmpKey(i.end, start) >= 0 && cmpKey(i.end, last) <= 0).sort((a, b) => cmpKey(a.end, b.end));
  const freed = insts.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const net = totIn - totOut;
  const end = rows[rows.length - 1].bal;
  // Balance line chart: the selected view in white (everyone view also draws each person), zero line, lowest point
  const series = view === "all"
    ? [{ v: rows.map((r) => r.c), stroke: "#93c5fd", w: 1.2 }, { v: rows.map((r) => r.p), stroke: "#DFC5FE", w: 1.2 }, { v: rows.map((r) => r.bal), stroke: "#ffffff", w: 2 }]
    : [{ v: rows.map((r) => r.bal), stroke: view === "charlie" ? "#93c5fd" : "#DFC5FE", w: 2 }];
  const allVals = series.flatMap((s) => s.v);
  const yMin = Math.min(0, ...allVals), yMax = Math.max(0, ...allVals);
  const span = yMax - yMin || 1;
  const CW = 300, CH = 84, PAD = 5;
  const xAt = (i) => (rows.length < 2 ? CW / 2 : PAD + (i * (CW - 2 * PAD)) / (rows.length - 1));
  const yAt = (v) => PAD + ((yMax - v) / span) * (CH - 2 * PAD);
  const pathOf = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");
  const mainVals = series[series.length - 1].v;
  const lowIdx = mainVals.reduce((bi, v, i) => (v < mainVals[bi] ? i : bi), 0);
  const chart = `<div class="rounded-lg bg-black/20 px-2 pt-2 pb-1">
      <svg viewBox="0 0 ${CW} ${CH}" class="w-full h-20" role="img" aria-label="Projected balance by month">
        ${yMin < 0 ? `<line x1="0" x2="${CW}" y1="${yAt(0).toFixed(1)}" y2="${yAt(0).toFixed(1)}" stroke="#fb7185" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>` : ""}
        ${series.map((s) => `<path d="${pathOf(s.v)}" fill="none" stroke="${s.stroke}" stroke-width="${s.w}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join("")}
        ${rows.map((r, i) => { const cw = (CW - 2 * PAD) / Math.max(1, rows.length - 1); return `<rect data-action="openOutlookMonth" data-arg0="${r.m}" x="${(xAt(i) - cw / 2).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${CH}" fill="transparent" style="cursor:pointer"><title>${monthShort(r.m)}: ${sp(r.bal)}</title></rect><circle cx="${xAt(i).toFixed(1)}" cy="${yAt(r.bal).toFixed(1)}" r="1.6" fill="${r.bal < 0 ? "#fb7185" : "#e0e7ff"}" pointer-events="none"/>`; }).join("")}
        <circle cx="${xAt(lowIdx).toFixed(1)}" cy="${yAt(mainVals[lowIdx]).toFixed(1)}" r="3.2" fill="${mainVals[lowIdx] < 0 ? "#fb7185" : "#fbbf24"}"/>
      </svg>
      <div class="flex items-center justify-between text-[9px] font-bold text-slate-500"><span>${monthShort(rows[0].m)}</span><span class="${mainVals[lowIdx] < 0 ? "text-rose-300" : "text-amber-300"}">low ${sp(mainVals[lowIdx])} · ${monthShort(rows[lowIdx].m)}</span><span>${monthShort(rows[rows.length - 1].m)}</span></div>
      ${view === "all" ? `<div class="flex items-center justify-center gap-3 text-[9px] font-bold text-slate-400 pt-0.5"><span><b style="color:#fff">&mdash;</b> All</span><span><b style="color:#93c5fd">&mdash;</b> ${OWNERS.charlie.label}</span><span><b style="color:#DFC5FE">&mdash;</b> ${OWNERS.partner.label}</span></div>` : ""}
    </div>`;
  const finding = (icon, tone, html) => `<div class="flex items-start gap-2 text-[11px] leading-snug"><span class="material-icons ${tone}" style="font-size:15px;margin-top:1px">${icon}</span><p class="text-slate-300">${html}</p></div>`;
  const finds = [
    finding(net >= 0 ? "trending_up" : "trending_down", net >= 0 ? "text-emerald-400" : "text-rose-400", `${viewLabel}: over ${keys.length} months <b class="text-white">${peso(totIn)}</b> still comes in and <b class="text-white">${peso(totOut)}</b> goes out: net <b class="${net >= 0 ? "text-emerald-300" : "text-rose-300"}">${sp(net)}</b> (${totIn > 0 ? Math.round((net / totIn) * 100) : 0}% of income).`),
    finding("flag", "text-indigo-300", `Projected balance goes from <b class="text-white">${sp(rows[0].bal)}</b> in ${monthShort(rows[0].m)} to <b class="text-white">${sp(end)}</b> in ${monthShort(last)}.`),
    neg.length
      ? finding("warning", "text-rose-400", `Balance dips below zero in <b class="text-rose-300">${neg.length} month${neg.length === 1 ? "" : "s"}</b> (${neg.slice(0, 4).map(monthShort).join(", ")}${neg.length > 4 ? "…" : ""}). Lowest: <b class="text-rose-300">${sp(low.bal)}</b> in ${monthShort(low.m)}.`)
      : finding("check_circle", "text-emerald-400", `Balance stays above zero. Lowest point: <b class="text-white">${sp(low.bal)}</b> in ${monthShort(low.m)}.`),
    finding("local_fire_department", "text-amber-300", `Heaviest month: <b class="text-white">${monthShort(peak.m)}</b> with ${peso(peak.out)} going out.`),
    insts.length ? finding("hourglass_bottom", "text-fuchsia-300", `${insts.length} installment${insts.length === 1 ? "" : "s"} finish in this window (${insts.slice(0, 4).map((i) => `${escapeHtml(i.name)} ${monthShort(i.end)}`).join(", ")}${insts.length > 4 ? "…" : ""}), freeing about <b class="text-white">${peso(freed)}</b> a month.`) : "",
  ].filter(Boolean);
  // In the everyone view, also say what happens to each person's own balance
  const personFind = (w) => {
    const bals = rows.map((r) => ({ m: r.m, bal: w === "charlie" ? r.c : r.p }));
    const lo = bals.reduce((a, b) => (b.bal < a.bal ? b : a), bals[0]);
    const ng = bals.filter((b) => b.bal < 0).map((b) => b.m);
    const name = OWNERS[w].label;
    return ng.length
      ? finding("person", "text-rose-400", `${name} balance dips below zero in <b class="text-rose-300">${ng.length} month${ng.length === 1 ? "" : "s"}</b> (${ng.slice(0, 4).map(monthShort).join(", ")}${ng.length > 4 ? "…" : ""}). Lowest: <b class="text-rose-300">${sp(lo.bal)}</b> in ${monthShort(lo.m)}.`)
      : finding("person", "text-emerald-400", `${name} balance stays above zero. Lowest: <b class="text-white">${sp(lo.bal)}</b> in ${monthShort(lo.m)}.`);
  };
  const allFinds = [...finds, ...(view === "all" ? [personFind("charlie"), personFind("partner")] : [])];
  const topFinds = allFinds.slice(0, 3).join("");
  const moreFinds = allFinds.slice(3);
  const toggle = ["all", "charlie", "partner"].map((w) => {
    const on = w === view;
    return `<button type="button" data-action="setOutlookWho" data-arg0="${w}" aria-pressed="${on}" class="flex-1 py-1.5 rounded-lg text-[11px] font-black ${on ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"}">${w === "all" ? "All" : OWNERS[w].label}</button>`;
  }).join("");
  const optBtn = (name, label) => `<button type="button" data-action="toggleOutlookOpt" data-arg0="${name}" aria-pressed="${opts[name]}" class="flex-1 py-1.5 rounded-lg text-[10px] font-bold ${opts[name] ? "bg-amber-500/25 text-amber-200 border border-amber-400/40" : "bg-slate-900 text-slate-400 border border-transparent"}">${label}</button>`;
  const optsRow = `<div class="flex gap-1.5">${optBtn("cons", "Recurring income only")}${optBtn("noInst", "Without installments")}</div>`;
  const optsNote = [opts.cons ? "recurring income only" : "", opts.noInst ? "without installments" : ""].filter(Boolean).join(", ");
  const tr = rows.map((r) => `<div data-action="openOutlookMonth" data-arg0="${r.m}" role="button" tabindex="0" title="See what makes up ${monthShort(r.m)}" class="grid grid-cols-[3.2rem_1fr_1fr_1fr_1fr] gap-1 items-center py-1 text-[10px] font-bold border-t border-white/[0.04] cursor-pointer active:bg-white/5 ${r.m === start ? "bg-indigo-500/10 rounded" : ""}">
      <span class="text-slate-300">${monthShort(r.m)}</span>
      <span class="text-right text-emerald-300">${peso(r.inc)}</span>
      <span class="text-right text-slate-300">${peso(r.out)}</span>
      <span class="text-right ${r.net >= 0 ? "text-emerald-300" : "text-rose-300"}">${sp(r.net)}</span>
      <span class="text-right font-black ${r.bal >= 0 ? "text-white" : "text-rose-400"}">${sp(r.bal)}</span></div>
    ${view === "all" ? `<div class="flex justify-end gap-3 pb-0.5 text-[9px] font-bold"><span class="${r.c >= 0 ? "text-blue-300" : "text-rose-400"}">${OWNERS.charlie.label} ${sp(r.c)}</span><span class="${r.p >= 0 ? "text-ynah" : "text-rose-400"}">${OWNERS.partner.label} ${sp(r.p)}</span></div>` : ""}`).join("");
  return `<details open data-persist="outlook" class="glass-card rounded-xl overflow-hidden w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center"><span class="material-icons text-white" style="font-size:14px">insights</span></div>
        <div><h3 class="text-xs font-black text-white uppercase tracking-wide">12-month outlook</h3><p class="text-[10px] text-slate-400">${viewLabel}${optsNote ? ` (${optsNote})` : ""} · ${monthShort(keys[0])} &rarr; ${monthShort(last)}</p></div>
      </div>
      <p class="text-xs font-black ${end >= 0 ? "text-emerald-300" : "text-rose-300"}">${sp(end)}</p>
    </summary>
    <div class="px-3 pb-3 space-y-2.5">
      <div class="flex gap-1.5">${toggle}</div>
      ${optsRow}
      ${chart}
      <div class="space-y-1.5">${topFinds}</div>
      ${moreFinds.length ? `<details data-persist="outlook-more" class="group/om"><summary class="flex items-center gap-1 cursor-pointer list-none select-none text-[11px] font-bold text-indigo-300 py-0.5"><span class="material-icons" style="font-size:15px">chevron_right</span>${moreFinds.length} more insight${moreFinds.length === 1 ? "" : "s"}</summary><div class="space-y-1.5 pt-1">${moreFinds.join("")}</div></details>` : ""}
      <div class="rounded-lg bg-black/20 px-2 py-1.5">
        <div class="grid grid-cols-[3.2rem_1fr_1fr_1fr_1fr] gap-1 pb-1 text-[9px] font-black uppercase tracking-wide text-slate-500"><span>Month</span><span class="text-right">In</span><span class="text-right">Out</span><span class="text-right">Net</span><span class="text-right">Balance</span></div>
        ${tr}
      </div>
      <button type="button" data-action="exportOutlookCsv" class="w-full py-2 text-[11px] font-bold text-indigo-300 rounded-lg bg-slate-800/60 flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">download</span>Export outlook (CSV)</button>
      <p class="text-[10px] text-slate-500 leading-snug">In and Out are what is still to come: this month only counts what is not yet received or paid, later months count the full plan. So each month's Net is exactly the change in Balance. Tap a month to see what it is made of. "Recurring income only" drops one-time income and debts owed to you (a worst case); "Without installments" shows the balance if installments did not exist. Includes recurring income and bills, installments, both debt trackers and Charles' BPI Platinum bill in the month it falls due. One-time items you have not added yet are not included.</p>
    </div>
  </details>`;
}
/** Timeline of recurring money coming IN with an end month (e.g. Kuya Rey's iPhone): one row per month from this month to the last. */
export function owedScheduleCardHtml() {
  const now = currentKey();
  const list = [];
  for (const who of ["debt", "charlie"]) {
    for (const it of getItems(who, "income")) {
      if (it.recurring && it.end && cmpKey(it.end, now) >= 0) list.push({ it, who });
    }
  }
  if (!list.length) return "";
  let grand = 0;
  const blocks = list.map(({ it, who }) => {
    const first = cmpKey(it.start, now) > 0 ? it.start : now;
    const months = monthsInclusive(first, it.end);
    let left = 0, rows = "";
    for (let i = 0; i < months; i++) {
      const m = addMonths(first, i);
      const amt = itemTotal(it, m);
      const done = isPaid(it.id, m);
      if (!done) left += amt;
      rows += `<div class="flex items-center justify-between gap-2 py-1 px-1 text-[11px] font-bold ${done ? "text-slate-500" : "text-slate-200"}">
        <span class="flex items-center gap-1.5"><span class="material-icons ${done ? "text-emerald-400" : "text-slate-600"}" style="font-size:14px">${done ? "check_circle" : "radio_button_unchecked"}</span>${monthShort(m)}${m === now ? ` <span class="text-[9px] text-indigo-300">this month</span>` : ""}</span>
        <span class="${done ? "line-through" : "text-emerald-300"}">${peso(amt)}</span></div>`;
    }
    grand += left;
    return `<details class="rounded-lg bg-slate-900/30"><summary class="flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer list-none">
        <div class="min-w-0"><p class="text-xs font-bold text-slate-200 truncate">${escapeHtml(it.name)}</p>
          <p class="text-[10px] text-slate-500">${monthShort(first)} → ${monthShort(it.end)} &middot; ${months} month${months === 1 ? "" : "s"} &middot; ${peso(Number(it.amount) || 0)}/mo</p></div>
        <p class="text-xs font-black text-emerald-300 flex-shrink-0">${peso(left)}</p></summary>
      <div class="px-2.5 pb-2 border-t border-white/[0.04]">${rows}
        <button type="button" data-action="openItemModal" data-arg0="${who}" data-arg1="income" data-arg2="${it.id}" class="w-full mt-1 py-1.5 text-[11px] font-bold text-indigo-300 rounded-lg bg-slate-800/60">Edit</button></div></details>`;
  }).join("");
  return `<details open class="glass-card rounded-xl overflow-hidden w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center"><span class="material-icons text-white" style="font-size:14px">south_west</span></div>
        <div><h3 class="text-xs font-black text-white uppercase tracking-wide">Payments to receive</h3><p class="text-[10px] text-slate-400">${list.length} running &middot; tap one to see every month</p></div>
      </div>
      <p class="text-xs font-black text-emerald-300">${peso(grand)}</p>
    </summary>
    <div class="p-2.5 pt-0 space-y-1">${blocks}</div>
  </details>`;
}
export function recurringPaymentsCardHtml() {
  const k = getSelectedKey();
  const recurring = allRecurring(k);
  let totalMonthly = 0;
  
  const rows = recurring.map((it) => {
    const amt = itemTotal(it, k);
    const settled = isPaid(it.id, k);
    const isInc = it.kind === "income";
    if (!isInc) totalMonthly += amt;
    const dd = dueDayFor(it);
    const o = OWNERS[it.who] || OWNERS.charlie;

    return `
      <div class="px-2.5 py-1.5 rounded-lg bg-slate-900/30 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          ${rowIconHtml(it.name, 22, it.kind)}
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-xs font-bold ${settled ? 'text-slate-400 line-through' : 'text-slate-200'} truncate">${escapeHtml(it.name)}</p>
              ${dd != null ? `<span class="text-[8px] font-bold text-sky-400 px-1 py-0.2 bg-sky-500/10 rounded">${ordinal(dd)}</span>` : ''}
            </div>
            <p class="text-[9px] text-slate-500">${isInc ? 'Income' : 'Monthly Bill'} · <span class="${o.text}">${o.label}</span></p>
          </div>
        </div>
        <div class="text-right flex-shrink-0 flex items-center gap-2">
          <p class="text-xs font-black ${isInc ? 'text-emerald-400' : 'text-slate-200'}">${isInc ? '+' : ''}${peso(amt)}</p>
          <button data-action="togglePaidQuick" data-arg0="${it.id}" class="w-5 h-5 rounded-md flex items-center justify-center transition-colors ${settled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500 hover:text-white'}">
            <span class="material-icons" style="font-size:13px">${settled ? 'check_circle' : 'radio_button_unchecked'}</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  return `<details open class="glass-card rounded-xl overflow-hidden border border-teal-500/15 w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center"><span class="material-icons text-white" style="font-size:14px">autorenew</span></div>
        <div><h3 class="text-xs font-black text-white uppercase tracking-wide">Recurring Bills</h3><p class="text-[8px] text-slate-400">${recurring.length} items · ${peso(totalMonthly)}/mo</p></div>
      </div>
      <p class="text-xs font-black text-teal-300">${peso(totalMonthly)}</p>
    </summary>
    <div class="p-2.5 pt-0 space-y-1">${rows || `<div class="text-center py-2 text-[10px] text-slate-500">No recurring payments for this month</div>`}</div>
  </details>`;
}

export function openMore() {
  const body = $("more-body");
  const inst = installmentsCardHtml() || `<div class="glass-card rounded-2xl p-6 text-center text-[12px] text-slate-500">No installments yet — add an expense with a "runs until" month.</div>`;
  body.innerHTML = `
    ${investmentsCardHtml()}
    ${yearOutlookCardHtml()}
    ${monthOverviewCardHtml()}
    ${owedScheduleCardHtml()}
    ${inst}
  `;
  body.querySelectorAll("details").forEach((d) => (d.open = true));
  const ov = $("more-overlay");
  ov.classList.add("open");
  
  fetchInvestmentRates();
}

export function closeMore() {
  $("more-overlay").classList.remove("open");
}

export function selectMonth(k) {
  setSelectedKey(k); // set now so rapid taps on arrows don't lose a step
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      setSelectedKey(k);
      updateHeader();
      renderMonthStrip();
      renderBudget();
      scrollChipIntoView();
      if ($("month-picker").classList.contains("open")) toggleMonthPicker();
    });
  } else {
    setSelectedKey(k);
    updateHeader();
    renderMonthStrip();
    renderBudget();
    scrollChipIntoView();
    if ($("month-picker").classList.contains("open")) toggleMonthPicker();
  }
}


export function stepMonth(d) {
  selectMonth(stepKey(timeline(), getSelectedKey(), Number(d)));
}

export function goToday() {
  if (timeline().includes(currentKey())) selectMonth(currentKey());
}

export function jumpYear(y) {
  document.getElementById(`mp-year-${y}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const nowK = currentKey();
    const pills = `<div class="sticky top-0 z-10 -mx-8 px-8 py-3 bg-slate-950/95 flex gap-2 overflow-x-auto no-scrollbar">
      <button data-action="goToday" class="flex-shrink-0 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase">Today</button>
      ${Object.keys(years).map((y) => `<button data-action="jumpYear" data-arg0="${y}" class="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black ${Number(y) === keyParts(selectedKey).y ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}">${y}</button>`).join("")}
    </div>`;
    $("month-picker-grid").innerHTML = pills + Object.entries(years).map(([y, keys]) => `
      <div id="mp-year-${y}" style="scroll-margin-top:64px">
        <p class="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-3">${y}</p>
        <div class="grid grid-cols-3 gap-3">
          ${keys.map((k) => `<button data-action="selectMonth" data-arg0="${k}" class="py-4 rounded-2xl font-black text-sm ${k === selectedKey ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"} transition-transform">${MONTHS_SHORT[keyParts(k).m]}</button>`).join("")}
        </div>
      </div>`).join("");
  }
}

// =============================
// Spending Tracker per Item
// =============================
/** Account choices for a spending entry: last one used, else the item's own account, else the first. */
function spendAccountOptions(it) {
  const owner = ["partner", "pdebt"].some((w) => getItems(w, "expenses").some((x) => x.id === it.id || getKids(x).some((c) => c.id === it.id))) ? "partner" : "charlie";
  const accts = payableAccounts(owner);
  let last = ""; try { last = localStorage.getItem("moneyku_spend_acct") || ""; } catch { /* ignore */ }
  const own = accountForMethod(it?.paymentMethod, owner)?.id || "";
  const pick = [last, own].find((id) => id && accts.some((a) => a.id === id)) || accts[0]?.id || "";
  return `<option value="">No account</option>` + accts.map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === pick ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("");
}
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
      <span class="flex-1 min-w-0 truncate text-[12px] font-bold text-slate-500">#${i + 1}${e.date ? ` <span class="text-slate-300">&middot; ${escapeHtml(new Date(e.date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }))}</span>` : ""}${e.acct ? ` <span class="text-indigo-300">&middot; from ${escapeHtml(accountName(e.acct))}</span>` : ""}</span>
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
    <div class="spend-add rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-3 space-y-2">
      <p class="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1"><span class="material-icons" style="font-size:16px">add_circle</span>Add spending</p>
      <div class="flex items-center gap-2">
        <input type="number" id="f-spend-amount" inputmode="decimal" placeholder="Amount  ₱0" class="spend-amt bg-slate-900 rounded-xl text-[14px] font-bold text-white focus:outline-none" />
        <button type="button" data-action="addSpend" title="Log spending" class="flex-shrink-0 h-12 px-4 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"><span class="material-icons" style="font-size:20px">add</span>Add</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="text-[9px] font-bold uppercase text-slate-400 ml-1">From account</label>
          <select id="f-spend-acct" title="Subtracted from this account&#39;s balance" aria-label="Account" class="w-full bg-slate-900 rounded-xl py-2.5 px-2 text-[12px] font-bold text-white focus:outline-none">${spendAccountOptions(it)}</select></div>
        <div><label class="text-[9px] font-bold uppercase text-slate-400 ml-1">Date <span class="text-slate-500">(optional)</span></label>
          <input type="date" id="f-spend-date" data-action="openDatePicker" min="${k}-01" max="${k}-${String(new Date(keyParts(k).y, keyParts(k).m + 1, 0).getDate()).padStart(2, "0")}" aria-label="Date (optional)" class="w-full bg-slate-900 rounded-xl text-[12px] font-bold text-white focus:outline-none" /></div>
      </div>
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
  const acct = $("f-spend-acct")?.value || "";
  try { localStorage.setItem("moneyku_spend_acct", acct); } catch { /* ignore */ }
  // Taking it from an account subtracts it from that balance now (and Delete gives it back)
  const account = acct ? (appData.accounts || []).find((a) => a.id === acct) : null;
  if (account) account.amount = Math.round(((Number(account.amount) || 0) - amount + Number.EPSILON) * 100) / 100;
  const date = $("f-spend-date")?.value || ""; // optional, YYYY-MM-DD
  const entry = account ? { id: generateId(), amount, acct, ded: true } : { id: generateId(), amount };
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) entry.date = date;
  cur.push(entry);
  appData.spend = appData.spend || {};
  appData.spend[k] = appData.spend[k] || {};
  appData.spend[k][id] = cur;
  await syncSet(appData);
  refreshSpendSection(id);
  renderAll();
  toast(account ? `Logged - ${peso(amount)} taken from ${account.name}` : "Logged");
  setTimeout(() => $("f-spend-amount")?.focus(), 60);
}

export async function deleteSpend(entryId) {
  const activeEdit = getActiveEdit();
  if (!activeEdit || !activeEdit.id) return;
  const { id } = activeEdit, k = getSelectedKey();
  const appData = getAppData();
  const gone = getSpendList(id, k).find((e) => e.id === entryId);
  if (gone && gone.ded) {
    const acct = (appData.accounts || []).find((a) => a.id === gone.acct);
    if (acct) acct.amount = Math.round(((Number(acct.amount) || 0) + (Number(gone.amount) || 0) + Number.EPSILON) * 100) / 100;
  }
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
  btn.className = `w-10 h-6 rounded-full transition-colors ${on ? (isPaidToggle ? "bg-emerald-600" : "bg-indigo-600") : "bg-slate-700"} relative flex-shrink-0`;
  knob.className = `absolute top-1 ${on ? "left-5" : "left-1"} w-4 h-4 bg-white rounded-full transition-all`;
  if (btn.id === "f-group") {
    $("f-amount-wrap")?.classList.toggle("hidden", on);
    $("f-group-hint")?.classList.toggle("hidden", !on);
  }
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
    const gn = ($("f-parent")?.value || "").trim();
    if (gn) parent.name = gn;
  }
  await syncSet(appData);
  renderAll();
  openChildModal(who, parentId, null);
  toast("Added");
  setTimeout(() => $("f-name")?.focus(), 60);
}

const PM_KEY = "moneyku_last_pm";
function rememberPayMethod(pm) {
  try { if (pm) localStorage.setItem(PM_KEY, pm); } catch { /* ignore */ }
}

let saving = false;
export async function saveModal() {
  if (saving) return;
  saving = true;
  try { await saveModalInner(); } finally { saving = false; }
}

/** Set the paid flag from the edit popup. Turning it on charges a Maribank / GCash / BPI Debit account; turning it off gives the money back. */
function setPaidFlag(appData, k, id, on) {
  appData.paid[k] = appData.paid[k] || {};
  const was = appData.paid[k][id] === true;
  const moved = on && !was ? autoDeduct(k, id) : null;
  appData.paid[k][id] = on;
  if (!on) refundPayment(k, id);
  return moved;
}

function savedToast(k, moved) {
  if (!moved) return toast("Saved");
  toast(paidMessage({}, [moved]), "ok", {
    actionLabel: "Undo", duration: 4000,
    onAction: async () => {
      const d = getAppData();
      if (d.paid?.[k]?.[moved.id] !== true) return;
      d.paid[k][moved.id] = false;
      refundPayment(k, moved.id);
      await syncSet(d);
      renderAll();
    },
  });
}

async function saveModalInner() {
  let deducted = null;
  const activeEdit = getActiveEdit();
  if (!activeEdit) return;
  if (activeEdit.kind === "budgets") return window.saveBudgets?.();
  const name = ($("f-name")?.value || "").trim();
  const amount = parseMathAmount($("f-amount")?.value);
  const appData = getAppData();
  const selectedKey = getSelectedKey();

  if (activeEdit.kind === "investment") {
    const powiVal = $("mod-powi").value;
    const rateVal = $("mod-rate").value;
    const sharesVal = $("mod-shares").value.trim();
    const pendingVal = $("mod-pending").value.trim();
    if ((sharesVal !== "" && !(parseFloat(sharesVal) >= 0)) || (pendingVal !== "" && !(parseFloat(pendingVal) >= 0))) {
      return toast("Shares must be 0 or more", "error");
    }
    
    if (!appData.investments) appData.investments = {};
    appData.investments.shares = sharesVal === "" ? null : parseFloat(sharesVal);
    appData.investments.pendingShares = pendingVal === "" ? null : parseFloat(pendingVal);
    appData.investments.customPowiPrice = powiVal ? parseFloat(powiVal) : null;
    appData.investments.customUsdPhp = rateVal ? parseFloat(rateVal) : null;
    
    await syncSet(appData);
    closeModal(); renderAll(); toast("Saved");
    if ($("more-overlay")?.classList.contains("open")) {
      openMore();
    }
    return;
  }

  if (activeEdit.kind === "transfer") {
    const fromId = $("f-from")?.value, toId = $("f-to")?.value;
    const from = appData.accounts.find((x) => x.id === fromId);
    const to = appData.accounts.find((x) => x.id === toId);
    if (!from || !to) return toast("Pick both accounts", "error");
    if (from.id === to.id) return toast("Choose two different accounts", "error");
    if (!(amount > 0)) return toast("Enter an amount", "error");
    if (amount > (Number(from.amount) || 0) + 0.005) return toast(`${from.name} only has ${peso(from.amount)}`, "error");
    from.amount = Math.round(((Number(from.amount) || 0) - amount) * 100) / 100;
    to.amount = Math.round(((Number(to.amount) || 0) + amount) * 100) / 100;
    await syncSet(appData);
    closeModal(); renderAll(); toast(`Moved ${peso(amount)} to ${to.name}`);
    return;
  }

  if (activeEdit.kind === "account") {
    if (!name) return toast("Name required", "error");
    const owner = activeEdit.owner === "partner" ? "partner" : "charlie";
    if (activeEdit.id) {
      const a = appData.accounts.find((x) => x.id === activeEdit.id);
      if (a) { a.name = name; a.amount = amount; a.owner = owner; a.type = $("f-type")?.value || "bank"; }
    } else {
      const dn = new Date();
      const today = `${dn.getFullYear()}-${String(dn.getMonth() + 1).padStart(2, "0")}-${String(dn.getDate()).padStart(2, "0")}`;
      appData.accounts.push({ id: generateId(), name, amount, owner, type: $("f-type")?.value || "bank", updated: today });
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
      const gn = ($("f-parent")?.value || "").trim();
      if (gn) parent.name = gn; // rename the group header
      if (id) {
        const c = parent.children.find((x) => x.id === id);
        if (c) {
          // A repeating sub-expense: ask which months the new amount applies to
          let scope = "all";
          const changed = amount !== childAmt(c, selectedKey);
          if (changed && parent.recurring) {
            scope = await chooseScope(c.name, { monthLabel: `${monthName(selectedKey)} ${keyParts(selectedKey).y}`, canFuture: !c.start || cmpKey(selectedKey, c.start) > 0, detail: `${peso(childAmt(c, selectedKey))} \u2192 ${peso(amount)}` });
            if (scope === null) return;
          }
          c.name = name;
          if (changed) applyItemAmount(appData, parent.children, c, amount, scope, selectedKey, { recurring: parent.recurring });
        }
        const pf = $("f-paid");
        if (pf) deducted = setPaidFlag(appData, selectedKey, id, pf.dataset.on === "true");
      } else {
        parent.children.push({ id: generateId(), name, amount });
      }
    }
    await syncSet(appData);
    closeModal(); renderAll(); savedToast(selectedKey, deducted);
    return;
  }

  // Regular item
  if (!name) return toast("Name required", "error");
  const bb = budgetBefore();
  const { type, id } = activeEdit;
  // New items can be assigned to a person in the modal ("Whose account")
  const pickedWho = !id ? $("f-who")?.dataset.val : null;
  const who = ["charlie", "partner", "debt", "pdebt"].includes(pickedWho) ? pickedWho : activeEdit.who;
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
  const category = $("f-category") ? $("f-category").value : "";

  // A repeating item whose amount changed: ask which months it applies to
  let scope = "all";
  if (id) {
    const it0 = list.find((x) => x.id === id);
    if (it0 && it0.recurring && recurring && !getKids(it0).length && amount !== amountIn(it0, selectedKey)) {
      scope = await chooseScope(it0.name, { monthLabel: `${monthName(selectedKey)} ${keyParts(selectedKey).y}`, canFuture: !it0.start || cmpKey(selectedKey, it0.start) > 0, detail: `${peso(amountIn(it0, selectedKey))} \u2192 ${peso(amount)}` });
      if (scope === null) return;
    }
  }

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
      if ($("f-include")) { if ($("f-include").dataset.on === "true") delete it.excluded; else it.excluded = true; }
      if ($("f-category")) { if (category) it.category = category; else delete it.category; }
      if (getKids(it).length) {
        // Amount is sum of children
      } else {
        applyItemAmount(appData, list, it, amount, scope, selectedKey);
      }
    }
    const pf = $("f-paid");
    if (pf) {
      const on = pf.dataset.on === "true";
      deducted = setPaidFlag(appData, selectedKey, id, on);
    }
  } else {
    const isGroup = $("f-group")?.dataset.on === "true";
    const created = addItemData(appData, { who, kind: type, name, amount: isGroup ? 0 : amount, start, recurring, end, dueDay, paymentMethod: payMethod, txDay, cutoffDay, txDate, category });
    if (isGroup) {
      rememberPayMethod(payMethod);
      await syncSet(appData);
      closeModal(); renderAll();
      openChildModal(who, created.id);
      return;
    }
  }
  rememberPayMethod(payMethod);
  await syncSet(appData);
  closeModal(); renderAll(); savedToast(selectedKey, deducted);
  budgetAlert(bb);
}
