// =============================
// "Paid from which account?" - choose an account when an expense is checked off,
// deduct it from that account, and give it back when the check is removed.
// Payments are remembered in appData.paidFrom[monthKey][itemId] = { a: accountId, amt }.
// =============================
import { acctType, childFinal, getAppData, isPaid, itemFinal } from "./state.js";
import { isCardItem } from "./card.js";
import { BANK_DOMAINS, bankIconFor, escapeHtml, peso } from "./utils.js";

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
  return Number(amt) || 0;
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
  if (!acct || !amt) return false;
  acct.amount = Math.round(((Number(acct.amount) || 0) - amt + Number.EPSILON) * 100) / 100;
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
  acct.amount = Math.round(((Number(acct.amount) || 0) + rec.amt + Number.EPSILON) * 100) / 100;
  return { acctId: acct.id, acctName: acct.name, amt: rec.amt };
}

/**
 * Ask where the money for these expenses came from.
 * Resolves to null if the user cancels, otherwise { acctId (or null = don't deduct), items: [{ id, amt }] }.
 * Nothing is asked when there is nothing to pay or no account to take it from.
 */
export async function choosePayment(k, ids, label) {
  const items = ids
    .filter((id) => !isPaid(id, k))
    .map((id) => ({ id, amt: amountDue(id, k) }))
    .filter((x) => x.amt != null && x.amt > 0);
  if (!items.length || !payableAccounts().length) return { acctId: null, items: [] };
  const income = isIncomeId(items[0].id);
  const total = items.reduce((s, x) => s + x.amt, 0);
  const choice = await pickAccount(label, total, income);
  if (choice === null) return null;
  return { acctId: choice, items, income };
}

/** Apply a plan from choosePayment. */
export function applyPayment(k, plan) {
  if (!plan || !plan.acctId) return [];
  const done = [];
  for (const x of plan.items) {
    const amt = plan.income ? -x.amt : x.amt; // income is stored negative so a refund takes it back out
    if (recordPayment(k, x.id, plan.acctId, amt)) done.push({ id: x.id, amt });
  }
  return done;
}

export function accountName(acctId) {
  return (getAppData()?.accounts || []).find((a) => a.id === acctId)?.name || "account";
}

// ---------- the chooser ----------
let open = false;

function pickAccount(label, total, income) {
  if (open) return Promise.resolve(null);
  open = true;
  const accts = payableAccounts();
  let last = null;
  try { last = localStorage.getItem(LAST_KEY); } catch { /* ignore */ }
  const pre = accts.find((a) => a.id === last) || accts[0];

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
