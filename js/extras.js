// =============================
// Extras: search, add chooser, duplicate, copy last month, settings (text size, CSV),
// offline badge, double-tap guard, first-run tip
// =============================
import { $, addMonths, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, monthShort, peso, PM_LABELS } from "./utils.js";
import { exportData } from "./ui/actions.js";
import { getAppData, getExpenseSort, getSimPersonSort, getItems, getKids, getSelectedKey, isPaid, itemActiveIn, itemAmts, itemTotal, childAmt, childFinal, monthTotals, outlookRows, runningFundsAt, getSimView, setAppData, timeline, includedWho } from "./state.js";
import { normalize, syncSet } from "./firebase.js";
import { addItemData } from "./itemOps.js";
import { CARD_METHOD, charges, statement } from "./card.js";
import { catInfo, categoryOf } from "./categories.js";
import { toast } from "./ui/core.js";
import { renderAll } from "./ui/layout.js";
import { canUndo, undoLabel } from "./history.js";
import { closeModal, openChildModal, openItemModal } from "./ui/modals.js";
import { qlClose, showSheet } from "./ui/quicklog.js";

const CLOSE_BTN = `<button type="button" data-action="qlClose" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Close</button>`;
const lsGet = (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function hapticTick(ms = 12) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ } }

async function applyWithUndo(mutate, message) {
  const d = getAppData();
  const snapshot = JSON.parse(JSON.stringify(d));
  mutate(d);
  await syncSet(d);
  renderAll();
  toast(message, "ok", {
    actionLabel: "Undo", duration: 6000,
    onAction: async () => { setAppData(snapshot); await syncSet(snapshot); renderAll(); toast("Undone"); },
  });
}

// ---------- 2. Search ----------
export function openSearch() {
  showSheet("Search",
    `<input id="sr-input" type="search" autocomplete="off" placeholder="Search income, expenses, sub-expenses…" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none" />
     <div id="sr-results" class="space-y-1.5 mt-2"></div>`, CLOSE_BTN);
  const input = $("sr-input");
  const run = () => { $("sr-results").innerHTML = searchResultsHtml(input.value); };
  input.addEventListener("input", run);
  run();
  setTimeout(() => input.focus(), 60);
}

function searchResultsHtml(q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return `<p class="text-center text-[11px] text-slate-500 py-3">Type a name to find it.</p>`;
  const k = getSelectedKey();
  const out = [];
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      for (const it of getItems(who, kind)) {
        if ((it.name || "").toLowerCase().includes(needle)) out.push({ who, kind, it, active: itemActiveIn(it, k), amt: itemTotal(it, k) });
        for (const c of getKids(it)) {
          if ((c.name || "").toLowerCase().includes(needle)) out.push({ who, kind, it: c, parent: it, active: itemActiveIn(it, k), amt: Number(c.amount) || 0 });
        }
      }
    }
  }
  if (!out.length) return `<p class="text-center text-[11px] text-slate-500 py-3">No matches.</p>`;
  return out.slice(0, 30).map((r) => `<div data-action="srOpen" data-arg0="${r.who}" data-arg1="${r.kind}" data-arg2="${r.it.id}" data-arg3="${r.parent ? r.parent.id : ""}" class="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900/50 cursor-pointer">
      <span class="material-icons ${r.kind === "income" ? "text-emerald-400" : "text-rose-400"}" style="font-size:16px">${r.kind === "income" ? "south_west" : "north_east"}</span>
      <div class="min-w-0 flex-1"><p class="text-xs font-bold text-slate-100 truncate">${escapeHtml(r.it.name)}</p>
      <p class="text-[10px] text-slate-500 truncate">${r.parent ? `in ${escapeHtml(r.parent.name)} · ` : ""}${r.active ? monthShort(k) : "not in this month"}${r.who === "debt" ? " · debt" : ""}</p></div>
      <p class="text-xs font-black text-white flex-shrink-0">${peso(r.amt)}</p></div>`).join("");
}

export function srOpen(who, kind, id, parentId) {
  qlClose();
  setTimeout(() => (parentId ? openChildModal(who, parentId, id) : openItemModal(who, kind, id)), 120);
}

// ---------- 4. Add chooser ----------
export function qlAddChooser() {
  const b = (cls, kind, label) => `<button type="button" data-action="addNew" data-arg0="${kind}" class="flex-1 py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-1 ${cls}"><span class="material-icons" style="font-size:16px">add</span>${label}</button>`;
  showSheet("Add", "",
    b("text-emerald-300 bg-emerald-500/15 border border-emerald-500/25", "income", "Income") +
    b("text-rose-300 bg-rose-500/15 border border-rose-500/25", "expenses", "Expense"));
}

/** Pie (donut) chart of one person's expenses for the month being viewed. `mode` picks what the slices are; `drill` is a slice number to open. */
const PIE_MODES = [["item", "Item"], ["cat", "Category"], ["type", "Type"], ["pay", "Pay via"], ["paid", "Status"]];
const MAX_SLICES = 7;
const OTHER_GREY = "#64748b";
/** Money-out reds: the biggest slice is the darkest, then lighter and lighter. */
const rampColor = (i, n) => { const t = n <= 1 ? 0 : i / (n - 1); return `hsl(347 ${Math.round(78 - t * 22)}% ${Math.round(40 + t * 42)}%)`; };
const r2c = (n) => Math.round(n * 100) / 100;

/** Every expense of `who` active in month k as { it, v, paid } (excluded items count as 0 and drop out). */
function chartItems(who, k) {
  return getItems(who, "expenses").filter((it) => itemActiveIn(it, k)).map((it) => { const a = itemAmts(it, k); return { it, v: a.total, paid: a.paid }; }).filter((r) => r.v > 0.005);
}
function monthSpend(who, k) { return chartItems(who, k).reduce((s, r) => s + r.v, 0); }
function monthIncome(who, k) { return getItems(who, "income").filter((it) => itemActiveIn(it, k)).reduce((s, it) => s + itemAmts(it, k).total, 0); }

