import type { ParsedIta34 } from "@/lib/extraction/ita34";
import { describeSarsCode } from "@/lib/sars-codes";
import type { Assessment } from "./assessment";
import { roundToCent } from "./money";

/*
 * Line-by-line diff of our calculated assessment against the SARS
 * auto-assessment. A SARS-side figure that could not be extracted is shown
 * as not available, never assumed zero, and the user can fill it in
 * manually. Any mismatch above the configurable threshold is flagged.
 */

export type ComparisonStatus = "match" | "mismatch" | "not-available";

export interface ComparisonRow {
  /** SARS source code, when the row is a coded line. */
  code?: string;
  /** Stable key for summary rows. */
  key?: string;
  description: string;
  mineAmount: number | null;
  sarsAmount: number | null;
  delta: number | null;
  status: ComparisonStatus;
}

function statusFor(
  mine: number | null,
  sars: number | null,
  threshold: number,
): { delta: number | null; status: ComparisonStatus } {
  if (sars === null) {
    return { delta: null, status: "not-available" };
  }
  if (mine === null) {
    return { delta: null, status: "mismatch" };
  }
  const delta = roundToCent(mine - sars);
  return {
    delta,
    status: Math.abs(delta) <= threshold ? "match" : "mismatch",
  };
}

export function compareAssessments(
  mine: Assessment,
  sars: ParsedIta34,
  threshold: number,
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const seenCodes = new Set<string>();

  for (const line of mine.incomeLines.concat(mine.deductionLines)) {
    if (!line.code) {
      continue;
    }
    seenCodes.add(line.code);
    const sarsAmount = sars.codes[line.code] ?? null;
    rows.push({
      code: line.code,
      description: line.description,
      mineAmount: line.amount,
      sarsAmount,
      ...statusFor(line.amount, sarsAmount, threshold),
    });
  }

  // Codes SARS assessed that we did not calculate at all are the most
  // interesting discrepancies, so they are always shown.
  for (const [code, amount] of Object.entries(sars.codes)) {
    if (seenCodes.has(code)) {
      continue;
    }
    rows.push({
      code,
      description:
        describeSarsCode(code)?.description ?? "Assessed by SARS only",
      mineAmount: null,
      sarsAmount: amount,
      delta: null,
      status: "mismatch",
    });
  }

  const summaryRows: [string, string, number, number | undefined][] = [
    [
      "taxableIncome",
      "Taxable income",
      mine.taxableIncome,
      sars.summary.taxableIncome,
    ],
    [
      "assessedTaxAfterRebates",
      "Assessed tax after rebates",
      mine.assessedTaxAfterRebates,
      sars.summary.assessedTaxAfterRebates,
    ],
    [
      "taxCredits",
      "Tax credits and adjustments",
      -mine.paye,
      sars.summary.taxCredits,
    ],
    [
      "assessmentResult",
      "Assessment result",
      mine.assessmentResult,
      sars.summary.assessmentResult,
    ],
  ];

  for (const [key, description, mineAmount, sarsAmount] of summaryRows) {
    const sarsValue = sarsAmount ?? null;
    rows.push({
      key,
      description,
      mineAmount,
      sarsAmount: sarsValue,
      ...statusFor(mineAmount, sarsValue, threshold),
    });
  }

  return rows;
}
