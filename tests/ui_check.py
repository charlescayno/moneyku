"""Browser check for the Nov 21 UI pass (run manually: python tests/ui_check.py).
Checks: 11px text floor, reminders order (phone vs wide), inline field errors, no horizontal scroll.
Needs: pip install playwright, and Chrome installed."""
import subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8767
SETUP = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const day = Math.min(28, new Date().getDate() + 1);
  st.setAppData({startMonth:'2026-01', items:{charlie:{income:[],expenses:[
    {id:'a',name:'Meralco electricity bill',amount:5852,recurring:true,start:'2026-01',dueDay:day},
    {id:'b',name:'Phone installment',amount:1200,recurring:true,start:'2026-01',end:'2027-06',dueDay:day}]},debt:{income:[],expenses:[]}}, settings:{}});
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  await new Promise(r => setTimeout(r, 800));
}
"""
LAYOUT = """
() => {
  const top = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; };
  const slot = document.getElementById('reminders-slot');
  const small = [...document.querySelectorAll('[class*="text-[8px]"],[class*="text-[9px]"],[class*="text-[10px]"]')]
    .filter(e => parseFloat(getComputedStyle(e).fontSize) < 10.99).length;
  const off = [...document.querySelectorAll('#budget-body *')].filter(e => e.children.length === 0 && e.textContent.trim() && e.getBoundingClientRect().width > 0
    && (e.getBoundingClientRect().right > innerWidth + 0.5 || e.getBoundingClientRect().left < -0.5)).map(e => e.textContent.trim().slice(0, 20));
  return { hasSlot: !!slot, slotEmpty: slot ? slot.innerHTML.trim() === '' : null, slotTop: top('#reminders-slot'), next5Top: top('#next5-card'),
           projTop: top('#projected-row'), small, off, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
}
"""
FORM = """
async () => {
  const m = await import('/js/ui/modals.js'); const c = await import('/js/ui/components.js');
  m.openItemModal('charlie', 'expenses'); await new Promise(r => setTimeout(r, 300));
  const name = document.getElementById('f-name'); name.value = '';
  await c.saveModal(); await new Promise(r => setTimeout(r, 100));
  const err = document.querySelector('.field-error');
  const r1 = { msg: err && err.textContent, invalid: name.classList.contains('field-invalid'), focused: document.activeElement === name };
  name.value = 'x'; name.dispatchEvent(new Event('input', { bubbles: true }));
  const r2 = { cleared: !document.querySelector('.field-error') && !name.classList.contains('field-invalid') };
  return { ...r1, ...r2 };
}
"""

SIM = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const mk = (id, name, who) => ({id, name, amount: 1000, recurring: true, start: '2026-01', dueDay: 5, ...(who ? {copiedFromWho: who} : {})});
  st.setAppData({startMonth:'2026-01', simCash: 0, items:{charlie:{income:[],expenses:[]},debt:{income:[],expenses:[]},
    simulated:{income:[mk('i1','Salary C','charlie'), mk('i2','Salary Y','partner')], expenses:[mk('e1','Rent','charlie'), mk('e2','Tuition','partner'), mk('e3','Trip')]}}, settings:{}});
  st.setSimView(true);
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  await new Promise(r => setTimeout(r, 800));
  const gs = [...document.querySelectorAll('#sim-view .sim-person-group')];
  const out = { groups: gs.map(e => (e.dataset.who || 'sim') + ':' + e.querySelectorAll('.item-row').length).sort(),
                borderC: gs.filter(e => e.dataset.who === 'charlie').map(e => getComputedStyle(e).borderLeftWidth),
                hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
  st.setSimView(false);
  return out;
}
"""

