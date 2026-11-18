import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";
import { setAppData, childAmt } from "../js/state.js";
import { migrateGroceryPerMonday } from "../js/migrations.js";

function dataWithGrocery() {
  const d = makeData();
  d.items.charlie.expenses.push({
    id: "fam", name: "Family Expense", amount: 0, recurring: true, start: "2026-09",
    children: [
      { id: "rice", name: "Rice", amount: 1500 },
      { id: "gro", name: "Grocery", amount: 15000 },
    ],
  });
  d.paid["2026-11"] = { gro: true };
  d.overrides["2027-02"] = { gro: 9000 };
  return d;
}
const grocery = (d, month) =>
  d.items.charlie.expenses[0].children.filter(
    (c) => /grocer/i.test(c.name) && (!c.start || c.start <= month) && (!c.end || c.end >= month)
  );

test("splits Grocery: old line ends Nov 2026, new per-Monday line starts Dec 2026", () => {
  const d = dataWithGrocery();
  assert.equal(migrateGroceryPerMonday(d), true);

  const kids = d.items.charlie.expenses[0].children;
  assert.equal(kids.length, 3);
  const old = kids.find((c) => c.id === "gro");
  const next = kids.find((c) => c.perMonday === 3000);
  assert.equal(old.end, "2026-11");
  assert.equal(next.start, "2026-12");
  assert.equal(next.end, undefined);
  assert.equal(d.settings.groceryPerMondayFrom, "2026-12");
});

test("amounts per month: unchanged before Dec, 3000 x Mondays after, overrides kept", () => {
  const d = dataWithGrocery();
  migrateGroceryPerMonday(d);
  setAppData(d);
  const want = { "2026-11": 15000, "2026-12": 12000, "2027-01": 12000, "2027-02": 9000, "2027-03": 15000, "2027-04": 12000 };
  for (const [month, amount] of Object.entries(want)) {
    const active = grocery(d, month);
    assert.equal(active.length, 1, `exactly one Grocery line active in ${month}`);
    assert.equal(childAmt(active[0], month), amount, month);
  }
});

test("moves later per-month data to the new line, leaves past months", () => {
  const d = dataWithGrocery();
  migrateGroceryPerMonday(d);
  const next = d.items.charlie.expenses[0].children.find((c) => c.perMonday === 3000);
  assert.equal(d.paid["2026-11"].gro, true, "Nov paid mark stays on the old line");
  assert.equal(d.overrides["2027-02"].gro, undefined);
  assert.equal(d.overrides["2027-02"][next.id], 9000);
});

test("is idempotent and a no-op without a Grocery line", () => {
  const d = dataWithGrocery();
  assert.equal(migrateGroceryPerMonday(d), true);
  const snapshot = JSON.stringify(d);
  assert.equal(migrateGroceryPerMonday(d), false);
  assert.equal(JSON.stringify(d), snapshot);

  const empty = makeData();
  assert.equal(migrateGroceryPerMonday(empty), false);
  assert.equal(migrateGroceryPerMonday(null), false);
});

import { migrateRemovePcItems } from "../js/migrations.js";
test("migrateRemovePcItems removes PC lines and their month data, once", () => {
  const d = makeData();
  d.items.charlie.expenses.push({ id: "uniy6tx55", name: "PC", amount: 5000, recurring: true },
    { id: "keep", name: "Rent", amount: 100, recurring: true, children: [{ id: "zfsz971r3", name: "PC Payment", amount: 1 }, { id: "k2", name: "x", amount: 2 }] });
  d.paid["2026-11"] = { uniy6tx55: true, keep: true };
  assert.equal(migrateRemovePcItems(d), true);
  const names = d.items.charlie.expenses.map((e) => e.id);
  assert.ok(!names.includes("uniy6tx55") && names.includes("keep"));
  assert.deepEqual(d.items.charlie.expenses.find((e) => e.id === "keep").children.map((c) => c.id), ["k2"]);
  assert.deepEqual(d.paid["2026-11"], { keep: true });
  assert.equal(migrateRemovePcItems(d), false);
});
