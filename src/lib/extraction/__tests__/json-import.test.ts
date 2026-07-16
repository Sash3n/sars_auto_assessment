import { describe, expect, it } from "vitest";
import {
  crossCheckAgainstTaxCertificate,
  importPayslipsFromJson,
  type PayslipJsonImport,
} from "@/lib/extraction/json-import";

describe("importPayslipsFromJson", () => {
  it("classifies pay, in-lieu-of-benefits, and PAYE onto the right payslip fields", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "March 2025",
          earnings: [
            { salary_code: "0020*", description: "PAY", amount: 23_435.0 },
            {
              salary_code: "0214*",
              description: "IN LIEU OF BENEFITS",
              amount: 8_670.95,
            },
          ],
          deductions: [
            { salary_code: "6146", description: "BARGAINING COUNCIL", amount: 119.8 },
            { salary_code: "7910*", description: "PAYE RSA", amount: 5_392.17 },
          ],
        },
      ],
    };

    const result = importPayslipsFromJson(source);
    expect(result.warnings).toEqual([]);
    expect(result.payslips).toHaveLength(1);
    const slip = result.payslips[0];
    expect(slip.periodMonth).toBe("2025-03");
    expect(slip.basicSalary).toBe(23_435.0);
    expect(slip.otherFringeBenefits).toEqual([
      { id: expect.any(String), label: "IN LIEU OF BENEFITS", amount: 8_670.95 },
    ]);
    expect(slip.paye).toBe(5_392.17);
    expect(slip.nonTaxDeductions).toEqual([
      { id: expect.any(String), label: "BARGAINING COUNCIL", amount: 119.8 },
    ]);
  });

  it("treats a PAYE line on the earnings side as a correction that reduces PAYE, not new income", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "December 2025",
          earnings: [
            { salary_code: "0020*", description: "PAY", amount: 24_724.0 },
            { salary_code: "1130*", description: "PAYE RSA", amount: 58.11 },
          ],
          deductions: [
            { salary_code: "7910*", description: "PAYE RSA", amount: 6_009.33 },
          ],
        },
      ],
    };

    const result = importPayslipsFromJson(source);
    const slip = result.payslips[0];
    // The earnings-side PAYE line is a reversal, not extra taxable pay.
    expect(slip.basicSalary).toBe(24_724.0);
    expect(slip.paye).toBeCloseTo(6_009.33 - 58.11, 2);
    expect(
      result.warnings.some((w) => /opposite of where a paye line/i.test(w)),
    ).toBe(true);
  });

  it("sums multiple lines with the same target within one payslip", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "February 2026",
          earnings: [
            { salary_code: "0020*", type: "C", description: "PAY", amount: 33_102.75 },
            { salary_code: "0020*", type: "A", description: "PAY", amount: 7_162.11 },
          ],
          deductions: [],
        },
      ],
    };
    const result = importPayslipsFromJson(source);
    expect(result.payslips[0].basicSalary).toBeCloseTo(40_264.86, 2);
  });

  it("keeps unrecognised lines instead of dropping them, and warns", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "March 2025",
          earnings: [
            { salary_code: "9999", description: "MYSTERY PAYMENT", amount: 500 },
          ],
          deductions: [
            { salary_code: "8888", description: "MYSTERY STOPORDER", amount: 200 },
          ],
        },
      ],
    };
    const result = importPayslipsFromJson(source);
    const slip = result.payslips[0];
    expect(slip.otherFringeBenefits).toEqual([
      { id: expect.any(String), label: "MYSTERY PAYMENT", amount: 500 },
    ]);
    expect(slip.nonTaxDeductions).toEqual([
      { id: expect.any(String), label: "MYSTERY STOPORDER", amount: 200 },
    ]);
    expect(result.warnings.some((w) => /unrecognised earnings line/i.test(w))).toBe(
      true,
    );
    expect(
      result.warnings.some((w) => /unrecognised deductions line/i.test(w)),
    ).toBe(true);
  });

  it("flags a note that the source data marked as a duplicate", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "June 2025",
          note: "Identical figures to image 3 (May 2025), appears to be a duplicate.",
          earnings: [{ description: "PAY", amount: 24_724.0 }],
          deductions: [],
        },
      ],
    };
    const result = importPayslipsFromJson(source);
    expect(
      result.warnings.some((w) => /flagged this payslip as identical/i.test(w)),
    ).toBe(true);
    // The month is still imported, not silently dropped.
    expect(result.payslips).toHaveLength(1);
  });

  it("skips a payslip whose period cannot be determined, with a warning", () => {
    const source: PayslipJsonImport = {
      payslips: [
        { earnings: [{ description: "PAY", amount: 1000 }], deductions: [] },
      ],
    };
    const result = importPayslipsFromJson(source);
    expect(result.payslips).toHaveLength(0);
    expect(
      result.warnings.some((w) => /could not determine the tax year month/i.test(w)),
    ).toBe(true);
  });
});

describe("crossCheckAgainstTaxCertificate", () => {
  it("passes silently when there is no certificate", () => {
    expect(crossCheckAgainstTaxCertificate([], undefined)).toEqual({
      matches: true,
      warnings: [],
    });
  });

  it("warns when combined PAYE does not match the certificate's code 4102", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "March 2025",
          earnings: [{ description: "PAY", amount: 30_000 }],
          deductions: [{ description: "PAYE RSA", amount: 5_000 }],
        },
      ],
      tax_certificate: {
        tax_credits_and_or_employer_employee_contribution: [
          { description: "PAYE", amount: 79_668.7, code: "4102" },
        ],
      },
    };
    const { payslips } = importPayslipsFromJson(source);
    const result = crossCheckAgainstTaxCertificate(
      payslips,
      source.tax_certificate,
    );
    expect(result.matches).toBe(false);
    expect(result.warnings.some((w) => /code 4102/.test(w))).toBe(true);
  });

  it("matches when the certificate's gross income lines up with the payslip total", () => {
    const source: PayslipJsonImport = {
      payslips: [
        {
          assumed_period: "March 2025",
          earnings: [{ description: "PAY", amount: 30_000 }],
          deductions: [],
        },
      ],
      tax_certificate: {
        income_received_continued: [
          { description: "Gross", amount: 30_000, source_code: "3699" },
        ],
      },
    };
    const { payslips } = importPayslipsFromJson(source);
    const result = crossCheckAgainstTaxCertificate(
      payslips,
      source.tax_certificate,
    );
    expect(result.matches).toBe(true);
  });
});
