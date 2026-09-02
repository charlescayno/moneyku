import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { renderProjectionChart } from '../charts.js';
import { accountsCardHtml, fetchInvestmentRates, installmentsCardHtml, investmentsCardHtml, monthOverviewCardHtml, personSectionHtml, projectionCardHtml, statsGridHtml } from './components.js';
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

  const summary = `<section class="rounded-3xl overflow-hidden relative shadow-xl w-full">
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-700"></div>
    <div class="ambient-glow" style="top:-30px;right:60px"></div>
    <div class="relative p-6 md:p-7 space-y-5">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Projected · end of ${monthName(k)}</p>
            <button data-action="toggleProjected" class="text-white/40 hover:text-white transition-colors focus:outline-none flex items-center justify-center">
              <span class="material-icons" style="font-size: 14px">${hideProjected ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p id="sum-projected" class="text-3xl sm:text-4xl md:text-5xl font-black text-white mt-1 leading-none truncate">${hideProjected ? '••••••' : peso(projected)}</p>
        </div>
      </div>
      <div id="sum-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3">${statsGridHtml(t)}</div>
      ${(Math.abs(t.debtToReceive) > 0.005 || Math.abs(t.debtToPay) > 0.005) ? `
      <div id="debt-stats" class="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
        <div class="bg-black/20 rounded-2xl px-4 py-3">
          <div class="flex items-center gap-1.5">
            <span class="material-icons text-indigo-300" style="font-size:13px">arrow_downward</span>
            <p class="text-[9px] font-bold uppercase text-white/60">Owed To Me</p>
          </div>
          <p class="text-base font-black text-indigo-300 mt-1">${signedPeso(t.debtToReceive)}</p>
        </div>
        <div class="bg-black/20 rounded-2xl px-4 py-3">
          <div class="flex items-center gap-1.5">
            <span class="material-icons text-orange-300" style="font-size:13px">arrow_upward</span>
            <p class="text-[9px] font-bold uppercase text-white/60">I Owe Others</p>
          </div>
          <p class="text-base font-black text-orange-300 mt-1">${signedPeso(-t.debtToPay)}</p>
        </div>
      </div>` : ''}
    </div>
  </section>`;

  const instCard = installmentsCardHtml();

  $("budget-body").innerHTML = `
    <div class="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div class="lg:col-span-7 space-y-5">
        ${summary}
        ${personSectionHtml("charlie")}
      </div>
      <div class="lg:col-span-5 space-y-5">
        ${accountsCardHtml()}
        ${investmentsCardHtml()}
        ${instCard ? instCard : ''}
        ${monthOverviewCardHtml()}
        ${projectionCardHtml()}
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