/** Collapse the month's expenses into slices { name, v, paid, color?, members } for the chosen view. */
function chartRows(who, mode, k) {
  const items = chartItems(who, k);
  const m = new Map();
  const add = (key, name, color, r, members) => {
    const g = m.get(key) || { name, v: 0, paid: 0, color, members: [] };
    g.v += r.v; g.paid += r.paid; g.members.push(...members); m.set(key, g);
  };
  const self = (r) => ({ name: r.it.name, v: r.v, paid: r.paid });
  for (const r of items) {
    if (mode === "cat") { const c = catInfo(categoryOf(r.it)); add(c.id || c.label, c.label, null, r, [self(r)]); }
    else if (mode === "type") { const t = !r.it.recurring ? "One-time" : r.it.end ? "Installment" : "Recurring"; add(t, t, null, r, [self(r)]); }
    else if (mode === "pay") {
      const key = r.it.paymentMethod && r.it.paymentMethod !== "cash" && r.it.paymentMethod !== "none" ? r.it.paymentMethod : "cash";
      add(key, key === "cash" ? "Cash / other" : PM_LABELS[key] || (String(key).startsWith("cc_") ? "Credit card" : key), null, r, [self(r)]);
    } else if (mode === "paid") {
      const paidPart = r.paid, openPart = r.v - r.paid;
      if (paidPart > 0.005) add("paid", "Paid", "#10b981", { v: paidPart, paid: paidPart }, [{ name: r.it.name, v: paidPart, paid: paidPart }]);
      if (openPart > 0.005) add("unpaid", "Still to pay", "#f43f5e", { v: openPart, paid: 0 }, [{ name: r.it.name, v: openPart, paid: 0 }]);
    } else {
      const kids = getKids(r.it, k);
      const members = kids.length > 1 ? kids.map((c) => { const ok = isPaid(c.id, k); const v = ok ? childFinal(c, k) : childAmt(c, k); return { name: c.name, v, paid: ok ? v : 0 }; }).filter((x) => x.v > 0.005) : [];
      add(r.it.id, r.it.name, null, r, members);
    }
  }
  return [...m.values()].sort((a, b) => b.v - a.v);
}

/** Largest slices first, the small tail folded into a grey "Other" that can be opened. */
function foldSlices(rows) {
  if (rows.length <= MAX_SLICES + 1) return rows;
  const tail = rows.slice(MAX_SLICES);
  return [...rows.slice(0, MAX_SLICES), { name: "Other", v: tail.reduce((s, r) => s + r.v, 0), paid: tail.reduce((s, r) => s + r.paid, 0), color: OTHER_GREY, members: tail.map((r) => ({ name: r.name, v: r.v, paid: r.paid })), other: true }];
}

