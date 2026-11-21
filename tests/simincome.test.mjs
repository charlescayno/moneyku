import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";
import { setAppData, simIncomeEntered, setSimIncomeScale, getSimIncomeScale } from "../js/state.js";

test("simulated income slider works in pesos: entered total, scale from an amount", () => {
  const d = makeData();
  d.items.simulated = { income: [{ id: "i1", name: "Salary", amount: 40000, recurring: true, start: "2026-08" }, { id: "i2", name: "Side", amount: 10000, recurring: true, start: "2026-08" }], expenses: [] };
  setAppData(d);
  assert.equal(simIncomeEntered("2026-09"), 50000);
  setSimIncomeScale((45000 / 50000) * 100);
  assert.equal(getSimIncomeScale(), 90);
  setSimIncomeScale(1000000);
  assert.equal(getSimIncomeScale(), 150, "clamped to 150% of entered");
  setSimIncomeScale(100);
});
