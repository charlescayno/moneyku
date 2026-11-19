import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";
import { mondaysInMonth } from "../js/utils.js";
import { setAppData, amountIn, childAmt, itemActiveIn, itemTotal, monthTotals, householdTotals, accountsTotal } from "../js/state.js";

test("mondaysInMonth counts 4 or 5 Mondays", () => {
  assert.equal(mondaysInMonth("2026-12"), 4);
  assert.equal(mondaysInMonth("2027-01"), 4);
  assert.equal(mondaysInMonth("2027-03"), 5);
  assert.equal(mondaysInMonth("2027-05"), 5);
  assert.equal(mondaysInMonth("2028-02"), 4); // leap year
});

test("childAmt: plain amount, perMonday rate, and month override", () => {
  const d = makeData({ overrides: { "2027-03": { g: 9000 } } });
  setAppData(d);
  assert.equal(childAmt({ id: "x", amount: 500 }, "2026-12"), 500);

  const grocery = { id: "g", perMonday: 3000, amount: 1 };
  assert.equal(childAmt(grocery, "2026-12"), 12000);
  assert.equal(childAmt(grocery, "2027-05"), 15000);
  assert.equal(childAmt(grocery, "2027-03"), 9000, "a month override beats the per-Monday rate");
});

test("amountIn uses the override for that month only", () => {
  const it = { id: "a", amount: 100, recurring: true, start: "2026-08" };
  setAppData(makeData({ overrides: { "2026-10": { a: 250 } } }));
  assert.equal(amountIn(it, "2026-09"), 100);
  assert.equal(amountIn(it, "2026-10"), 250);
});

test("itemActiveIn: recurring range, one-time, and 'deleted this month'", () => {
  setAppData(makeData({ deleted: { "2026-10": { r: true } } }));
  const rec = { id: "r", recurring: true, start: "2026-09", end: "2026-12" };
  assert.equal(itemActiveIn(rec, "2026-08"), false);
  assert.equal(itemActiveIn(rec, "2026-09"), true);
  assert.equal(itemActiveIn(rec, "2026-10"), false, "deleted for that month");
  assert.equal(itemActiveIn(rec, "2026-12"), true);
  assert.equal(itemActiveIn(rec, "2027-01"), false);

  const once = { id: "o", recurring: false, start: "2026-11" };
  assert.equal(itemActiveIn(once, "2026-11"), true);
  assert.equal(itemActiveIn(once, "2026-12"), false);
});

test("itemTotal sums sub-expenses that are active that month", () => {
  const family = {
    id: "f", name: "Family", amount: 0, recurring: true, start: "2026-09",
    children: [
      { id: "c1", name: "Rice", amount: 1500 },
      { id: "c2", name: "Grocery", amount: 15000, end: "2026-11" },
      { id: "c3", name: "Grocery", perMonday: 3000, start: "2026-12" },
    ],
  };
  setAppData(makeData());
  assert.equal(itemTotal(family, "2026-11"), 16500);
  assert.equal(itemTotal(family, "2026-12"), 1500 + 12000);
  assert.equal(itemTotal(family, "2027-03"), 1500 + 15000);
});

test("monthTotals adds income and expenses for the month", () => {
  const d = makeData();
  d.items.charlie.income.push({ id: "i", name: "Salary", amount: 50000, recurring: true, start: "2026-08" });
  d.items.charlie.expenses.push({ id: "e", name: "Rent", amount: 12000, recurring: true, start: "2026-08" });
  setAppData(d);
  const t = monthTotals("2026-09");
  assert.equal(t.income, 50000);
  assert.equal(t.expenses, 12000);
  assert.equal(t.savings, 38000);
});

test("partner items stay out of Charles' totals; household combines both", () => {
  const d = makeData();
  d.items.charlie.income.push({ id: "i", name: "Salary", amount: 50000, recurring: true, start: "2026-08" });
  d.items.charlie.expenses.push({ id: "e", name: "Rent", amount: 12000, recurring: true, start: "2026-08" });
  d.accounts = [{ id: "a1", name: "BPI", amount: 1000 }, { id: "a2", name: "GCash", amount: 400, owner: "partner" }, { id: "a3", name: "Card", amount: 99, owner: "partner", type: "credit" }];
  d.items.partner = { income: [{ id: "pi", name: "Pay", amount: 30000, recurring: true, start: "2026-08" }], expenses: [{ id: "pe", name: "Bills", amount: 5000, recurring: true, start: "2026-08" }] };
  setAppData(d);
  const t = monthTotals("2026-09");
  assert.equal(t.income, 50000);
  assert.equal(t.expenses, 12000);
  assert.equal(t.savings, 38000);
  assert.equal(t.pI, 30000);
  assert.equal(t.pE, 5000);
  const h = householdTotals("2026-09");
  assert.equal(h.income, 80000);
  assert.equal(h.expenses, 17000);
  assert.equal(h.net, 63000);
  assert.equal(h.partnerNet, 25000);
  assert.equal(accountsTotal(), 1000);
  assert.equal(accountsTotal("partner"), 400);
  assert.equal(h.cash, 1400);
  assert.equal(h.charlie.net + h.partner.net, h.net);
  assert.equal(h.charlie.income + h.partner.income, h.income);
});

import { stepKey, yearStepKey } from "../js/utils.js";
test("stepKey clamps and steps", () => {
  const tl = ["2026-10", "2026-11", "2026-12", "2027-01"];
  assert.equal(stepKey(tl, "2026-11", 1), "2026-12");
  assert.equal(stepKey(tl, "2026-12", 1), "2027-01");
  assert.equal(stepKey(tl, "2027-01", 1), "2027-01");
  assert.equal(stepKey(tl, "2026-10", -1), "2026-10");
  assert.equal(stepKey(tl, "2026-12", -2), "2026-10");
});
test("yearStepKey keeps month, clamps at ends", () => {
  const tl = ["2026-10", "2026-11", "2027-10", "2027-12"];
  assert.equal(yearStepKey(tl, "2026-10", 1), "2027-10");
  assert.equal(yearStepKey(tl, "2027-10", -1), "2026-10");
  assert.equal(yearStepKey(tl, "2026-11", 1), "2027-12");
  assert.equal(yearStepKey(tl, "2027-10", 1), "2027-12");
});
