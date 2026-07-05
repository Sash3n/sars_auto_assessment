/*
 * PDF text-layer extraction. pdfjs-dist is heavy, so it loads dynamically
 * only when a PDF is actually processed. Line reconstruction is a separate
 * pure function: bordered payslip layouts depend on grouping text items by
 * their y position, and that logic is unit-testable without pdfjs.
 */

export interface PositionedTextItem {
  str: string;
  /** x offset from the transform matrix. */
  x: number;
  /** y offset from the transform matrix. PDF y grows upward. */
  y: number;
}

/** Group positioned items into reading-order lines. */
export function layoutTextItems(
  items: readonly PositionedTextItem[],
  yTolerance = 2,
): string {
  if (items.length === 0) {
    return "";
  }
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedTextItem[][] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current[0].y - item.y) <= yTolerance) {
      current.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines
    .map((line) =>
      line
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join("\n");
}

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
}

/** Extract the text layer of every page, preserving line structure. */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const loadingTask = pdfjs.getDocument({ data });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = (content.items as PdfTextItemLike[])
        .filter(
          (item): item is Required<PdfTextItemLike> =>
            typeof item.str === "string" && Array.isArray(item.transform),
        )
        .map((item) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
        }));
      pages.push(layoutTextItems(items));
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join("\n").trim();
}

/**
 * A text layer this thin means the PDF is probably a scan and OCR should
 * run instead.
 */
export function looksLikeScannedPdf(text: string): boolean {
  return text.replace(/\s+/g, "").length < 40;
}
