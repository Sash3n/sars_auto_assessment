import { roundToCent } from "./money";
import type { TaxYearTables } from "./types";

/*
 * Rebate age bands key off the taxpayer's age on the last day of the tax
 * year. Date maths is done on ISO date strings to stay timezone-proof.
 */
export function ageAtTaxYearEnd(
  dateOfBirth: string,
  tables: TaxYearTables,
): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const [endYear, endMonth, endDay] = tables.periodEnd
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  let age = endYear - birthYear;
  if (endMonth < birthMonth || (endMonth === birthMonth && endDay < birthDay)) {
    age -= 1;
  }
  return age;
}

/** Total rebates for the age band. Secondary and tertiary stack on primary. */
export function totalRebates(age: number, tables: TaxYearTables): number {
  const { primary, secondary, tertiary } = tables.rebates;
  let total = primary;
  if (age >= 65) {
    total += secondary;
  }
  if (age >= 75) {
    total += tertiary;
  }
  return total;
}

/** Published no-tax threshold for the age band. */
export function taxThresholdForAge(
  age: number,
  tables: TaxYearTables,
): number {
  if (age >= 75) {
    return tables.thresholds.from75;
  }
  if (age >= 65) {
    return tables.thresholds.from65to74;
  }
  return tables.thresholds.under65;
}

/** Net tax after rebates, floored at zero. Rebates are not refundable. */
export function taxAfterRebates(
  taxBeforeRebatesAmount: number,
  age: number,
  tables: TaxYearTables,
): number {
  return roundToCent(
    Math.max(0, taxBeforeRebatesAmount - totalRebates(age, tables)),
  );
}
