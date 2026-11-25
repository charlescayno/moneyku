// =============================
// Receipt scan: pure helpers (no DOM) so they can be unit tested
// =============================
import { SPEND_CATS } from "./categories.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CAT_IDS = new Set(SPEND_CATS.map((c) => c.id));
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Clean up what Gemini returned. `months` is the app timeline, `today` is YYYY-MM-DD. */
export function normalizeReceipt(raw, { today = "", months = [] } = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const total = typeof r.total === "number" && isFinite(r.total) && r.total > 0 ? r2(r.total) : null;
  const merchant = String(r.merchant ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  let date = typeof r.date === "string" && DATE_RE.test(r.date) && !isNaN(Date.parse(r.date)) ? r.date : null;
  if (date && today && date > today) date = null; // a receipt cannot be from the future: a misread
  const category = CAT_IDS.has(r.category) ? r.category : null;
  const confidence = typeof r.confidence === "number" && isFinite(r.confidence) ? Math.min(1, Math.max(0, r.confidence)) : null;
  const month = date && months.includes(date.slice(0, 7)) ? date.slice(0, 7) : null;
  return {
    merchant, total, date, category, month, confidence,
    outOfRange: !!date && !month,
    notReceipt: !merchant && total == null,
    lowConfidence: confidence != null && confidence < 0.5,
  };
}

const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

/**
 * Pick the budget item a receipt most likely belongs to.
 * targets: [{ id, name, category }]. Returns an item id, or "" meaning "make a new one-time expense".
 */
export function matchTarget(rec, targets) {
  const m = String(rec.merchant || "").toLowerCase();
  if (m.length >= 3) {
    const mw = words(m);
    const hit = targets.find((t) => {
      const n = String(t.name || "").toLowerCase();
      return n.length >= 3 && (m.includes(n) || n.includes(m) || words(n).some((w) => mw.includes(w)));
    });
    if (hit) return hit.id;
  }
  if (rec.category && rec.category !== "other") {
    const hit = targets.find((t) => t.category === rec.category);
    if (hit) return hit.id;
  }
  const extra = targets.find((t) => /extra spending/i.test(t.name || ""));
  return extra ? extra.id : "";
}

/** Is the same spending already logged (same amount, date and note)? */
export function findDuplicate(list, amount, date, note) {
  const n = String(note || "").trim().toLowerCase();
  return (list || []).some((e) => Math.abs((Number(e.amount) || 0) - amount) < 0.005 && (e.date || "") === (date || "") && String(e.note || "").trim().toLowerCase() === n);
}

/** A spending-log entry, in the same shape the Add spending form saves. */
export function buildSpendEntry({ id, amount, date, note, acct }) {
  const entry = acct ? { id, amount, acct, ded: true } : { id, amount };
  if (DATE_RE.test(date || "")) entry.date = date;
  const n = String(note || "").trim().slice(0, 60);
  if (n) entry.note = n;
  return entry;
}
