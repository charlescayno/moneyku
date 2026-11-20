// =============================
// Simulated Together Money: an editable what-if sandbox.
// Its data lives only in appData.items.simulated (+ appData.simCash). It is never summed into
// Charles', Ynah's or the combined numbers, the due calendar or the Upcoming Bills banner.
// "Copy from Charles / Ynah" makes independent snapshots (new ids, nothing shared with the source).
// =============================
import { $, escapeHtml, generateId, monthShort, parseMathAmount, peso } from "./utils.js";
import { getAppData, getItems, getSelectedKey, itemActiveIn, setAppData, setSimView } from "./state.js";
import { syncSet } from "./firebase.js";
import { isCardItem } from "./card.js";
import { toast } from "./ui/core.js";
import { renderAll } from "./ui/layout.js";
import { qlClose, showSheet } from "./ui/quicklog.js";

const SRC_LABEL = { charlie: "Charles", partner: "Ynah" };
const CANCEL_BTN = `<button type="button" data-action="qlClose" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Cancel</button>`;

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

/** Show the simulation in the budget area (Charles / Ynah / Together tiles leave it again). */
export function openSimulated() {
  setSimView(true);
  renderAll();
}

// ---------- copy from Charles / Ynah ----------
let ctx = null; // { source, kind, ids, dupIds }

/** Items of one person's list that can be copied (card purchases belong to the card bill, not to a list). */
function copyable(source, kind) {
  return getItems(source, kind).filter((it) => !isCardItem(it));
}

const norm = (s) => String(s || "").trim().toLowerCase();

/** Already in the simulation: copied from the same item before, or same name and amount. */
function isDuplicate(src, kind) {
  return getItems("simulated", kind).some((x) => x.copiedFrom === src.id || (norm(x.name) === norm(src.name) && Number(x.amount) === Number(src.amount)));
}

export function openSimCopy(source, kind) {
  source = source === "partner" ? "partner" : "charlie";
  kind = kind === "income" ? "income" : "expenses";
  const k = getSelectedKey();
  const list = copyable(source, kind);
  if (!list.length) return toast(`${SRC_LABEL[source]} has no ${kind === "income" ? "income" : "expenses"} to copy`, "error");
  ctx = { source, kind };
  // This month's items first and ticked; the rest of the list is there too, unticked
  const sorted = [...list.filter((it) => itemActiveIn(it, k)), ...list.filter((it) => !itemActiveIn(it, k))];
  const rows = sorted.map((it) => {
    const on = itemActiveIn(it, k);
    return `<button type="button" data-action="simCopyToggle" data-arg0="${escapeHtml(it.id)}" data-simcopy="${escapeHtml(it.id)}" data-month="${on}" data-on="${on}" class="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900/50 text-left">
      <span class="material-icons copy-box" style="font-size:20px">radio_button_unchecked</span>
      <span class="flex-1 min-w-0"><span class="block text-sm font-bold text-slate-100 truncate">${escapeHtml(it.name)}</span>${on ? "" : `<span class="block text-[10px] text-slate-500">not in ${monthShort(k)}</span>`}</span>
      <span class="text-xs font-black flex-shrink-0 ${kind === "income" ? "text-emerald-400" : "text-rose-400"}">${peso(Number(it.amount) || 0)}</span></button>`;
  }).join("");
  showSheet(`Copy ${kind === "income" ? "income" : "expenses"} from ${SRC_LABEL[source]}`,
    `<p class="text-[11px] text-slate-400 pb-1">Copies are snapshots: later changes to ${SRC_LABEL[source]} won't change them. Items in ${monthShort(k)} are ticked. Untick everything to copy just ${monthShort(k)}'s items.</p>
     <div class="flex justify-end pb-1"><button type="button" id="sim-copy-all" data-action="simCopyAll" class="text-[11px] font-bold text-indigo-300 px-2 py-1 rounded-lg bg-white/5">Deselect all</button></div>
     <div id="sim-copy-rows" class="space-y-1">${rows}</div>`,
    `${CANCEL_BTN}<button type="button" id="sim-copy-go" data-action="simCopyGo" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-indigo-600">Copy</button>`);
  simCopySync();
}

