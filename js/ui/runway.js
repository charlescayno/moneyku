// Simulation "How long it lasts": the simulated balance at the end of each coming month, with the first month it goes negative.
import { MONTHS_SHORT, cmpKey, currentKey, keyParts, peso } from "../utils.js";
import { getHideProjected, getItems, getSelectedKey, getAppData, projectedByMonth, timeline } from "../state.js";

const OPTIONS = [6, 12, 24];
let horizon = 12;

const cmp = (n) => { const a = Math.abs(n), s = n < 0 ? "-" : ""; return a >= 1e6 ? s + "₱" + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? s + "₱" + Math.round(a / 1e3) + "k" : a >= 1e3 ? s + "₱" + (a / 1e3).toFixed(1) + "k" : s + "₱" + Math.round(a); };
const long = (m) => `${MONTHS_SHORT[keyParts(m).m]} ${keyParts(m).y}`;
const shortM = (m) => MONTHS_SHORT[keyParts(m).m];

export function runwayHorizon(n) {
  const v = parseInt(n, 10);
  if (!OPTIONS.includes(v)) return;
  horizon = v;
  const el = document.getElementById("runway-card");
  if (!el) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = runwayCardHtml();
  if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild);
}

/** Facts behind the card (also used by the tests): the months, their balances and where the money runs out. */
export function runwayFacts(count = horizon) {
  const by = projectedByMonth(["simulated"]);
  const months = timeline().filter((m) => cmpKey(m, currentKey()) >= 0).slice(0, count);
  const vals = months.map((m) => by[m]);
  const firstNeg = vals.findIndex((v) => v < -0.005);
  let lowI = 0;
  vals.forEach((v, i) => { if (v < vals[lowI]) lowI = i; });
  const empty = !(Number(getAppData()?.simCash) || 0) && !getItems("simulated", "income").length && !getItems("simulated", "expenses").length;
  return { months, vals, firstNeg, lowI, empty };
}

export function runwayCardHtml() {
  const head = (right = "") => `<div class="flex items-center justify-between gap-2 mb-3"><h3 class="text-sm font-black text-white min-w-0 truncate">How long it lasts</h3>${right}</div>`;
  const wrap = (inner) => `<div id="runway-card" class="bg-slate-900/80 border border-white/5 rounded-3xl px-4 py-4">${inner}</div>`;
  if (getHideProjected()) {
    return wrap(`<div class="flex items-center justify-between gap-3"><div class="min-w-0"><h3 class="text-sm font-black text-white">How long it lasts</h3><p class="text-[11px] text-slate-500">Projected balances are hidden</p></div>
      <button type="button" data-action="toggleProjected" class="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-indigo-300 px-3 py-1.5 rounded-lg bg-white/5"><span class="material-icons" style="font-size:14px">visibility</span>Show</button></div>`);
  }
  const { months, vals, firstNeg, lowI, empty } = runwayFacts();
  if (months.length < 2) return "";
  const pills = `<div class="flex items-center gap-1 flex-shrink-0">${OPTIONS.map((n) => `<button type="button" data-action="runwayHorizon" data-arg0="${n}" aria-pressed="${n === horizon}" class="text-[11px] font-bold px-2 py-1 rounded-lg ${n === horizon ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-slate-400"}">${n}m</button>`).join("")}</div>`;
  if (empty) {
    return wrap(`${head(pills)}<p class="text-[11px] text-slate-400 leading-snug">Add starting cash and some simulated income or expenses to see how many months the money lasts.</p>`);
  }

  const n = months.length;
  let tone, icon, title, sub;
  const low = vals[lowI];
  if (firstNeg === 0) {
    tone = "text-rose-400"; icon = "error";
    title = `Already short in ${long(months[0])}`;
    sub = `Lowest point ${cmp(low)} in ${long(months[lowI])}`;
  } else if (firstNeg > 0) {
    tone = "text-rose-400"; icon = "warning";
    title = `Runs short in ${long(months[firstNeg])}`;
    sub = `Lasts ${firstNeg} month${firstNeg === 1 ? "" : "s"}, through ${long(months[firstNeg - 1])} · lowest ${cmp(low)} in ${long(months[lowI])}`;
  } else {
    tone = "text-emerald-400"; icon = "check_circle";
    title = `Stays positive for ${n} months`;
    sub = `Lowest point ${cmp(low)} in ${long(months[lowI])}`;
  }

  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals), span = hi - lo || 1, H = 92;
  const zeroTop = (hi / span) * H;
  const step = n <= 6 ? 1 : n <= 12 ? 2 : 4;
  const sel = getSelectedKey();
  const cols = months.map((m, i) => {
    const v = vals[i], h = Math.max(Math.abs(v) / span * H, Math.abs(v) < 0.5 ? 0 : 2);
    const top = v >= 0 ? zeroTop - h : zeroTop;
    const bar = h ? `<span style="position:absolute;left:18%;right:18%;top:${top.toFixed(1)}px;height:${h.toFixed(1)}px;border-radius:3px;background:${v < 0 ? "#fb7185" : "#34d399"};opacity:${i === firstNeg ? 1 : 0.85}"></span>` : "";
    return `<button type="button" data-action="selectMonth" data-arg0="${m}" aria-label="${long(m)}: ${v < 0 ? "-" : ""}${peso(Math.abs(v))}" class="runway-col" style="position:relative;height:${H}px;min-width:0;padding:0">${bar}</button>`;
  }).join("");
  const labels = months.map((m, i) => `<span class="text-center text-[11px] font-bold ${m === sel ? "text-indigo-300" : "text-slate-500"}" style="min-width:0;white-space:nowrap">${i % step === 0 ? shortM(m) : ""}</span>`).join("");
  const grid = `display:grid;grid-template-columns:repeat(${n},minmax(0,1fr))`;
  return wrap(`${head(pills)}
    <div class="flex items-start gap-2.5 mb-3">
      <span class="material-icons ${tone}" style="font-size:22px">${icon}</span>
      <div class="min-w-0"><p class="text-[15px] font-black leading-tight ${tone}">${title}</p><p class="text-[11px] text-slate-400 leading-snug mt-0.5">${sub}</p></div>
    </div>
    <div style="position:relative">
      <div style="position:absolute;left:0;right:0;top:${zeroTop.toFixed(1)}px;border-top:1.5px ${lo < 0 ? "dashed" : "solid"} #475569;pointer-events:none"></div>
      <div style="${grid}">${cols}</div>
    </div>
    <div style="${grid};margin-top:4px">${labels}</div>`);
}
