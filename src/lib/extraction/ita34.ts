/*
 * Parser for a pasted SARS ITA34 export. Partial reads are expected and
 * fine: a figure that cannot be read stays absent, it is never assumed to
 * be zero. Treating a missing field as zero would create a fake delta
 * against a real calculated figure in the comparison.
 */

export interface ParsedIta34 {
  /** Amounts by SARS source code. Trailing minus means negative. */
  codes: Record<string, number>;
  summary: {
    taxableIncome?: number;
    assessedTaxAfterRebates?: number;
    /** Credits offset tax, SARS shows them negative. */
    taxCredits?: number;
    assessmentResult?: number;
  };
  warnings: string[];
}

/** Amount token: grouped digits, optional cents, optional trailing minus. */
const AMOUNT_TOKEN = /(\d{1,3}(?:[ ,]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(-?)/;

function parseTrailingAmount(line: string): number | null {
  const match = line.match(
    new RegExp(`${AMOUNT_TOKEN.source}\\s*$`),
  );
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1].replace(/[ ,]/g, ""));
  if (!Number.isFinite(value)) {
    return null;
  }
  return match[2] === "-" ? -value : value;
}

const SUMMARY_PATTERNS: [keyof ParsedIta34["summary"], RegExp][] = [
  ["taxableIncome", /taxable income/i],
  ["assessedTaxAfterRebates", /assessed tax after rebates/i],
  ["taxCredits", /tax credits and adjustments/i],
  ["assessmentResult", /assessment result/i],
];

export function parseIta34Text(rawText: string): ParsedIta34 {
  const parsed: ParsedIta34 = { codes: {}, summary: {}, warnings: [] };

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }

    const codeMatch = line.match(/^(\d{4})\s+\D/);
    if (codeMatch) {
      const amount = parseTrailingAmount(line);
      if (amount !== null) {
        parsed.codes[codeMatch[1]] = amount;
      }
      continue;
    }

    for (const [key, pattern] of SUMMARY_PATTERNS) {
      if (pattern.test(line) && parsed.summary[key] === undefined) {
        const amount = parseTrailingAmount(line);
        if (amount !== null) {
          parsed.summary[key] = amount;
        }
      }
    }
  }

  if (
    Object.keys(parsed.codes).length === 0 &&
    Object.keys(parsed.summary).length === 0
  ) {
    parsed.warnings.push(
      "No SARS codes or summary figures could be read from the pasted text. Values can be filled in manually to complete the comparison.",
    );
  }

  return parsed;
}
