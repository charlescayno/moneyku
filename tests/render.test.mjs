import "./setup.mjs";
import "./stub-cdn.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeData } from "./setup.mjs";

// Tiny DOM stub: any element is a permissive object; innerHTML is captured so we can inspect output.
const els = new Map();
const stub = (id) => {
  if (!els.has(id)) {
    const el = new Proxy({ id, innerHTML: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }, {
      get: (t, p) => (p in t ? t[p] : typeof p === "string" ? () => null : undefined),
      set: (t, p, v) => ((t[p] = v), true),
    });
    els.set(id, el);
  }
  return els.get(id);
};
globalThis.addEventListener = () => {}; globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.document = { getElementById: stub, querySelector: () => null, querySelectorAll: () => [], createElement: () => stub("tmp"), body: stub("body"), addEventListener() {} };

test("renderBudget draws the Projected block without throwing, with and without hidden numbers", async () => {
  const { setAppData, setSelectedKey, setHideProjected } = await import("../js/state.js");
  const { currentKey } = await import("../js/utils.js");
  const { renderBudget } = await import("../js/ui/layout.js");
  const d = makeData({
    accounts: [{ id: "a", name: "BDO", amount: 1000 }, { id: "b", name: "GCash", amount: 400, owner: "partner" }],
  });
  d.items.charlie.income = [{ id: "i1", name: "Salary", amount: 50000, recurring: true, start: "2026-08" }];
  d.items.charlie.expenses = [{ id: "e1", name: "Rent", amount: 20000, recurring: true, start: "2026-08" }];
  d.items.partner = { income: [{ id: "p1", name: "Pay", amount: 30000, recurring: true, start: "2026-08" }], expenses: [] };
  d.items.pdebt = { income: [], expenses: [] };
  setAppData(d);
  setSelectedKey(currentKey());
  for (const hide of [false, true]) {
    setHideProjected(hide);
    renderBudget();
    const html = stub("budget-body").innerHTML;
    assert.ok(html.includes("sum-projected"), "headline rendered");
    assert.ok(html.includes("How is this made up?"), "details rendered");
    assert.ok(html.includes(hide ? "Cash &amp; pending hidden" : "to receive"));
  }
});

test("outlook card renders chart, tappable months and collapsed extra insights", async () => {
  const { yearOutlookCardHtml } = await import("../js/ui/components.js");
  for (const who of ["all", "charlie", "partner"]) {
    localStorage.setItem("moneyku_outlook_who", who);
    const html = yearOutlookCardHtml();
    assert.ok(html.includes("<svg"), who + " chart");
    assert.ok(html.includes('data-action="openOutlookMonth"'), who + " tappable months");
    assert.ok(html.includes("more insight"), who + " extra insights collapsed");
  }
});

test("next-5-months card scrolls forward and back", async () => {
  const { next5CardHtml, next5Shift, next5Reset } = await import("../js/ui/next5.js");
  const { setHideProjected } = await import("../js/state.js");
  setHideProjected(false);
  const first = next5CardHtml();
  assert.ok(first.includes("Next 5 months"));
  next5Shift(1); // no live card element in the stub, so the offset change is what we check next
  const later = next5CardHtml();
  assert.ok(!later.includes("Next 5 months") && later.includes("Earlier months"));
  next5Reset();
  assert.ok(next5CardHtml().includes("Next 5 months"));
});
