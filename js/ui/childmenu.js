// =============================
// "⋯" menu for a sub-expense row: Edit / Reorder / Delete in one place
// =============================
import { getItems, getKids, getSelectedKey, isArranging, setActiveEdit } from "../state.js";
import { showSheet, qlClose } from "./quicklog.js";
import { openChildModal, confirmDelete } from "./modals.js";
import { toggleArrange } from "./actions.js";

const opt = (action, icon, label, a0, a1, a2, cls = "text-slate-200") =>
  `<button type="button" data-action="${action}" data-arg0="${a0}" data-arg1="${a1}" data-arg2="${a2 ?? ""}" class="w-full flex items-center gap-3 px-4 text-sm font-bold rounded-xl bg-slate-800/60 ${cls}" style="min-height:48px"><span class="material-icons" style="font-size:20px">${icon}</span>${label}</button>`;

export function openChildMenu(who, parentId, childId) {
  const parent = getItems(who, "expenses").find((x) => x.id === parentId);
  const c = parent ? getKids(parent).find((x) => x.id === childId) : null;
  if (!c) return;
  const kids = getKids(parent);
  const body = `<div class="flex flex-col gap-2">
    ${opt("childMenuEdit", "edit", "Edit", who, parentId, childId)}
    ${kids.length > 1 && !isArranging(parentId) ? opt("childMenuReorder", "drag_handle", "Reorder", who, parentId, childId) : ""}
    ${opt("childMenuDelete", "delete_outline", "Delete", who, parentId, childId, "text-rose-400")}
  </div>`;
  showSheet(c.name, body, `<button type="button" data-action="qlClose" class="flex-1 py-2.5 text-sm font-bold rounded-xl text-slate-300 bg-slate-700/60">Cancel</button>`);
}

export function childMenuEdit(who, parentId, childId) { qlClose(); openChildModal(who, parentId, childId); }

export function childMenuReorder(who, parentId) { qlClose(); toggleArrange(parentId); }

export function childMenuDelete(who, parentId, childId) {
  qlClose();
  setActiveEdit({ kind: "child", who, parentId, id: childId });
  confirmDelete();
}
