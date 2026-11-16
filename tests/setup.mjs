// Minimal browser stubs so the app's ES modules can be imported in Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};
globalThis.window = globalThis;

/** A small, valid appData object. Pass overrides for the parts a test cares about. */
export function makeData(extra = {}) {
  return {
    accounts: [],
    startMonth: "2026-08",
    items: {
      charlie: { income: [], expenses: [] },
      debt: { income: [], expenses: [] },
    },
    paid: {},
    paidFrom: {},
    overrides: {},
    spend: {},
    deleted: {},
    settings: {},
    cardStatements: [],
    cardPayments: [],
    ...extra,
  };
}
