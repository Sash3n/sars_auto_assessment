import { monthsOfTaxYear } from "@/lib/model/months";
import type { AppData, Payslip, TaxYearData } from "@/lib/model/types";
import { composeAssessment, type Assessment } from "@/lib/tax-engine/assessment";
import { roundToCent } from "@/lib/tax-engine/money";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import type { TaxYearTables } from "@/lib/tax-engine/types";

/* Pure data shaping for the dashboard. Rendering stays in components. */

export interface MonthlyPoint {
  month: string;
  label: string;
  income: number;
  paye: number;
}

function payslipGross(slip: Payslip): number {
  return (
    slip.basicSalary +
    slip.annualBonus +
    slip.leavePay +
    slip.allowances.reduce((total, item) => total + item.amount, 0) +
    slip.otherFringeBenefits.reduce((total, item) => total + item.amount, 0) +
    slip.employerMedicalAid +
    slip.employerRetirement
  );
}

/** Income and PAYE per tax year month, summed across all employers. */
export function monthlyPayrollSeries(
  year: TaxYearData,
  tables: TaxYearTables,
): MonthlyPoint[] {
  return monthsOfTaxYear(tables).map(({ value, label }) => {
    const slips = year.payslips.filter((slip) => slip.periodMonth === value);
    return {
      month: value,
      label,
      income: roundToCent(
        slips.reduce((total, slip) => total + payslipGross(slip), 0),
      ),
      paye: roundToCent(slips.reduce((total, slip) => total + slip.paye, 0)),
    };
  });
}

export interface BreakdownSlice {
  label: string;
  amount: number;
  /** Share of total deductions, 0 to 100. */
  percent: number;
}

/** Deduction lines as positive amounts with their share of the total. */
export function deductionBreakdown(assessment: Assessment): BreakdownSlice[] {
  const slices = assessment.deductionLines.map((line) => ({
    label: line.description,
    amount: Math.abs(line.amount),
  }));
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  if (total === 0) {
    return [];
  }
  return slices.map((slice) => ({
    ...slice,
    percent: Math.round((slice.amount / total) * 1000) / 10,
  }));
}

export interface YearSummary {
  taxYearId: string;
  label: string;
  incomeTotal: number;
  effectiveRatePercent: number;
  result: number;
}

/** One summary row per stored tax year that has any captured income. */
export function yearOverYear(state: AppData): YearSummary[] {
  return Object.values(state.years)
    .map((year) => {
      const tables = getTaxYear(year.taxYearId);
      const assessment = composeAssessment(year, tables);
      return {
        taxYearId: year.taxYearId,
        label: tables.label,
        incomeTotal: assessment.incomeTotal,
        effectiveRatePercent: assessment.effectiveRatePercent,
        result: assessment.assessmentResult,
      };
    })
    .filter((summary) => summary.incomeTotal > 0)
    .sort((a, b) => a.taxYearId.localeCompare(b.taxYearId));
}

export interface BracketSegment {
  from: number;
  to: number | null;
  rate: number;
  /** Width share of the whole bar, 0 to 100. */
  share: number;
  containsMarker: boolean;
}

export interface BracketView {
  segments: BracketSegment[];
  /** Taxpayer position across the bar, 0 to 100. */
  markerPercent: number;
  marginalRate: number;
  domainMax: number;
}

/** Bracket table laid out on a linear rand scale with the taxpayer marker. */
export function bracketSegments(
  tables: TaxYearTables,
  taxableIncome: number,
): BracketView {
  const topStart = tables.brackets[tables.brackets.length - 1].above;
  const domainMax = Math.max(topStart * 1.15, taxableIncome * 1.05, 1);
  const marker = Math.min(taxableIncome, domainMax);

  const segments = tables.brackets.map((bracket) => {
    const from = bracket.above;
    const to = bracket.upTo;
    const end = to ?? domainMax;
    return {
      from,
      to,
      rate: bracket.rate,
      share: ((end - from) / domainMax) * 100,
      containsMarker:
        taxableIncome > from && (to === null || taxableIncome <= to),
    };
  });

  const active = segments.find((segment) => segment.containsMarker);
  return {
    segments,
    markerPercent: (marker / domainMax) * 100,
    marginalRate: taxableIncome > 0 && active ? active.rate : 0,
    domainMax,
  };
}
