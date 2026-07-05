import { describe, expect, it } from "vitest";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import {
  emptyDependent,
  emptyPayslip,
  emptyYear,
} from "@/lib/model/defaults";
import type { TaxYearData } from "@/lib/model/types";

const y2025 = getTaxYear("2025-26");

/*
 * Full reference scenario, 2025/26, taxpayer under 65.
 *
 * Payroll: 12 months basic 30 000 (3601 = 360 000), one bonus 25 000 (3605),
 * phone allowance 500 x 12 (3713 = 6 000), employer medical 1 500 x 12
 * (3805 = 18 000), employer retirement 2 500 x 12 (3817 = 30 000), employee
 * retirement 1 800 x 12 = 21 600, PAYE 6 000 x 12 = 72 000.
 * Payroll income = 439 000.
 *
 * Interest 30 000 (exempt 23 800, taxable 6 200). Rental 120 000 less
 * 36 000 expenses = 84 000. Freelance 40 000 less 10 000 = 30 000.
 * Income total = 439 000 + 6 200 + 84 000 + 30 000 = 559 200.
 *
 * Retirement contributions = 21 600 + 30 000 + private 10 000 = 61 600,
 * inside both the 27.5 percent limit (153 780) and the cap, so fully
 * allowed. Taxable income = 559 200 - 61 600 = 497 600.
 *
 * Tax: 77 362 + 31% of (497 600 - 370 500) = 116 763. Less primary rebate
 * 17 235 = 99 528. Medical scheme credit, three people twelve months:
 * (364 + 364 + 246) x 12 = 11 688. Section 6B credit is zero (contributions
 * under 4x the credit, expenses under the 7.5 percent floor).
 * Assessed tax after rebates = 87 840. Less PAYE 72 000 = 15 840 payable.
 */
function referenceYear(): TaxYearData {
  const year = emptyYear("2025-26");
  year.profile.dateOfBirth = "1990-06-15";
  year.profile.medicalSchemeMonths = 12;
  year.profile.privateMedicalContributions = 6_000;
  year.profile.qualifyingMedicalExpenses = 8_000;
  year.profile.privateRetirementContributions = 10_000;
  year.dependents = [
    { ...emptyDependent(), relationship: "spouse", medicalSchemeMonths: 12 },
    { ...emptyDependent(), relationship: "child", medicalSchemeMonths: 12 },
  ];
  const months = [
    "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08",
    "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
  ];
  year.payslips = months.map((month, index) => ({
    ...emptyPayslip(month),
    employer: "Acme Widgets",
    basicSalary: 30_000,
    annualBonus: index === 9 ? 25_000 : 0,
    allowances: [{ id: `a-${month}`, label: "Phone", amount: 500 }],
    employerMedicalAid: 1_500,
    employerRetirement: 2_500,
    employeeRetirement: 1_800,
    paye: 6_000,
    uif: 177.12,
  }));
  year.localInterest = 30_000;
  year.rentals = [
    {
      id: "r1",
      name: "Garden flat",
      rentalIncome: 120_000,
      expenses: [{ id: "e1", label: "Levies and rates", amount: 36_000 }],
      apportionmentPercent: 100,
    },
  ];
  year.freelance = [
    { id: "f1", description: "Design work", income: 40_000, expenses: 10_000 },
  ];
  return year;
}

