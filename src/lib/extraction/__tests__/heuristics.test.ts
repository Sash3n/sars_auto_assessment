import { describe, expect, it } from "vitest";
import {
  extractPayslipSuggestions,
  parseAmountToken,
} from "@/lib/extraction/heuristics";

const SAME_LINE_PAYSLIP = `Acme Widgets Pty Ltd
Payslip for March 2025
Basic salary            30 000.00
Cellphone allowance         500.00
Pension fund              1 800.00
Employer pension          2 500.00
Employer medical aid      1 500.00
PAYE                      6 000.00
UIF                         177.12
Loan repayment              900.00`;

/*
 * Bordered layout: labels and amounts arrive on separate lines, the failure
 * mode that broke the previous prototype's parser.
 */
const BORDERED_PAYSLIP = `Employer: Beta Industries Ltd
Period: 2025-04
Basic salary
28 500.00
PAYE
5 400.00
UIF
171.00`;

const TERMINATION_PAYSLIP = `Acme Widgets Pty Ltd
Final payslip May 2025
Basic salary   12 000.00
Leave pay       8 400.00`;

describe("parseAmountToken", () => {
  it("parses grouped and plain amounts", () => {
    expect(parseAmountToken("30 000.00")).toBe(30_000);
    expect(parseAmountToken("R 12,450.50")).toBe(12_450.5);
    expect(parseAmountToken("177.12")).toBe(177.12);
  });
});

describe("extractPayslipSuggestions, same-line layout", () => {
  const outcome = extractPayslipSuggestions(SAME_LINE_PAYSLIP);
  const byField = new Map(outcome.suggestions.map((s) => [s.field, s]));

  it("finds the core amounts at high confidence", () => {
    expect(byField.get("basicSalary")?.value).toBe(30_000);
    expect(byField.get("basicSalary")?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(byField.get("paye")?.value).toBe(6_000);
    expect(byField.get("uif")?.value).toBe(177.12);
  });

  it("separates employee and employer retirement", () => {
    expect(byField.get("employeeRetirement")?.value).toBe(1_800);
    expect(byField.get("employerRetirement")?.value).toBe(2_500);
  });

  it("finds the employer medical fringe benefit", () => {
    expect(byField.get("employerMedicalAid")?.value).toBe(1_500);
  });

  it("captures a named allowance", () => {
    const allowance = outcome.suggestions.find((s) => s.field === "allowance");
    expect(allowance?.value).toBe(500);
    expect(allowance?.label?.toLowerCase()).toContain("cellphone");
  });

  it("detects the period month from a month name", () => {
    expect(byField.get("periodMonth")?.value).toBe("2025-03");
  });

  it("detects the employer from the company suffix", () => {
    expect(String(byField.get("employer")?.value)).toContain("Acme");
  });
});

describe("extractPayslipSuggestions, bordered split-line layout", () => {
  const outcome = extractPayslipSuggestions(BORDERED_PAYSLIP);
  const byField = new Map(outcome.suggestions.map((s) => [s.field, s]));

  it("matches amounts that arrive on the following line", () => {
    expect(byField.get("basicSalary")?.value).toBe(28_500);
    expect(byField.get("paye")?.value).toBe(5_400);
    expect(byField.get("uif")?.value).toBe(171);
  });

  it("flags lookahead matches with lower confidence", () => {
    expect(byField.get("basicSalary")?.confidence).toBeLessThan(0.8);
  });

  it("reads an explicit employer line and ISO period", () => {
    expect(String(byField.get("employer")?.value)).toContain("Beta Industries");
    expect(byField.get("periodMonth")?.value).toBe("2025-04");
  });
});

describe("extractPayslipSuggestions, termination payslip", () => {
  const outcome = extractPayslipSuggestions(TERMINATION_PAYSLIP);

  it("finds leave pay", () => {
    const leave = outcome.suggestions.find((s) => s.field === "leavePay");
    expect(leave?.value).toBe(8_400);
  });

  it("warns that PAYE is absent rather than assuming zero", () => {
    expect(outcome.suggestions.some((s) => s.field === "paye")).toBe(false);
    expect(
      outcome.warnings.some((warning) => /no paye line/i.test(warning)),
    ).toBe(true);
  });
});

describe("extractPayslipSuggestions, edge cases", () => {
  it("warns when nothing is recognised", () => {
    const outcome = extractPayslipSuggestions("completely unrelated text");
    expect(outcome.suggestions).toHaveLength(0);
    expect(outcome.warnings.length).toBeGreaterThan(0);
  });

  it("reduces confidence for OCR-sourced text", () => {
    const sameLine = extractPayslipSuggestions(SAME_LINE_PAYSLIP, "pdf-text");
    const ocr = extractPayslipSuggestions(SAME_LINE_PAYSLIP, "ocr");
    const pdfBasic = sameLine.suggestions.find((s) => s.field === "basicSalary");
    const ocrBasic = ocr.suggestions.find((s) => s.field === "basicSalary");
    expect(ocrBasic!.confidence).toBeLessThan(pdfBasic!.confidence);
  });
});