PAID = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js'); const ac = await import('/js/ui/actions.js');
  st.setAppData({startMonth:'2026-01', items:{charlie:{income:[],expenses:[
    {id:'g1',name:'Home',amount:0,recurring:true,start:'2026-01',children:[{id:'r1',name:'Rent',amount:12000,start:'2026-01',dueDay:1}]}]},debt:{income:[],expenses:[]}}, settings:{}});
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  await new Promise(r => setTimeout(r, 900));
  document.querySelectorAll('#budget-body details').forEach(d => d.open = true);
  const btn = document.querySelector('[data-child="r1"] .paid-check');
  const snap = () => { const s = getComputedStyle(btn), si = getComputedStyle(btn.querySelector('.check-icon')); return {bg: s.backgroundColor, icon: si.color, op: si.opacity}; };
  ac.applyPaidVisual(btn, true); await new Promise(r => setTimeout(r, 500));
  const paid = snap();
  ac.applyPaidVisual(btn, false); await new Promise(r => setTimeout(r, 500));
  return {paid, undone: snap()};
}
"""

ESC = """
async () => {
  const m = await import('/js/ui/modals.js'); const c = await import('/js/ui/components.js');
  const w = ms => new Promise(r => setTimeout(r, ms));
  const open = id => document.getElementById(id).classList.contains('open');
  m.closeModal(); await w(100); // the form check before this one leaves a modal open
  c.toggleMonthPicker(); await w(200);
  const pickerOpened = open('month-picker');
  document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await w(200);
  const pickerClosed = !open('month-picker');
  m.openItemModal('charlie', 'expenses'); await w(300);
  const modalOpened = open('modal-overlay');
  document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); await w(200);
  return {pickerOpened, pickerClosed, modalOpened, modalClosed: !open('modal-overlay')};
}
"""

def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5); fails = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for name, w, h in [("phone-320", 320, 640), ("phone-390", 390, 800), ("desktop-1280", 1280, 800)]:
                pg = b.new_page(viewport={"width": w, "height": h})
                pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(2500)
                pg.evaluate(SETUP)
                r = pg.evaluate(LAYOUT)
                print(name, r)
                if r["small"]: fails.append(f"{name}: {r['small']} elements still under 11px")
                if r["off"]: fails.append(f"{name}: text off-screen {r['off'][:3]}")
                if r["hscroll"]: fails.append(f"{name}: horizontal scroll")
                if r["hasSlot"] and not r["slotEmpty"]:
                    if w < 768 and not (r["projTop"] <= r["slotTop"] < r["next5Top"]): fails.append(f"{name}: reminders should be above the outlook on phones")
                    if w >= 768 and not (r["slotTop"] > r["next5Top"]): fails.append(f"{name}: reminders should be below the cards on wide screens")
                elif not r["hasSlot"]: fails.append(f"{name}: no #reminders-slot")
                else: print(name, "note: no reminders to show, order not checked")
                if name == "phone-390":
                    f = pg.evaluate(FORM); print("form", f)
                    if f["msg"] != "Name required" or not f["invalid"] or not f["focused"] or not f["cleared"]: fails.append(f"inline error behaviour wrong: {f}")
                if name == "phone-390":
                    ta = pg.evaluate("() => { const t = document.getElementById('toast'); return [t.getAttribute('role'), t.getAttribute('aria-live')]; }")
                    if ta != ["status", "polite"]: fails.append(f"toast is not a live region: {ta}")
                    es = pg.evaluate(ESC); print("esc", es)
                    if not all(es.values()): fails.append(f"Escape did not close overlays: {es}")
                    pd = pg.evaluate(PAID); print("paid", pd)
                    if pd["paid"]["bg"] == "rgba(0, 0, 0, 0)" or pd["paid"]["icon"] == "rgba(0, 0, 0, 0)" or pd["paid"]["op"] != "1": fails.append(f"paid sub-row tick not visible: {pd['paid']}")
                    if pd["undone"]["icon"] != "rgba(0, 0, 0, 0)" or pd["undone"]["bg"] != "rgba(0, 0, 0, 0)": fails.append(f"undo did not restore the empty box: {pd['undone']}")
                if name == "phone-390":
                    s = pg.evaluate(SIM); print("sim", s)
                    want = ["charlie:1", "charlie:1", "partner:1", "partner:1", "sim:1"]
                    if s["groups"] != want: fails.append(f"sim grouping wrong: {s['groups']} (want {want})")
                    if s["borderC"] and s["borderC"][0] != "3px": fails.append(f"sim group border missing: {s['borderC']}")
                    if s["hscroll"]: fails.append("sim: horizontal scroll")
                pg.close()
            b.close()
    finally:
        srv.terminate()
    print("FAIL" if fails else "PASS"); [print(" -", x) for x in fails]
    sys.exit(1 if fails else 0)

main()
