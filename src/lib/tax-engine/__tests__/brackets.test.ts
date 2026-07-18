import { describe, expect, it } from "vitest";
import { taxBeforeRebates } from "@/lib/tax-engine/brackets";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");
const y2026 = getTaxYear("2026-27");

describe("taxBeforeRebates 2025/26 reference figures", () => {
  it("taxes the first bracket at 18 percent", () => {
    expect(taxBeforeRebates(100_000, y2025)).toBe(18_000);
  });

  it("matches SARS at the first bracket boundary", () => {
    expect(taxBeforeRebates(237_100, y2025)).toBe(42_678);
  });

  it("computes a mid-table income exactly", () => {
    // 77 362 + 31% of (450 000 - 370 500) = 77 362 + 24 645
    expect(taxBeforeRebates(450_000, y2025)).toBe(102_007);
  });

  it("computes a high income in the 41 percent bracket", () => {
    // 251 258 + 41% of (1 000 000 - 857 900)
    expect(taxBeforeRebates(1_000_000, y2025)).toBe(309_519);
  });

  it("computes the top bracket", () => {
    // 644 489 + 45% of (2 000 000 - 1 817 000)
    expect(taxBeforeRebates(2_000_000, y2025)).toBe(726_839);
  });
});

describe("taxBeforeRebates 2026/27 reference figures", () => {
  it("matches SARS at the first bracket boundary", () => {
    expect(taxBeforeRebates(245_100, y2026)).toBe(44_118);
  });

  it("computes a mid-table income exactly", () => {
    // 79 998 + 31% of (450 000 - 383 100) = 79 998 + 20 739
    expect(taxBeforeRebates(450_000, y2026)).toBe(100_737);
  });

  it("computes a high income in the 41 percent bracket", () => {
    // 259 783 + 41% of (1 000 000 - 887 000)
    expect(taxBeforeRebates(1_000_000, y2026)).toBe(306_113);
  });

  it("computes the top bracket", () => {
    // 666 339 + 45% of (2 000 000 - 1 878 600)
    expect(taxBeforeRebates(2_000_000, y2026)).toBe(720_969);
  });

  it("is cheaper than 2025/26 for the same income after bracket relief", () => {
    expect(taxBeforeRebates(450_000, y2026)).toBeLessThan(
      taxBeforeRebates(450_000, y2025),
    );
  });
});

describe("taxBeforeRebates edge cases", () => {
  it("returns zero for zero income", () => {
    expect(taxBeforeRebates(0, y2025)).toBe(0);
  });

  it("returns zero for negative income (assessed loss)", () => {
    expect(taxBeforeRebates(-50_000, y2025)).toBe(0);
  });

  it("rounds to the cent for fractional taxable income", () => {
    // 18% of 100 000.55 is 18 000.099
    expect(taxBeforeRebates(100_000.55, y2025)).toBe(18_000.1);
  });

  it("handles income one rand above a boundary", () => {
    expect(taxBeforeRebates(237_101, y2025)).toBe(42_678.26);
  });
});
