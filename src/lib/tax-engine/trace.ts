import {
  aggregatePayslips,
  anyDisability,
  monthlySchemeHeadcount,
  netCapitalGains,
  netFreelanceIncome,
  netRentalIncome,
} from "@/lib/model/aggregate";
import type { TaxYearData } from "@/lib/model/types";
import { isIsoDate } from "@/lib/model/validate";
import { taxBeforeRebates } from "./brackets";
import { taxableCapitalGain } from "./cgt";
import { splitExemptInterest } from "./interest";
import {
  additionalMedicalCredit,
  annualMedicalSchemeCredit,
} from "./medical";
import { roundToCent } from "./money";
import { ageAtTaxYearEnd, totalRebates } from "./rebates";
import { retirementDeduction } from "./retirement";
import type { TaxYearTables } from "./types";

/*
 * Mirrors composeAssessment's orchestration, but instead of producing final
 * figures it records how each figure was derived: which tax-engine function
 * ran, which table values it read, and the formula applied. Calls the same
 * pure functions assessment.ts does, so there is no duplicated tax logic,
 * only duplicated orchestration to also capture the working. Kept as a
 * separate module rather than threading trace collection through
 * composeAssessment itself, to avoid touching a central, heavily-tested
 * function.
 */

export interface TraceStep {
  code?: string;
  section: string;
  label: string;
  inputs: Record<string, number | string>;
  tableValuesUsed: Record<string, number>;
  formula: string;
  result: number;
}

