import { formatRand } from "@/lib/format";
import type { ComparisonRow } from "./compare";

/*
 * A plain formatting layer over compareAssessments's output, no new tax
 * calculation. Turns the mismatched rows from the Compare page into a
 * summary the taxpayer can use as their own reference when completing a
 * Notice of Objection (NOO) on SARS eFiling. This is deliberately not a
 * submission-ready objection letter: the app has no eFiling integration (no
 * server routes exist by design) and cannot guarantee legal correctness, so
 * it is framed as supporting material only.
 */

export interface ObjectionLine {
  code?: string;
  key?: string;
  description: string;
  appAmount: number | null;
  sarsAmount: number | null;
  delta: number | null;
  reasoning: string;
}

function reasoningFor(row: ComparisonRow): string {
  if (row.mineAmount === null) {
    return (
      `This app did not calculate a figure for this line. SARS assessed ` +
      `${formatRand(row.sarsAmount ?? 0)}, check your own records, IRP5, or ` +
      `supporting documents for whether that figure is correct.`
    );
  }
  if (row.sarsAmount === null || row.delta === null) {
    return `Our calculation gives ${formatRand(row.mineAmount)} for this line, SARS's figure could not be read.`;
  }
  return (
    `Our calculation gives ${formatRand(row.mineAmount)} for ${row.description}; ` +
    `SARS assessed ${formatRand(row.sarsAmount)}, a difference of ` +
    `${formatRand(Math.abs(row.delta))}. Check the underlying payslip, IRP5, or ` +
    `supporting document for this figure.`
  );
}

export function buildObjectionSummary(
  rows: readonly ComparisonRow[],
): ObjectionLine[] {
  return rows
    .filter((row) => row.status === "mismatch")
    .map((row) => ({
      code: row.code,
      key: row.key,
      description: row.description,
      appAmount: row.mineAmount,
      sarsAmount: row.sarsAmount,
      delta: row.delta,
      reasoning: reasoningFor(row),
    }));
}

/*
 * Plain-text export, stable in format since a taxpayer may paste this
 * directly into eFiling's free-text objection field.
 */
export function formatObjectionSummaryText(
  lines: readonly ObjectionLine[],
  taxYearLabel: string,
): string {
  if (lines.length === 0) {
    return `No mismatches found for ${taxYearLabel}. Nothing to object to.`;
  }
  const header = [
    `Objection summary, ${taxYearLabel}`,
    `For your own reference when completing a Notice of Objection on SARS eFiling.`,
    `This is not tax advice and is not affiliated with or endorsed by SARS.`,
    "",
  ];
  const body = lines.flatMap((line) => [
    `${line.code ?? line.key ?? ""} ${line.description}`.trim(),
    `  Your calculation: ${
      line.appAmount === null ? "not calculated" : formatRand(line.appAmount)
    }`,
    `  SARS assessment: ${
      line.sarsAmount === null ? "not available" : formatRand(line.sarsAmount)
    }`,
    `  Difference: ${line.delta === null ? "n/a" : formatRand(line.delta)}`,
    `  ${line.reasoning}`,
    "",
  ]);
  return [...header, ...body].join("\n").trimEnd();
}
