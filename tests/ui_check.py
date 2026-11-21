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

NEXT5 = """
async ([cash, inc, exp]) => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const mk = (id, amount) => ({id, name: id, amount, recurring: true, start: '2026-01', dueDay: 28});
  st.setAppData({startMonth:'2026-01', simCash: cash, items:{charlie:{income:[],expenses:[]},debt:{income:[],expenses:[]},
    simulated:{income: inc ? [mk('inc', inc)] : [], expenses: exp ? [mk('exp', exp)] : []}}, settings:{}});
  st.setSimView(true); st.setHideProjected(false);
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  await new Promise(r => setTimeout(r, 900));
  const gs = [...document.querySelectorAll('#next5-card .n5-stack')];
  const out = { months: document.querySelectorAll('#next5-card [data-action=selectMonth]').length / 2,
    stacks: gs.map(g => ({ neg: g.dataset.neg === '1', note: !!g.querySelector('.n5-note'), h: Math.round(g.getBoundingClientRect().height) })),
    hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
  st.setSimView(false);
  return out;
}
"""

ADD = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const as = await import('/js/ui/addsheet.js'); const c = await import('/js/ui/components.js'); const m = await import('/js/ui/modals.js');
  const w = ms => new Promise(r => setTimeout(r, ms)); const k = u.currentKey();
  const mk = (id, name, amount) => ({id, name, amount, recurring: true, start: '2026-01'});
  st.setAppData({startMonth:'2026-01', items:{charlie:{income:[],expenses:[mk('rent','Rent',12000), mk('xs','Extra spending',10000)]},partner:{income:[],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}});
  st.setSimView(false); document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(k); lay.renderBudget(); m.closeModal(); await w(300);
  const r = {};
  as.openAddSheet(); await w(300);
  r.title = document.getElementById('modal-title').textContent;
  r.tabOn = document.querySelector('.as-tab.on')?.textContent.trim();
  r.defaultItem = document.getElementById('f-qs-item')?.value;
  r.left0 = document.querySelector('.as-left-amt')?.textContent;
  const amt = document.getElementById('f-qs-amount'); amt.value = '250'; amt.dispatchEvent(new Event('input'));
  r.left1 = document.querySelector('.as-left-amt')?.textContent;
  document.getElementById('f-qs-note').value = 'lunch';
  r.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
  await c.saveModal(); await w(300);
  const sp = st.getAppData().spend?.[k]?.xs || [];
  r.spend = sp.length ? {amount: sp[sp.length - 1].amount, note: sp[sp.length - 1].note} : null;
  r.closedAfterSpend = !document.getElementById('modal-overlay').classList.contains('open');
  as.addSheetTab('bill'); await w(300);
  r.billTab = document.querySelector('.as-tab.on')?.textContent.trim();
  r.owners = document.querySelectorAll('.as-owner').length;
  document.querySelector('.as-owner[data-arg0=partner]').click(); await w(100);
  r.ownerVal = document.getElementById('f-who').dataset.val;
  document.getElementById('f-name').value = 'Water'; document.getElementById('f-amount').value = '500';
  await c.saveModal(); await w(300);
  r.billSaved = (st.getAppData().items.partner.expenses || []).some(x => x.name === 'Water' && Number(x.amount) === 500);
  as.addSheetTab('income'); await w(300);
  r.incomeTitle = document.getElementById('modal-title').textContent;
  document.getElementById('f-name').value = 'Salary'; document.getElementById('f-amount').value = '30000';
  await c.saveModal(); await w(300);
  r.incomeSaved = ['charlie', 'partner'].some(p => (st.getAppData().items[p].income || []).some(x => x.name === 'Salary'));
  return r;
}
"""

ACCTS = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  st.setAppData({startMonth:'2026-01', accounts:[{id:'a1', name:'Maribank', amount:5000, owner:'charlie'}, {id:'a2', name:'GCash', amount:700, owner:'partner'}],
    items:{charlie:{income:[],expenses:[]},partner:{income:[],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}});
  st.setSimView(false); document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  const d = () => [...document.querySelectorAll('#budget-body details[data-persist^=accounts]')].map(e => e.open);
  const first = d();
  document.querySelector('#budget-body details[data-persist=accounts]').open = true;
  await new Promise(r => setTimeout(r, 200));
  lay.renderBudget();
  return {first, afterRedraw: d()};
}
"""

