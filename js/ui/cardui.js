// =============================
// BPI Platinum Rewards: the separate card section in Expenses, statements,
// "Pay card" and reconciliation.
// =============================
import { CARD_NAME, cardSettings, cardSummary, clearStatement, daysUntil, isCardItem, keysForMonth, payCard, removeCardPayment, saveCardSettings, saveStatement, statement } from "../card.js";
import { getAppData, getItems, getSelectedKey, monthsPaidCount, setSelectedKey, timeline } from "../state.js";
import { syncSet } from "../firebase.js";
import { escapeHtml, monthShort, monthsInclusive, parseMathAmount, peso } from "../utils.js";
import { payableAccounts } from "../payfrom.js";
import { catInfo, categoryOf } from "../categories.js";
import { toast } from "./core.js";
import { renderAll } from "./layout.js";
import { scrollChipIntoView } from "./actions.js";

const fmtDate = (s) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

const STATUS = {
  open: ["Open", "text-sky-300 bg-sky-500/15 border-sky-500/30"],
  partial: ["Partly paid", "text-amber-300 bg-amber-500/15 border-amber-500/30"],
  paid: ["Paid", "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"],
  overdue: ["Overdue", "text-rose-300 bg-rose-500/15 border-rose-500/30"],
};

/** "Monthly until Mar '27 (3/12 paid)" for recurring charges, so you can see when the payments stop. */
function recurNote(it) {
  if (!it.recurring) return "";
  if (!it.end) return ` &middot; <span class="text-indigo-300/90">Monthly, no end date</span>`;
  const total = monthsInclusive(it.start, it.end);
  return ` &middot; <span class="text-amber-300/90">Monthly until ${monthShort(it.end)} &middot; ${monthsPaidCount(it)}/${total} paid</span>`;
}

