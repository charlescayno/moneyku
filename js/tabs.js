// =============================
// Bottom tab bar (mobile): Home / Accounts / Calendar / Overview
// =============================
import { $ } from "./utils.js";

function setActive(name) {
  document.querySelectorAll("#tabbar [data-tab]").forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("text-indigo-300", on);
    b.classList.toggle("text-slate-500", !on);
  });
}

export function tabGo(name) {
  if (name === "overview") { if (typeof window.openMore === "function") window.openMore(); return; }
  if (name === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); setActive("home"); return; }
  const el = $(name === "accounts" ? "sec-accounts" : "sec-calendar");
  if (!el) return;
  const d = el.querySelector("details[data-persist]");
  if (d && !d.open) d.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  setActive(name);
}

export function initTabs() {
  const bar = $("tabbar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";
  let ticking = false;
  const update = () => {
    ticking = false;
    const top = (id) => { const e = $(id); return e ? e.getBoundingClientRect().top : Infinity; };
    let cur = "home";
    if (window.scrollY > 80) {
      if (top("sec-calendar") <= 140) cur = "calendar";
      else if (top("sec-accounts") <= 140 && top("sec-budget") > 140) cur = "accounts";
    }
    setActive(cur);
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  setActive("home");
}
