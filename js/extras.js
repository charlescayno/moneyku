// =============================
// Extras: search, add chooser, duplicate, copy last month, settings (text size, CSV),
// offline badge, double-tap guard, first-run tip
// =============================
import { $, addMonths, dueDayFor, escapeHtml, generateId, monthShort, peso } from "./utils.js";
import { getAppData, getItems, getKids, getSelectedKey, isPaid, itemActiveIn, itemTotal, setAppData } from "./state.js";
import { syncSet } from "./firebase.js";
import { catInfo, categoryOf } from "./categories.js";
import { toast } from "./ui/core.js";
import { renderAll } from "./ui/layout.js";
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
  showSheet("Add", `<p class="text-sm text-slate-300">What do you want to add?</p>`,
    b("text-emerald-300 bg-emerald-500/15 border border-emerald-500/25", "income", "Income") +
    b("text-rose-300 bg-rose-500/15 border border-rose-500/25", "expenses", "Expense"));
}
export function addNew(kind) { qlClose(); setTimeout(() => openItemModal("charlie", kind), 120); }

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

export async function copyLastMonth() {
  const k = getSelectedKey();
  const todo = lastMonthOneTimes();
  if (!todo.length) return toast("Nothing to copy", "error");
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
     ${row("exportMonthCsv", "table_view", "Export this month (CSV)")}
     ${row("exportData", "download", "Full backup (JSON)")}
     <p class="text-[10px] font-black uppercase tracking-wider text-slate-500 pt-2">Quick log</p>
     ${row("qlOpenKey", "key", "Gemini API key")}`, CLOSE_BTN);
}

export function exportMonthCsv() {
  const k = getSelectedKey();
  const rows = [["Type", "Group", "Name", "Parent", "Amount", "Due day", "Paid", "Category"]];
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      for (const it of getItems(who, kind)) {
        if (!itemActiveIn(it, k)) continue;
        const kids = getKids(it, k);
        const cat = kind === "expenses" ? catInfo(categoryOf(it)).label : "";
        if (kids.length) {
          for (const c of kids) rows.push([kind, who, c.name, it.name, Number(c.amount) || 0, "", isPaid(c.id, k) ? "yes" : "no", cat]);
        } else {
          rows.push([kind, who, it.name, "", itemTotal(it, k), dueDayFor(it) ?? "", isPaid(it.id, k) ? "yes" : "no", cat]);
        }
      }
    }
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `moneyku_${k}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("CSV exported");
}

// ---------- First-run tip ----------
export function tipCardHtml() {
  if (lsGet("moneyku_tip_seen")) return "";
  return `<div id="tip-card" class="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2">
    <span class="material-icons text-indigo-300" style="font-size:16px;margin-top:1px">swipe</span>
    <p class="flex-1 text-[11px] text-indigo-100 leading-snug"><b>Tips:</b> swipe a row right to mark it paid, left to edit. Long-press a calendar day to add on that day. Tap the sparkle bar to log in plain words.</p>
    <button type="button" data-action="dismissTip" class="text-[11px] font-bold text-indigo-300 flex-shrink-0">Got it</button></div>`;
}
export function dismissTip() { lsSet("moneyku_tip_seen", "1"); document.getElementById("tip-card")?.remove(); document.querySelectorAll(".nudge-hint").forEach((e) => e.classList.remove("nudge-hint")); }

// ---------- boot ----------
export function initExtras() {
  applyTextSize();
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
