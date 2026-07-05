import { describe, expect, it } from "vitest";
import { taxBeforeRebates } from "@/lib/tax-engine/brackets";
import {
  ageAtTaxYearEnd,
  taxAfterRebates,
  taxThresholdForAge,
  totalRebates,
} from "@/lib/tax-engine/rebates";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");
const y2026 = getTaxYear("2026-27");

describe("ageAtTaxYearEnd", () => {
  it("uses the taxpayer's age on the last day of the tax year", () => {
    // Born 1 March 1961: turns 65 the day after the 2025/26 year ends.
    expect(ageAtTaxYearEnd("1961-03-01", y2025)).toBe(64);
    // Born 28 February 1961: turns 65 exactly on the last day.
    expect(ageAtTaxYearEnd("1961-02-28", y2025)).toBe(65);
  });

  it("handles a birthday earlier in the tax year", () => {
    // Born 15 June 1950: is 75 by 28 February 2026.
    expect(ageAtTaxYearEnd("1950-06-15", y2025)).toBe(75);
  });
});

describe("totalRebates", () => {
  it("grants only the primary rebate under 65", () => {
    expect(totalRebates(40, y2025)).toBe(17_235);
    expect(totalRebates(40, y2026)).toBe(17_820);
  });

  it("adds the secondary rebate from 65", () => {
    expect(totalRebates(65, y2025)).toBe(26_679);
    expect(totalRebates(65, y2026)).toBe(27_585);
  });

  it("adds the tertiary rebate from 75", () => {
    expect(totalRebates(75, y2025)).toBe(29_824);
    expect(totalRebates(75, y2026)).toBe(30_834);
  });
});

describe("taxThresholdForAge", () => {
  it("returns the published thresholds per age band", () => {
    expect(taxThresholdForAge(30, y2025)).toBe(95_750);
    expect(taxThresholdForAge(66, y2025)).toBe(148_217);
    expect(taxThresholdForAge(80, y2025)).toBe(165_689);
    expect(taxThresholdForAge(30, y2026)).toBe(99_000);
    expect(taxThresholdForAge(66, y2026)).toBe(153_250);
    expect(taxThresholdForAge(80, y2026)).toBe(171_300);
  });
});

describe("taxAfterRebates", () => {
  it("nets rebates off gross tax", () => {
    // 450 000 taxable, under 65, 2025/26: 102 007 - 17 235
    expect(taxAfterRebates(taxBeforeRebates(450_000, y2025), 40, y2025)).toBe(
      84_772,
    );
    // Same income 2026/27: 100 737 - 17 820
    expect(taxAfterRebates(taxBeforeRebates(450_000, y2026), 40, y2026)).toBe(
      82_917,
    );
  });

  it("never returns negative tax", () => {
    expect(taxAfterRebates(taxBeforeRebates(50_000, y2025), 40, y2025)).toBe(0);
  });

  it("produces zero tax at the published threshold for each age band", () => {
    for (const [age, threshold] of [
      [40, 95_750],
      [66, 148_217],
      [80, 165_689],
    ] as const) {
      const gross = taxBeforeRebates(threshold, y2025);
      expect(taxAfterRebates(gross, age, y2025)).toBeLessThanOrEqual(0.6);
    }
  });

  it("produces positive tax just above the threshold", () => {
    const gross = taxBeforeRebates(96_500, y2025);
    expect(taxAfterRebates(gross, 40, y2025)).toBeGreaterThan(0);
  });
});
