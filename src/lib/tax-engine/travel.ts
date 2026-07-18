import { roundToCent } from "./money";
import type { TaxYearTables, TravelCostBand } from "./types";

/*
 * Deemed cost travel deduction against a travel allowance, section 8(1)(b)
 * read with the annual SARS cost scale. The rate per kilometre is the
 * fixed cost divided by total kilometres travelled in the year, plus the
 * fuel rate where the taxpayer bore the full fuel cost, plus the
 * maintenance rate where the taxpayer bore the full maintenance cost. The
 * deduction is that rate times business kilometres, and can never exceed
 * the allowance received.
 */

export interface TravelClaimInput {
  /** Travel allowance received for the year (IRP5 code 3701). */
  allowanceReceived: number;
  /** Total kilometres travelled in the year, business and private. */
  totalKm: number;
  /** Business kilometres from the logbook. */
  businessKm: number;
  /** Vehicle value: cost including VAT, excluding finance charges. */
  vehicleValue: number;
  paidFullFuel: boolean;
  paidFullMaintenance: boolean;
}

export interface TravelDeductionResult {
  ratePerKm: number;
  /** Deemed cost of business travel before the allowance cap. */
  deemedCost: number;
  /** The deduction allowed: deemed cost capped at the allowance. */
  allowed: number;
}

function bandFor(
  vehicleValue: number,
  bands: TravelCostBand[],
): TravelCostBand {
  for (const band of bands) {
    if (band.maxVehicleValue === null || vehicleValue <= band.maxVehicleValue) {
      return band;
    }
  }
  return bands[bands.length - 1];
}

export function travelDeduction(
  input: TravelClaimInput,
  tables: TaxYearTables,
): TravelDeductionResult {
  const { allowanceReceived, totalKm, vehicleValue } = input;
  const businessKm = Math.min(input.businessKm, totalKm);
  if (
    allowanceReceived <= 0 ||
    totalKm <= 0 ||
    businessKm <= 0 ||
    vehicleValue <= 0
  ) {
    return { ratePerKm: 0, deemedCost: 0, allowed: 0 };
  }
  const band = bandFor(vehicleValue, tables.travelDeemedCost);
  const ratePerKm =
    band.fixedCost / totalKm +
    (input.paidFullFuel ? band.fuelCentsPerKm / 100 : 0) +
    (input.paidFullMaintenance ? band.maintenanceCentsPerKm / 100 : 0);
  const deemedCost = roundToCent(ratePerKm * businessKm);
  return {
    ratePerKm,
    deemedCost,
    allowed: roundToCent(Math.min(deemedCost, allowanceReceived)),
  };
}
