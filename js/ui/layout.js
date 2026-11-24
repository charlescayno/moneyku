import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, householdProjectedAt, projectionBreakdown, includedWho, includedTotals, getSimView, monthFlow, outlookKeys, outlookRows, firstNegative, staleBalanceDays, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { householdRealMoney, realMoney } from '../insights.js';
import { tipCardHtml } from '../extras.js';
import { accountsCardHtml, debtTrackerCardHtml, fetchInvestmentRates, installmentsCardHtml, investmentsCardHtml, monthOverviewCardHtml, personSectionHtml, refreshMore, statsGridHtml } from './components.js';
import { renderMonthStrip, toggleProjected, updateHeader } from './actions.js';
import { cardSummaryHtml } from './cardui.js';
import { cardDueIn } from '../card.js';
import { next5CardHtml } from './next5.js';
import { runwayCardHtml } from './runway.js';
import { upcomingBillsWidgetHtml } from '../calendar.js';

// =============================
// Dashboard Main Renderer
// =============================
// First run: nothing entered yet, so say where to start
function welcomeHtml() {
  const d = getAppData();
  const any = ["charlie", "partner"].some((w) => ["income", "expenses"].some((k) => getItems(w, k).length)) || (d?.accounts || []).length;
  if (any) return "";
  return `<div class="welcome-card flex flex-col gap-2">
    <p class="text-sm font-black text-white">Start here</p>
    <p class="text-[12px] text-slate-300 leading-snug">Add your cash balances and your regular income and bills. The projection fills in as you go.</p>
    <div class="flex gap-2 flex-wrap">
      <button type="button" data-action="openAccountModal" data-arg0="" data-arg1="charlie" class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-[12px] font-bold flex items-center justify-center gap-1" style="min-width:8rem"><span class="material-icons ic-16">account_balance</span>Add an account</button>
      <button type="button" data-action="addInSection" data-arg0="charlie" data-arg1="income" data-arg2="salary" class="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-100 text-[12px] font-bold flex items-center justify-center gap-1" style="min-width:8rem"><span class="material-icons ic-16">payments</span>Add your salary</button>
    </div>
  </div>`;
}

