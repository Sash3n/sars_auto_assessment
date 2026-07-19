import {
  resolveSummaryKey,
  type ParsedIta34,
} from "./ita34";

/*
 * Structured importers for the SARS comparison: JSON and Excel/CSV, in
 * addition to the pasted-text parser in ita34.ts. All three produce the same
 * ParsedIta34 shape (codes by SARS code, plus the four summary figures), and
 * all follow the same rule as the text parser: a figure that cannot be read
 * stays absent, it is never assumed to be zero.
 *
 * Accepted JSON shapes (any of):
 *   { "codes": { "3601": 320000 }, "summary": { "taxableIncome": 433538 } }
 *   { "3601": 320000, "taxableIncome": 433538 }         // flat
 *   [ { "code": "3601", "amount": 320000 }, ... ]        // array of rows
 *   [ ["3601", "Income", 320000], ... ]                  // array of tuples
 */

const CODE_PATTERN = /^\d{4}$/;

function emptyParsed(): ParsedIta34 {
  return { codes: {}, summary: {}, warnings: [] };
}

function isEmpty(parsed: ParsedIta34): boolean {
  return (
    Object.keys(parsed.codes).length === 0 &&
    Object.keys(parsed.summary).length === 0
  );
}

/** Coerce a cell (number or a formatted string like "320 000,00-") to rand. */
export function coerceAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const negative = /^-/.test(trimmed) || /-\s*$/.test(trimmed);
  // Keep digits and separators, then normalise the decimal comma to a point.
  const cleaned = trimmed
    .replace(/[^\d.,]/g, "")
    .replace(/ /g, "")
    .replace(/,(\d{1,2})$/, ".$1")
    .replace(/,/g, "");
  if (cleaned === "" || cleaned === ".") {
    return null;
  }
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return negative ? -Math.abs(parsed) : parsed;
}

function addCode(parsed: ParsedIta34, code: string, amount: number): void {
  if (CODE_PATTERN.test(code)) {
    parsed.codes[code] = amount;
  }
}

function addSummary(parsed: ParsedIta34, label: string, amount: number): void {
  const key = resolveSummaryKey(label);
  if (key && parsed.summary[key] === undefined) {
    parsed.summary[key] = amount;
  }
}

/*
 * Map generic tabular rows (spreadsheet cells, JSON tuples) into a
 * ParsedIta34. A row contributes a code line if any cell is a 4-digit code,
 * otherwise a summary line if its text matches a known summary label. The
 * amount is the last numeric cell that is not the code itself.
 */
export function rowsToIta34(rows: unknown[][]): ParsedIta34 {
  const parsed = emptyParsed();

  for (const row of rows) {
    if (!Array.isArray(row) || row.length === 0) {
      continue;
    }

    let code: string | undefined;
    let label = "";
    for (const cell of row) {
      const text = String(cell ?? "").trim();
      if (text === "") {
        continue;
      }
      if (!code && CODE_PATTERN.test(text)) {
        code = text;
      } else if (!/^[-\d ,.]+$/.test(text)) {
        label += ` ${text}`;
      }
    }

    let amount: number | null = null;
    for (let i = row.length - 1; i >= 0; i -= 1) {
      if (String(row[i] ?? "").trim() === code) {
        continue;
      }
      const value = coerceAmount(row[i]);
      if (value !== null) {
        amount = value;
        break;
      }
    }
    if (amount === null) {
      continue;
    }

    if (code) {
      addCode(parsed, code, amount);
    } else {
      addSummary(parsed, label, amount);
    }
  }

  if (isEmpty(parsed)) {
    parsed.warnings.push(
      "No SARS codes or summary figures could be read from the file. Values can be filled in manually to complete the comparison.",
    );
  }
  return parsed;
}

function importObject(
  parsed: ParsedIta34,
  record: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(record)) {
    const amount = coerceAmount(value);
    if (amount === null) {
      continue;
    }
    if (CODE_PATTERN.test(key)) {
      addCode(parsed, key, amount);
    } else {
      addSummary(parsed, key, amount);
    }
  }
}

export function parseIta34Json(text: string): ParsedIta34 {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      codes: {},
      summary: {},
      warnings: ["The file is not valid JSON."],
    };
  }

  const parsed = emptyParsed();

  if (Array.isArray(data)) {
    const rows = data.map((item): unknown[] => {
      if (Array.isArray(item)) {
        return item;
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return [
          record.code ?? record.source_code ?? record.label ?? record.description,
          record.amount ?? record.value,
        ];
      }
      return [];
    });
    return rowsToIta34(rows);
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (record.codes && typeof record.codes === "object") {
      importObject(parsed, record.codes as Record<string, unknown>);
    }
    if (record.summary && typeof record.summary === "object") {
      importObject(parsed, record.summary as Record<string, unknown>);
    }
    // No nested codes/summary: treat the object itself as a flat map.
    if (isEmpty(parsed)) {
      importObject(parsed, record);
    }
  }

  if (isEmpty(parsed)) {
    parsed.warnings.push(
      "No SARS codes or summary figures could be read from the file. Values can be filled in manually to complete the comparison.",
    );
  }
  return parsed;
}

/*
 * Read the first sheet of an .xlsx/.xls/.csv workbook into a ParsedIta34.
 * SheetJS is imported dynamically so it never enters the main bundle; only
 * the Compare route pulls it in, and only when a file is actually chosen.
 */
export async function parseIta34Workbook(
  data: ArrayBuffer,
): Promise<ParsedIta34> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      codes: {},
      summary: {},
      warnings: ["The spreadsheet has no sheets to read."],
    };
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    blankrows: false,
  }) as unknown[][];
  return rowsToIta34(rows);
}
