import { taxBeforeRebates } from "./brackets";
import { monthlyMedicalSchemeCredit } from "./medical";
import { roundToCent } from "./money";
import { totalRebates } from "./rebates";
import { retirementDeduction } from "./retirement";
import type { TaxYearTables } from "./types";

/*
 * Estimates PAYE for one pay period using the SARS employer "annualisation"
 * formula method (Guide for Employers in respect of Employees' Tax,
 * PAYE-GEN-01-G04): this period's remuneration is annualised, taxed as if it
 * were the full year's income, reduced by rebates and the medical scheme
 * fees tax credit, then divided back down to a per-period figure.
 *
 * This is an estimate, not a guarantee of matching a real payslip to the
 * cent, for two reasons:
 *
 * 1. SARS also publishes fixed monthly deduction tables that round to
 *    published brackets, which payroll software may use instead of the
 *    continuous formula computed here.
 * 2. A straight multiply-by-periods annualisation assumes a regular month.
 *    A bonus, once-off allowance, or irregular income in the period being
 *    estimated will overstate the annual equivalent and therefore the PAYE
 *    estimate. `estimateMonthlyPayeCumulative` below implements the
 *    cumulative "average" method payroll systems use to smooth those
 *    months; `estimateMonthlyPaye` stays as the simpler flat-period
 *    estimate for when a full period history is not at hand.
 *
 * The section 6B additional medical expenses credit is deliberately
 * excluded: SARS's monthly PAYE calculation only accounts for the standard
 * section 6A medical scheme fees credit, the additional credit is only
 * claimed at annual assessment.
 */

export interface MonthlyPayeInput {
  /** Taxable remuneration for this one period: basic pay, allowances, and
   * taxable fringe benefits (employer medical aid, employer retirement,
   * other fringe benefits), excluding retirement lump sums. */
  monthlyRemuneration: number;
  /** Employee plus employer retirement contributions for this one period. */
  monthlyRetirementContributions: number;
  /** Age on the last day of the tax year. */
  age: number;
  /** Medical scheme headcount for this period: main member plus dependants. */
  medicalSchemePersonsCovered: number;
  /** Pay periods per year: 12 monthly (default), 52 weekly, 26 fortnightly. */
  periodsInYear?: number;
}

export interface MonthlyPayeResult {
  annualEquivalentRemuneration: number;
  annualRetirementAllowed: number;
  annualTaxableIncome: number;
  annualTaxBeforeRebates: number;
  annualRebates: number;
  annualMedicalCredit: number;
  annualPayeEstimate: number;
  monthlyPayeEstimate: number;
}

export function estimateMonthlyPaye(
  input: MonthlyPayeInput,
  tables: TaxYearTables,
): MonthlyPayeResult {
  const periods = input.periodsInYear ?? 12;
  if (periods <= 0) {
    throw new Error(`periodsInYear must be positive, got ${periods}`);
  }

  const annualEquivalentRemuneration = roundToCent(
    input.monthlyRemuneration * periods,
  );
  const retirement = retirementDeduction(
    {
      contributions: roundToCent(input.monthlyRetirementContributions * periods),
      remuneration: annualEquivalentRemuneration,
      taxableIncomeBeforeDeduction: annualEquivalentRemuneration,
    },
    tables,
  );
  const annualTaxableIncome = roundToCent(
    Math.max(0, annualEquivalentRemuneration - retirement.allowed),
  );
  const annualTaxBeforeRebates = taxBeforeRebates(annualTaxableIncome, tables);
  const annualRebates =
    annualTaxableIncome > 0 ? totalRebates(input.age, tables) : 0;
  const annualMedicalCredit = roundToCent(
    monthlyMedicalSchemeCredit(input.medicalSchemePersonsCovered, tables) *
      periods,
  );
  const annualPayeEstimate = roundToCent(
    Math.max(0, annualTaxBeforeRebates - annualRebates - annualMedicalCredit),
  );
  const monthlyPayeEstimate = roundToCent(annualPayeEstimate / periods);

  return {
    annualEquivalentRemuneration,
    annualRetirementAllowed: retirement.allowed,
    annualTaxableIncome,
    annualTaxBeforeRebates,
    annualRebates,
    annualMedicalCredit,
    annualPayeEstimate,
    monthlyPayeEstimate,
  };
}

/** One pay period's figures, used to build up the cumulative history. */
export interface MonthlyPayePeriodInput {
  remuneration: number;
  retirementContributions: number;
}

export interface CumulativeMonthlyPayeResult extends MonthlyPayeResult {
  /** Total tax due for all periods up to and including this one. */
  cumulativeTaxDueToDate: number;
  /** Total tax due for periods before this one, already accounted for. */
  cumulativeTaxDuePriorPeriods: number;
}

