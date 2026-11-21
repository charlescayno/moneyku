// =============================
// Application State & Computations
// =============================

import {
  HORIZON,
  currentKey,
  addMonths,
  cmpKey,
  keyParts,
  mondaysInMonth,
  monthsInclusive,
  parseDueDay,
  dueDayFor,
} from "./utils.js";
import { cardDueIn, isCardItem } from "./card.js";

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

let expenseSort = localStorage.getItem("expenseSort") === "name" ? "name" : "default";
export function getExpenseSort() { return expenseSort; }
let simIncScale = Math.min(150, Math.max(50, parseFloat(localStorage.getItem("simIncScale")) || 100));
/** What-if income estimate for the simulation, in percent (100 = as entered). Never changes the stored amounts. */
export function getSimIncomeScale() { return simIncScale; }
/** What the simulated income lines add up to for month k as entered (before the what-if slider). */
export function simIncomeEntered(k) {
  let t = 0;
  for (const it of getItems("simulated", "income")) if (itemActiveIn(it, k)) t += itemAmts(it, k).total;
  return t;
}
export function setSimIncomeScale(p) { simIncScale = Math.min(150, Math.max(50, Math.round((Number(p) || 100) * 100) / 100)); localStorage.setItem("simIncScale", String(simIncScale)); }
let simPersonSort = localStorage.getItem("simPersonSort") !== "0"; // grouped by person unless switched off
export function getSimPersonSort() { return simPersonSort; }
export function setSimPersonSort(on) { simPersonSort = !!on; localStorage.setItem("simPersonSort", simPersonSort ? "1" : "0"); }

export function setExpenseSort(val) {
  expenseSort = val === "name" ? "name" : "default";
  localStorage.setItem("expenseSort", expenseSort);
}

// Parents currently in "Arrange" mode (sub-expense reordering). In memory only.
const arranging = new Set();
export function isArranging(parentId) { return arranging.has(parentId); }
export function toggleArranging(parentId) {
  if (arranging.has(parentId)) arranging.delete(parentId); else arranging.add(parentId);
}

export function getOverviewPage() { return overviewPage; }
export function setOverviewPage(p) { overviewPage = p; }

// The timeline (and so the Overview) ends here
const LAST_MONTH = "2046-12";

// Timeline generator
export function timeline() {
  if (!appData) return [];
  const out = [];
  let k = appData.startMonth || currentKey();
  for (let i = 0; i < HORIZON; i++) {
    if (cmpKey(k, LAST_MONTH) > 0) break; // nothing after 2046
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

// A sub-expense's amount for month k (a "this month only" change is stored as an override)
// A sub-expense with `perMonday` (e.g. weekly grocery) costs perMonday x the number of Mondays in that month.
export function childAmt(c, k) {
  const ov = appData?.overrides?.[k]?.[c.id];
  if (ov != null) return Number(ov);
  if (c.perMonday != null && k) return Number(c.perMonday) * mondaysInMonth(k);
  return Number(c.amount) || 0;
}

export function hasOverride(id, k) { 
  return appData?.overrides?.[k]?.[id] != null; 
}

export function isPaid(id, k) { 
  return !!appData?.paid?.[k]?.[id]; 
}

// Account type: "bank" (cash & bank) or "credit". Uses the saved type, otherwise guesses from the name.
export function acctType(a) {
  if (a && (a.type === "credit" || a.type === "bank")) return a.type;
  return /credit|platinum|\bcc\b/i.test((a && a.name) || "") ? "credit" : "bank";
}

// Money on hand: credit accounts are not counted (their balance is available credit, not cash)
// Whose account it is: "partner" or (default, incl. old data) "charlie"
export function acctOwner(a) { return a && a.owner === "partner" ? "partner" : "charlie"; }
export function accountsOf(who) { return (appData?.accounts || []).filter((a) => acctOwner(a) === who).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true })); }

