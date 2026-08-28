import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { renderProjectionChart } from '../charts.js';
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
    ? `<img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[icon] || ''}&sz=128" alt="" class="w-full h-full object-cover bg-white" />`
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
      <div class="acct-icon flex-shrink-0"><img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[bank] || ''}&sz=128" alt="" class="w-full h-full object-cover bg-white" /></div>
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
    ? `<img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[bank] || ''}&sz=128" alt="" class="w-full h-full object-cover bg-white" />`
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