function annualiseCumulative(
  cumulativeRemuneration: number,
  cumulativeRetirementContributions: number,
  periodsElapsed: number,
  age: number,
  medicalSchemePersonsCovered: number,
  tables: TaxYearTables,
  periodsInYear: number,
): MonthlyPayeResult {
  const annualEquivalentRemuneration = roundToCent(
    (cumulativeRemuneration / periodsElapsed) * periodsInYear,
  );
  const annualEquivalentRetirement = roundToCent(
    (cumulativeRetirementContributions / periodsElapsed) * periodsInYear,
  );
  const retirement = retirementDeduction(
    {
      contributions: annualEquivalentRetirement,
      remuneration: annualEquivalentRemuneration,
      taxableIncomeBeforeDeduction: annualEquivalentRemuneration,
    },
    tables,
  );
  const annualTaxableIncome = roundToCent(
    Math.max(0, annualEquivalentRemuneration - retirement.allowed),
  );
  const annualTaxBeforeRebates = taxBeforeRebates(annualTaxableIncome, tables);
  const annualRebates = annualTaxableIncome > 0 ? totalRebates(age, tables) : 0;
  const annualMedicalCredit = roundToCent(
    monthlyMedicalSchemeCredit(medicalSchemePersonsCovered, tables) *
      periodsInYear,
  );
  const annualPayeEstimate = roundToCent(
    Math.max(0, annualTaxBeforeRebates - annualRebates - annualMedicalCredit),
  );
  const monthlyPayeEstimate = roundToCent(annualPayeEstimate / periodsInYear);

  return {
    annualEquivalentRemuneration,
    annualRetirementAllowed: retirement.allowed,
    annualTaxableIncome,
    annualTaxBeforeRebates,
    annualRebates,
    annualMedicalCredit,
    annualPayeEstimate,
    monthlyPayeEstimate,
  };
}

/*
 * SARS's cumulative "average" method for irregular pay periods (Guide for
 * Employers in respect of Employees' Tax, PAYE-GEN-01-G04): annualise using
 * cumulative earnings to date divided by periods elapsed, work out the tax
 * due for all periods to date, then subtract the tax already accounted for
 * in prior periods (worked out the same way, one period earlier) to get
 * this period's PAYE. A bonus or once-off amount in the current period
 * still raises the average, but only by its share of the year to date, not
 * as if it were earned every period.
 */
export function estimateMonthlyPayeCumulative(
  payslipsToDate: readonly MonthlyPayePeriodInput[],
  age: number,
  medicalSchemePersonsCovered: number,
  tables: TaxYearTables,
  periodsInYear = 12,
): CumulativeMonthlyPayeResult {
  if (payslipsToDate.length === 0) {
    throw new Error(
      "payslipsToDate must include at least the current period",
    );
  }
  if (periodsInYear <= 0) {
    throw new Error(`periodsInYear must be positive, got ${periodsInYear}`);
  }

  const periodsElapsed = payslipsToDate.length;
  const cumulativeRemuneration = roundToCent(
    payslipsToDate.reduce((sum, period) => sum + period.remuneration, 0),
  );
  const cumulativeRetirement = roundToCent(
    payslipsToDate.reduce(
      (sum, period) => sum + period.retirementContributions,
      0,
    ),
  );

  const toDate = annualiseCumulative(
    cumulativeRemuneration,
    cumulativeRetirement,
    periodsElapsed,
    age,
    medicalSchemePersonsCovered,
    tables,
    periodsInYear,
  );
  const cumulativeTaxDueToDate = roundToCent(
    (toDate.annualPayeEstimate * periodsElapsed) / periodsInYear,
  );

  let cumulativeTaxDuePriorPeriods = 0;
  if (periodsElapsed > 1) {
    const currentPeriod = payslipsToDate[periodsElapsed - 1];
    const priorRemuneration = roundToCent(
      cumulativeRemuneration - currentPeriod.remuneration,
    );
    const priorRetirement = roundToCent(
      cumulativeRetirement - currentPeriod.retirementContributions,
    );
    const prior = annualiseCumulative(
      priorRemuneration,
      priorRetirement,
      periodsElapsed - 1,
      age,
      medicalSchemePersonsCovered,
      tables,
      periodsInYear,
    );
    cumulativeTaxDuePriorPeriods = roundToCent(
      (prior.annualPayeEstimate * (periodsElapsed - 1)) / periodsInYear,
    );
  }

  const monthlyPayeEstimate = roundToCent(
    Math.max(0, cumulativeTaxDueToDate - cumulativeTaxDuePriorPeriods),
  );

  return {
    ...toDate,
    monthlyPayeEstimate,
    cumulativeTaxDueToDate,
    cumulativeTaxDuePriorPeriods,
  };
}
