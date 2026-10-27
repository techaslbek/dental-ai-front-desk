import type { Messages } from "@/lib/i18n";

// Space-grouped whole numbers ("1 200 000"), the convention for UZS in both
// Uzbek and Russian. Uses a plain space so output is identical across ICU builds.
export function formatAmount(value: number): string {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatPriceRange(
  min: number | null,
  max: number | null,
  currency: string,
  t: Pick<Messages["common"], "currencyUzs"> & Pick<Messages["services"], "priceOnRequest">,
): string {
  const unit = currency === "UZS" ? t.currencyUzs : currency;
  if (min === null && max === null) return t.priceOnRequest;
  if (min !== null && (max === null || max === min)) return `${formatAmount(min)} ${unit}`;
  if (min === null) return `≤ ${formatAmount(max!)} ${unit}`;
  return `${formatAmount(min)} – ${formatAmount(max!)} ${unit}`;
}
