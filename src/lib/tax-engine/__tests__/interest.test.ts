import { describe, expect, it } from "vitest";
import { splitExemptInterest } from "@/lib/tax-engine/interest";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");

describe("splitExemptInterest", () => {
  it("exempts local interest up to the under-65 limit", () => {
    expect(splitExemptInterest(30_000, 40, y2025)).toEqual({
      exempt: 23_800,
      taxable: 6_200,
    });
  });

  it("exempts local interest up to the 65-plus limit", () => {
    expect(splitExemptInterest(30_000, 70, y2025)).toEqual({
      exempt: 30_000,
      taxable: 0,
    });
    expect(splitExemptInterest(40_000, 70, y2025)).toEqual({
      exempt: 34_500,
      taxable: 5_500,
    });
  });

  it("exempts everything when interest is below the limit", () => {
    expect(splitExemptInterest(10_000, 40, y2025)).toEqual({
      exempt: 10_000,
      taxable: 0,
    });
  });

  it("handles zero interest", () => {
    expect(splitExemptInterest(0, 40, y2025)).toEqual({
      exempt: 0,
      taxable: 0,
    });
  });

  it("rejects negative interest", () => {
    expect(() => splitExemptInterest(-5, 40, y2025)).toThrow(/interest/i);
  });
});
