import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BRAND_LOGOS, brandIconFor, bankIconFor, categoryIcon, ACCOUNT_PAYMENT_METHODS } from "../js/utils.js";
import { iconSpec, ICON_CHOICES } from "../js/icons.js";

test("every logo in BRAND_LOGOS exists as a file", () => {
  for (const key of BRAND_LOGOS) assert.ok(fs.existsSync(new URL(`../assets/brands/${key}.png`, import.meta.url)), key);
});

test("every brand / bank the app can detect either has a logo or falls back cleanly", () => {
  for (const n of ["Netflix", "Petron Pasig", "Shell Presam Ortigas", "Grab", "Apple.com/Bill", "Google One", "SM Supermarket East", "TikTok Shop", "Jollibee"]) {
    const key = brandIconFor(n) || bankIconFor(n);
    assert.ok(key && BRAND_LOGOS.has(key), `${n} -> ${key}`);
  }
  assert.equal(brandIconFor("Sukiya SM East"), null, "a restaurant inside SM is not the SM brand");
});

test("icon order: your pick, then logo, then name keyword, then category", () => {
  assert.deepEqual(iconSpec({ name: "Netflix", icon: "flight" }, "Netflix").icon, "flight");
  assert.equal(iconSpec({ name: "Netflix" }, "Netflix").logo, "netflix");
  assert.equal(iconSpec({ name: "Meralco" }, "Meralco").icon, "bolt");
  assert.equal(iconSpec({ name: "Gym membership" }, "Gym membership").icon, "fitness_center");
  const other = iconSpec({ name: "Random thing" }, "Random thing");
  assert.equal(other.icon, "receipt_long");
  assert.equal(iconSpec({ name: "Bonus" }, "Bonus", "income").icon, "south_west");
  assert.equal(iconSpec(null, "Salary", "income").icon, "payments");
});

test("an unknown custom icon name is ignored", () => {
  assert.notEqual(iconSpec({ name: "Meralco", icon: "not_a_real_icon" }, "Meralco").icon, "not_a_real_icon");
  assert.ok(ICON_CHOICES.includes("flight"));
});

test("payment methods use logos / Material icons, never emoji", () => {
  for (const m of ACCOUNT_PAYMENT_METHODS) { assert.ok(m.logo || m.mi); assert.equal(m.icon, undefined); assert.ok(!BRAND_LOGOS.has(m.logo) === false || !m.logo); }
});

test("categoryIcon no longer matches inside other words", () => {
  assert.equal(categoryIcon("Category review"), null);
  assert.equal(categoryIcon("Media subscription"), "subscriptions");
});
