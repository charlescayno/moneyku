// =============================
// "Change which months?" prompt for recurring income / expenses.
// Resolves to "month" | "future" | "all", or null when cancelled.
// =============================
import { escapeHtml } from "./utils.js";

let open = false;

/**
 * @param {string} label       what is being changed (item name)
 * @param {object} o
 * @param {string} o.monthLabel   e.g. "Nov 2026"
 * @param {boolean} o.canFuture   false when "this and future" would be the same as "all"
 * @param {string} [o.detail]     e.g. "₱1,000 → ₱1,200"
 */
export function chooseScope(label, { monthLabel, canFuture = true, detail = "" } = {}) {
  if (open) return Promise.resolve(null);
  open = true;
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.id = "scope-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Apply change to");
    el.className = "fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-4";
    const opt = (scope, title, sub) => `<button type="button" data-scope="${scope}" class="w-full text-left p-3 rounded-xl border border-slate-700 bg-slate-900/60 active:border-indigo-400">
      <span class="block text-sm font-bold text-white">${title}</span>
      <span class="block text-[11px] font-bold text-slate-400 mt-0.5">${sub}</span></button>`;
    el.innerHTML = `<div class="bg-slate-800 w-full max-w-sm rounded-2xl p-5 border border-white/5 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
      <div>
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">This repeats every month. Apply the change to:</p>
        <p class="text-base font-black text-white mt-1 truncate">${escapeHtml(label)}</p>
        ${detail ? `<p class="text-sm font-black text-indigo-300">${escapeHtml(detail)}</p>` : ""}
      </div>
      <div class="space-y-2">
        ${opt("month", "This month only", `${escapeHtml(monthLabel)} only, other months stay as they are`)}
        ${canFuture ? opt("future", "This and future months", `From ${escapeHtml(monthLabel)} onward, earlier months stay as they are`) : ""}
        ${opt("all", "All occurrences", "Every month, past and future")}
      </div>
      <button type="button" data-cancel class="w-full py-2 text-xs font-bold text-slate-500">Cancel</button>
    </div>`;
    const finish = (v) => {
      document.removeEventListener("keydown", onKey, true);
      el.remove();
      open = false;
      resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); finish(null); } };
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-cancel]")) return finish(null);
      const b = e.target.closest("[data-scope]");
      if (b) finish(b.dataset.scope);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(el);
    el.querySelector("[data-scope]")?.focus();
  });
}
