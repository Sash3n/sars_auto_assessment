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
  year.profile.privateRetirementContributions = 10_000;
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
      employerMedicalAid: 18_000,
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
  const year = fullScenarioYear();
  const assessment = composeAssessment(year, y2025);
  const document = buildStatementDocument(assessment, y2025, year);

  it("carries the tax year label and disclaimer", () => {
    expect(document.meta.yearLabel).toBe(y2025.label);
    expect(document.meta.disclaimer).toMatch(/not an official sars document/i);
  });

  it("fills the details block without fabricated identifiers", () => {
    expect(document.details.yearOfAssessment).toBe(y2025.label);
    expect(document.details.typeOfDocument).toBe("Independent estimate");
    expect(document.details.dateGenerated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

  it("shows employment lines with the same figure in both amount columns", () => {
    const employment = document.income.find(
      (section) => section.title === "Employment income [IRP5/IT3(a)]",
    );
    const line3601 = employment?.rows.find((row) => row.code === "3601");
    expect(line3601?.computation).toBe(360_000);
    expect(line3601?.amount).toBe(360_000);
  });

  it("keeps every payroll code inside the employment section, 37xx included", () => {
    const year = fullScenarioYear();
    year.payslips[0].allowances = [
      { id: "a1", label: "Phone", amount: 67_770 },
    ];
    const assessment = composeAssessment(year, y2025);
    const document = buildStatementDocument(assessment, y2025, year);
    const employment = document.income.find(
      (section) => section.title === "Employment income [IRP5/IT3(a)]",
    );
    const line3713 = employment?.rows.find((row) => row.code === "3713");
    expect(line3713?.amount).toBe(67_770);
    // Every coded income line must land in some section: the sum of the
    // section totals equals the assessment's income total.
    const sectionSum = document.income.reduce(
      (sum, section) => sum + section.total,
      0,
    );
    expect(sectionSum).toBeCloseTo(assessment.incomeTotal, 2);
  });

  it("shows local interest as computations-only with the taxable net on the section", () => {
    const interest = document.income.find(
      (section) => section.title === "Local Interest Income",
    );
    const line4201 = interest?.rows.find((row) => row.code === "4201");
    expect(line4201?.computation).toBe(30_000);
    expect(line4201?.amount).toBeUndefined();
    const exemption = interest?.rows.find(
      (row) => row.description === "Investment exemption",
    );
    expect(exemption?.computation).toBe(-23_800);
    expect(exemption?.indent).toBe(true);
    // 30 000 less the 23 800 under-65 exemption.
    expect(interest?.total).toBe(6_200);
  });

  it("gives the rental line its own section with the 4210 code", () => {
    const rental = document.income.find(
      (section) => section.title === "Local Rental Income",
    );
    expect(rental?.rows[0]?.code).toBe("4210");
    expect(rental?.total).toBe(84_000);
  });

  it("builds the retirement section with build-up rows and narrative captions", () => {
    const retirement = document.deductions.find(
      (section) => section.title === "Retirement fund contributions",
    );
    const line4029 = retirement?.rows.find((row) => row.code === "4029");
    // 21 600 employee + 30 000 employer + 10 000 private = 61 600.
    expect(line4029?.computation).toBe(61_600);
    expect(line4029?.amount).toBe(-61_600);

    const broughtForward = retirement?.rows.find(
      (row) => row.description === "Amount b/f from previous year",
    );
    expect(broughtForward?.computation).toBe(0);
    expect(broughtForward?.indent).toBe(true);

    const payrollSide = retirement?.rows.find(
      (row) => row.description === "Pension and provident fund contributions",
    );
    expect(payrollSide?.computation).toBe(51_600);

    const privateSide = retirement?.rows.find(
      (row) => row.description === "Retirement annuity fund contributions",
    );
    expect(privateSide?.computation).toBe(10_000);

    const narratives = retirement?.rows.filter((row) => row.narrative) ?? [];
    expect(narratives).toHaveLength(2);
    expect(narratives[0]?.description).toContain("R 350 000.00");
    expect(narratives[0]?.description).toContain("27,5%");
    // Remuneration includes the employer fringe benefits:
    // 360 000 + 30 000 employer retirement + 18 000 employer medical.
    expect(narratives[0]?.description).toContain("R 408 000.00");
  });

  it("gives each remaining deduction line its own titled section", () => {
    const titles = document.deductions.map((section) => section.title);
    expect(titles).toContain("Section 18A donations");
    const donations = document.deductions.find(
      (section) => section.title === "Section 18A donations",
    );
    expect(donations?.rows[0]?.code).toBe("4011");
    expect(donations?.rows[0]?.computation).toBe(5_000);
    expect(donations?.rows[0]?.amount).toBe(-5_000);
  });

  it("nests rebates and medical credits under one Rebates umbrella", () => {
    const rebates = document.taxCalculation.find(
      (row) => row.description === "Rebates",
    );
    expect(rebates?.emphasis).toBe(true);
    expect(rebates?.amount).toBe(
      -(
        assessment.rebates +
        assessment.medicalSchemeCredit +
        assessment.additionalMedicalCredit
      ),
    );
    const primary = document.taxCalculation.find(
      (row) => row.description === "Primary",
    );
    expect(primary?.computation).toBe(17_235);
    expect(primary?.indent).toBe(true);
    const medical = document.taxCalculation.find(
      (row) => row.description === "Medical Scheme Fees Tax Credit",
    );
    expect(medical?.computation).toBe(assessment.medicalSchemeCredit);
    // No separate top-level medical row outside the umbrella.
    expect(
      document.taxCalculation.filter((row) =>
        /medical scheme fees/i.test(row.description),
      ),
    ).toHaveLength(1);
  });

  it("shows employees' tax as a parent row with a 4102 detail line", () => {
    const parent = document.taxCalculation.find(
      (row) => row.description === "Employees' tax",
    );
    expect(parent?.amount).toBe(-72_000);
    const detail = document.taxCalculation.find((row) => row.code === "4102");
    expect(detail?.computation).toBe(72_000);
    expect(detail?.indent).toBe(true);
  });

  it("inserts the Calculated Tax Liability label into the summary", () => {
    const labels = document.summary.map((row) => row.description);
    const liabilityIndex = labels.indexOf("Calculated Tax Liability:");
    expect(liabilityIndex).toBeGreaterThan(
      labels.indexOf("Taxable income / Assessed Loss"),
    );
    expect(liabilityIndex).toBeLessThan(
      labels.indexOf("Assessed tax after rebates"),
    );
    const liability = document.summary[liabilityIndex];
    expect(liability?.amount).toBeUndefined();
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
    expect(document.incomeTotal).toBe(assessment.incomeTotal);
    expect(document.deductionsTotal).toBe(-assessment.deductionsTotal);
  });

  it("builds the numbered medical note with the contributions detail", () => {
    const medical = document.notes.find((note) =>
      /medical rebates/i.test(note.heading),
    );
    expect(medical?.heading).toBe(
      "Medical Rebates for persons below 65 without a disability",
    );
    expect(medical?.amount).toBe(
      assessment.medicalSchemeCredit + assessment.additionalMedicalCredit,
    );
    // 18 000 employer + 6 000 private contributions.
    expect(
      medical?.rows?.find(
        (row) => row.label === "Contributions made to medical aid",
      )?.value,
    ).toBe("R 24 000.00");
  });

  it("builds the capital gains note from the year's CGT parameters", () => {
    const cgt = document.notes.find((note) => note.heading === "Capital gains");
    expect(cgt?.amount).toBe(assessment.cgt.taxable);
    expect(
      cgt?.rows?.find((row) => row.label === "Annual exclusion")?.value,
    ).toBe("R 40 000.00");
    expect(
      cgt?.rows?.find((row) => row.label === "Inclusion rate")?.value,
    ).toBe("40%");
  });

  it("surfaces assessment warnings verbatim in the final note", () => {
    const info = document.notes.find(
      (note) => note.heading === "Information that impacts this estimate",
    );
    // The rental scenario has no warnings here, so the note only exists
    // when the assessment produced warnings.
    if (assessment.warnings.length === 0) {
      expect(info).toBeUndefined();
    } else {
      expect(info?.paragraphs).toEqual(assessment.warnings);
    }
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
    const document = buildStatementDocument(assessment, y2025, year);
    expect(document.balanceOfAccount.description).toBe("Refund due to you");
    expect(document.balanceOfAccount.amount).toBe(3_803);
    const net = document.taxCalculation.at(-1);
    expect(net?.description).toBe("Net amount refundable under this assessment");
    expect(net?.amount).toBe(-3_803);
  });
});

describe("buildStatementDocument, empty year", () => {
  it("has no income, deduction, or note content when nothing was captured", () => {
    const year = emptyYear("2025-26");
    const assessment = composeAssessment(year, y2025);
    const document = buildStatementDocument(assessment, y2025, year);
    expect(document.income).toHaveLength(0);
    expect(document.deductions).toHaveLength(0);
    expect(
      document.notes.filter((note) => !/impacts this estimate/i.test(note.heading)),
    ).toHaveLength(0);
  });
});

describe("buildStatementDocument, older taxpayer rebates", () => {
  it("lists secondary and tertiary rebate rows for a 76 year old", () => {
    const year = emptyYear("2025-26");
    year.profile.dateOfBirth = "1949-06-15";
    year.payslips = [
      {
        ...emptyPayslip("2025-03"),
        employer: "Acme",
        basicSalary: 300_000,
        paye: 20_000,
      },
    ];
    const assessment = composeAssessment(year, y2025);
    const document = buildStatementDocument(assessment, y2025, year);
    const descriptions = document.taxCalculation.map((row) => row.description);
    expect(descriptions).toContain("Primary");
    expect(descriptions).toContain("Secondary (65 and older)");
    expect(descriptions).toContain("Tertiary (75 and older)");
  });
});
