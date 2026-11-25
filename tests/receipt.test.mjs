import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeReceipt, matchTarget, findDuplicate, buildSpendEntry } from "../js/receiptlogic.js";

const ctx = { today: "2026-11-24", months: ["2026-10", "2026-11", "2026-12"] };

test("a good reading is cleaned up", () => {
  const r = normalizeReceipt({ merchant: "  Jollibee   Ortigas ", date: "2026-11-20", total: 320.456, category: "food", confidence: 0.9 }, ctx);
  assert.equal(r.merchant, "Jollibee Ortigas");
  assert.equal(r.total, 320.46);
  assert.equal(r.month, "2026-11");
  assert.equal(r.category, "food");
  assert.equal(r.notReceipt, false);
  assert.equal(r.lowConfidence, false);
});

test("bad or missing values become null instead of guesses", () => {
  const r = normalizeReceipt({ merchant: "Shop", date: "20/11/2026", total: -5, category: "weird" }, ctx);
  assert.equal(r.total, null);
  assert.equal(r.date, null);
  assert.equal(r.category, null);
  assert.equal(normalizeReceipt({ merchant: "Shop", total: "120" }, ctx).total, null);
});

test("future dates are dropped; dates outside the timeline are flagged", () => {
  assert.equal(normalizeReceipt({ merchant: "A", total: 1, date: "2026-12-30" }, ctx).date, null);
  const old = normalizeReceipt({ merchant: "A", total: 1, date: "2025-01-05" }, ctx);
  assert.equal(old.month, null);
  assert.equal(old.outOfRange, true);
});

test("not a receipt, and low confidence", () => {
  assert.equal(normalizeReceipt({ merchant: null, total: null }, ctx).notReceipt, true);
  assert.equal(normalizeReceipt(null, ctx).notReceipt, true);
  assert.equal(normalizeReceipt({ merchant: "A", total: 1, confidence: 0.3 }, ctx).lowConfidence, true);
});

const targets = [
  { id: "t1", name: "Rent", category: "bills" },
  { id: "t2", name: "Eating Out", category: "food" },
  { id: "t3", name: "Gas", category: "transport" },
  { id: "t4", name: "Extra spending", category: "other" },
];

test("matching: name, then category, then Extra spending, then a new expense", () => {
  assert.equal(matchTarget({ merchant: "Gas Station", category: null }, targets), "t3");
  assert.equal(matchTarget({ merchant: "Jollibee", category: "food" }, targets), "t2");
  assert.equal(matchTarget({ merchant: "Random Shop", category: "shopping" }, targets), "t4");
  assert.equal(matchTarget({ merchant: "Random Shop", category: "shopping" }, targets.slice(0, 3)), "");
  assert.equal(matchTarget({ merchant: "", category: null }, []), "");
});

test("duplicates need the same amount, date and note", () => {
  const list = [{ id: "a", amount: 320.46, date: "2026-11-20", note: "Jollibee" }];
  assert.equal(findDuplicate(list, 320.46, "2026-11-20", " jollibee "), true);
  assert.equal(findDuplicate(list, 320.46, "2026-11-21", "Jollibee"), false);
  assert.equal(findDuplicate(list, 100, "2026-11-20", "Jollibee"), false);
});

test("spend entries use the same shape as the Add spending form", () => {
  assert.deepEqual(buildSpendEntry({ id: "x", amount: 50, date: "2026-11-20", note: "Gas", acct: "a1" }), { id: "x", amount: 50, acct: "a1", ded: true, date: "2026-11-20", note: "Gas" });
  assert.deepEqual(buildSpendEntry({ id: "x", amount: 50, date: "", note: "", acct: "" }), { id: "x", amount: 50 });
});
