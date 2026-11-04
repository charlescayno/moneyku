// =============================
// Insights: due soon, category budgets, month-over-month
// =============================
import { $, addMonths, currentKey, dueDayFor, escapeHtml, keyParts, monthShort, parseMathAmount, peso } from "./utils.js";
import { getActiveEdit, getAppData, getItems, getKids, getSelectedKey, isPaid, itemActiveIn, itemTotal, monthTotals, setActiveEdit, timeline } from "./state.js";
import { syncSet } from "./firebase.js";
import { SPEND_CATS, catInfo, categoryOf } from "./categories.js";
import { closeModal, openModalShell } from "./ui/modals.js";
import { toast } from "./ui/core.js";
import { renderAll } from "./ui/layout.js";

// ---------- shared ----------
export function categoryTotals(k) {
  const out = {};
  for (const it of getItems("charlie", "expenses")) {
    if (!itemActiveIn(it, k)) continue;
    const c = categoryOf(it);
    out[c] = (out[c] || 0) + itemTotal(it, k);
  }
  return out;
}

const cardShell = (key, border, icon, grad, title, sub, right, body) => `<details open data-persist="${key}" class="glass-card rounded-xl overflow-hidden border ${border} w-full flex-shrink-0">
  <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0"><span class="material-icons text-white" style="font-size:14px">${icon}</span></div>
      <div><h3 class="text-xs font-black text-white uppercase tracking-wide">${title}</h3><p class="text-[8px] text-slate-400">${sub}</p></div>
    </div>
    ${right || ""}
  </summary>
  <div class="px-2.5 pb-2.5 space-y-1.5">${body}</div>
</details>`;

// ---------- 5. Due soon / overdue ----------
export function dueSoonCardHtml() {
  const k = getSelectedKey();
  if (k !== currentKey()) return "";
  const now = new Date();
  const today = now.getDate();
  const { y, m } = keyParts(k);
  const dim = new Date(y, m + 1, 0).getDate();
  const nextK = addMonths(k, 1);
  const rows = [];
  const unpaid = (it, key) => { const kids = getKids(it); return kids.length ? !kids.every((c) => isPaid(c.id, key)) : !isPaid(it.id, key); };
  for (const who of ["charlie", "debt"]) {
    for (const it of getItems(who, "expenses")) {
      const dd = dueDayFor(it);
      if (dd == null) continue;
      if (itemActiveIn(it, k) && unpaid(it, k)) {
        const diff = Math.min(dd, dim) - today;
        if (diff <= 7) rows.push({ who, it, diff, amt: itemTotal(it, k) });
      }
      if (itemActiveIn(it, nextK) && unpaid(it, nextK)) {
        const diff = dim - today + dd;
        if (diff <= 7 && diff > 0) rows.push({ who, it, diff, amt: itemTotal(it, nextK), next: true });
      }
    }
  }
  if (!rows.length) return "";
  rows.sort((a, b) => a.diff - b.diff);
  const total = rows.reduce((s, r) => s + r.amt, 0);
  const overdue = rows.filter((r) => r.diff < 0).length;
  const label = (r) => r.diff < 0 ? `${-r.diff}d overdue` : r.diff === 0 ? "Today" : r.diff === 1 ? "Tomorrow" : `in ${r.diff}d`;
  const chip = (r) => r.diff < 0 ? "bg-rose-500/20 text-rose-300" : r.diff <= 1 ? "bg-amber-500/20 text-amber-300" : "bg-slate-700/60 text-slate-300";
  const body = rows.slice(0, 6).map((r) => `<div data-action="openItemModal" data-arg0="${r.who}" data-arg1="expenses" data-arg2="${r.it.id}" class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/40 cursor-pointer">
      <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${chip(r)} flex-shrink-0">${label(r)}</span>
      <p class="text-xs font-bold text-slate-100 truncate flex-1">${escapeHtml(r.it.name)}</p>
      <p class="text-xs font-black text-white flex-shrink-0">${peso(r.amt)}</p></div>`).join("") + (rows.length > 6 ? `<p class="text-[10px] text-slate-500 text-center">+${rows.length - 6} more</p>` : "");
  return cardShell("due", overdue ? "border-rose-500/30" : "border-amber-500/25", "notifications_active", overdue ? "from-rose-500 to-red-600" : "from-amber-500 to-orange-600",
    "Due soon", `${rows.length} unpaid in the next 7 days${overdue ? ` · ${overdue} overdue` : ""}`, `<p class="text-sm font-black text-white">${peso(total)}</p>`, body);
}

