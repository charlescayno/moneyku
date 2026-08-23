// =============================
// Application State & Computations
// =============================

import {
  HORIZON,
  currentKey,
  addMonths,
  cmpKey,
  keyParts,
  monthsInclusive,
  parseDueDay,
  dueDayFor,
} from "./utils.js";

// Internal state variables
let appData = null;
let activeView = "budget";
let selectedKey = null; // "YYYY-MM"
let activeEdit = null; // { kind, ... }
let hideProjected = localStorage.getItem("hideProjected") !== "false";
let hideInvestments = localStorage.getItem("hideInvestments") === null ? true : localStorage.getItem("hideInvestments") === "true";
let overviewPage = 0;

// State Getters and Setters
export function getAppData() { return appData; }
export function setAppData(data) { appData = data; }

export function getActiveView() { return activeView; }
export function setActiveView(view) { activeView = view; }

export function getSelectedKey() { return selectedKey; }
export function setSelectedKey(key) { selectedKey = key; }

export function getActiveEdit() { return activeEdit; }
export function setActiveEdit(edit) { activeEdit = edit; }

export function getHideProjected() { return hideProjected; }
export function setHideProjected(val) { 
  hideProjected = val; 
  localStorage.setItem("hideProjected", hideProjected);
}

export function getHideInvestments() { return hideInvestments; }
export function setHideInvestments(val) { 
  hideInvestments = val; 
  localStorage.setItem("hideInvestments", hideInvestments);
}

export function getOverviewPage() { return overviewPage; }
export function setOverviewPage(p) { overviewPage = p; }

// Timeline generator
export function timeline() {
  if (!appData) return [];
  const out = [];
  let k = appData.startMonth || currentKey();
  for (let i = 0; i < HORIZON; i++) { 
    out.push(k); 
    k = addMonths(k, 1); 
  }
  return out;
}

export function clampSelected() {
  const t = timeline();
  if (!selectedKey || !t.includes(selectedKey)) {
    selectedKey = t.includes(currentKey()) ? currentKey() : t[0];
  }
}

// Data accessors
export function getItems(who, kind) { 
  return (appData?.items?.[who]?.[kind] || []).filter(Boolean); 
}

export function itemActiveIn(it, k) {
  if (!appData) return false;
  if (appData.deleted?.[k]?.[it.id]) return false;
  if (!it.recurring) return it.start === k;
  if (cmpKey(k, it.start) < 0) return false;
  if (it.end && cmpKey(k, it.end) > 0) return false;
  return true;
}

export function amountIn(it, k) {
  const ov = appData?.overrides?.[k]?.[it.id];
  return ov != null ? Number(ov) : Number(it.amount) || 0;
}

export function hasOverride(id, k) { 
  return appData?.overrides?.[k]?.[id] != null; 
}

export function isPaid(id, k) { 
  return !!appData?.paid?.[k]?.[id]; 
}

export function accountsTotal() { 
  return (appData?.accounts || []).reduce((s, a) => s + (Number(a.amount) || 0), 0); 
}

// Sub-expenses: container logic
export function getKids(it) { 
  return Array.isArray(it?.children) ? it.children.filter(Boolean) : []; 
}

export function getSpendList(childId, k) {
  const v = appData?.spend?.[k]?.[childId];
  if (!v) return [];
  return (Array.isArray(v) ? v : Object.values(v)).filter(Boolean);
}

export function spentIn(childId, k) { 
  return getSpendList(childId, k).reduce((s, e) => s + (Number(e.amount) || 0), 0); 
}

export function childFinal(c, k) {
  const list = getSpendList(c.id, k);
  return list.length ? spentIn(c.id, k) : (Number(c.amount) || 0);
}

export function itemFinal(it, k) {
  const list = getSpendList(it.id, k);
  return list.length ? spentIn(it.id, k) : amountIn(it, k);
}

export function itemTotal(it, k) {
  const kids = getKids(it);
  if (!kids.length) return isPaid(it.id, k) ? itemFinal(it, k) : amountIn(it, k);
  return kids.reduce((s, c) => s + (isPaid(c.id, k) ? childFinal(c, k) : (Number(c.amount) || 0)), 0);
}

