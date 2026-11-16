/**
 * Remove duplicate PC / PC Payment recurring expenses (ids from moneyku dump).
 * Usage: node remove_pc_expenses.cjs [path-to-json]
 * Default path: ./db_dump.json (does not touch Firebase unless you upload the result).
 */
const fs = require("fs");
const path = require("path");

const IDS = ["uniy6tx55", "zfsz971r3"];
const dbPath = path.resolve(process.argv[2] || "./db_dump.json");

const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));

for (const who of ["charlie", "debt"]) {
  for (const kind of ["income", "expenses"]) {
    const list = data.items?.[who]?.[kind];
    if (!Array.isArray(list)) continue;
    data.items[who][kind] = list.filter((it) => !IDS.includes(it.id));
  }
}

for (const field of ["paid", "paidFrom", "overrides", "spend", "deleted"]) {
  const obj = data[field];
  if (!obj) continue;
  for (const month of Object.keys(obj)) {
    if (!obj[month] || typeof obj[month] !== "object") continue;
    for (const id of IDS) delete obj[month][id];
  }
}

fs.writeFileSync(dbPath, JSON.stringify(data));
console.log("Removed PC items:", IDS.join(", "));
console.log("Updated:", dbPath);
console.log(
  "To apply live: open Moneyku signed in, DevTools console:\n" +
    "  import('./js/firebase.js').then(async ({ syncSet }) => { /* paste normalized JSON */ })\n" +
    "Or use Delete > All occurrences on each PC line in the app."
);