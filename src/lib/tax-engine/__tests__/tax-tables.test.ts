import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAX_YEAR_ID,
  getTaxYear,
  listTaxYears,
} from "@/lib/tax-engine/tax-tables";

/*
 * Reference figures come from SARS "Rates of Tax for Individuals" and the
 * Treasury Budget 2026 Tax Guide. The 2025/26 year carried 2024/25 figures
 * forward unchanged. The 2026/27 year applied a 3.4 percent adjustment to
 * brackets, the primary rebate, and medical credits, raised the retirement
 * deduction cap to R430,000, and raised the CGT exclusions.
 */

describe("tax year registry", () => {
  it("exposes both supported tax years", () => {
    const ids = listTaxYears().map((year) => year.id);
    expect(ids).toContain("2025-26");
    expect(ids).toContain("2026-27");
  });

  it("returns tables by id", () => {
    expect(getTaxYear("2025-26").label).toBe("2025/26");
    expect(getTaxYear("2026-27").label).toBe("2026/27");
  });

  it("throws on an unknown tax year", () => {
    expect(() => getTaxYear("1999-00")).toThrow(/unknown tax year/i);
  });

  it("defaults to the year currently being assessed", () => {
    expect(DEFAULT_TAX_YEAR_ID).toBe("2025-26");
  });
});

describe("2025/26 tables", () => {
  const tables = getTaxYear("2025-26");

  it("covers 1 March 2025 to 28 February 2026", () => {
    expect(tables.periodStart).toBe("2025-03-01");
    expect(tables.periodEnd).toBe("2026-02-28");
  });

  it("has the published brackets", () => {
    expect(tables.brackets).toHaveLength(7);
    expect(tables.brackets[0]).toMatchObject({ above: 0, base: 0, rate: 0.18 });
    expect(tables.brackets[1]).toMatchObject({
      above: 237_100,
      base: 42_678,
      rate: 0.26,
    });
    expect(tables.brackets[6]).toMatchObject({
      above: 1_817_000,
      base: 644_489,
      rate: 0.45,
    });
  });

  it("has the published rebates and thresholds", () => {
    expect(tables.rebates).toEqual({
      primary: 17_235,
      secondary: 9_444,
      tertiary: 3_145,
    });
    expect(tables.thresholds).toEqual({
      under65: 95_750,
      from65to74: 148_217,
      from75: 165_689,
    });
  });

  it("has the published credits, caps, and rates", () => {
    expect(tables.medicalCredit).toEqual({
      mainMemberMonthly: 364,
      firstDependantMonthly: 364,
      additionalDependantMonthly: 246,
    });
    expect(tables.retirement).toEqual({ rate: 0.275, annualCap: 350_000 });
    expect(tables.interestExemption).toEqual({
      under65: 23_800,
      from65: 34_500,
    });
    expect(tables.travel.reimbursiveRatePerKm).toBe(4.76);
    expect(tables.cgt).toEqual({
      inclusionRate: 0.4,
      annualExclusion: 40_000,
      deathYearExclusion: 300_000,
      primaryResidenceExclusion: 2_000_000,
    });
  });
});

describe("2026/27 tables", () => {
  const tables = getTaxYear("2026-27");

  it("covers 1 March 2026 to 28 February 2027", () => {
    expect(tables.periodStart).toBe("2026-03-01");
    expect(tables.periodEnd).toBe("2027-02-28");
  });

  it("has the published brackets", () => {
    expect(tables.brackets).toHaveLength(7);
    expect(tables.brackets[0]).toMatchObject({ above: 0, base: 0, rate: 0.18 });
    expect(tables.brackets[1]).toMatchObject({
      above: 245_100,
      base: 44_118,
      rate: 0.26,
    });
    expect(tables.brackets[6]).toMatchObject({
      above: 1_878_600,
      base: 666_339,
      rate: 0.45,
    });
  });

  it("has the published rebates and thresholds", () => {
    expect(tables.rebates).toEqual({
      primary: 17_820,
      secondary: 9_765,
      tertiary: 3_249,
    });
    expect(tables.thresholds).toEqual({
      under65: 99_000,
      from65to74: 153_250,
      from75: 171_300,
    });
  });

  it("has the published credits, caps, and rates", () => {
    expect(tables.medicalCredit).toEqual({
      mainMemberMonthly: 376,
      firstDependantMonthly: 376,
      additionalDependantMonthly: 254,
    });
    expect(tables.retirement).toEqual({ rate: 0.275, annualCap: 430_000 });
    expect(tables.interestExemption).toEqual({
      under65: 23_800,
      from65: 34_500,
    });
    expect(tables.travel.reimbursiveRatePerKm).toBe(4.95);
    expect(tables.cgt).toEqual({
      inclusionRate: 0.4,
      annualExclusion: 50_000,
      deathYearExclusion: 440_000,
      primaryResidenceExclusion: 3_000_000,
    });
  });
});

describe("table integrity invariants", () => {
  it.each(listTaxYears().map((year) => [year.id] as const))(
    "%s brackets are continuous: each base equals the previous bracket evaluated at its boundary",
    (id) => {
      const { brackets } = getTaxYear(id);
      for (let i = 1; i < brackets.length; i += 1) {
        const previous = brackets[i - 1];
        const current = brackets[i];
        const expectedBase =
          previous.base + previous.rate * (current.above - previous.above);
        expect(current.base).toBeCloseTo(expectedBase, 6);
      }
    },
  );

  it.each(listTaxYears().map((year) => [year.id] as const))(
    "%s brackets are sorted and rates increase",
    (id) => {
      const { brackets } = getTaxYear(id);
      for (let i = 1; i < brackets.length; i += 1) {
        expect(brackets[i].above).toBeGreaterThan(brackets[i - 1].above);
        expect(brackets[i].rate).toBeGreaterThan(brackets[i - 1].rate);
      }
    },
  );

  it.each(listTaxYears().map((year) => [year.id] as const))(
    "%s under-65 threshold matches the primary rebate at the entry rate",
    (id) => {
      const { thresholds, rebates, brackets } = getTaxYear(id);
      expect(thresholds.under65 * brackets[0].rate).toBeCloseTo(
        rebates.primary,
        0,
      );
    },
  );
});