// Defaults to Charles' accounts so his projection never includes his partner's money
export function accountsTotal(who = "charlie") { 
  if (who === "simulated") return Number(appData?.simCash) || 0; // the sandbox has its own starting cash, never real accounts
  return accountsOf(who).filter((a) => acctType(a) !== "credit").reduce((s, a) => s + (Number(a.amount) || 0), 0); 
}

// Sub-expenses: container logic
// With a month key, only sub-expenses active in that month (not deleted/ended there) are returned.
export function getKids(it, k) {
  const all = Array.isArray(it?.children) ? it.children.filter(Boolean) : [];
  if (!k) return all;
  return all.filter((c) =>
    !appData?.deleted?.[k]?.[c.id] &&
    (!c.start || cmpKey(k, c.start) >= 0) &&
    (!c.end || cmpKey(k, c.end) <= 0));
}

/** Sub-expenses of it (active in month k) that have their own due day. */
export function dueKids(it, k) { return getKids(it, k).filter((c) => dueDayFor(c) != null); }

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
  return list.length ? spentIn(c.id, k) : childAmt(c, k);
}

export function itemFinal(it, k) {
  const list = getSpendList(it.id, k);
  return list.length ? spentIn(it.id, k) : amountIn(it, k);
}

export function itemTotal(it, k) {
  const kids = getKids(it, k);
  if (!kids.length) return isPaid(it.id, k) ? itemFinal(it, k) : amountIn(it, k);
  return kids.reduce((s, c) => s + (isPaid(c.id, k) ? childFinal(c, k) : childAmt(c, k)), 0);
}

export function itemAmts(it, k) {
  if (it.excluded) return { total: 0, paid: 0 }; // switched off: kept in the list, left out of every total
  const kids = getKids(it, k);
  if (!kids.length) { 
    const a = itemTotal(it, k); 
    return { total: a, paid: isPaid(it.id, k) ? a : 0 }; 
  }
  let total = 0, paid = 0;
  for (const c of kids) {
    const settled = isPaid(c.id, k);
    const amt = settled ? childFinal(c, k) : childAmt(c, k);
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
    if (isCardItem(it)) continue; // card purchases are counted as one card bill below
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); cE += r.total; expPaid += r.paid; }
  }
  // The BPI Platinum card bill that falls due this month (minus what was already paid on it)
  const card = cardDueIn(k);
  cE += card.total; expPaid += card.paid;
  for (const it of getItems("debt", "expenses")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); dE += r.total; debtPaid += r.paid; }
  }
  
  // Partner budget: tracked separately, never part of Charles' totals or projection
  let pI = 0, pE = 0, pRecv = 0, pPaid = 0;
  for (const it of getItems("partner", "income")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); pI += r.total; pRecv += r.paid; }
  }
  for (const it of getItems("partner", "expenses")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); pE += r.total; pPaid += r.paid; }
  }
  // Partner's own debt tracker (separate from Charles' debt tracker)
  let pdI = 0, pdE = 0, pdRecv = 0, pdPaid = 0;
  for (const it of getItems("pdebt", "income")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); pdI += r.total; pdRecv += r.paid; }
  }
  for (const it of getItems("pdebt", "expenses")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); pdE += r.total; pdPaid += r.paid; }
  }

  // Simulated sandbox: its own lists only, same arithmetic as a person's budget (no card special-casing)
  let sI = 0, sE = 0, sRecv = 0, sPaid = 0;
  for (const it of getItems("simulated", "income")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); sI += r.total * (simIncScale / 100); sRecv += r.paid * (simIncScale / 100); }
  }
  for (const it of getItems("simulated", "expenses")) {
    if (itemActiveIn(it, k)) { const r = itemAmts(it, k); sE += r.total; sPaid += r.paid; }
  }

  const income = cI, expenses = cE, toPay = expenses - expPaid;
  const toReceive = income - incRecv;
  const debtToReceive = dI - debtRecv;
  const debtToPay = dE - debtPaid;
  
  return {
    sI, sE, sToReceive: sI - sRecv, sToPay: sE - sPaid, sNetPending: (sI - sRecv) - (sE - sPaid),
    pI, pE, pToReceive: pI - pRecv, pToPay: pE - pPaid,
    pdI, pdE, pDebtToReceive: pdI - pdRecv, pDebtToPay: pdE - pdPaid,
    pNetPending: (pI - pRecv) - (pE - pPaid) + (pdI - pdRecv) - (pdE - pdPaid),
    cI, dI, cE, dE, income, expenses, savings: income - toPay,
    incomeReceived: incRecv, expensePaid: expPaid,
    toReceive, toPay,
    debtToReceive, debtToPay,
    netPending: toReceive - toPay + debtToReceive - debtToPay,
  };
}

