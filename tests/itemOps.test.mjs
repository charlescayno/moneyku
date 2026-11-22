import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";
import { applyItemAmount, addItemData, findItemAnywhere, startFreshAt } from "../js/itemOps.js";

const rec = (extra = {}) => ({ id: "a", name: "Gym", amount: 1000, recurring: true, start: "2026-08", ...extra });

test("applyItemAmount 'month' stores an override and leaves the item alone", () => {
  const d = makeData();
  const it = rec();
  applyItemAmount(d, [it], it, 1500, "month", "2026-11");
  assert.equal(it.amount, 1000);
  assert.equal(d.overrides["2026-11"].a, 1500);
});

test("applyItemAmount 'future' ends the old item and clones it with the new amount", () => {
  const d = makeData({ paid: { "2026-12": { a: true } } });
  const it = rec();
  const list = [it];
  applyItemAmount(d, list, it, 1500, "future", "2026-12");

  assert.equal(list.length, 2);
  assert.equal(it.end, "2026-11");
  const clone = list[1];
  assert.equal(clone.start, "2026-12");
  assert.equal(clone.amount, 1500);
  assert.notEqual(clone.id, it.id);
  assert.equal(d.paid["2026-12"][clone.id], true, "paid marks from the cutover month move to the clone");
  assert.equal(d.paid["2026-12"].a, undefined);
});

test("applyItemAmount 'all' replaces the amount and clears a perMonday rule", () => {
  const d = makeData({ overrides: { "2026-12": { a: 1 } } });
  const it = rec({ perMonday: 3000 });
  applyItemAmount(d, [it], it, 7000, "all", "2026-12");
  assert.equal(it.amount, 7000);
  assert.equal(it.perMonday, undefined);
  assert.equal(d.overrides["2026-12"].a, undefined);
});

test("applyItemAmount 'future' clone drops the perMonday rate", () => {
  const d = makeData();
  const it = rec({ perMonday: 3000 });
  const list = [it];
  applyItemAmount(d, list, it, 8000, "future", "2027-01");
  assert.equal(list[1].perMonday, undefined);
  assert.equal(list[1].amount, 8000);
});

test("addItemData and findItemAnywhere", () => {
  const d = makeData();
  const item = addItemData(d, { who: "charlie", kind: "expenses", name: "Tithes", amount: 5770, start: "2026-08" });
  assert.equal(d.items.charlie.expenses.length, 1);
  const found = findItemAnywhere(d, item.id);
  assert.equal(found.item, item);
  assert.equal(found.who, "charlie");
  assert.equal(findItemAnywhere(d, "nope"), null);
});

test("startFreshAt removes items that ended before the start month", () => {
  const d = makeData();
  d.items.charlie.expenses.push(
    rec({ id: "old", end: "2026-09" }),
    rec({ id: "keep" }),
    { id: "once", name: "x", amount: 1, recurring: false, start: "2026-08" }
  );
  const res = startFreshAt(d, "2026-11");
  assert.deepEqual(d.items.charlie.expenses.map((i) => i.id), ["keep"]);
  assert.equal(res.items, 2);
  assert.equal(d.startMonth, "2026-11");
});

test("applyItemAmount 'future' in the item's first month changes the item itself (nothing earlier to keep)", () => {
  const d = makeData();
  const it = rec({ start: "2026-11" });
  const list = [it];
  applyItemAmount(d, list, it, 1500, "future", "2026-11");
  assert.equal(list.length, 1);
  assert.equal(it.amount, 1500);
  assert.equal(it.end, undefined);
});
