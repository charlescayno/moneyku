// "Projected in next 6 months": projected balance at the end of each of the next six months, as figures plus a line.
import { MONTHS_SHORT, addMonths, cmpKey, currentKey, keyParts, peso } from "../utils.js";
import { getHideProjected, getSelectedKey, getSimView, includedWho, outlookRows, projectedByMonth, timeline } from "../state.js";

const COUNT = 6;
let offset = 0; // months from the current month where the window starts (scrolled with the arrows or a swipe)
const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
const cmp = (n) => { const a = Math.abs(n), s = n < 0 ? "-" : ""; return a >= 1e6 ? s + "₱" + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? s + "₱" + Math.round(a / 1e3) + "k" : a >= 1e3 ? s + "₱" + (a / 1e3).toFixed(1) + "k" : s + "₱" + Math.round(a); };

export function next5Keys() {
  const tl = timeline(), start = addMonths(currentKey(), offset), keys = [];
  for (let i = 0; i < COUNT; i++) { const m = addMonths(start, i); if (tl.includes(m)) keys.push(m); }
  return keys;
}

const MAX_OFFSET = () => Math.max(0, timeline().filter((m) => cmpKey(m, currentKey()) >= 0).length - COUNT);
const title = (keys) => (getSimView() ? "Simulated " : "") + (offset === 0 ? `Projected in next ${keys.length} months` : `Projected ${MONTHS_SHORT[keyParts(keys[0]).m]} ${keyParts(keys[0]).y} \u2013 ${MONTHS_SHORT[keyParts(keys[keys.length - 1]).m]} ${keyParts(keys[keys.length - 1]).y}`);
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

let animated = false;

/** One month as a stack of bills: green up from the axis with a peso banknote on top, or red down from it (no banknote).
 *  `ac` is the person / Simulated colour, kept as a thin line under the stack. */
