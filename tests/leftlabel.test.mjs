import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../js/ui/components.js", import.meta.url), "utf8");
const fn = new Function("peso", src.match(/function leftLabel[\s\S]*?\n}\n/)[0] + "; return leftLabel;")((n) => "₱" + n);
test("spending line shows a percentage", () => {
  assert.equal(fn(1000, 920), "92% left");
  assert.equal(fn(1000, 1000), "100% left");
  assert.equal(fn(1000, 999.9), "99% left");
  assert.equal(fn(1000, 0), "0% left");
  assert.equal(fn(1000, -120), "over 12%");
  assert.equal(fn(0, 50), "₱50 left");
});
