// =============================
// BPI Platinum Rewards: the separate card section in Expenses, statements,
// "Pay card" and reconciliation.
// =============================
import { CARD_NAME, cardSettings, cardSummary, clearStatement, daysUntil, isCardItem, keysForMonth, paidViaStatement, payCard, removeCardPayment, saveCardSettings, saveStatement, statement } from "../card.js";
import { getAppData, getItems, getSelectedKey, monthsPaidCount, setPaidExtra, setSelectedKey, timeline } from "../state.js";
import { syncSet } from "../firebase.js";
import { escapeHtml, monthShort, monthsInclusive, parseMathAmount, peso } from "../utils.js";

setPaidExtra(paidViaStatement); // a fully paid card statement counts its installment months as paid
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

// "Hide done charges" is remembered per statement; a fully paid statement starts collapsed to its summary.
const HIDE_KEY = "moneyku_card_hidedone";
const hideMap = () => { try { return JSON.parse(localStorage.getItem(HIDE_KEY) || "{}") || {}; } catch { return {}; } };
const hidesDone = (key, covered) => (key in hideMap() ? !!hideMap()[key] : covered);
export function cardToggleDone(key) {
  const m = hideMap(), covered = statement(key).status === "paid";
  m[key] = !hidesDone(key, covered);
  try { localStorage.setItem(HIDE_KEY, JSON.stringify(m)); } catch { /* ignore */ }
  renderAll();
}

/** "paid Nov 20" / "due in 7 days" / "overdue by 3 days": the one thing to know about a statement's timing. */
function timingNote(st) {
  if (st.status === "paid") {
    const last = st.payments.map((p) => p.date).filter(Boolean).sort().pop();
    return last ? `<span class="text-emerald-300">paid ${fmtDate(last)}</span>` : `<span class="text-emerald-300">paid</span>`;
  }
  const [txt, tone] = dueBadge(daysUntil(st.due));
  return `<span class="${tone === "overdue" ? "text-rose-300" : tone === "soon" ? "text-amber-300" : "text-slate-400"}">${txt}</span>`;
}

