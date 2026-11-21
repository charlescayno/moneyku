"""Browser check: an open Overview (installments) follows paid ticks (run manually: python tests/live_check.py).
Needs: pip install playwright, and Chrome installed."""
import subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; PORT = 8772
JS = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const ac = await import('/js/ui/actions.js'); const c = await import('/js/ui/components.js');
  const k = u.currentKey();
  st.setAppData({startMonth:'2026-01', accounts:[], items:{charlie:{income:[],expenses:[{id:'m',name:'Moto',amount:5000,recurring:true,start:u.addMonths(k,-1),end:u.addMonths(k,9)}]},partner:{income:[],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}, paid:{}});
  document.documentElement.classList.add('app-ready'); document.getElementById('app').style.opacity = 1;
  for (const id of ['lock-screen','intro-screen']) document.getElementById(id)?.remove();
  st.setSelectedKey(k); lay.renderBudget(); c.openMore();
  const txt = () => document.querySelector('#more-body b.text-emerald-300')?.textContent;
  const before = txt();
  st.getAppData().paid[k] = { m: true };
  ac.refreshRealized();
  return { before, after: txt() };
}
"""
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": 390, "height": 800})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(2500)
        r = pg.evaluate(JS); print(r, errs)
        assert r['before'] != r['after'] and not errs, 'Overview did not update live'
        b.close()
finally:
    srv.terminate()
