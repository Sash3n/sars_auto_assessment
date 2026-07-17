import { describe, expect, it } from "vitest";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { compareAssessments } from "@/lib/tax-engine/compare";
import {
  buildObjectionSummary,
  formatObjectionSummaryText,
} from "@/lib/tax-engine/objection";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import { emptyPayslip, emptyYear } from "@/lib/model/defaults";
import type { ParsedIta34 } from "@/lib/extraction/ita34";

const y2025 = getTaxYear("2025-26");

function simpleAssessment() {
  const year = emptyYear("2025-26");
  year.profile.dateOfBirth = "1990-06-15";
  year.payslips = [
    {
      ...emptyPayslip("2025-03"),
      employer: "Acme",
      basicSalary: 360_000,
      paye: 72_000,
    },
  ];
  return composeAssessment(year, y2025);
}

function sarsSide(partial: Partial<ParsedIta34>): ParsedIta34 {
  return { codes: {}, summary: {}, warnings: [], ...partial };
}

describe("buildObjectionSummary", () => {
  it("includes only mismatched rows, never matches or not-available rows", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 360_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const lines = buildObjectionSummary(rows);
    expect(lines).toHaveLength(0);
  });

  it("explains a coded line mismatch with both amounts and the delta", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 350_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const lines = buildObjectionSummary(rows);
    const line = lines.find((l) => l.code === "3601");
    expect(line).toBeDefined();
    expect(line?.appAmount).toBe(360_000);
    expect(line?.sarsAmount).toBe(350_000);
    expect(line?.delta).toBe(10_000);
    expect(line?.reasoning).toMatch(/360.*000/);
    expect(line?.reasoning).toMatch(/350.*000/);
  });

  it("explains a summary row mismatch (keyed, not coded) without dropping it", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({
      codes: { "3601": 360_000 },
      summary: { assessedTaxAfterRebates: 999_999 },
    });
    const rows = compareAssessments(mine, sars, 5);
    const lines = buildObjectionSummary(rows);
    const line = lines.find((l) => l.key === "assessedTaxAfterRebates");
    expect(line).toBeDefined();
    expect(line?.code).toBeUndefined();
    expect(line?.reasoning.length).toBeGreaterThan(0);
  });

  it("states plainly when SARS assessed a code this app did not calculate at all", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 360_000, "3801": 5_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const lines = buildObjectionSummary(rows);
    const line = lines.find((l) => l.code === "3801");
    expect(line).toBeDefined();
    expect(line?.appAmount).toBeNull();
    expect(line?.sarsAmount).toBe(5_000);
    expect(line?.reasoning).toMatch(/did not calculate/i);
  });
});

describe("formatObjectionSummaryText", () => {
  it("produces a stable plain-text format for pasting into eFiling", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 350_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const lines = buildObjectionSummary(rows);
    const text = formatObjectionSummaryText(lines, "2025/26");

    expect(text).toContain("2025/26");
    expect(text).toContain("3601");
    expect(text).toContain("360 000");
    expect(text).toContain("350 000");
    expect(text).toContain("10 000");
  });

  it("returns a clear message when there is nothing to object to", () => {
    expect(formatObjectionSummaryText([], "2025/26")).toMatch(/no mismatches/i);
  });
});
