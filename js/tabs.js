// =============================
// Bottom tab bar: Home / Bills / Accounts / Overview
// =============================
import { $ } from "./utils.js";

const first = (...ids) => ids.map((id) => $(id)).find(Boolean) || null;
const billsEl = () => first("sec-budget", "sec-partner");
const accountsEl = () => first("sec-accounts", "sec-accounts-partner");

// Height of the sticky header + month bar (measured by size, since they only sit at the top once scrolled)
const stickyBottom = () => (document.querySelector("header.app-header")?.offsetHeight || 0) + ($("month-nav")?.offsetHeight || 0);

function setActive(name) {
  document.querySelectorAll("#tabbar [data-tab]").forEach((b) => {
    if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

function scrollToSection(el, name) {
  if (!el) return;
  const d = el.querySelector("details[data-persist]");
  if (d && !d.open) d.open = true;
  const y = el.getBoundingClientRect().top + window.scrollY - stickyBottom() - 8;
  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  setActive(name);
}

export function tabGo(name) {
  if (name === "overview") { if (typeof window.openMore === "function") window.openMore(); return; }
  if (name === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); setActive("home"); return; }
  scrollToSection(name === "accounts" ? accountsEl() : billsEl(), name);
}

/** Which tab matches the scroll position: the last section whose top has passed the sticky bars. */
export function currentTab() {
  if (window.scrollY < 80) return "home";
  const line = stickyBottom() + 40;
  let cur = "home", best = -Infinity;
  for (const [name, el] of [["accounts", accountsEl()], ["bills", billsEl()]]) {
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top <= line && top > best) { best = top; cur = name; }
  }
  return cur;
}

export function initTabs() {
  const bar = $("tabbar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";
  let ticking = false;
  const update = () => { ticking = false; setActive(currentTab()); };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  setActive("home");
}
