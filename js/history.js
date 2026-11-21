// =============================
// Undo / redo and change history.
// Every save (syncSet) is compared with the previous state; a real change becomes a
// history entry holding the state it came from, so it can be undone or restored.
// Background refreshes of share prices / FX rates are ignored.
// =============================
import { getAppData, setAppData } from "./state.js";

const KEY = "moneyku_history";
const MAX_ENTRIES = 40;
const MAX_CHARS = 1500000; // keep localStorage use in check
const VOLATILE = ["cachedPowi", "cachedUsdPhp", "lastFetch"];

let baseline = null;       // JSON of the last saved state
let baselineStable = null; // same, without the volatile fields
let log = [];              // newest last: { id, t, label, kind: "change"|"undo"|"redo", before?, after? }
let undoable = [];         // entries that can be undone (newest last)
let redoable = [];
let nextLabel = null;    // optional label for the very next recorded change
let hooks = { save: async () => {}, render: () => {} };
const listeners = new Set();

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const peso = (n) => "\u20B1" + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-PH", { maximumFractionDigits: 2 });

function stable(obj) {
  const c = JSON.parse(JSON.stringify(obj));
  if (c && c.investments) for (const f of VOLATILE) delete c.investments[f];
  return JSON.stringify(c);
}

function notify() { listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); }
export function onHistoryChange(fn) { listeners.add(fn); }

function persist() {
  try {
    const keep = log.filter((e) => e.kind === "change").slice(-MAX_ENTRIES).map((e) => ({ id: e.id, t: e.t, label: e.label, kind: e.kind, before: e.before }));
    let json = JSON.stringify(keep);
    while (json.length > MAX_CHARS && keep.length > 1) { keep.shift(); json = JSON.stringify(keep); }
    localStorage.setItem(KEY, json);
  } catch { /* storage full or unavailable: history just stays in memory */ }
}

export function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(arr)) log = arr.filter((e) => e && e.id && e.before);
  } catch { log = []; }
  notify();
}

export function configureHistory(h) { hooks = { ...hooks, ...h }; }

/** The data came from the cloud/cache, not from this session's edits: start tracking from here. */
export function rebaseHistory(data) {
  baseline = data ? JSON.stringify(data) : null;
  baselineStable = data ? stable(data) : null;
  undoable = [];
  redoable = [];
  notify();
}

// ---------- describing a change ----------
function indexItems(d) {
  const m = new Map();
  for (const who of ["charlie", "debt", "partner", "pdebt", "simulated"]) {
    for (const kind of ["income", "expenses"]) {
      for (const it of d?.items?.[who]?.[kind] || []) {
        if (!it) continue;
        m.set(it.id, { name: it.name, amount: it.amount, kind });
        for (const c of Array.isArray(it.children) ? it.children : []) if (c) m.set(c.id, { name: `${it.name} \u203A ${c.name}`, amount: c.amount, kind });
      }
    }
  }
  return m;
}

export function describe(before, after) {
  const parts = [];
  const a = indexItems(before), b = indexItems(after);
  const added = [], removed = [], renamed = [], amounts = [];
  for (const [id, it] of b) {
    const o = a.get(id);
    if (!o) added.push(it.name);
    else {
      if (o.name !== it.name) renamed.push(`${o.name} \u2192 ${it.name}`);
      if (Number(o.amount) !== Number(it.amount)) amounts.push(`${it.name} ${peso(o.amount)} \u2192 ${peso(it.amount)}`);
    }
  }
  for (const [id, it] of a) if (!b.has(id)) removed.push(it.name);
  const list = (arr) => (arr.length > 2 ? `${arr.slice(0, 2).join(", ")} +${arr.length - 2}` : arr.join(", "));
  if (added.length) parts.push(`Added ${list(added)}`);
  if (removed.length) parts.push(`Removed ${list(removed)}`);
  if (amounts.length) parts.push(`Changed ${list(amounts)}`);
  if (renamed.length) parts.push(`Renamed ${list(renamed)}`);

  // paid / received toggles
  const names = new Map([...a, ...b]);
  const on = [], off = [];
  const months = new Set([...Object.keys(before?.paid || {}), ...Object.keys(after?.paid || {})]);
  for (const m of months) {
    const pa = before?.paid?.[m] || {}, pb = after?.paid?.[m] || {};
    for (const id of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
      if (!!pa[id] === !!pb[id]) continue;
      (pb[id] ? on : off).push(names.get(id)?.name || "item");
    }
  }
  if (on.length) parts.push(`Marked paid ${list(on)}`);
  if (off.length) parts.push(`Marked unpaid ${list(off)}`);

  // accounts
  const acctsA = new Map((before?.accounts || []).map((x) => [x.id, x])), acctsB = new Map((after?.accounts || []).map((x) => [x.id, x]));
  const accts = [];
  for (const [id, x] of acctsB) {
    const o = acctsA.get(id);
    if (!o) accts.push(`Added account ${x.name}`);
    else if (Number(o.amount) !== Number(x.amount)) accts.push(`${x.name} ${peso(o.amount)} \u2192 ${peso(x.amount)}`);
    else if (o.name !== x.name) accts.push(`Renamed ${o.name} \u2192 ${x.name}`);
  }
  for (const [id, x] of acctsA) if (!acctsB.has(id)) accts.push(`Removed account ${x.name}`);
  if (accts.length) parts.push(list(accts));

  // card
  const pa = (before?.cardPayments || []).length, pb = (after?.cardPayments || []).length;
  if (pb > pa) parts.push("Paid the card");
  else if (pb < pa) parts.push("Card payment removed");
  if (JSON.stringify(before?.cardStatements || []) !== JSON.stringify(after?.cardStatements || [])) parts.push("Card statement changed");

  if (before?.startMonth !== after?.startMonth) parts.push(`Timeline now starts ${after?.startMonth}`);
  if (JSON.stringify(before?.overrides || {}) !== JSON.stringify(after?.overrides || {}) && !amounts.length) parts.push("Changed an amount for one month");
  if (JSON.stringify(before?.investments || {}) !== JSON.stringify(after?.investments || {}) && !parts.length) parts.push("Updated investments");
  if (!parts.length) parts.push("Edited data");
  return parts.length > 3 ? `${parts.slice(0, 3).join("; ")}; +${parts.length - 3} more` : parts.join("; ");
}