describe("composeAssessment, full 2025/26 reference scenario", () => {
  const assessment = composeAssessment(referenceYear(), y2025);

  it("maps payroll to SARS coded income lines", () => {
    const byCode = new Map(
      assessment.incomeLines
        .filter((line) => line.code)
        .map((line) => [line.code, line.amount]),
    );
    expect(byCode.get("3601")).toBe(360_000);
    expect(byCode.get("3605")).toBe(25_000);
    expect(byCode.get("3713")).toBe(6_000);
    expect(byCode.get("3805")).toBe(18_000);
    expect(byCode.get("3817")).toBe(30_000);
    expect(byCode.get("4201")).toBe(30_000);
  });

  it("shows the interest exemption as a negative adjustment line", () => {
    const adjustment = assessment.incomeLines.find(
      (line) => line.amount < 0 && /exempt/i.test(line.description),
    );
    expect(adjustment?.amount).toBe(-23_800);
  });

  it("totals income across all sources", () => {
    expect(assessment.incomeTotal).toBe(559_200);
  });

  it("allows the full retirement deduction under code 4029", () => {
    expect(assessment.retirement.contributions).toBe(61_600);
    expect(assessment.retirement.allowed).toBe(61_600);
    expect(assessment.retirement.carriedForward).toBe(0);
    const line = assessment.deductionLines.find((l) => l.code === "4029");
    expect(line?.amount).toBe(-61_600);
  });

  it("computes taxable income", () => {
    expect(assessment.taxableIncome).toBe(497_600);
  });

  it("computes tax, rebates, and medical credits", () => {
    expect(assessment.taxBeforeRebates).toBe(116_763);
    expect(assessment.rebates).toBe(17_235);
    expect(assessment.medicalSchemeCredit).toBe(11_688);
    expect(assessment.additionalMedicalCredit).toBe(0);
    expect(assessment.assessedTaxAfterRebates).toBe(87_840);
  });

  it("nets PAYE off as a credit and lands on the payable result", () => {
    expect(assessment.paye).toBe(72_000);
    expect(assessment.assessmentResult).toBe(15_840);
    expect(assessment.netAmount).toBe(15_840);
  });

  it("reports the SARS rating percentage", () => {
    expect(assessment.effectiveRatePercent).toBeCloseTo(17.65, 2);
  });

  it("flags likely provisional taxpayer status for non-PAYE income", () => {
    expect(assessment.provisionalTaxpayerLikely).toBe(true);
  });
});

describe("composeAssessment, refund scenario", () => {
  it("returns a negative result when PAYE exceeds the liability", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1985-01-15";
    year.payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme",
        basicSalary: 240_000,
        paye: 30_000,
      },
    ];
    const assessment = composeAssessment(year, y2025);
    // Tax on 240 000: 42 678 + 26% of 2 900 = 43 432, less 17 235 = 26 197.
    expect(assessment.assessedTaxAfterRebates).toBe(26_197);
    expect(assessment.assessmentResult).toBe(-3_803);
  });
});

describe("composeAssessment, edge cases", () => {
  it("produces an all-zero assessment for an empty year without NaN", () => {
    const assessment = composeAssessment(emptyYear("2025-26"), y2025);
    expect(assessment.incomeTotal).toBe(0);
    expect(assessment.taxableIncome).toBe(0);
    expect(assessment.assessedTaxAfterRebates).toBe(0);
    expect(assessment.assessmentResult).toBe(0);
    expect(assessment.effectiveRatePercent).toBe(0);
    expect(Number.isNaN(assessment.netAmount)).toBe(false);
  });

  it("warns when the date of birth is missing and assumes under 65", () => {
    const year = emptyYear("2025-26");
    year.payslips = [
      { ...emptyPayslip("2025-03"), employer: "Acme", basicSalary: 300_000 },
    ];
    const assessment = composeAssessment(year, y2025);
    expect(assessment.rebates).toBe(17_235);
    expect(
      assessment.warnings.some((warning) => /date of birth/i.test(warning)),
    ).toBe(true);
  });

  it("carries excess retirement contributions forward", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1980-05-01";
    year.profile.privateRetirementContributions = 500_000;
    year.payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme",
        basicSalary: 2_000_000,
        paye: 600_000,
      },
    ];
    const assessment = composeAssessment(year, y2025);
    // 27.5 percent of 2 000 000 is 550 000, capped at 350 000.
    expect(assessment.retirement.allowed).toBe(350_000);
    expect(assessment.retirement.carriedForward).toBe(150_000);
  });

  it("includes taxable capital gains using the year's exclusion", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1980-05-01";
    year.disposals = [
      {
        id: "d1",
        description: "Shares",
        proceeds: 150_000,
        baseCost: 50_000,
        isPrimaryResidence: false,
      },
    ];
    const assessment = composeAssessment(year, y2025);
    // (100 000 - 40 000) x 40 percent = 24 000.
    expect(assessment.cgt.taxable).toBe(24_000);
    expect(assessment.incomeTotal).toBe(24_000);
  });
});
