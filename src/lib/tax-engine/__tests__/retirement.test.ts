import { describe, expect, it } from "vitest";
import { retirementDeduction } from "@/lib/tax-engine/retirement";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");
const y2026 = getTaxYear("2026-27");

describe("retirementDeduction", () => {
  it("allows contributions within the percentage limit in full", () => {
    const result = retirementDeduction(
      {
        contributions: 100_000,
        remuneration: 600_000,
        taxableIncomeBeforeDeduction: 580_000,
      },
      y2025,
    );
    expect(result).toEqual({ allowed: 100_000, carriedForward: 0 });
  });

  it("limits to 27.5 percent of the greater of remuneration or taxable income", () => {
    const result = retirementDeduction(
      {
        contributions: 200_000,
        remuneration: 600_000,
        taxableIncomeBeforeDeduction: 580_000,
      },
      y2025,
    );
    // 27.5 percent of 600 000 = 165 000.
    expect(result).toEqual({ allowed: 165_000, carriedForward: 35_000 });
  });

  it("uses taxable income when it exceeds remuneration", () => {
    const result = retirementDeduction(
      {
        contributions: 200_000,
        remuneration: 400_000,
        taxableIncomeBeforeDeduction: 700_000,
      },
      y2025,
    );
    // 27.5 percent of 700 000 = 192 500.
    expect(result).toEqual({ allowed: 192_500, carriedForward: 7_500 });
  });

  it("applies the 2025/26 annual cap of R350 000", () => {
    const result = retirementDeduction(
      {
        contributions: 500_000,
        remuneration: 2_000_000,
        taxableIncomeBeforeDeduction: 1_900_000,
      },
      y2025,
    );
    expect(result).toEqual({ allowed: 350_000, carriedForward: 150_000 });
  });

  it("applies the raised 2026/27 annual cap of R430 000", () => {
    const result = retirementDeduction(
      {
        contributions: 500_000,
        remuneration: 2_000_000,
        taxableIncomeBeforeDeduction: 1_900_000,
      },
      y2026,
    );
    expect(result).toEqual({ allowed: 430_000, carriedForward: 70_000 });
  });

  it("cannot exceed taxable income before the deduction", () => {
    const result = retirementDeduction(
      {
        contributions: 80_000,
        remuneration: 300_000,
        taxableIncomeBeforeDeduction: 60_000,
      },
      y2025,
    );
    expect(result).toEqual({ allowed: 60_000, carriedForward: 20_000 });
  });

  it("handles zero contributions", () => {
    const result = retirementDeduction(
      {
        contributions: 0,
        remuneration: 500_000,
        taxableIncomeBeforeDeduction: 480_000,
      },
      y2025,
    );
    expect(result).toEqual({ allowed: 0, carriedForward: 0 });
  });

  it("rejects negative contributions", () => {
    expect(() =>
      retirementDeduction(
        {
          contributions: -1,
          remuneration: 500_000,
          taxableIncomeBeforeDeduction: 480_000,
        },
        y2025,
      ),
    ).toThrow(/contributions/i);
  });
});
