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
  partner: { label: "Ynah's", who: "partner", accent: "teal", text: "text-ynah", ring: "border-ynah", grad: "ynah-grad" },
  pdebt: { label: "Ynah's Debt Tracker", who: "pdebt", accent: "ynah", text: "text-ynah", ring: "border-ynah", grad: "ynah-grad" },
  simulated: { label: "Simulated", who: "simulated", accent: "amber", text: "text-amber-300", ring: "border-amber-400/30", grad: "from-amber-500 to-orange-600" },
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
// Ordinary (non-credit) payment methods. They behave like cash for totals; each one
// defaults the "paid from" account to the account whose name matches `account`.
export const ACCOUNT_PAYMENT_METHODS = [
  { id: "maribank", label: "Maribank", short: "Maribank", logo: "maribank", mi: "account_balance", account: /mari\s*bank/i },
  { id: "gcash", label: "GCash", short: "GCash", logo: "gcash", mi: "smartphone", account: /g\s*cash/i },
  { id: "bpi_debit", label: "BPI Debit Card", short: "BPI Debit", logo: "bpi", mi: "credit_card", account: /^bpi\b/i },
  { id: "securitybank", label: "Security Bank", short: "Security Bank", logo: "securitybank", mi: "account_balance", account: /security\s*bank|\bsecb\b/i },
];
export const PM_LABELS = Object.fromEntries([...CREDIT_CARD_METHODS, ...ACCOUNT_PAYMENT_METHODS].map((c) => [c.id, c.short]));
export const isAccountMethod = (id) => ACCOUNT_PAYMENT_METHODS.some((m) => m.id === id);

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