export function openExpenseChart(who, mode = "item", drill = "") {
  const k = getSelectedKey();
  if (!PIE_MODES.some(([id]) => id === mode)) mode = "item";
  const tabs = `<div class="flex flex-wrap gap-1.5 mb-3">${PIE_MODES.map(([id, label]) => `<button type="button" data-action="openExpenseChart" data-arg0="${who}" data-arg1="${id}" aria-pressed="${id === mode}" class="text-[11px] font-bold px-2.5 rounded-full ${id === mode ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400"}" style="min-height:32px">${label}</button>`).join("")}</div>`;
  const top = foldSlices(chartRows(who, mode, k));
  const total = top.reduce((s, r) => s + r.v, 0);
  if (!total) { showSheet(`Expenses in ${monthShort(k)}`, `${tabs}<p class="text-center text-[11px] text-slate-500 py-3">No expenses this month.</p>`, CLOSE_BTN); return; }

  // Opening one slice shows what it is made of (a group's sub-items, a category's items, or the small ones in "Other")
  const idx = drill === "" || drill == null ? -1 : Number(drill);
  const parent = idx >= 0 && top[idx] && top[idx].members.length > 1 ? top[idx] : null;
  const slices = parent ? parent.members.map((x) => ({ ...x, members: [] })).sort((a, b) => b.v - a.v) : top;
  const shown = slices.reduce((s, r) => s + r.v, 0);
  const paidTotal = slices.reduce((s, r) => s + r.paid, 0);
  const named = slices.filter((s) => !s.color);
  const colorOf = (s) => (s.color ? s.color : rampColor(named.indexOf(s), named.length));
  const drillable = (s, i) => !parent && s.members.length > 1;
  const faded = mode !== "paid";

  const R = 80, C = 100, r2 = 48, TAU = Math.PI * 2;
  const pt = (a, r) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  const arc = (a0, a1, fill, op, attrs) => {
    if (a1 - a0 < 0.0005) return "";
    const o = op < 1 ? ` fill-opacity="${op}"` : "";
    if (a1 - a0 >= TAU * 0.9999) return `<circle cx="${C}" cy="${C}" r="${(R + r2) / 2}" fill="none" stroke="${fill}" stroke-width="${R - r2}"${op < 1 ? ` stroke-opacity="${op}"` : ""} ${attrs}/>`;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${pt(a0, R)} A${R} ${R} 0 ${big} 1 ${pt(a1, R)} L${pt(a1, r2)} A${r2} ${r2} 0 ${big} 0 ${pt(a0, r2)} Z" fill="${fill}"${o} stroke="#0f172a" stroke-width="1.5" ${attrs}/>`;
  };
  let ang = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const a0 = ang, a1 = ang + (s.v / shown) * TAU; ang = a1;
    const attrs = drillable(s, i) ? `data-action="openExpenseChart" data-arg0="${who}" data-arg1="${mode}" data-arg2="${i}" style="cursor:pointer"` : "";
    const col = colorOf(s);
    if (!faded || s.paid <= 0.005) return arc(a0, a1, col, faded ? 0.38 : 1, attrs);
    if (s.paid >= s.v - 0.005) return arc(a0, a1, col, 1, attrs);
    const mid = a0 + (s.paid / s.v) * (a1 - a0);
    return arc(a0, mid, col, 1, attrs) + arc(mid, a1, col, 0.38, attrs);
  }).join("");

  const legend = slices.map((s, i) => {
    const col = colorOf(s), pct = Math.round((s.v / shown) * 100), left = r2c(s.v - s.paid);
    const can = drillable(s, i);
    const attrs = can ? `data-action="openExpenseChart" data-arg0="${who}" data-arg1="${mode}" data-arg2="${i}" role="button"` : "";
    return `<div ${attrs} class="relative flex items-center gap-2 px-2 py-1.5 rounded-lg overflow-hidden ${can ? "cursor-pointer" : ""}" style="position:relative;overflow:hidden">
      <span class="rounded-lg" style="position:absolute;top:0;bottom:0;left:0;width:${Math.max(3, Math.round((s.v / slices[0].v) * 100))}%;background:${col};opacity:.16" aria-hidden="true"></span>
      <span class="relative flex-shrink-0 rounded-full" style="width:10px;height:10px;background:${col}"></span>
      <span class="relative flex-1 min-w-0"><span class="block truncate text-[12px] font-bold text-slate-100 keep-case">${escapeHtml(s.name)}</span>${faded && left > 0.5 && s.paid > 0.5 ? `<span class="block text-[10px] font-bold text-slate-400">${peso(left)} left</span>` : ""}</span>
      <span class="relative text-[11px] font-bold text-slate-300 flex-shrink-0">${pct}%</span>
      <span class="relative text-[12px] font-black text-white flex-shrink-0 tabular-nums" style="min-width:4.5rem;text-align:right">${peso(s.v)}</span>
      ${can ? `<span class="relative material-icons text-slate-400 flex-shrink-0" style="font-size:16px" aria-hidden="true">chevron_right</span>` : `<span class="relative flex-shrink-0" style="width:16px" aria-hidden="true"></span>`}
    </div>`;
  }).join("");

  const centerLabel = parent ? parent.name : "TOTAL";
  const svg = `<svg viewBox="0 0 200 200" class="block mx-auto" style="width:200px;height:200px" role="img" aria-label="Expenses pie chart">${paths}<text x="${C}" y="${C - 2}" text-anchor="middle" font-size="${parent ? 9 : 10}" font-weight="700" fill="#94a3b8">${escapeHtml(centerLabel.length > 16 ? centerLabel.slice(0, 15) + "…" : centerLabel.toUpperCase())}</text><text x="${C}" y="${C + 14}" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">${peso(shown)}</text></svg>`;

  // One line of context under the donut: share of income and change against last month
  const bits = [];
  if (!parent) {
    const inc = monthIncome(who, k);
    if (inc > 0.5) bits.push(`<b class="text-white">${Math.round((total / inc) * 100)}%</b> of income`);
    const prevK = addMonths(k, -1), prev = monthSpend(who, prevK);
    if (prev > 0.5 && Math.abs(total - prev) >= 0.5) {
      const up = total > prev;
      bits.push(`<span class="${up ? "text-rose-300" : "text-emerald-300"} font-bold">${up ? "&#9650;" : "&#9660;"} ${peso(Math.abs(total - prev))}</span> vs ${monthShort(prevK)}`);
    }
  }
  const summary = bits.length ? `<p class="text-center text-[11px] text-slate-400 mt-1">${bits.join(" &middot; ")}</p>` : "";
  const key = faded ? `<p class="text-center text-[10px] text-slate-400 mt-0.5">${paidTotal > 0.5 ? `${peso(paidTotal)} paid &middot; ${peso(shown - paidTotal)} left &middot; ` : ""}solid = paid, faded = still to pay</p>` : "";
  const back = parent ? `<button type="button" data-action="openExpenseChart" data-arg0="${who}" data-arg1="${mode}" class="flex items-center gap-1 text-[12px] font-bold text-indigo-300 mb-2" style="min-height:32px"><span class="material-icons" style="font-size:16px">arrow_back</span>Back to all</button>` : "";
  showSheet(parent ? `${parent.name} in ${monthShort(k)}` : `Expenses in ${monthShort(k)}`, `${parent ? back : tabs}${svg}${summary}${key}<div class="mt-2">${legend}</div>`, CLOSE_BTN);
}

/** Quick spend: pick the bill/budget this month, then log the amount in its spending section. */
export function qlSpendPick() {
  const k = getSelectedKey();
  const list = getItems("charlie", "expenses").filter((it) => itemActiveIn(it, k) && !(it.paymentMethod === CARD_METHOD));
  const rows = list.map((it) => `<button type="button" data-action="srOpen" data-arg0="charlie" data-arg1="expenses" data-arg2="${it.id}" data-arg3="" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-900/50 text-left"><span class="text-sm font-bold text-slate-100 truncate keep-case">${escapeHtml(it.name)}</span><span class="text-xs font-black text-slate-400 flex-shrink-0">${peso(itemTotal(it, k))}</span></button>`).join("");
  showSheet(`Spend in ${monthShort(k)}`, `<p class="text-[11px] text-slate-400 mb-1">Pick where the money goes, then add the amount under "Spending".</p>${rows || `<p class="text-center text-[11px] text-slate-500 py-3">No expenses this month.</p>`}`, CLOSE_BTN);
}export function addNew(kind) { const w = includedWho(); const who = getSimView() ? "simulated" : w.length === 1 ? w[0] : "charlie"; qlClose(); setTimeout(() => openItemModal(who, kind), 120); }

