// =============================
// Undo / Redo buttons, History sheet and keyboard shortcuts.
// =============================
import { canRedo, canUndo, configureHistory, getHistory, loadHistory, onHistoryChange, redo, redoLabel, restoreBefore, undo, undoLabel } from "../history.js";
import { syncSet } from "../firebase.js";
import { clampSelected } from "../state.js";
import { escapeHtml } from "../utils.js";
import { toast } from "./core.js";
import { renderAll } from "./layout.js";
import { showSheet } from "./quicklog.js";

const fmtTime = (t) => new Date(t).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function refreshButtons() {
  const u = document.getElementById("undo-btn");
  if (u) {
    u.disabled = !canUndo();
    u.classList.toggle("opacity-40", !canUndo());
    u.title = canUndo() ? `Undo: ${undoLabel()}` : "Nothing to undo";
  }
  const r = document.getElementById("redo-btn");
  if (r) {
    r.disabled = !canRedo();
    r.classList.toggle("hidden", !canRedo());
    r.title = canRedo() ? `Redo: ${redoLabel()}` : "";
  }
  // keep an open history sheet in sync
  if (document.getElementById("hist-list")) renderSheet();
}

function sheetBody() {
  const rows = getHistory().slice(0, 40);
  const list = rows.length
    ? rows.map((e) => `<div class="flex items-start gap-2 px-2.5 py-2 rounded-xl bg-slate-900/50">
        <span class="material-icons ${e.kind === "undo" ? "text-amber-400" : e.kind === "redo" ? "text-sky-400" : "text-indigo-300"} mt-0.5" style="font-size:16px">${e.kind === "undo" ? "undo" : e.kind === "redo" ? "redo" : "edit"}</span>
        <div class="min-w-0 flex-1"><p class="text-xs font-bold text-slate-100 break-words">${escapeHtml(e.label)}</p><p class="text-[10px] font-bold text-slate-500">${fmtTime(e.t)}</p></div>
        ${e.before ? `<button type="button" data-action="histRestore" data-arg0="${e.id}" class="text-[10px] font-bold text-indigo-300 px-2 py-1 rounded-lg bg-indigo-500/10 flex-shrink-0" title="Go back to how it was before this change">Restore</button>` : ""}
      </div>`).join("")
    : `<p class="text-sm text-slate-400 text-center py-4">No changes yet. Edits you make will show up here.</p>`;
  const btn = (action, icon, label, on, sub) => `<button type="button" ${on ? `data-action="${action}"` : "disabled"} class="flex-1 min-w-0 py-2 px-2 rounded-xl ${on ? "bg-indigo-600 text-white" : "bg-slate-700/40 text-slate-500"} text-xs font-bold flex flex-col items-center"><span class="flex items-center gap-1"><span class="material-icons" style="font-size:16px">${icon}</span>${label}</span>${sub ? `<span class="text-[9px] font-semibold opacity-80 truncate max-w-full">${escapeHtml(sub)}</span>` : ""}</button>`;
  return `<div class="flex gap-2">${btn("histUndo", "undo", "Undo", canUndo(), undoLabel())}${btn("histRedo", "redo", "Redo", canRedo(), redoLabel())}</div>
    <p class="text-[10px] font-black uppercase tracking-wider text-slate-500 pt-1">Recent changes</p>
    <div id="hist-list" class="space-y-1.5 max-h-[50vh] overflow-y-auto no-scrollbar">${list}</div>
    <p class="text-[10px] text-slate-500">Restore goes back to how things were before that change. You can undo a restore too.</p>`;
}

function renderSheet() {
  const b = document.getElementById("ql-body");
  if (b) b.innerHTML = sheetBody();
}

export function openHistory() {
  showSheet("History", sheetBody(),
    `<button type="button" data-action="qlClose" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Close</button>`);
}

async function after(e, verb) {
  clampSelected();
  toast(e ? `${verb}: ${e.label}` : `Nothing to ${verb.toLowerCase()}`, e ? "ok" : "error", e && verb === "Undid" ? {
    actionLabel: "Redo", duration: 5000, onAction: () => { histRedo(); },
  } : undefined);
}

export async function histUndo() { after(await undo(), "Undid"); }
export async function histRedo() { after(await redo(), "Redid"); }
export async function histRestore(id) {
  const e = await restoreBefore(id);
  if (e) { clampSelected(); toast(`Restored to before: ${e.label}`, "ok", { actionLabel: "Undo", duration: 6000, onAction: () => { histUndo(); } }); }
}

export function initHistory() {
  configureHistory({ save: (d) => syncSet(d), render: () => renderAll() });
  loadHistory();
  onHistoryChange(refreshButtons);
  refreshButtons();
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (document.querySelector("#modal-overlay.open, #confirm-overlay.open")) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); histUndo(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); histRedo(); }
  });
}
