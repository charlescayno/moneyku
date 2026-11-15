// =============================
// Edge swipe: change month
// A horizontal swipe that STARTS in the outer strip of the screen changes the month.
//   from the left edge,  finger moves right -> previous month
//   from the right edge, finger moves left  -> next month
// A swipe that starts anywhere else (e.g. on an item row) is never handled here, so the
// row swipe (right = paid, left = edit) is untouched.
// =============================
import { timeline, getSelectedKey, getAppData } from "./state.js";
import { selectMonth } from "./ui/index.js";

export const EDGE_ZONE = 24;     // px from the left/right edge of the viewport where an edge swipe may start
const MIN_DX = 60;               // px of horizontal travel needed to change month
const RATIO = 1.5;               // |dx| must exceed |dy| by this factor
const LOCK_DX = 10;              // px before the gesture is classified as horizontal or vertical
const QUICK_MS = 700;            // slower than this needs CLEAR_DX of travel
const CLEAR_DX = 110;
const HINT_MAX = 56;             // px the edge indicator follows the finger

const BLOCK_TARGETS = "input, textarea, select, [contenteditable='true'], #ql-form, [data-drag-handle]";
const OVERLAYS = "#modal-overlay.open, #confirm-overlay.open, #calendar-overlay.open, #more-overlay.open, #month-picker.open, [role='dialog'][aria-modal='true']";

let bound = false;

function blocked(target) {
  if (target?.closest?.(BLOCK_TARGETS)) return true;
  if (document.querySelector(OVERLAYS)) return true;
  const ql = document.getElementById("ql-overlay");
  if (ql && ql.style.pointerEvents === "auto") return true;
  if (document.querySelector(".arr-dragging")) return true;
  const app = document.getElementById("app");
  if (!app || getComputedStyle(app).opacity === "0") return true;
  return false;
}

function neighbour(dir) {
  const tl = timeline();
  const i = tl.indexOf(getSelectedKey());
  if (i === -1) return null;
  return tl[i + dir] || null;
}

function ensureStrips() {
  ["l", "r"].forEach((side) => {
    if (document.getElementById(`edge-strip-${side}`)) return;
    const s = document.createElement("div");
    s.id = `edge-strip-${side}`;
    s.className = `edge-strip edge-strip-${side}`;
    s.setAttribute("aria-hidden", "true");
    document.body.appendChild(s);
  });
}

function hintEl() {
  let el = document.getElementById("edge-hint");
  if (!el) {
    el = document.createElement("div");
    el.id = "edge-hint";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="material-icons">chevron_left</span>';
    document.body.appendChild(el);
  }
  return el;
}

function showHint(side, dx, ready, available) {
  const el = hintEl();
  const p = Math.min(Math.abs(dx) / MIN_DX, 1);
  const off = Math.min(Math.abs(dx) * 0.6, HINT_MAX);
  el.dataset.side = side;
  el.classList.toggle("ready", ready && available);
  el.classList.toggle("unavailable", !available);
  el.firstChild.textContent = side === "l" ? "chevron_left" : "chevron_right";
  el.style.opacity = String((available ? 0.25 : 0.12) + p * (available ? 0.75 : 0.3));
  el.style.transform = `translate(${side === "l" ? off - HINT_MAX : HINT_MAX - off}px, -50%)`;
  el.classList.add("show");
}

function hideHint() {
  const el = document.getElementById("edge-hint");
  if (el) { el.classList.remove("show"); el.style.opacity = ""; }
}

function slideTo(dir) {
  const root = document.documentElement;
  root.dataset.monthDir = dir > 0 ? "next" : "prev";
  setTimeout(() => { delete root.dataset.monthDir; }, 500);
}

export function initEdgeSwipe() {
  if (bound) return;
  bound = true;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!hasTouch) return;
  ensureStrips();

  let g = null; // { id, side, x, y, t, mode: null | 'h' | 'v' }

  const cancel = () => { g = null; hideHint(); };

  document.addEventListener("touchstart", (e) => {
    cancel();
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const w = window.innerWidth;
    const side = t.clientX <= EDGE_ZONE ? "l" : t.clientX >= w - EDGE_ZONE ? "r" : null;
    if (!side || blocked(e.target)) return;
    g = { id: t.identifier, side, x: t.clientX, y: t.clientY, t: e.timeStamp, mode: null };
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!g) return;
    if (e.touches.length !== 1) return cancel();
    const t = [...e.touches].find((p) => p.identifier === g.id);
    if (!t) return cancel();
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < LOCK_DX && Math.abs(dy) < LOCK_DX) return;
      if (Math.abs(dx) > Math.abs(dy) * RATIO) g.mode = "h"; else return cancel();
    }
    // A horizontal edge swipe is clear now: keep the browser from also treating it as a scroll/back gesture
    if (e.cancelable) e.preventDefault();
    const dir = g.side === "l" ? 1 : -1;       // finger direction that goes somewhere
    const inward = dx * dir > 0;
    const target = neighbour(g.side === "l" ? -1 : 1);
    if (inward) showHint(g.side, dx, Math.abs(dx) >= MIN_DX, !!target); else hideHint();
  }, { passive: false });

  document.addEventListener("touchend", (e) => {
    if (!g) return;
    const gesture = g;
    cancel();
    if (gesture.mode !== "h") return;
    const t = [...e.changedTouches].find((p) => p.identifier === gesture.id);
    if (!t) return;
    const dx = t.clientX - gesture.x, dy = t.clientY - gesture.y;
    const ms = e.timeStamp - gesture.t;
    const inward = gesture.side === "l" ? dx > 0 : dx < 0;
    if (!inward || Math.abs(dx) < MIN_DX || Math.abs(dx) <= Math.abs(dy) * RATIO) return;
    if (ms > QUICK_MS && Math.abs(dx) < CLEAR_DX) return;
    if (blocked(null) || !getAppData()) return;
    const key = neighbour(gesture.side === "l" ? -1 : 1);
    if (!key) return;
    if (navigator.vibrate) navigator.vibrate(8);
    slideTo(gesture.side === "l" ? -1 : 1);
    selectMonth(key);
  }, { passive: true });

  document.addEventListener("touchcancel", cancel, { passive: true });
}
