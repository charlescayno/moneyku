import { DEFAULT_SHARES, DEFAULT_PENDING_SHARES, sharesOf, PH_ACCOUNT_OPTIONS, CREDIT_CARD_METHODS, ACCOUNT_PAYMENT_METHODS, $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { cardSettings } from "../card.js";
import { childAmt } from "../state.js";
import { acctOwner, acctType, accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { SPEND_CATS, catInfo, categoryOf } from '../categories.js';
import { toast } from './core.js';
import { saveChildAndAddAnother, saveModal, spendSectionHtml, toggleField } from './components.js';
import { renderAll } from './layout.js';

// =============================
// Modals — Inputs & Forms
// =============================
export function inputBlock(label, id, value, type = "text", extra = "") {
  return `<div class="space-y-0.5">
    <label class="text-[10px] font-bold uppercase text-slate-500 ml-1">${label}</label>
    <input type="${type}" id="${id}" value="${escapeHtml(value)}" ${extra}
      class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none" />
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
  $("f-more")?.setAttribute("open", "");

  // A purchase date, when given, decides the charge day and the month the charge belongs to
  const dateVal = $("f-txdate")?.value || "";
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateVal);
  const txInput = $("f-txday");
  let txDay = parseInt(txInput?.value || "15", 10);
  const cutoff = parseInt($("f-cutoff")?.value || "14", 10);

  let y, m;
  if (dm) {
    y = Number(dm[1]); m = Number(dm[2]) - 1; txDay = Number(dm[3]);
    if (txInput) { txInput.value = txDay; txInput.readOnly = true; txInput.classList.add("opacity-60"); }
  } else {
    ({ y, m } = keyParts(getSelectedKey() || currentKey()));
    if (txInput) { txInput.readOnly = false; txInput.classList.remove("opacity-60"); }
  }

  // Charges after the cut-off day go on the next month's statement
  let cutoffDate = new Date(y, m, cutoff);
  if (txDay > cutoff) {
    cutoffDate = new Date(y, m + 1, cutoff);
  }

  // Due on the card's due day (29th by default), the first one after the cut-off
  const dueDay = cardSettings().dueDay;
  const dueIn = (yy, mm) => new Date(yy, mm, Math.min(dueDay, new Date(yy, mm + 1, 0).getDate()));
  let dueDate = dueIn(cutoffDate.getFullYear(), cutoffDate.getMonth());
  if (dueDate <= cutoffDate) dueDate = dueIn(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1);

  if (!isExistingInit) {
    // The item sits in the month it was charged; the card section handles the statement and due date
    const startSelect = $("f-start");
    if (startSelect) {
      // months before the timeline start are not in the list; the charge keeps its exact date anyway
      const want = mkKey(y, m);
      const opts = [...startSelect.options].map((o) => o.value);
      startSelect.value = opts.includes(want) ? want : (opts[0] || want);
    }

    const dueDayInput = $("f-dueday");
    if (dueDayInput) {
      dueDayInput.value = dueDate.getDate();
    }
  }

  const hintEl = $("bpi-cc-hint");
  if (hintEl) {
    hintEl.innerHTML = `\u{1F4A1} Charged on <b>${MONTHS_SHORT[m]} ${ordinal(txDay)}</b> \u2192 Statement cut-off ${MONTHS_SHORT[cutoffDate.getMonth()]} ${ordinal(cutoff)} \u2192 <b>Due ${MONTHS_SHORT[dueDate.getMonth()]} ${ordinal(dueDate.getDate())}, ${dueDate.getFullYear()}</b>. Shown in the BPI Platinum Rewards section.`;
  }
}
export function openModalShell() {
  // Save is wired through data-action="saveModal" on the button (an extra onclick here made it fire twice)
  $("save-btn").onclick = null;
  const ov = $("modal-overlay");
  ov.classList.add("open");
}

export function closeModal() {
  $("modal-overlay").classList.remove("open");
  setActiveEdit(null);
}

export function openItemModal(who, kind, id, presetDay) {
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
  if ((who === "debt" || who === "pdebt") && isNew) {
    title = kind === "income" ? "Add Person (They owe me)" : "Add Person (I owe them)";
  }
  $("modal-title").textContent = title;
  $("modal-title").className = `text-lg font-black uppercase tracking-tight ${o.text}`;

  const kids = it ? getKids(it, selectedKey) : [];
  let body = "";
  let more = "";
  if (isNew) {
    // Which person's account the new item belongs to
    const debtSide = who === "debt" || who === "pdebt";
    const opts = debtSide
      ? [["debt", `${OWNERS.charlie.label} debt tracker`], ["pdebt", `${OWNERS.partner.label} debt tracker`]]
      : [["charlie", OWNERS.charlie.label], ["partner", OWNERS.partner.label]];
    body += `<div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Whose account</label>
      <div id="f-who" data-val="${who}" class="grid grid-cols-2 gap-2">${opts.map(([w, label]) => `<button type="button" data-action="pickOwner" data-arg0="${w}" class="py-3 rounded-xl font-bold text-xs ${w === who ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"}">${escapeHtml(label)}</button>`).join("")}</div></div>`;
  }
  body += inputBlock(kind === "income" ? "Source" : (who === "debt" ? "Name" : "Name"), "f-name", name, "text", 'placeholder="e.g. Rent"');
  if (kids.length) {
    body += `<div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Amount (₱)</label>
      <div class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-slate-300">${peso(itemTotal(it, selectedKey))} <span class="text-[11px] font-bold text-slate-500">· sum of ${kids.length} sub-expenses</span></div></div>`;
  } else {
    body += `<div id="f-amount-wrap">${inputBlock("Amount (₱)", "f-amount", amount, "text", 'inputmode="text" placeholder="0"')}</div>`;
    if (isNew && kind === "expenses") {
      body += `<div class="flex items-center justify-between bg-slate-900 rounded-xl px-3.5 py-2.5">
        <div><p class="text-sm font-bold text-white">Group with sub-expenses</p><p id="f-group-hint" class="hidden text-[10px] text-violet-300">Amount = sum of sub-expenses. You'll add them next.</p><p class="text-[10px] text-slate-500">e.g. Family Expense with several items</p></div>
        <button type="button" id="f-group" data-on="false" data-action="toggleField" data-arg0="this" class="w-10 h-6 rounded-full transition-colors bg-slate-700 relative flex-shrink-0">
          <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all"></span>
        </button>
      </div>`;
    }
  }

  // Spending log sits up front (not under "More options") so adding spending is one tap away
  if (!isNew && !kids.length && kind === "expenses") body += `<div id="spend-section">${spendSectionHtml(it)}</div>`;

  body += `<div class="flex items-center justify-between bg-slate-900 rounded-xl px-3.5 py-2.5">
    <div><p class="text-sm font-bold text-white">Recurring</p><p class="text-[10px] text-slate-500">Repeats every month</p></div>
    <button type="button" id="f-recurring" data-on="${recurring}" data-action="toggleField" data-arg0="this" class="w-10 h-6 rounded-full transition-colors ${recurring ? "bg-indigo-600" : "bg-slate-700"} relative flex-shrink-0">
      <span class="absolute top-1 ${recurring ? "left-5" : "left-1"} w-4 h-4 bg-white rounded-full transition-all"></span>
    </button>
  </div>`;

  if (kind === "expenses") {
    const incl = !(it && it.excluded);
    body += `<div class="flex items-center justify-between bg-slate-900 rounded-xl px-3.5 py-2.5">
    <div><p class="text-sm font-bold text-white">Include in computation</p><p class="text-[10px] text-slate-500">Off = shown in the list but left out of totals &amp; projections</p></div>
    <button type="button" id="f-include" data-on="${incl}" data-action="toggleField" data-arg0="this" class="w-10 h-6 rounded-full transition-colors ${incl ? "bg-indigo-600" : "bg-slate-700"} relative flex-shrink-0">
      <span class="absolute top-1 ${incl ? "left-5" : "left-1"} w-4 h-4 bg-white rounded-full transition-all"></span>
    </button>
  </div>`;
  }

  let lastPm = "cash";
  try { lastPm = localStorage.getItem("moneyku_last_pm") || "cash"; } catch { /* ignore */ }
  const knownPm = (id) => id === "cash" || [...CREDIT_CARD_METHODS, ...ACCOUNT_PAYMENT_METHODS].some((c) => c.id === id);
  if (!knownPm(lastPm)) lastPm = "bpi_platinum";
  let payMethod = it ? (it.paymentMethod || "cash") : (kind === "expenses" ? lastPm : "cash");
  if (payMethod === "none") payMethod = "cash";
  if (!knownPm(payMethod)) payMethod = "bpi_platinum";
  const txDayVal = it ? (it.txDay || 15) : 15;
  const cutoffDayVal = it ? (it.cutoffDay || 14) : 14;

  if (kind === "expenses") {
    body += `<div class="space-y-0.5">
      <label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Payment Method / Category</label>
      <select id="f-paymethod" data-action="updateBpiCcMonth" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none">
        <option value="cash" ${payMethod === "cash" ? "selected" : ""}>Cash / Bank / E-Wallet</option>
        ${ACCOUNT_PAYMENT_METHODS.map((c) => `<option value="${c.id}" ${payMethod === c.id ? "selected" : ""}>${c.icon} ${escapeHtml(c.label)}</option>`).join("")}
        ${CREDIT_CARD_METHODS.map((c) => `<option value="${c.id}" ${payMethod === c.id ? "selected" : ""}>💳 ${escapeHtml(c.label)}</option>`).join("")}
      </select>
    </div>`;

    const txDateVal = it ? (it.txDate || "") : "";

    more += `<div id="bpi-cc-box" class="${payMethod === "bpi_platinum" ? "" : "hidden"} p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-3">
      <div class="flex items-center gap-2 text-indigo-300 text-xs font-black">
        <span class="material-icons text-sm">credit_card</span>
        <span>BPI Credit Card Auto-Scheduling</span>
      </div>
      <div>
        <label class="text-[10px] font-bold uppercase text-slate-400">Date of Purchase</label>
        <input type="date" id="f-txdate" value="${txDateVal}" data-action="updateBpiCcMonth" class="w-full bg-slate-900 rounded-xl py-2.5 px-3 text-sm font-bold text-white focus:outline-none" />
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

  more += `<div class="grid grid-cols-2 gap-2.5"><div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Starts</label>
    <select id="f-start" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none">${monthSelect("f-start", start, false)}</select></div>`;

  more += `<div class="space-y-0.5" id="f-end-wrap"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Runs until</label>
    <select id="f-end" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none">${monthSelect("f-end", end, true, start)}</select></div></div>`;

  if (kind === "expenses") {
    const curCat = it ? (it.category || "") : "";
    more += `<div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Category <span class="text-slate-600">(for budgets)</span></label>
      <select id="f-category" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none">
        <option value="">Auto${it ? ` (${catInfo(categoryOf(it)).label})` : ""}</option>
        ${SPEND_CATS.map((c) => `<option value="${c.id}" ${curCat === c.id ? "selected" : ""}>${c.label}</option>`).join("")}
      </select></div>`;
  }
  const pd = parseInt(presetDay, 10);
  const ddVal = it ? (dueDayFor(it) ?? "") : (pd >= 1 && pd <= 31 ? pd : "");
  more += `<div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Auto-completes on day <span class="text-slate-600">(1-31, optional)</span></label>
    <input type="number" id="f-dueday" min="1" max="31" inputmode="numeric" value="${ddVal}" placeholder="e.g. 29" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none" /></div>`;

  if (!isNew && !kids.length) {
    const verb = kind === "income" ? "Received" : "Paid";
    let hint = kind === "income" ? "Mark this month's income received" : "Mark this month settled";
    if (kind === "expenses") {
      hint = `Locks the final for this month${getSpendList(it.id, selectedKey).length ? "" : " (at the estimate)"}`;
    }
    more += `<div class="flex items-center justify-between bg-slate-900 rounded-xl px-3.5 py-2.5">
      <div><p class="text-sm font-bold text-white">${verb} in ${monthShort(selectedKey)}</p><p class="text-[10px] text-slate-500">${hint}</p></div>
      <button type="button" id="f-paid" data-on="${settledNow}" data-action="toggleField" data-arg0="this" class="w-10 h-6 rounded-full transition-colors ${settledNow ? "bg-emerald-600" : "bg-slate-700"} relative flex-shrink-0">
        <span class="absolute top-1 ${settledNow ? "left-5" : "left-1"} w-4 h-4 bg-white rounded-full transition-all"></span>
      </button>
    </div>`;
  }

  if (!isNew && kind === "expenses") {
    more += `<button type="button" data-action="openChildModal" data-arg0="${who}" data-arg1="${id}" class="w-full py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl font-bold text-violet-300 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><span class="material-icons" style="font-size:18px">account_tree</span>Add sub-expense</button>`;
  }

  if (!isNew) {
    more += `<button type="button" data-action="duplicateItem" data-arg0="${who}" data-arg1="${kind}" data-arg2="${id}" class="w-full py-2.5 bg-slate-900 rounded-xl font-bold text-slate-300 text-sm flex items-center justify-center gap-2"><span class="material-icons" style="font-size:18px">content_copy</span>Duplicate</button>`;
  }
  if (more) {
    const openMoreByDefault = payMethod === "bpi_platinum" || (isNew && pd >= 1);
    body += `<details id="f-more" ${openMoreByDefault ? "open" : ""} class="group">
      <summary class="flex items-center justify-between cursor-pointer select-none text-xs font-bold text-slate-400 py-1 px-1 list-none">
        <span>More options</span><span class="material-icons text-base transition-transform group-open:rotate-180">expand_more</span>
      </summary>
      <div class="space-y-3 pt-2">${more}</div>
    </details>`;
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
  $("modal-title").className = "text-lg font-black uppercase tracking-tight text-violet-300";
  const settledNow = c ? isPaid(c.id, selectedKey) : false;
  let body = inputBlock("Group name (header)", "f-parent", parent.name, "text", 'placeholder="Group name"');
  body += inputBlock("Name", "f-name", c ? c.name : "", "text", 'placeholder="e.g. Electricity"');
  body += inputBlock("Estimate (₱)", "f-amount", c ? childAmt(c, selectedKey) : "", "text", 'inputmode="text" placeholder="0"');
  if (!isNew) {
    body += `<div id="spend-section">${spendSectionHtml(c)}</div>`;
    body += `<div class="flex items-center justify-between bg-slate-900 rounded-xl px-3.5 py-2.5">
      <div><p class="text-sm font-bold text-white">Paid in ${monthShort(selectedKey)}</p><p class="text-[10px] text-slate-500">Locks the final for this month${getSpendList(c.id, selectedKey).length ? "" : " (at the estimate)"}</p></div>
      <button type="button" id="f-paid" data-on="${settledNow}" data-action="toggleField" data-arg0="this" class="w-10 h-6 rounded-full transition-colors ${settledNow ? "bg-emerald-600" : "bg-slate-700"} relative flex-shrink-0"><span class="absolute top-1 ${settledNow ? "left-5" : "left-1"} w-4 h-4 bg-white rounded-full transition-all"></span></button>
    </div>`;
  } else {
    body += `<button type="button" data-action="saveChildAndAddAnother" class="w-full py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl font-bold text-violet-300 text-sm flex items-center justify-center gap-2"><span class="material-icons" style="font-size:18px">playlist_add</span>Save &amp; add another</button>`;
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
  $("modal-title").textContent = "Edit Shares & Rates";
  $("modal-title").className = "text-lg font-black uppercase tracking-tight text-amber-400";
  const shares = sharesOf(inv, "shares", DEFAULT_SHARES);
  const pending = sharesOf(inv, "pendingShares", DEFAULT_PENDING_SHARES);
  const fieldCls = "w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500 transition-colors";
  
  $("modal-body").innerHTML = `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Vested shares</label>
          <input type="number" id="mod-shares" min="0" step="any" inputmode="decimal" class="${fieldCls}" value="${shares}">
        </div>
        <div>
          <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Next vest (Apr 2027)</label>
          <input type="number" id="mod-pending" min="0" step="any" inputmode="decimal" class="${fieldCls}" value="${pending}">
        </div>
      </div>
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

export function openAccountModal(id, who) {
  const appData = getAppData();
  const a = id ? (appData?.accounts || []).find((x) => x.id === id) : null;
  const isNew = !a;
  setActiveEdit({ kind: "account", id, owner: a ? acctOwner(a) : (who === "partner" ? "partner" : "charlie") });
  $("modal-title").textContent = isNew ? "Add Account" : "Edit Account";
  $("modal-title").className = "text-lg font-black uppercase tracking-tight text-emerald-400";

  let body = "";
  body += inputBlock("Account name", "f-name", a ? a.name : "", "text", 'placeholder="Pick or type a bank, e-wallet or card" list="acct-name-options" autocomplete="off"');
  body += `<datalist id="acct-name-options">${PH_ACCOUNT_OPTIONS.flatMap((g) => g.names.map((n) => `<option value="${escapeHtml(n)}" label="${g.group}"></option>`)).join("")}</datalist>`;
  body += inputBlock("Balance (₱)", "f-amount", a ? a.amount : "", "text", 'inputmode="text" placeholder="0"');
  const curType = a ? acctType(a) : "bank";
  body += `<div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">Type</label><select id="f-type" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none appearance-none"><option value="bank" ${curType === "bank" ? "selected" : ""}>Cash & Bank (counts toward money on hand)</option><option value="credit" ${curType === "credit" ? "selected" : ""}>Credit card (not counted)</option></select></div>`;
  $("modal-body").innerHTML = body;

  const delBtn = $("delete-btn");
  if (isNew) delBtn.classList.add("hidden");
  else { delBtn.classList.remove("hidden"); delBtn.onclick = () => confirmDelete(); }

  openModalShell();
}

export function openTransferModal(who) {
  const accts = (getAppData()?.accounts || []).filter((a) => acctOwner(a) === (who === "partner" ? "partner" : "charlie")).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true }));
  if (accts.length < 2) return toast("Add at least 2 accounts to transfer", "error");
  setActiveEdit({ kind: "transfer" });
  $("modal-title").textContent = "Transfer";
  $("modal-title").className = "text-lg font-black uppercase tracking-tight text-emerald-400";
  const opts = (sel) => accts.map((a, i) => `<option value="${a.id}" ${i === sel ? "selected" : ""}>${escapeHtml(a.name)} — ${peso(a.amount)}</option>`).join("");
  const sel = "w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none appearance-none";
  $("modal-body").innerHTML = `
    <div class="space-y-0.5">
      <label class="text-[10px] font-bold uppercase text-slate-500 ml-1">From</label>
      <select id="f-from" class="${sel}">${opts(0)}</select>
    </div>
    <div class="flex justify-center -my-1"><span class="material-icons text-emerald-400">south</span></div>
    <div class="space-y-0.5">
      <label class="text-[10px] font-bold uppercase text-slate-500 ml-1">To</label>
      <select id="f-to" class="${sel}">${opts(1)}</select>
    </div>
    ${inputBlock("Amount (₱)", "f-amount", "", "text", 'inputmode="text" placeholder="0"')}
  `;
  $("delete-btn").classList.add("hidden");
  openModalShell();
}
export function pickOwner(btn, w) {
  const wrap = btn.parentElement;
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
      if (parent && parent.recurring) isRecurring = true;
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
  // Snapshot so the deletion can be undone from the toast
  const snapshot = JSON.parse(JSON.stringify(appData));

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
      if (cmpKey(item.end, item.start || parent.start) < 0) {
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
  closeConfirm(); closeModal(); renderAll();
  toast("Deleted", "ok", {
    actionLabel: "Undo",
    duration: 6000,
    onAction: async () => {
      setAppData(snapshot);
      await syncSet(snapshot);
      renderAll();
      toast("Restored");
    },
  });
}