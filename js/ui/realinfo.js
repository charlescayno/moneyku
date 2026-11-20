// =============================
// Info "i" popover on Real Money: what it means + a live breakdown that adds up to the shown value.
// Reads the same data as the hero (accountsOf / realMoney), so nothing is hardcoded or recalculated.
// =============================
import { escapeHtml, peso } from "../utils.js";
import { accountsOf, acctType, getHideProjected, getSimView, includedWho } from "../state.js";
import { realMoney } from "../insights.js";

const ID = "realinfo-pop";
let openFor = null;

const sp = (n) => (n < 0 ? "-" + peso(-n) : peso(n));
const OWNER_LABEL = { charlie: "Charles", partner: "Ynah" };

/** HTML for the "i" button that sits next to the "real money" label. 32px tap target without shifting the grid. */
export function realInfoBtnHtml(id) {
  return `<button type="button" data-action="toggleRealInfo" data-arg0="${id}" data-realinfo="${id}" aria-label="What is Real Money?" aria-haspopup="true" class="realinfo-btn flex items-center justify-center flex-shrink-0 text-slate-400 hover:text-white transition-colors focus:outline-none" style="width:32px;height:32px;margin:-9px -8px -9px -4px"><span class="material-icons" style="font-size:15px;pointer-events:none">info_outline</span></button>`;
}

function popHtml() {
  const hide = getHideProjected();
  const amt = (n) => (hide ? "••••" : sp(n));
  const sim = getSimView();
  const whos = sim ? ["simulated"] : includedWho();
  const lines = [];
  let total = 0;
  let cardOwed = 0;
  for (const w of whos) {
    if (w === "simulated") {
      const r = realMoney("simulated");
      lines.push({ name: "Starting cash", v: r.cash });
      total += r.real;
      continue;
    }
    for (const a of accountsOf(w).filter((x) => acctType(x) !== "credit")) {
      lines.push({ name: whos.length > 1 ? `${a.name} (${OWNER_LABEL[w]})` : a.name, v: Number(a.amount) || 0 });
    }
    const r = realMoney(w);
    total += r.real;
    cardOwed += r.owed.total || 0;
  }
  const rows = lines.map((l) => `<div class="flex justify-between gap-3"><span class="text-slate-300 min-w-0 truncate">${escapeHtml(l.name)}</span><span class="font-bold text-white tabular-nums flex-shrink-0">${amt(l.v)}</span></div>`);
  if (cardOwed > 0.005) rows.push(`<div class="flex justify-between gap-3"><span class="text-slate-300 min-w-0 truncate">Card owed</span><span class="font-bold text-rose-400 tabular-nums flex-shrink-0">${hide ? "••••" : "-" + peso(cardOwed)}</span></div>`);
  if (!lines.length) rows.push(`<p class="text-slate-400">No accounts yet.</p>`);
  const simNote = sim ? `<p class="mt-2 text-amber-200/90">Simulated view: this uses the simulation's own figures, not the real accounts.</p>` : "";
  const cardNote = cardOwed > 0.005 ? ` The card balance already charged is subtracted, so this can be lower than "current money on hand".` : "";
  return `<p class="text-sm font-black text-white mb-1">Real Money</p>
    <p class="text-slate-300 leading-snug">The total actual money across your accounts right now. It only counts money already in your accounts. It does not include bills you haven't paid yet or income you haven't received.${cardNote}</p>
    <div class="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">${rows.join("")}
      <div class="flex justify-between gap-3 border-t border-white/10 pt-1 mt-0.5"><span class="font-bold text-slate-200">Real Money</span><span class="font-black tabular-nums ${total < 0 && !hide ? "text-rose-400" : "text-white"}">${amt(total)}</span></div>
    </div>
    ${simNote}
    <p class="mt-2 text-slate-400 leading-snug">"Projected" is different: it is Real Money plus income still to come, minus bills still to pay.</p>`;
}

export function closeRealInfo() {
  document.getElementById(ID)?.remove();
  document.querySelector(`[data-realinfo][aria-expanded="true"]`)?.setAttribute("aria-expanded", "false");
  openFor = null;
}

export function toggleRealInfo(id) {
  const same = openFor === id;
  closeRealInfo();
  if (same) return;
  const btn = document.querySelector(`[data-realinfo="${id}"]`);
  if (!btn) return;
  const pop = document.createElement("div");
  pop.id = ID;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Real Money");
  pop.className = "text-xs rounded-2xl border border-white/10 shadow-2xl";
  pop.style.cssText = "position:fixed;z-index:9000;background:#1c2136;padding:14px;overflow:auto;visibility:hidden;left:0;top:0";
  pop.innerHTML = popHtml();
  document.body.appendChild(pop);
  btn.setAttribute("aria-expanded", "true");
  openFor = id;
  // Keep inside the screen: 8px margin, below the button when it fits, otherwise above
  const vw = window.innerWidth, vh = window.innerHeight, m = 8;
  const w = Math.min(320, vw - 2 * m);
  pop.style.width = w + "px";
  const b = btn.getBoundingClientRect();
  const left = Math.max(m, Math.min(b.left + b.width / 2 - w / 2, vw - w - m));
  const h = pop.offsetHeight;
  let top = b.bottom + 6;
  if (top + h > vh - m) top = b.top - 6 - h >= m ? b.top - 6 - h : Math.max(m, vh - m - h);
  pop.style.maxHeight = vh - 2 * m + "px";
  pop.style.left = left + "px";
  pop.style.top = top + "px";
  pop.style.visibility = "visible";
}

// Close on tap-away, Esc, resize or scroll (registered once)
document.addEventListener("click", (e) => {
  if (!openFor) return;
  if (e.target.closest?.(`#${ID}`) || e.target.closest?.('[data-action="toggleRealInfo"]')) return;
  closeRealInfo();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openFor) closeRealInfo(); });
window.addEventListener("resize", () => { if (openFor) closeRealInfo(); });
document.addEventListener("scroll", (e) => { if (openFor && !e.target.closest?.(`#${ID}`)) closeRealInfo(); }, true);