// ---------- 3. Duplicate / copy last month ----------
const cloneItem = (it, patch = {}) => {
  const c = JSON.parse(JSON.stringify(it));
  c.id = generateId();
  if (Array.isArray(c.children)) c.children = c.children.map((x) => ({ ...x, id: generateId() }));
  return Object.assign(c, patch);
};

export async function duplicateItem(who, kind, id) {
  const src = getItems(who, kind).find((x) => x.id === id);
  if (!src) return;
  closeModal();
  await applyWithUndo((d) => { d.items[who][kind].push(cloneItem(src, { name: `${src.name} (copy)` })); }, "Duplicated");
}

export function lastMonthOneTimes() {
  const k = getSelectedKey(), prev = addMonths(k, -1);
  const out = [];
  for (const kind of ["income", "expenses"]) {
    const list = getItems("charlie", kind);
    for (const it of list) {
      if (it.recurring || it.start !== prev) continue;
      const dup = list.some((x) => x.start === k && x.name === it.name && Number(x.amount) === Number(it.amount));
      if (!dup) out.push({ kind, it });
    }
  }
  return out;
}

// Pick which of last month's one-time items to copy into this month (all ticked to start)
export function openCopyPicker() {
  const todo = lastMonthOneTimes();
  if (!todo.length) return toast("Nothing to copy", "error");
  const rows = todo.map(({ kind, it }) => `<button type="button" data-action="copyToggle" data-arg0="${it.id}" data-copy="${it.id}" data-on="true" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900/50 text-left">
      <span class="material-icons text-emerald-300 copy-box" style="font-size:20px">check_circle</span>
      <span class="flex-1 min-w-0 text-sm font-bold text-slate-100 truncate keep-case">${escapeHtml(it.name)}</span>
      <span class="text-xs font-black flex-shrink-0 ${kind === "income" ? "text-emerald-400" : "text-rose-400"}">${peso(it.amount)}</span></button>`).join("");
  showSheet(`Copy from ${monthShort(addMonths(getSelectedKey(), -1))}`,
    `<div class="flex justify-end pb-1"><button type="button" id="copy-all" data-action="copyAll" class="text-[11px] font-bold text-indigo-300 px-2 py-1 rounded-lg bg-white/5">Deselect all</button></div><div class="space-y-1">${rows}</div>`,
    `<button type="button" data-action="qlClose" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Cancel</button>
     <button type="button" id="copy-go" data-action="copyLastMonth" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-indigo-600">Copy ${todo.length}</button>`);
}

// Redraw the circles, the Copy count and the select-all label from each row's data-on
function copySync() {
  const rows = [...document.querySelectorAll("[data-copy]")];
  rows.forEach((el) => {
    const on = el.dataset.on === "true";
    const box = el.querySelector(".copy-box");
    if (box) { box.textContent = on ? "check_circle" : "radio_button_unchecked"; box.className = `material-icons copy-box ${on ? "text-emerald-300" : "text-slate-500"}`; }
  });
  const n = rows.filter((el) => el.dataset.on === "true").length;
  const go = document.getElementById("copy-go");
  if (go) { go.textContent = n ? `Copy ${n}` : "Copy"; go.style.opacity = n ? "1" : ".5"; }
  const all = document.getElementById("copy-all");
  if (all) all.textContent = n === rows.length ? "Deselect all" : "Select all";
}

export function copyToggle(id) {
  const el = document.querySelector(`[data-copy="${id}"]`);
  if (!el) return;
  el.dataset.on = String(el.dataset.on !== "true");
  copySync();
}

/** Select everything, or deselect everything when all are already selected. */
export function copyAll() {
  const rows = [...document.querySelectorAll("[data-copy]")];
  const allOn = rows.every((el) => el.dataset.on === "true");
  rows.forEach((el) => { el.dataset.on = String(!allOn); });
  copySync();
}
/** Copies the ticked items from the picker into this month. */
export async function copyLastMonth() {
  const k = getSelectedKey();
  const ids = new Set([...document.querySelectorAll('[data-copy][data-on="true"]')].map((e) => e.dataset.copy));
  const todo = lastMonthOneTimes().filter(({ it }) => ids.has(it.id));
  if (!todo.length) return toast("Tick at least one item", "error");
  qlClose();
  await applyWithUndo((d) => { todo.forEach(({ kind, it }) => d.items.charlie[kind].push(cloneItem(it, { start: k }))); }, `Copied ${todo.length} item${todo.length === 1 ? "" : "s"}`);
}
// ---------- Settings (text size, exports, key) ----------
export function applyTextSize() {
  const large = lsGet("moneyku_text") === "large";
  document.documentElement.style.fontSize = large ? "118%" : "";
  const b = document.getElementById("budget-body");
  if (b) b.style.zoom = large ? "1.12" : "";
}
export function setTextSize(v) { lsSet("moneyku_text", v); applyTextSize(); openSettings(); }