function statementHtml(key, k) {
  const st = statement(key);
  const [label, cls] = STATUS[st.status];
  const accounts = getAppData().accounts || [];
  const acctName = (id) => accounts.find((a) => a.id === id)?.name || "account";
  const rowHtml = (c) => `<div data-action="openItemModal" data-arg0="charlie" data-arg1="expenses" data-arg2="${c.id}" class="item-row flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer ${c.posted ? "opacity-60" : ""}">
        <button data-action="togglePaidQuick" data-arg0="${c.id}" data-arg1="expenses" title="Mark posted to the card" class="paid-check ${c.posted ? "is-paid bg-emerald-500 border-emerald-500" : "border-slate-600"} w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border"><span class="material-icons check-icon text-white" style="font-size:14px">check</span></button>
        <div class="flex-1 min-w-0"><p class="text-xs font-bold text-slate-200 truncate ${c.posted ? "line-through" : ""}">${escapeHtml(c.item.name)}</p><p class="text-[9px] font-bold text-slate-500">${fmtDate(c.date)}${recurNote(c.item)}</p></div>
        <p class="text-xs font-black text-white flex-shrink-0">${peso(c.amt)}</p></div>`;
  // Long statements are grouped by category (collapsed, biggest first) to keep the list short
  const groupHtml = () => {
    const groups = new Map();
    for (const c of st.charges) {
      const id = categoryOf(c.item);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(c);
    }
    return [...groups.entries()]
      .map(([id, list]) => ({ id, list, total: list.reduce((s, c) => s + c.amt, 0), info: catInfo(id) }))
      .sort((a, b) => b.total - a.total)
      .map((g) => {
        const left = g.list.filter((c) => !c.posted).length;
        return `<details data-persist="cardcat-${key}-${g.id}" class="group/c rounded-lg bg-slate-800/40">
          <summary class="flex items-center gap-2 px-2 py-2 cursor-pointer list-none select-none">
            <span class="material-icons" style="font-size:16px;color:${g.info.color}">${g.info.icon}</span>
            <div class="flex-1 min-w-0"><p class="text-xs font-black text-white truncate">${g.info.label}</p>
              <p class="text-[10px] font-bold text-slate-500">${g.list.length} charge${g.list.length === 1 ? "" : "s"}${left < g.list.length ? ` &middot; ${g.list.length - left} posted` : ""}</p></div>
            <p class="text-xs font-black text-white flex-shrink-0">${peso(g.total)}</p>
            <span class="material-icons text-slate-500 transition-transform group-open/c:rotate-180" style="font-size:16px">expand_more</span>
          </summary>
          <div class="pb-1 space-y-0.5">${g.list.map(rowHtml).join("")}</div></details>`;
      }).join("");
  };
  const chargeRows = !st.charges.length
    ? `<p class="text-[10px] text-slate-500 px-2 py-1">No charges in this statement yet.</p>`
    : st.charges.length > 6 ? groupHtml() : st.charges.map(rowHtml).join("");  const payRows = st.payments.map((p) => `<div class="flex items-center gap-2 px-2 py-1 text-[10px] font-bold text-slate-400">
      <span class="material-icons text-emerald-400" style="font-size:13px">south_west</span>
      <span class="flex-1 min-w-0 truncate">${fmtDate(p.date)} &middot; from ${escapeHtml(acctName(p.acctId))}</span>
      <span class="text-emerald-300">${peso(p.amount)}</span>
      <button type="button" data-action="cardUndoPay" data-arg0="${p.id}" class="text-rose-300 px-1" title="Undo this payment">Undo</button></div>`).join("");
  const stat = (name, val, tone = "text-white") => `<div class="flex-1 min-w-0 text-center"><p class="text-[8px] font-bold uppercase text-slate-500">${name}</p><p class="text-[11px] font-black ${tone}">${val}</p></div>`;
  const diffLine = st.statementAmount != null && Math.abs(st.diff) > 0.005
    ? `<p class="text-[10px] font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">Statement is ${peso(Math.abs(st.diff))} ${st.diff > 0 ? "higher" : "lower"} than your tracked charges. ${st.diff > 0 ? "A charge may be missing (or interest/fees)." : "A tracked charge may not have posted yet."}</p>`
    : st.statementAmount != null ? `<p class="text-[10px] font-bold text-emerald-300 px-2">Matches your tracked charges.</p>` : "";
  return `<details data-stmt="${key}" ${st.status !== "paid" || key === k ? "open" : ""} class="group rounded-xl bg-slate-900/50 border border-white/[0.05]">
    <summary class="flex items-center gap-2 px-2.5 py-2 cursor-pointer list-none select-none">
      <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:14px">chevron_right</span>
      <div class="flex-1 min-w-0"><p class="text-xs font-black text-white truncate">Cut ${fmtDate(st.cutoff)} &middot; due ${fmtDate(st.due)}</p>
        <p class="text-[9px] font-bold text-slate-500">${st.charges.length} charge${st.charges.length === 1 ? "" : "s"}${st.isManual ? " &middot; your dates" : ""}</p></div>
      <span class="text-[9px] font-black px-1.5 py-0.5 rounded border ${cls}">${label}</span>
      <p class="text-xs font-black ${st.remaining > 0.005 ? "text-rose-400" : "text-slate-500"} flex-shrink-0">${peso(st.remaining)}</p>
    </summary>
    <div class="px-1.5 pb-2 space-y-1.5">
      <div class="space-y-0.5">${chargeRows}</div>
      <div class="flex gap-1 py-1.5 border-y border-white/[0.05]">
        ${stat("Charged", peso(st.charged))}
        ${stat("Statement", st.statementAmount != null ? peso(st.statementAmount) : "&mdash;", "text-indigo-300")}
        ${stat("Paid", peso(st.paid), "text-emerald-300")}
        ${stat("Left", peso(st.remaining), st.remaining > 0.005 ? "text-rose-400" : "text-slate-400")}
      </div>
      ${diffLine}
      ${payRows ? `<div class="space-y-0.5">${payRows}</div>` : ""}
      <div class="flex gap-2 px-1">
        ${st.remaining > 0.005 ? `<button type="button" data-action="cardPayOpen" data-arg0="${key}" class="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">payments</span>Pay card</button>` : ""}
        <button type="button" data-action="cardStatementOpen" data-arg0="${key}" class="flex-1 py-2 rounded-lg bg-slate-700/60 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">edit_calendar</span>Statement</button>
      </div>
    </div></details>`;
}

