import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { renderProjectionChart } from '../charts.js';
import { accountsCardHtml, debtTrackerCardHtml, fetchInvestmentRates, installmentsCardHtml, investmentsCardHtml, monthOverviewCardHtml, personSectionHtml, projectionCardHtml, statsGridHtml } from './components.js';
import { renderMonthStrip, toggleProjected, updateHeader } from './actions.js';

// =============================
// Dashboard Main Renderer
// =============================
export function renderBudget() {
  const pb = document.getElementById("budget-body");
  if (pb && window.Sortable && !pb.sortableInst) {
    pb.sortableInst = new Sortable(pb, { animation: 150, handle: "summary", ghostClass: "bg-slate-800/50" });
  }
  const k = getSelectedKey();
  const t = monthTotals(k);
  const projected = runningFundsAt(k);
  const hideProjected = getHideProjected();
  const current = currentMoneyAt();
  const savColor = t.savings > 0.005 ? "text-emerald-400" : t.savings < -0.005 ? "text-rose-400" : "text-amber-300";
  const instCard = installmentsCardHtml();

  const kpiBar = `
    <div class="w-full bg-slate-900/80 backdrop-blur-md border border-indigo-500/20 rounded-xl px-3 py-1.5 flex items-center justify-between gap-3 shadow-md flex-shrink-0">
      <!-- Projected Hero Stat -->
      <div class="flex items-center gap-2 pr-3 border-r border-white/10 flex-shrink-0">
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

      <!-- KPI Metrics Grid -->
      <div class="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5 items-center">
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
        <div class="bg-black/20 rounded-lg px-2 py-1 flex items-center justify-between col-span-2 sm:col-span-4 lg:col-span-1">
          <span class="text-[8px] font-bold uppercase text-slate-400">Debt Net</span>
          <span class="text-xs font-black ${(t.debtToReceive - t.debtToPay) >= 0 ? 'text-indigo-300' : 'text-orange-300'}">${signedPeso(t.debtToReceive - t.debtToPay)}</span>
        </div>` : ''}
      </div>
    </div>
  `;

  $("budget-body").innerHTML = `
    <div class="w-full h-full min-h-0 flex flex-col gap-2 overflow-hidden">
      ${kpiBar}
      <div class="w-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 items-stretch overflow-y-auto xl:overflow-hidden no-scrollbar">
        <!-- Col 1: Accounts & Debt -->
        <div class="h-full min-h-0 flex flex-col gap-2 overflow-y-auto no-scrollbar flex-shrink-0 min-w-[260px] xl:min-w-0">
          ${accountsCardHtml()}
          ${debtTrackerCardHtml()}
        </div>

        <!-- Col 2: Charlie's Budget -->
        <div class="h-full min-h-0 flex flex-col overflow-hidden flex-shrink-0 min-w-[280px] xl:min-w-0">
          ${personSectionHtml("charlie", false)}
        </div>

        <!-- Col 3: Investments & Installments -->
        <div class="h-full min-h-0 flex flex-col gap-2 overflow-y-auto no-scrollbar flex-shrink-0 min-w-[260px] xl:min-w-0">
          ${investmentsCardHtml()}
          ${instCard ? instCard : ''}
        </div>

        <!-- Col 4: Projection & Overview Forecast -->
        <div class="h-full min-h-0 flex flex-col gap-2 overflow-y-auto no-scrollbar flex-shrink-0 min-w-[260px] xl:min-w-0">
          ${projectionCardHtml()}
          ${monthOverviewCardHtml()}
        </div>
      </div>
    </div>
  `;

  // Render projection chart
  setTimeout(() => {
    if (typeof renderProjectionChart === "function") {
      renderProjectionChart();
    }
  }, 20);
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