// Combined Charles + partner view (Debt Tracker and Accounts excluded)
export function householdTotals(k) {
  const t = monthTotals(k);
  const ci = includedWho().includes("charlie") ? 1 : 0, pi = includedWho().includes("partner") ? 1 : 0;
  const income = ci * t.cI + pi * t.pI, expenses = ci * t.cE + pi * t.pE;
  const toReceive = ci * t.toReceive + pi * t.pToReceive, toPay = ci * t.toPay + pi * t.pToPay;
  return {
    income, expenses, net: income - expenses, toReceive, toPay,
    charlieNet: t.cI - t.cE, partnerNet: t.pI - t.pE,
    cash: ci * accountsTotal("charlie") + pi * accountsTotal("partner"),
    debtNet: ci * (t.debtToReceive - t.debtToPay) + pi * (t.pDebtToReceive - t.pDebtToPay),
    projected: householdProjectedAt(k),
    charlie: { projected: runningFundsAt(k, "charlie"), debtNet: t.debtToReceive - t.debtToPay, cash: accountsTotal("charlie"), income: t.cI, expenses: t.cE, net: t.cI - t.cE, toReceive: t.toReceive, toPay: t.toPay },
    partner: { projected: runningFundsAt(k, "partner"), debtNet: t.pDebtToReceive - t.pDebtToPay, cash: accountsTotal("partner"), income: t.pI, expenses: t.pE, net: t.pI - t.pE, toReceive: t.pToReceive, toPay: t.pToPay },
  };
}

/**
 * Projected funds at the end of month k: cash and bank now, plus what is still to come from the current
 * month up to k (income left to receive minus bills left to pay, debts included).
 * Months before the current one are not carried forward: your balances already reflect them, so their
 * leftover unpaid items would be counted twice. A past month just shows its own outstanding amount.
 */
export function runningFundsAt(k, who = "charlie") {
  let bal = accountsTotal(who);
  const now = currentKey();
  const pend = (m) => (who === "partner" ? monthTotals(m).pNetPending : who === "simulated" ? monthTotals(m).sNetPending : monthTotals(m).netPending);
  if (cmpKey(k, now) < 0) return bal + pend(k);
  for (const mk of timeline()) {
    if (cmpKey(mk, now) < 0) continue;
    bal += pend(mk);
    if (mk === k) break;
  }
  return bal;
}

/**
 * Money still to come in and go out in month m for "charlie", "partner" or "all" (debt trackers included).
 * It is the same pending amount runningFundsAt adds each month, so net equals the change in balance.
 */
const OWNERS_OF = { charlie: ["charlie", "debt"], partner: ["partner", "pdebt"] };

