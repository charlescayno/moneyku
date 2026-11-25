// =============================
// Receipt scan: photo -> Gemini vision -> editable suggestion -> Confirm -> spending entry or new one-time expense
// The photo is only sent to Gemini to be read; it is never stored.
// =============================
import { $, escapeHtml, generateId, monthShort, peso } from "./utils.js";
import { getAppData, getSelectedKey, getSpendList, includedWho, setAppData, timeline } from "./state.js";
import { askGeminiReceipt, GeminiError } from "./gemini.js";
import { syncSet } from "./firebase.js";
import { addItemData, setPaidData } from "./itemOps.js";
import { payableAccounts, recordPayment } from "./payfrom.js";
import { categoryOf } from "./categories.js";
import { toast } from "./ui/core.js";
import { renderAll } from "./ui/layout.js";
import { spendTargets, openAddSheet } from "./ui/addsheet.js";
import { bumpRun, currentRun, qlClose, qlOpenKey, showSheet } from "./ui/quicklog.js";
import { budgetAlertText, budgetBefore } from "./insights.js";
import { buildSpendEntry, findDuplicate, matchTarget, normalizeReceipt } from "./receiptlogic.js";

const MAX_SIDE = 1280;
const NEW_EXPENSE = "__new";
const LAST_ITEM_KEY = "moneyku_qs_item";
let wantScan = false;
let rec = null; // the receipt being confirmed

const btn = (cls, action, label, extra = "") => `<button type="button" data-action="${action}" ${extra} class="flex-1 py-2.5 text-sm font-bold rounded-xl transition-transform ${cls}">${label}</button>`;
const CANCEL = "text-slate-300 bg-slate-700/60";
const PRIMARY = "text-white bg-indigo-600 shadow-lg shadow-indigo-900/40";

const todayIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };

/** Called after the API key was saved while a scan was waiting for it. */
export function resumeReceiptScan() {
  if (!wantScan) return false;
  wantScan = false;
  openReceiptScan();
  return true;
}
if (typeof window !== "undefined") window.resumeReceiptScan = resumeReceiptScan;

export function openReceiptScan() {
  if (!getAppData()?.settings?.geminiKey) { wantScan = true; return qlOpenKey(); }
  const row = (act, icon, label, sub) => `<button type="button" data-action="receiptPick" data-arg0="${act}" class="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-900/50 text-left"><span class="material-icons text-slate-300" style="font-size:22px">${icon}</span><span class="flex-1 min-w-0"><span class="block text-sm font-bold text-slate-100">${label}</span><span class="block text-[11px] text-slate-400">${sub}</span></span></button>`;
  showSheet("Scan a receipt",
    `<div class="space-y-1.5">${row("camera", "photo_camera", "Take a photo", "Lay the receipt flat, in good light")}${row("gallery", "photo_library", "Choose from gallery", "A photo or a screenshot of an e-receipt")}</div>
     <p class="text-[11px] text-slate-400 mt-3 leading-snug">The photo is sent to Google (Gemini) to be read. It is not saved in the app.</p>`,
    btn(CANCEL, "qlClose", "Cancel"));
}

export function receiptPick(mode) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  if (mode === "camera") input.setAttribute("capture", "environment");
  input.style.display = "none";
  input.onchange = () => { const f = input.files?.[0]; input.remove(); if (f) handleFile(f); };
  document.body.appendChild(input);
  input.click();
}

