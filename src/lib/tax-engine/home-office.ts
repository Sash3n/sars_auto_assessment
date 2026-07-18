import { roundToCent } from "./money";

/*
 * Area based home office apportionment. The office's share of the home's
 * running costs (rent or bond interest, rates, electricity, cleaning) is
 * the office floor area over the total floor area. Directly claimable
 * office expenses are added in full.
 */

export interface HomeOfficeInput {
  directExpenses: number;
  runningCosts: number;
  officeAreaM2: number;
  homeAreaM2: number;
}

export interface HomeOfficeResult {
  /** Office share of the home, 0 to 100. */
  percent: number;
  /** Running costs apportioned by area. */
  apportioned: number;
  /** Apportioned running costs plus direct expenses. */
  total: number;
}

export function homeOfficeDeduction(input: HomeOfficeInput): HomeOfficeResult {
  const hasAreas = input.officeAreaM2 > 0 && input.homeAreaM2 > 0;
  const share = hasAreas
    ? Math.min(1, input.officeAreaM2 / input.homeAreaM2)
    : 0;
  const apportioned = roundToCent(Math.max(0, input.runningCosts) * share);
  return {
    percent: share * 100,
    apportioned,
    total: roundToCent(apportioned + Math.max(0, input.directExpenses)),
  };
}
