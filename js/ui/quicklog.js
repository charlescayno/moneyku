// =============================
// Quick Log: free text -> Gemini -> preview -> Confirm -> apply
// =============================
import { $, escapeHtml, monthShort, peso } from "../utils.js";
import { getAppData, getItems, getKids, getSelectedKey, itemActiveIn, amountIn, setAppData } from "../state.js";
import { syncSet } from "../firebase.js";
import { askGemini, GeminiError } from "../gemini.js";
import { addItemData, applyItemAmount, findItemAnywhere, setPaidData } from "../itemOps.js";
import { toast } from "./core.js";
import { renderAll } from "./layout.js";
import { budgetAlertText, budgetBefore } from "../insights.js";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
let pending = null; // { text, rows }
let runId = 0;

const btn = (cls, action, label, extra = "") =>
  `<button type="button" data-action="${action}" ${extra} class="flex-1 py-2.5 text-sm font-bold rounded-xl transition-transform ${cls}">${label}</button>`;
const CANCEL = "text-slate-300 bg-slate-700/60";
const PRIMARY = "text-white bg-indigo-600 shadow-lg shadow-indigo-900/40";

export function showSheet(title, bodyHtml, actionsHtml) {
  $("ql-title").textContent = title;
  $("ql-body").innerHTML = bodyHtml;
  $("ql-actions").innerHTML = actionsHtml;
  const o = $("ql-overlay");
  o.style.opacity = "1";
  o.style.pointerEvents = "auto";
  $("ql-sheet").style.transform = "translateY(0)";
}

export function qlClose() {
  runId++; // abandon any in-flight request
  const o = $("ql-overlay");
  if (!o) return;
  o.style.opacity = "0";
  o.style.pointerEvents = "none";
  $("ql-sheet").style.transform = "";
  pending = null;
}

function showMessage(title, msg, withKey = false) {
  showSheet(
    title,
    `<p class="text-sm text-slate-300 leading-relaxed">${escapeHtml(msg)}</p>`,
    (withKey ? btn(PRIMARY, "qlOpenKey", "Key settings") : "") + btn(CANCEL, "qlClose", "Close")
  );
}

// ---------- key settings ----------
export function qlOpenKey() {
  const has = !!getAppData()?.settings?.geminiKey;
  showSheet(
    "Gemini API key",
    `<p class="text-xs text-slate-400 leading-relaxed mb-2">Get a free key at
       <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-indigo-300 underline">aistudio.google.com/apikey</a>.
       It is saved in your private, synced data so it works on all your devices.</p>
     <input id="ql-key-input" type="password" autocomplete="off" placeholder="${has ? "Paste a new key to replace" : "Paste your key"}"
       class="w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none" />`,
    btn(CANCEL, "qlClose", "Cancel") +
      (has ? btn("text-rose-300 bg-rose-900/40", "qlRemoveKey", "Remove") : "") +
      btn(PRIMARY, "qlSaveKey", "Save key")
  );
  setTimeout(() => $("ql-key-input")?.focus(), 50);
}

export async function qlSaveKey() {
  const key = $("ql-key-input")?.value.trim();
  if (!key) return toast("Paste a key first", "error");
  const d = getAppData();
  d.settings = d.settings || {};
  d.settings.geminiKey = key;
  await syncSet(d);
  toast("Key saved");
  const text = pending?.text;
  qlClose();
  if (text) runQuickLog(text);
}

export async function qlRemoveKey() {
  const d = getAppData();
  if (d.settings) delete d.settings.geminiKey;
  await syncSet(d);
  qlClose();
  toast("Key removed");
}

// ---------- context + validation ----------
function buildContext() {
  const d = getAppData();
  const k = getSelectedKey();
  const items = [];
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      for (const it of getItems(who, kind)) {
        if (!itemActiveIn(it, k)) continue;
        items.push({ id: it.id, name: it.name, amount: amountIn(it, k), kind, who, recurring: !!it.recurring });
      }
    }
  }
  return {
    today: new Date().toISOString().slice(0, 10),
    selectedMonth: k,
    items,
    accounts: (d.accounts || []).map((a) => a.name),
  };
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

