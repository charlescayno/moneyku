"""Browser check for the expense pie sheet (run manually: python tests/chart_check.py).
Opens the chart, drills into a group and "Other", checks the palette/summary/legend, swipes the sheet closed, and checks for horizontal overflow at phone widths.
Needs: pip install playwright, and Chrome installed."""
import subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; PORT = 8772
TMP = __import__("tempfile").gettempdir()
SETUP = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const k = u.currentKey(); const prev = (() => { const [y, m] = k.split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
  const mk = (id, name, amount, extra = {}) => ({id, name, amount, recurring: true, start: '2026-01', dueDay: 28, ...extra});
  const small = Array.from({length: 9}, (_, i) => mk('s' + i, 'Small ' + i, 100 + i));
  const card = mk('card', 'Credit card', 0, {children: [mk('c1', 'Lazada', 3000, {start: '2026-01'}), mk('c2', 'Shopee', 2000, {start: '2026-01'})]});
  st.setAppData({startMonth:'2026-01', accounts:[{id:'a1', name:'Maribank', amount:5000, owner:'charlie'}], paid:{[k]:{rent:true, c1:true}},
    items:{charlie:{income:[mk('sal','Salary',40000)], expenses:[mk('rent','Rent',12000), mk('food','Food and dining at a very long named place',6000), card, ...small]}, partner:{income:[],expenses:[]}, debt:{income:[],expenses:[]}}, settings:{}});
  document.documentElement.classList.add('app-ready'); document.getElementById('app').style.opacity = 1; for (const id of ['lock-screen','intro-screen']) document.getElementById(id)?.remove();
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(k); lay.renderBudget();
  await new Promise(r => setTimeout(r, 600));
}
"""
INFO = """() => { const s = document.getElementById('ql-sheet'); const b = document.getElementById('ql-body');
  return { title: document.getElementById('ql-title').textContent, rows: [...b.querySelectorAll('.relative.flex.items-center')].map(r => r.innerText.replace(/\\s+/g, ' ')),
   summary: [...b.querySelectorAll('p')].map(p => p.innerText), over: b.scrollWidth > b.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1, open: document.getElementById('ql-overlay').classList.contains('open') }; }"""
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        for name, w, h in [("w320", 320, 700), ("w390", 390, 800)]:
            pg = b.new_page(viewport={"width": w, "height": h}, has_touch=True)
            pg.on("pageerror", lambda e: print("PAGEERROR", e))
            pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(2500)
            pg.evaluate(SETUP)
            pg.evaluate("window.openExpenseChart('charlie')"); pg.wait_for_timeout(500)
            print(name, "item", pg.evaluate(INFO)); pg.screenshot(path=f"{TMP}/chart_{name}_item.png")
            pg.evaluate("window.openExpenseChart('charlie','item',1)") if False else None
            pg.click('#ql-body [data-action=openExpenseChart][data-arg2]'); pg.wait_for_timeout(400)
            print(name, "drill", pg.evaluate(INFO)); pg.screenshot(path=f"{TMP}/chart_{name}_drill.png")
            pg.click('#ql-body button:has-text("Back to all")'); pg.wait_for_timeout(300)
            other = pg.locator('#ql-body [data-arg2]', has_text="Other")
            if other.count(): other.first.click(); pg.wait_for_timeout(400); print(name, "other", pg.evaluate(INFO)); pg.screenshot(path=f"{TMP}/chart_{name}_other.png")
            pg.evaluate("window.openExpenseChart('charlie','paid')"); pg.wait_for_timeout(300); print(name, "status", pg.evaluate(INFO))
            pg.evaluate("window.openExpenseChart('charlie','cat')"); pg.wait_for_timeout(300); print(name, "cat", pg.evaluate(INFO)["rows"][:3])
            box = pg.locator('#ql-handle').bounding_box(); cx = box["x"] + box["width"] / 2; cy = box["y"] + box["height"] / 2
            cdp = pg.context.new_cdp_session(pg)
            def touch(t, y): cdp.send("Input.dispatchTouchEvent", {"type": t, "touchPoints": [] if t == "touchEnd" else [{"x": cx, "y": y}]})
            touch("touchStart", cy)
            for d in range(10, 160, 25): touch("touchMove", cy + d)
            touch("touchEnd", cy); pg.wait_for_timeout(500)
            print(name, "after swipe open:", pg.evaluate(INFO)["open"])
        b.close()
finally:
    srv.terminate()
