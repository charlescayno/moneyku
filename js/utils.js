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
export const BANK_LABELS = {
  maribank: "Maribank", gcash: "GCash", bpi: "BPI", metrobank: "Metrobank", bdo: "BDO", unionbank: "UnionBank", securitybank: "Security Bank",
  landbank: "Landbank", pnb: "PNB", rcbc: "RCBC", eastwest: "EastWest", chinabank: "China Bank", cimb: "CIMB", psbank: "PSBank",
  pbcom: "PBCom", robinsonsbank: "Robinsons Bank", aub: "AUB", hsbc: "HSBC", sc: "Standard Chartered", maybank: "Maybank",
  ctbc: "CTBC", bankcom: "Bank of Commerce", dbp: "DBP", gotyme: "GoTyme", seabank: "SeaBank", tonik: "Tonik", uno: "UNO Digital Bank",
  ownbank: "OwnBank", ing: "ING", maya: "Maya", coinsph: "Coins.ph", shopeepay: "ShopeePay", grabpay: "GrabPay",
};

// Philippine banks, e-wallets and credit cards offered when adding an account.
export const PH_ACCOUNT_OPTIONS = [
  { group: "Bank", names: ["BPI", "BDO", "Metrobank", "Landbank", "PNB", "Security Bank", "UnionBank", "RCBC", "China Bank", "EastWest Bank", "PSBank", "AUB", "PBCom", "Robinsons Bank", "Bank of Commerce", "DBP", "CTBC Bank", "Maybank", "HSBC", "Standard Chartered", "ING"] },
  { group: "Digital bank", names: ["Maribank", "GoTyme", "SeaBank", "Tonik", "CIMB", "UNO Digital Bank", "OwnBank"] },
  { group: "E-wallet", names: ["GCash", "Maya", "Coins.ph", "ShopeePay", "GrabPay"] },
  { group: "Credit card", names: ["BPI Platinum Rewards Mastercard"] },
];
// Credit cards selectable as a payment method. BPI Platinum keeps its legacy id
// because it drives the statement/due-date auto-scheduling.
export const CREDIT_CARD_METHODS = [
  { id: "bpi_platinum", label: "BPI Platinum Rewards Mastercard", short: "BPI Platinum" },
];
export const PM_LABELS = Object.fromEntries(CREDIT_CARD_METHODS.map((c) => [c.id, c.short]));

export const BRAND_DOMAINS = {
  maribank: "maribank.ph",
  gcash: "gcash.com",
  bpi: "bpi.com.ph",
  metrobank: "metrobank.com.ph",
  bdo: "bdo.com.ph",
  unionbank: "unionbankph.com",
  securitybank: "securitybank.com",
  landbank: "landbank.com",
  pnb: "pnb.com.ph",
  rcbc: "rcbc.com",
  eastwest: "eastwestbanker.com",
  chinabank: "chinabank.ph",
  cimb: "cimbbank.com.ph",
  psbank: "psbank.com.ph",
  pbcom: "pbcom.com.ph",
  robinsonsbank: "robinsonsbank.com.ph",
  aub: "aub.com.ph",
  hsbc: "hsbc.com.ph",
  sc: "sc.com",
  maybank: "maybank.com.ph",
  ctbc: "ctbcbank.com.ph",
  bankcom: "boc.ph",
  dbp: "dbp.ph",
  gotyme: "gotyme.com.ph",
  seabank: "seabank.ph",
  tonik: "tonikbank.com",
  uno: "unobank.ph",
  ownbank: "ownbank.com",
  ing: "ing.com.ph",
  maya: "maya.ph",
  coinsph: "coins.ph",
  shopeepay: "shopee.ph",
  grabpay: "grab.com",
  netflix: "netflix.com",
  youtube: "youtube.com",
  prulife: "prulifeuk.com.ph",
  cms: "everynation.org",
  ccf: "ccf.org.ph",
  claude: "anthropic.com"
};
export const BANK_DOMAINS = BRAND_DOMAINS;

// POWI holdings used until you set your own in Investments -> Edit
export const DEFAULT_SHARES = 99;
export const DEFAULT_PENDING_SHARES = 36;
export function sharesOf(inv, key, fallback) {
  const n = parseFloat(inv && inv[key]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
export const fmtShares = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

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
  if (n.includes("landbank") || n.includes("land bank")) return "landbank";
  if (n === "pnb" || n.includes("pnb ") || n.includes("philippine national bank")) return "pnb";
  if (n.includes("rcbc")) return "rcbc";
  if (n.includes("eastwest") || n.includes("east west")) return "eastwest";
  if (n.includes("chinabank") || n.includes("china bank")) return "chinabank";
  if (n.includes("cimb")) return "cimb";
  if (n.includes("psbank")) return "psbank";
  if (n.includes("pbcom")) return "pbcom";
  if (n.includes("robinsons bank")) return "robinsonsbank";
  if (n === "aub" || n.includes("asia united")) return "aub";
  if (n.includes("hsbc")) return "hsbc";
  if (n.includes("standard chartered")) return "sc";
  if (n.includes("maybank")) return "maybank";
  if (n.includes("ctbc")) return "ctbc";
  if (n.includes("bank of commerce")) return "bankcom";
  if (n === "dbp" || n.includes("development bank of the philippines")) return "dbp";
  if (n.includes("gotyme") || n.includes("go tyme")) return "gotyme";
  if (n.includes("seabank")) return "seabank";
  if (n.includes("tonik")) return "tonik";
  if (n.includes("uno digital") || n.includes("uno bank")) return "uno";
  if (n.includes("ownbank") || n.includes("own bank")) return "ownbank";
  if (n.includes("ing bank") || n === "ing") return "ing";
  if (n.includes("paymaya") || n === "maya" || n.startsWith("maya ")) return "maya";
  if (n.includes("coins.ph") || n.includes("coinsph")) return "coinsph";
  if (n.includes("shopeepay") || n.includes("shopee pay")) return "shopeepay";
  if (n.includes("grabpay") || n.includes("grab pay")) return "grabpay";
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
