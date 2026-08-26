import {
  HORIZON, MONTHS, MONTHS_SHORT, OWNERS, CATEGORY_LABELS, BANK_LABELS, PM_LABELS,
  BRAND_DOMAINS, BANK_DOMAINS, generateId, $, peso, signedPeso, ordinal,
  parseDueDay, dueDayFor, escapeHtml, parseMathAmount, mkKey, keyParts, addMonths,
  cmpKey, monthName, monthShort, currentKey, monthsInclusive, bankIconFor,
  brandIconFor, iconFor, categoryIcon
} from "../utils.js";

import {
  getAppData, setAppData, getSelectedKey, setSelectedKey, getActiveEdit,
  setActiveEdit, getHideProjected, setHideProjected, getHideInvestments,
  setHideInvestments, getOverviewPage, setOverviewPage, timeline, clampSelected,
  getItems, itemActiveIn, amountIn, hasOverride, isPaid, accountsTotal, getKids,
  getSpendList, spentIn, childFinal, itemFinal, itemTotal, itemAmts, monthTotals,
  runningFundsAt, currentMoneyAt, allInstallments, monthsPaidCount, sortItems,
  itemCategory, findItemById, findItemOrChildById
} from "../state.js";

import { syncSet } from "../firebase.js";
import { renderProjectionChart } from "../charts.js";

import { toast } from './core.js';
import { spendSectionHtml, toggleField, saveChildAndAddAnother, saveModal } from './components.js';
import { renderAll } from './layout.js';

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