export function renderBudget() {
  const pb = document.getElementById("budget-body");
  const k = getSelectedKey();
  const t = monthTotals(k);
  const projected = householdProjectedAt(k);
  const hideProjected = getHideProjected();
  // Top-bar switches: who counts in the combined numbers (per-person numbers are always shown)
  const inclW = includedWho();
  const showC = inclW.includes("charlie"), showP = inclW.includes("partner"); // only ticked people's sections show
  const projC = runningFundsAt(k, "charlie"), projP = runningFundsAt(k, "partner");
  // What the projected number is made of, early warnings, a worst case, and stale-balance nudge
  const pj = projectionBreakdown(k);
  const okeys = outlookKeys();
  const orows = okeys.length ? outlookRows(okeys) : [];
  const neg = firstNegative(orows);
  // Headline color by risk: red if the balance dips below zero in the next 12 months, amber if it gets under a quarter of today's cash, else green
  const lowestBal = orows.length ? Math.min(...orows.map((r) => r.all.bal)) : 0;
  // With only one person ticked the money is shown in that person's color (blue = Charles', purple = Ynah's)
  const onlyCls = inclW.length === 1 ? OWNERS[inclW[0]].text : null;
  const riskText = hideProjected ? "text-white" : projected < -0.005 ? "text-rose-400" : onlyCls ? onlyCls : lowestBal < 0 ? "text-rose-400" : lowestBal < 0.25 * pj.cash ? "text-amber-300" : "text-emerald-300";
  // Per-person change vs previous month (▲ / ▼), only for future months
  const pDelta = (w) => {
    if (hideProjected || cmpKey(k, currentKey()) <= 0) return "";
    const n = monthFlow(k, w).net;
    if (Math.abs(n) < 0.5) return "";
    return `<span class="text-[10px] font-bold whitespace-nowrap ${n > 0 ? "text-emerald-300" : "text-rose-300"}" title="Change vs previous month">${n > 0 ? "▲" : "▼"} ${peso(Math.abs(n))}</span>`;
  };
  // Tiny 12-month trend of the combined balance (hidden along with the numbers)
  let sparkHtml = "";
  if (orows.length > 1 && !getHideProjected()) {
    const vals = orows.map((r) => r.all.bal);
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), sp2 = hi - lo || 1;
    const X = (i) => 2 + (i * 96) / (vals.length - 1), Y = (v) => 2 + ((hi - v) / sp2) * 24;
    const d = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
    sparkHtml = `<svg viewBox="0 0 100 28" class="ml-auto w-24 h-7 flex-shrink-0" role="img" aria-label="Projected balance trend, next 12 months">${lo < 0 ? `<line x1="0" x2="100" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#fb7185" stroke-width="1" stroke-dasharray="2 2" opacity=".7"/>` : ""}<path d="${d}" fill="none" stroke="${Math.min(...vals) < 0 ? "#fb7185" : "#a5b4fc"}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const staleDays = Math.max(showC ? (staleBalanceDays("charlie") ?? -1) : -1, showP ? (staleBalanceDays("partner") ?? -1) : -1);
  const projChip = (cls, txt) => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}">${txt}</span>`;
  // Chips in priority order: below zero, then stale balances, then the monthly change, then "all good".
  // Only the first shows on the card; the rest live in the details below.
  const projChips = [];
  if (staleDays > 7) projChips.push(projChip("bg-amber-500/20 text-amber-200", `Oldest balance updated ${staleDays}d ago`));
  if (pj.delta != null && !hideProjected) projChips.push(projChip(pj.delta >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300", `${pj.delta >= 0 ? "+" : "-"}${peso(Math.abs(pj.delta))} vs prev. month`));
  const ht = includedTotals(k);
  const current = ht.current;
  const dRecv = (showC ? t.debtToReceive : 0) + (showP ? t.pDebtToReceive : 0), dPay = (showC ? t.debtToPay : 0) + (showP ? t.pDebtToPay : 0);
  const toRecvAll = ht.toReceive + dRecv, toPayAll = ht.toPay + dPay; // same rule as the projection: debts included
  const savColor = ht.savings > 0.005 ? "text-emerald-400" : ht.savings < -0.005 ? "text-rose-400" : "text-amber-300";

  const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const rm = realMoney("charlie");
  const rmP = realMoney("partner");
  // Future months: the projection already deducts every BPI Platinum bill due up to that month, i.e. it assumes they are paid in full. Say so.
  let cardNote = "";
  if (showC && !hideProjected && cmpKey(k, currentKey()) > 0) {
    const parts = [];
    let cardTotal = 0;
    for (const m of timeline()) {
      if (cmpKey(m, currentKey()) < 0) continue;
      const due = cardDueIn(m); const left = Math.max(0, due.total - due.paid);
      if (left > 0.005) { parts.push([m, left]); cardTotal += left; }
      if (m === k) break;
    }
    if (cardTotal > 0.005) cardNote = `<details data-persist="proj-card" id="proj-card-note" class="group/p mt-1.5 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
        <summary class="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer list-none select-none">
          <span class="material-icons text-indigo-300" style="font-size:15px">credit_card</span>
          <span class="flex-1 min-w-0 text-[11px] font-bold text-indigo-100 leading-tight">Assumes BPI Platinum bills are paid in full</span>
          <span class="text-[11px] font-black text-rose-300 flex-shrink-0">-${peso(cardTotal)}</span>
          <span class="material-icons text-indigo-300/70 transition-transform group-open/p:rotate-180" style="font-size:16px">expand_more</span>
        </summary>
        <div class="px-2.5 pb-2 grid grid-cols-2 gap-x-4 gap-y-1">${parts.map(([m, v]) => `<div class="flex items-center justify-between text-[10px]"><span class="font-bold text-slate-400">${monthShort(m)}</span><span class="font-black text-slate-200">${peso(v)}</span></div>`).join("")}</div>
      </details>`;
  }  const owedBreak = Object.entries(rm.owed.byMonth).sort(([a], [b]) => (a < b ? -1 : 1)).map(([m, v]) => `${monthShort(m)} ${peso(v)}`).join(" · ");
  // Person tiles live above the month navigation (outside #budget-body)
  const both = inclW.length === 2;
  // Simulated sandbox: its own numbers, its own view; while it is open the two real tiles are plain (not dimmed, no outline)
  const simOn = getSimView();
  const simT = t;
  const simProj = runningFundsAt(k, "simulated");
  const rmS = realMoney("simulated");
  const personTiles = `<div class="grid grid-cols-3 gap-1.5">
        <div data-action="focusPerson" data-arg0="charlie" aria-pressed="${!simOn && inclW.length === 1 && inclW[0] === "charlie"}" class="cursor-pointer bg-black/20 rounded-lg px-2 py-1.5 flex flex-col items-stretch gap-0.5 border ${!simOn && inclW.length === 1 && inclW[0] === "charlie" ? "border-indigo-400/60" : "border-transparent"} ${simOn || !inclW.includes("charlie") ? "tile-off" : ""}"><span class="flex items-center gap-1.5 min-h-[20px]"><img src="assets/avatar-charles.jpg" alt="" class="w-5 h-5 rounded-full object-cover flex-shrink-0"><span class="text-[9px] font-bold uppercase text-blue-300 leading-tight keep-case">${OWNERS.charlie.label}</span></span><span class="flex flex-col items-start gap-0 pl-0.5 min-w-0"><span id="sum-projected-c" class="text-xs font-black ${projC >= 0 ? "text-white" : "text-rose-400"}">${hideProjected ? "••••" : sp(projC)}</span>${pDelta("charlie")}</span></div>
        <div data-action="focusPerson" data-arg0="partner" aria-pressed="${!simOn && inclW.length === 1 && inclW[0] === "partner"}" class="cursor-pointer bg-black/20 rounded-lg px-2 py-1.5 flex flex-col items-stretch gap-0.5 border ${!simOn && inclW.length === 1 && inclW[0] === "partner" ? "border-indigo-400/60" : "border-transparent"} ${simOn || !inclW.includes("partner") ? "tile-off" : ""}"><span class="flex items-center gap-1.5 min-h-[20px]"><img src="assets/avatar-ynah.jpg" alt="" class="w-5 h-5 rounded-full object-cover flex-shrink-0"><span class="text-[9px] font-bold uppercase text-ynah leading-tight keep-case">${OWNERS.partner.label}</span></span><span class="flex flex-col items-start gap-0 pl-0.5 min-w-0"><span id="sum-projected-p" class="text-xs font-black ${projP >= 0 ? "text-white" : "text-rose-400"}">${hideProjected ? "••••" : sp(projP)}</span>${pDelta("partner")}</span></div>
        <div data-action="focusPerson" data-arg0="all" class="cursor-pointer bg-black/20 rounded-lg px-2 py-1.5 flex flex-col items-stretch gap-0.5 border ${both && !simOn ? "border-indigo-400/60" : "border-transparent"} ${simOn || !both ? "tile-off" : ""}"><span class="flex items-center gap-1.5 min-h-[20px]"><span class="material-icons text-indigo-300" style="font-size:18px">groups</span><span class="text-[9px] font-bold uppercase text-indigo-300 leading-tight">Together</span></span><span class="flex items-center gap-1 pl-0.5"><span id="sum-projected-all" class="text-xs font-black ${projC + projP >= 0 ? "text-white" : "text-rose-400"}"> ${hideProjected ? "••••" : sp(projC + projP)}</span></span></div>
        <div id="sim-tile" data-action="openSimulated" role="button" aria-pressed="${simOn}" class="cursor-pointer bg-black/20 rounded-lg px-2 py-1.5 flex items-center gap-1.5 ${simOn ? "border border-amber-400/70" : ""}" style="grid-column:1/-1"><span class="material-icons text-amber-300" style="font-size:18px">science</span><span class="text-[9px] font-bold uppercase text-amber-300 leading-tight min-w-0 truncate">Simulated together money</span><span class="ml-auto text-xs font-black flex-shrink-0 ${simProj >= 0 ? "text-white" : "text-rose-400"}">${hideProjected ? "••••" : sp(simProj)}</span></div>
      </div>`;
  const tilesSlot = document.getElementById("person-tiles");
  if (tilesSlot) tilesSlot.innerHTML = personTiles;
  const kpiBar = `
    <div class="proj-card w-full bg-slate-900/80 border border-white/5 rounded-3xl px-4 py-4 flex flex-col items-stretch gap-3 flex-shrink-0">
      <!-- Projected hero: small label, one big number -->
      <div class="flex flex-col gap-1 px-1">
        <div class="flex items-center gap-1.5">
          <span class="sec-title text-[11px] font-bold text-slate-400 min-w-0 truncate">projected · ${inclW.length === 2 ? "all" : OWNERS[inclW[0]].label} · ${monthShort(k)}</span>
          <button data-action="toggleProjected" aria-label="${hideProjected ? "Show amounts" : "Hide amounts"}" class="text-white/50 hover:text-white transition-colors focus:outline-none flex items-center flex-shrink-0" style="padding:7px;margin:-7px">
            <span class="material-icons" style="font-size:14px">${hideProjected ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>
        <div class="flex items-end justify-between gap-3">
          <p id="sum-projected" class="font-black tracking-tight tabular-nums ${riskText}" style="font-size:${hideProjected ? 26 : 34}px;line-height:1.1">${hideProjected ? '••••••' : sp(projected)}</p>
          ${sparkHtml}
        </div>
      </div>
      <!-- Four tiles: icon + label above, value below -->
      <div class="kpi-strip">
        <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 kpi-tile min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400 min-w-0" style="white-space:nowrap"><span class="material-icons text-indigo-300" style="font-size:15px">account_balance_wallet</span><span class="truncate min-w-0">cash now</span></span><span class="kpi-val font-extrabold tabular-nums truncate ${current < -0.005 ? "text-rose-400" : onlyCls || "text-white"}">${peso(current)}</span></div>
        <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 kpi-tile min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-emerald-300" style="font-size:15px">savings</span>savings</span><span class="kpi-val font-extrabold tabular-nums truncate ${savColor}">${signedPeso(ht.savings)}</span></div>
        <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 kpi-tile min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-emerald-300" style="font-size:15px">south_west</span>to receive</span><span class="kpi-val font-extrabold tabular-nums truncate text-emerald-400">${signedPeso(toRecvAll)}</span></div>
        <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 kpi-tile min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-rose-300" style="font-size:15px">north_east</span>to pay</span><span class="kpi-val font-extrabold tabular-nums truncate text-rose-400">${signedPeso(-toPayAll)}</span></div>
      </div>
      ${projChips.length ? `<div class="flex flex-wrap gap-1">${projChips[0]}</div>` : ""}
      ${projChips.length > 1 ? `<div class="flex flex-wrap gap-1">${projChips.slice(1).join("")}</div>` : ""}
      ${cardNote}

      <!-- KPI Metrics (collapsed by default; headline shows savings) -->

    </div>
  `;

  if (simOn) {
    // The simulation: a labelled sandbox with its own hero numbers and its own income / expense lists
    const tile = (icon, iconCls, label, valueHtml, extra = "", full = false) => `<div ${extra} class="bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2.5 flex flex-col gap-1 min-w-0" ${full ? 'style="grid-column:1/-1"' : ""}><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400 min-w-0" style="white-space:nowrap"><span class="material-icons ${iconCls}" style="font-size:15px">${icon}</span>${label}</span>${valueHtml}</div>`;
    const hid = (s) => (hideProjected ? "••••" : s);
    $("budget-body").innerHTML = `
    <div id="sim-view" class="w-full flex flex-col gap-2 budget-pad">
      <div class="w-full rounded-2xl border border-amber-400/40 bg-amber-500/10 pl-3.5 pr-2 py-1.5 flex items-center gap-2 flex-shrink-0">
        <span class="material-icons text-amber-300 ic-20">science</span>
        <p class="text-[11px] font-black uppercase tracking-wider text-amber-200 flex-1 min-w-0 truncate">Simulated sandbox</p>
        <button type="button" data-action="simInfo" aria-label="What is the simulation?" title="What is this?" class="icon-btn text-amber-200/90 flex items-center justify-center" style="width:32px;height:32px"><span class="material-icons ic-20">info</span></button>
        <button type="button" data-action="openSimCash" aria-label="Starting cash" title="Starting cash" class="icon-btn text-amber-100 flex items-center justify-center rounded-lg bg-white/5" style="width:36px;height:36px"><span class="material-icons ic-20">edit</span></button>
        <button type="button" data-action="askClearSimulation" aria-label="Clear simulation" title="Clear simulation" class="icon-btn text-rose-200 flex items-center justify-center rounded-lg bg-rose-500/15" style="width:36px;height:36px"><span class="material-icons ic-20">delete_sweep</span></button>
      </div>
      <div class="proj-card w-full bg-slate-900/80 border border-white/5 rounded-3xl px-4 py-4 flex flex-col items-stretch gap-3 flex-shrink-0">
        <div class="flex flex-col gap-1 px-1">
          <div class="flex items-center gap-1.5">
            <span class="sec-title text-[11px] font-bold text-slate-400 min-w-0 truncate">projected · simulated · ${monthShort(k)}</span>
            <button data-action="toggleProjected" aria-label="${hideProjected ? "Show amounts" : "Hide amounts"}" class="text-white/50 hover:text-white transition-colors focus:outline-none flex items-center flex-shrink-0" style="padding:7px;margin:-7px"><span class="material-icons" style="font-size:14px">${hideProjected ? "visibility_off" : "visibility"}</span></button>
          </div>
          <p id="sim-projected" class="font-black tracking-tight tabular-nums ${hideProjected ? "text-white" : simProj >= 0 ? "text-amber-200" : "text-rose-400"}" style="font-size:34px;line-height:1.1">${hid(sp(simProj))}</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          ${tile("account_balance_wallet", "text-amber-300", `<span class="truncate min-w-0">current money on hand</span>`, `<span id="sim-cash" class="text-base font-extrabold tabular-nums truncate text-white">${peso(rmS.cash)}</span>`, "", true)}
          ${tile("south_west", "text-emerald-300", "to receive", `<span class="text-base font-extrabold tabular-nums truncate text-emerald-400">${signedPeso(simT.sToReceive)}</span>`)}
          ${tile("north_east", "text-rose-300", "to pay", `<span class="text-base font-extrabold tabular-nums truncate text-rose-400">${signedPeso(-simT.sToPay)}</span>`)}
        </div>
      </div>
      ${next5CardHtml()}
      ${runwayCardHtml()}
      <div class="min-w-0" id="sec-simulated" style="scroll-margin-top:5.5rem">${personSectionHtml("simulated", false)}</div>
    </div>`;
    applyPersistedDetails();
    return;
  }
  const next5Html = next5CardHtml();
  $("budget-body").innerHTML = `
    <div class="w-full flex flex-col gap-2 budget-pad">
      ${welcomeHtml()}
      <!-- Projected card with the 6-month outlook to its right (stacked on phones) -->
      <div id="projected-row" class="w-full grid grid-cols-1 ${next5Html ? "md:grid-cols-2" : ""} gap-2 items-stretch min-w-0">
        ${kpiBar}
        ${next5Html}
        <div id="reminders-slot">${upcomingBillsWidgetHtml()}</div>
      </div>
      <!-- One scrolling column at every width (columns dissolve via contents, cards use order-N). -->
      <div class="w-full grid grid-cols-1 gap-2.5 items-stretch">
        <!-- Col 1: Liquid Accounts & Debt -->
        <div class="contents">
          <div class="order-1 grid ${showC && showP ? "grid-cols-2 acct-pair" : "grid-cols-1"} gap-2.5 items-start min-w-0" style="scroll-margin-top:5.5rem">
            ${showC ? `<div class="min-w-0" id="sec-accounts">${accountsCardHtml("charlie")}</div>` : ""}
            ${showP ? `<div class="min-w-0" id="sec-accounts-partner">${accountsCardHtml("partner")}</div>` : ""}
          </div>
        </div>

        <!-- Charlie's budget (left) and partner's budget (right on wide screens, stacked on phones) -->
        <div class="order-2 grid grid-cols-1 ${showC && showP ? "md:grid-cols-2" : ""} gap-2.5 items-start min-w-0">
          ${showC ? `<div class="flex flex-col gap-2 min-w-0" id="sec-budget" style="scroll-margin-top:5.5rem">
            ${personSectionHtml("charlie", true)}
            <div id="card-summary-slot" class="contents">${cardSummaryHtml()}</div>
          </div>` : ""}
          ${showP ? `<div class="flex flex-col gap-2 min-w-0" id="sec-partner" style="scroll-margin-top:5.5rem">
            ${personSectionHtml("partner", true)}
          </div>` : ""}
        </div>

      </div>
    </div>
  `;
  applyPersistedDetails();
  if (document.getElementById("tip-card")) document.querySelector("#budget-body .item-row[data-action=openItemModal]")?.classList.add("nudge-hint");
}

// Cards/sections remember whether they were left open or collapsed
const CARDS_KEY = "moneyku_cards";
let persistBound = false;
function readCards() { try { return JSON.parse(localStorage.getItem(CARDS_KEY) || "{}"); } catch { return {}; } }
// The accounts cards always start collapsed on each app load (toggling still sticks while the app is open)
try { const s = readCards(); delete s.accounts; delete s["accounts-p"]; localStorage.setItem(CARDS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
function applyPersistedDetails() {
  if (!persistBound) {
    persistBound = true;
    document.addEventListener("toggle", (e) => {
      const d = e.target;
      if (!d.matches?.("details[data-persist]")) return;
      const s = readCards();
      s[d.dataset.persist] = d.open;
      try { localStorage.setItem(CARDS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    }, true);
  }
  const s = readCards();
  document.querySelectorAll("#budget-body details[data-persist]").forEach((d) => {
    const v = s[d.dataset.persist];
    if (v !== undefined && d.open !== v) d.open = v;
  });
}

export function renderAll() {
  const appData = getAppData();
  if (!appData) return;
  clampSelected();
  updateHeader();
  renderMonthStrip();
  renderBudget();
  refreshMore();
  fetchInvestmentRates();
}