export function buildAssessmentTrace(
  year: TaxYearData,
  tables: TaxYearTables,
): TraceStep[] {
  const steps: TraceStep[] = [];

  const age = isIsoDate(year.profile.dateOfBirth)
    ? ageAtTaxYearEnd(year.profile.dateOfBirth, tables)
    : 40;

  const payroll = aggregatePayslips(year.payslips);
  const interest = splitExemptInterest(year.localInterest, age, tables);
  const rental = netRentalIncome(year.rentals);
  const freelance = netFreelanceIncome(year.freelance);
  const netGains = netCapitalGains(year.disposals, tables);
  const taxableGain = taxableCapitalGain({ netGains }, tables);

  const incomeTotal = roundToCent(
    payroll.grossPayrollIncome +
      interest.taxable +
      rental +
      freelance +
      taxableGain,
  );

  const retirementContributions = roundToCent(
    payroll.retirementContributions +
      year.profile.privateRetirementContributions +
      year.carryForward.retirementExcessPrior,
  );
  const taxableIncomeBeforeDeduction = roundToCent(incomeTotal - taxableGain);
  const percentageLimit = roundToCent(
    tables.retirement.rate *
      Math.max(payroll.grossPayrollIncome, taxableIncomeBeforeDeduction),
  );
  const retirement = retirementDeduction(
    {
      contributions: retirementContributions,
      remuneration: payroll.grossPayrollIncome,
      taxableIncomeBeforeDeduction,
    },
    tables,
  );

  const candidates: [string, number][] = [
    ["contributions", retirementContributions],
    ["annual cap", tables.retirement.annualCap],
    ["27.5% of remuneration or taxable income", percentageLimit],
    ["taxable income before the deduction", taxableIncomeBeforeDeduction],
  ];
  const binding = candidates.reduce((min, candidate) =>
    candidate[1] < min[1] ? candidate : min,
  );

  steps.push({
    code: "4029",
    section: "retirement.retirementDeduction",
    label: "Retirement fund contributions allowed",
    inputs: {
      contributions: retirementContributions,
      remuneration: payroll.grossPayrollIncome,
      taxableIncomeBeforeDeduction,
    },
    tableValuesUsed: {
      rate: tables.retirement.rate,
      annualCap: tables.retirement.annualCap,
    },
    formula:
      `Lesser of contributions R ${retirementContributions.toFixed(2)}, the annual cap ` +
      `R ${tables.retirement.annualCap.toFixed(2)}, 27.5% of remuneration or taxable ` +
      `income R ${percentageLimit.toFixed(2)}, and taxable income before the deduction ` +
      `R ${taxableIncomeBeforeDeduction.toFixed(2)}. Binding limit: ${binding[0]}.`,
    result: retirement.allowed,
  });

  const deductionsTotal = roundToCent(
    retirement.allowed +
      year.profile.donations +
      year.profile.homeOfficeExpenses,
  );
  const taxableIncome = roundToCent(
    Math.max(0, incomeTotal - deductionsTotal),
  );

  const bracket = tables.brackets.findLast(
    (candidate) => taxableIncome > candidate.above,
  );
  const grossTax = taxBeforeRebates(taxableIncome, tables);
  steps.push({
    section: "brackets.taxBeforeRebates",
    label: "Normal tax before rebates",
    inputs: { taxableIncome },
    tableValuesUsed: bracket
      ? { above: bracket.above, base: bracket.base, rate: bracket.rate }
      : {},
    formula: bracket
      ? `R ${bracket.base.toFixed(2)} plus ${(bracket.rate * 100).toFixed(0)}% of the amount ` +
        `by which taxable income exceeds R ${bracket.above.toFixed(2)}`
      : "No tax: taxable income is zero or less",
    result: grossTax,
  });

  const rebates = taxableIncome > 0 ? totalRebates(age, tables) : 0;
  const rebateTableValues: Record<string, number> = {
    primary: tables.rebates.primary,
  };
  if (age >= 65) {
    rebateTableValues.secondary = tables.rebates.secondary;
  }
  if (age >= 75) {
    rebateTableValues.tertiary = tables.rebates.tertiary;
  }
  steps.push({
    section: "rebates.totalRebates",
    label: "Rebates",
    inputs: { age },
    tableValuesUsed: rebateTableValues,
    formula:
      age >= 75
        ? "Primary rebate plus secondary rebate plus tertiary rebate"
        : age >= 65
          ? "Primary rebate plus secondary rebate"
          : "Primary rebate only, taxpayer is under 65",
    result: rebates,
  });

  const headcounts = monthlySchemeHeadcount(year.profile, year.dependents);
  const schemeCredit = annualMedicalSchemeCredit(headcounts, tables);
  steps.push({
    section: "medical.annualMedicalSchemeCredit",
    label: "Section 6A medical scheme fees tax credit",
    inputs: { monthsCovered: headcounts.filter((persons) => persons > 0).length },
    tableValuesUsed: {
      mainMemberMonthly: tables.medicalCredit.mainMemberMonthly,
      firstDependantMonthly: tables.medicalCredit.firstDependantMonthly,
      additionalDependantMonthly: tables.medicalCredit.additionalDependantMonthly,
    },
    formula:
      "Sum of each covered month's credit: main member plus first dependant plus " +
      "additional dependants, at the published monthly rates",
    result: schemeCredit,
  });

  const contributionsPaid = roundToCent(
    payroll.employerMedicalContributions +
      year.profile.privateMedicalContributions,
  );
  const hasDisability = anyDisability(year.profile, year.dependents);
  const extraMedical = additionalMedicalCredit({
    age,
    hasDisability,
    contributionsPaid,
    annualSchemeCredit: schemeCredit,
    qualifyingExpenses: year.profile.qualifyingMedicalExpenses,
    taxableIncome,
  });
  steps.push({
    section: "medical.additionalMedicalCredit",
    label: "Section 6B additional medical expenses tax credit",
    inputs: {
      age,
      hasDisability: hasDisability ? "yes" : "no",
      contributionsPaid,
      qualifyingExpenses: year.profile.qualifyingMedicalExpenses,
      taxableIncome,
    },
    tableValuesUsed: { annualSchemeCredit: schemeCredit },
    formula:
      age >= 65 || hasDisability
        ? "33.3% of contributions beyond 3x the section 6A credit, plus 33.3% of " +
          "qualifying expenses"
        : "25% of the amount by which contributions beyond 4x the section 6A credit, " +
          "plus qualifying expenses, exceed 7.5% of taxable income",
    result: extraMedical,
  });

  return steps;
}
