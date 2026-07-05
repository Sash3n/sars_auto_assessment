import { describe, expect, it } from "vitest";
import { formatRand, formatRandWhole } from "@/lib/format";

describe("formatRand", () => {
  it("formats with the R prefix, space separators, and cents", () => {
    expect(formatRand(12_450.5)).toBe("R 12 450.50");
    expect(formatRand(1_234_567.89)).toBe("R 1 234 567.89");
    expect(formatRand(0)).toBe("R 0.00");
    expect(formatRand(999)).toBe("R 999.00");
  });

  it("keeps the sign in front of the R", () => {
    expect(formatRand(-3_500.25)).toBe("-R 3 500.25");
  });
});

describe("formatRandWhole", () => {
  it("rounds to whole rand", () => {
    expect(formatRandWhole(12_450.5)).toBe("R 12 451");
    expect(formatRandWhole(-999.4)).toBe("-R 999");
  });
});
