// =============================
// "Paid from which account?" - choose an account when an expense is checked off,
// deduct it from that account, and give it back when the check is removed.
// Payments are remembered in appData.paidFrom[monthKey][itemId] = { a: accountId, amt }.
// Expenses paid by Maribank / GCash / BPI Debit skip the chooser: the matching account
// is charged straight away (autoAccountFor) and reversed from the same record.
// =============================
import { acctType, childFinal, getAppData, getSpendList, isPaid, itemFinal } from "./state.js";
import { isCardItem } from "./card.js";
import { ACCOUNT_PAYMENT_METHODS, BANK_DOMAINS, bankIconFor, escapeHtml, peso } from "./utils.js";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const LAST_KEY = "moneyku_pay_acct";

/** Accounts that hold real money (credit cards are not paid from here). */
export function payableAccounts() {
  return (getAppData()?.accounts || []).filter((a) => acctType(a) !== "credit");
}

/** Find an expense leaf (an item without sub-items, or a sub-item) by id. */
function findExpenseLeaf(id) {
  const d = getAppData();
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["expenses", "income"]) {
      for (const it of d?.items?.[who]?.[kind] || []) {
        if (it.id === id) return { item: it, child: null, income: kind === "income" };
        for (const c of Array.isArray(it.children) ? it.children : []) {
          if (c && c.id === id) return { item: it, child: c, income: kind === "income" };
        }
      }
    }
  }
  return null;
}

/** What this expense costs (or income pays) for month k, or null if the id is not an expense. */
export function amountDue(id, k) {
  const f = findExpenseLeaf(id);
  if (!f) return null;
  // Card purchases are paid when the card bill is paid, not from an account here
  if (!f.income && isCardItem(f.item)) return null;
  const amt = f.child ? childFinal(f.child, k) : itemFinal(f.item, k);
  // Spending entries already taken from an account (ded) must not be taken again when the item is paid
  const already = f.income ? 0 : getSpendList(id, k).reduce((s, e) => s + (e && e.ded && e.acct ? Number(e.amount) || 0 : 0), 0);
  return Math.max(0, r2((Number(amt) || 0) - already));
}

/** The account a payment method points at (Maribank, GCash, BPI Debit Card), matched by name; null for cash/cards/no match. */
export function accountForMethod(pm) {
  const m = ACCOUNT_PAYMENT_METHODS.find((x) => x.id === pm);
  if (!m) return null;
  return payableAccounts().find((a) => m.account.test((a.name || "").trim())) || null;
}

function paymentMethodOf(id) {
  const f = findExpenseLeaf(id);
  return f && !f.income ? (f.item.paymentMethod || null) : null;
}

/**
 * The account an expense is charged to automatically when paid, or null (cash, credit card,
 * income, mixed/unknown, or no account whose name matches the method) which means "ask".
 */
export function autoAccountFor(id) {
  const f = findExpenseLeaf(id);
  if (!f || f.income) return null;
  return accountForMethod(f.item.paymentMethod);
}

export function isIncomeId(id) { return !!findExpenseLeaf(id)?.income; }

export function nameOf(id) {
  const f = findExpenseLeaf(id);
  return f ? (f.child || f.item).name : "";
}

/** Subtract an expense from an account (income: pass a negative amt to add it) and remember it. */
export function recordPayment(k, id, acctId, amt) {
  const d = getAppData();
  const acct = (d.accounts || []).find((a) => a.id === acctId);
  amt = r2(amt);
  if (!acct || !amt) return false;
  // A leftover record (e.g. paid flag cleared elsewhere) is given back first so the same bill is never taken twice
  if (d?.paidFrom?.[k]?.[id]) refundPayment(k, id);
  acct.amount = r2((Number(acct.amount) || 0) - amt);
  d.paidFrom = d.paidFrom || {};
  d.paidFrom[k] = d.paidFrom[k] || {};
  d.paidFrom[k][id] = { a: acctId, amt };
  return true;
}

/** Give a remembered payment back to its account. Returns { acctName, amt } or null. */
export function refundPayment(k, id) {
  const d = getAppData();
  const rec = d?.paidFrom?.[k]?.[id];
  if (!rec) return null;
  delete d.paidFrom[k][id];
  const acct = (d.accounts || []).find((a) => a.id === rec.a);
  if (!acct) return null; // the account was deleted since, nothing to give back
  acct.amount = r2((Number(acct.amount) || 0) + (Number(rec.amt) || 0));
  return { acctId: acct.id, acctName: acct.name, amt: Number(rec.amt) || 0 };
}

/**
 * Ask where the money for these expenses came from.
 * Resolves to null if the user cancels, otherwise { acctId (or null = don't deduct), items: [{ id, amt, acctId? }], income }.
 * Items paid by Maribank / GCash / BPI Debit that have a matching account carry their own acctId and are
 * never asked about; only the rest (cash, no matching account, income) go to the chooser.
 * Nothing is asked when there is nothing to pay or no account to take it from.
 */
export async function choosePayment(k, ids, label) {
  const all = ids
    .filter((id) => !isPaid(id, k))
    .map((id) => ({ id, amt: amountDue(id, k) }))
    .filter((x) => x.amt != null && x.amt > 0);
  const auto = [], manual = [];
  for (const x of all) {
    const acct = autoAccountFor(x.id);
    if (acct) auto.push({ ...x, acctId: acct.id }); else manual.push(x);
  }
  let acctId = null, income = false, picked = [];
  if (manual.length && payableAccounts().length) {
    income = isIncomeId(manual[0].id);
    const total = manual.reduce((s, x) => s + x.amt, 0);
    const methods = new Set(manual.map((x) => paymentMethodOf(x.id)));
    const preferred = methods.size === 1 ? accountForMethod([...methods][0]) : null;
    const choice = await pickAccount(auto.length ? `${label} (${manual.length} not on an account)` : label, total, income, preferred);
    if (choice === null) return null;
    acctId = choice;
    picked = manual;
  }
  return { acctId, items: [...auto, ...picked], income, autoCount: auto.length };
}

