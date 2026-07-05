import { describe, expect, it } from "vitest";
import { compareAssessments } from "@/lib/tax-engine/compare";
import { composeAssessment } from "@/lib/tax-engine/assessment";
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

describe("compareAssessments", () => {
  it("matches lines within the threshold", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({
      codes: { "3601": 360_000 },
      summary: { taxableIncome: 360_000 },
    });
    const rows = compareAssessments(mine, sars, 5);
    const line3601 = rows.find((row) => row.code === "3601");
    expect(line3601?.status).toBe("match");
    expect(line3601?.delta).toBe(0);
  });

  it("flags mismatches over the threshold with the delta", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 350_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const line3601 = rows.find((row) => row.code === "3601");
    expect(line3601?.status).toBe("mismatch");
    expect(line3601?.delta).toBe(10_000);
  });

  it("tolerates differences inside a custom threshold", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 359_995 } });
    const rows = compareAssessments(mine, sars, 10);
    expect(rows.find((row) => row.code === "3601")?.status).toBe("match");
  });

  it("marks SARS-side figures that could not be read as not available, never zero", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: {} });
    const rows = compareAssessments(mine, sars, 5);
    const line3601 = rows.find((row) => row.code === "3601");
    expect(line3601?.status).toBe("not-available");
    expect(line3601?.sarsAmount).toBeNull();
    expect(line3601?.delta).toBeNull();
  });

  it("compares the summary rows including the final result", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({
      summary: {
        taxableIncome: 360_000,
        assessedTaxAfterRebates: 60_000,
        taxCredits: 72_000,
        assessmentResult: -12_000,
      },
    });
    const rows = compareAssessments(mine, sars, 5);
    const taxable = rows.find((row) => row.key === "taxableIncome");
    expect(taxable?.status).toBe("match");
    const result = rows.find((row) => row.key === "assessmentResult");
    expect(result?.mineAmount).toBe(mine.assessmentResult);
    expect(result?.sarsAmount).toBe(-12_000);
  });

  it("includes SARS-only codes we did not calculate", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3801": 5_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const line3801 = rows.find((row) => row.code === "3801");
    expect(line3801?.mineAmount).toBeNull();
    expect(line3801?.sarsAmount).toBe(5_000);
    expect(line3801?.status).toBe("mismatch");
  });
});