export function openSettings() {
  const large = lsGet("moneyku_text") === "large";
  const seg = (v, label, on) => `<button type="button" data-action="setTextSize" data-arg0="${v}" class="flex-1 py-2 text-xs font-bold rounded-lg ${on ? "bg-indigo-600 text-white" : "bg-slate-700/60 text-slate-300"}">${label}</button>`;
  const row = (action, icon, label) => `<button type="button" data-action="${action}" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900/50 text-sm font-bold text-slate-100"><span class="material-icons text-slate-400" style="font-size:18px">${icon}</span>${label}</button>`;
  showSheet("Settings",
    `<p class="text-[10px] font-black uppercase tracking-wider text-slate-500">Text size</p>
     <div class="flex gap-2">${seg("normal", "Normal", !large)}${seg("large", "Large", large)}</div>
     <p class="text-[10px] font-black uppercase tracking-wider text-slate-500 pt-2">Data</p>
     ${row("openExport", "ios_share", "Export data (CSV / backup)&hellip;")}
     ${row("exportData", "download", "Full backup (JSON)")}
     ${row("openRestore", "settings_backup_restore", "Restore from a backup")}
     ${row("importCardAsk", "credit_card", "Import BPI Platinum charges (Oct 15 - Nov 13)")}`, CLOSE_BTN);
}

/** Months chosen in the Export sheet (From / To). Falls back to the month being viewed. */
function exportRange() {
  const cur = getSelectedKey();
  let from = $("ex-from")?.value || cur, to = $("ex-to")?.value || from;
  if (cmpKey(to, from) < 0) [from, to] = [to, from];
  const keys = [];
  for (let m = from; cmpKey(m, to) <= 0 && keys.length < 120; m = addMonths(m, 1)) keys.push(m);
  return { from, to, keys };
}

export function exportMonthCsv() {
  const { from, to, keys } = exportRange();
  const rows = [["Month", "Type", "Group", "Name", "Parent", "Amount", "Due day", "Paid", "Category"]];
  for (const k of keys) {
    for (const who of ["charlie", "debt"]) {
      for (const kind of ["income", "expenses"]) {
        for (const it of getItems(who, kind)) {
          if (!itemActiveIn(it, k)) continue;
          const kids = getKids(it, k);
          const cat = kind === "expenses" ? catInfo(categoryOf(it)).label : "";
          if (kids.length) {
            for (const c of kids) rows.push([k, kind, who, c.name, it.name, Number(c.amount) || 0, "", isPaid(c.id, k) ? "yes" : "no", cat]);
          } else {
            rows.push([k, kind, who, it.name, "", itemTotal(it, k), dueDayFor(it) ?? "", isPaid(it.id, k) ? "yes" : "no", cat]);
          }
        }
      }
    }
  }
  downloadCsv(from === to ? `moneyku_${from}.csv` : `moneyku_${from}_to_${to}.csv`, rows);
}
// ---------- Export ----------
function downloadCsv(filename, rows) {
  const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`${filename} exported`);
}
const stamp = () => new Date().toISOString().slice(0, 10);

export function openExport() {
  const row = (action, icon, label, sub) => `<button type="button" data-action="${action}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/50 text-left"><span class="material-icons text-indigo-300" style="font-size:20px">${icon}</span><span class="flex-1 min-w-0"><span class="block text-sm font-bold text-slate-100">${label}</span><span class="block text-[11px] text-slate-500">${sub}</span></span><span class="material-icons text-slate-500" style="font-size:18px">download</span></button>`;
  const cur = getSelectedKey();
  const tl = timeline();
  const lastOpt = addMonths(currentKey(), 24);
  const opts = tl.filter((m) => cmpKey(m, lastOpt) <= 0).map((m) => `<option value="${m}" ${m === cur ? "selected" : ""}>${monthShort(m)}</option>`).join("");
  const sel = (id) => `<select id="${id}" class="flex-1 min-w-0 bg-slate-900 rounded-xl py-2 px-3 text-sm font-bold text-white focus:outline-none">${opts}</select>`;
  showSheet("Export",
    `<div class="rounded-xl bg-slate-900/50 px-3 py-2 space-y-1.5">
      <p class="text-[10px] font-black uppercase tracking-wider text-slate-500">Which months?</p>
      <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400 w-8">From</span>${sel("ex-from")}<span class="text-[11px] font-bold text-slate-400">to</span>${sel("ex-to")}</div>
      <p class="text-[10px] text-slate-500">Used by "Selected months", "12-month outlook" and "BPI Platinum charges".</p>
    </div>
    <div class="space-y-1.5">
      ${row("exportMonthCsv", "table_view", "Selected months", "Income and expenses for the months above (CSV)")}
      ${row("exportOutlookCsv", "insights", "12-month outlook", "Per-month inflow, outflow, net and balance for everyone, Charles and Ynah. One month selected = 12 months from it (CSV)")}
      ${row("exportItemsCsv", "list_alt", "All income &amp; expenses", "Every item with dates, amounts and category (CSV)")}
      ${row("exportCardCsv", "credit_card", "BPI Platinum charges", "Statements due in the months above, with their charges (CSV)")}
      ${row("exportData", "backup", "Full backup", "Everything, to restore later (JSON)")}
     </div>
     <p class="text-[10px] text-slate-500">CSV files open in Excel, Numbers and Google Sheets.</p>`, CLOSE_BTN);
}

