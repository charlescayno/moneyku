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
  PM_LABELS,
  isAccountMethod,
  $,
} from "./utils.js";
import {
  getItems,
  itemActiveIn,
  itemTotal,
  isPaid,
  getKids,
  dueKids,
  childAmt,
  getSelectedKey,
  includedWho,
  timeline,
} from "./state.js";
import { CARD_METHOD, statement } from "./card.js";
import { addMonths } from "./utils.js";
import { rowIconHtml } from "./ui/components.js";


// Returns active items that have a due date in month k
export function getMonthBillSchedule(k, whos = ["charlie", "debt"]) {
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
  for (const who of whos) {
    for (const it of getItems(who, "expenses")) {
      if (!itemActiveIn(it, k)) continue;
      const dd = dueDayFor(it);
      let day = dd;
      if (!day && it.txDate) {
        const parts = it.txDate.split("-");
        if (parts.length === 3) day = parseInt(parts[2], 10);
      }
      // Sub-expenses with their own due day are scheduled on their own day; the group covers only the rest
      const own = dueKids(it, k);
      const rest = getKids(it, k).filter((c) => dueDayFor(c) == null);
      if (day && day >= 1) day = Math.min(day, daysInMonth); // a 31st bill falls on the last day of a shorter month
      if (day && day >= 1 && day <= daysInMonth && (!own.length || rest.length)) {
        const amt = itemTotal(it, k) - own.reduce((s, c) => s + childAmt(c, k), 0);
        const settled = own.length ? rest.every((c) => isPaid(c.id, k)) : isPaid(it.id, k);
        scheduleByDay[day].bills.push({
          id: it.id,
          name: it.name,
          amount: amt,
          paid: settled,
          who,
          paymentMethod: it.paymentMethod,
          excluded: !!it.excluded,
          parentId: null,
          isParent: getKids(it).length > 0
        });
        scheduleByDay[day].totalExpenses += amt;
      }
      for (const c of own) {
        const cd = Math.min(dueDayFor(c), daysInMonth);
        if (!(cd >= 1 && cd <= daysInMonth)) continue;
        const amt = childAmt(c, k);
        scheduleByDay[cd].bills.push({
          id: c.id,
          name: c.name,
          parentName: it.name,
          parentId: it.id,
          excluded: !!it.excluded,
          amount: amt,
          paid: isPaid(c.id, k),
          who,
          paymentMethod: it.paymentMethod,
          isParent: false
        });
        scheduleByDay[cd].totalExpenses += amt;
      }
    }
  }

  // Gather Incomes
  for (const who of whos) {
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

// Real bills still unpaid for the current month that are overdue or due within `daysWindow` days, soonest first.
// `whos` = which lists to read (never the simulation). BPI Platinum purchases are not listed one by one:
// the card shows as one bill on the statement due date it already uses.
export function getUpcomingBills(daysWindow = 7, whos = ["charlie", "debt"]) {
  const curK = currentKey();
  const currentDay = new Date().getDate();
  const { scheduleByDay, daysInMonth } = getMonthBillSchedule(curK, whos);
  const upcoming = [];
  for (let d = 1; d <= Math.min(daysInMonth, currentDay + daysWindow); d++) {
    for (const b of scheduleByDay[d].bills) {
      if (b.paid || b.excluded || b.paymentMethod === CARD_METHOD) continue;
      upcoming.push({ ...b, dueDay: d, daysDiff: d - currentDay, isOverdue: d < currentDay });
    }
  }
  if (whos.includes("charlie")) {
    for (const s of [addMonths(curK, -2), addMonths(curK, -1), curK]) {
      const st = statement(s);
      if (st.dueKey !== curK || !(st.remaining > 0.005)) continue;
      const d = parseInt(st.due.slice(8, 10), 10);
      const diff = d - currentDay;
      if (diff > daysWindow) continue;
      upcoming.push({ id: `card-${s}`, name: "BPI Platinum card bill", amount: st.remaining, who: "charlie", paymentMethod: CARD_METHOD, isCard: true, cardKey: s, dueDay: d, daysDiff: diff, isOverdue: diff < 0 });
    }
  }
  return upcoming.sort((a, b) => a.daysDiff - b.daysDiff || String(a.name).localeCompare(String(b.name)));
}

// "Show all" state of the reminders list (this session only)
let remindersExpanded = false;
const REMINDERS_SHOWN = 4;

export function toggleReminders() {
  remindersExpanded = !remindersExpanded;
  const slot = $("reminders-slot");
  if (slot) slot.innerHTML = upcomingBillsWidgetHtml();
}

/** Redraw the reminders in place (after something was marked paid). */
export function refreshReminders() {
  const slot = $("reminders-slot");
  if (slot) slot.innerHTML = upcomingBillsWidgetHtml();
}

// Payment reminders at the top of the dashboard: unpaid real bills for the people ticked in the top bar.
export function upcomingBillsWidgetHtml() {
  const curK = currentKey();
  if (getSelectedKey() !== curK) return ""; // reminders are about this month (marking paid acts on the month on screen)
  const ws = includedWho();
  const whos = ws.flatMap((w) => (w === "partner" ? ["partner", "pdebt"] : ["charlie", "debt"]));
  const upcoming = getUpcomingBills(7, whos);

  const shell = (inner, right = "") => `<section id="reminders" aria-label="Payment reminders" class="w-full rounded-2xl border border-indigo-500/20 bg-slate-900/70 px-3 py-2.5 flex flex-col gap-2 flex-shrink-0">${inner}</section>`;
  if (!upcoming.length) {
    return shell(`<div class="flex items-center gap-2"><span class="material-icons text-emerald-400" style="font-size:18px">check_circle</span><p class="text-xs font-bold text-slate-300 flex-1 min-w-0 truncate">All caught up <span class="font-medium text-slate-500">· nothing due in the next 7 days</span></p>
      <button type="button" data-action="openCalendarModal" aria-label="Open the due calendar" class="flex-shrink-0 text-indigo-300 flex items-center" style="padding:8px;margin:-8px"><span class="material-icons" style="font-size:18px">calendar_month</span></button></div>`);
  }

  const total = upcoming.reduce((sum, b) => sum + b.amount, 0);
  const overdue = upcoming.filter((b) => b.isOverdue).length;
  const whoOf = (w) => (w === "partner" || w === "pdebt" ? { n: "Ynah", cls: "text-ynah" } : { n: "Charles", cls: "text-blue-300" });
  const shown = remindersExpanded ? upcoming : upcoming.slice(0, REMINDERS_SHOWN);

  const rows = shown.map((b) => {
    let badge, cls;
    if (b.isOverdue) { badge = `Overdue · ${ordinal(b.dueDay)}`; cls = "bg-rose-500/20 text-rose-300"; }
    else if (b.daysDiff === 0) { badge = "Due today"; cls = "bg-amber-500/20 text-amber-300"; }
    else if (b.daysDiff === 1) { badge = "Due tomorrow"; cls = "bg-indigo-500/20 text-indigo-300"; }
    else { badge = `Due in ${b.daysDiff}d`; cls = "bg-slate-700/60 text-slate-300"; }
    const who = whoOf(b.who);
    const debt = b.who === "debt" || b.who === "pdebt" ? " · Debt" : "";
    const nm = `${escapeHtml(b.name)}${b.parentName ? ` <span class="font-semibold text-slate-500">· ${escapeHtml(b.parentName)}</span>` : ""}`;
    const plain = escapeHtml(b.name);
    let open, mark;
    if (b.isCard) {
      open = `data-action="cardPayOpen" data-arg0="${b.cardKey}"`;
      mark = `<button type="button" data-action="cardPayOpen" data-arg0="${b.cardKey}" title="Pay card" aria-label="Pay the BPI Platinum card bill" class="reminder-pay w-10 h-10 rounded-xl border border-slate-600 flex items-center justify-center flex-shrink-0 text-slate-300"><span class="material-icons" style="font-size:18px">payments</span></button>`;
    } else if (b.parentId) {
      open = `data-action="openChildModal" data-arg0="${b.who}" data-arg1="${b.parentId}" data-arg2="${b.id}"`;
      mark = `<button type="button" data-action="togglePaidQuick" data-arg0="${b.id}" data-arg1="expenses" title="Mark paid" aria-label="Mark ${plain} paid" class="reminder-pay w-10 h-10 rounded-xl border border-slate-600 flex items-center justify-center flex-shrink-0 text-slate-300"><span class="material-icons" style="font-size:18px">check</span></button>`;
    } else {
      open = `data-action="openItemModal" data-arg0="${b.who}" data-arg1="expenses" data-arg2="${b.id}"`;
      mark = `<button type="button" data-action="dueMarkPaid" data-arg0="${b.id}" title="Mark paid" aria-label="Mark ${plain} paid" class="reminder-pay w-10 h-10 rounded-xl border border-slate-600 flex items-center justify-center flex-shrink-0 text-slate-300"><span class="material-icons" style="font-size:18px">check</span></button>`;
    }
    return `<div ${open} data-reminder="${escapeHtml(b.id)}" class="reminder-row flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-slate-950/40 border border-white/5 cursor-pointer min-w-0">
      ${rowIconHtml(b.name, 28)}
      <div class="min-w-0 flex-1">
        <p class="text-xs font-bold text-slate-100 truncate">${nm}</p>
        <p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 min-w-0"><span class="text-[9px] font-black px-1.5 py-0.5 rounded ${cls} flex-shrink-0">${badge}</span>${b.isOverdue ? "" : `<span class="text-[10px] font-bold text-slate-400 flex-shrink-0">${ordinal(b.dueDay)}</span>`}</p>
      </div>
      <span class="flex flex-col items-end flex-shrink-0 leading-tight"><span class="text-xs font-black text-white">${peso(b.amount)}</span><span class="text-[10px] font-bold ${who.cls}">${who.n}${debt}</span></span>
      ${mark}
    </div>`;
  }).join("");

  const more = upcoming.length > REMINDERS_SHOWN
    ? `<button type="button" data-action="toggleReminders" aria-expanded="${remindersExpanded}" class="w-full py-1.5 text-[11px] font-bold text-indigo-300 flex items-center justify-center gap-1">${remindersExpanded ? "Show less" : `Show all ${upcoming.length}`}<span class="material-icons" style="font-size:16px">${remindersExpanded ? "expand_less" : "expand_more"}</span></button>`
    : "";

  return shell(`
      <div class="flex items-center gap-2">
        <span class="material-icons ${overdue ? "text-rose-400" : "text-indigo-300"}" style="font-size:18px">notifications_active</span>
        <div class="min-w-0 flex-1"><p class="text-xs font-black text-white leading-tight">${upcoming.length} bill${upcoming.length > 1 ? "s" : ""} due soon · ${peso(total)}</p>${overdue ? `<p class="text-[10px] font-bold text-rose-300 leading-tight">${overdue} overdue</p>` : ""}</div>
        <button type="button" data-action="openCalendarModal" aria-label="Open the due calendar" class="flex-shrink-0 text-indigo-300 flex items-center" style="padding:8px;margin:-8px"><span class="material-icons" style="font-size:18px">calendar_month</span></button>
      </div>
      <div class="flex flex-col gap-1.5 ${remindersExpanded ? "overflow-y-auto" : ""}" ${remindersExpanded ? 'style="max-height:55vh"' : ""}>${rows}</div>
      ${more}`);
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
          <span class="text-xs font-bold ${b.paid ? 'text-slate-500 line-through' : 'text-slate-200'} truncate">${escapeHtml(b.name)}${b.parentName ? ` <span class="font-semibold text-slate-500">· ${escapeHtml(b.parentName)}</span>` : ""}</span>
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
