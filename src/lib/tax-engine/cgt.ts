import { roundToCent } from "./money";
import type { TaxYearTables } from "./types";

export interface CapitalGainInput {
  /**
   * Net capital gains for the year after per-disposal exclusions (for
   * example the primary residence exclusion) have already been applied.
   */
  netGains: number;
  /** The annual exclusion is larger in the year the taxpayer dies. */
  isDeathYear?: boolean;
}

/*
 * Taxable capital gain: net gains less the annual exclusion, multiplied by
 * the inclusion rate. The result is added to taxable income. A net loss
 * contributes nothing to taxable income here; loss carry-forward is tracked
 * at the assessment level, not inside this function.
 */
export function taxableCapitalGain(
  input: CapitalGainInput,
  tables: TaxYearTables,
): number {
  const exclusion = input.isDeathYear
    ? tables.cgt.deathYearExclusion
    : tables.cgt.annualExclusion;
  const included = Math.max(0, input.netGains - exclusion);
  return roundToCent(included * tables.cgt.inclusionRate);
}