function toRow(a, k) {
  const bad = (why) => ({ ok: false, label: why });
  if (a.op === "add_item") {
    const name = String(a.name || "").trim();
    const amount = num(a.amount);
    if (!name || amount == null || amount <= 0) return bad("Could not match: missing name or amount");
    if (a.kind !== "income" && a.kind !== "expenses") return bad(`Could not match: "${name}" is not income or expense`);
    const month = MONTH_RE.test(a.month || "") ? a.month : k;
    const recurring = a.recurring === true;
    const dueDay = Number.isInteger(a.dueDay) && a.dueDay >= 1 && a.dueDay <= 31 ? a.dueDay : null;
    const who = a.who === "debt" ? "debt" : "charlie";
    return {
      ok: true, icon: a.kind === "income" ? "south_west" : "north_east", tone: a.kind === "income" ? "text-emerald-400" : "text-rose-400",
      label: `Add ${a.kind === "income" ? "income" : "expense"}: ${name} ${peso(amount)}`,
      sub: `${monthShort(month)} · ${recurring ? "monthly" : "one-time"}${who === "debt" ? " · debt tracker" : ""}`,
      apply: (d) => addItemData(d, { who, kind: a.kind, name, amount, start: month, recurring, dueDay }),
    };
  }
  if (a.op === "edit_item" || a.op === "mark_paid") {
    const found = findItemAnywhere(getAppData(), a.id);
    if (!found) return bad(`Could not match an item for "${a.name || a.id || "?"}"`);
    const { item } = found;
    if (a.op === "mark_paid") {
      const month = MONTH_RE.test(a.month || "") ? a.month : k;
      const paid = a.paid !== false;
      return {
        ok: true, icon: "task_alt", tone: "text-emerald-400",
        label: `Mark ${item.name} ${paid ? "paid" : "unpaid"}`, sub: monthShort(month),
        apply: (d) => setPaidData(d, item.id, month, paid),
      };
    }
    const newName = a.name && String(a.name).trim() && a.name !== item.name ? String(a.name).trim() : null;
    const amount = num(a.amount);
    if (a.amount != null && amount == null) return bad(`Could not match: amount for ${item.name} isn't a number`);
    const hasKids = getKids(item).length > 0;
    const newAmount = amount != null && amount >= 0 && !hasKids ? amount : null;
    const dueDay = Number.isInteger(a.dueDay) && a.dueDay >= 1 && a.dueDay <= 31 ? a.dueDay : null;
    const scope = ["month", "future", "all"].includes(a.scope) ? a.scope : "all";
    if (newName == null && newAmount == null && dueDay == null) return bad(`Nothing to change for ${item.name}`);
    const parts = [];
    if (newAmount != null) parts.push(`${peso(amountIn(item, k))} → ${peso(newAmount)}`);
    if (newName) parts.push(`rename to ${newName}`);
    if (dueDay != null) parts.push(`due day ${dueDay}`);
    return {
      ok: true, icon: "edit", tone: "text-indigo-300",
      label: `Edit ${item.name}: ${parts.join(", ")}`,
      sub: newAmount != null && item.recurring ? { month: `${monthShort(k)} only`, future: "this & future months", all: "all months" }[scope] : "",
      apply: (d) => {
        const f = findItemAnywhere(d, item.id);
        if (!f) return;
        if (newName) f.item.name = newName;
        if (dueDay != null) f.item.dueDay = dueDay;
        if (newAmount != null) applyItemAmount(d, f.list, f.item, newAmount, scope, k);
      },
    };
  }
  return bad("Could not match: unsupported action");
}

// ---------- run / confirm ----------
function showLoading() {
  showSheet(
    "Quick log",
    `<div class="flex items-center gap-3 py-3 text-sm text-slate-300"><span class="material-icons text-indigo-400 animate-spin" style="font-size:18px">autorenew</span>Reading your message…</div>`,
    btn(CANCEL, "qlClose", "Cancel")
  );
}

export async function runQuickLog(text) {
  const key = getAppData()?.settings?.geminiKey;
  pending = { text, rows: [] };
  if (!key) return qlOpenKey();
  const my = ++runId;
  showLoading();
  let res;
  try {
    res = await askGemini(text, buildContext(), key);
  } catch (e) {
    if (my !== runId) return;
    const keyIssue = e instanceof GeminiError && e.code === "bad_key";
    return showMessage("Quick log", e.message || "Something went wrong.", keyIssue);
  }
  if (my !== runId) return;
  const k = getSelectedKey();
  const rows = res.actions.map((a) => toRow(a, k));
  if (!rows.length) return showMessage("Quick log", res.message || "I couldn't find anything to log in that message.");
  pending = { text, rows };
  const body = rows
    .map((r) =>
      r.ok
        ? `<div class="flex items-start gap-2.5 bg-slate-900/60 rounded-xl px-3 py-2">
             <span class="material-icons ${r.tone}" style="font-size:18px;margin-top:1px">${r.icon}</span>
             <div class="min-w-0"><div class="text-sm font-bold text-white break-words">${escapeHtml(r.label)}</div>
             ${r.sub ? `<div class="text-[11px] text-slate-400">${escapeHtml(r.sub)}</div>` : ""}</div></div>`
        : `<div class="flex items-start gap-2.5 bg-amber-900/20 border border-amber-500/20 rounded-xl px-3 py-2">
             <span class="material-icons text-amber-400" style="font-size:18px;margin-top:1px">help_outline</span>
             <div class="text-xs text-amber-200">${escapeHtml(r.label)} (skipped)</div></div>`
    )
    .join("");
  const anyOk = rows.some((r) => r.ok);
  showSheet(
    "Confirm changes",
    body,
    btn(CANCEL, "qlClose", "Cancel") + (anyOk ? btn(PRIMARY, "qlConfirm", "Confirm") : "")
  );
}

export async function qlConfirm() {
  if (!pending) return;
  const rows = pending.rows.filter((r) => r.ok);
  const d = getAppData();
  const snapshot = JSON.parse(JSON.stringify(d));
  const bb = budgetBefore();
  rows.forEach((r) => r.apply(d));
  const input = $("ql-input");
  if (input) input.value = "";
  qlClose();
  await syncSet(d);
  renderAll();
  const warn = budgetAlertText(bb);
  toast(`Applied ${rows.length} change${rows.length === 1 ? "" : "s"}${warn ? " · " + warn : ""}`, warn ? "error" : "ok", {
    actionLabel: "Undo",
    duration: 6000,
    onAction: async () => {
      setAppData(snapshot);
      await syncSet(snapshot);
      renderAll();
      toast("Undone");
    },
  });
}

export function initQuickLog() {
  const form = $("ql-form");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("ql-input").value.trim();
    if (text) runQuickLog(text);
  });
  $("ql-overlay").addEventListener("click", (e) => { if (e.target === $("ql-overlay")) qlClose(); });
}