/** The separate BPI Platinum Rewards section (charlie's expenses). */
export function cardSectionHtml(k) {
  const keys = keysForMonth(k);
  const blocks = keys.map((key) => statementHtml(key, k)).join("");
  const owed = keys.reduce((s, key) => s + statement(key).remaining, 0);
  const count = getItems("charlie", "expenses").filter(isCardItem).length;
  const empty = `<div class="px-3 py-3 text-center"><p class="text-[11px] font-bold text-slate-500">${count ? "No card statements to show for this month." : "No card expenses yet."}</p>
      <p class="text-[10px] text-slate-600">Set an expense's payment method to ${CARD_NAME} and it moves here.</p></div>`;
  return `<div id="sec-card" class="border-t border-white/[0.04] pt-2" style="scroll-margin-top:5.5rem">
    <details open data-persist="sec-card" class="group">
      <summary class="flex items-center justify-between px-1.5 mb-1 cursor-pointer list-none select-none">
        <div class="flex items-center gap-1">
          <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:12px">chevron_right</span>
          <div class="flex items-baseline gap-1.5">
            <p class="text-[9px] font-black uppercase tracking-[0.15em] text-indigo-300">&#128179; ${CARD_NAME}</p>
            <span class="text-[11px] font-bold ${owed > 0.005 ? "text-rose-400" : "text-slate-500"}">${peso(owed)}</span>
          </div>
        </div>
        <button type="button" data-action="cardSettingsOpen" title="Card settings" aria-label="Card settings" class="text-slate-500 px-1"><span class="material-icons" style="font-size:14px">tune</span></button>
      </summary>
      <div class="space-y-1.5 mt-1">${blocks || empty}</div>
    </details>
  </div>`;
}

// ---------- main-screen summary ----------
const dueBadge = (days) => {
  if (days < 0) return [`overdue by ${-days} day${days === -1 ? "" : "s"}`, "overdue"];
  if (days === 0) return ["due today", "soon"];
  return [`due in ${days} day${days === 1 ? "" : "s"}`, days <= 7 ? "soon" : "neutral"];
};

/** Compact BPI Platinum summary shown under the month totals on the main screen. Empty string when the card is not in use. */
export function cardSummaryHtml() {
  const sm = cardSummary();
  if (!sm.any) return "";
  const shell = (tone, inner) => `<div id="card-summary" class="cs-card cs-tone-${tone}">${inner}</div>`;
  const icon = `<span class="cs-icon"><span class="material-icons" style="font-size:14px">credit_card</span></span>`;
  const next = sm.unpaid[0];
  if (!next) {
    if (!sm.hasActivity) {
      return shell("empty", `<div class="cs-row">${icon}<p class="cs-empty"><span class="cs-label">BPI Platinum</span> No card balance</p></div>`);
    }
    return shell("paid", `<div class="cs-row">${icon}
      <div class="cs-grow"><p class="cs-label">BPI Platinum</p>
        <p class="cs-allpaid"><span class="material-icons" style="font-size:16px">check_circle</span>All paid</p></div>
      <span class="cs-muted">${peso(sm.owedNow)} owed</span></div>`);
  }
  const days = daysUntil(next.due);
  const [badgeTxt, badgeTone] = dueBadge(days);
  const [statusLabel, statusCls] = STATUS[next.status] || STATUS.open;
  const pct = next.total > 0 ? Math.max(0, Math.min(100, Math.round((Math.min(next.paid, next.total) / next.total) * 100))) : 0;
  const more = sm.unpaid.slice(1);
  const moreLeft = more.reduce((s, x) => s + x.remaining, 0);
  const late = next.status === "overdue";
  return shell(late ? "overdue" : badgeTone === "soon" ? "soon" : "ok", `<div data-action="cardSummaryGo" data-arg0="${next.key}" role="button" tabindex="0" aria-label="Open BPI Platinum statement due ${fmtDate(next.due)}" class="cs-body">
    <div class="cs-row">${icon}
      <div class="cs-grow"><p class="cs-label">BPI Platinum &middot; owed now</p>
        <p class="cs-owed ${sm.owedNow > 0.005 ? "" : "cs-muted"}">${peso(sm.owedNow)}</p></div>
      <span class="cs-badge cs-badge-${badgeTone}">${badgeTxt}</span>
    </div>
    <div class="cs-row cs-between">
      <p class="cs-next">Next statement &middot; due ${fmtDate(next.due)}</p>
      <span class="cs-status ${statusCls}">${statusLabel}</span>
    </div>
    <div class="cs-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Paid ${pct}%"><div class="cs-fill ${late ? "cs-fill-late" : ""}" style="width:${pct}%"></div></div>
    <div class="cs-row">
      <div class="cs-grow cs-row cs-between cs-nums">
        <span class="cs-trunc">Paid <b class="cs-paid">${peso(next.paid)}</b> of ${peso(next.total)}</span>
        <span class="cs-nowrap">Left <b class="${late ? "cs-late" : "cs-left"}">${peso(next.remaining)}</b></span>
      </div>
      <button type="button" data-action="cardPayOpen" data-arg0="${next.key}" class="cs-pay"><span class="material-icons" style="font-size:12px">payments</span>Pay</button>
    </div>
    ${more.length ? `<p class="cs-more">+${more.length} more statement${more.length === 1 ? "" : "s"} &middot; ${peso(moreLeft)} left</p>` : ""}
  </div>`);
}

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target?.matches?.("#card-summary [data-action='cardSummaryGo']")) { e.preventDefault(); e.target.click(); }
});

