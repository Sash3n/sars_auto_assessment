import { describe, expect, it } from "vitest";
import { estimateMonthlyPaye } from "@/lib/tax-engine/monthly-paye";
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
    // Same annual remuneration (20 000 x 12 vs 5 000 x 52 = 260 000), close
    // annual PAYE estimate; per-period figures differ by design.
    expect(weekly.annualEquivalentRemuneration).toBeCloseTo(
      20_000 * 12,
      -3,
    );
    expect(monthly.monthlyPayeEstimate).not.toBe(weekly.monthlyPayeEstimate);
  });
});