function simRows() { return [...document.querySelectorAll("#sim-copy-rows [data-simcopy]")]; }

function simCopySync() {
  const rows = simRows();
  rows.forEach((el) => {
    const on = el.dataset.on === "true";
    const box = el.querySelector(".copy-box");
    if (box) { box.textContent = on ? "check_circle" : "radio_button_unchecked"; box.className = `material-icons copy-box ${on ? "text-emerald-300" : "text-slate-500"}`; }
  });
  const n = rows.filter((el) => el.dataset.on === "true").length;
  const monthN = rows.filter((el) => el.dataset.month === "true").length;
  const go = $("sim-copy-go");
  if (go) go.textContent = n ? `Copy ${n}` : monthN ? `Copy this month's (${monthN})` : "Copy";
  const all = $("sim-copy-all");
  if (all) all.textContent = n === rows.length ? "Deselect all" : "Select all";
}

export function simCopyToggle(id) {
  const el = simRows().find((r) => r.dataset.simcopy === id);
  if (!el) return;
  el.dataset.on = String(el.dataset.on !== "true");
  simCopySync();
}

/** Select everything, or deselect everything when all are already selected. */
export function simCopyAll() {
  const rows = simRows();
  const allOn = rows.every((el) => el.dataset.on === "true");
  rows.forEach((el) => { el.dataset.on = String(!allOn); });
  simCopySync();
}

export function simCopyGo() {
  if (!ctx) return;
  const rows = simRows();
  let ids = rows.filter((el) => el.dataset.on === "true").map((el) => el.dataset.simcopy);
  if (!ids.length) ids = rows.filter((el) => el.dataset.month === "true").map((el) => el.dataset.simcopy); // no choice made: this month's items
  if (!ids.length) return toast("Nothing to copy in this month", "error");
  const { source, kind } = ctx;
  const items = copyable(source, kind).filter((it) => ids.includes(it.id));
  const dups = items.filter((it) => isDuplicate(it, kind));
  ctx = { source, kind, ids, dupIds: dups.map((it) => it.id) };
  if (!dups.length) return doCopy(items);
  const names = dups.slice(0, 5).map((it) => escapeHtml(it.name)).join(", ") + (dups.length > 5 ? `, +${dups.length - 5} more` : "");
  showSheet("Already in Simulated",
    `<p class="text-sm text-slate-300 leading-relaxed">${dups.length} of ${items.length} selected ${items.length === 1 ? "item is" : "items are"} already in the simulation: <b class="text-white">${names}</b>.</p>
     <p class="text-[11px] text-slate-500 pt-1">Skip them, or add them again as new copies?</p>`,
    `${CANCEL_BTN}<button type="button" data-action="simCopyResolve" data-arg0="skip" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-indigo-600">Skip ${dups.length === 1 ? "it" : "them"}</button><button type="button" data-action="simCopyResolve" data-arg0="again" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-amber-100 bg-amber-600/70">Add again</button>`);
}

export function simCopyResolve(mode) {
  if (!ctx || !ctx.ids) return qlClose();
  const { source, kind, ids, dupIds } = ctx;
  let items = copyable(source, kind).filter((it) => ids.includes(it.id));
  if (mode === "skip") items = items.filter((it) => !dupIds.includes(it.id));
  if (!items.length) { qlClose(); return toast("Nothing copied: already in Simulated"); }
  doCopy(items);
}

