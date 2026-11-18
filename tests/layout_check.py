"""Browser layout guard for the month nav (run manually: python tests/layout_check.py).
Serves the repo, injects sample data, and checks for clipping/overlap at phone/tablet/desktop widths.
Needs: pip install playwright, and Chrome installed."""
import subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8766
JS = """
async (sel) => {
  const st = await import('/js/state.js'); const ac = await import('/js/ui/actions.js'); const c = await import('/js/ui/components.js'); const u = await import('/js/utils.js');
  st.setAppData({startMonth:'2026-01', items:{charlie:{income:[],expenses:[]},debt:{income:[],expenses:[]}}, settings:{}});
  document.getElementById('budget-view')?.classList.remove('hidden');
  const w = ms => new Promise(r=>setTimeout(r,ms));
  const R = e => e.getBoundingClientRect();
  const hit = (a,b) => !(a.right<=b.left+0.5||a.left>=b.right-0.5||a.bottom<=b.top+0.5||a.top>=b.bottom-0.5);
  const issues = [];
  for (const k of sel) {
    c.selectMonth(k); await w(1800);
    const nav = document.getElementById('month-nav'), strip = document.getElementById('month-strip');
    const parts = ['mn-prev','mn-label','mn-next','mn-today'].map(i=>document.getElementById(i)).filter(e=>e && !e.classList.contains('hidden'));
    for (let i=0;i<parts.length;i++) for (let j=i+1;j<parts.length;j++) if (hit(R(parts[i]),R(parts[j]))) issues.push(k+': nav overlap '+parts[i].id+'/'+parts[j].id);
    const nr = R(nav), sr = R(strip);
    if (nr.bottom > sr.top + 0.5) issues.push(k+': nav overlaps strip');
    for (const p of parts) if (R(p).right > innerWidth+0.5 || R(p).left < -0.5) issues.push(k+': '+p.id+' off-screen');
    const lab = document.getElementById('mn-label'); if (lab.scrollWidth > lab.clientWidth+1) issues.push(k+': label text clipped');
    const badge = strip.querySelector('.now-banner');
    if (badge) { const br = R(badge); if (br.top < sr.top-0.5) issues.push(k+': NOW badge clipped by strip ('+(sr.top-br.top).toFixed(1)+'px)'); if (br.top < nr.bottom) issues.push(k+': NOW badge overlaps nav'); }
    const act = strip.querySelector('[data-k="'+k+'"]'); if (act) { const ar = R(act); if (ar.left < sr.left-1 || ar.right > sr.right+1) issues.push(k+': selected chip not fully visible'); }
  }
  if (document.documentElement.scrollWidth > innerWidth+1) issues.push('page scrolls horizontally');
  return issues;
}
"""

def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5); bad = 0
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for name, w, h in [("phone-320", 320, 640), ("phone-390", 390, 800), ("tablet-768", 768, 1024), ("desktop-1280", 1280, 800)]:
                pg = b.new_page(viewport={"width": w, "height": h})
                pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(2500)
                keys = [pg.evaluate("import('/js/utils.js').then(u=>u.currentKey())"), "2026-01", "2026-09", "2027-01", "2027-05", "2045-12"]
                issues = pg.evaluate(JS, keys)
                pg.screenshot(path=str(pathlib.Path(__import__('tempfile').gettempdir()) / f"nav_{name}.png"), clip={"x": 0, "y": 0, "width": w, "height": min(h, 360)})
                print(name, "OK" if not issues else issues); bad += bool(issues); pg.close()
            b.close()
    finally:
        srv.terminate()
    sys.exit(1 if bad else 0)

main()
