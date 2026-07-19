import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  coerceAmount,
  parseIta34Json,
  parseIta34Workbook,
  rowsToIta34,
} from "@/lib/extraction/ita34-import";

describe("coerceAmount", () => {
  it("passes through finite numbers", () => {
    expect(coerceAmount(320000)).toBe(320000);
    expect(coerceAmount(-1.5)).toBe(-1.5);
    expect(coerceAmount(Number.NaN)).toBeNull();
  });

  it("parses formatted strings, spaces, decimal comma, and trailing minus", () => {
    expect(coerceAmount("320 000.00")).toBe(320000);
    expect(coerceAmount("R 79 668,70")).toBeCloseTo(79668.7, 2);
    expect(coerceAmount("1 234-")).toBe(-1234);
    expect(coerceAmount("")).toBeNull();
    expect(coerceAmount("n/a")).toBeNull();
  });
});

describe("parseIta34Json", () => {
  it("reads the structured codes/summary shape", () => {
    const parsed = parseIta34Json(
      JSON.stringify({
        codes: { "3601": 320000, "4102": 79668.7 },
        summary: { taxableIncome: 433538, assessmentResult: 0.13 },
      }),
    );
    expect(parsed.codes["3601"]).toBe(320000);
    expect(parsed.codes["4102"]).toBeCloseTo(79668.7, 2);
    expect(parsed.summary.taxableIncome).toBe(433538);
    expect(parsed.summary.assessmentResult).toBe(0.13);
    expect(parsed.warnings).toHaveLength(0);
  });

  it("reads a flat map of codes and summary labels", () => {
    const parsed = parseIta34Json(
      JSON.stringify({ "3601": 320000, "Taxable income": 433538 }),
    );
    expect(parsed.codes["3601"]).toBe(320000);
    expect(parsed.summary.taxableIncome).toBe(433538);
  });

  it("reads an array of row objects", () => {
    const parsed = parseIta34Json(
      JSON.stringify([
        { code: "3601", description: "Income", amount: 320000 },
        { label: "Assessed tax after rebates", amount: 79668 },
      ]),
    );
    expect(parsed.codes["3601"]).toBe(320000);
    expect(parsed.summary.assessedTaxAfterRebates).toBe(79668);
  });

  it("ignores non-code numeric keys and never invents zeros", () => {
    const parsed = parseIta34Json(JSON.stringify({ "99": 5, notacode: 5 }));
    expect(parsed.codes).toEqual({});
    expect(parsed.summary).toEqual({});
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });

  it("warns on invalid JSON", () => {
    const parsed = parseIta34Json("{ not json");
    expect(parsed.warnings[0]).toMatch(/not valid json/i);
  });
});

describe("rowsToIta34", () => {
  it("maps code rows and summary rows from tabular cells", () => {
    const parsed = rowsToIta34([
      ["Code", "Description", "Amount"],
      ["3601", "Income, taxable", 320000],
      ["Taxable income", 433538],
      ["", "", ""],
    ]);
    expect(parsed.codes["3601"]).toBe(320000);
    expect(parsed.summary.taxableIncome).toBe(433538);
  });
});

describe("parseIta34Workbook", () => {
  it("reads the first sheet of an xlsx workbook", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Code", "Description", "Amount"],
      ["3601", "Income, taxable", 320000],
      ["4102", "PAYE", 79668.7],
      ["Assessment result", "", 0.13],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "ITA34");
    const buffer: ArrayBuffer = XLSX.write(book, {
      type: "array",
      bookType: "xlsx",
    });

    const parsed = await parseIta34Workbook(buffer);
    expect(parsed.codes["3601"]).toBe(320000);
    expect(parsed.codes["4102"]).toBeCloseTo(79668.7, 2);
    expect(parsed.summary.assessmentResult).toBe(0.13);
  });
});
