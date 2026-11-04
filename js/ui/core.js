

import { $ } from '../utils.js';

// =============================
// Toast & Notifications
// =============================
let toastTimer = null;
// opts: { actionLabel, onAction, duration } - optional action button (e.g. Undo)
export function toast(msg, type = "ok", opts = {}) {
  const t = $("toast");
  if (!t) return;
  $("toast-text").textContent = msg;
  const icon = $("toast-icon");
  icon.textContent = type === "error" ? "error" : "check_circle";
  icon.className = `material-icons text-lg ${type === "error" ? "text-rose-400" : "text-emerald-400"}`;

  const actionBtn = $("toast-action");
  if (actionBtn) {
    if (opts.actionLabel && typeof opts.onAction === "function") {
      actionBtn.textContent = opts.actionLabel;
      actionBtn.classList.remove("hidden");
      actionBtn.onclick = () => {
        actionBtn.onclick = null;
        t.classList.remove("show");
        clearTimeout(toastTimer);
        opts.onAction();
      };
    } else {
      actionBtn.classList.add("hidden");
      actionBtn.onclick = null;
    }
  }

  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), opts.duration || 2000);
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

let particlesStarted = false;
export function initParticles() {
  const app = $("app");
  if (!app || particlesStarted) return;
  particlesStarted = true;
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
let lockHideTimer = null;

function setAuthMode(mode) {
  // mode: "signin" | "denied"
  const signinBtn = $("google-signin-btn");
  const denied = $("auth-denied");
  const icon = $("auth-icon");
  const title = $("auth-title");
  const sub = $("auth-sub");
  if (mode === "denied") {
    if (signinBtn) signinBtn.classList.add("hidden");
    if (denied) denied.classList.remove("hidden");
    if (icon) icon.textContent = "gpp_bad";
    if (title) title.textContent = "Access not granted";
    if (sub) sub.textContent = "You're signed in, but this account isn't allowed to open the database yet.";
  } else {
    if (signinBtn) signinBtn.classList.remove("hidden");
    if (denied) denied.classList.add("hidden");
    if (icon) icon.textContent = "lock";
    if (title) title.textContent = "Vault Locked";
    if (sub) sub.textContent = "Sign in with Google to view your dashboard";
  }
}

function showLockScreen() {
  const lock = $("lock-screen");
  const app = $("app");
  clearTimeout(lockHideTimer);
  if (app) app.style.opacity = "0";
  if (lock) {
    lock.classList.remove("hidden");
    lock.classList.add("flex");
    lock.style.opacity = "1";
    lock.style.pointerEvents = "auto";
  }
}

/** Show the Google sign-in screen (signed out). */
export function showSignIn() {
  setAuthMode("signin");
  setSignInBusy(false);
  showLockScreen();
}

/** Show the "signed in but not allowed by the rules" screen with the account details to whitelist. */
export function showAccessDenied(user) {
  setAuthMode("denied");
  const email = $("auth-email");
  const uid = $("auth-uid");
  if (email) email.textContent = (user && user.email) || "(no email)";
  if (uid) uid.textContent = (user && user.uid) || "";
  showLockScreen();
}

export function setAuthError(msg) {
  const el = $("auth-error");
  if (el) el.textContent = msg || "";
}

export function setSignInBusy(busy) {
  const btn = $("google-signin-btn");
  if (!btn) return;
  btn.disabled = !!busy;
  btn.classList.toggle("opacity-60", !!busy);
  const label = $("google-signin-label");
  if (label) label.textContent = busy ? "Signing in..." : "Sign in with Google";
}

/** Signed in and data ready: fade out the lock screen and show the app. */
export function enterApp() {
  const lock = $("lock-screen");
  const app = $("app");
  if (lock && !lock.classList.contains("hidden")) {
    lock.style.opacity = "0";
    lock.style.pointerEvents = "none";
    clearTimeout(lockHideTimer);
    lockHideTimer = setTimeout(() => { lock.classList.remove("flex"); lock.classList.add("hidden"); }, 700);
  }
  setAuthError("");
  if (app) app.style.opacity = "1";
  initParticles();
}

/** Copy the signed-in account's email + UID (for pasting into the Firebase rules). */
export async function copyAuthInfo() {
  const email = ($("auth-email") || {}).textContent || "";
  const uid = ($("auth-uid") || {}).textContent || "";
  const text = `email: ${email}\nuid: ${uid}`;
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch (e) {
    toast("Select and copy manually", "error");
  }
}

/** Fade out the intro splash. */
export function revealApp() {
  const intro = $("intro-screen");
  if (intro) {
    intro.style.opacity = "0";
    intro.style.pointerEvents = "none";
    setTimeout(() => { intro.style.display = "none"; }, 700);
  }
  try { sessionStorage.setItem("moneyku_intro_seen", "1"); } catch (e) { /* ignore */ }
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
sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
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