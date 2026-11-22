import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";
import { setAppData } from "../js/state.js";
import { currentKey, addMonths } from "../js/utils.js";
import { runwayFacts } from "../js/ui/runway.js";

const sim = (cash, income, expenses) => {
  const d = makeData();
  d.simCash = cash;
  const mk = (id, amount) => ({ id, name: id, amount, recurring: true, start: currentKey(), dueDay: 28 });
  d.items.simulated = { income: income.map((a, i) => mk("i" + i, a)), expenses: expenses.map((a, i) => mk("e" + i, a)) };
  setAppData(d);
};

test("runway: empty sandbox is flagged", () => {
  sim(0, [], []);
  assert.equal(runwayFacts(12).empty, true);
});

test("runway: money that never runs out has no negative month", () => {
  sim(50000, [20000], [10000]);
  const f = runwayFacts(12);
  assert.equal(f.firstNeg, -1);
  assert.equal(f.months.length, 12);
  assert.equal(f.months[0], currentKey());
});

test("runway: finds the first month the balance goes negative", () => {
  sim(30000, [], [10000]);
  const f = runwayFacts(12);
  assert.equal(f.firstNeg, 3, "30k at 10k per month is short in the 4th month");
  assert.equal(f.months[f.firstNeg], addMonths(currentKey(), 3));
  assert.equal(f.lowI, 11, "balance keeps falling, so the last month is the lowest");
});
