import type { TaxYearTables } from "../types";
import { year2023_24 } from "./year-2023-24";
import { year2024_25 } from "./year-2024-25";
import { year2025_26 } from "./year-2025-26";
import { year2026_27 } from "./year-2026-27";

/*
 * Registry of supported tax years. Reference data stays in version-controlled
 * code, reviewed via PR, never in a mutable database. Adding a tax year means
 * adding a config file here plus its regression tests, per the annual process
 * documented in the README.
 */
const TAX_YEARS: readonly TaxYearTables[] = [
  year2023_24,
  year2024_25,
  year2025_26,
  year2026_27,
];

/*
 * The year most users are being auto-assessed for right now. ITA34s issued in
 * the mid-2026 filing season cover the year that ended 28 February 2026.
 */
export const DEFAULT_TAX_YEAR_ID = "2025-26";

export function listTaxYears(): readonly TaxYearTables[] {
  return TAX_YEARS;
}

export function getTaxYear(id: string): TaxYearTables {
  const tables = TAX_YEARS.find((year) => year.id === id);
  if (!tables) {
    const known = TAX_YEARS.map((year) => year.id).join(", ");
    throw new Error(`Unknown tax year "${id}". Supported: ${known}`);
  }
  return tables;
}
