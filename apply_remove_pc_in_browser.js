/** Paste into DevTools console on the open Moneyku tab (signed in). */
(async () => {
  const IDS = ["uniy6tx55", "zfsz971r3"];
  const { getAppData } = await import("./js/state.js");
  const { syncSet } = await import("./js/firebase.js");
  const d = getAppData();
  for (const who of ["charlie", "debt"]) {
    for (const kind of ["income", "expenses"]) {
      const list = d.items?.[who]?.[kind];
      if (!Array.isArray(list)) continue;
      d.items[who][kind] = list.filter((it) => !IDS.includes(it.id));
    }
  }
  for (const field of ["paid", "paidFrom", "overrides", "spend", "deleted"]) {
    const obj = d[field];
    if (!obj) continue;
    for (const month of Object.keys(obj)) {
      for (const id of IDS) delete obj[month]?.[id];
    }
  }
  await syncSet(d);
  console.log("Removed PC items:", IDS);
  location.reload();
})();