import { roundToCent } from "./money";
import type { TaxYearTables } from "./types";

export interface RetirementDeductionInput {
  /**
   * Total retirement fund contributions for the year: pension, provident,
   * and retirement annuity, from payroll and private, including the employer
   * contribution fringe benefit and any excess carried forward from prior
   * years.
   */
  contributions: number;
  /** PAYE remuneration, excluding retirement lump sums and severance. */
  remuneration: number;
  /**
   * Taxable income before this deduction, excluding retirement lump sums
   * and severance benefits.
   */
  taxableIncomeBeforeDeduction: number;
}

export interface RetirementDeductionResult {
  allowed: number;
  /** Excess is never lost. It carries forward to the next tax year. */
  carriedForward: number;
}

/*
 * Section 11F: the deduction is the lesser of the annual cap, the year's
 * rate applied to the greater of remuneration or taxable income, taxable
 * income before the deduction, and the contributions actually made.
 */
export function retirementDeduction(
  input: RetirementDeductionInput,
  tables: TaxYearTables,
): RetirementDeductionResult {
  const { contributions, remuneration, taxableIncomeBeforeDeduction } = input;
  if (contributions < 0) {
    throw new Error(`Contributions cannot be negative, got ${contributions}`);
  }
  const percentageLimit =
    tables.retirement.rate *
    Math.max(remuneration, taxableIncomeBeforeDeduction);
  const allowed = roundToCent(
    Math.max(
      0,
      Math.min(
        contributions,
        tables.retirement.annualCap,
        percentageLimit,
        taxableIncomeBeforeDeduction,
      ),
    ),
  );
  return {
    allowed,
    carriedForward: roundToCent(contributions - allowed),
  };
}