/** Deep copy of one source item into the simulation: new ids, children and their due days included. */
function cloneInto(d, src, source) {
  const c = JSON.parse(JSON.stringify(src)); // nothing is shared with the source
  const idMap = [[src.id, null]];
  c.id = generateId();
  idMap[0][1] = c.id;
  if (Array.isArray(c.children)) {
    c.children = c.children.filter(Boolean).map((ch) => { const old = ch.id; ch.id = generateId(); idMap.push([old, ch.id]); return ch; });
  }
  c.copiedFrom = src.id;
  c.copiedFromWho = source;
  // This-month-only amount changes and deletions travel with the copy (paid marks and spending do not)
  for (const field of ["overrides", "deleted"]) {
    const obj = d[field];
    if (!obj) continue;
    for (const m of Object.keys(obj)) {
      if (!obj[m] || typeof obj[m] !== "object") continue;
      for (const [o, n] of idMap) if (obj[m][o] !== undefined) obj[m][n] = obj[m][o];
    }
  }
  return c;
}

async function doCopy(items) {
  const { source, kind } = ctx;
  const ids = items.map((it) => it.id);
  qlClose();
  ctx = null;
  await applyWithUndo((d) => {
    d.items.simulated = d.items.simulated || { income: [], expenses: [] };
    d.items.simulated[kind] = d.items.simulated[kind] || [];
    for (const id of ids) {
      const src = (d.items[source]?.[kind] || []).find((x) => x && x.id === id);
      if (src) d.items.simulated[kind].push(cloneInto(d, src, source));
    }
  }, `Copied ${ids.length} ${kind === "income" ? (ids.length === 1 ? "income item" : "income items") : (ids.length === 1 ? "expense" : "expenses")} from ${SRC_LABEL[source]}`);
}

// ---------- clear / starting cash ----------
export function askClearSimulation() {
  const n = getItems("simulated", "income").length + getItems("simulated", "expenses").length;
  showSheet("Clear simulation?",
    `<p class="text-sm text-slate-300 leading-relaxed">This removes all ${n} simulated ${n === 1 ? "item" : "items"} and the starting cash. Charles' and Ynah's budgets are not touched.</p>`,
    `${CANCEL_BTN}<button type="button" data-action="clearSimulation" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-rose-600">Clear simulation</button>`);
}

export async function clearSimulation() {
  qlClose();
  await applyWithUndo((d) => {
    // Forget everything stored for the simulated items' ids (paid marks, amount overrides, deletions) so nothing lingers
    const ids = new Set();
    for (const kind of ["income", "expenses"]) {
      for (const it of d.items?.simulated?.[kind] || []) {
        if (!it) continue;
        ids.add(it.id);
        for (const c of Array.isArray(it.children) ? it.children : []) if (c) ids.add(c.id);
      }
    }
    for (const field of ["paid", "paidFrom", "spend", "overrides", "deleted"]) {
      const obj = d[field];
      if (!obj) continue;
      for (const m of Object.keys(obj)) { if (obj[m] && typeof obj[m] === "object") for (const id of ids) delete obj[m][id]; }
    }
    d.items.simulated = { income: [], expenses: [] };
    d.simCash = 0;
  }, "Simulation cleared");
}

export function openSimCash() {
  const cur = Number(getAppData()?.simCash) || 0;
  showSheet("Simulated starting cash",
    `<p class="text-[11px] text-slate-400 pb-1">The cash the simulation starts from. It feeds Current money, Real money and Projected, and is independent of real accounts.</p>
     <input id="sim-cash-input" type="text" inputmode="decimal" autocomplete="off" value="${cur || ""}" placeholder="0" class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none" />`,
    `${CANCEL_BTN}<button type="button" data-action="simCashSave" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-white bg-indigo-600">Save</button>`);
  setTimeout(() => $("sim-cash-input")?.focus(), 60);
}

export async function simCashSave() {
  const v = parseMathAmount($("sim-cash-input")?.value);
  const n = Number(v);
  if (!Number.isFinite(n)) return toast("Enter a number", "error");
  qlClose();
  const d = getAppData();
  d.simCash = Math.round((n + Number.EPSILON) * 100) / 100;
  await syncSet(d);
  renderAll();
  toast("Saved");
}
