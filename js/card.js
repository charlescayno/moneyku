// =============================
// BPI Platinum Rewards card: statements, charges, payments and reconciliation.
//
// Expenses tagged "bpi_platinum" (charlie's expenses) are NOT counted in the normal
// monthly totals any more. Instead the card makes one bill per statement, counted in
// the month its due date falls in. Data (all in appData):
//   card            { cutoffDay, dueDay }                  defaults 14 / 29
//   cardStatements  [{ key:"YYYY-MM", cutoff, due, amount, note }]   manual overrides
//   cardPayments    [{ id, key, amount, acctId, date }]    key = statement key
// A statement without an override uses cutoff = cutoffDay of its month, due = the next dueDay (the 29th) after the cutoff.
// =============================
import { addMonths, cmpKey, currentKey, generateId } from "./utils.js";
import { getAppData, getItems, itemActiveIn, itemAmts, timeline } from "./state.js";

export const CARD_METHOD = "bpi_platinum";
export const CARD_NAME = "BPI Platinum Rewards";

const pad = (n) => String(n).padStart(2, "0");
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const daysIn = (k) => { const [y, m] = k.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const dateOf = (k, day) => `${k}-${pad(Math.min(Math.max(1, parseInt(day, 10) || 1), daysIn(k)))}`;
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export function isCardItem(it) { return !!it && it.paymentMethod === CARD_METHOD; }
const cardItems = () => getItems("charlie", "expenses").filter(isCardItem);

export function cardSettings() {
  const d = getAppData();
  const c = (d && d.card) || {};
  let cutoffDay = parseInt(c.cutoffDay, 10);
  if (!(cutoffDay >= 1 && cutoffDay <= 31)) {
    const fromItem = cardItems().map((it) => parseInt(it.cutoffDay, 10)).find((x) => x >= 1 && x <= 31);
    cutoffDay = fromItem || 14;
  }
  let dueDay = parseInt(c.dueDay, 10);
  if (!(dueDay >= 1 && dueDay <= 31)) dueDay = 29;
  return { cutoffDay, dueDay };
}

export function saveCardSettings({ cutoffDay, dueDay }) {
  const d = getAppData();
  d.card = { cutoffDay: parseInt(cutoffDay, 10) || 14, dueDay: parseInt(dueDay, 10) || 29 };
}

/** The due date for a statement cut on `cutoff`: the first `dueDay` that comes after it (short months use their last day). */
export function dueFor(cutoff, dueDay) {
  const k = cutoff.slice(0, 7);
  const same = dateOf(k, dueDay);
  return same > cutoff ? same : dateOf(addMonths(k, 1), dueDay);
}

function manual(key) { return (getAppData()?.cardStatements || []).find((s) => s && s.key === key) || null; }

export function stmtDates(key) {
  const m = manual(key);
  const { cutoffDay, dueDay } = cardSettings();
  const cutoff = (m && m.cutoff) || dateOf(key, cutoffDay);
  const due = (m && m.due) || dueFor(cutoff, dueDay);
  return { cutoff, due };
}

/** Charges that fall inside statement `key`: purchase date after the previous cutoff, up to this cutoff. */
export function charges(key) {
  const prev = stmtDates(addMonths(key, -1)).cutoff;
  const { cutoff } = stmtDates(key);
  const items = cardItems();
  const out = [];
  if (!items.length) return out;
  // One-time purchases with a purchase date are charged on exactly that day, whatever month they are filed under
  for (const it of items) {
    if (it.recurring || !it.txDate || !itemActiveIn(it, it.start)) continue;
    const date = it.txDate;
    if (date <= prev || date > cutoff) continue;
    const r = itemAmts(it, it.start);
    if (!(r.total > 0)) continue;
    out.push({ id: it.id, item: it, month: date.slice(0, 7), date, amt: r.total, posted: r.paid >= r.total - 0.005 });
  }
  for (let m = prev.slice(0, 7); cmpKey(m, cutoff.slice(0, 7)) <= 0; m = addMonths(m, 1)) {
    for (const it of items) {
      if (!it.recurring && it.txDate) continue; // handled above
      if (!itemActiveIn(it, m)) continue;
      const date = dateOf(m, it.txDay);
      if (date <= prev || date > cutoff) continue;
      const r = itemAmts(it, m);
      if (!(r.total > 0)) continue;
      out.push({ id: it.id, item: it, month: m, date, amt: r.total, posted: r.paid >= r.total - 0.005 });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function paymentsFor(key) { return (getAppData()?.cardPayments || []).filter((p) => p && p.key === key); }

/** Everything about one statement. */
export function statement(key) {
  const { cutoff, due } = stmtDates(key);
  const ch = charges(key);
  const charged = r2(ch.reduce((s, c) => s + c.amt, 0));
  const m = manual(key);
  const stAmt = m && m.amount != null && m.amount !== "" && !isNaN(Number(m.amount)) ? Number(m.amount) : null;
  const total = stAmt != null ? stAmt : charged;
  const payments = paymentsFor(key);
  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const remaining = Math.max(0, r2(total - paid));
  const today = todayStr();
  let status = "open";
  if (total > 0.005 && remaining <= 0.005) status = "paid";
  else if (paid > 0.005) status = "partial";
  if (status !== "paid" && due < today && total > 0.005) status = "overdue";
  return {
    key, cutoff, due, dueKey: due.slice(0, 7), charges: ch, charged, statementAmount: stAmt, total, paid, remaining,
    payments, status, isManual: !!m, note: (m && m.note) || "",
    diff: stAmt != null ? r2(stAmt - charged) : 0,
  };
}

/** The card bill that falls due in month k (counted in that month's totals). */
export function cardDueIn(k) {
  let total = 0, paid = 0;
  for (const s of [addMonths(k, -2), addMonths(k, -1), k]) {
    const st = statement(s);
    if (st.dueKey !== k) continue;
    total += st.total;
    paid += Math.min(st.paid, st.total);
  }
  return { total: r2(total), paid: r2(paid) };
}

/** What is owed on the card right now (billed statements plus charges made so far). */
export function cardOwedNow() {
  const tl = timeline();
  const out = { total: 0, byMonth: {}, any: cardItems().length > 0 || (getAppData()?.cardPayments || []).length > 0 };
  if (!tl.length) return out;
  const today = todayStr();
  const last = addMonths(currentKey(), 1);
  for (let s = addMonths(tl[0], -1); cmpKey(s, last) <= 0; s = addMonths(s, 1)) {
    const st = statement(s);
    const counted = st.cutoff <= today
      ? st.total
      : st.charges.filter((c) => c.date <= today || c.posted).reduce((x, c) => x + c.amt, 0);
    const owed = Math.max(0, r2(counted - st.paid));
    if (owed > 0.005) {
      out.total += owed;
      out.byMonth[st.dueKey] = (out.byMonth[st.dueKey] || 0) + owed;
    }
  }
  out.total = r2(out.total);
  return out;
}

/** Statement keys worth showing for month k, oldest first. */
export function keysForMonth(k) {
  const keys = [];
  for (let s = addMonths(k, -2); cmpKey(s, addMonths(k, 1)) <= 0; s = addMonths(s, 1)) {
    const st = statement(s);
    const has = st.charges.length || st.payments.length || st.isManual;
    if (!has) continue;
    // only the statement that is due in this month (charges stay visible inside their statement)
    if (st.dueKey === k) keys.push(s);
  }
  return keys;
}

// ---------- changes ----------
/** Pay (part of) a statement from an account. Returns the payment, or null. */
export function payCard(key, amount, acctId) {
  const d = getAppData();
  const acct = (d.accounts || []).find((a) => a.id === acctId);
  amount = r2(amount);
  if (!acct || !(amount > 0)) return null;
  acct.amount = r2((Number(acct.amount) || 0) - amount);
  d.cardPayments = d.cardPayments || [];
  const p = { id: generateId(), key, amount, acctId, date: todayStr() };
  d.cardPayments.push(p);
  return p;
}

/** Undo a payment and give the money back to its account. */
export function removeCardPayment(id) {
  const d = getAppData();
  const list = d.cardPayments || [];
  const i = list.findIndex((p) => p && p.id === id);
  if (i < 0) return null;
  const [p] = list.splice(i, 1);
  const acct = (d.accounts || []).find((a) => a.id === p.acctId);
  if (acct) acct.amount = r2((Number(acct.amount) || 0) + p.amount);
  return { payment: p, acctName: acct ? acct.name : null };
}

/** Save the real dates / amount of a statement. `oldKey` is the statement being edited. */
export function saveStatement(oldKey, { cutoff, due, amount, note }) {
  const d = getAppData();
  const key = cutoff.slice(0, 7);
  d.cardStatements = (d.cardStatements || []).filter((s) => s && s.key !== oldKey && s.key !== key);
  const rec = { key, cutoff, due };
  if (amount != null && amount !== "" && !isNaN(Number(amount))) rec.amount = Number(amount);
  if (note) rec.note = note;
  d.cardStatements.push(rec);
  if (key !== oldKey) for (const p of d.cardPayments || []) if (p && p.key === oldKey) p.key = key;
  return key;
}

/** Forget a statement's manual dates / amount (back to the automatic dates). */
export function clearStatement(key) {
  const d = getAppData();
  d.cardStatements = (d.cardStatements || []).filter((s) => s && s.key !== key);
}