export function exportOutlookCsv() {
  const { from, to, keys } = exportRange();
  const list = [];
  if (from === to) { for (let i = 0; i < 13; i++) list.push(addMonths(from, i)); } else list.push(...keys);
  // Inflow/Outflow = what is still to come that month, so Net is the change in the projected balance
  const rows = [["Month", "Inflow", "Outflow", "Net", "Projected balance (all)", "Charles inflow", "Charles outflow", "Charles net", "Charles balance", "Ynah inflow", "Ynah outflow", "Ynah net", "Ynah balance"]];
  const f = (n) => n.toFixed(2);
  for (const r of outlookRows(list.filter((m) => timeline().includes(m)))) {
    const { all, charlie: c, partner: p } = r;
    rows.push([r.m, f(all.inc), f(all.out), f(all.net), f(all.bal), f(c.inc), f(c.out), f(c.net), f(c.bal), f(p.inc), f(p.out), f(p.net), f(p.bal)]);
  }
  downloadCsv(`moneyku_outlook_${from}${from === to ? "" : "_to_" + to}.csv`, rows);
}
export function exportItemsCsv() {
  const rows = [["Type", "Group", "Name", "Parent", "Amount", "Starts", "Ends", "Recurring", "Due day", "Payment method", "Category", "Date"]];
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      for (const it of getItems(who, kind)) {
        const cat = kind === "expenses" ? catInfo(categoryOf(it)).label : "";
        rows.push([kind, who, it.name, "", it.amount ?? 0, it.start || "", it.end || "", it.recurring ? "yes" : "no", dueDayFor(it) ?? "", it.paymentMethod || "", cat, it.txDate || ""]);
        for (const c of getKids(it)) rows.push([kind, who, c.name, it.name, c.amount ?? 0, c.start || it.start || "", c.end || it.end || "", it.recurring ? "yes" : "no", "", it.paymentMethod || "", cat, ""]);
      }
    }
  }
  downloadCsv(`moneyku_items_${stamp()}.csv`, rows);
}

export function exportCardCsv() {
  const tl = timeline();
  const rows = [["Statement cut-off", "Due date", "Charge date", "Name", "Category", "Amount", "Posted", "Statement total", "Paid", "Left"]];
  const { from, to } = exportRange();
  if (tl.length) {
    for (let s = addMonths(from, -2); cmpKey(s, addMonths(to, 1)) <= 0; s = addMonths(s, 1)) {
      const st = statement(s);
      if (cmpKey(st.dueKey, from) < 0 || cmpKey(st.dueKey, to) > 0) continue;
      for (const c of st.charges) rows.push([st.cutoff, st.due, c.date, c.item.name, catInfo(categoryOf(c.item)).label, c.amt.toFixed(2), c.posted ? "yes" : "no", st.total.toFixed(2), st.paid.toFixed(2), st.remaining.toFixed(2)]);
    }
  }
  downloadCsv(`moneyku_bpi_platinum_${from}${from === to ? "" : "_to_" + to}.csv`, rows);
}
// ---------- Automatic daily backups + restore ----------
const SNAP_KEY = "moneyku_snapshots";
const SNAP_KEEP = 7;
const dayStr = () => new Date().toISOString().slice(0, 10);
const countItems = (d) => ["charlie", "debt"].reduce((n, w) => n + ["income", "expenses"].reduce((m, k) => m + ((d.items?.[w]?.[k] || []).length), 0), 0);
const readSnaps = () => { try { return JSON.parse(lsGet(SNAP_KEY, "[]")) || []; } catch { return []; } };

/** Keep the first state seen each day (never overwritten later that day), last 7 days. */
export function takeDailySnapshot() {
  const d = getAppData();
  if (!d || !d.items) return;
  const day = dayStr();
  const snaps = readSnaps();
  if (snaps.some((s) => s.day === day)) return;
  snaps.push({ day, at: new Date().toISOString(), n: countItems(d), data: JSON.parse(JSON.stringify(d)) });
  let keep = snaps.slice(-SNAP_KEEP);
  while (keep.length) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(keep)); return; } catch { keep.shift(); }
  }
}

export function openRestore() {
  const snaps = readSnaps().slice().reverse();
  const rows = snaps.length
    ? snaps.map((s) => `<button type="button" data-action="restoreSnapshot" data-arg0="${s.day}" class="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-700 text-left"><span class="text-sm font-bold text-white">${s.day}</span><span class="text-[11px] font-bold text-slate-400">${s.n} items &middot; tap to restore</span></button>`).join("")
    : `<p class="text-sm text-slate-400">No automatic backups on this device yet. One is saved the first time you open the app each day.</p>`;
  showSheet("Restore from a backup",
    `<p class="text-[11px] text-slate-400">Automatic daily backups on this device (last ${SNAP_KEEP} days). Restoring replaces your current data. You can Undo right after.</p>
     <div class="space-y-1.5">${rows}</div>
     <label class="block w-full text-center py-2.5 text-sm font-bold rounded-xl text-slate-200 bg-slate-700/60 cursor-pointer">Load a backup file&hellip;<input id="rs-file" type="file" accept="application/json,.json" class="hidden" /></label>`, CLOSE_BTN);
  $("rs-file")?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== "object" || !data.items) throw new Error("bad");
      await restoreData(data, `Restored from ${f.name}`);
    } catch { toast("That file isn't a valid backup", "error"); }
  });
}

async function restoreData(data, message) {
  qlClose();
  const fresh = normalize(JSON.parse(JSON.stringify(data)));
  await applyWithUndo((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, fresh); }, message);
}

