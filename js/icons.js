// One place that decides which icon a bill, income or account shows.
// Order: the icon you picked, then a brand / bank logo (local files), then a keyword icon from the name, then the item's category icon.
import { bankIconFor, brandIconFor, brandLogoUrl, categoryIcon } from "./utils.js";
import { catInfo, categoryOf } from "./categories.js";

/** Icons offered in the item form's icon picker (Material names). */
export const ICON_CHOICES = [
  "receipt_long", "home", "bolt", "wifi", "water_drop", "smartphone", "tv", "subscriptions",
  "shopping_cart", "shopping_bag", "restaurant", "local_cafe", "commute", "directions_car", "local_gas_station", "flight",
  "medication", "fitness_center", "school", "child_care", "pets", "volunteer_activism", "credit_card", "request_quote",
  "savings", "payments", "apartment", "build", "sports_esports", "cake", "content_cut", "verified_user",
];

const IS_ICON = new Set(ICON_CHOICES);

/** <img> for a brand / bank logo key, or "" when there is no local file for it. */
export function logoImg(key, cls = "w-full h-full object-cover bg-white", alt = "") {
  const src = brandLogoUrl(key);
  return src ? `<img src="${src}" alt="${alt}" loading="lazy" class="${cls}" onerror="this.style.display='none'" />` : "";
}

/** What to draw for an item: { logo } or { icon, color }. `it` may be null (a bare name, e.g. a reminder). */
export function iconSpec(it, name, kind = "expenses") {
  const brand = bankIconFor(name) || brandIconFor(name);
  if (it && it.icon && IS_ICON.has(it.icon)) return { icon: it.icon, color: kind === "income" ? "#34d399" : catInfo(categoryOf(it)).color, custom: true };
  if (brandLogoUrl(brand)) return { logo: brand };
  const kw = categoryIcon(name);
  if (kind === "income") return { icon: kw || "south_west", color: "#34d399" };
  const info = catInfo(categoryOf(it || { name }));
  if (kw) return { icon: kw, color: info.id === "other" ? "#94a3b8" : info.color };
  return { icon: info.id === "other" ? "receipt_long" : info.icon, color: info.id === "other" ? "#64748b" : info.color };
}

/** The tile: a logo on white, or a Material icon in the category colour. */
export function tileHtml(spec, sz, { noBg = false } = {}) {
  if (spec.logo) {
    if (noBg) return `<div class="flex items-center justify-center flex-shrink-0" style="width:${sz}px;height:${sz}px">${logoImg(spec.logo, "w-4/5 h-4/5 object-contain grayscale opacity-60")}</div>`;
    return `<div class="icon-tile rounded-lg overflow-hidden flex-shrink-0" style="width:${sz}px;height:${sz}px">${logoImg(spec.logo)}</div>`;
  }
  const fs = Math.round(sz * (noBg ? 0.85 : 0.62));
  if (noBg) return `<span class="material-icons flex-shrink-0 flex items-center justify-center" style="font-size:${fs}px;width:${sz}px;height:${sz}px;color:${spec.color}" aria-hidden="true">${spec.icon}</span>`;
  return `<div class="icon-tile rounded-lg flex items-center justify-center flex-shrink-0" style="width:${sz}px;height:${sz}px;background:${spec.color}26"><span class="material-icons" style="font-size:${fs}px;color:${spec.color}" aria-hidden="true">${spec.icon}</span></div>`;
}

/** Small icon for a payment method / account tag: its logo, else a Material icon. */
export function methodIconHtml(m, px = 14) {
  const logo = m.logo && brandLogoUrl(m.logo);
  return logo
    ? `<img src="${logo}" alt="" class="rounded-[3px] bg-white object-cover flex-shrink-0" style="width:${px}px;height:${px}px" />`
    : `<span class="material-icons flex-shrink-0" style="font-size:${px}px" aria-hidden="true">${m.mi || "credit_card"}</span>`;
}
