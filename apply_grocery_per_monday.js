/**
 * Paste into DevTools console on the open Moneyku tab (signed in), AFTER deploying the new code.
 * Splits the "Grocery" sub-expense: old amount ends Nov 2026, new one starts Dec 2026
 * at 3,000 per Monday in each month (4 or 5 Mondays).
 */
(async () => {
  const { getAppData } = await import("./js/state.js");
  const { syncSet } = await import("./js/firebase.js");
  const d = getAppData();
  let done = false;
  for (const who of ["charlie", "debt"]) {
    for (const it of d.items?.[who]?.expenses || []) {
      const kids = Array.isArray(it.children) ? it.children : [];
      const at = kids.findIndex((c) => c && /^grocery/i.test(c.name) && !c.perMonday && (!c.end || c.end >= "2026-12"));
      if (at < 0) continue;
      const old = kids[at];
      const next = JSON.parse(JSON.stringify(old));
      next.id = Math.random().toString(36).slice(2, 11);
      next.start = "2026-12";
      next.end = null;
      next.perMonday = 3000;
      next.amount = 3000 * 4; // fallback display only; real amount = perMonday x Mondays
      old.end = "2026-11";
      kids.splice(at + 1, 0, next);
      it.children = kids;
      done = true;
      console.log("Grocery split under", it.name, old.id, "->", next.id);
    }
  }
  if (!done) return console.warn("No Grocery sub-expense found");
  await syncSet(d);
  location.reload();
})();
