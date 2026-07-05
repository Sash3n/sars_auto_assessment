import { describe, expect, it } from "vitest";
import {
  bracketSegments,
  deductionBreakdown,
  monthlyPayrollSeries,
  yearOverYear,
} from "@/lib/analytics";
import { emptyAppData, emptyPayslip, emptyYear } from "@/lib/model/defaults";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";

const y2025 = getTaxYear("2025-26");

describe("monthlyPayrollSeries", () => {
  it("sums income and PAYE per month across employers", () => {
    const year = emptyYear("2025-26");
    year.payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "First",
        basicSalary: 20_000,
        paye: 3_000,
      },
      {
        ...emptyPayslip("2025-03"),
        employer: "Second",
        basicSalary: 10_000,
        paye: 1_500,
        allowances: [{ id: "a", label: "Phone", amount: 500 }],
      },
      {
        ...emptyPayslip("2025-04"),
        employer: "First",
        basicSalary: 20_000,
        paye: 3_000,
        employerMedicalAid: 1_500,
      },
    ];
    const series = monthlyPayrollSeries(year, y2025);
    expect(series).toHaveLength(12);
    expect(series[0]).toMatchObject({
      month: "2025-03",
      income: 30_500,
      paye: 4_500,
    });
    expect(series[1]).toMatchObject({
      month: "2025-04",
      income: 21_500,
      paye: 3_000,
    });
    expect(series[11]).toMatchObject({ month: "2026-02", income: 0, paye: 0 });
  });
});

describe("deductionBreakdown", () => {
  it("returns positive slices with percentage shares", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1990-06-15";
    year.profile.privateRetirementContributions = 60_000;
    year.profile.donations = 30_000;
    year.profile.homeOfficeExpenses = 10_000;
    year.payslips = [
      { ...emptyPayslip("2025-03"), employer: "Acme", basicSalary: 500_000 },
    ];
    const assessment = composeAssessment(year, y2025);
    const slices = deductionBreakdown(assessment);
    expect(slices).toHaveLength(3);
    expect(slices[0]).toMatchObject({ amount: 60_000, percent: 60 });
    expect(slices[1]).toMatchObject({ amount: 30_000, percent: 30 });
    expect(slices[2]).toMatchObject({ amount: 10_000, percent: 10 });
  });

  it("is empty when there are no deductions", () => {
    const assessment = composeAssessment(emptyYear("2025-26"), y2025);
    expect(deductionBreakdown(assessment)).toEqual([]);
  });
});

describe("yearOverYear", () => {
  it("summarises every stored year with data, sorted by year", () => {
    const state = emptyAppData();
    state.years["2025-26"].profile.dateOfBirth = "1990-06-15";
    state.years["2025-26"].payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme",
        basicSalary: 400_000,
        paye: 70_000,
      },
    ];
    state.years["2026-27"] = {
      ...emptyYear("2026-27"),
      payslips: [
        {
          ...emptyPayslip("2026-03"),
          employer: "Acme",
          basicSalary: 450_000,
          paye: 80_000,
        },
      ],
    };
    state.years["2026-27"].profile.dateOfBirth = "1990-06-15";

    const summaries = yearOverYear(state);
    expect(summaries.map((s) => s.taxYearId)).toEqual(["2025-26", "2026-27"]);
    expect(summaries[0].incomeTotal).toBe(400_000);
    expect(summaries[1].incomeTotal).toBe(450_000);
    expect(summaries[1].effectiveRatePercent).toBeGreaterThan(0);
  });

  it("skips years without captured income", () => {
    expect(yearOverYear(emptyAppData())).toEqual([]);
  });
});

describe("bracketSegments", () => {
  it("lays brackets on a linear scale with the marker in the right segment", () => {
    const view = bracketSegments(y2025, 497_600);
    expect(view.segments).toHaveLength(7);
    const total = view.segments.reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(100, 5);
    const active = view.segments.find((s) => s.containsMarker);
    expect(active?.rate).toBe(0.31);
    expect(view.marginalRate).toBe(0.31);
    expect(view.markerPercent).toBeGreaterThan(0);
    expect(view.markerPercent).toBeLessThan(100);
  });

  it("keeps the marker inside the bar for very high incomes", () => {
    const view = bracketSegments(y2025, 5_000_000);
    expect(view.markerPercent).toBeLessThanOrEqual(100);
    expect(view.marginalRate).toBe(0.45);
  });

  it("handles zero taxable income", () => {
    const view = bracketSegments(y2025, 0);
    expect(view.marginalRate).toBe(0);
    expect(view.markerPercent).toBe(0);
  });
});