// Pending (not yet received / paid) parts of a month's items, optionally filtered:
//   opts.cons    = count only recurring income (one-time income and debts owed to you are not certain)
//   opts.noInst  = leave out installments (recurring expenses with an end month)
// Includes the BPI Platinum bill that falls due in the month as one expense line.
export function flowItems(m, who, opts = {}) {
  const income = [], expense = [];
  for (const w of OWNERS_OF[who]) {
    const isDebt = w === "debt" || w === "pdebt";
    for (const it of getItems(w, "income")) {
      if (!itemActiveIn(it, m)) continue;
      if (opts.cons && (isDebt || !it.recurring)) continue;
      const r = itemAmts(it, m);
      const amt = r.total - r.paid;
      if (Math.abs(amt) > 0.005) income.push({ name: it.name, who: w, amt });
    }
    for (const it of getItems(w, "expenses")) {
      if (!itemActiveIn(it, m) || isCardItem(it)) continue; // card purchases are paid via the card bill below
      if (opts.noInst && it.recurring && it.end) continue;
      const r = itemAmts(it, m);
      const amt = r.total - r.paid;
      if (Math.abs(amt) > 0.005) expense.push({ name: it.name, who: w, amt, inst: !!(it.recurring && it.end) });
    }
  }
  if (who === "charlie") {
    const card = cardDueIn(m);
    const left = card.total - card.paid;
    if (Math.abs(left) > 0.005) expense.push({ name: "BPI Platinum card bill", who: "charlie", amt: left });
  }
  return { income, expense };
}

/** Pending flows of one month for both people: { charlie, partner } each { inc, out, net }. */
function flowsFor(m, opts = {}) {
  const t = monthTotals(m);
  const mk = (inc, out) => ({ inc, out, net: inc - out });
  let c = { inc: t.toReceive + t.debtToReceive, out: t.toPay + t.debtToPay };
  let p = { inc: t.pToReceive + t.pDebtToReceive, out: t.pToPay + t.pDebtToPay };
  if (opts.cons || opts.noInst) {
    // Recompute from items so the filters apply (the plain totals above equal the unfiltered sums)
    for (const [who, f] of [["charlie", c], ["partner", p]]) {
      const it = flowItems(m, who, opts);
      f.inc = it.income.reduce((s, x) => s + x.amt, 0);
      f.out = it.expense.reduce((s, x) => s + x.amt, 0);
    }
  }
  return { charlie: mk(c.inc, c.out), partner: mk(p.inc, p.out) };
}

export function monthFlow(m, who = "all", opts = {}) {
  const f = flowsFor(m, opts);
  if (who === "charlie" || who === "partner") return f[who];
  const ws = includedWho();
  const inc = ws.reduce((s, w) => s + f[w].inc, 0), out = ws.reduce((s, w) => s + f[w].out, 0);
  return { inc, out, net: inc - out };
}

/** The 13 timeline months starting this month (what the outlook shows). */
export function outlookKeys() {
  const start = currentKey(), tl = timeline();
  const keys = [];
  for (let i = 0; i < 13; i++) { const m = addMonths(start, i); if (tl.includes(m)) keys.push(m); }
  return keys;
}

/** Per-month outlook rows for each view: { m, charlie, partner, all }, each { inc, out, net, bal }. */
export function outlookRows(keys, opts = {}) {
  const now = currentKey(), tl = timeline();
  const cache = new Map();
  const fl = (m) => { if (!cache.has(m)) cache.set(m, flowsFor(m, opts)); return cache.get(m); };
  const cash = { charlie: accountsTotal("charlie"), partner: accountsTotal("partner") };
  // Same walk as runningFundsAt: from this month forward, add each month's pending net
  const bal = (who, m) => {
    let b = cash[who];
    if (cmpKey(m, now) < 0) return b + fl(m)[who].net;
    for (const mk of tl) {
      if (cmpKey(mk, now) < 0) continue;
      b += fl(mk)[who].net;
      if (mk === m) break;
    }
    return b;
  };
  return keys.map((m) => {
    const f = fl(m);
    const c = { ...f.charlie, bal: bal("charlie", m) };
    const p = { ...f.partner, bal: bal("partner", m) };
    const pr = { charlie: c, partner: p }, ws = includedWho();
    const sum = (k) => ws.reduce((s, w) => s + pr[w][k], 0);
    return { m, charlie: c, partner: p, all: { inc: sum("inc"), out: sum("out"), net: sum("net"), bal: sum("bal") } };
  });
}

