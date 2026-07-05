import type { TaxYearTables } from "@/lib/tax-engine/types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface TaxYearMonth {
  /** ISO "YYYY-MM". */
  value: string;
  /** Human label, for example "Mar 2025". */
  label: string;
}

/** The twelve months of a tax year, March through February. */
export function monthsOfTaxYear(tables: TaxYearTables): TaxYearMonth[] {
  const [startYear, startMonth] = tables.periodStart
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const months: TaxYearMonth[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const monthIndex = (startMonth - 1 + offset) % 12;
    const year = startYear + Math.floor((startMonth - 1 + offset) / 12);
    months.push({
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[monthIndex]} ${year}`,
    });
  }
  return months;
}
