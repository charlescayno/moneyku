// =============================
// Bill Calendar & Due Date Timeline Widget
// =============================

import {
  peso,
  escapeHtml,
  ordinal,
  dueDayFor,
  keyParts,
  monthName,
  monthShort,
  currentKey,
  $,
} from "./utils.js";
import {
  getItems,
  itemActiveIn,
  itemTotal,
  isPaid,
  getKids,
  getSelectedKey,
} from "./state.js";

// Returns active items that have a due date in month k
export function getMonthBillSchedule(k) {
  const { y, m } = keyParts(k);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const scheduleByDay = {};
  
  for (let d = 1; d <= daysInMonth; d++) {
    scheduleByDay[d] = {
      day: d,
      bills: [],
      incomes: [],
      totalExpenses: 0,
      totalIncome: 0,
    };
  }

  // Gather Expenses
  for (const who of ["charlie", "debt"]) {
    for (const it of getItems(who, "expenses")) {
      if (!itemActiveIn(it, k)) continue;
      const dd = dueDayFor(it);
      let day = dd;
      if (!day && it.txDate) {
        const parts = it.txDate.split("-");
        if (parts.length === 3) day = parseInt(parts[2], 10);
      }
      if (day && day >= 1 && day <= daysInMonth) {
        const amt = itemTotal(it, k);
        const settled = isPaid(it.id, k);
        scheduleByDay[day].bills.push({
          id: it.id,
          name: it.name,
          amount: amt,
          paid: settled,
          who,
          paymentMethod: it.paymentMethod,
          isParent: getKids(it).length > 0
        });
        scheduleByDay[day].totalExpenses += amt;
      }
    }
  }

  // Gather Incomes
  for (const who of ["charlie", "debt"]) {
    for (const it of getItems(who, "income")) {
      if (!itemActiveIn(it, k)) continue;
      const dd = dueDayFor(it);
      if (dd && dd >= 1 && dd <= daysInMonth) {
        const amt = itemTotal(it, k);
        const settled = isPaid(it.id, k);
        scheduleByDay[dd].incomes.push({
          id: it.id,
          name: it.name,
          amount: amt,
          paid: settled,
          who
        });
        scheduleByDay[dd].totalIncome += amt;
      }
    }
  }

  return { daysInMonth, scheduleByDay, year: y, monthIndex: m };
}

// Finds bills due within the next N days
export function getUpcomingBills(daysWindow = 7) {
  const curK = currentKey();
  const today = new Date();
  const currentDay = today.getDate();
  const { scheduleByDay, daysInMonth } = getMonthBillSchedule(curK);
  
  const upcoming = [];
  
  // Check from today up to today + daysWindow
  for (let offset = 0; offset <= daysWindow; offset++) {
    const checkDay = currentDay + offset;
    if (checkDay <= daysInMonth) {
      const dayData = scheduleByDay[checkDay];
      if (dayData && dayData.bills.length > 0) {
        for (const b of dayData.bills) {
          if (!b.paid) {
            upcoming.push({
              ...b,
              dueDay: checkDay,
              daysDiff: offset,
              isOverdue: false,
            });
          }
        }
      }
    }
  }

  // Also check for any overdue bills (past due day in current month and still unpaid)
  for (let d = 1; d < currentDay; d++) {
    const dayData = scheduleByDay[d];
    if (dayData && dayData.bills.length > 0) {
      for (const b of dayData.bills) {
        if (!b.paid) {
          upcoming.unshift({
            ...b,
            dueDay: d,
            daysDiff: d - currentDay,
            isOverdue: true,
          });
        }
      }
    }
  }

  return upcoming;
}