/** What the projected number is made of, for the month k: cash now + pending in - pending out (this month up to k). */
export function projectionBreakdown(k) {
  const now = currentKey();
  const cash = includedWho().reduce((s, w) => s + accountsTotal(w), 0);
  let inc = 0, out = 0;
  if (cmpKey(k, now) < 0) { const f = monthFlow(k, "all"); inc = f.inc; out = f.out; }
  else for (const mk of timeline()) {
    if (cmpKey(mk, now) < 0) continue;
    const f = monthFlow(mk, "all"); inc += f.inc; out += f.out;
    if (mk === k) break;
  }
  const delta = cmpKey(k, now) > 0 ? monthFlow(k, "all").net : null; // change versus the previous month
  return { cash, inc, out, delta };
}

/** First month (of the next 12) a view's projected balance goes below zero, or null. */
export function firstNegative(rows) {
  const find = (w) => rows.find((r) => r[w].bal < -0.005)?.m || null;
  return { all: find("all"), charlie: find("charlie"), partner: find("partner") };
}

/** Days since the oldest known balance update (cash & bank accounts), per person; null when none are dated. */
export function staleBalanceDays(who) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let worst = null;
  for (const a of accountsOf(who)) {
    if (acctType(a) === "credit" || !a.updated) continue;
    const d = new Date(a.updated + "T00:00:00");
    if (isNaN(d)) continue;
    const days = Math.max(0, Math.round((today - d) / 86400000));
    if (worst == null || days > worst) worst = days;
  }
  return worst;
}

/** Overall projection: Charles' projected funds plus his partner's. */
/** This month's headline numbers for whoever is ticked in the top bar: cash, savings, still to receive, still to pay. */
export function includedTotals(k) {
  const t = monthTotals(k), ws = includedWho();
  const per = {
    charlie: { cash: accountsTotal("charlie"), toReceive: t.toReceive, toPay: t.toPay, savings: t.cI - t.toPay },
    partner: { cash: accountsTotal("partner"), toReceive: t.pToReceive, toPay: t.pToPay, savings: t.pI - t.pToPay },
  };
  const sum = (f) => ws.reduce((s, w) => s + per[w][f], 0);
  return { current: sum("cash"), toReceive: sum("toReceive"), toPay: sum("toPay"), savings: sum("savings") };
}

export function householdProjectedAt(k) {
  return includedWho().reduce((s, w) => s + runningFundsAt(k, w), 0);
}

/**
 * Projected funds for every month of the timeline in one pass: { [monthKey]: amount }.
 * Same rule as runningFundsAt (past months show cash + their own pending; from this month on the pending carries forward),
 * summed over `whos` like householdProjectedAt. `whos` defaults to the people ticked in the top bar.
 */
export function projectedByMonth(whos = includedWho()) {
  const now = currentKey(), out = {};
  const pend = (t, w) => (w === "partner" ? t.pNetPending : w === "simulated" ? t.sNetPending : t.netPending);
  const bal = {};
  for (const w of whos) bal[w] = accountsTotal(w);
  for (const mk of timeline()) {
    const t = monthTotals(mk);
    const past = cmpKey(mk, now) < 0;
    let sum = 0;
    for (const w of whos) {
      if (past) sum += accountsTotal(w) + pend(t, w);
      else { bal[w] += pend(t, w); sum += bal[w]; }
    }
    out[mk] = sum;
  }
  return out;
}

// Simulated sandbox view: on = the budget area shows the simulation instead of Charles / Ynah (this device only)
const SIM_VIEW_KEY = "moneyku_sim_view";
export function getSimView() { try { return localStorage.getItem(SIM_VIEW_KEY) === "1"; } catch (e) { return false; } }
export function setSimView(on) { try { localStorage.setItem(SIM_VIEW_KEY, on ? "1" : "0"); } catch (e) { /* ignore */ } }

