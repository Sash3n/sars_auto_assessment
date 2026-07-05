import type { TaxYearTables } from "@/lib/tax-engine/types";
import { roundToCent } from "@/lib/tax-engine/money";
import type {
  CapitalDisposal,
  Dependent,
  FreelanceItem,
  NamedAmount,
  Payslip,
  RentalProperty,
  TaxpayerProfile,
} from "./types";

function sumAmounts(items: readonly NamedAmount[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

/*
 * Payroll totals mapped to SARS source codes. This is where payslip fields
 * become ITA34 lines: basic salary to 3601, bonus and leave pay to 3605,
 * named allowances to 3713, other fringe benefits to 3801, employer medical
 * aid to 3805, employer retirement to 3817. The employer retirement fringe
 * benefit also counts as the taxpayer's own contribution for section 11F,
 * so it appears in retirementContributions too, alongside the employee's.
 */
export interface PayrollTotals {
  income3601: number;
  annualPayments3605: number;
  allowances3713: number;
  otherFringe3801: number;
  medicalFringe3805: number;
  retirementFringe3817: number;
  paye: number;
  uif: number;
  employeeRetirement: number;
  /** Employee plus employer retirement contributions, for section 11F. */
  retirementContributions: number;
  /** Employer medical contributions, feeds the section 6B contribution total. */
  employerMedicalContributions: number;
  /** Gross taxable payroll income, the sum of the income code lines. */
  grossPayrollIncome: number;
  /** Deductions tracked for the user's records, excluded from tax. */
  nonTaxDeductions: number;
  employers: string[];
}

export function aggregatePayslips(payslips: readonly Payslip[]): PayrollTotals {
  const totals: PayrollTotals = {
    income3601: 0,
    annualPayments3605: 0,
    allowances3713: 0,
    otherFringe3801: 0,
    medicalFringe3805: 0,
    retirementFringe3817: 0,
    paye: 0,
    uif: 0,
    employeeRetirement: 0,
    retirementContributions: 0,
    employerMedicalContributions: 0,
    grossPayrollIncome: 0,
    nonTaxDeductions: 0,
    employers: [],
  };
  const employers = new Set<string>();

  for (const slip of payslips) {
    totals.income3601 += slip.basicSalary;
    totals.annualPayments3605 += slip.annualBonus + slip.leavePay;
    totals.allowances3713 += sumAmounts(slip.allowances);
    totals.otherFringe3801 += sumAmounts(slip.otherFringeBenefits);
    totals.medicalFringe3805 += slip.employerMedicalAid;
    totals.retirementFringe3817 += slip.employerRetirement;
    totals.paye += slip.paye;
    totals.uif += slip.uif;
    totals.employeeRetirement += slip.employeeRetirement;
    totals.nonTaxDeductions += sumAmounts(slip.nonTaxDeductions);
    if (slip.employer.trim() !== "") {
      employers.add(slip.employer.trim());
    }
  }

  totals.retirementContributions =
    totals.employeeRetirement + totals.retirementFringe3817;
  totals.employerMedicalContributions = totals.medicalFringe3805;
  totals.grossPayrollIncome =
    totals.income3601 +
    totals.annualPayments3605 +
    totals.allowances3713 +
    totals.otherFringe3801 +
    totals.medicalFringe3805 +
    totals.retirementFringe3817;
  totals.employers = Array.from(employers);

  for (const key of Object.keys(totals) as (keyof PayrollTotals)[]) {
    const value = totals[key];
    if (typeof value === "number") {
      (totals[key] as number) = roundToCent(value);
    }
  }
  return totals;
}

/** Net rental result across all properties. Can be negative. */
export function netRentalIncome(rentals: readonly RentalProperty[]): number {
  return roundToCent(
    rentals.reduce((total, rental) => {
      const net = rental.rentalIncome - sumAmounts(rental.expenses);
      return total + net * (rental.apportionmentPercent / 100);
    }, 0),
  );
}

/** Net freelance and side income. Expenses cannot push an item below zero. */
export function netFreelanceIncome(items: readonly FreelanceItem[]): number {
  return roundToCent(
    items.reduce(
      (total, item) => total + Math.max(0, item.income - item.expenses),
      0,
    ),
  );
}

/*
 * Net capital gains across disposals, applying the primary residence
 * exclusion per qualifying disposal. Losses offset gains.
 */
export function netCapitalGains(
  disposals: readonly CapitalDisposal[],
  tables: TaxYearTables,
): number {
  return roundToCent(
    disposals.reduce((total, disposal) => {
      let gain = disposal.proceeds - disposal.baseCost;
      if (disposal.isPrimaryResidence && gain > 0) {
        gain = Math.max(0, gain - tables.cgt.primaryResidenceExclusion);
      }
      return total + gain;
    }, 0),
  );
}

/*
 * Per-month scheme headcount for the section 6A credit: the taxpayer while a
 * main member, plus each dependent for their covered months. Months count
 * from the start of the tax year.
 */
export function monthlySchemeHeadcount(
  profile: Pick<TaxpayerProfile, "medicalSchemeMonths">,
  dependents: readonly Dependent[],
): number[] {
  const months: number[] = [];
  for (let month = 0; month < 12; month += 1) {
    let persons = profile.medicalSchemeMonths > month ? 1 : 0;
    for (const dependent of dependents) {
      if (dependent.medicalSchemeMonths > month) {
        persons += 1;
      }
    }
    months.push(persons);
  }
  return months;
}

/** True when any dependent or the taxpayer has a recognised disability. */
export function anyDisability(
  profile: Pick<TaxpayerProfile, "hasDisability">,
  dependents: readonly Dependent[],
): boolean {
  return (
    profile.hasDisability ||
    dependents.some((dependent) => dependent.hasDisability)
  );
}