export function itemAmts(it, k) {
  const kids = getKids(it);
  if (!kids.length) { 
    const a = itemTotal(it, k); 
    return { total: a, paid: isPaid(it.id, k) ? a : 0 }; 
  }
  let total = 0, paid = 0;
  for (const c of kids) {
    const settled = isPaid(c.id, k);
    const amt = settled ? childFinal(c, k) : (Number(c.amount) || 0);
    total += amt;
    if (settled) paid += amt;
  }
  return { total, paid };
}

export function monthTotals(k) {
  let cI = 0, dI = 0, cE = 0, dE = 0, incRecv = 0, expPaid = 0, debtRecv = 0, debtPaid = 0;
  for (const it of getItems("charlie", "income")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); cI += r.total; incRecv += r.paid; }
  }
  for (const it of getItems("debt", "income")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); dI += r.total; debtRecv += r.paid; }
  }
  for (const it of getItems("charlie", "expenses")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); cE += r.total; expPaid += r.paid; }
  }
  for (const it of getItems("debt", "expenses")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); dE += r.total; debtPaid += r.paid; }
  }
  
  const income = cI, expenses = cE, toPay = expenses - expPaid;
  const toReceive = income - incRecv;
  const debtToReceive = dI - debtRecv;
  const debtToPay = dE - debtPaid;
  
  return {
    cI, dI, cE, dE, income, expenses, savings: income - toPay,
    incomeReceived: incRecv, expensePaid: expPaid,
    toReceive, toPay,
    debtToReceive, debtToPay,
    netPending: toReceive - toPay + debtToReceive - debtToPay,
  };
}

export function runningFundsAt(k) {
  let bal = accountsTotal();
  for (const mk of timeline()) { 
    bal += monthTotals(mk).netPending; 
    if (mk === k) break; 
  }
  return bal;
}

export function currentMoneyAt() { 
  return accountsTotal(); 
}

export function reconcileAutoPaid() {
  if (!appData) return false;
  let changed = false;
  const curK = currentKey();
  const inTimeline = timeline().includes(curK);
  const today = new Date().getDate();
  for (const who of ["charlie", "debt"]) {
    for (const it of getItems(who, "expenses")) {
      if (it.dueDay == null) {
        const d = parseDueDay(it.name);
        if (d != null) { it.dueDay = d; changed = true; }
      }
      if (inTimeline && it.recurring && itemActiveIn(it, curK)) {
        const d = dueDayFor(it);
        if (d != null && today >= d) {
          appData.paid[curK] = appData.paid[curK] || {};
          if (appData.paid[curK][it.id] === undefined) { 
            appData.paid[curK][it.id] = true; 
            changed = true; 
          }
        }
      }
    }
  }
  return changed;
}

export function allInstallments() {
  const out = [];
  for (const who of ["charlie", "debt"]) {
    for (const it of getItems(who, "expenses")) {
      if (it.recurring && it.end) out.push({ ...it, who });
    }
  }
  return out;
}

export function monthsPaidCount(it) {
  let count = 0, k = it.start;
  while (cmpKey(k, it.end) <= 0) {
    if (isPaid(it.id, k)) count++;
    k = addMonths(k, 1);
  }
  return count;
}

export function itemCategory(it) {
  if (!it.recurring) return 0;
  if (dueDayFor(it) != null) return 1;
  if (it.end) return 3;
  return 2;
}

export function sortItems(items) {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ca = itemCategory(a.it), cb = itemCategory(b.it);
      if (ca !== cb) return ca - cb;
      if (ca === 1) return (dueDayFor(a.it) - dueDayFor(b.it)) || a.i - b.i;
      if (ca === 3) return cmpKey(a.it.end, b.it.end) || a.i - b.i;
      return a.i - b.i;
    })
    .map((x) => x.it);
}

export function findItemById(id) {
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      const it = getItems(who, kind).find((x) => x.id === id);
      if (it) return it;
    }
  }
  return null;
}

export function findItemOrChildById(id) {
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["expenses", "income"]) {
      for (const it of getItems(who, kind)) {
        if (it.id === id) return it;
        for (const c of getKids(it)) {
          if (c.id === id) return c;
        }
      }
    }
  }
  return null;
}