function statementHtml(key, k) {
  const st = statement(key);
  const [label, cls] = STATUS[st.status];
  const accounts = getAppData().accounts || [];
  const acctName = (id) => accounts.find((a) => a.id === id)?.name || "account";
  const covered = st.status === "paid"; // a paid statement settles every charge on it
  const done = (c) => c.posted || covered;
  const hide = hidesDone(key, covered);
  const sameName = new Map();
  for (const c of st.charges) { const n = c.item.name.trim().toLowerCase(); sameName.set(n, (sameName.get(n) || 0) + 1); }
  const rowHtml = (c) => {
    const times = sameName.get(c.item.name.trim().toLowerCase()) || 1;
    const check = c.posted
      ? `<button data-action="togglePaidQuick" data-arg0="${c.id}" data-arg1="expenses" title="Posted to the card" class="paid-check is-paid bg-emerald-500 border-emerald-500 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border"><span class="material-icons check-icon text-white" style="font-size:14px">check</span></button>`
      : covered
        ? `<div title="Covered by the paid statement" class="paid-check is-paid bg-emerald-500 border-emerald-500 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border"><span class="material-icons check-icon text-white" style="font-size:14px">check</span></div>`
        : `<button data-action="togglePaidQuick" data-arg0="${c.id}" data-arg1="expenses" title="Mark posted to the card" class="paid-check border-slate-600 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border"><span class="material-icons check-icon text-white" style="font-size:14px">check</span></button>`;
    return `<div data-action="openItemModal" data-arg0="charlie" data-arg1="expenses" data-arg2="${c.id}" data-name="${escapeHtml(c.item.name.toLowerCase())}" class="item-row flex items-center gap-2 py-1.5 px-1 rounded-lg cursor-pointer ${done(c) ? "opacity-60" : ""}">
        ${check}
        <div class="flex-1 min-w-0"><p class="text-[13px] font-bold text-slate-200 truncate ${done(c) ? "line-through" : ""}">${escapeHtml(c.item.name)}</p><p class="text-[11px] font-bold text-slate-500">${fmtDate(c.date)}${times > 1 ? ` &middot; <span class="text-slate-400">&times;${times}</span>` : ""}${recurNote(c.item)}</p></div>
        <p class="text-[13px] font-black text-white flex-shrink-0">${peso(c.amt)}</p></div>`;
  };
  const doneCount = st.charges.filter(done).length;
  const leftAmt = st.charges.filter((c) => !done(c)).reduce((a, c) => a + c.amt, 0);
  const shown = hide ? st.charges.filter((c) => !done(c)) : st.charges;
  // Long statements are grouped by category (biggest first); each group shows what is still to post, with the total beside it
  const groupHtml = () => {
    const groups = new Map();
    for (const c of shown) {
      const id = categoryOf(c.item);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(c);
    }
    const list = [...groups.entries()]
      .map(([id, items]) => ({ id, items, total: items.reduce((a, c) => a + c.amt, 0), left: items.filter((c) => !done(c)).reduce((a, c) => a + c.amt, 0), info: catInfo(id) }))
      .sort((a, b) => b.total - a.total);
    const sum = list.reduce((a, g) => a + Math.max(0, g.total), 0);
    const bar = list.length > 1 && sum > 0
      ? `<div class="flex h-1.5 rounded-full overflow-hidden gap-px mx-1 mb-1" role="img" aria-label="Spending by category">${list.filter((g) => g.total > 0).map((g) => `<span title="${g.info.label} ${peso(g.total)}" style="flex:${(g.total / sum).toFixed(4)} 1 0;background:${g.info.color}"></span>`).join("")}</div>`
      : "";
    return bar + list.map((g) => {
      const n = g.items.length, nDone = g.items.filter(done).length;
      const allDone = nDone === n;
      const figure = allDone
        ? `<p class="text-[13px] font-black text-slate-500">${peso(g.total)}</p>`
        : `<p class="text-[13px] font-black text-white">${peso(g.left)}</p>${g.left < g.total - 0.005 ? `<p class="text-[11px] font-bold text-slate-500">of ${peso(g.total)}</p>` : ""}`;
      return `<details data-persist="cardcat-${key}-${g.id}" class="group/c border-t border-white/[0.05]">
          <summary class="flex items-center gap-2 px-1 py-2 cursor-pointer list-none select-none">
            <span class="material-icons" style="font-size:18px;color:${g.info.color}">${g.info.icon}</span>
            <div class="flex-1 min-w-0"><p class="text-[13px] font-black text-white truncate">${g.info.label}</p>
              <p class="text-[11px] font-bold text-slate-500">${n} charge${n === 1 ? "" : "s"}${nDone ? ` &middot; ${covered && nDone === n ? "paid" : `${nDone} posted`}` : ""}</p></div>
            <div class="text-right flex-shrink-0">${figure}</div>
            <span class="material-icons text-slate-500 transition-transform group-open/c:rotate-180" style="font-size:16px">expand_more</span>
          </summary>
          <div class="pb-1 space-y-0.5">${g.items.map(rowHtml).join("")}</div></details>`;
    }).join("");
  };
  const many = st.charges.length > 6;
  let chargeRows;
  if (!st.charges.length) chargeRows = `<p class="text-[11px] text-slate-500 px-2 py-1">No charges in this statement yet.</p>`;
  else if (!shown.length) chargeRows = `<p class="text-[11px] font-bold text-emerald-300 px-2 py-1.5">${covered ? "All paid" : "All posted"} &middot; ${st.charges.length} charge${st.charges.length === 1 ? "" : "s"} hidden</p>`;
  else chargeRows = many ? `<div data-card-groups>${groupHtml()}</div><div data-card-results class="hidden space-y-0.5"></div>` : shown.map(rowHtml).join("");
  const toolbar = st.charges.length && doneCount
    ? `<div class="flex items-center gap-2 px-1">
        <p class="flex-1 min-w-0 text-[11px] font-bold text-slate-400 truncate">${doneCount === st.charges.length ? (covered ? "All paid" : "All posted") : `${doneCount} of ${st.charges.length} posted`}${leftAmt > 0.005 ? ` &middot; ${peso(leftAmt)} to post` : ""}</p>
        <button type="button" data-action="cardToggleDone" data-arg0="${key}" class="flex-shrink-0 text-[11px] font-bold text-indigo-300 px-2.5 py-1.5 rounded-lg bg-white/5">${hide ? `Show ${doneCount} done` : "Hide done"}</button>
      </div>` : "";
  const search = many
    ? `<div class="relative px-1"><span class="material-icons absolute text-slate-500 pointer-events-none" style="font-size:16px;left:12px;top:50%;transform:translateY(-50%)">search</span>
        <input type="search" data-card-search aria-label="Search charges" placeholder="Search charges" autocomplete="off" class="w-full bg-slate-900/70 rounded-xl text-[13px] font-bold text-white focus:outline-none" style="padding:0.5rem 0.75rem 0.5rem 2rem" /></div>`
    : "";
  const payRows = st.payments.map((p) => `<div class="flex items-center gap-2 px-1 py-1 text-[11px] font-bold text-slate-400">
      <span class="material-icons text-emerald-400" style="font-size:14px">south_west</span>
      <span class="flex-1 min-w-0 truncate">${fmtDate(p.date)} &middot; from ${escapeHtml(acctName(p.acctId))}</span>
      <span class="text-emerald-300">${peso(p.amount)}</span>
      <button type="button" data-action="cardUndoPay" data-arg0="${p.id}" class="text-rose-300 px-1 py-1" title="Undo this payment">Undo</button></div>`).join("");
  const stat = (name, val, tone = "text-white") => `<div class="flex-1 min-w-0 text-center"><p class="text-[11px] font-bold text-slate-500">${name}</p><p class="text-[12px] font-black ${tone}">${val}</p></div>`;
  const diffLine = st.statementAmount != null && Math.abs(st.diff) > 0.005
    ? `<p class="text-[11px] font-bold text-amber-300 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">Statement is ${peso(Math.abs(st.diff))} ${st.diff > 0 ? "higher" : "lower"} than your tracked charges. ${st.diff > 0 ? "A charge may be missing (or interest/fees)." : "A tracked charge may not have posted yet."}</p>`
    : st.statementAmount != null ? `<p class="text-[11px] font-bold text-emerald-300 px-2">Matches your tracked charges.</p>` : "";
  return `<details data-stmt="${key}" data-persist="cardstmt-v2-${key}" class="group rounded-xl bg-slate-900/50 border border-white/[0.05]">
    <summary class="flex items-center gap-2 px-2.5 py-2 cursor-pointer list-none select-none">
      <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:14px">chevron_right</span>
      <div class="flex-1 min-w-0"><p class="text-xs font-black text-white truncate">Cut ${fmtDate(st.cutoff)} &middot; due ${fmtDate(st.due)}</p>
        <p class="text-[11px] font-bold text-slate-500 truncate">${st.charges.length} charge${st.charges.length === 1 ? "" : "s"} &middot; ${timingNote(st)}${st.isManual ? " &middot; your dates" : ""}</p></div>
      <span class="text-[11px] font-black px-1.5 py-0.5 rounded border ${cls}">${label}</span>
      <p class="text-xs font-black ${st.remaining > 0.005 ? "text-rose-400" : "text-slate-500"} flex-shrink-0">${peso(st.remaining)}</p>
    </summary>
    <div class="px-1 pb-2 space-y-1.5">
      ${toolbar}
      ${search}
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
        ${st.remaining > 0.005 ? `<button type="button" data-action="cardPayOpen" data-arg0="${key}" class="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-[12px] font-bold flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">payments</span>Pay card</button>` : ""}
        <button type="button" data-action="cardStatementOpen" data-arg0="${key}" class="flex-1 py-2.5 rounded-lg bg-slate-700/60 text-slate-200 text-[12px] font-bold flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">edit_calendar</span>Statement</button>
      </div>
    </div></details>`;
}

