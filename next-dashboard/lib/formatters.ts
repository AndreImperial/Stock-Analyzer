/**
 * Formats large market values in a beginner-friendly compact style.
 * Example: 2840000000000 -> "$2.84T"
 */
export function formatMarketValue(value: number | null, currency = "USD") {
  if (!Number.isFinite(value)) return "Not available";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 2
    }).format(value as number);
  } catch {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2
    }).format(value as number);
  }
}

/**
 * Formats plain numbers while avoiding noisy decimals.
 */
export function formatNumber(value: number | null) {
  if (!Number.isFinite(value)) return "Not available";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value as number);
}

/**
 * Converts decimal ratios into percentages.
 * Example: 0.052 -> "5.2%"
 */
export function formatPercent(value: number | null) {
  if (!Number.isFinite(value)) return "Not available";

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2
  }).format(value as number);
}
