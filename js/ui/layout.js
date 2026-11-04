import { $, BANK_DOMAINS, BANK_LABELS, BRAND_DOMAINS, CATEGORY_LABELS, HORIZON, MONTHS, MONTHS_SHORT, OWNERS, PM_LABELS, addMonths, bankIconFor, brandIconFor, categoryIcon, cmpKey, currentKey, dueDayFor, escapeHtml, generateId, iconFor, keyParts, mkKey, monthName, monthShort, monthsInclusive, ordinal, parseDueDay, parseMathAmount, peso, signedPeso } from '../utils.js';
import { accountsTotal, allInstallments, amountIn, childFinal, clampSelected, currentMoneyAt, findItemById, findItemOrChildById, getActiveEdit, getAppData, getHideInvestments, getHideProjected, getItems, getKids, getOverviewPage, getSelectedKey, getSpendList, hasOverride, isPaid, itemActiveIn, itemAmts, itemCategory, itemFinal, itemTotal, monthTotals, monthsPaidCount, runningFundsAt, setActiveEdit, setAppData, setHideInvestments, setHideProjected, setOverviewPage, setSelectedKey, sortItems, spentIn, timeline } from '../state.js';
import { syncSet } from '../firebase.js';
import { activityCalendarCardHtml } from '../calendar.js';
import { budgetsCardHtml, compareCardHtml, dueSoonCardHtml } from '../insights.js';
import { tipCardHtml } from '../extras.js';
import { renderProjectionChart } from '../charts.js';
import { accountsCardHtml, debtTrackerCardHtml, fetchInvestmentRates, installmentsCardHtml, investmentsCardHtml, monthOverviewCardHtml, personSectionHtml, projectionCardHtml, statsGridHtml } from './components.js';
import { renderMonthStrip, toggleProjected, updateHeader } from './actions.js';

// =============================
// Dashboard Main Renderer
// =============================
const wrap = (cls, html) => (html ? `<div class="${cls}">${html}</div>` : "");

export function renderBudget() {
  const pb = document.getElementById("budget-body");
  const k = getSelectedKey();
  const t = monthTotals(k);
  const projected = runningFundsAt(k);
  const hideProjected = getHideProjected();
  const current = currentMoneyAt();
  const savColor = t.savings > 0.005 ? "text-emerald-400" : t.savings < -0.005 ? "text-rose-400" : "text-amber-300";

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

      <!-- KPI Metrics (collapsed by default; headline shows savings) -->
      <details data-persist="kpi" class="group">
      <summary class="flex items-center justify-between cursor-pointer list-none select-none px-1">
        <span class="text-[10px] font-bold text-slate-400">Left this month <span class="text-sm font-black ${savColor}">${signedPeso(t.savings)}</span></span>
        <span class="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">Details<span class="material-icons transition-transform group-open:rotate-180" style="font-size:14px">expand_more</span></span>
      </summary>
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
    <div class="w-full flex flex-col gap-2 pb-[calc(9rem+env(safe-area-inset-bottom))]">
      ${kpiBar}
      ${tipCardHtml()}
      ${dueSoonCardHtml()}
      <!-- One scrolling column at every width (columns dissolve via contents, cards use order-N). -->
      <div class="w-full grid grid-cols-1 gap-2.5 items-stretch">
        <!-- Col 1: Liquid Accounts & Debt -->
        <div class="contents">
          <div class="order-1" id="sec-accounts" style="scroll-margin-top:5.5rem">${accountsCardHtml()}</div>
          <div class="order-[6]">${debtTrackerCardHtml()}</div>
        </div>

        <!-- Col 2: Charlie's Monthly Budget -->
        <div class="order-2 flex flex-col min-w-0" id="sec-budget" style="scroll-margin-top:5.5rem">
          ${personSectionHtml("charlie", false)}
        </div>

        <!-- Col 3: Recurring payments (installments, investments, forecast and overview live in the Overview sheet) -->
        <div class="contents">
          ${wrap("order-[3]", budgetsCardHtml())}
          ${wrap("order-[3]", compareCardHtml())}
          <div class="order-[4]" id="sec-calendar" style="scroll-margin-top:5.5rem">${activityCalendarCardHtml()}</div>
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