// Upcoming Bills banner widget HTML on dashboard
export function upcomingBillsWidgetHtml() {
  const upcoming = getUpcomingBills(7);
  if (!upcoming.length) return "";

  const totalDueSoon = upcoming.reduce((sum, b) => sum + b.amount, 0);

  const billChips = upcoming.slice(0, 4).map(b => {
    let badgeText = "";
    let badgeClass = "";
    if (b.isOverdue) {
      badgeText = `Overdue (${ordinal(b.dueDay)})`;
      badgeClass = "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    } else if (b.daysDiff === 0) {
      badgeText = "Due Today!";
      badgeClass = "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse";
    } else if (b.daysDiff === 1) {
      badgeText = "Due Tomorrow";
      badgeClass = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
    } else {
      badgeText = `Due in ${b.daysDiff}d (${ordinal(b.dueDay)})`;
      badgeClass = "bg-slate-700/60 text-slate-300 border border-slate-600/40";
    }

    return `
      <div class="flex items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-200 truncate">${escapeHtml(b.name)}</span>
            <span class="text-[9px] font-black px-1.5 py-0.5 rounded ${badgeClass} uppercase tracking-wider">${badgeText}</span>
          </div>
          <p class="text-[10px] text-slate-400 font-medium mt-0.5">${b.paymentMethod === 'bpi_platinum' ? '💳 BPI Platinum' : (b.who === 'debt' ? 'Debt / Owed' : 'Expense')}</p>
        </div>
        <div class="flex items-center gap-2.5 flex-shrink-0">
          <span class="text-xs font-black text-white">${peso(b.amount)}</span>
          <button data-action="togglePaidQuick" data-arg0="${b.id}" data-arg1="expenses" title="Mark paid" class="w-7 h-7 rounded-lg border border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
            <span class="material-icons text-slate-400 hover:text-emerald-400" style="font-size:16px">check</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="md:col-span-2 glass-card rounded-2xl p-4 border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 to-slate-900 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <span class="material-icons text-indigo-400" style="font-size: 16px">notifications_active</span>
          </div>
          <div>
            <h4 class="text-xs font-black text-white uppercase tracking-wider">Upcoming &amp; Due Bills</h4>
            <p class="text-[10px] text-indigo-300/80 font-bold">${upcoming.length} bill${upcoming.length > 1 ? 's' : ''} due soon · ${peso(totalDueSoon)}</p>
          </div>
        </div>
        <button data-action="openCalendarModal" class="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-[10px] font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1 transition-all">
          <span class="material-icons" style="font-size:13px">calendar_month</span>
          <span>Timeline</span>
        </button>
      </div>
      <div class="space-y-2">
        ${billChips}
      </div>
    </div>
  `;
}

// Full monthly calendar modal
export function renderCalendarModal(k) {
  const { scheduleByDay, daysInMonth, year, monthIndex } = getMonthBillSchedule(k);
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let gridCellsHtml = "";

  // Leading blank cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    gridCellsHtml += `<div class="aspect-square bg-slate-900/20 rounded-xl opacity-20 border border-transparent"></div>`;
  }

  const today = new Date();
  const isCurMonth = (today.getFullYear() === year && today.getMonth() === monthIndex);
  const todayDate = isCurMonth ? today.getDate() : -1;

  for (let d = 1; d <= daysInMonth; d++) {
    const data = scheduleByDay[d];
    const isToday = (d === todayDate);
    const hasBills = data.bills.length > 0;
    const hasIncome = data.incomes.length > 0;
    const allBillsPaid = hasBills && data.bills.every(b => b.paid);

    let dotBadges = "";
    if (hasBills) {
      dotBadges += `<div class="flex items-center gap-1 mt-1">
        <span class="w-2 h-2 rounded-full ${allBillsPaid ? 'bg-slate-600' : 'bg-rose-400'} flex-shrink-0"></span>
        <span class="text-[9px] font-black ${allBillsPaid ? 'text-slate-500 line-through' : 'text-rose-300'} truncate">${peso(data.totalExpenses)}</span>
      </div>`;
    }
    if (hasIncome) {
      dotBadges += `<div class="flex items-center gap-1 mt-0.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
        <span class="text-[9px] font-black text-emerald-300 truncate">+${peso(data.totalIncome)}</span>
      </div>`;
    }

    const cellBorder = isToday 
      ? "ring-2 ring-indigo-400 bg-indigo-950/40" 
      : (hasBills && !allBillsPaid ? "border-rose-500/20 bg-slate-900/70" : "border-white/5 bg-slate-900/40");

    gridCellsHtml += `
      <div class="aspect-square p-1.5 rounded-xl border ${cellBorder} flex flex-col justify-between overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black ${isToday ? 'text-indigo-400 font-extrabold' : 'text-slate-400'}">${d}</span>
          ${isToday ? '<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>' : ''}
        </div>
        <div class="flex-1 flex flex-col justify-end">
          ${dotBadges}
        </div>
      </div>
    `;
  }

  // List of all scheduled events for the month
  const scheduledList = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const data = scheduleByDay[d];
    if (data.bills.length || data.incomes.length) {
      scheduledList.push(data);
    }
  }

  const listItemsHtml = scheduledList.length ? scheduledList.map(dayData => {
    const d = dayData.day;
    const billsRows = dayData.bills.map(b => `
      <div class="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-900/40">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full ${b.paid ? 'bg-slate-600' : 'bg-rose-400'}"></span>
          <span class="text-xs font-bold ${b.paid ? 'text-slate-500 line-through' : 'text-slate-200'} truncate">${escapeHtml(b.name)}</span>
        </div>
        <span class="text-xs font-black ${b.paid ? 'text-slate-500 line-through' : 'text-rose-400'}">${peso(b.amount)}</span>
      </div>
    `).join("");

    const incomeRows = dayData.incomes.map(inc => `
      <div class="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-900/40">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full ${inc.paid ? 'bg-slate-600' : 'bg-emerald-400'}"></span>
          <span class="text-xs font-bold ${inc.paid ? 'text-slate-500 line-through' : 'text-slate-200'} truncate">${escapeHtml(inc.name)}</span>
        </div>
        <span class="text-xs font-black ${inc.paid ? 'text-slate-500 line-through' : 'text-emerald-400'}">+${peso(inc.amount)}</span>
      </div>
    `).join("");

    return `
      <div class="p-3 bg-slate-800/60 rounded-xl border border-white/5 space-y-1.5">
        <div class="flex items-center justify-between border-b border-white/5 pb-1">
          <span class="text-[11px] font-black uppercase text-indigo-400 tracking-wider">${monthShort(k)} ${ordinal(d)}</span>
          <span class="text-[10px] font-bold text-slate-400">${dayData.totalExpenses > 0 ? peso(dayData.totalExpenses) + ' due' : ''}</span>
        </div>
        ${billsRows}
        ${incomeRows}
      </div>
    `;
  }).join("") : `<p class="text-center text-xs text-slate-500 py-4">No scheduled bills or income due dates configured for this month.</p>`;

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-7 gap-1 text-center mb-1">
        ${dayNames.map(name => `<span class="text-[9px] font-black uppercase text-slate-500 tracking-wider">${name}</span>`).join("")}
      </div>
      <div class="grid grid-cols-7 gap-1">
        ${gridCellsHtml}
      </div>
      
      <div class="pt-4 border-t border-white/10 space-y-3">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Payment Schedule Breakdown</h4>
        <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
          ${listItemsHtml}
        </div>
      </div>
    </div>
  `;
}

export function openCalendarModal() {
  const k = getSelectedKey() || currentKey();
  const host = $("calendar-body");
  if (host) {
    host.innerHTML = renderCalendarModal(k);
  }
  const title = $("calendar-title");
  if (title) {
    title.textContent = `${monthName(k)} ${keyParts(k).y} Due Calendar`;
  }
  const ov = $("calendar-overlay");
  if (ov) ov.classList.add("open");
}

export function closeCalendarModal() {
  const ov = $("calendar-overlay");
  if (ov) ov.classList.remove("open");
}
