import { roundToCent } from "./money";
import type { TaxYearTables } from "./types";

export interface InterestSplit {
  exempt: number;
  taxable: number;
}

/*
 * Section 10(1)(i): local interest is exempt up to an annual limit that
 * depends on age. SARS shows the exemption as a negative adjustment line
 * directly under source code 4201.
 */
export function splitExemptInterest(
  localInterest: number,
  age: number,
  tables: TaxYearTables,
): InterestSplit {
  if (localInterest < 0) {
    throw new Error(`Interest cannot be negative, got ${localInterest}`);
  }
  const limit =
    age >= 65
      ? tables.interestExemption.from65
      : tables.interestExemption.under65;
  const exempt = Math.min(localInterest, limit);
  return {
    exempt: roundToCent(exempt),
    taxable: roundToCent(localInterest - exempt),
  };
}
