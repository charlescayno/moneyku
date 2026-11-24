// =============================
// Bottom tab bar: Home / Bills / Accounts / Overview
// Home shows everything. Bills and Accounts show only their own part of the page.
// =============================
import { $ } from "./utils.js";

let view = "home";

function setActive(name) {
  document.querySelectorAll("#tabbar [data-tab]").forEach((b) => {
    if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

export function tabGo(name) {
  if (name === "overview") { if (typeof window.openMore === "function") window.openMore(); return; }
  view = name === "bills" || name === "accounts" ? name : "home";
  document.body.dataset.view = view;
  if (view === "accounts") document.querySelectorAll("#acct-block details[data-persist]").forEach((d) => { d.open = true; });
  setActive(view);
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function currentTab() { return view; }

export function initTabs() {
  const bar = $("tabbar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";
  document.body.dataset.view = view;
  setActive(view);
}
