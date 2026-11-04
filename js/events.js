// =============================
// Gestures & Event Delegation
// =============================

import {
  timeline,
  getSelectedKey,
  getActiveView,
} from "./state.js";
import { selectMonth } from "./ui/index.js";

// Touch state
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isPulling = false;
let startedInStrip = false;

// True when the touch begins inside something that scrolls sideways (e.g. the accounts cards)
function inHorizontalScroller(el) {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

// Swipe an item row: right = mark paid, left = edit
let startedOnRow = false;
function initRowSwipe() {
  let row = null, sx = 0, sy = 0, dx = 0, active = false;
  const reset = () => { if (!row) return; row.style.transition = 'transform .18s ease, background .18s ease'; row.style.transform = ''; row.style.background = ''; const r = row; setTimeout(() => { r.style.transition = ''; }, 220); };
  document.addEventListener('touchstart', (e) => {
    row = e.target.closest?.('.item-row[data-action="openItemModal"], .item-row[data-action="openChildModal"]') || null;
    startedOnRow = !!row; active = false; dx = 0;
    if (!row) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!row) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (!active) { if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) active = true; else return; }
    dx = Math.max(-90, Math.min(90, mx));
    row.style.transition = 'none';
    row.style.transform = `translateX(${dx}px)`;
    row.style.background = dx > 0 ? 'rgba(16,185,129,.2)' : 'rgba(99,102,241,.2)';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!row) return;
    const r = row, fired = active && Math.abs(dx) >= 70, dir = dx;
    reset();
    if (fired) {
      if (navigator.vibrate) navigator.vibrate(12);
      if (dir > 0) r.querySelector('button[data-action="togglePaidQuick"]')?.click();
      else r.click();
    }
    row = null; setTimeout(() => { startedOnRow = false; }, 0);
  }, { passive: true });
  document.addEventListener('touchcancel', () => { reset(); row = null; startedOnRow = false; }, { passive: true });
}

export function initGestures() {
  initRowSwipe();
  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    // Pull-to-refresh only when the page is at the very top, nothing is open on top of it,
    // and the touch isn't on the month strip
    const overlayOpen = !!document.querySelector('#modal-overlay.open, #confirm-overlay.open, #calendar-overlay.open, #more-overlay.open, #month-picker.open');
    startedInStrip = !!e.target.closest?.('#month-strip') || !!e.target.closest?.('.snap-x') || inHorizontalScroller(e.target);
    isPulling = window.scrollY <= 0 && !overlayOpen && !startedInStrip;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!isPulling) return;
    const currentY = e.changedTouches[0].screenY;
    const diffY = currentY - touchStartY;
    
    if (diffY > 0) {
      const ptr = document.getElementById('ptr-indicator');
      const icon = document.getElementById('ptr-icon');
      if (ptr && icon) {
        const pullDist = Math.min(diffY * 0.4, 80);
        ptr.style.transition = 'none';
        ptr.style.transform = `translateY(${pullDist}px)`;
        icon.style.transform = `rotate(${Math.min(diffY * 2, 180)}deg)`;
        
        if (pullDist >= 60) {
          icon.classList.add('text-emerald-400');
          icon.classList.remove('text-slate-400');
        } else {
          icon.classList.add('text-slate-400');
          icon.classList.remove('text-emerald-400');
        }
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    // Swipe-to-change-month removed (use the month strip, header or calendar arrows)
    
    if (isPulling) {
      const diffY = touchEndY - touchStartY;
      const pullDist = Math.min(diffY * 0.4, 80);
      const ptr = document.getElementById('ptr-indicator');
      const icon = document.getElementById('ptr-icon');
      
      if (ptr && icon) {
        ptr.style.transition = 'transform 0.3s ease-out';
        if (pullDist >= 60) {
          icon.classList.add('animate-spin');
          ptr.style.transform = 'translateY(16px)';
          setTimeout(() => {
            location.reload(true);
          }, 500);
        } else {
          ptr.style.transform = 'translateY(-100%)';
        }
      }
      isPulling = false;
    }
  }, { passive: true });
}

// Kept for reference; no longer called.
// eslint-disable-next-line no-unused-vars
function handleSwipe() {
  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - touchEndY;
  
  // Need primarily horizontal movement
  if (Math.abs(diffX) > Math.abs(diffY) * 1.5 && Math.abs(diffX) > 60 && !startedInStrip && !startedOnRow) {
    const modalShell = document.getElementById('modal-overlay');
    const confirmModal = document.getElementById('confirm-overlay');
    const calendarModal = document.getElementById('calendar-overlay');
    if (modalShell && modalShell.classList.contains('open')) return;
    if (confirmModal && confirmModal.classList.contains('open')) return;
    if (calendarModal && calendarModal.classList.contains('open')) return;
    
    // Check if month picker is open
    const mp = document.getElementById('month-picker');
    if (mp && mp.classList.contains('open')) return;

    // Only apply in budget view
    if (getActiveView() !== 'budget') return;

    const tl = timeline();
    const currentIdx = tl.indexOf(getSelectedKey());
    if (currentIdx === -1) return;

    if (diffX > 0) {
      // Swiped left -> Next Month
      if (currentIdx < tl.length - 1) selectMonth(tl[currentIdx + 1]);
    } else {
      // Swiped right -> Previous Month
      if (currentIdx > 0) selectMonth(tl[currentIdx - 1]);
    }
  }
}

export function initEventListeners() {
  // Global click delegation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    
    if (action === 'openItemModal' || action === 'openBudgetModal') e.preventDefault();
    
    const args = [];
    let i = 0;
    while (btn.hasAttribute('data-arg' + i)) {
      args.push(btn.getAttribute('data-arg' + i));
      i++;
    }
    
    // Specific event arguments
    if (action === 'togglePaidQuick') args.unshift(e);
    if (action === 'togglePaidGroup') args.unshift(e);
    if (action === 'pickOwner') args.unshift(btn);
    if (action === 'toggleField') args.unshift(btn);
    if (action === 'jumpOverviewYear') args.unshift(btn);
    
    if (typeof window[action] === 'function') {
      window[action](...args);
    }
  });

  // Global change delegation
  document.addEventListener('change', (e) => {
    const target = e.target;
    if (!target.hasAttribute('data-action')) return;
    const action = target.getAttribute('data-action');
    
    if (action === 'jumpOverviewYear') {
      if (typeof window[action] === 'function') window[action](target);
    } else if (action === 'updateBpiCcMonth') {
      if (typeof window[action] === 'function') window[action]();
    }
  });

  // Global submit delegation
  document.addEventListener('submit', (e) => {
    const target = e.target;
    if (!target.hasAttribute('data-action')) return;
    e.preventDefault();
    const action = target.getAttribute('data-action');
    
    const args = [];
    let i = 0;
    while (target.hasAttribute('data-arg' + i)) {
      args.push(target.getAttribute('data-arg' + i));
      i++;
    }
    
    if (action === 'saveModal') args.unshift(e);
    
    if (typeof window[action] === 'function') {
      window[action](...args);
    }
  });

  // Auto-refresh market rates when switching back to tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (typeof window.fetchInvestmentRates === "function") {
        window.fetchInvestmentRates(false);
      }
    }
  });
  window.addEventListener("focus", () => {
    if (typeof window.fetchInvestmentRates === "function") {
      window.fetchInvestmentRates(false);
    }
  });
}
