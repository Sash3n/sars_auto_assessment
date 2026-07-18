import { describe, expect, it } from "vitest";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { calculateIrp6 } from "@/lib/tax-engine/irp6";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import { emptyPayslip, emptyYear } from "@/lib/model/defaults";
import type { TaxYearData } from "@/lib/model/types";

const y2025 = getTaxYear("2025-26");

/*
 * Payroll 40 000/month basic, 8 000/month PAYE (480 000 income, 96 000
 * PAYE), age 35 (date of birth 1990-06-15), plus 200 000 rental income with
 * no expenses, non-PAYE income that makes this taxpayer provisional.
 * Taxable income 680 000, falls in the 39 percent bracket: tax
 * 179 147 + 39% of 7 000 = 181 877, less primary rebate 17 235: assessed
 * tax after rebates 164 642.
 */
function provisionalYear(): TaxYearData {
  const year = emptyYear("2025-26");
  year.profile.dateOfBirth = "1990-06-15";
  year.payslips = [
    {
      ...emptyPayslip("2025-03"),
      employer: "Acme Widgets",
      basicSalary: 480_000,
      paye: 96_000,
    },
  ];
  year.rentals = [
    {
      id: "r1",
      name: "Garden flat",
      rentalIncome: 200_000,
      expenses: [],
      apportionmentPercent: 100,
    },
  ];
  return year;
}

describe("calculateIrp6, estimated income method", () => {
  const year = provisionalYear();
  const assessment = composeAssessment(year, y2025);
  const result = calculateIrp6(
    { priorYearTaxableIncome: null, priorAssessmentOverEighteenMonthsOld: false, currentYear: assessment },
    y2025,
  );

  it("uses this year's own estimate for taxable income and tax", () => {
    expect(result.estimatedIncomeMethod.taxableIncomeUsed).toBe(680_000);
    expect(result.estimatedIncomeMethod.taxOnEstimate).toBe(164_642);
  });

  it("splits the tax due, less PAYE already withheld, across both payments", () => {
    // 164 642 / 2 - 96 000 / 2 = 82 321 - 48 000 = 34 321 for each payment.
    expect(result.estimatedIncomeMethod.firstPeriodPayment).toBe(34_321);
    expect(result.estimatedIncomeMethod.secondPeriodPayment).toBe(34_321);
  });

  it("reports no basic amount method when no prior year taxable income is known", () => {
    expect(result.basicAmountMethod).toBeNull();
  });
});

describe("calculateIrp6, basic amount method", () => {
  const year = provisionalYear();
  const assessment = composeAssessment(year, y2025);

  it("uplifts the prior year's taxable income by 8 percent when the assessment is over 18 months old", () => {
    const result = calculateIrp6(
      {
        priorYearTaxableIncome: 500_000,
        priorAssessmentOverEighteenMonthsOld: true,
        currentYear: assessment,
      },
      y2025,
    );
    // 500 000 x 1.08 = 540 000, tax 121 475 + 36% of 27 200 = 131 267, less
    // rebate 17 235 = 114 032. Payments: 114 032/2 - 96 000/2 = 9 016 each.
    expect(result.basicAmountMethod?.upliftPercent).toBe(8);
    expect(result.basicAmountMethod?.taxableIncomeUsed).toBe(540_000);
    expect(result.basicAmountMethod?.taxOnEstimate).toBe(114_032);
    expect(result.basicAmountMethod?.firstPeriodPayment).toBe(9_016);
    expect(result.basicAmountMethod?.secondPeriodPayment).toBe(9_016);
  });

  it("does not uplift the prior year's taxable income when the assessment is recent", () => {
    const result = calculateIrp6(
      {
        priorYearTaxableIncome: 500_000,
        priorAssessmentOverEighteenMonthsOld: false,
        currentYear: assessment,
      },
      y2025,
    );
    expect(result.basicAmountMethod?.upliftPercent).toBe(0);
    expect(result.basicAmountMethod?.taxableIncomeUsed).toBe(500_000);
  });

  it("warns of underestimation risk when the basic amount sits well below this year's own estimate", () => {
    const result = calculateIrp6(
      {
        priorYearTaxableIncome: 500_000,
        priorAssessmentOverEighteenMonthsOld: true,
        currentYear: assessment,
      },
      y2025,
    );
    // Basic amount 540 000 is below 90 percent of the 680 000 estimate.
    expect(result.estimatedIncomeMethod.penaltyRiskNote).not.toBeNull();
  });
});

describe("calculateIrp6, payments never go negative", () => {
  it("floors both payments at zero when PAYE already covers the estimated tax", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1990-06-15";
    year.payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme Widgets",
        basicSalary: 480_000,
        paye: 96_000,
      },
    ];
    const assessment = composeAssessment(year, y2025);
    const result = calculateIrp6(
      {
        priorYearTaxableIncome: null,
        priorAssessmentOverEighteenMonthsOld: false,
        currentYear: assessment,
      },
      y2025,
    );
    expect(result.estimatedIncomeMethod.firstPeriodPayment).toBe(0);
    expect(result.estimatedIncomeMethod.secondPeriodPayment).toBe(0);
  });
});
