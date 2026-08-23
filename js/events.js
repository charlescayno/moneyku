// =============================
// Gestures & Event Delegation
// =============================

import {
  timeline,
  getSelectedKey,
  getActiveView,
} from "./state.js";
import { selectMonth, unlockApp } from "./ui.js";

// Touch state
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isPulling = false;

export function initGestures() {
  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    isPulling = window.scrollY === 0;
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
    handleSwipe();
    
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

function handleSwipe() {
  const diffX = touchStartX - touchEndX;
  const diffY = touchStartY - touchEndY;
  
  // Need primarily horizontal movement
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
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
    
    if (action === 'openItemModal') e.preventDefault();
    
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
    if (action === 'unlockApp') args.unshift(e);
    
    if (typeof window[action] === 'function') {
      window[action](...args);
    }
  });

  // Enter key for lock password
  document.addEventListener("DOMContentLoaded", () => {
    const pwdInput = document.getElementById("lock-password");
    if (pwdInput) {
      pwdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") unlockApp();
      });
    }
  });
}
