import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../js/ui/components.js", import.meta.url), "utf8");
const isLow = new Function(src.match(/const LOW_LEFT[\s\S]*?remaining < 200\);/)[0] + "; return isLow;")();
test("amber when 20% or less of the estimate is left", () => {
  assert.equal(isLow(1000, 920), false);
  assert.equal(isLow(1000, 200), true);
  assert.equal(isLow(1000, 201), false);
  assert.equal(isLow(5000, 900), true);
  assert.equal(isLow(0, 150), true);
  assert.equal(isLow(0, 500), false);
});
