// Tiny safe calculator for amount fields: numbers, + - * / x × ÷ and parentheses (no eval).
const clean = (s) => String(s ?? "").replace(/[₱,\s]/g, "").replace(/[x×]/gi, "*").replace(/÷/g, "/");

export function evalMath(input) {
  const s = clean(input);
  if (!s) return null;
  let i = 0;
  const peek = () => s[i];
  function number() {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
    if (!m) throw new Error("num");
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function factor() {
    if (peek() === "-") { i++; return -factor(); }
    if (peek() === "+") { i++; return factor(); }
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") throw new Error("paren");
      i++;
      return v;
    }
    return number();
  }
  function term() {
    let v = factor();
    for (;;) {
      if (peek() === "*") { i++; v *= factor(); }
      else if (peek() === "/") { i++; const d = factor(); if (d === 0) throw new Error("div"); v /= d; }
      else if (peek() === "(") v *= factor();
      else return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      if (peek() === "+") { i++; v += term(); }
      else if (peek() === "-") { i++; v -= term(); }
      else return v;
    }
  }
  try {
    const v = expr();
    if (i !== s.length || !Number.isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch { return null; }
}

/** Value of an amount field: plain number or an expression like (120+80)*2. */
export const amountValue = (el) => evalMath(el?.value) ?? 0;

const isExpr = (v) => /[+\-*/x×÷()]/i.test(String(v).replace(/^\s*-/, ""));

/** Turn a number input into a calculator field with a live "= result" line. */
export function enableCalc(input, anchor) {
  if (!input || input.dataset.calcOn) return;
  input.dataset.calcOn = "1";
  input.type = "text";
  input.setAttribute("inputmode", "text");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("enterkeyhint", "done");
  const hint = document.createElement("p");
  hint.className = "calc-hint hidden";
  (anchor || input).insertAdjacentElement("afterend", hint);
  const update = () => {
    if (!isExpr(input.value)) { hint.classList.add("hidden"); return; }
    const v = evalMath(input.value);
    hint.classList.remove("hidden");
    hint.classList.toggle("bad", v == null);
    hint.textContent = v == null ? "Can't read that yet" : `= ₱${v.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  };
  input.addEventListener("input", update);
  input.addEventListener("blur", () => {
    const v = evalMath(input.value);
    if (v != null && isExpr(input.value)) { input.value = String(v); input.dispatchEvent(new Event("input")); }
  });
  update();
}

if (typeof document !== "undefined") {
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el?.matches?.("input[data-calc]")) enableCalc(el, el.id === "f-spend-amount" ? el.parentElement : null);
  });
}
