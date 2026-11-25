import { test } from "node:test";
import assert from "node:assert/strict";
import { evalMath } from "../js/calc.js";

test("plain numbers and operators", () => {
  assert.equal(evalMath("120"), 120);
  assert.equal(evalMath("120+80"), 200);
  assert.equal(evalMath("1,200 - 50.5"), 1149.5);
  assert.equal(evalMath("₱300 x 2"), 600);
  assert.equal(evalMath("100÷3"), 33.33);
});
test("precedence and parentheses", () => {
  assert.equal(evalMath("2+3*4"), 14);
  assert.equal(evalMath("(2+3)*4"), 20);
  assert.equal(evalMath("(120+80)*2-50"), 350);
  assert.equal(evalMath("2(3+4)"), 14);
  assert.equal(evalMath("-5+10"), 5);
});
test("bad input gives null", () => {
  for (const s of ["", "abc", "2+", "(2+3", "2+3)", "5/0", "2++", "alert(1)"]) assert.equal(evalMath(s), null, s);
});
