import type { Assessment } from "./assessment";
import { taxBeforeRebates } from "./brackets";
import { roundToCent } from "./money";
import { totalRebates } from "./rebates";
import type { TaxYearTables } from "./types";

/*
 * First and second provisional tax payments (IRP6), Fourth Schedule to the
 * Income Tax Act. Two ways to estimate the year's tax:
 *
 * - The basic amount method: the taxable income from the taxpayer's most
 *   recently SARS-assessed year, uplifted by 8 percent for each year (or
 *   part of a year) since that assessment if it is more than 18 months old.
 * - The estimated income method: this year's own taxable income estimate,
 *   from composeAssessment.
 *
 * Both payments are computed as half the year's estimated tax, less
 * employees' tax (PAYE) already withheld: this app does not know the actual
 * PAYE split between the first and second half of the year, so it assumes
 * an even split across both halves, disclosed as a simplification rather
 * than tracked to the period.
 *
 * The third, voluntary "top-up" payment (due about seven months after year
 * end, to stop interest accruing under section 89quat) is out of scope
 * here: it is not legally required, and shipping the two statutory
 * payments first is a smaller, independently testable increment.
 */

const BASIC_AMOUNT_UPLIFT_PERCENT = 8;

/*
 * Rough guide only, not a computed penalty: SARS can charge underestimation
 * penalty interest under section 89quat if the estimate used falls short of
 * the actual assessed taxable income by more than the statutory margin (80
 * percent for taxable income above R1 million, 90 percent otherwise). The
 * exact penalty depends on SARS's prescribed rate at assessment date, which
 * is not known in advance, so this only flags the risk.
 */
const UNDERESTIMATION_WARNING_MARGIN = 0.9;

export interface Irp6Input {
  /**
   * Taxable income from the taxpayer's most recently SARS-assessed year.
   * Null when that figure is not known, for example a first year using
   * this app with no prior assessment captured.
   */
  priorYearTaxableIncome: number | null;
  /** True if that assessment is more than 18 months old. */
  priorAssessmentOverEighteenMonthsOld: boolean;
  /** This year's own assessment, from composeAssessment. */
  currentYear: Assessment;
}

export interface Irp6MethodResult {
  taxableIncomeUsed: number;
  taxOnEstimate: number;
  firstPeriodPayment: number;
  secondPeriodPayment: number;
}

export interface Irp6Result {
  /** Null when no prior year taxable income is known. */
  basicAmountMethod: (Irp6MethodResult & { upliftPercent: number }) | null;
  estimatedIncomeMethod: Irp6MethodResult & {
    penaltyRiskNote: string | null;
  };
}

function taxOnTaxableIncome(
  taxableIncome: number,
  age: number,
  tables: TaxYearTables,
): number {
  const gross = taxBeforeRebates(taxableIncome, tables);
  const rebates = taxableIncome > 0 ? totalRebates(age, tables) : 0;
  return roundToCent(Math.max(0, gross - rebates));
}

function splitPayments(
  taxOnEstimate: number,
  payeWithheld: number,
): Pick<Irp6MethodResult, "firstPeriodPayment" | "secondPeriodPayment"> {
  const firstPeriodPayment = roundToCent(
    Math.max(0, taxOnEstimate / 2 - payeWithheld / 2),
  );
  const secondPeriodPayment = roundToCent(
    Math.max(0, taxOnEstimate - payeWithheld - firstPeriodPayment),
  );
  return { firstPeriodPayment, secondPeriodPayment };
}

export function calculateIrp6(
  input: Irp6Input,
  tables: TaxYearTables,
): Irp6Result {
  const { currentYear } = input;
  const paye = currentYear.paye;

  let basicAmountMethod: Irp6Result["basicAmountMethod"] = null;
  if (input.priorYearTaxableIncome !== null) {
    const upliftPercent = input.priorAssessmentOverEighteenMonthsOld
      ? BASIC_AMOUNT_UPLIFT_PERCENT
      : 0;
    const taxableIncomeUsed = roundToCent(
      input.priorYearTaxableIncome * (1 + upliftPercent / 100),
    );
    const taxOnEstimate = taxOnTaxableIncome(
      taxableIncomeUsed,
      currentYear.age,
      tables,
    );
    basicAmountMethod = {
      taxableIncomeUsed,
      upliftPercent,
      taxOnEstimate,
      ...splitPayments(taxOnEstimate, paye),
    };
  }

  const estimatedTaxableIncome = currentYear.taxableIncome;
  const estimatedTax = currentYear.assessedTaxAfterRebates;
  let penaltyRiskNote: string | null = null;
  if (
    basicAmountMethod &&
    basicAmountMethod.taxableIncomeUsed <
      estimatedTaxableIncome * UNDERESTIMATION_WARNING_MARGIN
  ) {
    penaltyRiskNote =
      "The basic amount sits well below this year's own taxable income estimate. " +
      "If your final assessed taxable income ends up materially higher than the " +
      "estimate you use for provisional tax, SARS can charge underestimation " +
      "penalty interest under section 89quat. Consider using the estimated income " +
      "method, or topping up your second payment.";
  }

  return {
    basicAmountMethod,
    estimatedIncomeMethod: {
      taxableIncomeUsed: estimatedTaxableIncome,
      taxOnEstimate: estimatedTax,
      ...splitPayments(estimatedTax, paye),
      penaltyRiskNote,
    },
  };
}