const INCL_KEY = "moneyku_incl";
/** Which people count in the combined (all) numbers; per-person numbers are never affected. */
export function includedWho() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(INCL_KEY) || "{}"); } catch (e) { /* ignore */ }
  const ws = ["charlie", "partner"].filter((w) => o[w] !== false);
  return ws.length ? ws : ["charlie", "partner"];
}
export function setWhoIncluded(who, on) {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(INCL_KEY) || "{}"); } catch (e) { /* ignore */ }
  o[who] = !!on;
  // At least one person always counts: switching off the last one ticked turns the other back on
  if (o.charlie === false && o.partner === false) o[who === "charlie" ? "partner" : "charlie"] = true;
  try { localStorage.setItem(INCL_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ }
  return true;
}

export function currentMoneyAt() { 
  return accountsTotal(); 
}

/** `onPaid(monthKey, id)` runs just before an item is flagged paid, so the caller can charge its account. */
export function reconcileAutoPaid(onPaid) {
  if (!appData) return false;
  let changed = false;
  const curK = currentKey();
  const inTimeline = timeline().includes(curK);
  const today = new Date().getDate();
  for (const who of ["charlie", "debt", "partner", "pdebt"]) {
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
            if (onPaid && !getKids(it, curK).length) onPaid(curK, it.id);
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

export function allRecurring(k) {
  const out = [];
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["expenses", "income"]) {
      for (const it of getItems(who, kind)) {
        if (it.recurring && !it.end && (k ? itemActiveIn(it, k) : true)) {
          out.push({ ...it, who, kind });
        }
      }
    }
  }
  return out;
}

// Other modules can say a month is settled in another way (e.g. a fully paid BPI card statement covers that month's charge)
let paidExtra = null;
export function setPaidExtra(fn) { paidExtra = fn; }
/** Is month k of an installment settled? (sub-items all ticked, the item ticked, or a fully paid card statement) */
export function monthPaid(it, k) {
  const kids = getKids(it, k);
  return kids.length ? kids.every((c) => isPaid(c.id, k)) : isPaid(it.id, k) || !!(paidExtra && paidExtra(it, k));
}
export function monthsPaidCount(it) {
  let count = 0, k = it.start;
  while (cmpKey(k, it.end) <= 0) {
    if (monthPaid(it, k)) count++;
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

const byName = (a, b) =>
  String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base", numeric: true });

export function sortItems(items, kind) {
  const nameSort = kind === "expenses" && getExpenseSort() === "name";
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ca = itemCategory(a.it), cb = itemCategory(b.it);
      if (ca !== cb) return ca - cb;
      if (nameSort) return byName(a.it, b.it) || a.i - b.i;
      // Dragged order (item.ord) wins inside a category; items never dragged follow after, in the usual order
      const oa = Number.isFinite(a.it.ord), ob = Number.isFinite(b.it.ord);
      if (oa && ob) return (a.it.ord - b.it.ord) || a.i - b.i;
      if (oa !== ob) return oa ? -1 : 1;
      if (ca === 1) return (dueDayFor(a.it) - dueDayFor(b.it)) || a.i - b.i;
      if (ca === 3) return cmpKey(a.it.end, b.it.end) || a.i - b.i;
      return a.i - b.i;
    })
    .map((x) => x.it);
}

/**
 * Sub-expenses in display order (the stored `children` array is never changed): the parent sort rule
 * (soonest due day first, undated last, ties keep their stored order), then paid ones at the very end.
 */
export function displayKids(kids, k) {
  const byId = new Map(kids.map((c) => [c.id, c]));
  // sortItems ranks by recurring/due day; sub-expenses follow the parent, so rank them as recurring and undated
  const ranked = sortItems(kids.map((c) => ({ ...c, recurring: true, end: null })), "children").map((p) => byId.get(p.id));
  return [...ranked.filter((c) => !isPaid(c.id, k)), ...ranked.filter((c) => isPaid(c.id, k))];
}

export function findItemById(id) {
  for (const who of ["charlie", "debt", "partner", "pdebt", "simulated"]) {
    for (const kind of ["income", "expenses"]) {
      const it = getItems(who, kind).find((x) => x.id === id);
      if (it) return it;
    }
  }
  return null;
}

export function findItemOrChildById(id) {
  for (const who of ["charlie", "debt", "partner", "pdebt", "simulated"]) {
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
