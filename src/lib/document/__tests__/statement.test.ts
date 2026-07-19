import { describe, expect, it } from "vitest";
import { buildStatementDocument } from "@/lib/document/statement";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import {
  emptyDependent,
  emptyPayslip,
  emptyRental,
  emptyYear,
} from "@/lib/model/defaults";
import type { TaxYearData } from "@/lib/model/types";

const y2025 = getTaxYear("2025-26");

function fullScenarioYear(): TaxYearData {
  const year = emptyYear("2025-26");
  year.profile.dateOfBirth = "1990-06-15";
  year.profile.medicalSchemeMonths = 12;
  year.profile.privateMedicalContributions = 6_000;
  year.profile.donations = 5_000;
  year.dependents = [
    { ...emptyDependent(), relationship: "spouse", medicalSchemeMonths: 12 },
  ];
  year.payslips = [
    {
      ...emptyPayslip("2025-03"),
      employer: "Acme Widgets",
      basicSalary: 360_000,
      employeeRetirement: 21_600,
      employerRetirement: 30_000,
      paye: 72_000,
    },
  ];
  year.localInterest = 30_000;
  year.rentals = [
    {
      ...emptyRental(),
      name: "Garden flat",
      rentalIncome: 120_000,
      expenses: [{ id: "e1", label: "Levies", amount: 36_000 }],
    },
  ];
  year.freelance = [
    { id: "f1", description: "Design work", income: 40_000, expenses: 10_000 },
  ];
  year.disposals = [
    {
      id: "d1",
      description: "Shares",
      proceeds: 150_000,
      baseCost: 50_000,
      isPrimaryResidence: false,
    },
  ];
  return year;
}

describe("buildStatementDocument, full scenario", () => {
  const assessment = composeAssessment(fullScenarioYear(), y2025);
  const document = buildStatementDocument(assessment, y2025);

  it("carries the tax year label and disclaimer", () => {
    expect(document.meta.yearLabel).toBe(y2025.label);
    expect(document.meta.disclaimer).toMatch(/not an official sars document/i);
  });

  it("groups income into ordered categories that are present", () => {
    const titles = document.income.map((section) => section.title);
    expect(titles).toEqual([
      "Employment income [IRP5/IT3(a)]",
      "Local Interest Income",
      "Local Rental Income",
      "Other Income",
      "Capital Gains",
    ]);
  });

  it("puts the coded rental line under Local Rental Income with the right total", () => {
    const rental = document.income.find(
      (section) => section.title === "Local Rental Income",
    );
    expect(rental?.rows[0]?.code).toBe("4210");
    expect(rental?.total).toBe(84_000);
  });

  it("puts the exempt interest adjustment under Local Interest Income", () => {
    const interest = document.income.find(
      (section) => section.title === "Local Interest Income",
    );
    expect(interest?.rows.some((row) => row.code === "4201")).toBe(true);
    expect(
      interest?.rows.some((row) => /exempt/i.test(row.description)),
    ).toBe(true);
  });

  it("groups every deduction line into a single Deductions allowed section", () => {
    expect(document.deductions).toHaveLength(1);
    expect(document.deductions[0]?.title).toBe("Deductions allowed");
    const codes = document.deductions[0]?.rows.map((row) => row.code);
    expect(codes).toContain("4029");
    expect(codes).toContain("4011");
  });

  it("mirrors the assessment summary totals", () => {
    const taxable = document.summary.find(
      (row) => row.description === "Taxable income / Assessed Loss",
    );
    expect(taxable?.amount).toBe(assessment.taxableIncome);
    const result = document.summary.find(
      (row) => row.description === "Assessment Result",
    );
    expect(result?.amount).toBe(assessment.assessmentResult);
  });

  it("reports the taxable income and rating percentage", () => {
    expect(document.taxableIncome.amount).toBe(assessment.taxableIncome);
    expect(document.taxableIncome.ratingPercent).toBe(
      assessment.effectiveRatePercent,
    );
  });

  it("shows the amount payable framing when the result is owed", () => {
    expect(document.balanceOfAccount.description).toBe(
      "Amount payable by you to SARS",
    );
    expect(document.balanceOfAccount.amount).toBe(
      Math.abs(assessment.assessmentResult),
    );
  });

  it("includes narrative notes for the interest exemption and retirement cap", () => {
    expect(
      document.notes.some((note) => /interest exemption/i.test(note)),
    ).toBe(true);
    expect(
      document.notes.some((note) => /section 11f/i.test(note)),
    ).toBe(true);
  });
});

describe("buildStatementDocument, refund scenario", () => {
  it("shows the refund framing when the result is negative", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1985-01-15";
    year.payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme",
        basicSalary: 240_000,
        paye: 30_000,
      },
    ];
    const assessment = composeAssessment(year, y2025);
    const document = buildStatementDocument(assessment, y2025);
    expect(document.balanceOfAccount.description).toBe("Refund due to you");
    expect(document.balanceOfAccount.amount).toBe(3_803);
  });
});

describe("buildStatementDocument, empty year", () => {
  it("has no income or deduction sections when nothing was captured", () => {
    const assessment = composeAssessment(emptyYear("2025-26"), y2025);
    const document = buildStatementDocument(assessment, y2025);
    expect(document.income).toHaveLength(0);
    expect(document.deductions).toHaveLength(0);
  });
});
