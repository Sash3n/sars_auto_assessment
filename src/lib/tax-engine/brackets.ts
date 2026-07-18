import { roundToCent } from "./money";
import type { TaxYearTables } from "./types";

/*
 * Normal tax on taxable income, before rebates, using the SARS published
 * bracket formula: base amount plus the marginal rate applied to the income
 * above the bracket's lower bound.
 */
export function taxBeforeRebates(
  taxableIncome: number,
  tables: TaxYearTables,
): number {
  if (taxableIncome <= 0) {
    return 0;
  }
  const bracket = tables.brackets.findLast(
    (candidate) => taxableIncome > candidate.above,
  );
  if (!bracket) {
    return 0;
  }
  return roundToCent(
    bracket.base + bracket.rate * (taxableIncome - bracket.above),
  );
}
