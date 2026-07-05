import { describe, expect, it } from "vitest";
import { monthsOfTaxYear } from "@/lib/model/months";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

describe("monthsOfTaxYear", () => {
  it("runs March through February across the year boundary", () => {
    const months = monthsOfTaxYear(getTaxYear("2025-26"));
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ value: "2025-03", label: "Mar 2025" });
    expect(months[9]).toEqual({ value: "2025-12", label: "Dec 2025" });
    expect(months[10]).toEqual({ value: "2026-01", label: "Jan 2026" });
    expect(months[11]).toEqual({ value: "2026-02", label: "Feb 2026" });
  });
});
