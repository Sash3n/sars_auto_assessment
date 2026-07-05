import { describe, expect, it } from "vitest";
import { parseIta34Text } from "@/lib/extraction/ita34";

const ITA34_FIXTURE = `Notice of Assessment ITA34
Income Tax Year of assessment: 2026

Income
3601 Income, taxable 360 000
3605 Annual payment, taxable 25 000
3805 Medical scheme fringe benefit 18 000
4201 Local interest (excluding SARS interest) 30 000
Less: exempt local interest 23 800-

Deductions allowed
4029 Retirement fund contributions 61 600-

Assessment Summary
Taxable income 497 600
Assessed tax after rebates 87 840.00
Tax credits and adjustments 72 000.00-
Assessment result 15 840.00
Net amount payable by you 15 840.00`;

describe("parseIta34Text", () => {
  const parsed = parseIta34Text(ITA34_FIXTURE);

  it("reads coded lines with their amounts", () => {
    expect(parsed.codes["3601"]).toBe(360_000);
    expect(parsed.codes["3605"]).toBe(25_000);
    expect(parsed.codes["3805"]).toBe(18_000);
    expect(parsed.codes["4201"]).toBe(30_000);
  });

  it("treats a trailing minus as a negative amount", () => {
    expect(parsed.codes["4029"]).toBe(-61_600);
  });

  it("reads the summary rows", () => {
    expect(parsed.summary.taxableIncome).toBe(497_600);
    expect(parsed.summary.assessedTaxAfterRebates).toBe(87_840);
    expect(parsed.summary.taxCredits).toBe(-72_000);
    expect(parsed.summary.assessmentResult).toBe(15_840);
  });

  it("leaves unread figures absent rather than zero", () => {
    const partial = parseIta34Text("3601 Income, taxable 360 000");
    expect(partial.codes["3601"]).toBe(360_000);
    expect(partial.summary.taxableIncome).toBeUndefined();
    expect("4029" in partial.codes).toBe(false);
  });

  it("warns when nothing could be read", () => {
    const empty = parseIta34Text("nothing useful here");
    expect(Object.keys(empty.codes)).toHaveLength(0);
    expect(empty.warnings.length).toBeGreaterThan(0);
  });
});
