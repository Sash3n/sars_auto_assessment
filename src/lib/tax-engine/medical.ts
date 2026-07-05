import { roundToCent } from "./money";
import type { TaxYearTables } from "./types";

/*
 * Section 6A medical scheme fees tax credit for one month, given how many
 * people the scheme covered that month (main member plus dependants).
 */
export function monthlyMedicalSchemeCredit(
  personsCovered: number,
  tables: TaxYearTables,
): number {
  if (personsCovered < 0 || !Number.isInteger(personsCovered)) {
    throw new Error(
      `Persons covered must be a non-negative integer, got ${personsCovered}`,
    );
  }
  const { mainMemberMonthly, firstDependantMonthly, additionalDependantMonthly } =
    tables.medicalCredit;
  if (personsCovered === 0) {
    return 0;
  }
  if (personsCovered === 1) {
    return mainMemberMonthly;
  }
  return (
    mainMemberMonthly +
    firstDependantMonthly +
    additionalDependantMonthly * (personsCovered - 2)
  );
}

/*
 * Annual section 6A credit from a list of per-month covered headcounts.
 * The list length is the number of months with cover, at most 12.
 */
export function annualMedicalSchemeCredit(
  monthlyPersonsCovered: readonly number[],
  tables: TaxYearTables,
): number {
  if (monthlyPersonsCovered.length > 12) {
    throw new Error("A tax year has at most 12 months of medical cover");
  }
  return monthlyPersonsCovered.reduce(
    (total, persons) => total + monthlyMedicalSchemeCredit(persons, tables),
    0,
  );
}

export interface AdditionalMedicalCreditInput {
  /** Age on the last day of the tax year. */
  age: number;
  /** Taxpayer, spouse, or child with a SARS-recognised disability. */
  hasDisability: boolean;
  /** Total medical scheme contributions paid in the year, all payers. */
  contributionsPaid: number;
  /** The annual section 6A credit already calculated for the year. */
  annualSchemeCredit: number;
  /** Qualifying out-of-pocket medical expenses paid in the year. */
  qualifyingExpenses: number;
  /** Taxable income before this credit, used for the 7.5 percent floor. */
  taxableIncome: number;
}

/*
 * Section 6B additional medical expenses tax credit.
 *
 * 65 and older, or disability: 33.3 percent of contributions exceeding three
 * times the section 6A credit, plus 33.3 percent of qualifying expenses.
 *
 * Everyone else: 25 percent of the amount by which the sum of contributions
 * exceeding four times the section 6A credit plus qualifying expenses
 * exceeds 7.5 percent of taxable income.
 */
export function additionalMedicalCredit(
  input: AdditionalMedicalCreditInput,
  _tables: TaxYearTables,
): number {
  const {
    age,
    hasDisability,
    contributionsPaid,
    annualSchemeCredit,
    qualifyingExpenses,
    taxableIncome,
  } = input;

  if (age >= 65 || hasDisability) {
    const excessContributions = Math.max(
      0,
      contributionsPaid - 3 * annualSchemeCredit,
    );
    return roundToCent(0.333 * excessContributions + 0.333 * qualifyingExpenses);
  }

  const excessContributions = Math.max(
    0,
    contributionsPaid - 4 * annualSchemeCredit,
  );
  const combined = excessContributions + qualifyingExpenses;
  const floor = 0.075 * taxableIncome;
  return roundToCent(0.25 * Math.max(0, combined - floor));
}