// ---------- 9. Category budgets ----------
export function budgetsCardHtml() {
  const d = getAppData();
  const limits = d?.settings?.budgets || {};
  const k = getSelectedKey();
  const spent = categoryTotals(k);
  const set = SPEND_CATS.filter((c) => limits[c.id] > 0);
  const editBtn = `<button type="button" data-action="openBudgetModal" class="w-full py-2 text-[11px] font-bold text-indigo-300 flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">tune</span>${set.length ? "Edit budgets" : "Set category budgets"}</button>`;
  const rows = set.map((c) => {
    const lim = limits[c.id], sp = spent[c.id] || 0, pct = Math.min(100, Math.round((sp / lim) * 100));
    const over = sp > lim, warn = !over && sp >= lim * 0.8;
    const bar = over ? "bg-rose-500" : warn ? "bg-amber-400" : "bg-emerald-400";
    const txt = over ? `<span class="text-rose-400">over ${peso(sp - lim)}</span>` : `<span class="${warn ? "text-amber-300" : "text-emerald-400"}">${peso(lim - sp)} left</span>`;
    return `<div class="px-2.5 py-1.5 rounded-lg bg-slate-900/40">
      <div class="flex items-center justify-between gap-2"><p class="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5"><span class="material-icons" style="font-size:14px;color:${c.color}">${c.icon}</span>${c.label}</p><p class="text-[10px] font-bold text-slate-400 flex-shrink-0">${peso(sp)} / ${peso(lim)}</p></div>
      <div class="flex items-center gap-2 mt-1"><div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div class="h-full ${bar} rounded-full" style="width:${pct}%"></div></div><span class="text-[10px] font-bold flex-shrink-0">${txt}</span></div></div>`;
  }).join("");
  return cardShell("budgets", "border-emerald-500/15", "savings", "from-emerald-500 to-teal-600", "Budgets",
    set.length ? `${set.length} categor${set.length === 1 ? "y" : "ies"} · ${monthShort(k)}` : "Spending limits per category", "", rows + editBtn);
}

export function openBudgetModal() {
  const d = getAppData();
  const limits = d?.settings?.budgets || {};
  const spent = categoryTotals(getSelectedKey());
  setActiveEdit({ kind: "budgets" });
  $("modal-title").textContent = "Category Budgets";
  $("modal-title").className = "text-lg font-black uppercase tracking-tight text-emerald-400";
  $("modal-body").innerHTML = `<p class="text-[11px] text-slate-400">Monthly limit per category. Leave empty for no limit. Categories are guessed from item names; change one in an item's More options.</p>` +
    SPEND_CATS.map((c) => `<div class="flex items-center gap-3">
      <span class="material-icons" style="font-size:18px;color:${c.color}">${c.icon}</span>
      <div class="flex-1 min-w-0"><p class="text-xs font-bold text-white truncate">${c.label}</p><p class="text-[10px] text-slate-500">this month: ${peso(spent[c.id] || 0)}</p></div>
      <input type="text" inputmode="decimal" id="f-bud-${c.id}" value="${limits[c.id] || ""}" placeholder="No limit" style="width:7rem !important" class="bg-slate-900 rounded-xl text-sm font-bold text-white text-right focus:outline-none" />
    </div>`).join("");
  $("delete-btn").classList.add("hidden");
  openModalShell();
}

export async function saveBudgets() {
  if (getActiveEdit()?.kind !== "budgets") return;
  const d = getAppData();
  const limits = {};
  for (const c of SPEND_CATS) {
    const v = parseMathAmount($(`f-bud-${c.id}`)?.value);
    if (v > 0) limits[c.id] = v;
  }
  d.settings = d.settings || {};
  d.settings.budgets = limits;
  await syncSet(d);
  closeModal(); renderAll(); toast("Budgets saved");
}

// ---------- 8. Month over month ----------
export function compareCardHtml() {
  const k = getSelectedKey();
  const prevK = addMonths(k, -1);
  if (!timeline().includes(prevK)) return "";
  const t = monthTotals(k), p = monthTotals(prevK);
  if (!(p.cI + p.cE > 0)) return "";
  const pctTxt = (cur, prev) => (prev > 0 ? ` (${cur >= prev ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)}%)` : "");
  // goodWhenUp: income/net up is good, expenses up is bad
  const line = (label, cur, prev, goodWhenUp) => {
    const diff = cur - prev;
    const flat = Math.abs(diff) < 0.5;
    const good = goodWhenUp ? diff > 0 : diff < 0;
    const cls = flat ? "text-slate-400" : good ? "text-emerald-400" : "text-rose-400";
    return `<div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/40">
      <p class="text-xs font-bold text-slate-200">${label}</p>
      <p class="text-xs font-black ${cls}">${flat ? "no change" : `${diff > 0 ? "+" : "-"}${peso(Math.abs(diff))}${pctTxt(cur, prev)}`}</p></div>`;
  };
  const cur = categoryTotals(k), prev = categoryTotals(prevK);
  const movers = SPEND_CATS.map((c) => ({ c, d: (cur[c.id] || 0) - (prev[c.id] || 0), prev: prev[c.id] || 0, cur: cur[c.id] || 0 }))
    .filter((x) => Math.abs(x.d) >= 1).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  const moverRows = movers.map((x) => `<div class="flex items-center justify-between px-2.5 py-1 text-[11px]">
      <span class="text-slate-300 flex items-center gap-1.5"><span class="material-icons" style="font-size:13px;color:${x.c.color}">${x.c.icon}</span>${x.c.label}</span>
      <span class="font-bold ${x.d > 0 ? "text-rose-400" : "text-emerald-400"}">${x.d > 0 ? "+" : "-"}${peso(Math.abs(x.d))}${pctTxt(x.cur, x.prev)}</span></div>`).join("");
  const net = t.cI - t.cE, pnet = p.cI - p.cE;
  return cardShell("compare", "border-sky-500/15", "compare_arrows", "from-sky-500 to-blue-600", "vs last month", `${monthShort(k)} compared to ${monthShort(prevK)}`, "",
    line("Income", t.cI, p.cI, true) + line("Expenses", t.cE, p.cE, false) + line("Net", net, pnet, true) +
    (moverRows ? `<p class="text-[9px] font-black uppercase tracking-wider text-slate-500 px-1 pt-1">Biggest changes</p>${moverRows}` : ""));
}
