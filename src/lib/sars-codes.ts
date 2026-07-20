/*
 * SARS source codes used by this app, extracted from a real ITA34 structure.
 * Reference data stays in version-controlled code, reviewed via PR, never in
 * a mutable database.
 */

export type SarsCodeKind = "income" | "deduction" | "credit";

export interface SarsCode {
  code: string;
  description: string;
  kind: SarsCodeKind;
}

export const SARS_CODES: readonly SarsCode[] = [
  {
    code: "3601",
    description: "Income, taxable",
    kind: "income",
  },
  {
    code: "3605",
    description: "Annual payment, taxable",
    kind: "income",
  },
  {
    code: "3713",
    description: "Other allowances, taxable",
    kind: "income",
  },
  {
    code: "3801",
    description: "General fringe benefits",
    kind: "income",
  },
  {
    code: "3805",
    description: "Medical scheme fringe benefit",
    kind: "income",
  },
  {
    code: "3817",
    description: "Pension fund contributions fringe benefit",
    kind: "income",
  },
  {
    code: "4201",
    description: "Local interest (excluding SARS interest)",
    kind: "income",
  },
  {
    code: "4029",
    description: "Retirement fund contributions",
    kind: "deduction",
  },
  {
    code: "4102",
    description: "PAYE credit (employees' tax already withheld)",
    kind: "credit",
  },
  {
    code: "4210",
    description: "Local rental income",
    kind: "income",
  },
  {
    code: "4250",
    description: "Local capital gain",
    kind: "income",
  },
  {
    code: "4011",
    description: "Donations and/or contributions made (section 18A)",
    kind: "deduction",
  },
] as const;

const codeIndex = new Map(SARS_CODES.map((entry) => [entry.code, entry]));

export function describeSarsCode(code: string): SarsCode | undefined {
  return codeIndex.get(code);
}