TINT = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const mk = (id, name, amount) => ({id, name, amount, recurring: true, start: '2026-01'});
  st.setAppData({startMonth:'2026-01', accounts:[], items:{charlie:{income:[mk('s','Salary',30000)],expenses:[mk('rent','Rent',12000)]},partner:{income:[],expenses:[]},
    debt:{income:[mk('d1','Karla owes me',2000)],expenses:[mk('d2','I owe Mom',1500)]}}, settings:{}});
  st.setSimView(false); document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  const bg = k => { const e = document.querySelector(`#budget-body details[data-persist="${k}"]`); return e ? getComputedStyle(e).backgroundColor : null; };
  return {income: bg('sec-income'), expenses: bg('sec-expenses'), debts: bg('debts')};
}
"""

def check_tint(pg, name, fails):
    r = pg.evaluate(TINT); print(name, "tint", r)
    v = list(r.values())
    if any(x is None or x == "rgba(0, 0, 0, 0)" for x in v) or len(set(v)) != 3: fails.append(f"{name}: income / expenses / debt need three different tinted backgrounds: {r}")

FOLD = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const mk = (id, name, amount) => ({id, name, amount, recurring: true, start: '2026-01'});
  st.setAppData({startMonth:'2026-01', accounts:[], items:{charlie:{income:[mk('s','Salary',30000)],expenses:[mk('rent','Rent',12000)]},partner:{income:[mk('y','Ynah pay',20000)],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}});
  st.setSimView(false); document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  const card = k => document.querySelector(`#budget-body details[data-persist="card-${k}"]`);
  const w = ms => new Promise(r => setTimeout(r, ms));
  const r = { hasCards: !!card('charlie') && !!card('partner'), startsOpen: card('charlie').open && card('partner').open };
  const inc = card('charlie').querySelector('details[data-persist="sec-income"]');
  r.incomeVisibleOpen = inc.checkVisibility();
  card('charlie').querySelector(':scope > summary').click(); await w(200);
  r.foldedAfterTap = !card('charlie').open;
  r.incomeHiddenWhenFolded = !inc.checkVisibility();
  r.otherUntouched = card('partner').open;
  lay.renderBudget(); await w(100);
  r.stillFoldedAfterRedraw = !card('charlie').open;
  card('charlie').querySelector(':scope > summary').click(); await w(200);
  r.reopened = card('charlie').open;
  return r;
}
"""

