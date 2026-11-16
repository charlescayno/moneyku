// =============================
// Item data operations (no DOM). Shared by the Add/Edit popup and Quick Log.
// =============================
import { addMonths, cmpKey, generateId } from "./utils.js";

/** Change an item's amount honouring the scope: "all" | "future" | "month". */
/** Move everything stored per month for `fromId` (from month k on) to `toId`. */
function moveMonthData(appData, fromId, toId, k) {
  for (const field of ["paid", "paidFrom", "spend", "overrides", "deleted"]) {
    const obj = appData[field];
    if (!obj) continue;
    for (const m of Object.keys(obj)) {
      if (cmpKey(m, k) < 0 || !obj[m] || !(fromId in obj[m])) continue;
      if (field === "overrides" && m === k) { delete obj[m][fromId]; continue; } // the new amount replaces it
      obj[m][toId] = obj[m][fromId];
      delete obj[m][fromId];
    }
  }
}

/**
 * Change an amount honouring the scope. Works for items and for sub-items
 * (pass { recurring } for a sub-item, which follows its parent).
 */
export function applyItemAmount(appData, list, it, amount, scope, k, opts = {}) {
  appData.overrides = appData.overrides || {};
  const recurring = opts.recurring !== undefined ? opts.recurring : it.recurring;
  if (recurring && scope === "month") {
    appData.overrides[k] = appData.overrides[k] || {};
    appData.overrides[k][it.id] = amount;
  } else if (recurring && scope === "future" && (!it.start || cmpKey(k, it.start) > 0)) {
    const prevMonth = addMonths(k, -1);
    const clone = JSON.parse(JSON.stringify(it));
    clone.id = generateId();
    clone.start = k;
    clone.amount = amount;
    delete clone.perMonday; // a manual amount replaces the per-Monday rate
    const at = list.indexOf(it);
    if (at >= 0) list.splice(at + 1, 0, clone); else list.push(clone);
    it.end = prevMonth;
    moveMonthData(appData, it.id, clone.id, k);
  } else {
    it.amount = amount;
    delete it.perMonday;
    if (appData.overrides[k]) delete appData.overrides[k][it.id];
  }
}

/** Create a new income/expense item and add it to the right list. Returns the item. */
export function addItemData(appData, { who = "charlie", kind, name, amount, start, recurring = true, end = null, dueDay = null, paymentMethod = "cash", txDay = null, cutoffDay = null, txDate = null, category = "" }) {
  const list = appData.items[who][kind];
  const item = { id: generateId(), name, amount, start, end: recurring ? end : null, recurring, dueDay, paymentMethod, txDay, cutoffDay };
  if (txDate) item.txDate = txDate;
  if (category) item.category = category;
  list.push(item);
  return item;
}

/** Find an item by id across both people and both kinds. */
export function findItemAnywhere(appData, id) {
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      const list = appData.items?.[who]?.[kind] || [];
      const item = list.find((x) => x.id === id);
      if (item) return { who, kind, item, list };
    }
  }
  return null;
}

export function setPaidData(appData, id, k, on) {
  appData.paid = appData.paid || {};
  appData.paid[k] = appData.paid[k] || {};
  appData.paid[k][id] = !!on;
}

/**
 * Reorder a parent's sub-items. `newOrder` is the new order of the ids that are
 * shown (a permutation of `shownIds`). Sub-items hidden this month keep their slot.
 * Returns true when the stored order changed.
 */
export function applyChildOrder(parent, shownIds, newOrder) {
  const kids = parent && Array.isArray(parent.children) ? parent.children : null;
  if (!kids || newOrder.length !== shownIds.length) return false;
  if (new Set(newOrder).size !== newOrder.length || !newOrder.every((id) => shownIds.includes(id))) return false;
  const byId = new Map(kids.filter(Boolean).map((c) => [c.id, c]));
  const slots = kids.map((c, i) => (c && shownIds.includes(c.id) ? i : -1)).filter((i) => i >= 0);
  if (slots.length !== newOrder.length) return false;
  let changed = false;
  slots.forEach((slot, n) => {
    const next = byId.get(newOrder[n]);
    if (kids[slot] !== next) { kids[slot] = next; changed = true; }
  });
  return changed;
}

/**
 * Start fresh at month `startKey`: the timeline begins there and everything stored
 * for earlier months is dropped. Items that were only active before it are removed.
 * Items that carry on (recurring, installments still running) are kept untouched,
 * so installment progress ("month 3 of 12") still counts from the real start.
 * Returns how many items and months were removed.
 */
export function startFreshAt(appData, startKey) {
  let items = 0, months = 0;
  const before = (m) => cmpKey(m, startKey) < 0;
  const over = (it) => (it.recurring ? !!it.end && before(it.end) : !!it.start && before(it.start));
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      const list = appData.items?.[who]?.[kind];
      if (!Array.isArray(list)) continue;
      const keep = list.filter((it) => {
        if (it && over(it)) { items++; return false; }
        return true;
      });
      for (const it of keep) {
        if (Array.isArray(it.children)) it.children = it.children.filter((c) => !(c && c.end && before(c.end)));
      }
      appData.items[who][kind] = keep;
    }
  }
  for (const field of ["paid", "paidFrom", "overrides", "spend", "deleted"]) {
    const obj = appData[field];
    if (!obj) continue;
    for (const m of Object.keys(obj)) {
      if (/^\d{4}-\d{2}$/.test(m) && before(m)) { delete obj[m]; if (field === "paid") months++; }
    }
  }
  appData.startMonth = startKey;
  return { items, months };
}
