import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { dueSoonCardHtml, realMoney } from '../insights.js';
import { tipCardHtml } from '../extras.js';
import { accountsCardHtml, debtTrackerCardHtml, fetchInvestmentRates, householdCardHtml, installmentsCardHtml, investmentsCardHtml, monthOverviewCardHtml, personSectionHtml, statsGridHtml } from './components.js';
import { renderMonthStrip, toggleProjected, updateHeader } from './actions.js';
import { cardSummaryHtml } from './cardui.js';
import { cardDueIn } from '../card.js';

// =============================
// Dashboard Main Renderer
// =============================
export function renderBudget() {
  const pb = document.getElementById("budget-body");
  const k = getSelectedKey();
  const t = monthTotals(k);
  const projected = runningFundsAt(k);
  const hideProjected = getHideProjected();
  const current = currentMoneyAt();
  const savColor = t.savings > 0.005 ? "text-emerald-400" : t.savings < -0.005 ? "text-rose-400" : "text-amber-300";

  const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
  const rm = realMoney();
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
    <div class="w-full bg-slate-900/80 backdrop-blur-md border border-indigo-500/20 rounded-xl px-3 py-2 flex flex-col items-stretch gap-2 shadow-md flex-shrink-0">
      <!-- Projected Hero Stat -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <span class="material-icons" style="font-size:14px">account_balance</span>
        </div>
        <div>
          <div class="flex items-center gap-1">
            <span class="text-[8px] font-black uppercase tracking-wider text-indigo-300">Projected (${monthShort(k)})</span>
            <button data-action="toggleProjected" class="text-white/40 hover:text-white transition-colors focus:outline-none flex items-center">
              <span class="material-icons" style="font-size: 11px">${hideProjected ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p id="sum-projected" class="text-sm sm:text-base font-black text-white leading-tight">${hideProjected ? '••••••' : peso(projected)}</p>
        </div>
      </div>
      ${cardNote}

      <!-- KPI Metrics (collapsed by default; headline shows savings) -->
      <details data-persist="kpi" class="group">
      <summary class="flex items-center justify-between cursor-pointer list-none select-none px-1">
        <span class="text-[10px] font-bold text-slate-400">Real money <span class="text-xl font-black ${rm.real >= 0 ? "text-white" : "text-rose-400"}">${sp(rm.real)}</span></span>
        <span class="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">Details<span class="material-icons transition-transform group-open:rotate-180" style="font-size:14px">expand_more</span></span>
      </summary>
      <div class="mt-1.5 rounded-lg bg-black/20 px-2.5 py-1.5 space-y-1 text-[11px]">
        <div class="flex justify-between"><span class="text-slate-400">Cash &amp; bank</span><span class="font-black text-white">${peso(rm.cash)}</span></div>
        ${rm.owed.total > 0 ? `<div class="flex justify-between"><span class="text-slate-400">BPI Platinum owed</span><span class="font-black text-rose-300">-${peso(rm.owed.total)}</span></div>
        ${owedBreak ? `<p class="text-[9px] text-slate-500 text-right">${owedBreak}</p>` : ""}` : ""}
        <div class="flex justify-between border-t border-white/10 pt-1"><span class="text-slate-400">After remaining income &amp; bills</span><span class="font-black ${rm.afterAll >= 0 ? "text-emerald-300" : "text-rose-400"}">${sp(rm.afterAll)}</span></div>
      </div>
      <details data-persist="kpi-how" class="group/h mt-1.5 rounded-lg bg-black/20">
        <summary class="flex items-center gap-1 px-2.5 py-1.5 cursor-pointer list-none select-none text-[11px] font-bold text-indigo-300"><span class="material-icons" style="font-size:14px">help_outline</span>How is this calculated?<span class="material-icons ml-auto transition-transform group-open/h:rotate-180" style="font-size:14px">expand_more</span></summary>
        <div class="px-2.5 pb-2 space-y-1.5 text-[11px] leading-snug text-slate-400">
          <p><b class="text-white">Real money</b> = Cash &amp; bank (${peso(rm.cash)}) &minus; BPI Platinum owed (${peso(rm.owed.total)}) = <b class="text-white">${sp(rm.real)}</b>. It is what you would have left if you paid the card in full today. Income you have not received yet and bills not yet paid are not counted.</p>
          <p><b class="text-white">BPI Platinum owed</b> = card charges made so far (billed statements plus this cycle's charges up to today) that you have not paid with Pay card.</p>
          <p><b class="text-white">After remaining income &amp; bills</b> = Real money + income still to receive this month (${peso(rm.toReceive)}) &minus; the other bills still to pay (${peso(Math.max(0, t.toPay - (rm.owed.byMonth[k] || 0)))}) = <b class="text-white">${sp(rm.afterAll)}</b>.</p>
          <p><b class="text-white">Projected</b> = Cash &amp; bank + income to receive &minus; bills to pay (card bill included) &plus; debts, from this month up to the month you are viewing. It assumes everything arrives and is paid on time.</p>
        </div>
      </details>
      <div class="flex-1 min-w-0 grid grid-cols-2 gap-1.5 items-center mt-1.5">
        <div class="bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between">
          <span class="text-[8px] font-bold uppercase text-slate-400">Current</span>
          <span class="text-xs font-black text-white">${peso(current)}</span>
        </div>
        <div class="bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between">
          <span class="text-[8px] font-bold uppercase text-slate-400">Savings</span>
          <span class="text-xs font-black ${savColor}">${signedPeso(t.savings)}</span>
        </div>
        <div class="bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between">
          <span class="text-[8px] font-bold uppercase text-slate-400">To Receive</span>
          <span class="text-xs font-black text-emerald-400">${signedPeso(t.toReceive)}</span>
        </div>
        <div class="bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between">
          <span class="text-[8px] font-bold uppercase text-slate-400">To Pay</span>
          <span class="text-xs font-black text-rose-400">${signedPeso(-t.toPay)}</span>
        </div>
        ${(Math.abs(t.debtToReceive) > 0.005 || Math.abs(t.debtToPay) > 0.005) ? `
        <div class="bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between col-span-2">
          <span class="text-[8px] font-bold uppercase text-slate-400">Debt Net</span>
          <span class="text-xs font-black ${(t.debtToReceive - t.debtToPay) >= 0 ? 'text-indigo-300' : 'text-orange-300'}">${signedPeso(t.debtToReceive - t.debtToPay)}</span>
        </div>` : ''}
      </div>
      </details>
    </div>
  `;

  $("budget-body").innerHTML = `
    <div class="w-full flex flex-col gap-2 budget-pad">
      ${kpiBar}
      <div id="card-summary-slot" class="contents">${cardSummaryHtml()}</div>
      ${tipCardHtml()}
      ${dueSoonCardHtml()}
      <!-- One scrolling column at every width (columns dissolve via contents, cards use order-N). -->
      <div class="w-full grid grid-cols-1 gap-2.5 items-stretch">
        <!-- Col 1: Liquid Accounts & Debt -->
        <div class="contents">
          <div class="order-1" id="sec-accounts" style="scroll-margin-top:5.5rem">${accountsCardHtml()}</div>
          <div class="order-[6]">${debtTrackerCardHtml()}</div>
        </div>

        <!-- Charlie's budget (left) and partner's budget (right on wide screens, stacked on phones) -->
        <div class="order-2 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start min-w-0">
          <div class="flex flex-col min-w-0" id="sec-budget" style="scroll-margin-top:5.5rem">
            ${personSectionHtml("charlie", false)}
          </div>
          <div class="flex flex-col min-w-0" id="sec-partner" style="scroll-margin-top:5.5rem">
            ${personSectionHtml("partner", false)}
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