/** Apply a plan from choosePayment. Returns [{ id, amt, acctId, auto }] for what was really moved. */
export function applyPayment(k, plan) {
  if (!plan) return [];
  const done = [];
  for (const x of plan.items) {
    const acctId = x.acctId || plan.acctId;
    if (!acctId) continue;
    const amt = plan.income && !x.acctId ? -x.amt : x.amt; // income is stored negative so a refund takes it back out
    if (recordPayment(k, x.id, acctId, amt)) done.push({ id: x.id, amt, acctId, auto: !!x.acctId });
  }
  return done;
}

/** Charge one expense to its method's account without asking (used where there is no chooser). Returns the move or null. */
export function autoDeduct(k, id) {
  const acct = autoAccountFor(id);
  const amt = amountDue(id, k);
  if (!acct || !(amt > 0) || isPaid(id, k)) return null;
  return recordPayment(k, id, acct.id, amt) ? { id, amt, acctId: acct.id, auto: true } : null;
}

/** "PHP 320.00" - the format used by the automatic-deduction toast. */
export function phpMoney(n) {
  return `PHP ${(Math.round((Number(n) + Number.EPSILON) * 100) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Toast text for a finished plan (what actually moved). */
export function paidMessage(plan, done) {
  if (!done.length) return "";
  const byAcct = new Map();
  for (const x of done) byAcct.set(x.acctId, (byAcct.get(x.acctId) || 0) + x.amt);
  const total = done.reduce((s, x) => s + x.amt, 0);
  if (done.some((x) => x.auto)) {
    if (byAcct.size === 1) return `Deducted ${phpMoney(total)} from ${accountName([...byAcct.keys()][0])}`;
    return `Deducted ${phpMoney(total)} (${[...byAcct].map(([id, amt]) => `${phpMoney(amt)} from ${accountName(id)}`).join(", ")})`;
  }
  return plan.income
    ? `Received into ${accountName(plan.acctId)} (+${peso(-total)})`
    : `Paid from ${accountName(plan.acctId)} (-${peso(total)})`;
}

export function accountName(acctId) {
  return (getAppData()?.accounts || []).find((a) => a.id === acctId)?.name || "account";
}

// ---------- the chooser ----------
let open = false;

function pickAccount(label, total, income, preferred = null) {
  if (open) return Promise.resolve(null);
  open = true;
  const accts = payableAccounts();
  let last = null;
  try { last = localStorage.getItem(LAST_KEY); } catch { /* ignore */ }
  const pre = preferred || accts.find((a) => a.id === last) || accts[0];

  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.id = "payfrom-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Paid from which account?");
    el.className = "fixed inset-0 z-[75] bg-black/70 flex items-end sm:items-center justify-center p-4";
    const row = (a) => {
      const bank = bankIconFor(a.name);
      const icon = bank
        ? `<img src="https://www.google.com/s2/favicons?domain=${BANK_DOMAINS[bank] || ""}&sz=128" alt="" class="w-full h-full object-cover bg-white" />`
        : `<span class="text-sm font-black text-white">${escapeHtml((a.name || "?").trim().charAt(0).toUpperCase() || "?")}</span>`;
      const after = (Number(a.amount) || 0) + (income ? total : -total);
      return `<button type="button" data-acct="${escapeHtml(a.id)}" class="w-full flex items-center gap-3 p-3 rounded-xl border ${a === pre ? "border-indigo-400 bg-indigo-500/15" : "border-slate-700 bg-slate-900/60"} text-left">
        <span class="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600">${icon}</span>
        <span class="flex-1 min-w-0"><span class="block text-sm font-bold text-white truncate">${escapeHtml(a.name)}</span>
          <span class="block text-[11px] font-bold text-slate-400">${peso(a.amount)} <span class="text-slate-500">&rarr;</span> <span class="${after < 0 ? "text-rose-400" : "text-slate-200"}">${peso(after)}</span></span></span>
      </button>`;
    };
    el.innerHTML = `<div class="bg-slate-800 w-full max-w-sm rounded-2xl p-5 border border-white/5 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
      <div>
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">${income ? "Received into which account?" : "Paid from which account?"}</p>
        <p class="text-base font-black text-white mt-1 truncate">${escapeHtml(label)}</p>
        <p class="text-sm font-black ${income ? "text-emerald-400" : "text-rose-400"}">${income ? "+" : ""}${peso(total)}</p>
      </div>
      <div class="space-y-2">${accts.map(row).join("")}</div>
      <button type="button" data-skip class="w-full py-3 text-xs font-bold text-slate-300 bg-slate-700/50 rounded-xl">${income ? "Mark received without adding" : "Mark paid without deducting"}</button>
      <button type="button" data-cancel class="w-full py-2 text-xs font-bold text-slate-500">Cancel</button>
    </div>`;

    const finish = (value) => {
      document.removeEventListener("keydown", onKey, true);
      el.remove();
      open = false;
      resolve(value);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); finish(null); } };
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-cancel]")) return finish(null);
      if (e.target.closest("[data-skip]")) return finish("");
      const b = e.target.closest("[data-acct]");
      if (b) {
        try { localStorage.setItem(LAST_KEY, b.dataset.acct); } catch { /* ignore */ }
        finish(b.dataset.acct);
      }
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(el);
    el.querySelector("[data-acct]")?.focus();
  });
}
