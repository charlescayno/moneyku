// =============================
// "+" button: one add sheet with three tabs (quick spend | new bill | income).
// Quick spend logs an amount (with a note) into a budget item's spending for this month.
// New bill / income reuse the item form (openItemModal with addSheet) and its save.
// =============================
import { $, OWNERS, escapeHtml, generateId, monthShort, peso } from "../utils.js";
import { amountIn, getAppData, getItems, getKids, getSelectedKey, getSimView, getSpendList, includedWho, itemActiveIn, setActiveEdit } from "../state.js";
import { CARD_METHOD } from "../card.js";
import { syncSet } from "../firebase.js";
import { fieldError, toast } from "./core.js";
import { closeModal, openItemModal, openModalShell } from "./modals.js";
import { renderAll } from "./layout.js";

const LAST_ITEM_KEY = "moneyku_qs_item";
const TABS = [["spend", "payments", "Quick spend"], ["bill", "receipt_long", "New bill"], ["income", "savings", "Income"]];

/** Short display name of a person ("Charles'" -> "Charles"). */
export const ownerName = (w) => (OWNERS[w]?.label || "").replace(/'s?$/, "");

/** The tab strip shown on top of every tab of the add sheet. */
export function addTabsHtml(active) {
  const tabs = getSimView() ? TABS.filter(([t]) => t !== "spend") : TABS; // the sandbox has no spending log
  return `<div class="as-tabs" role="tablist">${tabs.map(([t, icon, label]) => `<button type="button" role="tab" aria-selected="${t === active}" data-action="addSheetTab" data-arg0="${t}" class="as-tab${t === active ? " on" : ""}"><span class="material-icons" aria-hidden="true">${icon}</span>${label}</button>`).join("")}</div>`;
}

/** Person the new item defaults to: the only ticked person, else Charles (Simulated has its own list). */
function defaultWho() {
  if (getSimView()) return "simulated";
  const w = includedWho();
  return w.length === 1 ? w[0] : "charlie";
}

export function openAddSheet(tab) {
  const t = tab || (getSimView() ? "bill" : "spend");
  if (t === "spend" && !getSimView()) return openQuickSpend();
  openItemModal(defaultWho(), t === "income" ? "income" : "expenses", undefined, undefined, { addSheet: true });
}
export function addSheetTab(t) { openAddSheet(t); }

/** Expense items this month that can take spending: active, no sub-expenses, not a credit-card charge. */
export function spendTargets(k) {
  const out = [];
  for (const w of includedWho()) {
    for (const it of getItems(w, "expenses")) {
      if (itemActiveIn(it, k) && !getKids(it, k).length && it.paymentMethod !== CARD_METHOD) out.push({ it, w });
    }
  }
  return out;
}

function defaultTarget(list) {
  const extra = list.find(({ it }) => /extra spending/i.test(it.name || ""));
  if (extra) return extra.it.id;
  let last = "";
  try { last = localStorage.getItem(LAST_ITEM_KEY) || ""; } catch { /* ignore */ }
  if (list.some(({ it }) => it.id === last)) return last;
  return list[0]?.it.id || "";
}

const leftOf = (it, k, typed = 0) => amountIn(it, k) - getSpendList(it.id, k).reduce((s, e) => s + (Number(e.amount) || 0), 0) - typed;

function refreshLeft() {
  const k = getSelectedKey();
  const id = $("f-qs-item")?.value;
  const box = $("qs-left");
  if (!box) return;
  const hit = spendTargets(k).find(({ it }) => it.id === id);
  if (!hit) { box.innerHTML = `<p class="as-left-sub">Pick where the money comes from.</p>`; return; }
  const left = leftOf(hit.it, k, parseFloat($("f-qs-amount")?.value) || 0);
  box.classList.toggle("over", left < 0);
  box.innerHTML = `<p class="as-left-amt">${left < 0 ? "-" + peso(-left) : peso(left)}</p>
    <p class="as-left-sub">${left < 0 ? "over" : "left"} in ${escapeHtml(hit.it.name)} for ${escapeHtml(monthShort(k))}</p>`;
}

function openQuickSpend() {
  const k = getSelectedKey();
  setActiveEdit({ kind: "quickspend" });
  $("modal-title").textContent = "Add Expense";
  $("modal-title").className = `text-lg font-black uppercase tracking-tight ${OWNERS[defaultWho()]?.text || "text-white"}`;
  const list = spendTargets(k);
  const sel = defaultTarget(list);
  const multi = includedWho().length > 1;
  const opts = list.map(({ it, w }) => `<option value="${it.id}" ${it.id === sel ? "selected" : ""}>${escapeHtml(it.name)}${multi ? ` (${escapeHtml(ownerName(w))})` : ""}</option>`).join("");
  $("modal-body").innerHTML = `${addTabsHtml("spend")}
    <div class="grid grid-cols-2 gap-2.5">
      <div class="space-y-1"><label class="as-label" for="f-qs-note">What did you spend on?</label>
        <input type="text" id="f-qs-note" class="as-input" placeholder="e.g. grab, lunch, gas" autocomplete="off" /></div>
      <div class="space-y-1"><label class="as-label" for="f-qs-amount">How much? (₱)</label>
        <input type="number" id="f-qs-amount" class="as-input" inputmode="decimal" placeholder="0" /></div>
    </div>
    <div class="space-y-1"><label class="as-label" for="f-qs-item">From budget</label>
      ${list.length ? `<select id="f-qs-item" class="as-input">${opts}</select>` : `<p class="as-left-sub">No expenses this month to log against. Add a bill first.</p>`}</div>
    <div id="qs-left" class="as-left"></div>
    <button type="button" data-action="openReceiptScan" class="w-full py-2.5 rounded-xl bg-white/5 text-slate-200 text-[13px] font-bold flex items-center justify-center gap-2"><span class="material-icons ic-20">document_scanner</span>Scan a receipt instead</button>`;
  $("delete-btn").classList.add("hidden");
  openModalShell();
  $("f-qs-amount")?.addEventListener("input", refreshLeft);
  $("f-qs-item")?.addEventListener("change", refreshLeft);
  refreshLeft();
  setTimeout(() => $("f-qs-note")?.focus(), 50);
}

/** Save for the quick spend tab (called from saveModal). */
export async function saveQuickSpend() {
  const k = getSelectedKey();
  const amount = parseFloat($("f-qs-amount")?.value) || 0;
  const id = $("f-qs-item")?.value || "";
  if (!amount) return fieldError("f-qs-amount", "Amount required");
  if (!id) return fieldError("f-qs-item", "Pick a budget");
  const note = ($("f-qs-note")?.value || "").trim().slice(0, 60);
  const appData = getAppData();
  const cur = getSpendList(id, k);
  cur.push(note ? { id: generateId(), amount, note } : { id: generateId(), amount });
  appData.spend = appData.spend || {};
  appData.spend[k] = appData.spend[k] || {};
  appData.spend[k][id] = cur;
  try { localStorage.setItem(LAST_ITEM_KEY, id); } catch { /* ignore */ }
  await syncSet(appData);
  closeModal();
  renderAll();
  toast(`${peso(amount)} logged${note ? ` · ${note}` : ""}`);
}
