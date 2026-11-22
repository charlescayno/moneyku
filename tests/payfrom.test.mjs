import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";
import { setAppData, reconcileAutoPaid } from "../js/state.js";
import { currentKey } from "../js/utils.js";
import { addItemData, setPaidData } from "../js/itemOps.js";
import { choosePayment, applyPayment, refundPayment, autoDeduct } from "../js/payfrom.js";

const K = currentKey();

function setup(paymentMethod = "gcash", extra = {}) {
  const d = makeData({ accounts: [{ id: "g", name: "Gcash", amount: 1000 }, { id: "m", name: "MARIBANK", amount: 5000 }] });
  const item = addItemData(d, { kind: "expenses", name: "Internet", amount: 300, start: "2026-01", recurring: true, paymentMethod, ...extra });
  setAppData(d);
  return { d, item, gcash: d.accounts[0], mari: d.accounts[1] };
}

test("adding a GCash expense does not touch the account until it is paid", () => {
  const { gcash } = setup();
  assert.equal(gcash.amount, 1000);
});

test("checking off a GCash expense subtracts it from the GCash account and unchecking gives it back", async () => {
  const { d, item, gcash, mari } = setup();
  const plan = await choosePayment(K, [item.id], item.name);
  d.paid[K] = { [item.id]: true };
  applyPayment(K, plan);
  assert.equal(gcash.amount, 700);
  assert.equal(mari.amount, 5000);
  refundPayment(K, item.id);
  assert.equal(gcash.amount, 1000);
});

test("a Maribank expense is charged to Maribank, not GCash", () => {
  const { item, gcash, mari } = setup("maribank");
  autoDeduct(K, item.id);
  assert.equal(mari.amount, 4700);
  assert.equal(gcash.amount, 1000);
});

test("auto-complete on the due day charges the GCash account once", () => {
  const { d, item, gcash } = setup("gcash", { dueDay: 1 });
  assert.equal(reconcileAutoPaid(autoDeduct), true);
  assert.equal(d.paid[K][item.id], true);
  assert.equal(gcash.amount, 700);
  reconcileAutoPaid(autoDeduct);
  assert.equal(gcash.amount, 700, "running it again must not charge twice");
  refundPayment(K, item.id);
  assert.equal(gcash.amount, 1000);
});

test("auto-complete leaves a cash expense's accounts alone", () => {
  const { d, item, gcash, mari } = setup("cash", { dueDay: 1 });
  reconcileAutoPaid(autoDeduct);
  assert.equal(d.paid[K][item.id], true);
  assert.equal(gcash.amount, 1000);
  assert.equal(mari.amount, 5000);
});

test("setPaidData alone never moves money (callers charge the account first)", () => {
  const { d, item, gcash } = setup();
  setPaidData(d, item.id, K, true);
  assert.equal(gcash.amount, 1000);
});

test("a Security Bank expense is charged to the Security Bank account", () => {
  const d = makeData({ accounts: [{ id: "g", name: "Gcash", amount: 1000 }, { id: "s", name: "Security Bank", amount: 8000 }] });
  const item = addItemData(d, { kind: "expenses", name: "Rent", amount: 2500, start: "2026-01", recurring: true, paymentMethod: "securitybank" });
  setAppData(d);
  autoDeduct(K, item.id);
  assert.equal(d.accounts[1].amount, 5500);
  assert.equal(d.accounts[0].amount, 1000);
});
