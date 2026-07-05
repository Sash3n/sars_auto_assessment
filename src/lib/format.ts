/*
 * Rand formatting per the design reference: "R " prefix, space thousands
 * separators, two decimals, rendered in the mono currency face by the UI.
 */
export function formatRand(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const [whole, cents] = absolute.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}R ${grouped}.${cents}`;
}

/** Format a rand amount without cents, for compact chart labels. */
export function formatRandWhole(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.round(Math.abs(amount));
  const grouped = String(absolute).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}R ${grouped}`;
}