// ---------- recording ----------
/** Called by syncSet before every write. */
export function recordChange(data) {
  if (!data) return;
  const full = JSON.stringify(data);
  const st = stable(data);
  if (baseline === null) { baseline = full; baselineStable = st; return; }
  if (st === baselineStable) { baseline = full; return; } // only background refreshes changed
  const before = baseline;
  let label = nextLabel;
  nextLabel = null;
  if (!label) { try { label = describe(JSON.parse(before), data); } catch { label = "Edited data"; } }
  const e = { id: uid(), t: Date.now(), label, kind: "change", before };
  log.push(e);
  undoable.push(e);
  redoable = [];
  baseline = full;
  baselineStable = st;
  if (log.length > MAX_ENTRIES * 2) log = log.slice(-MAX_ENTRIES * 2);
  persist();
  notify();
}

// ---------- undo / redo ----------
export const canUndo = () => undoable.length > 0;
export const canRedo = () => redoable.length > 0;
export const undoLabel = () => (undoable.length ? undoable[undoable.length - 1].label : "");
export const redoLabel = () => (redoable.length ? redoable[redoable.length - 1].label : "");
export const getHistory = () => log.slice().reverse();

/** Put `json` back as the app data, keeping the live rates, without logging it as a new change. */
async function applyQuiet(json) {
  const cur = getAppData();
  const next = JSON.parse(json);
  if (cur && cur.investments) {
    next.investments = next.investments || {};
    for (const f of VOLATILE) if (cur.investments[f] !== undefined) next.investments[f] = cur.investments[f];
  }
  baseline = JSON.stringify(next);
  baselineStable = stable(next);
  setAppData(next);
  hooks.render();
  // Save in the background: offline, the cloud write only finishes once we are back online
  Promise.resolve(hooks.save(next)).catch(() => {});
}

export async function undo() {
  const e = undoable.pop();
  if (!e) return null;
  e.after = baseline;
  await applyQuiet(e.before);
  redoable.push(e);
  log.push({ id: uid(), t: Date.now(), label: `Undid: ${e.label}`, kind: "undo" });
  notify();
  return e;
}

export async function redo() {
  const e = redoable.pop();
  if (!e) return null;
  await applyQuiet(e.after);
  undoable.push(e);
  log.push({ id: uid(), t: Date.now(), label: `Redid: ${e.label}`, kind: "redo" });
  notify();
  return e;
}

/** Go back to how things were just before a past change. This is itself a normal, undoable change. */
export async function restoreBefore(id) {
  const e = log.find((x) => x.id === id && x.before);
  if (!e) return null;
  const cur = getAppData();
  const next = JSON.parse(e.before);
  if (cur && cur.investments) {
    next.investments = next.investments || {};
    for (const f of VOLATILE) if (cur.investments[f] !== undefined) next.investments[f] = cur.investments[f];
  }
  nextLabel = `Restored to before: ${e.label}`;
  setAppData(next);
  const saved = Promise.resolve(hooks.save(next)).catch(() => {}); // syncSet records the difference as a new change
  hooks.render();
  void saved;
  return e;
}
