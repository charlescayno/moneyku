"""Browser check for receipt scan (run manually: python tests/receipt_check.py).
Stubs the Gemini endpoint, uploads a picture, checks the confirm sheet, then Confirm / Undo for both outcomes
(spending entry with account deduction, and a new one-time expense). Needs: pip install playwright pillow, and Chrome."""
import subprocess, sys, time, json, pathlib, tempfile
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent; PORT = 8791
img = pathlib.Path(tempfile.gettempdir()) / "receipt_test.png"; Image.new("RGB", (1800, 2400), "white").save(img)
SETUP = """
async () => {
  const st = await import('/js/state.js'); const u = await import('/js/utils.js'); const lay = await import('/js/ui/layout.js');
  const k = u.currentKey();
  st.setAppData({startMonth:'2026-01', accounts:[{id:'a1', name:'Maribank', amount:5000, owner:'charlie'}], settings:{geminiKey:'test-key'}, paid:{}, paidFrom:{}, spend:{},
    items:{charlie:{income:[], expenses:[{id:'e1', name:'Eating Out', amount:3000, start:'2026-01', recurring:true}]}, partner:{income:[],expenses:[]}, debt:{income:[],expenses:[]}}});
  document.documentElement.classList.add('app-ready'); document.getElementById('app').style.opacity = 1; for (const id of ['lock-screen','intro-screen']) document.getElementById(id)?.remove();
  document.getElementById('budget-view')?.classList.remove('hidden');
  st.setSelectedKey(k); lay.renderBudget();
  return k;
}
"""
fails = []
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome"); pg = b.new_page(viewport={"width": 390, "height": 844}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        sent = []
        def handle(route):
            body = route.request.post_data or ""
            sent.append("inlineData" in body)
            reply = {"merchant": REPLY["merchant"], "date": None, "total": REPLY["total"], "category": REPLY["category"], "lineItems": [], "confidence": 0.9}
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(reply)}]}}]}))
        pg.route("**/generativelanguage.googleapis.com/**", handle)
        pg.goto(f"http://localhost:{PORT}/index.html"); pg.wait_for_timeout(2500)
        k = pg.evaluate(SETUP)
        def scan():
            pg.evaluate("window.openReceiptScan()"); pg.wait_for_timeout(300)
            with pg.expect_file_chooser() as fc: pg.click('[data-action=receiptPick][data-arg0=gallery]')
            fc.value.set_files(str(img)); pg.wait_for_selector('#rc-amount', timeout=8000); pg.wait_for_timeout(200)
        # 1) matches the Eating Out item -> spending entry with account deduction
        REPLY = {"merchant": "Jollibee Ortigas", "total": 320.5, "category": "food"}
        scan()
        info = pg.evaluate("({amt: document.getElementById('rc-amount').value, note: document.getElementById('rc-note').value, target: document.getElementById('rc-target').selectedOptions[0].text, acct: document.getElementById('rc-acct').value})")
        print("confirm 1", info, "image sent:", sent)
        if info["amt"] != "320.5" or info["target"] != "Eating Out" or info["acct"] != "a1" or sent != [True]: fails.append(f"confirm sheet 1 wrong: {info} {sent}")
        pg.click('[data-action=rcConfirm]'); pg.wait_for_timeout(600)
        st = pg.evaluate("(k) => { const d = window.__d || null; return null }", k)
        after = pg.evaluate("async () => { const s = await import('/js/state.js'); const d = s.getAppData(); const k = s.getSelectedKey(); return { spend: (d.spend[k]||{}).e1, bal: d.accounts[0].amount } }")
        print("after 1", after)
        if not after["spend"] or after["spend"][0]["amount"] != 320.5 or after["spend"][0]["note"] != "Jollibee Ortigas" or abs(after["bal"] - 4679.5) > 0.01: fails.append(f"spending entry wrong: {after}")
        pg.click('#toast-action'); pg.wait_for_timeout(500)
        undone = pg.evaluate("async () => { const s = await import('/js/state.js'); const d = s.getAppData(); const k = s.getSelectedKey(); return { n: ((d.spend[k]||{}).e1||[]).length, bal: d.accounts[0].amount } }")
        print("undo 1", undone)
        if undone["n"] != 0 or undone["bal"] != 5000: fails.append(f"undo failed: {undone}")
        # 2) no matching item -> new one-time expense, marked paid, taken from the account
        REPLY = {"merchant": "Mercury Pharmacy", "total": 150, "category": "health"}
        scan()
        t = pg.evaluate("document.getElementById('rc-target').selectedOptions[0].text")
        print("confirm 2 target", t)
        if t != "New one-time expense": fails.append(f"expected a new expense, got {t}")
        pg.click('[data-action=rcConfirm]'); pg.wait_for_timeout(600)
        new = pg.evaluate("async () => { const s = await import('/js/state.js'); const d = s.getAppData(); const k = s.getSelectedKey(); const it = d.items.charlie.expenses.find(x => x.name === 'Mercury Pharmacy'); return { it: it && { amount: it.amount, recurring: it.recurring, start: it.start, category: it.category }, paid: it && d.paid[k] && d.paid[k][it.id], bal: d.accounts[0].amount, k } }")
        print("after 2", new)
        if not new["it"] or new["it"]["recurring"] or new["it"]["amount"] != 150 or new["it"]["category"] != "health" or not new["paid"] or abs(new["bal"] - 4850) > 0.01: fails.append(f"new expense wrong: {new}")
        # 3) unreadable photo
        REPLY = {"merchant": None, "total": None, "category": None}
        scan_err = None
        try:
            pg.evaluate("window.openReceiptScan()"); pg.wait_for_timeout(300)
            with pg.expect_file_chooser() as fc: pg.click('[data-action=receiptPick][data-arg0=gallery]')
            fc.value.set_files(str(img)); pg.wait_for_timeout(1500)
            txt = pg.evaluate("document.getElementById('ql-body').innerText")
        except Exception as e: txt = str(e)
        print("unreadable:", txt[:60])
        if "doesn't look like a receipt" not in txt: fails.append(f"unreadable message missing: {txt}")
        if errs: fails.append(f"page errors: {errs}")
        b.close()
finally: srv.terminate()
print("FAIL" if fails else "PASS")
for f in fails: print(" -", f)
sys.exit(1 if fails else 0)
