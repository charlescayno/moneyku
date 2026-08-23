// =============================
// Constants & Utility Helpers
// =============================

export const HORIZON = 240; // months of timeline / projection (20 years)
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// owner meta
export const OWNERS = {
  charlie: { label: "Charles'", who: "charlie", accent: "blue", text: "text-blue-400", ring: "border-blue-500/20", grad: "from-blue-500 to-indigo-600" },
  debt: { label: "Debt Tracker", who: "debt", accent: "rose", text: "text-rose-400", ring: "border-rose-500/20", grad: "from-rose-500 to-pink-600" },
};

export const CATEGORY_LABELS = ["One-time", "Auto-pay", "Recurring", "Installments"];
export const BANK_LABELS = { maribank: "Maribank", gcash: "GCash", bpi: "BPI", metrobank: "Metrobank", bdo: "BDO", unionbank: "UnionBank", securitybank: "Security Bank" };
export const PM_LABELS = { bpi_platinum: "BPI Platinum", cc_other: "Credit Card" };

export const BRAND_DOMAINS = {
  maribank: "maribank.ph",
  gcash: "gcash.com",
  bpi: "bpi.com.ph",
  metrobank: "metrobank.com.ph",
  bdo: "bdo.com.ph",
  unionbank: "unionbankph.com",
  securitybank: "securitybank.com",
  netflix: "netflix.com",
  youtube: "youtube.com",
  prulife: "prulifeuk.com.ph",
  cms: "everynation.org",
  ccf: "ccf.org.ph",
  claude: "anthropic.com"
};
export const BANK_DOMAINS = BRAND_DOMAINS;

export const generateId = () => Math.random().toString(36).slice(2, 11);
export const $ = (id) => document.getElementById(id);

export function formatMoney(n) {
  const v = Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
  const hasFrac = Math.abs(v % 1) > 1e-9;
  return v.toLocaleString("en-PH", { minimumFractionDigits: hasFrac ? 2 : 0, maximumFractionDigits: 2 });
}

export function peso(n) { 
  return `₱${formatMoney(n)}`; 
}

export function signedPeso(n) {
  const s = n > 0.005 ? "+" : n < -0.005 ? "-" : "";
  return `${s}₱${formatMoney(Math.abs(n))}`;
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Parse an auto-complete day from a name like "Every 29", "15th", "Every 27".
export function parseDueDay(name) {
  const m = (name || "").match(/every\s*(\d{1,2})\b/i) || (name || "").match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return d >= 1 && d <= 31 ? d : null;
}

export function dueDayFor(it) {
  return it.dueDay != null ? it.dueDay : parseDueDay(it.name);
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function parseMathAmount(str) {
  if (typeof str !== "string") return parseFloat(str) || 0;
  const sanitized = str.replace(/[^0-9+\-*/().]/g, "");
  if (!sanitized) return 0;
  try {
    return parseFloat(new Function("return " + sanitized)()) || 0;
  } catch (e) {
    return 0;
  }
}

// --- month-key math (keys are "YYYY-MM", lexicographically ordered) ---
export function mkKey(y, m /* 0-11 */) { 
  return `${y}-${String(m + 1).padStart(2, "0")}`; 
}

export function keyParts(k) { 
  const [y, m] = (k || "").split("-").map(Number); 
  return { y: y || 2026, m: (m || 1) - 1 }; 
}

export function addMonths(k, n) { 
  const { y, m } = keyParts(k); 
  const d = new Date(y, m + n, 1); 
  return mkKey(d.getFullYear(), d.getMonth()); 
}

export function cmpKey(a, b) { 
  return a < b ? -1 : a > b ? 1 : 0; 
}

export function monthName(k) { 
  return MONTHS[keyParts(k).m] || ""; 
}

export function monthShort(k) { 
  const { y, m } = keyParts(k); 
  return `${MONTHS_SHORT[m] || ""} '${String(y).slice(2)}`; 
}

export function currentKey() { 
  const d = new Date(); 
  return mkKey(d.getFullYear(), d.getMonth()); 
}

export function monthsInclusive(a, b) { 
  const A = keyParts(a), B = keyParts(b); 
  return (B.y - A.y) * 12 + (B.m - A.m) + 1; 
}

// Bank and brand logo identification
export function bankIconFor(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("maribank") || n.includes("mari bank")) return "maribank";
  if (n.includes("gcash")) return "gcash";
  if (n.includes("bpi")) return "bpi";
  if (n.includes("metrobank") || n.includes("metro bank")) return "metrobank";
  if (n.includes("bdo")) return "bdo";
  if (n.includes("unionbank") || n.includes("union bank") || n === "ub") return "unionbank";
  if (n.includes("securitybank") || n.includes("security bank") || n === "secb") return "securitybank";
  return null;
}

export function brandIconFor(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("netflix")) return "netflix";
  if (n.includes("youtube")) return "youtube";
  if (n.includes("prulife") || n.includes("prudential")) return "prulife";
  if (n.includes("campus missionary")) return "cms";
  if (n.includes("tithe")) return "ccf";
  if (n.includes("claude")) return "claude";
  return null;
}

export function iconFor(name) { 
  return bankIconFor(name) || brandIconFor(name); 
}

export function categoryIcon(name) {
  const n = (name || "").toLowerCase();
  if (/electric|kuryent|meralco|\bpower\b/.test(n)) return "bolt";
  if (/wifi|internet|pldt|converge|\bfiber\b|broadband|gomo|globe|smart/.test(n)) return "wifi";
  if (/drinking water|purified|mineral|distilled/.test(n)) return "local_drink";
  if (/\bwater\b|tubig|maynilad|manila water/.test(n)) return "water_drop";
  if (/gas station|gasoline|petrol|diesel|motor gas|fuel/.test(n)) return "local_gas_station";
  if (/gasul|lpg|cooking gas/.test(n)) return "local_fire_department";
  if (/parking/.test(n)) return "local_parking";
  if (/grocer|palengke|market|supermarket|puregold|sm\b/.test(n)) return "shopping_cart";
  if (/laundry|labada/.test(n)) return "local_laundry_service";
  if (/\brent\b|renta/.test(n)) return "home";
  if (/tuition|school|educ|braces/.test(n)) return "school";
  if (/med|medicine|pharmacy|drug|health|doctor/.test(n)) return "medication";
  if (/\bcar\b|auto|vehicle|change oil/.test(n)) return "directions_car";
  if (/food|dining|resto|restaurant|\bmeal|kain/.test(n)) return "restaurant";
  if (/insurance/.test(n)) return "verified_user";
  if (/loan|utang|hulog/.test(n)) return "request_quote";
  if (/birthday|gift|regalo/.test(n)) return "cake";
  if (/tithe|church|missionary|ministry|offering/.test(n)) return "volunteer_activism";
  if (/salary|income|pay\b|sahod/.test(n)) return "payments";
  if (/pet|dog|cat|kobe|dudu/.test(n)) return "pets";
  return null;
}
