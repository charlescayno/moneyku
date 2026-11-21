"""Browser check for the bottom bar (run manually: python tests/tabs_check.py).
Clicks Home / Bills / Accounts / Overview at phone and desktop widths and checks the active tab and that the bar hides behind Overview.
Needs: pip install playwright, and Chrome installed."""
import subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; PORT = 8771
TMP = __import__("tempfile").gettempdir()
SETUP = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const mk = (id, name, amount) => ({id, name, amount, recurring: true, start: '2026-01', dueDay: 28});
  st.setAppData({startMonth:'2026-01', accounts:[{id:'a1', name:'Maribank', amount:5000, owner:'charlie'}], items:{charlie:{income:[mk('s','Salary',30000)],expenses:Array.from({length:14},(_, i)=>mk('e'+i,'Bill '+i,1000))},partner:{income:[],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}});
  document.documentElement.classList.add('app-ready'); document.getElementById('app').style.opacity = 1; for (const id of ['lock-screen','intro-screen']) document.getElementById(id)?.remove();
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(u.currentKey()); lay.renderBudget();
  await new Promise(r => setTimeout(r, 800));
}
"""
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        for name, w, h in [("phone-390", 390, 800), ("desktop-1280", 1280, 800)]:
            pg = b.new_page(viewport={"width": w, "height": h})
            pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(2500)
            pg.evaluate(SETUP)
            info = lambda: pg.evaluate("""() => { const bar = document.getElementById('tabbar'); const r = bar.getBoundingClientRect();
              return { shown: getComputedStyle(bar).display, h: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight, cur: bar.querySelector('[aria-current]')?.dataset.tab, scroll: Math.round(scrollY),
                hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; }""")
            print(name, "start", info())
            pg.screenshot(path=f"{TMP}/tabs_{name}_top.png")
            for tab in ["bills", "accounts", "home"]:
                pg.click(f'#tabbar [data-tab={tab}]'); pg.wait_for_timeout(900)
                print(name, "click", tab, info())
            pg.click('#tabbar [data-tab=bills]'); pg.wait_for_timeout(900); pg.screenshot(path=f"{TMP}/tabs_{name}_bills.png")
            pg.click('#tabbar [data-tab=overview]'); pg.wait_for_timeout(600)
            print(name, "overview open; bar display:", info()["shown"], "more open:", pg.evaluate("document.getElementById('more-overlay').classList.contains('open')"))
            pg.screenshot(path=f"{TMP}/tabs_{name}_overview.png")
        b.close()
finally:
    srv.terminate()
