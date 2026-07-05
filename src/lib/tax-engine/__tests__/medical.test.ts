import { describe, expect, it } from "vitest";
import {
  additionalMedicalCredit,
  annualMedicalSchemeCredit,
  monthlyMedicalSchemeCredit,
} from "@/lib/tax-engine/medical";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");
const y2026 = getTaxYear("2026-27");

describe("monthlyMedicalSchemeCredit", () => {
  it("returns zero when nobody is covered", () => {
    expect(monthlyMedicalSchemeCredit(0, y2025)).toBe(0);
  });

  it("credits the main member", () => {
    expect(monthlyMedicalSchemeCredit(1, y2025)).toBe(364);
    expect(monthlyMedicalSchemeCredit(1, y2026)).toBe(376);
  });

  it("credits the first dependant at the main member rate", () => {
    expect(monthlyMedicalSchemeCredit(2, y2025)).toBe(728);
    expect(monthlyMedicalSchemeCredit(2, y2026)).toBe(752);
  });

  it("credits additional dependants at the lower rate", () => {
    // Family of four, 2025/26: 364 + 364 + 246 + 246
    expect(monthlyMedicalSchemeCredit(4, y2025)).toBe(1_220);
    // Family of four, 2026/27: 376 + 376 + 254 + 254
    expect(monthlyMedicalSchemeCredit(4, y2026)).toBe(1_260);
  });

  it("rejects negative membership counts", () => {
    expect(() => monthlyMedicalSchemeCredit(-1, y2025)).toThrow(
      /persons covered/i,
    );
  });
});

describe("annualMedicalSchemeCredit", () => {
  it("sums a full year of cover", () => {
    expect(annualMedicalSchemeCredit(Array(12).fill(4), y2025)).toBe(14_640);
    expect(annualMedicalSchemeCredit(Array(12).fill(4), y2026)).toBe(15_120);
  });

  it("handles membership changes during the year", () => {
    // Six months single, six months with a spouse, 2025/26.
    const months = [...Array(6).fill(1), ...Array(6).fill(2)];
    expect(annualMedicalSchemeCredit(months, y2025)).toBe(364 * 6 + 728 * 6);
  });

  it("handles a partial year of cover", () => {
    expect(annualMedicalSchemeCredit(Array(3).fill(1), y2025)).toBe(1_092);
  });
});

describe("additionalMedicalCredit (section 6B)", () => {
  it("is zero when nothing exceeds the floors, under 65", () => {
    const credit = additionalMedicalCredit(
      {
        age: 40,
        hasDisability: false,
        contributionsPaid: 48_000,
        annualSchemeCredit: 14_640,
        qualifyingExpenses: 30_000,
        taxableIncome: 400_000,
      },
      y2025,
    );
    // Contributions do not exceed 4 x 14 640 = 58 560. Expenses of 30 000
    // do not exceed 7.5 percent of 400 000 = 30 000.
    expect(credit).toBe(0);
  });

  it("computes the under-65 credit on the excess over both floors", () => {
    const credit = additionalMedicalCredit(
      {
        age: 40,
        hasDisability: false,
        contributionsPaid: 80_000,
        annualSchemeCredit: 14_640,
        qualifyingExpenses: 25_000,
        taxableIncome: 400_000,
      },
      y2025,
    );
    // Excess contributions: 80 000 - 58 560 = 21 440.
    // 21 440 + 25 000 = 46 440, less 30 000 floor = 16 440. At 25 percent.
    expect(credit).toBe(4_110);
  });

  it("computes the 65-plus credit at 33.3 percent with a 3x multiple", () => {
    const credit = additionalMedicalCredit(
      {
        age: 70,
        hasDisability: false,
        contributionsPaid: 60_000,
        annualSchemeCredit: 8_736,
        qualifyingExpenses: 20_000,
        taxableIncome: 300_000,
      },
      y2025,
    );
    // Excess contributions: 60 000 - 26 208 = 33 792.
    // 33.3% of 33 792 = 11 252.736 and 33.3% of 20 000 = 6 660.
    expect(credit).toBeCloseTo(17_912.74, 2);
  });

  it("treats a disabled taxpayer like a 65-plus taxpayer", () => {
    const senior = additionalMedicalCredit(
      {
        age: 70,
        hasDisability: false,
        contributionsPaid: 60_000,
        annualSchemeCredit: 8_736,
        qualifyingExpenses: 20_000,
        taxableIncome: 300_000,
      },
      y2025,
    );
    const disabled = additionalMedicalCredit(
      {
        age: 35,
        hasDisability: true,
        contributionsPaid: 60_000,
        annualSchemeCredit: 8_736,
        qualifyingExpenses: 20_000,
        taxableIncome: 300_000,
      },
      y2025,
    );
    expect(disabled).toBe(senior);
  });

  it("never returns a negative credit", () => {
    const credit = additionalMedicalCredit(
      {
        age: 40,
        hasDisability: false,
        contributionsPaid: 0,
        annualSchemeCredit: 0,
        qualifyingExpenses: 0,
        taxableIncome: 500_000,
      },
      y2025,
    );
    expect(credit).toBe(0);
  });
});
