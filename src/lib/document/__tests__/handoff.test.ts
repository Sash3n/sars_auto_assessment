import { afterEach, describe, expect, it } from "vitest";
import {
  readComparisonHandoff,
  writeComparisonHandoff,
} from "@/lib/document/handoff";
import type { ComparisonRow } from "@/lib/tax-engine/compare";

afterEach(() => {
  window.sessionStorage.clear();
});

const sampleRows: ComparisonRow[] = [
  {
    code: "3601",
    description: "Income, taxable",
    mineAmount: 360_000,
    sarsAmount: 360_000,
    delta: 0,
    status: "match",
  },
];

describe("comparison handoff", () => {
  it("round-trips the payload written for the statement page", () => {
    writeComparisonHandoff({ yearLabel: "2025/26", rows: sampleRows });
    const read = readComparisonHandoff();
    expect(read).toEqual({ yearLabel: "2025/26", rows: sampleRows });
  });

  it("returns null and does not throw when nothing was written", () => {
    expect(readComparisonHandoff()).toBeNull();
  });

  it("clears the entry after reading it once", () => {
    writeComparisonHandoff({ yearLabel: "2025/26", rows: sampleRows });
    readComparisonHandoff();
    expect(readComparisonHandoff()).toBeNull();
  });

  it("returns null for a malformed stored payload instead of throwing", () => {
    window.sessionStorage.setItem("sars-statement-handoff-v1", "not json");
    expect(readComparisonHandoff()).toBeNull();
  });
});
