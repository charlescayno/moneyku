// =============================
// Spending categories (used for budgets + month comparison)
// Items may carry an explicit `category`; otherwise it is guessed from the name.
// =============================
export const SPEND_CATS = [
  { id: "subs", label: "Subscriptions", icon: "subscriptions", color: "#a78bfa", kw: /netflix|spotify|youtube|icloud|google one|tradingview|subscription|prime|disney|chatgpt|cursor|apple/i },
  { id: "health", label: "Health", icon: "medical_services", color: "#f472b6", kw: /medicine|medical|doctor|dentist|hospital|vitamin|pharmacy|check ?up|clinic|watsons|mercury ?drug|drugstore/i },
  { id: "transport", label: "Transport", icon: "directions_car", color: "#38bdf8", kw: /\bgas\b|fuel|move ?it|grab|petron|shell|caltex|seaoil|phoenix|angkas|motorcycle|toll|parking|commute|jeep|taxi|fare|gasoline/i },
  { id: "groceries", label: "Groceries", icon: "shopping_cart", color: "#a3e635", kw: /grocer|supermarket|market|palengke|rice|sm store|convenience|7-?eleven|ministop|puregold|robinsons|landers|s&r/i },
  { id: "food", label: "Food & Dining", icon: "restaurant", color: "#fbbf24", kw: /food|meal|restaurant|coffee|snack|lunch|dinner|drinking water|jollibee|mcdo|sukiya|contis|vikings|dailybeer|beer|bakery|kfc|starbucks|dine|cafe/i },
  { id: "family", label: "Family", icon: "family_restroom", color: "#fb923c", kw: /family|papa|mama|lola|daddy|allowance|kid|school|tuition|baby/i },
  { id: "debts", label: "Loans & Installments", icon: "credit_score", color: "#f87171", kw: /installment|loan|credit card|credit line|\bcredit\b(?!\))|utang|\bpc payment|\bcc\b|platinum/i },
  { id: "bills", label: "Bills & Utilities", icon: "receipt_long", color: "#34d399", kw: /electric|internet|pldt|wifi|globe|converge|water|meralco|tax|dues|rent|insurance|phone|load|bill/i },
  { id: "shopping", label: "Shopping & Fun", icon: "shopping_bag", color: "#e879f9", kw: /shop|date|movie|game|travel|gift|cloth|fun|hobby|gym/i },
  { id: "other", label: "Other", icon: "category", color: "#94a3b8", kw: null },
];

const BY_ID = Object.fromEntries(SPEND_CATS.map((c) => [c.id, c]));
export const catInfo = (id) => BY_ID[id] || BY_ID.other;

export function categoryOf(it) {
  if (it.category && BY_ID[it.category]) return it.category;
  for (const c of SPEND_CATS) if (c.kw && c.kw.test(it.name || "")) return c.id;
  if (it.recurring && it.end) return "debts";
  return "other";
}