/** Whole pesos for list rows (cents stay in the details screens). */
export function pesoRow(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "-" : ""}₱${Math.abs(v).toLocaleString("en-PH")}`;
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

/** Number of Mondays in month key "YYYY-MM" (4 or 5). */
export function mondaysInMonth(k) {
  const { y, m } = keyParts(k);
  const days = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= days; d++) if (new Date(y, m, d).getDay() === 1) n++;
  return n;
}

export function addMonths(k, n) { 
  const { y, m } = keyParts(k); 
  const d = new Date(y, m + n, 1); 
  return mkKey(d.getFullYear(), d.getMonth()); 
}

/** Move `delta` months within timeline `tl` (sorted keys), clamped at both ends. */
export function stepKey(tl, k, delta) {
  if (!tl.length) return k;
  let i = tl.indexOf(k);
  if (i < 0) i = Math.max(0, tl.findIndex((x) => x >= k));
  if (i < 0) i = tl.length - 1;
  return tl[Math.min(tl.length - 1, Math.max(0, i + delta))];
}

/** Same month in the year `dir` (+1/-1) away; clamped to the nearest key in the timeline. */
export function yearStepKey(tl, k, dir) {
  if (!tl.length) return k;
  const want = addMonths(k, 12 * dir);
  if (tl.includes(want)) return want;
  return dir > 0 ? tl[tl.length - 1] : tl[0];
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

/** Brand / bank logos shipped with the app (assets/brands/<key>.png), so they work offline and never depend on a favicon service. */
export const BRAND_LOGOS = new Set("adobe amazon angkas apple aub bdo bpi canva ccf chatgpt cimb claude cms coinsph converge ctbc cursor disney eastwest gcash globe google gotyme grabpay grab hbo hsbc icloud ing jollibee landbank lazada maribank mcdo metrobank microsoft moveit netflix notion ownbank petron pldt prulife psbank puregold rcbc sc seabank securitybank shell shopeepay shopee sm spotify starbucks tiktok unionbank viu youtube".split(" "));
export const brandLogoUrl = (key) => (key && BRAND_LOGOS.has(key) ? `assets/brands/${key}.png` : null);

const BRAND_RULES = [
  ["netflix", /netflix/], ["youtube", /youtube/], ["spotify", /spotify/], ["disney", /disney/], ["hbo", /\bhbo\b|max\.com/], ["viu", /\bviu\b/],
  ["prulife", /prulife|prudential/], ["cms", /campus missionary/], ["ccf", /tithe|\bccf\b/],
  ["claude", /claude|anthropic/], ["chatgpt", /chatgpt|openai/], ["cursor", /\bcursor\b/],
  ["icloud", /icloud/], ["apple", /\bapple\b/], ["google", /google/], ["microsoft", /microsoft|office 365|xbox/], ["adobe", /adobe/], ["canva", /canva/], ["notion", /\bnotion\b/],
  ["tiktok", /tiktok/], ["shopee", /shopee/], ["lazada", /lazada/], ["amazon", /amazon/],
  ["moveit", /move ?it/], ["angkas", /angkas/], ["grab", /\bgrab\b/],
  ["globe", /\bglobe\b|\bgomo\b/], ["pldt", /pldt/], ["converge", /converge/],
  ["jollibee", /jollibee/], ["mcdo", /mcdo|mcdonald/], ["starbucks", /starbucks/],
  ["petron", /petron/], ["shell", /\bshell\b/], ["puregold", /puregold/], ["sm", /^sm\b/],
];
export function brandIconFor(name) {
  const n = (name || "").toLowerCase();
  for (const [key, re] of BRAND_RULES) if (re.test(n)) return key;
  return null;
}

export function iconFor(name) { 
  return bankIconFor(name) || brandIconFor(name); 
}

export function categoryIcon(name) {
  const n = (name || "").toLowerCase();
  if (/electric|kuryent|meralco|\bpower\b/.test(n)) return "bolt";
  if (/wifi|internet|pldt|converge|\bfiber\b|broadband|gomo|globe|\bsmart\b/.test(n)) return "wifi";
  if (/\bload\b|prepaid|postpaid|mobile plan|cellphone|phone bill/.test(n)) return "smartphone";
  if (/cable|streaming|\btv\b/.test(n)) return "tv";
  if (/drinking water|purified|mineral|distilled/.test(n)) return "local_drink";
  if (/\bwater\b|tubig|maynilad|manila water/.test(n)) return "water_drop";
  if (/gas station|gasoline|petrol|diesel|motor gas|fuel/.test(n)) return "local_gas_station";
  if (/gasul|lpg|cooking gas/.test(n)) return "local_fire_department";
  if (/parking/.test(n)) return "local_parking";
  if (/\btoll\b|easytrip|autosweep/.test(n)) return "toll";
  if (/flight|airfare|cebu pacific|airasia|\bhotel\b|travel|vacation|trip\b/.test(n)) return "flight";
  if (/\bgrab\b|taxi|\bfare\b|commute|jeep|angkas|move ?it|\bmrt\b|\blrt\b|\bbus\b/.test(n)) return "commute";
  if (/coffee|cafe|starbucks|milk ?tea/.test(n)) return "local_cafe";
  if (/beer|alcohol|bar tab|\bbar\b/.test(n)) return "sports_bar";
  if (/bakery|bread|cake shop/.test(n)) return "bakery_dining";
  if (/grocer|palengke|market|supermarket|puregold|^sm\b/.test(n)) return "shopping_cart";
  if (/laundry|labada/.test(n)) return "local_laundry_service";
  if (/condo|association dues|\bhoa\b|amortization|mortgage|pag-?ibig/.test(n)) return "apartment";
  if (/\brent\b|renta/.test(n)) return "home";
  if (/tuition|school|educ|braces|\bbooks?\b/.test(n)) return "school";
  if (/allowance|\bkids?\b|baby|diaper/.test(n)) return "child_care";
  if (/\bgym\b|fitness|workout|yoga/.test(n)) return "fitness_center";
  if (/haircut|salon|barber|\bspa\b|massage|nails/.test(n)) return "content_cut";
  if (/\bmed\b|medic|pharmacy|drug|health|doctor|dentist|clinic|hospital|vitamin|watsons|mercury ?drug/.test(n)) return "medication";
  if (/\bcar\b|auto|vehicle|change oil|motorcycle|\bregistration\b/.test(n)) return "directions_car";
  if (/repair|maintenance|plumber|\bfix\b/.test(n)) return "build";
  if (/food|dining|resto|restaurant|\bmeal|kain|lunch|dinner|breakfast|sukiya|contis|vikings|kfc|chowking|inasal|dailybeer|jollibee|mcdo/.test(n)) return "restaurant";
  if (/movie|cinema|concert|\bgames?\b|gaming|steam|playstation|nintendo/.test(n)) return "sports_esports";
  if (/clothes|clothing|shoes|\bshopping\b|fashion|uniqlo/.test(n)) return "shopping_bag";
  if (/insurance/.test(n)) return "verified_user";
  if (/\btax\b|\bbir\b|\bsss\b|philhealth/.test(n)) return "account_balance";
  if (/credit card|\bcc\b|installment|platinum/.test(n)) return "credit_card";
  if (/loan|utang|hulog/.test(n)) return "request_quote";
  if (/birthday|gift|regalo/.test(n)) return "cake";
  if (/tithe|church|missionary|ministry|offering|donation/.test(n)) return "volunteer_activism";
  if (/savings|ipon|emergency fund|invest/.test(n)) return "savings";
  if (/salary|income|\bpay\b|sahod|wage/.test(n)) return "payments";
  if (/subscription|membership|premium/.test(n)) return "subscriptions";
  if (/\bpets?\b|\bdog\b|\bcat\b|kobe|dudu|vet\b/.test(n)) return "pets";
  return null;
}

/** How many of a weekday (0=Sun, 1=Mon ...) fall in the month "YYYY-MM". */
export function countWeekday(key, dow = 1) {
  const { y, m } = keyParts(key);
  const n = new Date(y, m + 1, 0).getDate();
  let c = 0;
  for (let d = 1; d <= n; d++) if (new Date(y, m, d).getDay() === dow) c++;
  return c;
}
