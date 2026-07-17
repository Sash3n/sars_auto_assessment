import { describe, expect, it } from "vitest";
import {
  estimateMonthlyPaye,
  estimateMonthlyPayeCumulative,
} from "@/lib/tax-engine/monthly-paye";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");

describe("estimateMonthlyPaye", () => {
  it("annualises a regular month, applies the retirement deduction, rebate, and medical credit, then divides back down", () => {
    // Monthly remuneration 31 845.27 (basic 28 000 + employer medical 3 050 +
    // other taxable benefit 795.27), annualised: 382 143.24.
    // Retirement 4 200/month = 50 400/year, well under both the cap and 27.5%
    // of remuneration (105 089.39), so fully allowed.
    // Taxable income 331 743.24. Tax: 42 678 + 26% of 94 643.24 = 67 285.24.
    // Less primary rebate 17 235 and medical credit (1 person) 364 x 12 =
    // 4 368: annual PAYE estimate 45 682.24, monthly 3 806.85.
    const result = estimateMonthlyPaye(
      {
        monthlyRemuneration: 31_845.27,
        monthlyRetirementContributions: 4_200,
        age: 35,
        medicalSchemePersonsCovered: 1,
      },
      y2025,
    );
    expect(result.annualEquivalentRemuneration).toBe(382_143.24);
    expect(result.annualRetirementAllowed).toBe(50_400);
    expect(result.annualTaxableIncome).toBe(331_743.24);
    expect(result.annualTaxBeforeRebates).toBe(67_285.24);
    expect(result.annualRebates).toBe(17_235);
    expect(result.annualMedicalCredit).toBe(4_368);
    expect(result.annualPayeEstimate).toBe(45_682.24);
    expect(result.monthlyPayeEstimate).toBe(3_806.85);
  });

  it("caps the retirement deduction at 27.5 percent of annualised remuneration", () => {
    // Monthly remuneration 25 000 (annual 300 000), monthly retirement
    // 40 000 (annual 480 000). 27.5 percent of 300 000 is 82 500, below both
    // the R350 000 cap and the contributions, so 82 500 is allowed.
    // Taxable income 217 500, entirely in the 18 percent bracket: tax 39 150.
    // Less rebate 17 235, no medical credit: annual 21 915, monthly 1 826.25.
    const result = estimateMonthlyPaye(
      {
        monthlyRemuneration: 25_000,
        monthlyRetirementContributions: 40_000,
        age: 30,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );
    expect(result.annualRetirementAllowed).toBe(82_500);
    expect(result.annualTaxableIncome).toBe(217_500);
    expect(result.monthlyPayeEstimate).toBe(1_826.25);
  });

  it("applies the secondary rebate from age 65", () => {
    const under65 = estimateMonthlyPaye(
      {
        monthlyRemuneration: 20_000,
        monthlyRetirementContributions: 0,
        age: 64,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );
    const over65 = estimateMonthlyPaye(
      {
        monthlyRemuneration: 20_000,
        monthlyRetirementContributions: 0,
        age: 65,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );
    expect(over65.annualPayeEstimate).toBeLessThan(under65.annualPayeEstimate);
    expect(under65.annualRebates).toBe(17_235);
    expect(over65.annualRebates).toBe(17_235 + 9_444);
  });

  it("produces an all-zero result for zero remuneration without NaN", () => {
    const result = estimateMonthlyPaye(
      {
        monthlyRemuneration: 0,
        monthlyRetirementContributions: 0,
        age: 30,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );
    expect(result.annualTaxableIncome).toBe(0);
    expect(result.annualPayeEstimate).toBe(0);
    expect(result.monthlyPayeEstimate).toBe(0);
    expect(Number.isNaN(result.monthlyPayeEstimate)).toBe(false);
  });

  it("never returns a negative PAYE estimate when credits exceed tax", () => {
    const result = estimateMonthlyPaye(
      {
        monthlyRemuneration: 5_000,
        monthlyRetirementContributions: 0,
        age: 30,
        medicalSchemePersonsCovered: 4,
      },
      y2025,
    );
    expect(result.annualPayeEstimate).toBe(0);
    expect(result.monthlyPayeEstimate).toBe(0);
  });

  it("supports a non-monthly pay frequency via periodsInYear", () => {
    const monthly = estimateMonthlyPaye(
      {
        monthlyRemuneration: 20_000,
        monthlyRetirementContributions: 0,
        age: 30,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );
    const weekly = estimateMonthlyPaye(
      {
        monthlyRemuneration: 20_000 / 4,
        monthlyRetirementContributions: 0,
        age: 30,
        medicalSchemePersonsCovered: 0,
        periodsInYear: 52,
      },
      y2025,
    );
    // Monthly: annual 240 000, tax 42 678 + 26% of 2 900 = 43 432, less
    // rebate 17 235 = 26 197, monthly 2 183.08.
    expect(monthly.annualPayeEstimate).toBe(26_197);
    expect(monthly.monthlyPayeEstimate).toBe(2_183.08);
    // Weekly: annual 260 000, tax 42 678 + 26% of 22 900 = 48 632, less
    // rebate 17 235 = 31 397, weekly 603.79.
    expect(weekly.annualEquivalentRemuneration).toBe((20_000 / 4) * 52);
    expect(weekly.annualPayeEstimate).toBe(31_397);
    expect(weekly.monthlyPayeEstimate).toBe(603.79);
  });
});

describe("estimateMonthlyPayeCumulative", () => {
  it("smooths a bonus month using the cumulative average method, well below the flat method's overstatement", () => {
    // Six months flat 30 000, month 7 a 60 000 bonus on top of the usual
    // 30 000 (period remuneration 90 000). Age 35, no retirement, no
    // medical scheme.
    const priorMonths = Array.from({ length: 6 }, () => ({
      remuneration: 30_000,
      retirementContributions: 0,
    }));
    const bonusMonth = { remuneration: 90_000, retirementContributions: 0 };

    const cumulative = estimateMonthlyPayeCumulative(
      [...priorMonths, bonusMonth],
      35,
      0,
      y2025,
    );
    const flat = estimateMonthlyPaye(
      {
        monthlyRemuneration: 90_000,
        monthlyRetirementContributions: 0,
        age: 35,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );

    // Cumulative remuneration to date 270 000 over 7 periods annualises to
    // 462 857.14, tax 105 992.71, less primary rebate 17 235: annual PAYE
    // 88 757.71, cumulative tax due to date 51 775.33. The prior six months
    // annualise to 360 000, tax 74 632, less rebate: annual PAYE 57 397,
    // cumulative tax due 28 698.50. This period's PAYE is the difference.
    expect(cumulative.monthlyPayeEstimate).toBeCloseTo(23_076.83, 2);
    // The flat method treats 90 000 as if earned every month all year,
    // landing in the top brackets and materially overstating the estimate.
    expect(flat.monthlyPayeEstimate).toBeCloseTo(27_090.33, 2);
    expect(cumulative.monthlyPayeEstimate).toBeLessThan(
      flat.monthlyPayeEstimate,
    );
  });

  it("matches the flat method for a regular salary with no irregular months", () => {
    const months = Array.from({ length: 7 }, () => ({
      remuneration: 30_000,
      retirementContributions: 0,
    }));
    const cumulative = estimateMonthlyPayeCumulative(months, 35, 0, y2025);
    const flat = estimateMonthlyPaye(
      {
        monthlyRemuneration: 30_000,
        monthlyRetirementContributions: 0,
        age: 35,
        medicalSchemePersonsCovered: 0,
      },
      y2025,
    );
    expect(cumulative.monthlyPayeEstimate).toBeCloseTo(
      flat.monthlyPayeEstimate,
      2,
    );
  });

  it("matches the flat method exactly for the first period, since there is nothing to average yet", () => {
    const cumulative = estimateMonthlyPayeCumulative(
      [{ remuneration: 40_000, retirementContributions: 5_000 }],
      35,
      1,
      y2025,
    );
    const flat = estimateMonthlyPaye(
      {
        monthlyRemuneration: 40_000,
        monthlyRetirementContributions: 5_000,
        age: 35,
        medicalSchemePersonsCovered: 1,
      },
      y2025,
    );
    expect(cumulative.monthlyPayeEstimate).toBe(flat.monthlyPayeEstimate);
  });

  it("rejects an empty period history", () => {
    expect(() => estimateMonthlyPayeCumulative([], 35, 0, y2025)).toThrow();
  });
});
