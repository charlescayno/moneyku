import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, householdProjectedAt, projectionBreakdown, includedWho, monthFlow, outlookKeys, outlookRows, firstNegative, staleBalanceDays, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { householdRealMoney, realMoney } from '../insights.js';
import { tipCardHtml } from '../extras.js';
import { accountsCardHtml, debtTrackerCardHtml, fetchInvestmentRates, householdCardHtml, installmentsCardHtml, investmentsCardHtml, monthOverviewCardHtml, personSectionHtml, statsGridHtml } from './components.js';
import { renderMonthStrip, toggleProjected, updateHeader } from './actions.js';
import { cardSummaryHtml } from './cardui.js';
import { cardDueIn } from '../card.js';
import { next5CardHtml } from './next5.js';

// =============================
// Dashboard Main Renderer
// =============================
export function renderBudget() {
  const pb = document.getElementById("budget-body");
  const k = getSelectedKey();
  const t = monthTotals(k);
  const projected = householdProjectedAt(k);
  const hideProjected = getHideProjected();
  // Top-bar switches: who counts in the combined numbers (per-person numbers are always shown)
  const inclW = includedWho();
  const inclBtn = (w) => `<button type="button" data-action="togglePersonIncluded" data-arg0="${w}" aria-pressed="${inclW.includes(w)}" title="${inclW.includes(w) ? "Counted in the combined total · tap to leave out" : "Left out of the combined total · tap to count"}" class="flex items-center focus:outline-none ${inclW.includes(w) ? "text-emerald-300" : "text-amber-300"}"><span class="material-icons" style="font-size:20px">${inclW.includes(w) ? "check_box" : "check_box_outline_blank"}</span></button>`;
  const projC = runningFundsAt(k, "charlie"), projP = runningFundsAt(k, "partner");
  // What the projected number is made of, early warnings, a worst case, and stale-balance nudge
  const pj = projectionBreakdown(k);
  const okeys = outlookKeys();
  const orows = okeys.length ? outlookRows(okeys) : [];
  const neg = firstNegative(orows);
  // Headline color by risk: red if the balance dips below zero in the next 12 months, amber if it gets under a quarter of today's cash, else green
  const lowestBal = orows.length ? Math.min(...orows.map((r) => r.all.bal)) : 0;
  const riskText = hideProjected ? "text-white" : lowestBal < 0 ? "text-rose-400" : lowestBal < 0.25 * pj.cash ? "text-amber-300" : "text-emerald-300";
  // Per-person change vs previous month (▲ / ▼), only for future months
  const pDelta = (w) => {
    if (hideProjected || cmpKey(k, currentKey()) <= 0) return "";
    const n = monthFlow(k, w).net;
    if (Math.abs(n) < 0.5) return "";
    return `<span class="text-[10px] font-bold ${n > 0 ? "text-emerald-300" : "text-rose-300"}" title="Change vs previous month">${n > 0 ? "▲" : "▼"} ${peso(Math.abs(n))}</span>`;
  };
  // Tiny 12-month trend of the combined balance (hidden along with the numbers)
  let sparkHtml = "";
  if (orows.length > 1 && !getHideProjected()) {
    const vals = orows.map((r) => r.all.bal);
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), sp2 = hi - lo || 1;
    const X = (i) => 2 + (i * 96) / (vals.length - 1), Y = (v) => 2 + ((hi - v) / sp2) * 24;
    const d = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
    sparkHtml = `<svg viewBox="0 0 100 28" class="ml-auto w-24 h-7 flex-shrink-0" role="img" aria-label="Projected balance trend, next 12 months" data-action="openOutlook" data-arg0="all">${lo < 0 ? `<line x1="0" x2="100" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#fb7185" stroke-width="1" stroke-dasharray="2 2" opacity=".7"/>` : ""}<path d="${d}" fill="none" stroke="${Math.min(...vals) < 0 ? "#fb7185" : "#a5b4fc"}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  const worstCase = outlookRows([k], { cons: true })[0].all.bal;
  const staleDays = Math.max(staleBalanceDays("charlie") ?? -1, staleBalanceDays("partner") ?? -1);
  const projChip = (cls, txt) => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}">${txt}</span>`;
  // Chips in priority order: below zero, then stale balances, then the monthly change, then "all good".
  // Only the first shows on the card; the rest live in the details below.
  const projChips = [];
  if (neg.all) projChips.push(projChip("bg-rose-500/20 text-rose-300", `Goes below zero in ${monthShort(neg.all)}`));
  else if (neg.charlie || neg.partner) {
    if (neg.charlie) projChips.push(projChip("bg-rose-500/20 text-rose-300", `${OWNERS.charlie.label} below zero in ${monthShort(neg.charlie)}`));
    if (neg.partner) projChips.push(projChip("bg-rose-500/20 text-rose-300", `${OWNERS.partner.label} below zero in ${monthShort(neg.partner)}`));
  }
  if (staleDays > 7) projChips.push(projChip("bg-amber-500/20 text-amber-200", `Oldest balance updated ${staleDays}d ago`));
  if (pj.delta != null && !hideProjected) projChips.push(projChip(pj.delta >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300", `${pj.delta >= 0 ? "+" : "-"}${peso(Math.abs(pj.delta))} vs prev. month`));
  if (!neg.all && !neg.charlie && !neg.partner && okeys.length) projChips.push(projChip("bg-emerald-500/15 text-emerald-300", "Stays above zero · next 12 months"));
  const current = currentMoneyAt();
  const savColor = t.savings > 0.005 ? "text-emerald-400" : t.savings < -0.005 ? "text-rose-400" : "text-amber-300";

  const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const rm = realMoney("charlie");
  const rmP = realMoney("partner");
  const rmAll = householdRealMoney();
  // Future months: the projection already deducts every BPI Platinum bill due up to that month, i.e. it assumes they are paid in full. Say so.
  let cardNote = "";
  if (!hideProjected && cmpKey(k, currentKey()) > 0) {
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
  const kpiBar = `
    <div class="w-full bg-slate-900/80 border border-white/5 rounded-3xl px-4 py-4 flex flex-col items-stretch gap-3 flex-shrink-0">
      <!-- Projected hero: small label, one big number -->
      <div class="flex flex-col gap-1 px-1">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] font-bold text-slate-400" style="text-transform:lowercase">projected · ${inclW.length === 2 ? "all" : OWNERS[inclW[0]].label + " only"} (${monthShort(k)})</span>
          <button data-action="toggleProjected" aria-label="${hideProjected ? "Show amounts" : "Hide amounts"}" class="text-white/50 hover:text-white transition-colors focus:outline-none flex items-center">
            <span class="material-icons" style="font-size:14px">${hideProjected ? 'visibility_off' : 'visibility'}</span>
          </button>
          <button data-action="openOutlook" data-arg0="all" class="ml-auto flex items-center text-[11px] font-bold text-indigo-300 hover:text-white focus:outline-none">12-mo outlook<span class="material-icons" style="font-size:14px">chevron_right</span></button>
        </div>
        <div class="flex items-end justify-between gap-3">
          <p id="sum-projected" data-action="openOutlook" data-arg0="all" title="Open the 12-month outlook" class="cursor-pointer font-black tracking-tight tabular-nums ${riskText}" style="font-size:38px;line-height:1.05">${hideProjected ? '••••••' : peso(projected)}</p>
          ${sparkHtml}
        </div>
      </div>
      <!-- Four tiles: icon + label above, value below -->
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-black/20 rounded-2xl px-4 py-3 flex flex-col gap-2 min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-indigo-300" style="font-size:15px">account_balance_wallet</span>current money</span><span class="text-lg font-black tabular-nums truncate text-white">${peso(current)}</span></div>
        <div class="bg-black/20 rounded-2xl px-4 py-3 flex flex-col gap-2 min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-emerald-300" style="font-size:15px">savings</span>savings</span><span class="text-lg font-black tabular-nums truncate ${savColor}">${signedPeso(t.savings)}</span></div>
        <div class="bg-black/20 rounded-2xl px-4 py-3 flex flex-col gap-2 min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-emerald-300" style="font-size:15px">south_west</span>to receive</span><span class="text-lg font-black tabular-nums truncate text-emerald-400">${signedPeso(t.toReceive)}</span></div>
        <div class="bg-black/20 rounded-2xl px-4 py-3 flex flex-col gap-2 min-w-0"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-rose-300" style="font-size:15px">north_east</span>to pay</span><span class="text-lg font-black tabular-nums truncate text-rose-400">${signedPeso(-t.toPay)}</span></div>
        ${(Math.abs(t.debtToReceive) > 0.005 || Math.abs(t.debtToPay) > 0.005) ? `<div class="bg-black/20 rounded-2xl px-4 py-3 flex items-center justify-between col-span-2"><span class="flex items-center gap-2 text-[11px] font-bold text-slate-400" style="white-space:nowrap"><span class="material-icons text-indigo-300" style="font-size:15px">swap_horiz</span>debt net</span><span class="text-lg font-black tabular-nums ${(t.debtToReceive - t.debtToPay) >= 0 ? 'text-indigo-300' : 'text-orange-300'}">${signedPeso(t.debtToReceive - t.debtToPay)}</span></div>` : ''}
      </div>      <div class="grid grid-cols-2 gap-1.5">
        <div data-action="togglePersonIncluded" data-arg0="charlie" class="cursor-pointer bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between ${inclW.includes("charlie") ? "" : "border border-dashed border-amber-400/60"}"><span class="flex items-center gap-1.5">${inclBtn("charlie")}<span class="text-[9px] font-bold uppercase text-blue-300">${OWNERS.charlie.label} Projected</span></span><span class="flex items-center gap-1">${pDelta("charlie")}<span id="sum-projected-c" class="text-xs font-black ${projC >= 0 ? "text-white" : "text-rose-400"}">${hideProjected ? "••••" : sp(projC)}</span></span></div>
        <div data-action="togglePersonIncluded" data-arg0="partner" class="cursor-pointer bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between ${inclW.includes("partner") ? "" : "border border-dashed border-amber-400/60"}"><span class="flex items-center gap-1.5">${inclBtn("partner")}<span class="text-[9px] font-bold uppercase text-ynah">${OWNERS.partner.label} Projected</span></span><span class="flex items-center gap-1">${pDelta("partner")}<span id="sum-projected-p" class="text-xs font-black ${projP >= 0 ? "text-white" : "text-rose-400"}">${hideProjected ? "••••" : sp(projP)}</span></span></div>
      </div>
      ${projChips.length ? `<div class="flex flex-wrap gap-1">${projChips[0]}</div>` : ""}
      <details data-persist="proj-details" class="group/pd">
        <summary class="flex items-center gap-1 cursor-pointer list-none select-none text-[11px] font-bold text-slate-400 py-0.5">
          <span class="material-icons transition-transform" style="font-size:15px">chevron_right</span>How is this made up?
        </summary>
        <div class="space-y-1.5 pt-1 pl-1">
          <p class="text-[11px] text-slate-300 leading-snug">${hideProjected ? "Cash &amp; pending hidden" : `Cash <b class="text-white">${peso(pj.cash)}</b> + to receive <b class="text-emerald-300">${peso(pj.inc)}</b> &minus; to pay <b class="text-rose-300">${peso(pj.out)}</b>`}</p>
          ${hideProjected ? "" : `<button type="button" data-action="openOutlook" data-arg0="all" data-arg1="cons" class="text-left text-[11px] text-slate-300 leading-snug">Worst case (recurring income only): <b class="${worstCase >= 0 ? "text-white" : "text-rose-300"}">${sp(worstCase)}</b> <span class="text-indigo-300 font-bold">See why &rsaquo;</span></button>`}
          ${projChips.length > 1 ? `<div class="flex flex-wrap gap-1">${projChips.slice(1).join("")}</div>` : ""}
        </div>
      </details>
      ${cardNote}

      <!-- KPI Metrics (collapsed by default; headline shows savings) -->
      <details data-persist="kpi" class="group">
      <summary class="flex flex-wrap items-center justify-between gap-y-1 cursor-pointer list-none select-none px-1">
        <span class="text-[10px] font-bold text-slate-400">Real money · all <span class="text-xl font-black ${rmAll.real >= 0 ? "text-white" : "text-rose-400"}">${sp(rmAll.real)}</span></span>
        <span class="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">Details<span class="material-icons transition-transform group-open:rotate-180" style="font-size:14px">expand_more</span></span>
        <div class="grid grid-cols-2 gap-2 mt-1.5" style="flex:0 0 100%;width:100%">
          <div class="bg-black/20 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"><span class="text-[9px] font-bold uppercase text-blue-300">${OWNERS.charlie.label}</span><span class="text-xs font-black ${rm.real >= 0 ? "text-white" : "text-rose-400"}">${sp(rm.real)}</span></div>
          <div class="bg-black/20 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2"><span class="text-[9px] font-bold uppercase text-ynah">${OWNERS.partner.label}</span><span class="text-xs font-black ${rmP.real >= 0 ? "text-white" : "text-rose-400"}">${sp(rmP.real)}</span></div>
        </div>
      </summary>
      <div class="mt-1.5 rounded-lg bg-black/20 px-2.5 py-1.5 space-y-1 text-[11px]">
        <p class="text-[9px] font-black uppercase tracking-wider text-blue-300">${OWNERS.charlie.label} real money <span class="text-white normal-case text-[11px]">${sp(rm.real)}</span></p>
        <div class="flex justify-between"><span class="text-slate-400">Cash &amp; bank</span><span class="font-black text-white">${peso(rm.cash)}</span></div>
        ${rm.owed.total > 0 ? `<div class="flex justify-between"><span class="text-slate-400">BPI Platinum owed</span><span class="font-black text-rose-300">-${peso(rm.owed.total)}</span></div>
        ${owedBreak ? `<p class="text-[9px] text-slate-500 text-right">${owedBreak}</p>` : ""}` : ""}
        <div class="flex justify-between border-t border-white/10 pt-1"><span class="text-slate-400">After remaining income &amp; bills</span><span class="font-black ${rm.afterAll >= 0 ? "text-emerald-300" : "text-rose-400"}">${sp(rm.afterAll)}</span></div>
        <p class="text-[9px] font-black uppercase tracking-wider text-ynah border-t border-white/10 pt-1.5">${OWNERS.partner.label} real money <span class="text-white normal-case text-[11px]">${sp(rmP.real)}</span></p>
        <div class="flex justify-between"><span class="text-slate-400">Cash &amp; bank</span><span class="font-black text-white">${peso(rmP.cash)}</span></div>
        <div class="flex justify-between border-t border-white/10 pt-1"><span class="text-slate-400">After remaining income &amp; bills</span><span class="font-black ${rmP.afterAll >= 0 ? "text-emerald-300" : "text-rose-400"}">${sp(rmP.afterAll)}</span></div>
        <div class="flex justify-between border-t border-white/10 pt-1.5"><span class="font-bold text-slate-200">All: real money</span><span class="font-black ${rmAll.real >= 0 ? "text-white" : "text-rose-400"}">${sp(rmAll.real)}</span></div>
        <div class="flex justify-between"><span class="font-bold text-slate-200">All: after remaining</span><span class="font-black ${rmAll.afterAll >= 0 ? "text-emerald-300" : "text-rose-400"}">${sp(rmAll.afterAll)}</span></div>
      </div>
      <details data-persist="kpi-how" class="group/h mt-1.5 rounded-lg bg-black/20">
        <summary class="flex items-center gap-1 px-2.5 py-1.5 cursor-pointer list-none select-none text-[11px] font-bold text-indigo-300"><span class="material-icons" style="font-size:14px">help_outline</span>How is this calculated?<span class="material-icons ml-auto transition-transform group-open/h:rotate-180" style="font-size:14px">expand_more</span></summary>
        <div class="px-2.5 pb-2 space-y-1.5 text-[11px] leading-snug text-slate-400">
          <p class="text-[9px] font-black uppercase tracking-wider text-blue-300">${OWNERS.charlie.label}</p>
          <p><b class="text-white">Real money</b> = Cash &amp; bank (${peso(rm.cash)}) &minus; BPI Platinum owed (${peso(rm.owed.total)}) = <b class="text-white">${sp(rm.real)}</b>. It is what you would have left if you paid the card in full today. Income you have not received yet and bills not yet paid are not counted.</p>
          <p><b class="text-white">BPI Platinum owed</b> = card charges made so far (billed statements plus this cycle's charges up to today) that you have not paid with Pay card.</p>
          <p><b class="text-white">After remaining income &amp; bills</b> = Real money + income still to receive this month (${peso(rm.toReceive)}) &minus; the other bills still to pay (${peso(Math.max(0, t.toPay - (rm.owed.byMonth[k] || 0)))}) = <b class="text-white">${sp(rm.afterAll)}</b>.</p>
          <p class="text-[9px] font-black uppercase tracking-wider text-ynah pt-1">${OWNERS.partner.label}</p>
          <p><b class="text-white">Real money</b> = her Cash &amp; bank (${peso(rmP.cash)}), with no card owed = <b class="text-white">${sp(rmP.real)}</b>. Her income not yet received and bills not yet paid are not counted.</p>
          <p><b class="text-white">After remaining income &amp; bills</b> = her Real money + her income still to receive this month (${peso(rmP.toReceive)}) &minus; her bills still to pay (${peso(rmP.toPay)}) = <b class="text-white">${sp(rmP.afterAll)}</b>.</p>
          <p class="text-[9px] font-black uppercase tracking-wider text-indigo-300 pt-1">All</p>
          <p><b class="text-white">Real money · all</b> = ${sp(rm.real)} + ${sp(rmP.real)} = <b class="text-white">${sp(rmAll.real)}</b>. After remaining income &amp; bills: ${sp(rm.afterAll)} + ${sp(rmP.afterAll)} = <b class="text-white">${sp(rmAll.afterAll)}</b>.</p>
          <p><b class="text-white">Projected</b> = Cash &amp; bank + income to receive &minus; bills to pay (card bill included) &plus; debts, from this month up to the month you are viewing. It assumes everything arrives and is paid on time.</p>
        </div>
      </details>
      </details>
    </div>
  `;

  $("budget-body").innerHTML = `
    <div class="w-full flex flex-col gap-2 budget-pad">
      ${kpiBar}
      ${next5CardHtml()}
      ${tipCardHtml()}
      <!-- One scrolling column at every width (columns dissolve via contents, cards use order-N). -->
      <div class="w-full grid grid-cols-1 gap-2.5 items-stretch">
        <!-- Col 1: Liquid Accounts & Debt -->
        <div class="contents">
          <div class="order-1 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start min-w-0" style="scroll-margin-top:5.5rem">
            <div class="min-w-0" id="sec-accounts">${accountsCardHtml("charlie")}</div>
            <div class="min-w-0" id="sec-accounts-partner">${accountsCardHtml("partner")}</div>
          </div>
        </div>

        <!-- Charlie's budget (left) and partner's budget (right on wide screens, stacked on phones) -->
        <div class="order-2 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start min-w-0">
          <div class="flex flex-col gap-2 min-w-0" id="sec-budget" style="scroll-margin-top:5.5rem">
            <div id="card-summary-slot" class="contents">${cardSummaryHtml()}</div>
            ${personSectionHtml("charlie", true)}
          </div>
          <div class="flex flex-col gap-2 min-w-0" id="sec-partner" style="scroll-margin-top:5.5rem">
            ${personSectionHtml("partner", true)}
          </div>
        </div>
        <div class="order-3" id="sec-household">${householdCardHtml()}</div>

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
  fetchInvestmentRates();
}