export async function restoreSnapshot(day) {
  const s = readSnaps().find((x) => x.day === day);
  if (!s) return toast("Backup not found", "error");
  await restoreData(s.data, `Restored the ${day} backup`);
}
// ---------- One-time import of BPI Platinum Rewards charges (Oct 15 - Nov 13, 2026), skipping duplicates ----------
const CARD_IMPORT = [
  "10-15|Move It|55",
  "10-15|Move It|63",
  "10-15|TikTok Shop (e-Credit)|69",
  "10-16|Sukiya SM East|392.57",
  "10-16|Contis SM East|947.63",
  "10-18|432 Pasig|187.40",
  "10-18|SM Store East Ortigas|139",
  "10-18|Watsons SM City East|2934",
  "10-19|Shell Presam Ortigas|1000",
  "10-19|Vikings Antipolo|5836.29",
  "10-19|TikTok Shop|149",
  "10-19|Apple.com/Bill (e-Credit)|200.99",
  "10-19|Apple.com/Bill (e-Credit)|303",
  "10-20|SM Supermarket East|7833.79",
  "10-21|Google One|604.99",
  "10-23|Petron Pasig|521.04",
  "10-25|Xdt*Philippine Campus (donation)|1000",
  "10-26|SM Supermarket East|4330.33",
  "10-26|TikTok Shop|142",
  "10-29|TikTok Shop (e-Credit)|147",
  "10-31|Move It|80",
  "11-01|Grab|144.65",
  "11-02|SM Supermarket East|7236.77",
  "11-03|Petron Pasig|486.39",
  "11-03|Jollibee|110.71",
  "11-03|Jollibee|751",
  "11-04|Grab|183.33",
  "11-04|TikTok Shop (e-Credit)|98",
  "11-04|TikTok Shop (e-Credit)|763.22",
  "11-04|TikTok Shop (e-Credit)|285.02",
  "11-07|Dailybeer Arcovia|1421.52",
  "11-08|Jollibee C. Raymundo|437",
  "11-08|Grab|174",
  "11-08|TikTok Shop (e-Credit)|226.80",
  "11-09|SM Supermarket East|6240.71",
  "11-13|SM Appliance installment 21/24|1444.59",
  "11-13|Net carryover (credit)|-0.99",
].map((s) => { const [md, name, amt] = s.split("|"); return { date: "2026-" + md, name, amount: Number(amt) }; });
let importPlan = null;

function planCardImport() {
  const have = [...charges("2026-10"), ...charges("2026-11")];
  const fresh = [], dups = [];
  for (const r of CARD_IMPORT) {
    const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
    // Same amount (recurring installment, or within 3 days), or same day within PHP 1
    const hit = have.find((c) => (Math.abs(c.amt - r.amount) < 0.01 && (c.item.recurring || days(c.date, r.date) <= 3)) || (c.date === r.date && Math.abs(c.amt - r.amount) <= 1));
    if (hit) dups.push({ ...r, as: hit.item.name }); else { fresh.push(r); have.push({ amt: r.amount, date: r.date, item: { name: r.name } }); }
  }
  return { fresh, dups };
}

/** Runs the card import once, automatically, the first time the app opens with this version (flag is stored in the synced data). */
async function autoImportCard() {
  const d = getAppData();
  if (!d || d.imports?.card_oct_nov_2026_b) return;
  const plan = planCardImport();
  if (!plan.fresh.length) { d.imports = { ...(d.imports || {}), card_oct_nov_2026_b: true }; await syncSet(d); return; }
  await applyWithUndo((x) => {
    for (const r of plan.fresh) addItemData(x, { who: "charlie", kind: "expenses", name: r.name, amount: r.amount, start: r.date.slice(0, 7), recurring: false, paymentMethod: CARD_METHOD, txDay: Number(r.date.slice(8)), cutoffDay: 14, txDate: r.date });
    x.imports = { ...(x.imports || {}), card_oct_nov_2026_b: true };
  }, `Added ${plan.fresh.length} BPI Platinum charges (${plan.dups.length} duplicates skipped)`);
}
export function importCardAsk() {
  importPlan = planCardImport();
  const { fresh, dups } = importPlan;
  const sum = fresh.reduce((s, r) => s + r.amount, 0);
  const dupHtml = dups.length ? `<p class="text-[11px] font-bold text-slate-400 mt-1">Skipped as already in the app:</p>` + dups.map((d) => `<p class="text-[11px] text-slate-500">${d.date.slice(5)} &middot; ${escapeHtml(d.name)} ${peso(d.amount)} <span class="text-slate-600">(matches ${escapeHtml(d.as)})</span></p>`).join("") : "";
  showSheet("Import BPI Platinum charges",
    `<p class="text-sm text-slate-300">${fresh.length} new charge${fresh.length === 1 ? "" : "s"} to add (${peso(sum)}), ${dups.length} skipped as duplicates. Dates run Oct 15 to Nov 13, 2026.</p>${dupHtml}<p class="text-[11px] text-slate-500 mt-1">The -0.99 net carryover line is not added. You can Undo right after.</p>`,
    fresh.length ? `<button type="button" data-action="importCardGo" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-indigo-600">Add ${fresh.length} charges</button><button type="button" data-action="qlClose" class="px-4 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Cancel</button>` : CLOSE_BTN);
}

export async function importCardGo() {
  qlClose();
  const plan = importPlan; importPlan = null;
  if (!plan || !plan.fresh.length) return;
  await applyWithUndo((d) => {
    for (const r of plan.fresh) {
      addItemData(d, { who: "charlie", kind: "expenses", name: r.name, amount: r.amount, start: r.date.slice(0, 7), recurring: false, paymentMethod: CARD_METHOD, txDay: Number(r.date.slice(8)), cutoffDay: 14, txDate: r.date });
    }
  }, `Added ${plan.fresh.length} card charges`);
}
// ---------- First-run tip ----------
export function tipCardHtml() {
  if (lsGet("moneyku_tip_seen")) return "";
  return `<div id="tip-card" class="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2">
    <span class="material-icons text-indigo-300" style="font-size:16px;margin-top:1px">swipe</span>
    <p class="flex-1 text-[11px] text-indigo-100 leading-snug"><b>Tips:</b> swipe a row right to mark it paid, left to edit. Tap the + button to add an item.</p>
    <button type="button" data-action="dismissTip" class="text-[11px] font-bold text-indigo-300 flex-shrink-0" style="padding:10px 8px;margin:-10px -4px -10px 0">Got it</button></div>`;
}
export function dismissTip() { lsSet("moneyku_tip_seen", "1"); document.getElementById("tip-card")?.remove(); document.querySelectorAll(".nudge-hint").forEach((e) => e.classList.remove("nudge-hint")); }

