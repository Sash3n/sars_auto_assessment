import { describe, expect, it } from "vitest";
import {
  compareAssessments,
  groupComparisonRows,
} from "@/lib/tax-engine/compare";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import { emptyPayslip, emptyRental, emptyYear } from "@/lib/model/defaults";
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

  it("compares the coded rental income line, 4210", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1990-06-15";
    year.rentals = [
      {
        ...emptyRental(),
        name: "Garden flat",
        rentalIncome: 120_000,
        expenses: [{ id: "e1", label: "Levies", amount: 36_000 }],
      },
    ];
    const mine = composeAssessment(year, y2025);
    const sars = sarsSide({ codes: { "4210": 80_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const line4210 = rows.find((row) => row.code === "4210");
    expect(line4210?.mineAmount).toBe(84_000);
    expect(line4210?.sarsAmount).toBe(80_000);
    expect(line4210?.status).toBe("mismatch");
  });

  it("compares the coded taxable capital gain line, 4250", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1990-06-15";
    year.disposals = [
      {
        id: "d1",
        description: "Shares",
        proceeds: 150_000,
        baseCost: 50_000,
        isPrimaryResidence: false,
      },
    ];
    const mine = composeAssessment(year, y2025);
    const sars = sarsSide({ codes: { "4250": 24_000 } });
    const rows = compareAssessments(mine, sars, 5);
    const line4250 = rows.find((row) => row.code === "4250");
    expect(line4250?.mineAmount).toBe(24_000);
    expect(line4250?.status).toBe("match");
  });
});

describe("groupComparisonRows", () => {
  it("groups coded income, coded deductions, and summary rows under stable titles", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({
      codes: { "3601": 360_000, "4210": 80_000, "4011": 2_000 },
      summary: { taxableIncome: 360_000 },
    });
    const rows = compareAssessments(mine, sars, 5);
    const groups = groupComparisonRows(rows);

    const income = groups.find((group) => group.title === "Income");
    expect(income?.rows.some((row) => row.code === "3601")).toBe(true);
    expect(income?.rows.some((row) => row.code === "4210")).toBe(true);

    const deductions = groups.find(
      (group) => group.title === "Deductions and allowances",
    );
    expect(deductions?.rows.some((row) => row.code === "4011")).toBe(true);

    const summary = groups.find(
      (group) => group.title === "Tax liability and result",
    );
    expect(summary?.rows.some((row) => row.key === "taxableIncome")).toBe(
      true,
    );
  });

  it("omits empty groups", () => {
    const mine = simpleAssessment();
    const sars = sarsSide({ codes: { "3601": 360_000 } });
    const rows = compareAssessments(mine, sars, 5).filter(
      (row) => row.code === "3601",
    );
    const groups = groupComparisonRows(rows);
    expect(groups.map((group) => group.title)).toEqual(["Income"]);
  });
});