function stackSvg(cx, v, y0, yv, w, ac, op, m) {
  const h = Math.abs(yv - y0);
  if (Math.abs(v) < 0.5 || h < 1) return `<g class="n5-stack" data-month="${m}" data-neg="0"></g>`;
  const neg = v < 0, n = Math.max(1, Math.round(h / 10)), pitch = h / n, slab = pitch * 0.72;
  const [fill, edge] = neg ? ["#fb7185", "#e11d48"] : ["#34d399", "#059669"];
  const x = (cx - w / 2).toFixed(1), f = (n) => n.toFixed(1);
  let s = "";
  for (let k = 0; k < n; k++) {
    const y = neg ? y0 + k * pitch + (pitch - slab) : y0 - (k + 1) * pitch;
    s += `<rect class="n5-slab" x="${x}" y="${f(y)}" width="${f(w)}" height="${f(slab)}" rx="2" fill="${edge}"/><rect x="${x}" y="${f(y)}" width="${f(w)}" height="${f(Math.max(1, slab - 1.6))}" rx="2" fill="${fill}"/>`;
  }
  if (!neg) {
    const nw = w * 1.15, nh = 26, nx = cx - nw / 2, ny = y0 - h - nh - 1;
    s += `<g class="n5-note"><rect x="${f(nx)}" y="${f(ny)}" width="${f(nw)}" height="${nh}" rx="4" fill="#6ee7b7" stroke="#059669" stroke-width="1.5"/>`
      + `<rect x="${f(nx + 3)}" y="${f(ny + 3)}" width="${f(nw - 6)}" height="${nh - 6}" rx="2" fill="none" stroke="#059669" stroke-width="1" opacity=".6"/>`
      + `<circle cx="${f(cx)}" cy="${f(ny + nh / 2)}" r="9" fill="#34d399" stroke="#047857" stroke-width="1.2"/>`
      + `<text x="${f(cx)}" y="${f(ny + nh / 2 + 0.5)}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="900" fill="#064e3b">₱</text></g>`;
  }
  const uy = neg ? y0 - 4 : y0 + 2.5;
  s += `<rect x="${x}" y="${f(uy)}" width="${f(w)}" height="2" rx="1" fill="${ac}"/>`;
  return `<g class="n5-stack${neg ? " n5-neg" : ""}" data-month="${m}" data-neg="${neg ? 1 : 0}" data-slabs="${n}" opacity="${op}">${s}</g>`;
}

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
    return `<div id="next5-card" class="bg-slate-900/80 border border-white/5 rounded-3xl px-4 py-4 flex items-center justify-between gap-3">
      <div class="min-w-0"><h3 class="text-sm font-black text-white">Projected in next ${keys.length} months</h3><p class="text-[11px] text-slate-500">Projected balances are hidden</p></div>
      <button type="button" data-action="toggleProjected" class="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-indigo-300 px-3 py-1.5 rounded-lg bg-white/5"><span class="material-icons" style="font-size:14px">visibility</span>Show</button>
    </div>`;
  }
  const simOn = getSimView(); const w = includedWho(); const ac = simOn ? "#fbbf24" : w.length === 1 ? (w[0] === "partner" ? "#DFC5FE" : "#93c5fd") : "#a5b4fc"; // same person colors as the big card: blue = Charles, purple = Ynah
  const simBy = simOn ? projectedByMonth(["simulated"]) : null; // the sandbox: its own starting cash plus its own income / expenses
  const vals = simOn ? keys.map((m) => simBy[m]) : outlookRows(keys).map((r) => r.all.bal);
  const sel = getSelectedKey();

  // chart: one stack of bills per month, centred in its column so it lines up with the figures above
  const W = 500, H = 150, PADY = 8, NOTE = 26; // NOTE = banknote height, reserved above the tallest stack
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
  const top = PADY + (hi > 0 ? NOTE + 2 : 0), bottom = H - PADY;
  const X = (i) => ((i + 0.5) / keys.length) * W;
  const Y = (v) => top + ((hi - v) / span) * (bottom - top);
  const bw = (W / keys.length) * 0.5, y0 = Y(0);
  const stacks = vals.map((v, i) => stackSvg(X(i), v, y0, Y(v), bw, ac, keys[i] === sel || i === 0 ? 1 : 0.8, keys[i])).join("");
  const axis = `<line x1="${(X(0) - bw).toFixed(1)}" x2="${(X(keys.length - 1) + bw).toFixed(1)}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="#475569" stroke-width="1.5" ${lo < 0 ? 'stroke-dasharray="4 4"' : ""}/>`;
  const anim = !animated; animated = true; // grow in once per page load, not on every redraw
  const cols = (cell) => `<div class="grid" style="grid-template-columns:repeat(${keys.length},minmax(0,1fr))">${keys.map(cell).join("")}</div>`;

  const figures = cols((m, i) => `<button type="button" data-action="selectMonth" data-arg0="${m}" class="text-center text-[11px] font-black tabular-nums truncate px-0.5 ${vals[i] < 0 ? "text-rose-400" : "text-white"}" aria-label="${MONTHS_SHORT[keyParts(m).m]}: ${sp(vals[i])}">${cmp(vals[i])}</button>`);
  const labels = cols((m) => `<button type="button" data-action="selectMonth" data-arg0="${m}" class="text-center text-[11px] font-bold ${m === sel ? "text-indigo-300" : "text-slate-500"}">${MONTHS_SHORT[keyParts(m).m]}</button>`);

  return `<div id="next5-card" class="bg-slate-900/80 border border-white/5 rounded-3xl px-4 py-4">
    ${header(keys)}
    ${figures}
    <svg viewBox="0 0 ${W} ${H}" class="w-full block my-1 ${anim ? "n5-anim" : ""}" role="img" aria-label="Projected balance, next ${keys.length} months">
      ${stacks}
      ${axis}
    </svg>
    ${labels}
  </div>`;
}
