import { describe, expect, it } from "vitest";
import {
  applySuggestionsToPayslip,
  mergeSuggestions,
} from "@/lib/extraction/apply";
import type { FieldSuggestion } from "@/lib/extraction/types";
import { emptyPayslip } from "@/lib/model/defaults";

function s(partial: Partial<FieldSuggestion>): FieldSuggestion {
  return {
    field: "basicSalary",
    value: 0,
    confidence: 0.9,
    evidence: "",
    source: "paste",
    ...partial,
  };
}

describe("applySuggestionsToPayslip", () => {
  it("applies scalar fields and named lists", () => {
    const payslip = applySuggestionsToPayslip(
      [
        s({ field: "employer", value: "Acme Pty Ltd" }),
        s({ field: "periodMonth", value: "2025-03" }),
        s({ field: "basicSalary", value: 30_000 }),
        s({ field: "paye", value: 6_000 }),
        s({ field: "allowance", value: 500, label: "Cellphone" }),
        s({ field: "nonTaxDeduction", value: 900, label: "Loan" }),
      ],
      emptyPayslip("2025-04"),
    );
    expect(payslip.employer).toBe("Acme Pty Ltd");
    expect(payslip.periodMonth).toBe("2025-03");
    expect(payslip.basicSalary).toBe(30_000);
    expect(payslip.paye).toBe(6_000);
    expect(payslip.allowances).toHaveLength(1);
    expect(payslip.allowances[0]).toMatchObject({
      label: "Cellphone",
      amount: 500,
    });
    expect(payslip.nonTaxDeductions[0]).toMatchObject({
      label: "Loan",
      amount: 900,
    });
  });

  it("leaves absent fields untouched, never assuming zero", () => {
    const base = { ...emptyPayslip("2025-03"), uif: 177.12 };
    const payslip = applySuggestionsToPayslip(
      [s({ field: "basicSalary", value: 30_000 })],
      base,
    );
    expect(payslip.uif).toBe(177.12);
  });

  it("rejects an invalid period month", () => {
    const payslip = applySuggestionsToPayslip(
      [s({ field: "periodMonth", value: "March 2025" })],
      emptyPayslip("2025-04"),
    );
    expect(payslip.periodMonth).toBe("2025-04");
  });
});

describe("mergeSuggestions", () => {
  it("prefers the higher-confidence source per scalar field", () => {
    const merged = mergeSuggestions(
      [s({ field: "paye", value: 5_000, confidence: 0.65 })],
      [s({ field: "paye", value: 6_000, confidence: 0.9, source: "llm" })],
    );
    const paye = merged.find((entry) => entry.field === "paye");
    expect(paye?.value).toBe(6_000);
    expect(paye?.source).toBe("llm");
  });

  it("keeps local-only fields and dedupes list items", () => {
    const merged = mergeSuggestions(
      [
        s({ field: "uif", value: 177, confidence: 0.9 }),
        s({ field: "allowance", value: 500, label: "Cellphone" }),
      ],
      [s({ field: "allowance", value: 500, label: "Cellphone", source: "llm" })],
    );
    expect(merged.filter((entry) => entry.field === "allowance")).toHaveLength(1);
    expect(merged.some((entry) => entry.field === "uif")).toBe(true);
  });
});
