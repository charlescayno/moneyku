// =============================
// One-time data migrations, applied automatically when the data loads.
// Each returns true when it changed something (the caller then saves to the cloud).
// =============================
import { cmpKey, generateId } from "./utils.js";

const GROCERY_FROM = "2026-12";
const GROCERY_RATE = 3000;

/**
 * Grocery becomes 3,000 per Monday of each month (4 or 5 Mondays) from Dec 2026 onwards.
 * The existing Grocery sub-expense ends in Nov 2026; a copy with `perMonday` starts in Dec 2026.
 * Any per-month data (paid, overrides, spend...) from Dec 2026 on moves to the new line.
 * Safe to run on every load: it only acts once (marked in settings) and only if Grocery is found.
 */
export function migrateGroceryPerMonday(d) {
  if (!d || !d.items) return false;
  d.settings = d.settings || {};
  if (d.settings.groceryPerMondayFrom) return false;

  for (const who of ["charlie", "debt"]) {
    for (const parent of d.items[who]?.expenses || []) {
      if (!parent || !parent.recurring || !Array.isArray(parent.children)) continue;
      const kids = parent.children;
      const at = kids.findIndex(
        (c) => c && /^grocer/i.test(c.name || "") && c.perMonday == null && (!c.end || cmpKey(c.end, GROCERY_FROM) >= 0)
      );
      if (at < 0) continue;

      const old = kids[at];
      const next = JSON.parse(JSON.stringify(old));
      next.id = generateId();
      next.start = GROCERY_FROM;
      delete next.end;
      next.perMonday = GROCERY_RATE;
      old.end = "2026-11";
      if (old.start && cmpKey(old.end, old.start) < 0) {
        // the old line only existed from Dec on: replace it instead of keeping an empty one
        kids.splice(at, 1, next);
      } else {
        kids.splice(at + 1, 0, next);
      }

      for (const field of ["paid", "paidFrom", "spend", "overrides", "deleted"]) {
        const obj = d[field];
        if (!obj) continue;
        for (const m of Object.keys(obj)) {
          if (cmpKey(m, GROCERY_FROM) < 0 || !obj[m] || !(old.id in obj[m])) continue;
          obj[m][next.id] = obj[m][old.id];
          delete obj[m][old.id];
        }
      }

      d.settings.groceryPerMondayFrom = GROCERY_FROM;
      return true;
    }
  }
  return false;
}

const PC_IDS = ["uniy6tx55", "zfsz971r3"]; // duplicate "PC" and "PC Payment" lines the user asked to remove

/** Removes the PC / PC Payment lines (and their per-month data). Runs once (flag in settings). */
export function migrateRemovePcItems(d) {
  if (!d || !d.items) return false;
  d.settings = d.settings || {};
  if (d.settings.pcItemsRemoved) return false;
  const walk = (list) => (list || []).filter((it) => !PC_IDS.includes(it?.id)).map((it) => {
    if (Array.isArray(it?.children)) it.children = walk(it.children);
    return it;
  });
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      if (Array.isArray(d.items[who]?.[kind])) d.items[who][kind] = walk(d.items[who][kind]);
    }
  }
  for (const field of ["paid", "paidFrom", "overrides", "spend", "deleted"]) {
    for (const m of Object.values(d[field] || {})) {
      if (m && typeof m === "object") for (const id of PC_IDS) delete m[id];
    }
  }
  d.settings.pcItemsRemoved = true;
  return true;
}