/** Search box on a long statement: matching charges appear as one flat list while there is text, the category groups return when it is cleared. */
document.addEventListener("input", (e) => {
  const box = e.target?.closest?.("[data-card-search]");
  if (!box) return;
  const stmt = box.closest("details[data-stmt]");
  const groups = stmt?.querySelector("[data-card-groups]"), out = stmt?.querySelector("[data-card-results]");
  if (!groups || !out) return;
  const q = box.value.trim().toLowerCase();
  if (!q) { out.classList.add("hidden"); out.innerHTML = ""; groups.classList.remove("hidden"); return; }
  const hits = [...groups.querySelectorAll(".item-row")].filter((r) => (r.dataset.name || "").includes(q));
  groups.classList.add("hidden");
  out.classList.remove("hidden");
  out.innerHTML = hits.length ? hits.map((r) => r.outerHTML).join("") : `<p class="text-[11px] text-slate-500 px-2 py-2">No charge matches &ldquo;${escapeHtml(box.value.trim())}&rdquo;.</p>`;
});

/** The separate BPI Platinum Rewards section (charlie's expenses). */
export function cardSectionHtml(k) {
  const keys = keysForMonth(k);
  const blocks = keys.map((key) => statementHtml(key, k)).join("");
  const owed = keys.reduce((s, key) => s + statement(key).remaining, 0);
  const count = getItems("charlie", "expenses").filter(isCardItem).length;
  const empty = `<div class="px-3 py-3 text-center"><p class="text-[11px] font-bold text-slate-500">${count ? "No card statements to show for this month." : "No card expenses yet."}</p>
      <p class="text-[10px] text-slate-600">Set an expense's payment method to ${CARD_NAME} and it moves here.</p>
      <button type="button" data-action="openItemModal" data-arg0="charlie" data-arg1="expenses" class="mt-2 mx-auto flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-slate-600 text-indigo-300 text-[11px] font-bold"><span class="material-icons" style="font-size:16px">add</span>Add a card expense</button></div>`;
  return `<div id="sec-card" style="scroll-margin-top:5.5rem;margin-top:8px">
    <details data-persist="sec-card-v2" class="group">
      <summary class="flex items-center justify-between mb-1 cursor-pointer list-none select-none" style="padding:7px 8px">
        <div class="flex items-center gap-1">
          <span class="material-icons text-slate-500 transition-transform group-open:rotate-90" style="font-size:12px">chevron_right</span>
          <div class="flex items-baseline gap-1.5">
            <img src="assets/bpi-logo.png" alt="BPI" width="20" height="20" class="rounded flex-shrink-0 self-center" style="width:20px;height:20px;object-fit:contain">
            <svg class="flex-shrink-0 self-center" width="26" height="18" viewBox="0 0 26 18" role="img" aria-label="BPI Platinum Rewards card"><defs><linearGradient id="bpiPlat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset=".55" stop-color="#9ca3af"/><stop offset="1" stop-color="#d1d5db"/></linearGradient></defs><rect x=".5" y=".5" width="25" height="17" rx="3" fill="url(#bpiPlat)" stroke="#6b7280"/><rect x="3" y="4" width="5" height="3.6" rx=".8" fill="#fcd34d" stroke="#b45309" stroke-width=".4"/><circle cx="17" cy="12" r="3.2" fill="#ef4444" opacity=".9"/><circle cx="20" cy="12" r="3.2" fill="#f59e0b" opacity=".85"/></svg>
            <p class="font-black uppercase tracking-[0.12em] text-slate-400" style="font-size:11px">${CARD_NAME}</p>
            <span class="font-bold ${owed > 0.005 ? "text-rose-400" : "text-slate-500"}" style="font-size:14px">${peso(owed)}</span>
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
  const outer = sec.querySelector("details[data-persist='sec-card-v2']");
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
  const rows = () => accts.map((a) => `<button type="button" data-acct="${escapeHtml(a.id)}" class="w-full flex items-center justify-between gap-2 p-3 rounded-xl border ${a.id === acctId ? "border-indigo-400 bg-indigo-500/15" : "border-slate-700 bg-slate-900/60"} text-left"><span class="text-sm font-bold text-white truncate keep-case">${escapeHtml(a.name)}</span><span class="text-[11px] font-bold text-slate-400">${peso(a.amount)}</span></button>`).join("");
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