/** Downscale to MAX_SIDE and re-encode as JPEG: small upload, fast on mobile data. */
export async function shrinkImage(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch {
    bmp = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return { base64: c.toDataURL("image/jpeg", 0.8).split(",")[1], mime: "image/jpeg" };
}

function message(title, msg, extraActions = "") {
  showSheet(title, `<p class="text-sm text-slate-300 leading-relaxed">${escapeHtml(msg)}</p>`, extraActions + btn(CANCEL, "qlClose", "Close"));
}

async function handleFile(file) {
  const key = getAppData()?.settings?.geminiKey;
  if (!key) { wantScan = true; return qlOpenKey(); }
  const my = bumpRun();
  showSheet("Scan a receipt",
    `<div class="flex items-center gap-3 py-3 text-sm text-slate-300"><span class="material-icons text-indigo-400 animate-spin" style="font-size:18px">autorenew</span>Reading your receipt…</div>`,
    btn(CANCEL, "qlClose", "Cancel"));
  let raw;
  try {
    const img = await shrinkImage(file);
    if (my !== currentRun()) return;
    raw = await askGeminiReceipt(img.base64, img.mime, { today: todayIso() }, key);
  } catch (e) {
    if (my !== currentRun()) return;
    if (e instanceof GeminiError) {
      const keyIssue = e.code === "bad_key";
      return message("Scan a receipt", e.message, keyIssue ? btn(PRIMARY, "qlOpenKey", "Key settings") : btn(PRIMARY, "rcManual", "Enter manually"));
    }
    return message("Scan a receipt", "Couldn't open that photo. Try another one.", btn(PRIMARY, "rcManual", "Enter manually"));
  }
  if (my !== currentRun()) return;
  const n = normalizeReceipt(raw, { today: todayIso(), months: timeline() });
  if (n.notReceipt) return message("Scan a receipt", "That doesn't look like a receipt, or it is too blurry to read.", btn(PRIMARY, "rcManual", "Enter manually"));
  showConfirm(n);
}

export function rcManual() { qlClose(); setTimeout(() => openAddSheet("spend"), 120); }

const pickAcct = (owner, want) => { const l = payableAccounts(owner); return l.some((a) => a.id === want) ? want : (l[0]?.id || ""); };
const acctOptions = (owner, pick) => `<option value="">No account</option>` + payableAccounts(owner).map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === pick ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("");
const ownerOf = (w) => (w === "partner" || w === "pdebt" ? "partner" : "charlie");

function showConfirm(n) {
  const sel = getSelectedKey();
  const month = n.month || sel;
  const targets = spendTargets(month).map(({ it, w }) => ({ id: it.id, name: it.name, category: categoryOf(it), w }));
  const suggested = matchTarget(n, targets);
  rec = { n, month, targets };
  const date = n.date || (todayIso().startsWith(sel + "-") ? todayIso() : "");
  const opts = targets.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === suggested ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("")
    + `<option value="${NEW_EXPENSE}" ${suggested ? "" : "selected"}>New one-time expense</option>`;
  const lastAcct = (() => { try { return localStorage.getItem("moneyku_spend_acct") || ""; } catch { return ""; } })();
  const owner = ownerOf(targets.find((t) => t.id === suggested)?.w || includedWho()[0]);
  const notes = [];
  if (n.outOfRange) notes.push("The receipt date is outside your timeline, so it is filed under the month you are viewing.");
  else if (n.month && n.month !== sel) notes.push(`Dated ${monthShort(n.month)}, so it will be filed under ${monthShort(n.month)}.`);
  if (n.lowConfidence) notes.push("I wasn't sure about this one. Please check the amount.");
  if (n.total == null) notes.push("I couldn't read the total. Type it in.");
  if (!n.date) notes.push("No date was printed.");
  const noteHtml = `<div id="rc-notes" class="space-y-1.5">${notes.map((t) => `<div class="flex items-start gap-2 bg-amber-900/20 border border-amber-500/20 rounded-xl px-3 py-2"><span class="material-icons text-amber-400" style="font-size:16px;margin-top:1px">info</span><div class="text-xs text-amber-200">${escapeHtml(t)}</div></div>`).join("")}</div>`;
  showSheet("Confirm receipt",
    `${noteHtml}
     <div class="grid grid-cols-2 gap-2.5">
       <div class="space-y-1"><label class="as-label" for="rc-note">Store or note</label><input type="text" id="rc-note" class="as-input" maxlength="60" value="${escapeHtml(n.merchant)}" autocomplete="off" /></div>
       <div class="space-y-1"><label class="as-label" for="rc-amount">Total (₱)</label><input type="number" id="rc-amount" class="as-input" inputmode="decimal" value="${n.total ?? ""}" placeholder="0" /></div>
     </div>
     <div class="grid grid-cols-2 gap-2.5">
       <div class="space-y-1"><label class="as-label" for="rc-date">Date</label><input type="date" id="rc-date" class="as-input" value="${date}" /></div>
       <div class="space-y-1"><label class="as-label" for="rc-acct">From account</label><select id="rc-acct" class="as-input">${acctOptions(owner, pickAcct(owner, lastAcct))}</select></div>
     </div>
     <div class="space-y-1"><label class="as-label" for="rc-target">Log under</label><select id="rc-target" class="as-input">${opts}</select></div>
     <div id="rc-dup" class="text-xs text-amber-200"></div>
     <p class="text-[11px] text-slate-400 leading-snug">The photo is not saved. Only the store, date and total are kept.</p>`,
    btn(CANCEL, "qlClose", "Cancel") + btn(PRIMARY, "rcConfirm", "Confirm"));
  const refresh = () => {
    const t = targets.find((x) => x.id === $("rc-target")?.value);
    const o = ownerOf(t?.w || includedWho()[0]);
    const cur = $("rc-acct")?.value || "";
    if ($("rc-acct")) $("rc-acct").innerHTML = acctOptions(o, pickAcct(o, cur));
    const amt = parseFloat($("rc-amount")?.value) || 0, d = $("rc-date")?.value || "";
    const k = /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : month;
    const dup = t && amt > 0 && findDuplicate(getSpendList(t.id, k), amt, d, $("rc-note")?.value);
    if ($("rc-dup")) $("rc-dup").textContent = dup ? "Looks like this is already logged (same amount, date and note)." : "";
  };
  ["rc-target", "rc-amount", "rc-date", "rc-note"].forEach((id) => $(id)?.addEventListener("input", refresh));
  $("rc-target")?.addEventListener("change", refresh);
  refresh();
  if (n.total == null) setTimeout(() => $("rc-amount")?.focus(), 50);
}

export async function rcConfirm() {
  if (!rec) return;
  const amount = parseFloat($("rc-amount")?.value) || 0;
  if (!(amount > 0)) { toast("Enter the total first", "error"); return $("rc-amount")?.focus(); }
  const date = $("rc-date")?.value || "";
  const month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : rec.month;
  if (!timeline().includes(month)) { toast("That date is outside your timeline", "error"); return; }
  const note = ($("rc-note")?.value || "").trim().slice(0, 60);
  const target = $("rc-target")?.value || NEW_EXPENSE;
  const acct = $("rc-acct")?.value || "";
  const d = getAppData();
  const snapshot = JSON.parse(JSON.stringify(d));
  const bb = budgetBefore();
  let msg;
  if (target === NEW_EXPENSE) {
    const who = includedWho().length === 1 && includedWho()[0] === "partner" ? "partner" : "charlie";
    const item = addItemData(d, { who, kind: "expenses", name: note || "Receipt", amount, start: month, recurring: false, category: rec.n.category && rec.n.category !== "other" ? rec.n.category : "" });
    setPaidData(d, item.id, month, true);
    if (acct) recordPayment(month, item.id, acct, amount);
    msg = `${peso(amount)} logged as ${item.name}`;
  } else {
    const hit = spendTargets(month).find(({ it }) => it.id === target);
    if (!hit) { toast(`That item isn't in ${monthShort(month)}. Pick another or a new expense.`, "error"); return; }
    const account = acct ? (d.accounts || []).find((a) => a.id === acct) : null;
    if (account) account.amount = Math.round(((Number(account.amount) || 0) - amount + Number.EPSILON) * 100) / 100;
    const entry = buildSpendEntry({ id: generateId(), amount, date, note, acct: account ? acct : "" });
    d.spend = d.spend || {};
    d.spend[month] = d.spend[month] || {};
    d.spend[month][target] = [...getSpendList(target, month), entry];
    try { localStorage.setItem(LAST_ITEM_KEY, target); } catch { /* ignore */ }
    msg = `${peso(amount)} logged in ${hit.it.name}`;
  }
  try { if (acct) localStorage.setItem("moneyku_spend_acct", acct); } catch { /* ignore */ }
  rec = null;
  qlClose();
  await syncSet(d);
  renderAll();
  const warn = budgetAlertText(bb);
  toast(`${msg}${warn ? " · " + warn : ""}`, warn ? "error" : "ok", {
    actionLabel: "Undo",
    duration: 6000,
    onAction: async () => { setAppData(snapshot); await syncSet(snapshot); renderAll(); toast("Undone"); },
  });
}
