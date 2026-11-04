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
  timeline,
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

// =============================
// Activity Calendar (income / expenses / other, per day)
// =============================
let calFilter = "all";   // all | exp | inc | oth
let calSelDay = null;    // selected day number or null

// Everything scheduled in month k as flat entries (items that have a due day / date)
function calEntries(k) {
  const { scheduleByDay, daysInMonth } = getMonthBillSchedule(k);
  const out = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = scheduleByDay[d];
    for (const b of day.bills) out.push({ day: d, name: b.name, amount: b.amount, paid: b.paid, type: "exp", cat: b.who === "debt" ? "oth" : "exp" });
    for (const i of day.incomes) out.push({ day: d, name: i.name, amount: i.amount, paid: i.paid, type: "inc", cat: i.who === "debt" ? "oth" : "inc" });
  }
  return { entries: out, daysInMonth };
}

const CAL_STYLE = {
  exp: "background:rgba(239,68,68,.16);color:#fca5a5;border-left:2px solid #ef4444",
  inc: "background:rgba(16,185,129,.16);color:#6ee7b7;border-left:2px solid #10b981",
  oth: "background:rgba(139,92,246,.18);color:#c4b5fd;border-left:2px solid #8b5cf6",
};

function activityCalInnerHtml() {
  const k = getSelectedKey() || currentKey();
  const { entries: all, daysInMonth } = calEntries(k);
  const { y, m } = keyParts(k);
  const entries = all.filter((e) => calFilter === "all" || e.cat === calFilter);
  const income = entries.filter((e) => e.type === "inc").reduce((s, e) => s + e.amount, 0);
  const outcome = entries.filter((e) => e.type === "exp").reduce((s, e) => s + e.amount, 0);
  const first = new Date(y, m, 1).getDay();
  const now = new Date();
  const todayD = now.getFullYear() === y && now.getMonth() === m ? now.getDate() : -1;
  const tl = timeline();
  const idx = tl.indexOf(k);
  const prevK = idx > 0 ? tl[idx - 1] : null;
  const nextK = idx >= 0 && idx < tl.length - 1 ? tl[idx + 1] : null;
  const navBtn = (icon, k2, label) => `<button type="button" ${k2 ? `data-action="calGoto" data-arg0="${k2}"` : "disabled"} aria-label="${label}" class="w-8 h-8 rounded-full flex items-center justify-center bg-slate-700/60 ${k2 ? "text-white" : "text-slate-600"}"><span class="material-icons" style="font-size:18px">${icon}</span></button>`;

  const byDay = {};
  for (const e of entries) (byDay[e.day] = byDay[e.day] || []).push(e);

  let cells = "";
  for (let i = 0; i < first; i++) cells += `<div class="min-h-[64px] border-t border-white/[0.05]"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const list = byDay[d] || [];
    const shown = list.slice(0, 2);
    const more = list.length - shown.length;
    const sel = calSelDay === d;
    cells += `<button type="button" data-action="calSelectDay" data-arg0="${d}" class="min-h-[64px] border-t border-white/[0.05] px-0.5 pt-1 pb-0.5 flex flex-col items-stretch text-left ${sel ? "bg-indigo-500/15" : ""}" aria-label="Day ${d}, ${list.length} entries">
      <span class="self-center text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${d === todayD ? "bg-indigo-500 text-white" : "text-slate-300"}">${d}</span>
      <span class="mt-0.5 space-y-[2px] min-w-0">
        ${shown.map((e) => `<span class="block truncate rounded-[3px] px-[3px] py-[1px] text-[8px] font-semibold leading-tight ${e.paid ? "opacity-45 line-through" : ""}" style="${CAL_STYLE[e.cat]}">${escapeHtml(e.name)}</span>`).join("")}
        ${more > 0 ? `<span class="block text-[8px] font-bold text-slate-500 pl-1">+${more}</span>` : ""}
      </span>
    </button>`;
  }

  for (let i = (first + daysInMonth) % 7; i !== 0 && i < 7; i++) cells += `<div class="min-h-[64px] border-t border-white/[0.05]"></div>`;
  const listEntries = calSelDay ? entries.filter((e) => e.day === calSelDay) : entries;
  const heading = calSelDay ? `${monthShort(k)} ${ordinal(calSelDay)}` : `All of ${monthName(k)}`;
  const rows = listEntries.length
    ? listEntries.map((e) => `<div class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/40">
        <span class="w-1.5 h-6 rounded-full flex-shrink-0" style="background:${e.cat === "oth" ? "#8b5cf6" : e.type === "inc" ? "#10b981" : "#ef4444"}"></span>
        <div class="min-w-0 flex-1"><p class="text-xs font-bold truncate ${e.paid ? "text-slate-500 line-through" : "text-slate-100"}">${escapeHtml(e.name)}</p>
        <p class="text-[9px] text-slate-500">${monthShort(k)} ${ordinal(e.day)}${e.paid ? " · done" : ""}${e.cat === "oth" ? " · debt" : ""}</p></div>
        <p class="text-xs font-black flex-shrink-0 ${e.type === "inc" ? "text-emerald-400" : "text-rose-400"}">${e.type === "inc" ? "+" : "-"}${peso(e.amount)}</p>
      </div>`).join("")
    : `<p class="text-center text-[11px] text-slate-500 py-3">Nothing scheduled${calSelDay ? " on this day" : ""}${calFilter !== "all" ? " for this filter" : ""}.</p>`;

  const chip = (v, label) => `<button type="button" data-action="calSetFilter" data-arg0="${v}" aria-pressed="${calFilter === v}" class="px-3.5 py-1.5 rounded-full text-[11px] font-bold ${calFilter === v ? "bg-white text-slate-900" : "bg-slate-700/60 text-slate-200"}">${label}</button>`;

  return `<div class="flex items-start justify-between gap-2 px-0.5">
      <div class="min-w-0">
        <p class="text-lg font-black text-white leading-tight">${monthName(k)} ${y}</p>
        <p class="text-[10px] font-bold whitespace-nowrap"><span class="text-emerald-400">+${peso(income)}</span> <span class="text-slate-600">·</span> <span class="text-rose-400">-${peso(outcome)}</span> <span class="text-slate-600">·</span> <span class="text-slate-400">${entries.length} ${entries.length === 1 ? "entry" : "entries"}</span></p>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button type="button" data-action="calGoto" data-arg0="${currentKey()}" class="px-3 h-8 rounded-full bg-slate-700/60 text-white text-[11px] font-bold">Today</button>
        ${navBtn("chevron_left", prevK, "Previous month")}${navBtn("chevron_right", nextK, "Next month")}
      </div>
    </div>
    <div class="grid grid-cols-7 mt-2 text-center">${["S", "M", "T", "W", "T", "F", "S"].map((n) => `<span class="text-[10px] font-bold text-slate-500 pb-1">${n}</span>`).join("")}</div>
    <div class="grid grid-cols-7">${cells}</div>
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar mt-2.5">${chip("all", "All")}${chip("exp", "Expenses")}${chip("inc", "Income")}${chip("oth", "Other")}</div>
    <div class="mt-2.5 space-y-1.5">
      <div class="flex items-center justify-between px-0.5"><p class="text-[10px] font-black uppercase tracking-wider text-slate-400">${heading}</p>${calSelDay ? `<button type="button" data-action="calSelectDay" data-arg0="${calSelDay}" class="text-[10px] font-bold text-indigo-300">Show all</button>` : ""}</div>
      <div class="flex gap-2"><button type="button" data-action="calAdd" data-arg0="income" class="flex-1 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">add</span>Income${calSelDay ? ` · ${ordinal(calSelDay)}` : ""}</button><button type="button" data-action="calAdd" data-arg0="expenses" class="flex-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1"><span class="material-icons" style="font-size:14px">add</span>Expense${calSelDay ? ` · ${ordinal(calSelDay)}` : ""}</button></div>
      ${rows}
    </div>`;
}

export function activityCalendarCardHtml() {
  return `<details open class="glass-card rounded-xl overflow-hidden border border-indigo-500/15 w-full flex-shrink-0">
    <summary class="flex items-center justify-between px-3.5 py-2.5 cursor-pointer list-none">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0"><span class="material-icons text-white" style="font-size:14px">event_note</span></div>
        <div><h3 class="text-xs font-black text-white uppercase tracking-wide">Activity Calendar</h3><p class="text-[8px] text-slate-400">Income &amp; expenses by day</p></div>
      </div>
    </summary>
    <div id="activity-cal" class="p-2.5 pt-1">${activityCalInnerHtml()}</div>
  </details>`;
}

function refreshActivityCal() {
  const host = $("activity-cal");
  if (host) host.innerHTML = activityCalInnerHtml();
}

export function calSetFilter(f) { calFilter = f; calSelDay = null; refreshActivityCal(); }
export function calSelectDay(d) { const n = parseInt(d, 10); calSelDay = calSelDay === n ? null : n; refreshActivityCal(); }
export function calGoto(k) { calSelDay = null; if (typeof window.selectMonth === "function") window.selectMonth(k); }
export function calAdd(kind) { if (typeof window.openItemModal === "function") window.openItemModal("charlie", kind, "", calSelDay || ""); }