// ---------- boot ----------
// Pull down from the very top of the page to sync
function initPullSync() {
  if (!("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) return;
  let y0 = null, x0 = 0, ind = null;
  const blocked = (t) => t?.closest?.("input, textarea, select, [data-drag-handle], .arr-row") || document.querySelector("#modal-overlay.open, #confirm-overlay.open, #calendar-overlay.open, #more-overlay.open, #month-picker.open, #ql-overlay.open, [role='dialog'][aria-modal='true']");
  const el = () => ind || (ind = Object.assign(document.createElement("div"), { id: "pull-ind", className: "pull-ind", innerHTML: '<span class="material-icons">sync</span>' }), document.body.appendChild(ind), ind);
  document.addEventListener("touchstart", (e) => { y0 = window.scrollY <= 0 && !blocked(e.target) ? e.touches[0].clientY : null; x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (dy <= 0 || dx > dy) { el().style.opacity = 0; return; }
    const n = Math.min(dy, 120);
    Object.assign(el().style, { opacity: Math.min(1, n / 80), transform: `translate(-50%, ${n / 2}px) rotate(${n * 3}deg)` });
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (ind) Object.assign(ind.style, { opacity: 0, transform: "translate(-50%, 0)" });
    if (dy > 110 && window.scrollY <= 0) syncNow();
  }, { passive: true });
}

export function initExtras() {
  applyTextSize();
  initPullSync();
  // Daily safety backup: first state of each day, kept for a week (waits for data to load)
  const snapTimer = setInterval(() => { if (getAppData()) { takeDailySnapshot(); clearInterval(snapTimer); autoImportCard(); } }, 3000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) takeDailySnapshot(); });
  // Offline badge
  const badge = document.createElement("div");
  badge.id = "net-badge";
  badge.className = "fixed top-2 left-1/2 -translate-x-1/2 z-[80] px-3 py-1 rounded-full bg-amber-500/90 text-slate-900 text-[11px] font-black shadow-lg hidden pointer-events-none";
  badge.textContent = "Offline · changes sync when you're back online";
  document.body.appendChild(badge);
  const upd = () => badge.classList.toggle("hidden", navigator.onLine !== false);
  window.addEventListener("online", upd); window.addEventListener("offline", upd); upd();
  // Ignore a second tap on destructive buttons (prevents double delete)
  let lastDel = 0;
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.('[data-action="doDelete"]')) return;
    const now = Date.now();
    if (now - lastDel < 900) { e.stopPropagation(); e.preventDefault(); }
    lastDel = now;
  }, true);
}

// ---------- Header "more" menu: the less-used buttons live here ----------
export function openHeaderMenu() {
  const row = (action, icon, label, sub = "", off = false) => `<button type="button" data-action="headerMenuGo" data-arg0="${action}" ${off ? "disabled" : ""} class="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-900/50 text-left ${off ? "opacity-40" : ""}"><span class="material-icons text-slate-300" style="font-size:20px">${icon}</span><span class="flex-1 min-w-0"><span class="block text-sm font-bold text-slate-100">${label}</span>${sub ? `<span class="block text-[11px] text-slate-500 truncate">${escapeHtml(sub)}</span>` : ""}</span></button>`;
  const u = canUndo();
  showSheet("More",
    `<div class="space-y-1.5">
      ${row("syncNow", "sync", "Sync now", "Send this phone's changes and refresh")}
      ${row("openSearch", "search", "Search")}
      ${row("openAddSheet", "add", "Add income or expense")}
      ${row("histUndo", "undo", "Undo", u ? undoLabel() : "Nothing to undo", !u)}
      ${row("openHistory", "history", "History")}
      ${row("openMore", "bar_chart", "Overview")}
      ${row("toggleMonthPicker", "calendar_month", "Jump to month")}
      ${row("openSettings", "settings", "Settings")}
    </div>`, CLOSE_BTN);
}
export async function syncNow() {
  const d = getAppData(); if (!d) return;
  if (!navigator.onLine) { toast("Offline: your changes are saved on this phone and will sync when you are back online", "error"); return; }
  toast("Syncing…", "ok", { duration: 1500 });
  try { await syncSet(d); renderAll(); toast("Synced", "ok", { duration: 2000 }); } catch (e) { toast("Sync failed, will retry", "error"); }
}
export function headerMenuGo(action) {
  qlClose();
  setTimeout(() => { if (typeof window[action] === "function") window[action](); }, 120);
}
export function openSectionMenu(who) {
  const row = (act, icon, label, sub = "") => `<button type="button" data-action="sectionMenuGo" data-arg0="${act}" data-arg1="${who}" class="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-900/50 text-left"><span class="material-icons text-slate-300" style="font-size:20px">${icon}</span><span class="flex-1 min-w-0"><span class="block text-sm font-bold text-slate-100">${label}</span>${sub ? `<span class="block text-[11px] text-slate-400 truncate">${sub}</span>` : ""}</span></button>`;
  const az = getExpenseSort() === "name";
  showSheet("Expenses",
    `<div class="space-y-1.5">
      ${row("chart", "pie_chart", "View chart", "Where the money goes")}
      ${row("sort", "sort_by_alpha", az ? "Sorted A-Z" : "Sort A-Z", az ? "Tap to go back to the default order" : "Default order: by due date")}
      ${who === "simulated" ? row("person", "people", "Group by person", getSimPersonSort() ? "On" : "Off") : ""}
    </div>`, CLOSE_BTN);
}
export function sectionMenuGo(act, who) {
  qlClose();
  setTimeout(() => {
    if (act === "chart") window.openExpenseChart(who);
    else if (act === "sort") window.toggleExpenseSort();
    else if (act === "person") window.toggleSimPerson();
  }, 120);
}
