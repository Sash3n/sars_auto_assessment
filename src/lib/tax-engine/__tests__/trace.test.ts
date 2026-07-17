import { describe, expect, it } from "vitest";
import { composeAssessment } from "@/lib/tax-engine/assessment";
import { buildAssessmentTrace } from "@/lib/tax-engine/trace";
import { getTaxYear } from "@/lib/tax-engine/tax-tables";
import { emptyDependent, emptyPayslip, emptyYear } from "@/lib/model/defaults";
import type { TaxYearData } from "@/lib/model/types";

const y2025 = getTaxYear("2025-26");

/*
 * Plain scenario: single employer, under 65, no medical scheme, no
 * retirement. Taxable income sits in the third bracket.
 */
function plainYear(): TaxYearData {
  const year = emptyYear("2025-26");
  year.profile.dateOfBirth = "1990-06-15";
  year.payslips = [
    { ...emptyPayslip("2025-03"), employer: "Acme", basicSalary: 40_000, paye: 6_000 },
  ];
  return year;
}

describe("buildAssessmentTrace, plain scenario", () => {
  const year = plainYear();
  const trace = buildAssessmentTrace(year, y2025);

  it("traces normal tax before rebates against the bracket that applied", () => {
    const step = trace.find((s) => s.section === "brackets.taxBeforeRebates");
    expect(step).toBeDefined();
    // taxableIncome 40 000 falls in the first bracket, above 0, rate 0.18
    expect(step?.tableValuesUsed.rate).toBe(0.18);
    expect(step?.tableValuesUsed.above).toBe(0);
    expect(step?.result).toBe(7_200);
  });

  it("traces the primary rebate only, since the taxpayer is under 65", () => {
    const step = trace.find((s) => s.section === "rebates.totalRebates");
    expect(step).toBeDefined();
    expect(step?.tableValuesUsed.primary).toBe(17_235);
    expect(step?.tableValuesUsed.secondary).toBeUndefined();
    expect(step?.result).toBe(17_235);
  });

  it("cross-checks against composeAssessment for the same scenario", () => {
    const assessment = composeAssessment(year, y2025);
    const taxStep = trace.find((s) => s.section === "brackets.taxBeforeRebates");
    expect(taxStep?.result).toBe(assessment.taxBeforeRebates);
    const rebateStep = trace.find((s) => s.section === "rebates.totalRebates");
    expect(rebateStep?.result).toBe(assessment.rebates);
  });
});

describe("buildAssessmentTrace, age 65+ rebate scenario", () => {
  function overYear(): TaxYearData {
    const year = plainYear();
    year.profile.dateOfBirth = "1955-06-15";
    return year;
  }
  const trace = buildAssessmentTrace(overYear(), y2025);

  it("adds the secondary rebate for a taxpayer 65 or older", () => {
    const step = trace.find((s) => s.section === "rebates.totalRebates");
    expect(step?.tableValuesUsed.primary).toBe(17_235);
    expect(step?.tableValuesUsed.secondary).toBe(9_444);
    expect(step?.result).toBe(17_235 + 9_444);
  });
});

describe("buildAssessmentTrace, medical scheme credit scenario", () => {
  function medicalYear(): TaxYearData {
    const year = plainYear();
    year.profile.medicalSchemeMonths = 12;
    year.dependents = [
      { ...emptyDependent(), relationship: "spouse", medicalSchemeMonths: 12 },
    ];
    return year;
  }
  const trace = buildAssessmentTrace(medicalYear(), y2025);

  it("traces the annual section 6A credit using the published monthly rates", () => {
    const step = trace.find((s) => s.section === "medical.annualMedicalSchemeCredit");
    expect(step).toBeDefined();
    expect(step?.tableValuesUsed.mainMemberMonthly).toBe(364);
    expect(step?.tableValuesUsed.firstDependantMonthly).toBe(364);
    // main member + one dependant, twelve months
    expect(step?.result).toBe((364 + 364) * 12);
  });
});

describe("buildAssessmentTrace, retirement deduction binding cap", () => {
  it("names the annual cap as the binding limit when contributions exceed it", () => {
    const year = plainYear();
    year.payslips[0].basicSalary = 1_400_000;
    year.payslips[0].employeeRetirement = 400_000;
    const trace = buildAssessmentTrace(year, y2025);
    const step = trace.find((s) => s.section === "retirement.retirementDeduction");
    expect(step).toBeDefined();
    expect(step?.formula).toMatch(/annual cap/i);
    expect(step?.result).toBe(y2025.retirement.annualCap);
  });

  it("names contributions as the binding limit when they are the smallest amount", () => {
    const year = plainYear();
    year.payslips[0].employeeRetirement = 1_000;
    const trace = buildAssessmentTrace(year, y2025);
    const step = trace.find((s) => s.section === "retirement.retirementDeduction");
    expect(step?.formula).toMatch(/contributions/i);
    expect(step?.result).toBe(1_000);
  });

  it("cross-checks the allowed amount against composeAssessment", () => {
    const year = plainYear();
    year.payslips[0].employeeRetirement = 1_000;
    const trace = buildAssessmentTrace(year, y2025);
    const assessment = composeAssessment(year, y2025);
    const step = trace.find((s) => s.section === "retirement.retirementDeduction");
    expect(step?.result).toBe(assessment.retirement.allowed);
  });
});