/** Open the BPI Platinum section on the month the statement falls due, with that statement open. */
export function cardSummaryGo(key) {
  const st = statement(key);
  if (timeline().includes(st.dueKey) && getSelectedKey() !== st.dueKey) {
    setSelectedKey(st.dueKey);
    renderAll();
    scrollChipIntoView();
  }
  const sec = document.getElementById("sec-card");
  if (!sec) return;
  const outer = sec.querySelector("details[data-persist='sec-card']");
  if (outer && !outer.open) outer.open = true;
  const stmt = sec.querySelector(`details[data-stmt="${key}"]`);
  if (stmt && !stmt.open) stmt.open = true;
  const target = stmt || sec;
  requestAnimationFrame(() => {
    (stmt ? stmt : sec).scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("card-focus"); void target.offsetWidth; target.classList.add("card-focus");
    setTimeout(() => target.classList.remove("card-focus"), 1600);
  });
}

// ---------- dialogs ----------
let openDlg = null;
function dialog(inner, onClick) {
  if (openDlg) openDlg.close(null);
  const el = document.createElement("div");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.className = "fixed inset-0 z-[78] bg-black/70 flex items-end sm:items-center justify-center p-4";
  el.innerHTML = `<div class="bg-slate-800 w-full max-w-sm rounded-2xl p-5 border border-white/5 shadow-2xl space-y-3 max-h-[88vh] overflow-y-auto">${inner}</div>`;
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  const close = () => { document.removeEventListener("keydown", onKey, true); el.remove(); openDlg = null; };
  el.addEventListener("click", (e) => {
    if (e.target === el || e.target.closest("[data-cancel]")) return close();
    onClick(e, close);
  });
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(el);
  openDlg = { close };
  el.querySelector("input")?.focus();
  return el;
}

const inputCls = "w-full bg-slate-900 rounded-xl py-2.5 px-3.5 text-sm font-bold text-white focus:outline-none";
const field = (label, html) => `<div class="space-y-0.5"><label class="text-[10px] font-bold uppercase text-slate-500 ml-1">${label}</label>${html}</div>`;
const title = (small, big) => `<div><p class="text-[10px] font-black uppercase tracking-widest text-slate-400">${small}</p><p class="text-base font-black text-white mt-0.5">${big}</p></div>`;

async function commit(message) {
  await syncSet(getAppData());
  renderAll();
  if (message) toast(message);
}

export function cardPayOpen(key) {
  const st = statement(key);
  const accts = payableAccounts();
  if (!accts.length) return toast("Add a bank account first", "error");
  let sel = null;
  try { sel = localStorage.getItem("moneyku_pay_acct"); } catch { /* ignore */ }
  let acctId = (accts.find((a) => a.id === sel) || accts[0]).id;
  const rows = () => accts.map((a) => `<button type="button" data-acct="${escapeHtml(a.id)}" class="w-full flex items-center justify-between gap-2 p-3 rounded-xl border ${a.id === acctId ? "border-indigo-400 bg-indigo-500/15" : "border-slate-700 bg-slate-900/60"} text-left"><span class="text-sm font-bold text-white truncate">${escapeHtml(a.name)}</span><span class="text-[11px] font-bold text-slate-400">${peso(a.amount)}</span></button>`).join("");
  const el = dialog(`${title("Pay BPI Platinum Rewards", `Cut ${fmtDate(st.cutoff)} &middot; due ${fmtDate(st.due)}`)}
    <p class="text-[11px] font-bold text-slate-400">Left to pay <span class="text-rose-400">${peso(st.remaining)}</span> of ${peso(st.total)}</p>
    ${field("Amount (&#8369;)", `<input id="cp-amount" type="text" inputmode="decimal" value="${st.remaining}" class="${inputCls}" />`)}
    <p class="text-[10px] font-bold uppercase text-slate-500 ml-1">Paid from</p>
    <div id="cp-accts" class="space-y-2">${rows()}</div>
    <button type="button" data-go class="w-full py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl">Pay</button>
    <button type="button" data-cancel class="w-full py-2 text-xs font-bold text-slate-500">Cancel</button>`,
  async (e, close) => {
    const a = e.target.closest("[data-acct]");
    if (a) { acctId = a.dataset.acct; el.querySelector("#cp-accts").innerHTML = rows(); return; }
    if (!e.target.closest("[data-go]")) return;
    const amount = parseMathAmount(el.querySelector("#cp-amount").value);
    if (!(amount > 0)) return toast("Enter an amount", "error");
    if (amount > st.remaining + 0.005) return toast(`Only ${peso(st.remaining)} is left on this statement`, "error");
    try { localStorage.setItem("moneyku_pay_acct", acctId); } catch { /* ignore */ }
    const p = payCard(key, amount, acctId);
    close();
    if (p) await commit(`Paid ${peso(amount)} on the card`);
  });
}

