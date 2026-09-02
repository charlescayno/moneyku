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

  const summary = `<section class="rounded-2xl overflow-hidden relative shadow-lg w-full flex-shrink-0">
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700"></div>
    <div class="ambient-glow" style="top:-20px;right:40px"></div>
    <div class="relative p-4 md:p-5 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="text-[9px] font-black uppercase tracking-[0.25em] text-white/70">Projected · end of ${monthName(k)}</p>
            <button data-action="toggleProjected" class="text-white/50 hover:text-white transition-colors focus:outline-none flex items-center justify-center">
              <span class="material-icons" style="font-size: 13px">${hideProjected ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p id="sum-projected" class="text-2xl sm:text-3xl font-black text-white mt-0.5 leading-none truncate">${hideProjected ? '••••••' : peso(projected)}</p>
        </div>
      </div>
      <div id="sum-stats" class="grid grid-cols-2 gap-2">${statsGridHtml(t)}</div>
      ${(Math.abs(t.debtToReceive) > 0.005 || Math.abs(t.debtToPay) > 0.005) ? `
      <div id="debt-stats" class="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10">
        <div class="bg-black/20 rounded-xl px-2.5 py-1.5">
          <div class="flex items-center gap-1">
            <span class="material-icons text-indigo-300" style="font-size:11px">arrow_downward</span>
            <p class="text-[8px] font-bold uppercase text-white/60">Owed To Me</p>
          </div>
          <p class="text-xs font-black text-indigo-300 mt-0.5">${signedPeso(t.debtToReceive)}</p>
        </div>
        <div class="bg-black/20 rounded-xl px-2.5 py-1.5">
          <div class="flex items-center gap-1">
            <span class="material-icons text-orange-300" style="font-size:11px">arrow_upward</span>
            <p class="text-[8px] font-bold uppercase text-white/60">I Owe</p>
          </div>
          <p class="text-xs font-black text-orange-300 mt-0.5">${signedPeso(-t.debtToPay)}</p>
        </div>
      </div>` : ''}
    </div>
  </section>`;

  const instCard = installmentsCardHtml();

  $("budget-body").innerHTML = `
    <div class="w-full h-full min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-stretch overflow-x-auto xl:overflow-hidden no-scrollbar">
      <!-- Col 1: Overview & Balances -->
      <div class="h-full min-h-0 flex flex-col gap-3 overflow-y-auto no-scrollbar flex-shrink-0 min-w-[280px] xl:min-w-0">
        ${summary}
        ${accountsCardHtml()}
      </div>

      <!-- Col 2: Charlie's Budget -->
      <div class="h-full min-h-0 flex flex-col overflow-hidden flex-shrink-0 min-w-[300px] xl:min-w-0">
        ${personSectionHtml("charlie", false)}
      </div>

      <!-- Col 3: Investments & Liabilities -->
      <div class="h-full min-h-0 flex flex-col gap-3 overflow-y-auto no-scrollbar flex-shrink-0 min-w-[280px] xl:min-w-0">
        ${investmentsCardHtml()}
        ${instCard ? instCard : ''}
        ${debtTrackerCardHtml()}
      </div>

      <!-- Col 4: Forecast & Intelligence -->
      <div class="h-full min-h-0 flex flex-col gap-3 overflow-y-auto no-scrollbar flex-shrink-0 min-w-[280px] xl:min-w-0">
        ${projectionCardHtml()}
        ${monthOverviewCardHtml()}
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