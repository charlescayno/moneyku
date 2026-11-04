// =============================
// Item data operations (no DOM). Shared by the Add/Edit popup and Quick Log.
// =============================
import { addMonths, cmpKey, generateId } from "./utils.js";

/** Change an item's amount honouring the scope: "all" | "future" | "month". */
export function applyItemAmount(appData, list, it, amount, scope, k) {
  appData.overrides = appData.overrides || {};
  if (it.recurring && scope === "month") {
    appData.overrides[k] = appData.overrides[k] || {};
    appData.overrides[k][it.id] = amount;
  } else if (it.recurring && scope === "future" && cmpKey(k, it.start) > 0) {
    const prevMonth = addMonths(k, -1);
    const clone = JSON.parse(JSON.stringify(it));
    clone.id = generateId();
    clone.start = k;
    clone.amount = amount;
    list.push(clone);
    it.end = prevMonth;
  } else {
    it.amount = amount;
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