TODAY = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js'); const c = await import('/js/ui/components.js');
  st.setAppData({startMonth:'2026-01', accounts:[], items:{charlie:{income:[],expenses:[]},partner:{income:[],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}});
  st.setSimView(false); document.getElementById('budget-view')?.classList.remove('hidden');
  const w = ms => new Promise(r => setTimeout(r, ms)); const R = e => e.getBoundingClientRect();
  st.setSelectedKey(u.currentKey()); lay.renderAll(); await w(300);
  const r = { inNav: !!document.querySelector('#month-nav #mn-today'), pillOnCurrent: !!document.getElementById('mn-today') };
  const nav0 = [...document.querySelectorAll('#mn-prev,#mn-label,#mn-next')].map(e => Math.round(R(e).left) + ':' + Math.round(R(e).width));
  c.selectMonth(u.addMonths(u.currentKey(), 2)); await w(400);
  const pill = document.getElementById('mn-today'), nav = document.getElementById('month-nav');
  r.pillAway = !!pill && pill.getBoundingClientRect().height > 0;
  r.pillBelowNav = !!pill && R(pill).top >= R(nav).bottom - 1;
  r.pillCentred = !!pill && Math.abs((R(pill).left + R(pill).right) / 2 - innerWidth / 2) < 6;
  r.pillTapArea = !!pill && R(pill).height >= 44;
  r.navStable = JSON.stringify(nav0) === JSON.stringify([...document.querySelectorAll('#mn-prev,#mn-label,#mn-next')].map(e => Math.round(R(e).left) + ':' + Math.round(R(e).width)));
  pill?.click(); await w(400);
  r.backToToday = st.getSelectedKey() === u.currentKey() && !document.getElementById('mn-today');
  return r;
}
"""

def check_today(pg, name, fails):
    r = pg.evaluate(TODAY); print(name, "today", r)
    want = {"inNav": False, "pillOnCurrent": False, "pillAway": True, "pillBelowNav": True, "pillCentred": True, "pillTapArea": True, "navStable": True, "backToToday": True}
    bad = {k: (r.get(k), v) for k, v in want.items() if r.get(k) != v}
    if bad: fails.append(f"{name}: today pill wrong (got, want): {bad}")

def check_fold(pg, name, fails):
    r = pg.evaluate(FOLD); print(name, "fold", r)
    bad = {k: v for k, v in r.items() if v is not True}
    if bad: fails.append(f"{name}: person card folding wrong: {bad}")

def check_accounts(pg, name, fails):
    pg.evaluate("() => localStorage.setItem('moneyku_cards', JSON.stringify({accounts: true, 'accounts-p': true}))")
    pg.reload(); pg.wait_for_timeout(2500)
    r = pg.evaluate(ACCTS); print(name, "accounts", r)
    if not r["first"] or any(r["first"]): fails.append(f"{name}: accounts cards should start collapsed even if saved open: {r['first']}")
    if not r["afterRedraw"] or r["afterRedraw"][0] is not True: fails.append(f"{name}: opening the accounts card should stick through a redraw: {r['afterRedraw']}")

def check_add(pg, name, fails):
    r = pg.evaluate(ADD); print(name, "add", r)
    want = {"title": "add expense", "tabOn": "paymentsquick spend", "defaultItem": "xs", "left0": "₱10,000", "left1": "₱9,750",
            "hscroll": False, "spend": {"amount": 250, "note": "lunch"}, "closedAfterSpend": True, "billTab": "receipt_longnew bill",
            "owners": 2, "ownerVal": "partner", "billSaved": True, "incomeTitle": "add income", "incomeSaved": True}
    bad = {k: (r.get(k), v) for k, v in want.items() if r.get(k) != v}
    if bad: fails.append(f"{name}: add sheet wrong (got, want): {bad}")

def check_next5(pg, name, fails, shot=None):
    up = pg.evaluate(NEXT5, [16000, 3000, 0])
    if shot: pg.locator('#next5-card').screenshot(path=shot)
    down = pg.evaluate(NEXT5, [2000, 0, 1500])
    print(name, "next5 up", up, "down", down)
    s = up["stacks"]
    if len(s) != up["months"]: fails.append(f"{name}: {len(s)} stacks for {up['months']} months")
    if any(x["neg"] or not x["note"] for x in s): fails.append(f"{name}: positive months need a banknote and no red: {s}")
    if any(b["h"] <= a["h"] for a, b in zip(s, s[1:])): fails.append(f"{name}: stack heights should grow with the balance: {[x['h'] for x in s]}")
    d = down["stacks"]
    if not any(x["neg"] for x in d) or any(x["neg"] and x["note"] for x in d): fails.append(f"{name}: negative months must be red without a banknote: {d}")
    if up["hscroll"] or down["hscroll"]: fails.append(f"{name}: horizontal scroll with next5 stacks")

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
                if name in ("phone-390", "desktop-1280"):
                    check_next5(pg, name, fails, shot=str(pathlib.Path(__import__('tempfile').gettempdir()) / f"next5_{name}.png"))
                if name == "phone-390":
                    check_accounts(pg, name, fails)
                    check_tint(pg, name, fails)
                    check_fold(pg, name, fails)
                    check_today(pg, name, fails)
                    check_add(pg, name, fails)
                    ta = pg.evaluate("() => { const t = document.getElementById('toast'); return [t.getAttribute('role'), t.getAttribute('aria-live')]; }")
                    if ta != ["status", "polite"]: fails.append(f"toast is not a live region: {ta}")
                    cs = pg.evaluate("() => getComputedStyle(document.documentElement).colorScheme")
                    if cs != "dark": fails.append(f"color-scheme is {cs!r}, want 'dark'")
                    oc = pg.evaluate("() => ['month-picker','ql-overlay','ql-body','confirm-overlay'].map(i => getComputedStyle(document.getElementById(i)).overscrollBehaviorY)")
                    if oc != ["contain"] * 4: fails.append(f"overscroll not contained: {oc}")
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
