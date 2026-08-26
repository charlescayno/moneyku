

import { $ } from '../utils.js';

// =============================
// Toast & Notifications
// =============================
let toastTimer = null;
export function toast(msg, type = "ok") {
  const t = $("toast");
  if (!t) return;
  $("toast-text").textContent = msg;
  const icon = $("toast-icon");
  icon.textContent = type === "error" ? "error" : "check_circle";
  icon.className = `material-icons text-lg ${type === "error" ? "text-rose-400" : "text-emerald-400"}`;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}

// =============================
// DOM Morphing & Updates
// =============================
export function updateDOM(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.morphdom) {
    const wrapper = el.cloneNode(false);
    wrapper.innerHTML = html;
    window.morphdom(el, wrapper, {
      onBeforeNodeDiscarded: function (node) {
        if (node.classList && node.classList.contains("item-card")) {
          const rect = node.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            node.classList.add("animate-out");
            setTimeout(() => {
              if (node.parentNode) node.parentNode.removeChild(node);
            }, 200);
            return false;
          }
        }
        return true;
      },
      onNodeAdded: function (node) {
        if (node.classList && node.classList.contains("item-card")) {
          node.classList.add("animate-in");
        }
        return node;
      },
    });
  } else {
    el.innerHTML = html;
  }
}

// =============================
// Particle Effects & Celebration
// =============================
export function celebrate() {
  const canvas = $("money-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.opacity = "1";
  const emojis = ["💸", "💵", "🪙"];
  const bills = Array.from({ length: 18 }, () => ({
    x: Math.random() * canvas.width,
    y: -40 - Math.random() * 200,
    vy: 3 + Math.random() * 4,
    vx: (Math.random() - 0.5) * 2,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
    e: emojis[Math.floor(Math.random() * emojis.length)],
    size: 24 + Math.random() * 16,
  }));
  let frames = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bills.forEach((b) => {
      b.y += b.vy; b.x += b.vx; b.rot += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.font = `${b.size}px serif`;
      ctx.textAlign = "center";
      ctx.fillText(b.e, 0, 0);
      ctx.restore();
    });
    frames++;
    if (frames < 90) requestAnimationFrame(draw);
    else { canvas.style.opacity = "0"; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  draw();
}

export function initParticles() {
  const app = $("app");
  if (!app) return;
  const colors = ["#6366f1", "#8b5cf6", "#3b82f6", "#f43f5e"];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement("div");
    p.className = "bg-particle";
    const size = 3 + Math.random() * 4;
    p.style.cssText = `width:${size}px;height:${size}px;left:${5 + Math.random() * 90}%;bottom:-10px;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${12 + Math.random() * 18}s;animation-delay:${Math.random() * 10}s;`;
    app.appendChild(p);
  }
}

// =============================
// Lock Screen & App Reveal
// =============================
export function unlockApp() {
  const pwd = $("lock-password").value.toLowerCase();
  if (pwd === "lokomoko") {
    const lock = $("lock-screen");
    const app = $("app");
    lock.style.opacity = "0";
    lock.style.pointerEvents = "none";
    setTimeout(() => { lock.classList.remove("flex"); lock.classList.add("hidden"); }, 700);
    app.style.opacity = "1";
    initParticles();
  } else {
    const err = $("lock-error");
    err.style.opacity = "1";
    setTimeout(() => { err.style.opacity = "0"; }, 2000);
  }
}

export function toggleLockPassword() {
  const input = $("lock-password");
  const icon = $("lock-toggle-icon");
  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "visibility_off";
  } else {
    input.type = "password";
    icon.textContent = "visibility";
  }
}

export function revealApp() {
  const intro = $("intro-screen");
  if (intro) {
    intro.style.opacity = "0";
    intro.style.pointerEvents = "none";
    setTimeout(() => { intro.style.display = "none"; }, 700);
  }
  
  const lock = $("lock-screen");
  if (lock) {
    lock.classList.remove("hidden");
    lock.classList.add("flex");
  }
}

export function runIntro() {
  const tag = $("intro-tag");
  setTimeout(() => { if (tag) tag.style.opacity = "1"; }, 1150);
}

// Network Status Listeners
window.addEventListener('online', () => {
  const ind = document.getElementById('offline-indicator');
  if(ind) ind.classList.add('hidden');
});
window.addEventListener('offline', () => {
  const ind = document.getElementById('offline-indicator');
  if(ind) ind.classList.remove('hidden');
});
// Check initial state
if (!navigator.onLine) {
  const ind = document.getElementById('offline-indicator');
  if(ind) ind.classList.remove('hidden');
}

// Add Sortable JS dynamically for drag and drop
const sortableScript = document.createElement('script');
sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js';
sortableScript.onload = () => {
    // Make main sections sortable
    const pContainer = document.getElementById('budget-body');
    if(pContainer && window.Sortable) {
        new Sortable(pContainer, {
            animation: 150,
            handle: 'summary',
            ghostClass: 'bg-slate-800/50'
        });
    }
};
document.head.appendChild(sortableScript);