export function cardStatementOpen(key) {
  const st = statement(key);
  const el = dialog(`${title("Statement", "Enter the dates and amount from your BPI statement")}
    ${field("Statement (cutoff) date", `<input id="cs-cutoff" type="date" value="${st.cutoff}" class="${inputCls}" />`)}
    ${field("Payment due date", `<input id="cs-due" type="date" value="${st.due}" class="${inputCls}" />`)}
    ${field("Statement amount (&#8369;) <span class='text-slate-600'>optional</span>", `<input id="cs-amount" type="text" inputmode="decimal" value="${st.statementAmount ?? ""}" placeholder="${st.charged}" class="${inputCls}" />`)}
    ${field("Note <span class='text-slate-600'>optional</span>", `<input id="cs-note" type="text" value="${escapeHtml(st.note)}" class="${inputCls}" />`)}
    <p class="text-[10px] text-slate-500 px-1">Your tracked charges for this statement are ${peso(st.charged)}. If the real statement is different, enter it to see the difference.</p>
    <button type="button" data-go class="w-full py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl">Save statement</button>
    ${st.isManual ? `<button type="button" data-reset class="w-full py-2.5 text-xs font-bold text-slate-300 bg-slate-700/50 rounded-xl">Use automatic dates and amount</button>` : ""}
    <button type="button" data-cancel class="w-full py-2 text-xs font-bold text-slate-500">Cancel</button>`,
  async (e, close) => {
    if (e.target.closest("[data-reset]")) { clearStatement(key); close(); return commit("Back to automatic dates"); }
    if (!e.target.closest("[data-go]")) return;
    const cutoff = el.querySelector("#cs-cutoff").value, due = el.querySelector("#cs-due").value;
    if (!cutoff || !due) return toast("Enter both dates", "error");
    if (due < cutoff) return toast("The due date must be after the cutoff date", "error");
    const raw = el.querySelector("#cs-amount").value.trim();
    const amount = raw === "" ? null : parseMathAmount(raw);
    if (raw !== "" && !(amount >= 0)) return toast("Enter a valid amount", "error");
    saveStatement(key, { cutoff, due, amount, note: el.querySelector("#cs-note").value.trim() });
    close();
    await commit("Statement saved");
  });
}

export function cardSettingsOpen() {
  const s = cardSettings();
  const el = dialog(`${title("Card settings", CARD_NAME)}
    ${field("Statement (cutoff) day of the month", `<input id="cg-cutoff" type="number" min="1" max="31" inputmode="numeric" value="${s.cutoffDay}" class="${inputCls}" />`)}
    ${field("Payment due day of the month", `<input id="cg-due" type="number" min="1" max="31" inputmode="numeric" value="${s.dueDay}" class="${inputCls}" />`)}
    <p class="text-[10px] text-slate-500 px-1">The due date is the next time that day comes after the cutoff. Used for every statement without your own dates. Edit a single statement to match your real BPI statement.</p>
    <button type="button" data-go class="w-full py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl">Save</button>
    <button type="button" data-cancel class="w-full py-2 text-xs font-bold text-slate-500">Cancel</button>`,
  async (e, close) => {
    if (!e.target.closest("[data-go]")) return;
    const cutoffDay = parseInt(el.querySelector("#cg-cutoff").value, 10), dueDay = parseInt(el.querySelector("#cg-due").value, 10);
    if (!(cutoffDay >= 1 && cutoffDay <= 31)) return toast("Cutoff day must be 1 to 31", "error");
    if (!(dueDay >= 1 && dueDay <= 31)) return toast("Due day must be 1 to 31", "error");
    saveCardSettings({ cutoffDay, dueDay });
    close();
    await commit("Card settings saved");
  });
}

export async function cardUndoPay(id) {
  const r = removeCardPayment(id);
  if (!r) return;
  await commit(r.acctName ? `${peso(r.payment.amount)} returned to ${r.acctName}` : "Payment removed");
}
