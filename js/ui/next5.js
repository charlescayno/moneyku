// "Next 5 months": projected balance at the end of each of the next five months, as figures plus a line.
import { MONTHS_SHORT, addMonths, cmpKey, currentKey, keyParts, peso } from "../utils.js";
import { getHideProjected, getSelectedKey, outlookRows, timeline } from "../state.js";

const COUNT = 5;
let offset = 0; // months from the current month where the window starts (scrolled with the arrows or a swipe)
const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));

export function next5Keys() {
  const tl = timeline(), start = addMonths(currentKey(), offset), keys = [];
  for (let i = 0; i < COUNT; i++) { const m = addMonths(start, i); if (tl.includes(m)) keys.push(m); }
  return keys;
}

const MAX_OFFSET = () => Math.max(0, timeline().filter((m) => cmpKey(m, currentKey()) >= 0).length - COUNT);
const title = (keys) => (offset === 0 ? `Next ${keys.length} months` : `${MONTHS_SHORT[keyParts(keys[0]).m]} ${keyParts(keys[0]).y} \u2013 ${MONTHS_SHORT[keyParts(keys[keys.length - 1]).m]} ${keyParts(keys[keys.length - 1]).y}`);
const header = (keys) => `<div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-black text-white">${title(keys)}</h3>
      <div class="flex items-center gap-1">
        ${offset > 0 ? `<button type="button" data-action="next5Reset" class="text-[10px] font-bold text-indigo-300 px-2 py-1 rounded-lg bg-white/5">Now</button>` : ""}
        <button type="button" data-action="next5Shift" data-arg0="-1" aria-label="Earlier months" ${offset <= 0 ? "disabled" : ""} class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 ${offset <= 0 ? "opacity-30" : ""}"><span class="material-icons" style="font-size:18px">chevron_left</span></button>
        <button type="button" data-action="next5Shift" data-arg0="1" aria-label="Later months" ${offset >= MAX_OFFSET() ? "disabled" : ""} class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 ${offset >= MAX_OFFSET() ? "opacity-30" : ""}"><span class="material-icons" style="font-size:18px">chevron_right</span></button>
      </div>
    </div>`;

function redraw() {
  const el = document.getElementById("next5-card");
  if (!el) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = next5CardHtml();
  if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild);
}
/** Move the window by n months (negative = earlier), never before this month or past the timeline. */
export function next5Shift(n) {
  offset = Math.min(MAX_OFFSET(), Math.max(0, offset + (parseInt(n, 10) || 0)));
  redraw();
}
export function next5Reset() { offset = 0; redraw(); }

// Swipe left / right on the card to scroll through months
let touchX = null;
document.addEventListener("touchstart", (e) => { touchX = e.target.closest?.("#next5-card") ? e.touches[0].clientX : null; }, { passive: true });
document.addEventListener("touchend", (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) next5Shift(dx < 0 ? 1 : -1);
}, { passive: true });

export function next5CardHtml() {
  const keys = next5Keys();
  if (keys.length < 2) return "";
  // Amounts follow the same hide switch as the rest of the projections
  if (getHideProjected()) {
    return `<div id="next5-card" class="glass-card rounded-2xl border border-white/5 px-4 py-3 flex items-center justify-between gap-3">
      <div class="min-w-0"><h3 class="text-sm font-black text-white">Next ${keys.length} months</h3><p class="text-[11px] text-slate-500">Projected balances are hidden</p></div>
      <button type="button" data-action="toggleProjected" class="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-indigo-300 px-3 py-1.5 rounded-lg bg-white/5"><span class="material-icons" style="font-size:14px">visibility</span>Show</button>
    </div>`;
  }
  const vals = outlookRows(keys).map((r) => r.all.bal);
  const sel = getSelectedKey();

  // chart: one column per month, points centred in their column so they line up with the figures above
  const W = 500, H = 110, PADY = 12;
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
  const X = (i) => ((i + 0.5) / keys.length) * W;
  const Y = (v) => PADY + ((hi - v) / span) * (H - 2 * PADY);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const dots = vals.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === 0 ? 6 : 4.5}" fill="${v < 0 ? "#fb7185" : "#a5b4fc"}"/>`).join("");
  const zero = `<line x1="${(X(0) - 8).toFixed(1)}" x2="${(X(keys.length - 1) + 8).toFixed(1)}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4 4" opacity=".8"/>`;
  const cols = (cell) => `<div class="grid" style="grid-template-columns:repeat(${keys.length},minmax(0,1fr))">${keys.map(cell).join("")}</div>`;

  const figures = cols((m, i) => `<button type="button" data-action="selectMonth" data-arg0="${m}" class="text-center text-[11px] font-black tabular-nums truncate px-0.5 ${vals[i] < 0 ? "text-rose-400" : "text-white"}" aria-label="${MONTHS_SHORT[keyParts(m).m]}: ${sp(vals[i])}">${sp(vals[i])}</button>`);
  const labels = cols((m) => `<button type="button" data-action="selectMonth" data-arg0="${m}" class="text-center text-[11px] font-bold ${m === sel ? "text-indigo-300" : "text-slate-500"}" style="text-transform:lowercase">${MONTHS_SHORT[keyParts(m).m]}</button>`);

  return `<div id="next5-card" class="glass-card rounded-2xl border border-white/5 px-4 py-3">
    ${header(keys)}
    ${figures}
    <svg viewBox="0 0 ${W} ${H}" class="w-full block my-1" role="img" aria-label="Projected balance, next ${keys.length} months">
      ${zero}
      <path d="${path}" fill="none" stroke="#a5b4fc" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${dots}
    </svg>
    ${labels}
  </div>`;
}
