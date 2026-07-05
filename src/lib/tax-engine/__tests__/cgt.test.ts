import { describe, expect, it } from "vitest";
import { taxableCapitalGain } from "@/lib/tax-engine/cgt";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");
const y2026 = getTaxYear("2026-27");

describe("taxableCapitalGain", () => {
  it("applies the annual exclusion then the inclusion rate, 2025/26", () => {
    // (100 000 - 40 000) x 40 percent.
    expect(taxableCapitalGain({ netGains: 100_000 }, y2025)).toBe(24_000);
  });

  it("applies the raised 2026/27 exclusion", () => {
    // (100 000 - 50 000) x 40 percent.
    expect(taxableCapitalGain({ netGains: 100_000 }, y2026)).toBe(20_000);
  });

  it("is zero when gains fall inside the exclusion", () => {
    expect(taxableCapitalGain({ netGains: 35_000 }, y2025)).toBe(0);
    expect(taxableCapitalGain({ netGains: 49_999 }, y2026)).toBe(0);
  });

  it("uses the death-year exclusion when flagged", () => {
    expect(
      taxableCapitalGain({ netGains: 400_000, isDeathYear: true }, y2026),
    ).toBe(0);
    expect(
      taxableCapitalGain({ netGains: 500_000, isDeathYear: true }, y2026),
    ).toBe(24_000);
  });

  it("returns zero for a net capital loss", () => {
    expect(taxableCapitalGain({ netGains: -80_000 }, y2025)).toBe(0);
  });
});
