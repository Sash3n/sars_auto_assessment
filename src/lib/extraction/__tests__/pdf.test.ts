import { describe, expect, it } from "vitest";
import { layoutTextItems, looksLikeScannedPdf } from "@/lib/extraction/pdf";

describe("layoutTextItems", () => {
  it("groups items on the same y into one line, ordered by x", () => {
    const text = layoutTextItems([
      { str: "30 000.00", x: 200, y: 700 },
      { str: "Basic salary", x: 10, y: 700 },
      { str: "PAYE", x: 10, y: 680 },
      { str: "6 000.00", x: 200, y: 680 },
    ]);
    expect(text).toBe("Basic salary 30 000.00\nPAYE 6 000.00");
  });

  it("tolerates small y jitter within a line", () => {
    const text = layoutTextItems([
      { str: "Basic", x: 10, y: 700.9 },
      { str: "salary", x: 60, y: 700 },
    ]);
    expect(text).toBe("Basic salary");
  });

  it("orders lines top to bottom (PDF y grows upward)", () => {
    const text = layoutTextItems([
      { str: "bottom", x: 0, y: 100 },
      { str: "top", x: 0, y: 500 },
    ]);
    expect(text).toBe("top\nbottom");
  });

  it("handles empty input", () => {
    expect(layoutTextItems([])).toBe("");
  });
});

describe("looksLikeScannedPdf", () => {
  it("treats near-empty text layers as scans", () => {
    expect(looksLikeScannedPdf("  \n \n ")).toBe(true);
    expect(looksLikeScannedPdf("Page 1")).toBe(true);
  });

  it("accepts a real text layer", () => {
    expect(
      looksLikeScannedPdf(
        "Basic salary 30 000.00\nPAYE 6 000.00\nUIF 177.12\nEmployer Acme Pty Ltd",
      ),
    ).toBe(false);
  });
});
